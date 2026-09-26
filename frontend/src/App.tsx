import React, { useState, useEffect } from 'react';
import type { ViewMode, AuctionState, Franchise, Player, AuditLog, AdminPlayer, AdminFranchise, AuthRole, AuthSession } from './types';
import { api } from './services/api';
import { auctionWs } from './services/websocket';
import { Sidebar } from './components/Sidebar';
import { PublicView } from './components/PublicView';
import { ProjectorView } from './components/ProjectorView';
import { FranchiseBiddingView } from './components/FranchiseBiddingView';
import { AdminControlView } from './components/AdminControlView';
import { PlayerRegistrationView } from './components/PlayerRegistrationView';
import { SquadsLeaderboardView } from './components/SquadsLeaderboardView';
import { SquadAnalysisModal } from './components/SquadAnalysisModal';
import { AuditLogModal } from './components/AuditLogModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import confetti from 'canvas-confetti';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('public');
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [adminFranchises, setAdminFranchises] = useState<AdminFranchise[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [adminPlayers, setAdminPlayers] = useState<AdminPlayer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Auth State
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => api.getSession());
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [loginDestination, setLoginDestination] = useState<'admin' | 'bidding'>('admin');
  const adminRole = authSession?.role ?? null;
  const canViewAdmin = adminRole === 'Super Admin' || adminRole === 'Admin' || adminRole === 'Operator';

  // Modals
  const [isSquadAnalysisOpen, setIsSquadAnalysisOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  const fetchInitialData = async (session = authSession) => {
    try {
      const [stateData, fData, pData] = await Promise.all([
        api.getAuctionState(),
        api.getPublicFranchises(),
        api.getPublicPlayers(),
      ]);
      let aFData: AdminFranchise[] = [];
      let aPData: AdminPlayer[] = [];
      let logsData: AuditLog[] = [];
      if (session && ['Super Admin', 'Admin', 'Operator'].includes(session.role)) {
        [aFData, aPData, logsData] = await Promise.all([
          api.getAdminFranchises(),
          api.getAdminPlayers(),
          api.getAuditLog(),
        ]);
      }
      setAuctionState(stateData);
      setFranchises(fData);
      setAdminFranchises(aFData);
      setPlayers(pData);
      setAdminPlayers(aPData);
      setAuditLogs(logsData);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Connect to WebSocket for real-time live updates
    const unsubscribe = auctionWs.subscribe((msg) => {
      if (msg.type === 'AUCTION_STATE_UPDATE') {
        setAuctionState(msg.data);
        // Refresh franchises & players to keep purse and squad sync'd
        api.getPublicFranchises().then(setFranchises).catch(console.error);
        api.getPublicPlayers().then(setPlayers).catch(console.error);
        const session = api.getSession();
        if (session && ['Super Admin', 'Admin', 'Operator'].includes(session.role)) {
          api.getAdminFranchises().then(setAdminFranchises).catch(console.error);
          api.getAdminPlayers().then(setAdminPlayers).catch(console.error);
          api.getAuditLog().then(setAuditLogs).catch(console.error);
        }
      }
    });
    auctionWs.connect();

    return () => {
      unsubscribe();
      auctionWs.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setAuthSession(null);
      setCurrentView('public');
    };
    window.addEventListener('auction:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auction:auth-expired', handleAuthExpired);
  }, []);

  const handleSelectView = (view: ViewMode) => {
    if (view === 'admin' && !canViewAdmin) {
      setLoginDestination('admin');
      setIsAdminLoginOpen(true);
      return;
    }
    if (view === 'bidding' && !['Captain', 'Admin', 'Super Admin'].includes(adminRole ?? '')) {
      if (adminRole === 'Operator') {
        alert('This account is not authorized for franchise bidding.');
        return;
      }
      setLoginDestination('bidding');
      setIsAdminLoginOpen(true);
      return;
    }
    setCurrentView(view);
  };

  const handleAdminLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
    setIsAdminLoginOpen(false);
    setCurrentView(session.role === 'Captain' ? 'bidding' : loginDestination);
    fetchInitialData(session);
  };

  const handleAdminLogout = () => {
    api.logout();
    setAuthSession(null);
    setCurrentView('public');
  };

  const requireCaptainLogin = () => {
    setLoginDestination('bidding');
    setIsAdminLoginOpen(true);
  };

  const requireAdminLogin = () => {
    setLoginDestination('admin');
    setIsAdminLoginOpen(true);
  };

  const handleUndo = async (auditId: number, reason: string) => {
    try {
      await api.undoTransaction(auditId, reason);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Undo failed');
    }
  };

  const handleExportExcel = async () => {
    if (!canViewAdmin) {
      requireAdminLogin();
      return;
    }
    try {
      const url = URL.createObjectURL(await api.exportExcel());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Avanthi_Cricket_Carnival_Auction_Data.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    }
  };

  const openAuditLog = () => {
    if (!canViewAdmin) {
      requireAdminLogin();
      return;
    }
    setIsAuditLogOpen(true);
  };

  const biddingFranchises = authSession?.role === 'Captain'
    ? franchises.filter((franchise) => franchise.id === authSession.franchise_id)
    : franchises;

  const isProjectorView = currentView === 'projector';

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 selection:bg-indigo-500 selection:text-white flex flex-col md:flex-row">
      {/* Sidebar — full width normally, icon-only strip in projector view */}
      <Sidebar
        currentView={currentView}
        onSelectView={handleSelectView}
        onOpenSquadAnalysis={() => setIsSquadAnalysisOpen(true)}
        onOpenAuditLog={openAuditLog}
        onExportExcel={handleExportExcel}
        collapsed={isProjectorView}
      />

      {/* Main Content Area — offset by sidebar width */}
      <main className={`flex-1 transition-all duration-200 ${isProjectorView ? 'md:ml-16' : 'md:ml-64'}`}>
        {currentView === 'public' && (
          <PublicView
            auctionState={auctionState}
            franchises={franchises}
            players={players}
            onRefreshState={fetchInitialData}
            userRole={adminRole}
            userFranchiseId={authSession?.franchise_id ?? null}
            onRequireLogin={requireCaptainLogin}
            onRequireAdmin={requireAdminLogin}
          />
        )}

        {currentView === 'projector' && (
          <ProjectorView auctionState={auctionState} franchises={franchises} />
        )}

        {currentView === 'bidding' && (
          <FranchiseBiddingView
            auctionState={auctionState}
            franchises={biddingFranchises}
            onRefreshState={fetchInitialData}
            onLogout={handleAdminLogout}
          />
        )}

        {currentView === 'admin' && (
          <AdminControlView
            auctionState={auctionState}
            franchises={adminFranchises}
            adminPlayers={adminPlayers}
            adminRole={adminRole as AuthRole | null}
            onLogout={handleAdminLogout}
            onRefreshState={fetchInitialData}
          />
        )}

        {currentView === 'register' && (
          <PlayerRegistrationView onSuccess={fetchInitialData} />
        )}

        {currentView === 'squads' && (
          <SquadsLeaderboardView
            franchises={franchises}
            players={players}
            auctionState={auctionState}
          />
        )}
      </main>

      {/* Modals */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      <SquadAnalysisModal
        isOpen={isSquadAnalysisOpen}
        onClose={() => setIsSquadAnalysisOpen(false)}
        franchises={franchises}
        players={players}
        auctionState={auctionState}
      />

      <AuditLogModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
        auditLogs={auditLogs}
        franchises={franchises}
        players={players}
        onUndo={handleUndo}
      />
    </div>
  );
};
