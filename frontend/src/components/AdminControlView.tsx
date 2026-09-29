import React, { useState, useMemo } from 'react';
import type { AuctionState, AdminPlayer, AdminFranchise, AuthRole } from '../types';
import { api } from '../services/api';
import {
  ShieldCheck, Gavel, SkipForward, RotateCcw, Sliders, UserCheck, AlertCircle,
  Edit, Trash2, X, Upload, Image, Search, User, CheckCircle2, Play, Pause, Square, Clock
} from 'lucide-react';

interface AdminControlViewProps {
  auctionState: AuctionState | null;
  franchises: AdminFranchise[];
  adminPlayers: AdminPlayer[];
  adminRole: AuthRole | null;
  onLogout: () => void;
  onRefreshState: () => void;
}

export const AdminControlView: React.FC<AdminControlViewProps> = ({
  auctionState,
  franchises,
  adminPlayers,
  adminRole,
  onLogout,
  onRefreshState,
}) => {
  const [activeTab, setActiveTab] = useState<'auction' | 'players' | 'franchises' | 'override'>(() => adminRole === 'Operator' ? 'players' : 'auction');
  const visibleTabs: Array<'auction' | 'players' | 'franchises' | 'override'> = adminRole === 'Operator'
    ? ['auction', 'players', 'franchises']
    : adminRole === 'Admin'
      ? ['auction', 'players', 'franchises']
      : ['auction', 'players', 'franchises', 'override'];

  // Direct Assign State
  const [directPlayerId, setDirectPlayerId] = useState<number>(adminPlayers[0]?.id || 1);
  const [directFranchiseId, setDirectFranchiseId] = useState<number>(franchises[0]?.id || 1);
  const [directPrice, setDirectPrice] = useState<number>(20);
  const [directReason, setDirectReason] = useState<string>('Super Admin Direct Assignment');
  const [assistedBidFranchiseId, setAssistedBidFranchiseId] = useState<number>(franchises[0]?.id || 1);

  // Undo State
  const [undoAuditId, setUndoAuditId] = useState<number | ''>('');
  const [undoReason, setUndoReason] = useState<string>('Recording correction');

  // Relax Minimum State
  const [relaxBucket, setRelaxBucket] = useState<string>('B5');
  const [relaxMinVal, setRelaxMinVal] = useState<number>(1);
  const [relaxReason, setRelaxReason] = useState<string>('Supply shortage in bucket');

  // Override Year State
  const [overridePlayerId, setOverridePlayerId] = useState<number>(adminPlayers[0]?.id || 1);
  const [overrideYearVal, setOverrideYearVal] = useState<number>(2);
  const [guestLotNumber, setGuestLotNumber] = useState<number | ''>('');

  // Quick Resolve Profile State
  const [resolvePlayerId, setResolvePlayerId] = useState<number | null>(null);
  const [resolveUrl, setResolveUrl] = useState<string>('');
  const [resolvePhone, setResolvePhone] = useState<string>('');

  // Admin Players Filter & Search State
  const [playerBucketFilter, setPlayerBucketFilter] = useState<string>('ALL');
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');

  // Edit Player Modal State
  const [editingPlayer, setEditingPlayer] = useState<AdminPlayer | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerRoll, setEditPlayerRoll] = useState('');
  const [editPlayerMobile, setEditPlayerMobile] = useState('');
  const [editPlayerCourse, setEditPlayerCourse] = useState('UG');
  const [editPlayerProgram, setEditPlayerProgram] = useState('B.Tech');
  const [editPlayerBranch, setEditPlayerBranch] = useState('CSE');
  const [editPlayerYear, setEditPlayerYear] = useState<number>(1);
  const [editPlayerBucket, setEditPlayerBucket] = useState('B1');
  const [editPlayerBasePrice, setEditPlayerBasePrice] = useState<number>(20);
  const [editPlayerType, setEditPlayerType] = useState('Batter');
  const [editPlayerPhoto, setEditPlayerPhoto] = useState('');
  const [editPlayerPaymentStatus, setEditPlayerPaymentStatus] = useState('unpaid');
  const [editPlayerProfileStatus, setEditPlayerProfileStatus] = useState('completed');

  // Delete Player Modal State
  const [deletingPlayer, setDeletingPlayer] = useState<AdminPlayer | null>(null);

  // Franchise Registration Form State
  const [newFranchiseName, setNewFranchiseName] = useState('');
  const [newFranchiseCode, setNewFranchiseCode] = useState('');
  const [newFranchiseLogo, setNewFranchiseLogo] = useState('');
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyDept, setNewFacultyDept] = useState('');
  const [newFacultyMobile, setNewFacultyMobile] = useState('');
  const [newCaptainName, setNewCaptainName] = useState('');
  const [newCaptainMobile, setNewCaptainMobile] = useState('');
  const [newViceCaptainName, setNewViceCaptainName] = useState('');
  const [newViceCaptainMobile, setNewViceCaptainMobile] = useState('');
  const [showAddFranchiseForm, setShowAddFranchiseForm] = useState(false);

  // Franchise Edit Form State
  const [editingFranchiseId, setEditingFranchiseId] = useState<number | null>(null);
  const [editFranchiseName, setEditFranchiseName] = useState('');
  const [editFranchiseCode, setEditFranchiseCode] = useState('');
  const [editFranchiseLogo, setEditFranchiseLogo] = useState('');
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyDept, setEditFacultyDept] = useState('');
  const [editFacultyMobile, setEditFacultyMobile] = useState('');
  const [editCaptainName, setEditCaptainName] = useState('');
  const [editCaptainMobile, setEditCaptainMobile] = useState('');
  const [editViceCaptainName, setEditViceCaptainName] = useState('');
  const [editViceCaptainMobile, setEditViceCaptainMobile] = useState('');

  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activePlayer = auctionState?.current_player;
  const selectedDirectPlayerId = adminPlayers.some((player) => player.id === directPlayerId) ? directPlayerId : adminPlayers[0]?.id || 1;
  const selectedDirectFranchiseId = franchises.some((franchise) => franchise.id === directFranchiseId) ? directFranchiseId : franchises[0]?.id || 1;

  // Franchise Image File Upload Handler with Max 300 KB Validation
  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImageState: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 300 * 1024) {
      setAdminMsg({ type: 'error', text: 'Selected image exceeds 300 KB limit. Please choose a smaller photo.' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageState(reader.result);
        setAdminMsg({ type: 'success', text: 'Photo loaded successfully! Remember to save changes.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleHammer = async () => {
    setAdminMsg(null);
    try {
      const res = await api.hammerLot(adminRole || 'Super Admin');
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Hammer action failed' });
    }
  };

  const handleAssistedBid = async () => {
    const franchise = franchises.find((item) => item.id === assistedBidFranchiseId);
    if (!franchise || !auctionState) return;
    setAdminMsg(null);
    try {
      const result = await api.placeBid(franchise.id, auctionState.next_required_bid, franchise.short_code);
      setAdminMsg({ type: 'success', text: `Recorded bid of ${result.new_bid} for ${franchise.name}.` });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Assisted bid failed' });
    }
  };

  const handleResolveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvePlayerId) return;
    setAdminMsg(null);
    try {
      await api.resolvePlayerProfile(resolvePlayerId, resolveUrl, resolvePhone);
      setAdminMsg({ type: 'success', text: 'Profile creation pending status resolved successfully!' });
      setResolvePlayerId(null);
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Resolve profile failed' });
    }
  };

  const handleSkip = async () => {
    setAdminMsg(null);
    try {
      const res = await api.skipPlayer(adminRole || 'Super Admin');
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Skip action failed' });
    }
  };

  const handleStartTimer = async () => {
    setAdminMsg(null);
    try {
      const res = await api.updateTimerConfig(undefined, 'start');
      setAdminMsg({ type: 'success', text: res.message || 'Timer started.' });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Failed to start timer' });
    }
  };

  const handlePauseResumeTimer = async () => {
    setAdminMsg(null);
    const action = auctionState?.is_paused ? 'resume' : 'pause';
    try {
      const res = await api.updateTimerConfig(undefined, action);
      setAdminMsg({ type: 'success', text: res.message || `Timer ${action}d.` });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || `Failed to ${action} timer` });
    }
  };

  const handleStopTimer = async () => {
    setAdminMsg(null);
    try {
      const res = await api.updateTimerConfig(undefined, 'stop');
      setAdminMsg({ type: 'success', text: res.message || 'Timer stopped.' });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Failed to stop timer' });
    }
  };

  const handleDrawNext = async () => {
    setAdminMsg(null);
    if (auctionState?.draw_mode === 'guest' && guestLotNumber === '') {
      setAdminMsg({ type: 'error', text: 'Enter the guest-called lot number for the active bucket.' });
      return;
    }
    try {
      await api.drawNextPlayer(auctionState?.draw_mode === 'guest' ? Number(guestLotNumber) : undefined);
      setGuestLotNumber('');
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Draw next failed' });
    }
  };

  const handleSetDrawMode = async (mode: 'auto' | 'guest') => {
    setAdminMsg(null);
    try {
      await api.setDrawMode(mode);
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Draw mode update failed' });
    }
  };

  const handleAutoAllot = async () => {
    setAdminMsg(null);
    try {
      const result = await api.autoAllotRoundTwo();
      const unresolvedCount = Object.keys(result.unresolved).length;
      setAdminMsg({
        type: unresolvedCount ? 'error' : 'success',
        text: `Allotted ${result.assignments.length} player(s). ${unresolvedCount} franchise(s) still need a bucket minimum or auction purchase.`,
      });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Auto-allotment failed' });
    }
  };

  const handleDirectAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg(null);
    try {
      const res = await api.directAssignPlayer(selectedDirectPlayerId, selectedDirectFranchiseId, directPrice, directReason);
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Direct assign failed' });
    }
  };

  const handleScoutPlayer = async () => {
    const player = adminPlayers.find((item) => item.id === selectedDirectPlayerId);
    if (!player) return;
    setAdminMsg(null);
    try {
      const result = await api.scoutPlayer(player.id, selectedDirectFranchiseId, player.bucket, directReason);
      setAdminMsg({ type: 'success', text: result.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Scouting failed' });
    }
  };

  const handleUndo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!undoAuditId) return;
    setAdminMsg(null);
    try {
      const res = await api.undoTransaction(Number(undoAuditId), undoReason);
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Undo failed' });
    }
  };

  const handleRelaxMin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg(null);
    try {
      const res = await api.relaxMinimum(relaxBucket, relaxMinVal, relaxReason);
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Relax minimum failed' });
    }
  };

  const handleOverrideYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg(null);
    try {
      const res = await api.overridePlayerYear(overridePlayerId, overrideYearVal);
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Year override failed' });
    }
  };

  const handleTogglePayment = async (playerId: number, currentPaid: boolean) => {
    setAdminMsg(null);
    try {
      await api.markPlayerPaid(playerId, !currentPaid);
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Payment update failed' });
    }
  };

  const handleAssignReferral = async (player: AdminPlayer, franchise: AdminFranchise) => {
    setAdminMsg(null);
    try {
      const result = await api.referPlayer(player.id, franchise.id, 'Verified both player and franchise ACC referral declarations.');
      setAdminMsg({ type: 'success', text: result.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Referral assignment failed' });
    }
  };

  const handleRegisterFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg(null);
    try {
      await api.registerFranchise({
        name: newFranchiseName,
        short_code: newFranchiseCode.toUpperCase(),
        logo_url: newFranchiseLogo || undefined,
        faculty_coordinator_name: newFacultyName,
        faculty_coordinator_dept: newFacultyDept,
        faculty_coordinator_mobile: newFacultyMobile,
        captain_name: newCaptainName || undefined,
        captain_mobile: newCaptainMobile || undefined,
        vice_captain_name: newViceCaptainName || undefined,
        vice_captain_mobile: newViceCaptainMobile || undefined,
      });
      setAdminMsg({ type: 'success', text: `Franchise "${newFranchiseName}" created successfully!` });
      setShowAddFranchiseForm(false);
      setNewFranchiseName(''); setNewFranchiseCode(''); setNewFranchiseLogo('');
      setNewFacultyName(''); setNewFacultyDept(''); setNewFacultyMobile('');
      setNewCaptainName(''); setNewCaptainMobile('');
      setNewViceCaptainName(''); setNewViceCaptainMobile('');
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Franchise creation failed' });
    }
  };

  const handleStartEditFranchise = (f: AdminFranchise) => {
    setEditingFranchiseId(f.id);
    setEditFranchiseName(f.name);
    setEditFranchiseCode(f.short_code);
    setEditFranchiseLogo(f.logo_url || '');
    setEditFacultyName(f.faculty_coordinator_name || '');
    setEditFacultyDept(f.faculty_coordinator_dept || '');
    setEditFacultyMobile(f.faculty_coordinator_mobile || '');
    setEditCaptainName(f.captain_name || '');
    setEditCaptainMobile(f.captain_mobile || '');
    setEditViceCaptainName(f.vice_captain_name || '');
    setEditViceCaptainMobile(f.vice_captain_mobile || '');
  };

  const handleUpdateFranchiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFranchiseId) return;
    setAdminMsg(null);
    try {
      const res = await api.updateFranchise(editingFranchiseId, {
        name: editFranchiseName,
        short_code: editFranchiseCode.toUpperCase(),
        logo_url: editFranchiseLogo || undefined,
        faculty_coordinator_name: editFacultyName,
        faculty_coordinator_dept: editFacultyDept,
        faculty_coordinator_mobile: editFacultyMobile,
        captain_name: editCaptainName || undefined,
        captain_mobile: editCaptainMobile || undefined,
        vice_captain_name: editViceCaptainName || undefined,
        vice_captain_mobile: editViceCaptainMobile || undefined,
      });
      setAdminMsg({ type: 'success', text: res.message });
      setEditingFranchiseId(null);
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Franchise update failed' });
    }
  };

  const handleDeleteFranchise = async (franchiseId: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the franchise "${name}"? This action cannot be undone.`)) return;
    setAdminMsg(null);
    try {
      const res = await api.deleteFranchise(franchiseId);
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Franchise deletion failed' });
    }
  };

  // Player Edit Handler
  const handleStartEditPlayer = (player: AdminPlayer) => {
    setEditingPlayer(player);
    setEditPlayerName(player.name);
    setEditPlayerRoll(player.roll_number);
    setEditPlayerMobile(player.mobile_number);
    setEditPlayerCourse(player.course);
    setEditPlayerProgram(player.program);
    setEditPlayerBranch(player.branch);
    setEditPlayerYear(player.year_of_study);
    setEditPlayerBucket(player.bucket);
    setEditPlayerBasePrice(player.base_price);
    setEditPlayerType(player.derived_player_type);
    setEditPlayerPhoto(player.photo_url || '');
    setEditPlayerPaymentStatus(player.payment_status);
    setEditPlayerProfileStatus(player.profile_status);
  };

  const handleUpdatePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setAdminMsg(null);
    try {
      const res = await api.updatePlayer(editingPlayer.id, {
        name: editPlayerName,
        roll_number: editPlayerRoll,
        mobile_number: editPlayerMobile,
        course: editPlayerCourse,
        program: editPlayerProgram,
        branch: editPlayerBranch,
        year_of_study: editPlayerYear,
        bucket: editPlayerBucket,
        base_price: editPlayerBasePrice,
        derived_player_type: editPlayerType,
        photo_url: editPlayerPhoto || undefined,
        payment_status: editPlayerPaymentStatus,
        profile_status: editPlayerProfileStatus,
      });
      setAdminMsg({ type: 'success', text: res.message });
      setEditingPlayer(null);
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Player update failed' });
    }
  };

  const handleDeletePlayerSubmit = async () => {
    if (!deletingPlayer) return;
    setAdminMsg(null);
    try {
      const res = await api.deletePlayer(deletingPlayer.id);
      setAdminMsg({ type: 'success', text: res.message });
      setDeletingPlayer(null);
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Player deletion failed' });
    }
  };

  // Filtered players calculation for Admin Players management tab
  const filteredAdminPlayers = useMemo(() => {
    return adminPlayers.filter((player) => {
      // Bucket filter
      if (playerBucketFilter === 'UNSOLD') {
        const isAssigned = Boolean(player.sold_franchise_id || player.retained_franchise_id || player.referred_franchise_id);
        if (isAssigned) return false;
      } else if (playerBucketFilter !== 'ALL') {
        if (player.bucket !== playerBucketFilter) return false;
      }

      // Search query filter
      if (playerSearchQuery.trim()) {
        const q = playerSearchQuery.trim().toLowerCase();
        const matchesName = player.name.toLowerCase().includes(q);
        const matchesRoll = player.roll_number.toLowerCase().includes(q);
        const matchesMobile = player.mobile_number.toLowerCase().includes(q);
        const matchesBranch = player.branch.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesMobile && !matchesBranch) return false;
      }

      return true;
    });
  }, [adminPlayers, playerBucketFilter, playerSearchQuery]);

  // Counts for each bucket tab
  const bucketCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: adminPlayers.length,
      B1: 0, B2: 0, B3: 0, B4: 0, B5: 0, PG: 0, UNSOLD: 0,
    };
    adminPlayers.forEach((p) => {
      if (counts[p.bucket] !== undefined) counts[p.bucket]++;
      if (!p.sold_franchise_id && !p.retained_franchise_id && !p.referred_franchise_id) {
        counts.UNSOLD++;
      }
    });
    return counts;
  }, [adminPlayers]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Admin Portal Header */}
      <div className="glass-panel rounded-3xl p-6 border border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-white">Admin Control Portal</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-950 text-indigo-300 border border-indigo-700">
                {adminRole || 'Super Admin'}
              </span>
            </div>
            <p className="text-xs text-gray-400">Authoritative Tournament Operations &amp; Management</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold border border-gray-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Admin Alert / Message Toast */}
      {adminMsg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg animate-in fade-in ${
          adminMsg.type === 'success'
            ? 'bg-emerald-950/80 text-emerald-200 border-emerald-800'
            : 'bg-red-950/80 text-red-200 border-red-800'
        }`}>
          <div className="flex items-center space-x-3">
            {adminMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
            <p className="text-xs font-semibold">{adminMsg.text}</p>
          </div>
          <button onClick={() => setAdminMsg(null)} className="p-1 rounded hover:bg-black/20 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-3">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab;
          const labels: Record<string, string> = {
            auction: 'Live Auction Controls',
            players: 'Player Management',
            franchises: 'Franchise Management',
            override: 'Detained Year Override',
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800/80 border border-gray-800'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Live Auction Controls */}
      {activeTab === 'auction' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-gray-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Current Lot On Screen</h3>
                <p className="text-xs text-indigo-400 font-semibold">Active Bucket: {auctionState?.current_bucket || 'B3'}</p>
              </div>
              {activePlayer && (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {auctionState?.current_bidder ? `Highest Bid: ${auctionState.current_bid_price} Cr` : 'Opening Lot'}
                </span>
              )}
            </div>

            {activePlayer ? (
              <div className="space-y-6">
                <div className="flex items-center space-x-4 p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
                  <img
                    src={activePlayer.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activePlayer.roll_number}`}
                    alt={activePlayer.name}
                    className="w-16 h-16 rounded-2xl bg-gray-950 object-cover border-2 border-indigo-500/40"
                  />
                  <div>
                    <h4 className="text-lg font-extrabold text-white">{activePlayer.name}</h4>
                    <p className="text-xs text-gray-400">
                      Roll: <strong className="text-indigo-400">{activePlayer.roll_number}</strong> &bull; {activePlayer.course} ({activePlayer.branch}) &bull; Lot #{activePlayer.random_lot_number || 1}
                    </p>
                    <p className="text-xs font-semibold text-amber-400 mt-0.5">Base Price: {activePlayer.base_price} Credits</p>
                  </div>
                </div>

                {/* Timer Controls Bar */}
                <div className="p-3 rounded-2xl bg-gray-900 border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Timer Control:</span>
                    <span className={`text-base font-black font-mono ${
                      (auctionState?.timer_seconds ?? 30) <= 5 ? 'text-red-500' : 'text-lime-400'
                    }`}>
                      00:{String(auctionState?.timer_seconds ?? 30).padStart(2, '0')}
                    </span>
                    {auctionState?.is_paused ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-800">
                        PAUSED
                      </span>
                    ) : auctionState?.timer_running ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse">
                        LIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                        STOPPED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleStartTimer}
                      title="Start Timer"
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-xl shadow transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start</span>
                    </button>

                    <button
                      onClick={handlePauseResumeTimer}
                      title={auctionState?.is_paused ? "Resume Timer" : "Pause Timer"}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition flex items-center space-x-1 cursor-pointer ${
                        auctionState?.is_paused
                          ? 'bg-amber-500 text-black border-amber-400 font-black hover:bg-amber-400'
                          : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      {auctionState?.is_paused ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleStopTimer}
                      title="Stop / Reset Timer"
                      className="px-3.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-300 text-xs font-bold rounded-xl border border-red-800 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleHammer}
                    className="py-4 bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-black font-black text-base rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center space-x-2 transition transform active:scale-95"
                  >
                    <Gavel className="w-5 h-5 fill-current" />
                    <span>PRESS HAMMER</span>
                  </button>

                  <button
                    onClick={handleSkip}
                    className="py-4 bg-gray-800 hover:bg-gray-700 text-gray-200 font-extrabold text-sm rounded-2xl border border-gray-700 flex items-center justify-center space-x-2 transition"
                  >
                    <SkipForward className="w-5 h-5 text-gray-400" />
                    <span>SKIP PLAYER</span>
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-gray-800 pt-3">
                  <select
                    value={assistedBidFranchiseId}
                    onChange={(event) => setAssistedBidFranchiseId(Number(event.target.value))}
                    className="glass-input rounded-xl px-3 py-2 text-xs bg-gray-900 text-white"
                  >
                    {franchises.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={handleAssistedBid}
                    disabled={!auctionState?.timer_running || !franchises.length}
                    className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-xs font-bold text-white"
                  >
                    BID FOR TEAM
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 space-y-4">
                <p className="text-base font-bold">No player currently on screen.</p>
                <button
                  onClick={handleDrawNext}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg"
                >
                  DRAW NEXT PLAYER
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-semibold">Draw mode</span>
                {(['auto', 'guest'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSetDrawMode(mode)}
                    aria-pressed={auctionState?.draw_mode === mode}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${auctionState?.draw_mode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button
                onClick={handleDrawNext}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700"
              >
                {auctionState?.draw_mode === 'guest' ? 'Call Lot Number' : 'Draw Next Lot'}
              </button>
            </div>

            {auctionState?.draw_mode === 'guest' && (
              <label className="block text-xs text-gray-300">
                Guest-called number in bucket {auctionState.current_bucket}
                <input
                  type="number"
                  min="1"
                  value={guestLotNumber}
                  onChange={(event) => setGuestLotNumber(event.target.value ? Number(event.target.value) : '')}
                  className="mt-1 w-full glass-input rounded-xl px-3 py-2 text-xs"
                />
              </label>
            )}
            {adminRole === 'Super Admin' && auctionState?.round_number === 2 && !activePlayer && (
              <button
                onClick={handleAutoAllot}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-xl border border-emerald-500"
              >
                COMPLETE ROUND 2 WITH AUTO-ALLOTMENT
              </button>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            {adminRole === 'Super Admin' && (
              <div className="glass-panel rounded-3xl p-5 border border-purple-500/30 space-y-3 shadow-xl">
                <h4 className="text-sm font-extrabold text-purple-300 flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                  <span>Safe Audit-Backed Undo</span>
                </h4>
                <p className="text-[11px] text-gray-400">Reverses any sale from any point. Recalculates purses and bucket counts instantly.</p>

                <form onSubmit={handleUndo} className="space-y-3">
                  <input
                    type="number"
                    placeholder="Audit Log ID #"
                    value={undoAuditId}
                    onChange={(e) => setUndoAuditId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Reason for undo..."
                    value={undoReason}
                    onChange={(e) => setUndoReason(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md"
                  >
                    EXECUTE SAFE UNDO
                  </button>
                </form>
              </div>
            )}

            {adminRole === 'Super Admin' && (
              <div className="glass-panel rounded-3xl p-5 border border-emerald-500/30 space-y-3 shadow-xl">
                <h4 className="text-sm font-extrabold text-emerald-300 flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Direct Player Assignment</span>
                </h4>
                <form onSubmit={handleDirectAssign} className="space-y-3">
                  <select
                    value={selectedDirectPlayerId}
                    onChange={(event) => setDirectPlayerId(Number(event.target.value))}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs bg-gray-900 text-white"
                    required
                    disabled={!adminPlayers.length}
                  >
                    {adminPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.name} ({player.roll_number})</option>
                    ))}
                  </select>
                  <select
                    value={selectedDirectFranchiseId}
                    onChange={(event) => setDirectFranchiseId(Number(event.target.value))}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs bg-gray-900 text-white"
                    required
                    disabled={!franchises.length}
                  >
                    {franchises.map((franchise) => (
                      <option key={franchise.id} value={franchise.id}>{franchise.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={directPrice}
                    onChange={(event) => setDirectPrice(Number(event.target.value))}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs"
                    placeholder="Assignment price"
                    required
                  />
                  <input
                    type="text"
                    value={directReason}
                    onChange={(event) => setDirectReason(event.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs"
                    placeholder="Reason for assignment"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!adminPlayers.length || !franchises.length}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md"
                  >
                    ASSIGN PLAYER
                  </button>
                  {auctionState?.round_number === 2 && !activePlayer && (
                    <button
                      type="button"
                      onClick={handleScoutPlayer}
                      disabled={!adminPlayers.length || !franchises.length}
                      className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md"
                    >
                      SCOUT SELECTED PLAYER AT 20 CREDITS
                    </button>
                  )}
                </form>
              </div>
            )}

            {adminRole === 'Super Admin' && (
              <div className="glass-panel rounded-3xl p-5 border border-amber-500/30 space-y-3 shadow-xl">
                <h4 className="text-sm font-extrabold text-amber-300 flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Uniform Bucket Minimum Relaxation</span>
                </h4>
                <p className="text-[11px] text-gray-400">Reduces requirement for all 11 franchises equally in case of bucket exhaustion.</p>

                <form onSubmit={handleRelaxMin} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={relaxBucket}
                      onChange={(e) => setRelaxBucket(e.target.value)}
                      className="glass-input rounded-xl px-3 py-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="B1">B1 (1st Yr)</option>
                      <option value="B2">B2 (2nd Yr)</option>
                      <option value="B3">B3 (3rd Yr)</option>
                      <option value="B4">B4 (4th Yr)</option>
                      <option value="B5">B5 (Diploma)</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      value={relaxMinVal}
                      onChange={(e) => setRelaxMinVal(Number(e.target.value))}
                      className="glass-input rounded-xl px-3 py-2 text-xs"
                      placeholder="New Min"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Reason for relaxation..."
                    value={relaxReason}
                    onChange={(e) => setRelaxReason(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs rounded-xl shadow-md"
                  >
                    RELAX MINIMUM UNIFORMLY
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Reorganized Admin Player Management */}
      {activeTab === 'players' && (
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Registered Player Management</h3>
              <p className="text-xs text-gray-400">Total Registered: {adminPlayers.length} players &bull; Manage, Edit or Delete</p>
            </div>

            {/* Quick Search Box inside Player Management */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Filter players by name/roll..."
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 glass-input rounded-xl text-xs bg-gray-900 text-white placeholder-gray-500"
              />
              {playerSearchQuery && (
                <button
                  onClick={() => setPlayerSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bucket & Category Filters Header Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-gray-950/80 rounded-2xl border border-gray-800">
            {[
              { id: 'ALL', label: 'All Players' },
              { id: 'B1', label: 'B1 (1st Yr)' },
              { id: 'B2', label: 'B2 (2nd Yr)' },
              { id: 'B3', label: 'B3 (3rd Yr)' },
              { id: 'B4', label: 'B4 (4th Yr)' },
              { id: 'B5', label: 'B5 (Diploma)' },
              { id: 'PG', label: 'PG (Post Grad)' },
              { id: 'UNSOLD', label: 'Unsold Players' },
            ].map((b) => {
              const count = bucketCounts[b.id] ?? 0;
              const isActive = playerBucketFilter === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setPlayerBucketFilter(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
                    isActive
                      ? b.id === 'UNSOLD'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  <span>{b.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-black/30 text-white' : 'bg-gray-800 text-gray-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Player Table */}
          <div className="overflow-x-auto rounded-2xl border border-gray-800 shadow-inner">
            <table className="w-full text-xs text-left text-gray-300">
              <thead className="bg-gray-900/90 uppercase text-[10px] text-gray-400 font-semibold tracking-wider border-b border-gray-800">
                <tr>
                  <th className="p-3">Player Info</th>
                  <th className="p-3">Contact (Private)</th>
                  <th className="p-3">Bucket</th>
                  <th className="p-3">Base Price</th>
                  <th className="p-3">Profile Status</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Actions (Edit / Delete)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 bg-gray-950/40">
                {filteredAdminPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500 font-semibold">
                      No players found in this category.
                    </td>
                  </tr>
                ) : (
                  filteredAdminPlayers.map((p) => {
                    const isSold = Boolean(p.sold_franchise_id || p.retained_franchise_id || p.referred_franchise_id);
                    return (
                      <tr key={p.id} className="hover:bg-gray-800/50 transition">
                        <td className="p-3">
                          <div className="flex items-center space-x-3">
                            <img
                              src={p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.roll_number}`}
                              alt={p.name}
                              className="w-9 h-9 rounded-xl bg-gray-900 object-cover border border-gray-700/60 shrink-0"
                            />
                            <div>
                              <p className="font-bold text-white text-xs">{p.name}</p>
                              <p className="text-[10px] font-mono text-indigo-400">Roll: {p.roll_number}</p>
                              <p className="text-[10px] text-gray-400">{p.course} ({p.branch})</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <p className="text-amber-400 font-mono text-[11px]">{p.mobile_number}</p>
                          <p className="text-indigo-300 font-mono text-[10px]">CH: {p.cricheroes_mobile || 'N/A'}</p>
                        </td>

                        <td className="p-3 font-extrabold text-blue-400">
                          <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-[11px]">
                            {p.bucket}
                          </span>
                        </td>

                        <td className="p-3 font-bold text-emerald-400">
                          {p.base_price} Cr
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.profile_status === 'completed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {p.profile_status}
                          </span>
                        </td>

                        <td className="p-3">
                          {adminRole === 'Operator' ? (
                            <span className="text-[11px] font-bold">{p.payment_status === 'paid' ? 'PAID' : 'UNPAID'}</span>
                          ) : (
                            <button
                              onClick={() => handleTogglePayment(p.id, p.payment_status === 'paid')}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                                p.payment_status === 'paid'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                              }`}
                            >
                              {p.payment_status === 'paid' ? 'PAID' : 'MARK PAID'}
                            </button>
                          )}
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleStartEditPlayer(p)}
                              title="Edit Player Details"
                              className="px-2.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 rounded-lg border border-indigo-700/60 font-bold text-[11px] flex items-center space-x-1 transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {adminRole === 'Super Admin' && (
                              <button
                                onClick={() => setDeletingPlayer(p)}
                                title="Delete Player"
                                className="px-2.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-300 rounded-lg border border-red-700/60 font-bold text-[11px] flex items-center space-x-1 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Franchises Admin View & Photo Upload */}
      {activeTab === 'franchises' && (
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Franchise Management</h3>
              <p className="text-xs text-gray-400">Total Teams: {franchises.length} &bull; Manage Franchises &amp; Direct Photo Upload</p>
            </div>
            {adminRole !== 'Operator' && (
              <button
                onClick={() => setShowAddFranchiseForm(!showAddFranchiseForm)}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition"
              >
                {showAddFranchiseForm ? 'Cancel' : '+ Create New Franchise'}
              </button>
            )}
          </div>

          {/* Franchise Creation Form */}
          {showAddFranchiseForm && adminRole !== 'Operator' && (
            <form onSubmit={handleRegisterFranchise} className="bg-gray-900/90 border border-indigo-500/40 p-5 rounded-2xl space-y-4 shadow-xl">
              <h4 className="text-sm font-black text-white text-indigo-400">Add New Team / Franchise</h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Team Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Strikers"
                    value={newFranchiseName}
                    onChange={(e) => setNewFranchiseName(e.target.value)}
                    className="w-full glass-input rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RST"
                    maxLength={4}
                    value={newFranchiseCode}
                    onChange={(e) => setNewFranchiseCode(e.target.value.toUpperCase())}
                    className="w-full glass-input rounded-xl p-2.5 text-xs uppercase"
                  />
                </div>

                {/* Direct Logo Photo Upload (Max 300 KB) */}
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Franchise Logo Photo (Max 300 KB)
                  </label>
                  <div className="flex items-center space-x-2">
                    {newFranchiseLogo ? (
                      <img src={newFranchiseLogo} alt="Preview" className="w-9 h-9 rounded-lg object-contain bg-gray-950 border border-gray-700" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-500">
                        <Image className="w-4 h-4" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer px-3 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileUpload(e, setNewFranchiseLogo)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800 space-y-3">
                <p className="text-xs font-bold text-indigo-300">Faculty Coordinator</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Coordinator Name *</label>
                    <input type="text" required placeholder="Dr. John Doe" value={newFacultyName} onChange={(e) => setNewFacultyName(e.target.value)} className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Department *</label>
                    <input type="text" required placeholder="CSE / ECE" value={newFacultyDept} onChange={(e) => setNewFacultyDept(e.target.value)} className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Mobile Number *</label>
                    <input type="tel" required placeholder="10-digit mobile" value={newFacultyMobile} onChange={(e) => setNewFacultyMobile(e.target.value)} className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800 space-y-3">
                <p className="text-xs font-bold text-amber-300">Captain &amp; Vice-Captain Assignment</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Captain Name</label>
                    <input type="text" placeholder="Captain name" value={newCaptainName} onChange={(e) => setNewCaptainName(e.target.value)} className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Captain Mobile</label>
                    <input type="tel" placeholder="10-digit mobile" value={newCaptainMobile} onChange={(e) => setNewCaptainMobile(e.target.value)} className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Vice-Captain Name</label>
                    <input type="text" placeholder="Vice captain name" value={newViceCaptainName} onChange={(e) => setNewViceCaptainName(e.target.value)} className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Vice-Captain Mobile</label>
                    <input type="tel" placeholder="10-digit mobile" value={newViceCaptainMobile} onChange={(e) => setNewViceCaptainMobile(e.target.value)} className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg"
              >
                SAVE FRANCHISE
              </button>
            </form>
          )}

          {/* Franchise Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {franchises.map((f) => (
              <div key={f.id} className="glass-card rounded-2xl p-4 border border-gray-800 space-y-3 text-xs relative shadow-md">
                {editingFranchiseId === f.id ? (
                  <form onSubmit={handleUpdateFranchiseSubmit} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <h4 className="font-extrabold text-indigo-400">Edit Franchise Details</h4>
                      <button type="button" onClick={() => setEditingFranchiseId(null)} className="text-gray-400 hover:text-white p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Team Name</label>
                      <input type="text" required value={editFranchiseName} onChange={(e) => setEditFranchiseName(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Short Code</label>
                        <input type="text" required maxLength={4} value={editFranchiseCode} onChange={(e) => setEditFranchiseCode(e.target.value.toUpperCase())} className="w-full glass-input rounded-lg p-1.5 text-xs uppercase" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Dept</label>
                        <input type="text" required value={editFacultyDept} onChange={(e) => setEditFacultyDept(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                      </div>
                    </div>

                    {/* Direct Franchise Photo Upload in Edit Form */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-300 block">
                        Franchise Logo Photo (Max 300 KB)
                      </label>
                      <div className="flex items-center space-x-2">
                        {editFranchiseLogo ? (
                          <img
                            src={editFranchiseLogo}
                            alt="Logo Preview"
                            className="w-10 h-10 rounded-lg object-contain bg-gray-950 p-1 border border-indigo-500/50 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-500 shrink-0">
                            <Image className="w-5 h-5" />
                          </div>
                        )}
                        <label className="flex-1 cursor-pointer px-3 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Image File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageFileUpload(e, setEditFranchiseLogo)}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Faculty Coordinator</label>
                      <input type="text" required value={editFacultyName} onChange={(e) => setEditFacultyName(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Faculty Mobile</label>
                      <input type="tel" required value={editFacultyMobile} onChange={(e) => setEditFacultyMobile(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Captain Name</label>
                        <input type="text" value={editCaptainName} onChange={(e) => setEditCaptainName(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Captain Mobile</label>
                        <input type="tel" value={editCaptainMobile} onChange={(e) => setEditCaptainMobile(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Vice-Captain Name</label>
                        <input type="text" value={editViceCaptainName} onChange={(e) => setEditViceCaptainName(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Vice-Captain Mobile</label>
                        <input type="tel" value={editViceCaptainMobile} onChange={(e) => setEditViceCaptainMobile(e.target.value)} className="w-full glass-input rounded-lg p-1.5 text-xs" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button type="submit" className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow">
                        SAVE CHANGES
                      </button>
                      <button type="button" onClick={() => setEditingFranchiseId(null)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold">
                        CANCEL
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img src={f.logo_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${f.short_code}`} alt={f.name} className="w-10 h-10 rounded-xl bg-gray-900 object-contain p-1 border border-gray-700" />
                        <div>
                          <h4 className="font-bold text-white text-sm">{f.name}</h4>
                          <p className="text-gray-400">Code: <strong className="text-indigo-400">{f.short_code}</strong></p>
                        </div>
                      </div>

                      {adminRole !== 'Operator' && (
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditFranchise(f)}
                            title="Edit Franchise Profile & Logo"
                            className="p-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 rounded-lg border border-indigo-700/50 transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {adminRole === 'Super Admin' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFranchise(f.id, f.name)}
                              title="Delete Franchise"
                              className="p-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-lg border border-red-700/50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-800 space-y-1">
                      <p className="text-gray-300">Coordinator: <strong className="text-white">{f.faculty_coordinator_name}</strong> ({f.faculty_coordinator_dept})</p>
                      <p className="text-amber-400 font-mono">Coordinator Mobile: {f.faculty_coordinator_mobile}</p>
                      {f.captain_name && <p className="text-emerald-400">Captain: <strong className="text-white">{f.captain_name}</strong> {f.captain_mobile && `(${f.captain_mobile})`}</p>}
                      {f.vice_captain_name && <p className="text-purple-400">Vice Captain: <strong className="text-white">{f.vice_captain_name}</strong> {f.vice_captain_mobile && `(${f.vice_captain_mobile})`}</p>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Detained Student Year Override */}
      {activeTab === 'override' && (
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 max-w-xl mx-auto space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <span>Detained Student Year Override</span>
          </h3>
          <p className="text-xs text-gray-400">
            Super Admin override for students who repeat a year so their actual year differs from roll number derivation.
          </p>

          <form onSubmit={handleOverrideYear} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Select Player</label>
              <select
                value={overridePlayerId}
                onChange={(e) => setOverridePlayerId(Number(e.target.value))}
                className="w-full glass-input rounded-xl p-2.5 text-xs bg-gray-900 text-white"
              >
                {adminPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.roll_number}) — Current Year {p.year_of_study} ({p.bucket})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">New Actual Year of Study</label>
              <input
                type="number"
                min="1"
                max="4"
                value={overrideYearVal}
                onChange={(e) => setOverrideYearVal(Number(e.target.value))}
                className="w-full glass-input rounded-xl p-2.5 text-xs"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg"
            >
              APPLY MANUAL YEAR OVERRIDE
            </button>
          </form>
        </div>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0e0e13] border border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Edit Player Profile</h3>
                <p className="text-xs text-indigo-400">{editingPlayer.name} ({editingPlayer.roll_number})</p>
              </div>
              <button onClick={() => setEditingPlayer(null)} className="p-1 rounded text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlayerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Player Name</label>
                  <input type="text" required value={editPlayerName} onChange={(e) => setEditPlayerName(e.target.value)} className="w-full glass-input rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Roll Number</label>
                  <input type="text" required value={editPlayerRoll} onChange={(e) => setEditPlayerRoll(e.target.value.toUpperCase())} className="w-full glass-input rounded-xl p-2.5 font-mono uppercase" />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Mobile Number (Private)</label>
                  <input type="tel" required value={editPlayerMobile} onChange={(e) => setEditPlayerMobile(e.target.value)} className="w-full glass-input rounded-xl p-2.5 font-mono text-amber-400" />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Bucket</label>
                  <select value={editPlayerBucket} onChange={(e) => setEditPlayerBucket(e.target.value)} className="w-full glass-input rounded-xl p-2.5 bg-gray-900 text-white font-bold text-blue-400">
                    <option value="B1">B1 (1st Year)</option>
                    <option value="B2">B2 (2nd Year)</option>
                    <option value="B3">B3 (3rd Year)</option>
                    <option value="B4">B4 (4th Year)</option>
                    <option value="B5">B5 (Diploma)</option>
                    <option value="PG">PG (Post Grad)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Course</label>
                  <input type="text" required value={editPlayerCourse} onChange={(e) => setEditPlayerCourse(e.target.value)} className="w-full glass-input rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Branch</label>
                  <input type="text" required value={editPlayerBranch} onChange={(e) => setEditPlayerBranch(e.target.value)} className="w-full glass-input rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Year of Study</label>
                  <input type="number" min={1} max={4} required value={editPlayerYear} onChange={(e) => setEditPlayerYear(Number(e.target.value))} className="w-full glass-input rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Base Price (Credits)</label>
                  <input type="number" min={20} required value={editPlayerBasePrice} onChange={(e) => setEditPlayerBasePrice(Number(e.target.value))} className="w-full glass-input rounded-xl p-2.5 font-bold text-emerald-400" />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Player Type</label>
                  <select value={editPlayerType} onChange={(e) => setEditPlayerType(e.target.value)} className="w-full glass-input rounded-xl p-2.5 bg-gray-900 text-white">
                    <option value="Batter">Batter</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-rounder">All-rounder</option>
                    <option value="Wicket-keeper">Wicket-keeper</option>
                    <option value="Wicket-keeper batter">Wicket-keeper batter</option>
                    <option value="Fielder">Fielder</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Payment Status</label>
                  <select value={editPlayerPaymentStatus} onChange={(e) => setEditPlayerPaymentStatus(e.target.value)} className="w-full glass-input rounded-xl p-2.5 bg-gray-900 text-white">
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              {/* Photo Upload inside Edit Player Modal */}
              <div>
                <label className="font-bold text-gray-300 block text-xs mb-1">Player Photograph (Max 300 KB)</label>
                <div className="flex items-center space-x-3">
                  <img src={editPlayerPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${editPlayerRoll}`} alt="Player" className="w-12 h-12 rounded-xl object-cover bg-gray-950 border border-gray-700" />
                  <label className="cursor-pointer px-4 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition">
                    <Upload className="w-4 h-4" />
                    <span>Upload New Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileUpload(e, setEditPlayerPhoto)} />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-gray-800">
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg">
                  SAVE PLAYER CHANGES
                </button>
                <button type="button" onClick={() => setEditingPlayer(null)} className="px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Player Confirmation Modal */}
      {deletingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0e0e13] border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-extrabold text-white">Delete Player Registration</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to permanently delete player <strong className="text-white">{deletingPlayer.name}</strong> (<span className="text-indigo-400 font-mono">{deletingPlayer.roll_number}</span>)?
            </p>
            <p className="text-[11px] text-red-400/80 bg-red-950/40 p-3 rounded-xl border border-red-900/50">
              Warning: This action will remove the player from the tournament database completely.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleDeletePlayerSubmit}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition"
              >
                CONFIRM DELETE
              </button>
              <button
                onClick={() => setDeletingPlayer(null)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
