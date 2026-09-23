import React, { useState, useEffect } from 'react';
import type { ViewMode, AuctionState, Franchise, Player, AuditLog, AdminPlayer, AdminFranchise } from './types';
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
  const [adminRole, setAdminRole] = useState<'Super Admin' | 'Operator' | null>(() => {
    return (localStorage.getItem('acc_admin_role') as any) || null;
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  // Modals
  const [isSquadAnalysisOpen, setIsSquadAnalysisOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  const fetchInitialData = async () => {
    try {
      const [stateData, fData, aFData, pData, aPData, logsData] = await Promise.all([
        api.getAuctionState(),
        api.getPublicFranchises(),
        api.getAdminFranchises().catch(() => []),
        api.getPublicPlayers(),
        api.getAdminPlayers().catch(() => []),
        api.getAuditLog().catch(() => []),
      ]);
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
    auctionWs.connect();

    const unsubscribe = auctionWs.subscribe((msg) => {
      if (msg.type === 'AUCTION_STATE_UPDATE') {
        setAuctionState(msg.data);
        // Refresh franchises & players to keep purse and squad sync'd
        api.getPublicFranchises().then(setFranchises).catch(console.error);
        api.getPublicPlayers().then(setPlayers).catch(console.error);
        api.getAdminPlayers().then(setAdminPlayers).catch(console.error);
        api.getAuditLog().then(setAuditLogs).catch(console.error);
      }
    });

    return () => {
      unsubscribe();
      auctionWs.disconnect();
    };
  }, []);

  const handleSelectView = (view: ViewMode) => {
    if (view === 'admin' && !adminRole) {
      setIsAdminLoginOpen(true);
      return;
    }
    setCurrentView(view);
  };

  const handleAdminLoginSuccess = (role: 'Super Admin' | 'Operator') => {
    setAdminRole(role);
    localStorage.setItem('acc_admin_role', role);
    setIsAdminLoginOpen(false);
    setCurrentView('admin');
  };

  const handleAdminLogout = () => {
    setAdminRole(null);
    localStorage.removeItem('acc_admin_role');
    setCurrentView('public');
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

  const handleExportExcel = () => {
    window.open(api.exportExcelUrl(), '_blank');
  };

  const isProjectorView = currentView === 'projector';

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 selection:bg-indigo-500 selection:text-white flex flex-col md:flex-row">
      {/* Sidebar — full width normally, icon-only strip in projector view */}
      <Sidebar
        currentView={currentView}
        onSelectView={handleSelectView}
        onOpenSquadAnalysis={() => setIsSquadAnalysisOpen(true)}
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
        onExportExcel={handleExportExcel}
        collapsed={isProjectorView}
      />

      {/* Main Content Area — offset by sidebar width */}
      <main className={`flex-1 transition-all duration-200 ${isProjectorView ? 'md:ml-16' : 'md:ml-64'}`}>
        {currentView === 'public' && (
          <PublicView auctionState={auctionState} franchises={franchises} players={players} onRefreshState={fetchInitialData} />
        )}

        {currentView === 'projector' && (
          <ProjectorView auctionState={auctionState} franchises={franchises} />
        )}

        {currentView === 'bidding' && (
          <FranchiseBiddingView
            auctionState={auctionState}
            franchises={franchises}
            onRefreshState={fetchInitialData}
          />
        )}

        {currentView === 'admin' && (
          <AdminControlView
            auctionState={auctionState}
            franchises={adminFranchises}
            adminPlayers={adminPlayers}
            auditLogs={auditLogs}
            adminRole={adminRole}
            onLogout={handleAdminLogout}
            onRefreshState={fetchInitialData}
            onOpenAuditLog={() => setIsAuditLogOpen(true)}
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
