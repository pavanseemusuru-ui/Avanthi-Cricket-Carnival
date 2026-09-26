import React, { useEffect, useState } from 'react';
import type { AuctionState, AdminPlayer, AdminFranchise, AuthRole } from '../types';
import { api } from '../services/api';
import { ShieldCheck, Gavel, SkipForward, RotateCcw, Sliders, UserCheck, AlertCircle } from 'lucide-react';

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
    ? ['players', 'franchises']
    : adminRole === 'Admin'
      ? ['auction', 'players', 'franchises']
      : ['auction', 'players', 'franchises', 'override'];

  // Direct Assign State
  const [directPlayerId, setDirectPlayerId] = useState<number>(adminPlayers[0]?.id || 1);
  const [directFranchiseId, setDirectFranchiseId] = useState<number>(franchises[0]?.id || 1);
  const [directPrice, setDirectPrice] = useState<number>(20);
  const [directReason, setDirectReason] = useState<string>('Super Admin Direct Assignment');

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

  // Quick Resolve Profile State
  const [resolvePlayerId, setResolvePlayerId] = useState<number | null>(null);
  const [resolveUrl, setResolveUrl] = useState<string>('');
  const [resolvePhone, setResolvePhone] = useState<string>('');

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

  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (adminPlayers.length && !adminPlayers.some((player) => player.id === directPlayerId)) {
      setDirectPlayerId(adminPlayers[0].id);
    }
    if (franchises.length && !franchises.some((franchise) => franchise.id === directFranchiseId)) {
      setDirectFranchiseId(franchises[0].id);
    }
  }, [adminPlayers, franchises, directPlayerId, directFranchiseId]);

  const activePlayer = auctionState?.current_player;
  const currentBidder = auctionState?.current_bidder;

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

  const handleDrawNext = async () => {
    setAdminMsg(null);
    try {
      await api.drawNextPlayer();
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Draw next failed' });
    }
  };

  const handleDirectAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg(null);
    try {
      const res = await api.directAssignPlayer(directPlayerId, directFranchiseId, directPrice, directReason);
      setAdminMsg({ type: 'success', text: res.message });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Direct assign failed' });
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

  const handleUpdateTimer = async (durationSec?: number, action?: string) => {
    setAdminMsg(null);
    try {
      const res = await api.updateTimerConfig(durationSec, action);
      setAdminMsg({ type: 'success', text: `Timer config updated: ${res.message}` });
      onRefreshState();
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Timer update failed' });
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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Admin Control Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/40">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-white">Organizer Dashboard</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-400">
                Logged in as {adminRole || 'Super Admin'}
              </span>
            </div>
            <p className="text-xs text-indigo-300">Authoritative Auction Management &amp; Audit Control</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize transition ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab === 'override' ? 'Detained Override' : tab}
              </button>
            ))}
          </div>

          <button
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-950/80 text-red-300 hover:bg-red-900 border border-red-800 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Admin Alert Banner */}
      {adminMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center space-x-3 text-xs font-bold shadow-lg ${
            adminMsg.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500'
              : 'bg-red-950/90 text-red-300 border-red-500'
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{adminMsg.text}</span>
        </div>
      )}

      {/* Tab 1: Auction Control Console */}
      {activeTab === 'auction' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Lot & Hammer Console (7 cols) */}
          <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-gray-800 space-y-6 shadow-2xl">
            {/* Timer Configuration Bar */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-pink-400 uppercase tracking-wider">
                  Auction Round Timer Control
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Current: {auctionState?.timer_seconds ?? 30}s / ({auctionState?.timer_duration_seconds ?? 30}s default)
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold">
                  <span className="text-gray-400">Duration:</span>
                  {[15, 30, 45, 60].map((dur) => (
                    <button
                      key={dur}
                      onClick={() => handleUpdateTimer(dur, 'reset')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        (auctionState?.timer_duration_seconds ?? 30) === dur
                          ? 'bg-pink-600 text-white border-pink-400'
                          : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpdateTimer(undefined, 'start')}
                    className="px-3 py-1 rounded-lg text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    Start Timer
                  </button>
                  <button
                    onClick={() => handleUpdateTimer(undefined, auctionState?.is_paused ? 'resume' : 'pause')}
                    className="px-3 py-1 rounded-lg text-xs font-extrabold bg-amber-600 text-white hover:bg-amber-500"
                  >
                    {auctionState?.is_paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => handleUpdateTimer(undefined, 'reset')}
                    className="px-3 py-1 rounded-lg text-xs font-extrabold bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                  >
                    Reset Timer
                  </button>
                </div>
              </div>
            </div>

            <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
              <Gavel className="w-5 h-5 text-amber-400" />
              <span>Auctioneer Hammer &amp; Draw Control</span>
            </h3>

            {activePlayer ? (
              <div className="bg-gray-900/80 p-5 rounded-2xl border border-indigo-500/30 space-y-4">
                <div className="flex items-center space-x-4">
                  <img src={activePlayer.photo_url} alt={activePlayer.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/40 bg-black" />
                  <div>
                    <span className="text-[10px] font-bold bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                      Bucket {activePlayer.bucket}
                    </span>
                    <h4 className="text-xl font-black text-white mt-1">{activePlayer.name}</h4>
                    <p className="text-xs text-gray-400">{activePlayer.roll_number} &bull; {activePlayer.program} {activePlayer.branch}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800">
                  <div>
                    <p className="text-xs text-gray-400">Current High Bid</p>
                    <p className="text-2xl font-black text-amber-400">{auctionState?.current_bid_price || activePlayer.base_price} pts</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Leading Team</p>
                    <p className="text-base font-bold text-white">{currentBidder ? `${currentBidder.name} (${currentBidder.short_code})` : 'None'}</p>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
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

            {/* Quick Draw Next Button */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <span className="text-xs text-gray-400 font-semibold">Draw Mode: <strong className="text-white uppercase">{auctionState?.draw_mode || 'auto'}</strong></span>
              <button
                onClick={handleDrawNext}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700"
              >
                Draw Next Lot
              </button>
            </div>
          </div>

          {/* Special Administrative Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Safe Undo Box (§12.4) */}
            <div className="glass-panel rounded-3xl p-5 border border-purple-500/30 space-y-3 shadow-xl">
              <h4 className="text-sm font-extrabold text-purple-300 flex items-center space-x-2">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                <span>Safe Audit-Backed Undo (§12.4)</span>
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

            {adminRole !== 'Operator' && (
              <div className="glass-panel rounded-3xl p-5 border border-emerald-500/30 space-y-3 shadow-xl">
                <h4 className="text-sm font-extrabold text-emerald-300 flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Direct Player Assignment</span>
                </h4>
                <form onSubmit={handleDirectAssign} className="space-y-3">
                  <select
                    value={directPlayerId}
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
                    value={directFranchiseId}
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
                    aria-label="Assignment price"
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
                </form>
              </div>
            )}

            {/* Uniform Bucket Minimum Relaxation (§13) */}
            <div className="glass-panel rounded-3xl p-5 border border-amber-500/30 space-y-3 shadow-xl">
              <h4 className="text-sm font-extrabold text-amber-300 flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Uniform Bucket Minimum Relaxation (§13)</span>
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
          </div>
        </div>
      )}

      {/* Tab 2: Registered Players & Verification */}
      {activeTab === 'players' && (
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
          <h3 className="text-lg font-bold text-white">All Registered Players ({adminPlayers.length})</h3>

          <div className="overflow-x-auto rounded-2xl border border-gray-800">
            <table className="w-full text-xs text-left text-gray-300">
              <thead className="bg-gray-900/80 uppercase text-[10px] text-gray-400 font-semibold">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3">Mobile (Private)</th>
                  <th className="p-3">CricHeroes Phone</th>
                  <th className="p-3">Bucket</th>
                  <th className="p-3">Profile Status</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 bg-gray-950/40">
                {adminPlayers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-800/40 transition">
                    <td className="p-3 font-bold text-white">{p.name} ({p.roll_number})</td>
                    <td className="p-3 text-amber-400 font-mono">{p.mobile_number}</td>
                    <td className="p-3 text-indigo-300 font-mono">{p.cricheroes_mobile || 'N/A'}</td>
                    <td className="p-3 font-bold text-blue-400">{p.bucket}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.profile_status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {p.profile_status}
                      </span>
                    </td>
                    <td className="p-3">
                      {adminRole === 'Operator' ? (
                        <span>{p.payment_status === 'paid' ? 'PAID' : 'UNPAID'}</span>
                      ) : (
                        <button
                          onClick={() => handleTogglePayment(p.id, p.payment_status === 'paid')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition ${
                            p.payment_status === 'paid'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                          }`}
                        >
                          {p.payment_status === 'paid' ? 'PAID (AUCTIONABLE)' : 'MARK PAID'}
                        </button>
                      )}
                    </td>
                    <td className="p-3 min-w-64">
                      {p.profile_status === 'profile_creation_pending' && resolvePlayerId === p.id ? (
                        <form onSubmit={handleResolveProfile} className="space-y-2">
                          <input
                            type="url"
                            value={resolveUrl}
                            onChange={(event) => setResolveUrl(event.target.value)}
                            placeholder="CricHeroes profile URL"
                            className="w-full glass-input rounded-lg px-2 py-1.5 text-[10px]"
                            required
                          />
                          <input
                            type="tel"
                            value={resolvePhone}
                            onChange={(event) => setResolvePhone(event.target.value)}
                            placeholder="CricHeroes phone"
                            className="w-full glass-input rounded-lg px-2 py-1.5 text-[10px]"
                            required
                          />
                          <div className="flex gap-2">
                            <button type="submit" className="px-2 py-1 bg-emerald-700 text-white rounded text-[10px] font-bold">SAVE</button>
                            <button type="button" onClick={() => setResolvePlayerId(null)} className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-[10px] font-bold">CANCEL</button>
                          </div>
                        </form>
                      ) : p.profile_status === 'profile_creation_pending' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setResolvePlayerId(p.id);
                            setResolveUrl(p.cricheroes_url || '');
                            setResolvePhone(p.cricheroes_mobile || '');
                          }}
                          className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-[10px] font-bold"
                        >
                          RESOLVE PROFILE
                        </button>
                      ) : <span className="text-gray-500">Complete</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Franchises Admin View & Creation */}
      {activeTab === 'franchises' && (
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Franchise Management</h3>
              <p className="text-xs text-gray-400">Total Teams: {franchises.length} &bull; Admin &amp; Operator Access Only</p>
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
                  <input type="text" required placeholder="e.g. Royal Strikers"
                    value={newFranchiseName} onChange={(e) => setNewFranchiseName(e.target.value)}
                    className="w-full glass-input rounded-xl p-2.5 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Short Code *</label>
                  <input type="text" required placeholder="e.g. RST" maxLength={4}
                    value={newFranchiseCode} onChange={(e) => setNewFranchiseCode(e.target.value.toUpperCase())}
                    className="w-full glass-input rounded-xl p-2.5 text-xs uppercase" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Logo URL (Optional)</label>
                  <input type="url" placeholder="https://..."
                    value={newFranchiseLogo} onChange={(e) => setNewFranchiseLogo(e.target.value)}
                    className="w-full glass-input rounded-xl p-2.5 text-xs" />
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800 space-y-3">
                <p className="text-xs font-bold text-indigo-300">Faculty Coordinator</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Coordinator Name *</label>
                    <input type="text" required placeholder="Dr. John Doe"
                      value={newFacultyName} onChange={(e) => setNewFacultyName(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Department *</label>
                    <input type="text" required placeholder="CSE / ECE"
                      value={newFacultyDept} onChange={(e) => setNewFacultyDept(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Mobile Number *</label>
                    <input type="tel" required placeholder="10-digit mobile"
                      value={newFacultyMobile} onChange={(e) => setNewFacultyMobile(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800 space-y-3">
                <p className="text-xs font-bold text-amber-300">Captain &amp; Vice-Captain Assignment</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Captain Name</label>
                    <input type="text" placeholder="Captain name"
                      value={newCaptainName} onChange={(e) => setNewCaptainName(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Captain Mobile</label>
                    <input type="tel" placeholder="10-digit mobile"
                      value={newCaptainMobile} onChange={(e) => setNewCaptainMobile(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Vice-Captain Name</label>
                    <input type="text" placeholder="Vice captain name"
                      value={newViceCaptainName} onChange={(e) => setNewViceCaptainName(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Vice-Captain Mobile</label>
                    <input type="tel" placeholder="10-digit mobile"
                      value={newViceCaptainMobile} onChange={(e) => setNewViceCaptainMobile(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs" />
                  </div>
                </div>
              </div>

              <button type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg">
                SAVE FRANCHISE
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {franchises.map((f) => (
              <div key={f.id} className="glass-card rounded-2xl p-4 border border-gray-800 space-y-2 text-xs">
                <div className="flex items-center space-x-3">
                  <img src={f.logo_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${f.short_code}`} alt={f.name} className="w-10 h-10 rounded-xl bg-gray-900 object-contain p-1 border border-gray-700" />
                  <div>
                    <h4 className="font-bold text-white text-sm">{f.name}</h4>
                    <p className="text-gray-400">Code: <strong className="text-indigo-400">{f.short_code}</strong></p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-800 space-y-1">
                  <p className="text-gray-300">Coordinator: <strong className="text-white">{f.faculty_coordinator_name}</strong> ({f.faculty_coordinator_dept})</p>
                  <p className="text-amber-400 font-mono">Coordinator Mobile: {f.faculty_coordinator_mobile}</p>
                  {f.captain_name && <p className="text-emerald-400">Captain: <strong className="text-white">{f.captain_name}</strong> {f.captain_mobile && `(${f.captain_mobile})`}</p>}
                  {f.vice_captain_name && <p className="text-purple-400">Vice Captain: <strong className="text-white">{f.vice_captain_name}</strong> {f.vice_captain_mobile && `(${f.vice_captain_mobile})`}</p>}
                </div>
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
            <span>Detained Student Year Override (§4.1)</span>
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
    </div>
  );
};
