import React, { useState } from 'react';
import type { AuctionState, Franchise, Player, AuthRole } from '../types';
import { api } from '../services/api';
import { AlertTriangle, Search, Shield, Trophy, Flame, Zap, Clock, Gavel, SkipForward, X, Play, Pause, Square } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PublicViewProps {
  auctionState: AuctionState | null;
  franchises: Franchise[];
  players: Player[];
  userRole: AuthRole | null;
  userFranchiseId: number | null;
  onRequireLogin: () => void;
  onRequireAdmin: () => void;
}

export const PublicView: React.FC<PublicViewProps> = ({ auctionState, franchises, players, userRole, userFranchiseId, onRequireLogin, onRequireAdmin }) => {
  // Fast lot search state
  const [lotSearchQuery, setLotSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [biddingMsg, setBiddingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activePlayer = auctionState?.current_player;
  const currentBidder = auctionState?.current_bidder;
  const scarcityWarnings = auctionState?.scarcity_warnings || {};
  const nextRequiredBid = auctionState?.next_required_bid || 20;

  const activeWarnings = Object.values(scarcityWarnings).filter((w) => w.warning_active);

  const [selectedFilterBucket, setSelectedFilterBucket] = useState<string | null>(null);

  // Filter unauctioned players for lot search
  const unauctionedPlayers = players.filter((p) => !p.sold_franchise_id && !p.retained_franchise_id);

  // Calculate unsold counts per bucket
  const bucketCounts = React.useMemo(() => {
    const counts: Record<string, number> = { B1: 0, B2: 0, B3: 0, B4: 0, B5: 0, PG: 0 };
    unauctionedPlayers.forEach((p) => {
      const b = (p.bucket || 'B3').toUpperCase();
      counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  }, [unauctionedPlayers]);

  // Fast lot search matches (searches ALL players when query is entered)
  const lotSearchMatches = React.useMemo(() => {
    const q = lotSearchQuery.trim().toLowerCase();
    if (!q) {
      if (selectedFilterBucket) {
        return players.filter((p) => !p.sold_franchise_id && !p.retained_franchise_id && p.bucket.toUpperCase() === selectedFilterBucket).slice(0, 15);
      }
      return [];
    }
    return players.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.roll_number.toLowerCase().includes(q) ||
        p.bucket.toLowerCase().includes(q)
      );
    }).slice(0, 15);
  }, [players, lotSearchQuery, selectedFilterBucket]);

  const handleSelectLotPlayer = async (player: Player) => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin' && userRole !== 'Operator') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      await api.selectPlayerForLot(player.id);
      setLotSearchQuery('');
      setIsSearchOpen(false);
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Failed to select player' });
    }
  };

  const handleSetBucket = async (b: string) => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin' && userRole !== 'Operator') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      const res = await api.setActiveBucket(b);
      setSelectedFilterBucket(b);
      setBiddingMsg({ type: 'success', text: res.message || `Switched live auction stage to Bucket ${b}!` });
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Failed to switch bucket' });
    }
  };

  const handleHammer = async () => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin' && userRole !== 'Operator') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      const res = await api.hammerLot(userRole);
      if (res.sold) {
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      }
      setBiddingMsg({ type: 'success', text: res.message || 'Hammer action completed successfully!' });
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Hammer action failed' });
    }
  };

  const handleSkip = async () => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin' && userRole !== 'Operator') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      const res = await api.skipPlayer(userRole);
      setBiddingMsg({ type: 'success', text: res.message || 'Player skipped.' });
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Skip action failed' });
    }
  };

  const handleStartTimer = async () => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin' && userRole !== 'Operator') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      const res = await api.updateTimerConfig(undefined, 'start');
      setBiddingMsg({ type: 'success', text: res.message || 'Timer started.' });
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Failed to start timer' });
    }
  };

  const handlePauseResumeTimer = async () => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin' && userRole !== 'Operator') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    const action = auctionState?.is_paused ? 'resume' : 'pause';
    try {
      const res = await api.updateTimerConfig(undefined, action);
      setBiddingMsg({ type: 'success', text: res.message || `Timer ${action}d.` });
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || `Failed to ${action} timer` });
    }
  };

  const handleStopTimer = async () => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin' && userRole !== 'Operator') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      const res = await api.updateTimerConfig(undefined, 'stop');
      setBiddingMsg({ type: 'success', text: res.message || 'Timer stopped.' });
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Failed to stop timer' });
    }
  };

  const handlePlaceBidForFranchise = async (franchiseId: number) => {
    if (!userRole) {
      onRequireLogin();
      return;
    }
    if (userRole === 'Operator') {
      setBiddingMsg({ type: 'error', text: 'This account is not authorized to place bids.' });
      return;
    }
    if (userRole === 'Captain' && userFranchiseId !== franchiseId) {
      setBiddingMsg({ type: 'error', text: 'Captain accounts can bid only for their assigned franchise.' });
      return;
    }
    if (!activePlayer) {
      setBiddingMsg({ type: 'error', text: 'No active player lot up for auction.' });
      return;
    }
    setBiddingMsg(null);
    try {
      const f = franchises.find((item) => item.id === franchiseId);
      const res = await api.placeBid(franchiseId, nextRequiredBid, f ? `Franchise:${f.short_code}` : 'Franchise');
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
      setBiddingMsg({ type: 'success', text: `Bid of ${res.new_bid} pts placed for ${res.franchise}!` });
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Bid rejected' });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Alert / Feedback Notification */}
      {biddingMsg && (
        <div className={`p-4 rounded-2xl border text-xs font-bold shadow-xl flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 ${
          biddingMsg.type === 'success' ? 'bg-lime-950/90 text-lime-300 border-lime-500/50' : 'bg-red-950/90 text-red-300 border-red-500/50'
        }`}>
          <span>{biddingMsg.text}</span>
          <button onClick={() => setBiddingMsg(null)} className="text-xs font-bold underline ml-2 hover:opacity-80">Dismiss</button>
        </div>
      )}

      {/* Scarcity Warnings Banner */}
      {activeWarnings.length > 0 && (
        <div className="bg-[#121318] border border-amber-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center space-x-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold text-amber-300">Scarcity Alert — Bucket Supply Warning</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeWarnings.map((w) => (
              <div key={w.bucket} className="bg-black/60 rounded-xl p-3 border border-amber-500/20 text-xs text-zinc-300">
                <span className="font-bold text-amber-400">{w.bucket} Bucket:</span> Unsold Supply ({w.unsold_supply}) &le; Needed Players ({w.total_needed_players}) across {w.teams_needing} teams.
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Auction Control & Player Search Bar */}
      <div className="glass-panel rounded-3xl p-4 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl relative z-40">
        {/* Bucket Selector Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-lime-400" /> Stage Buckets:
          </span>
          {['B1', 'B2', 'B3', 'B4', 'B5', 'PG'].map((b) => {
            const isStageLive = auctionState?.current_bucket === b;
            const isFiltered = selectedFilterBucket === b;
            const count = bucketCounts[b] || 0;
            const isAdmin = userRole === 'Admin' || userRole === 'Super Admin' || userRole === 'Operator';

            return (
              <button
                key={b}
                onClick={() => handleSetBucket(b)}
                disabled={!isAdmin}
                title={isAdmin ? `Set live stage to ${b}` : `Stage bucket ${b} (Admin access required)`}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all duration-200 shrink-0 flex items-center space-x-1.5 ${
                  isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                } ${
                  isStageLive
                    ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black shadow-lg shadow-lime-500/20 ring-2 ring-lime-300 font-black'
                    : isFiltered
                    ? 'bg-amber-500/20 border border-amber-400 text-amber-300 shadow-md font-bold'
                    : 'bg-[#18191e] text-zinc-300 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <span>{b}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isStageLive
                    ? 'bg-black text-lime-400'
                    : isFiltered
                    ? 'bg-amber-400/20 text-amber-300'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {count}
                </span>
                {isStageLive && (
                  <span className="text-[9px] bg-black text-white px-1 py-0.5 rounded font-black tracking-tighter uppercase ml-0.5">
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
          {selectedFilterBucket && (
            <button
              onClick={() => { setSelectedFilterBucket(null); setBiddingMsg(null); }}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Quick Player Search for Direct Lot Assignment */}
        <div className="relative z-50 w-full md:w-80">
          <div className="flex items-center glass-input rounded-xl px-3 py-2 border border-zinc-800 focus-within:border-zinc-600 transition">
            <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder={selectedFilterBucket ? `Search in ${selectedFilterBucket}...` : "Search Player / Roll No..."}
              value={lotSearchQuery}
              onChange={(e) => { setLotSearchQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              className="bg-transparent text-xs text-white focus:outline-none w-full placeholder:text-zinc-500"
            />
            {lotSearchQuery && (
              <button
                onClick={() => { setLotSearchQuery(''); setIsSearchOpen(false); }}
                className="text-zinc-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isSearchOpen && (lotSearchQuery.trim() || selectedFilterBucket) && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setIsSearchOpen(false)} />
              <div className="absolute top-full right-0 w-80 sm:w-96 mt-2 bg-[#0e0f14] border border-zinc-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden max-h-96 overflow-y-auto p-2.5 space-y-1">
                <div className="p-2 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400 font-bold flex justify-between items-center">
                  <span>
                    {lotSearchQuery.trim()
                      ? `Search Matches (${lotSearchMatches.length})`
                      : `Bucket ${selectedFilterBucket} Players (${lotSearchMatches.length})`}
                  </span>
                  <button onClick={() => setIsSearchOpen(false)} className="text-zinc-400 hover:text-white font-bold text-xs">
                    Close ✕
                  </button>
                </div>

                {lotSearchMatches.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400 font-semibold">
                    No player found matching &quot;{lotSearchQuery}&quot;
                  </div>
                ) : (
                  lotSearchMatches.map((p) => {
                    const isSold = Boolean(p.sold_franchise_id || p.retained_franchise_id || p.referred_franchise_id);
                    const teamId = p.sold_franchise_id || p.retained_franchise_id || p.referred_franchise_id;
                    const team = teamId ? franchises.find((f) => f.id === teamId) : null;

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (!isSold) {
                            handleSelectLotPlayer(p);
                          } else {
                            setBiddingMsg({
                              type: 'success',
                              text: `Player ${p.name} (${p.roll_number}) is ${p.sold_type?.toUpperCase() || 'ASSIGNED'} to ${team?.name || 'Franchise'} for ${p.sold_price || p.base_price} Cr.`,
                            });
                            setIsSearchOpen(false);
                          }
                        }}
                        className="p-2.5 rounded-xl hover:bg-zinc-800/90 cursor-pointer border border-zinc-800/80 hover:border-zinc-700 transition flex items-center justify-between text-xs group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <img
                            src={p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.roll_number}`}
                            alt={p.name}
                            className="w-9 h-9 rounded-xl bg-zinc-900 object-cover border border-zinc-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-mono truncate">
                              {p.roll_number} &bull; {p.branch} &bull; Yr {p.year_of_study}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 ml-2">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-[10px] border border-zinc-700">
                            {p.bucket}
                          </span>
                          {isSold ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                              {team?.logo_url && <img src={team.logo_url} alt="" className="w-3.5 h-3.5 object-contain" />}
                              <span>{team?.short_code || 'SOLD'}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              UNSOLD
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Current Lot & Hall Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Current Lot Card (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 relative overflow-hidden border border-zinc-800 shadow-2xl">
          <div className="absolute top-0 right-0 bg-white text-black text-xs font-black px-4 py-1.5 rounded-bl-2xl shadow-md flex items-center space-x-1">
            <Flame className="w-3.5 h-3.5 text-black fill-black" />
            <span>LIVE LOT — BUCKET {auctionState?.current_bucket || 'B3'}</span>
          </div>

          {activePlayer ? (
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mt-4">
              <div className="relative group">
                <img
                  src={activePlayer.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activePlayer.roll_number}`}
                  alt={activePlayer.name}
                  className="w-40 h-40 md:w-48 md:h-48 rounded-2xl object-cover border-2 border-zinc-700 shadow-2xl bg-zinc-950"
                />
                <span className="absolute bottom-2 left-2 right-2 bg-black/90 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-lg text-center border border-zinc-700">
                  {activePlayer.derived_player_type}
                </span>
              </div>

              <div className="flex-1 space-y-3 text-center md:text-left">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">{activePlayer.name}</h2>
                  <p className="text-xs font-medium text-zinc-400">
                    {activePlayer.program} &bull; {activePlayer.branch} &bull; Year {activePlayer.year_of_study} ({activePlayer.bucket})
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#121318] p-3 rounded-xl border border-zinc-800 text-xs text-center">
                  <div>
                    <p className="text-zinc-500 font-semibold">Matches</p>
                    <p className="text-base font-bold text-white">{activePlayer.matches}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 font-semibold">Runs / Avg</p>
                    <p className="text-base font-bold text-amber-400">{activePlayer.runs} ({activePlayer.batting_avg})</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 font-semibold">Wickets / Econ</p>
                    <p className="text-base font-bold text-lime-400">{activePlayer.wickets} ({activePlayer.economy})</p>
                  </div>
                </div>

                {/* Pricing, Current Bid & Prominent Auction Timer */}
                <div className="bg-[#121318] p-5 rounded-2xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center shadow-xl">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Base Price</p>
                    <p className="text-xl font-black text-zinc-200">{activePlayer.base_price} pts</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">Current Highest Bid</p>
                    <p className="text-3xl font-black text-amber-400">{auctionState?.current_bid_price || activePlayer.base_price} pts</p>
                    {currentBidder && (
                      <span className="text-xs text-zinc-300 font-extrabold block truncate mt-0.5">
                        {currentBidder.name} ({currentBidder.short_code})
                      </span>
                    )}
                  </div>

                  {/* Prominent Large Digital Timer Display & Live Status */}
                  <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-zinc-800 pt-3 sm:pt-0 sm:pl-4 flex flex-col justify-center items-center sm:items-end">
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 inline text-lime-400" />
                      <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                        Auction Timer
                      </span>
                      {auctionState?.is_paused ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-950 text-amber-300 border border-amber-800 tracking-wider">
                          PAUSED
                        </span>
                      ) : auctionState?.timer_running ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-lime-950 text-lime-300 border border-lime-800 animate-pulse tracking-wider">
                          LIVE
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 tracking-wider">
                          STOPPED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center sm:justify-end space-x-2 my-0.5">
                      <div
                        className={`text-4xl md:text-5xl font-black font-mono tracking-tighter transition-all duration-300 ${
                          (auctionState?.timer_seconds ?? 30) <= 5
                            ? 'text-red-500 animate-pulse scale-110 drop-shadow-[0_0_20px_rgba(239,68,68,1)]'
                            : (auctionState?.timer_seconds ?? 30) <= 10
                            ? 'text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                            : 'text-lime-400 drop-shadow-[0_0_12px_rgba(132,204,22,0.6)]'
                        }`}
                      >
                        00:{String(auctionState?.timer_seconds ?? 30).padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Live Auction & Timer Controls (Available ONLY to Admin) */}
                {(userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Operator') && (
                  <div className="space-y-2 pt-1">
                    {/* Timer Admin Action Bar */}
                    <div className="bg-[#121318] p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> Timer Controls:
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleStartTimer}
                          title="Start Timer"
                          className="px-3 py-1.5 bg-lime-500 hover:bg-lime-400 text-black text-xs font-black rounded-lg shadow transition flex items-center space-x-1 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start</span>
                        </button>

                        <button
                          onClick={handlePauseResumeTimer}
                          title={auctionState?.is_paused ? "Resume Timer" : "Pause Timer"}
                          className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border transition flex items-center space-x-1 cursor-pointer ${
                            auctionState?.is_paused
                              ? 'bg-amber-500 text-black border-amber-400 font-black hover:bg-amber-400'
                              : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700'
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
                          className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 text-xs font-bold rounded-lg border border-red-800 transition flex items-center space-x-1 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleHammer}
                        className="py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer"
                      >
                        <Gavel className="w-4 h-4 fill-current" />
                        <span>PRESS HAMMER</span>
                      </button>

                      <button
                        onClick={handleSkip}
                        className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-extrabold text-xs rounded-xl border border-zinc-700 flex items-center justify-center space-x-2 transition cursor-pointer"
                      >
                        <SkipForward className="w-4 h-4 text-zinc-400" />
                        <span>SKIP PLAYER</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <Trophy className="w-12 h-12 text-zinc-600 mx-auto" />
              <p className="text-lg font-bold text-zinc-400">No active lot on screen</p>
              <p className="text-xs text-zinc-500">Select a bucket or search player to start bidding.</p>
            </div>
          )}
        </div>

        {/* Interactive Franchise Bidding Grid (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-3xl p-5 border border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
                <Shield className="w-4 h-4 text-lime-400" />
                <span>Tap Team Card to Place Bid ({nextRequiredBid} pts)</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {franchises.map((f) => {
                const isCurrentBidder = currentBidder?.id === f.id;
                const isPassed = Boolean(auctionState?.passed_franchise_ids?.includes(f.id));

                return (
                  <div
                    key={f.id}
                    onClick={() => handlePlaceBidForFranchise(f.id)}
                    className={`p-3 rounded-xl border text-xs flex flex-col items-center justify-center space-y-1 transition transform active:scale-95 cursor-pointer ${
                      isCurrentBidder
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold ring-2 ring-amber-400/50'
                        : isPassed
                        ? 'bg-zinc-950/80 border-zinc-900 text-zinc-600 opacity-60'
                        : 'bg-[#14151a] border-zinc-800 hover:border-zinc-600 text-zinc-200'
                    }`}
                  >
                    <img src={f.logo_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${f.short_code}`} alt={f.short_code} className="w-8 h-8 rounded-full bg-black/50 p-0.5 object-contain border border-zinc-800" />
                    <p className="font-black text-white text-xs">{f.short_code}</p>
                    <p className="text-[10px] text-amber-400 font-mono font-bold">{f.purse} pts</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Franchises & Squad Leaderboard */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
          <Shield className="w-5 h-5 text-lime-400" />
          <span>All 11 Franchises Standings &amp; Purse Limits</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {franchises.map((f) => (
            <div
              key={f.id}
              onClick={() => handlePlaceBidForFranchise(f.id)}
              className="glass-card rounded-2xl p-4 border border-zinc-800 hover:border-zinc-600 cursor-pointer transition space-y-3"
            >
              <div className="flex items-center space-x-3">
                <img src={f.logo_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${f.short_code}`} alt={f.name} className="w-12 h-12 rounded-xl bg-zinc-950 p-1 border border-zinc-800 object-contain" />
                <div className="flex-1 truncate">
                  <h4 className="font-bold text-white text-sm truncate">{f.name}</h4>
                  <p className="text-xs text-zinc-400">Code: <strong className="text-white">{f.short_code}</strong></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#121318] p-2.5 rounded-xl text-xs text-center border border-zinc-800">
                <div>
                  <p className="text-zinc-500 font-semibold">Purse</p>
                  <p className="text-sm font-black text-amber-400">{f.purse} pts</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-semibold">Max Bid</p>
                  <p className="text-sm font-black text-lime-400">{f.max_permissible_bid} pts</p>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handlePlaceBidForFranchise(f.id); }}
                className="w-full py-2 bg-white text-black font-black text-xs rounded-xl shadow-md hover:bg-zinc-200 transition flex items-center justify-center space-x-1"
              >
                <Zap className="w-3.5 h-3.5 text-black fill-black" />
                <span>BID FOR {f.short_code} ({nextRequiredBid} PTS)</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
