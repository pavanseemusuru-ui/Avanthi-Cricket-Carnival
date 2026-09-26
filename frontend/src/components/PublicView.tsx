import React, { useState } from 'react';
import type { AuctionState, Franchise, Player, AuthRole } from '../types';
import { api } from '../services/api';
import { AlertTriangle, Search, Shield, Trophy, Flame, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PublicViewProps {
  auctionState: AuctionState | null;
  franchises: Franchise[];
  players: Player[];
  onRefreshState?: () => void;
  userRole: AuthRole | null;
  userFranchiseId: number | null;
  onRequireLogin: () => void;
  onRequireAdmin: () => void;
}

export const PublicView: React.FC<PublicViewProps> = ({ auctionState, franchises, players, onRefreshState, userRole, userFranchiseId, onRequireLogin, onRequireAdmin }) => {
  // Fast lot search state
  const [lotSearchQuery, setLotSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [biddingMsg, setBiddingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activePlayer = auctionState?.current_player;
  const currentBidder = auctionState?.current_bidder;
  const scarcityWarnings = auctionState?.scarcity_warnings || {};
  const nextRequiredBid = auctionState?.next_required_bid || 20;

  const activeWarnings = Object.values(scarcityWarnings).filter((w) => w.warning_active);

  // Filter unauctioned players for lot search
  const unauctionedPlayers = players.filter((p) => !p.sold_franchise_id && !p.retained_franchise_id);

  const lotSearchMatches = unauctionedPlayers.filter((p) => {
    if (!lotSearchQuery.trim()) return false;
    const q = lotSearchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.roll_number.toLowerCase().includes(q) || p.bucket.toLowerCase().includes(q);
  }).slice(0, 8);

  const handleSelectLotPlayer = async (player: Player) => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      await api.selectPlayerForLot(player.id);
      setLotSearchQuery('');
      setIsSearchOpen(false);
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Failed to select player' });
    }
  };

  const handleSetBucket = async (b: string) => {
    if (userRole !== 'Admin' && userRole !== 'Super Admin') {
      onRequireAdmin();
      return;
    }
    setBiddingMsg(null);
    try {
      await api.setActiveBucket(b);
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Failed to set bucket' });
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
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: err.message || 'Bid rejected' });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Alert / Feedback Notification */}
      {biddingMsg && (
        <div className={`p-4 rounded-2xl border text-xs font-bold shadow-xl flex items-center justify-between ${
          biddingMsg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border-emerald-500' : 'bg-red-950 text-red-300 border-red-500'
        }`}>
          <span>{biddingMsg.text}</span>
          <button onClick={() => setBiddingMsg(null)} className="text-xs font-bold underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Scarcity Warnings Banner */}
      {activeWarnings.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/80 via-red-950/80 to-amber-950/80 border border-amber-500/50 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center space-x-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <h3 className="text-base font-bold text-amber-300">Scarcity Alert — Bucket Supply Warning</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeWarnings.map((w) => (
              <div key={w.bucket} className="bg-black/40 rounded-xl p-3 border border-amber-500/30 text-xs">
                <span className="font-bold text-amber-400">{w.bucket} Bucket:</span> Unsold Supply ({w.unsold_supply}) &le; Needed Players ({w.total_needed_players}) across {w.teams_needing} teams.
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Auction Control & Player Search Bar */}
      <div className="glass-panel rounded-3xl p-4 border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        {/* Bucket Selector Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-indigo-300 uppercase shrink-0">Bucket Filter:</span>
          {['B3', 'B4', 'B2', 'B5', 'B1', 'PG'].map((b) => {
            const isCurrent = auctionState?.current_bucket === b;
            return (
              <button
                key={b}
                onClick={() => handleSetBucket(b)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 ${
                  isCurrent
                    ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md ring-2 ring-indigo-400'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {b}
              </button>
            );
          })}
        </div>

        {/* Quick Player Search for Direct Lot Assignment */}
        <div className="relative w-full md:w-72">
          <div className="flex items-center glass-input rounded-xl px-3 py-2 border border-gray-700">
            <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search Player / Roll No..."
              value={lotSearchQuery}
              onChange={(e) => { setLotSearchQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              className="bg-transparent text-xs text-white focus:outline-none w-full"
            />
          </div>

          {isSearchOpen && lotSearchMatches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
              {lotSearchMatches.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectLotPlayer(p)}
                  className="p-2.5 hover:bg-indigo-900/50 cursor-pointer border-b border-gray-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-white">{p.name}</p>
                    <p className="text-[10px] text-indigo-400 font-mono">{p.roll_number} &bull; Yr {p.year_of_study}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold text-[10px]">
                    {p.bucket}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Current Lot & Hall Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Current Lot Card (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 relative overflow-hidden border border-blue-500/30 shadow-2xl">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl shadow-md flex items-center space-x-1">
            <Flame className="w-3.5 h-3.5" />
            <span>LIVE LOT — BUCKET {auctionState?.current_bucket || 'B3'}</span>
          </div>

          {activePlayer ? (
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mt-4">
              <div className="relative group">
                <img
                  src={activePlayer.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activePlayer.roll_number}`}
                  alt={activePlayer.name}
                  className="w-40 h-40 md:w-48 md:h-48 rounded-2xl object-cover border-4 border-indigo-500/30 shadow-2xl bg-gray-900"
                />
                <span className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-lg text-center border border-white/10">
                  {activePlayer.derived_player_type}
                </span>
              </div>

              <div className="flex-1 space-y-3 text-center md:text-left">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{activePlayer.name}</h2>
                  <p className="text-sm font-medium text-indigo-400">
                    {activePlayer.program} &bull; {activePlayer.branch} &bull; Year {activePlayer.year_of_study} ({activePlayer.bucket})
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-900/60 p-3 rounded-xl border border-gray-800 text-xs text-center">
                  <div>
                    <p className="text-gray-400">Matches</p>
                    <p className="text-base font-bold text-white">{activePlayer.matches}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Runs / Avg</p>
                    <p className="text-base font-bold text-amber-400">{activePlayer.runs} ({activePlayer.batting_avg})</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Wickets / Econ</p>
                    <p className="text-base font-bold text-emerald-400">{activePlayer.wickets} ({activePlayer.economy})</p>
                  </div>
                </div>

                {/* Pricing, Current Bid & Prominent Auction Timer */}
                <div className="bg-gradient-to-r from-gray-900 via-indigo-950/60 to-gray-900 p-4 rounded-2xl border border-indigo-500/40 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Base Price</p>
                    <p className="text-lg font-black text-gray-300">{activePlayer.base_price} pts</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-amber-400 uppercase font-extrabold">Current Highest Bid</p>
                    <p className="text-2xl font-black text-amber-400">{auctionState?.current_bid_price || activePlayer.base_price} pts</p>
                    {currentBidder && (
                      <span className="text-[10px] text-indigo-300 font-bold block truncate">
                        {currentBidder.name} ({currentBidder.short_code})
                      </span>
                    )}
                  </div>

                  {/* Prominent Large Digital Timer Display */}
                  <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-gray-800 pt-2 sm:pt-0 sm:pl-4">
                    <p className="text-[10px] text-pink-400 uppercase font-extrabold tracking-wider">Round Timer</p>
                    <div className="flex items-center justify-center sm:justify-end space-x-2">
                      <div
                        className={`text-4xl font-black font-mono tracking-tight transition-all duration-300 ${
                          (auctionState?.timer_seconds ?? 30) <= 5
                            ? 'text-red-500 animate-pulse scale-110 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                            : (auctionState?.timer_seconds ?? 30) <= 10
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {String(auctionState?.timer_seconds ?? 30).padStart(2, '0')}s
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-500 font-medium">Resets on every new bid</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto" />
              <p className="text-lg font-bold text-gray-400">No active lot on screen</p>
              <p className="text-xs text-gray-500">Select a bucket or search player to start bidding.</p>
            </div>
          )}
        </div>

        {/* Interactive Franchise Bidding Grid (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-3xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Tap Team Card to Place Bid ({nextRequiredBid} pts)</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {franchises.map((f) => {
                const isCurrentBidder = currentBidder?.id === f.id;
                const isPassed = auctionState?.passed_franchise_ids.includes(f.id);

                return (
                  <div
                    key={f.id}
                    onClick={() => handlePlaceBidForFranchise(f.id)}
                    className={`p-3 rounded-xl border text-xs flex flex-col items-center justify-center space-y-1 transition transform active:scale-95 cursor-pointer ${
                      isCurrentBidder
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold ring-2 ring-amber-400/50'
                        : isPassed
                        ? 'bg-gray-900/60 border-gray-800 text-gray-500 opacity-60'
                        : 'bg-gray-800/60 border-gray-700 hover:border-indigo-500 text-gray-200'
                    }`}
                  >
                    <img src={f.logo_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${f.short_code}`} alt={f.short_code} className="w-8 h-8 rounded-full bg-black/40 p-0.5 object-contain" />
                    <p className="font-extrabold text-white text-xs">{f.short_code}</p>
                    <p className="text-[10px] text-amber-400 font-mono">{f.purse} pts</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Franchises & Squad Leaderboard */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span>All 11 Franchises Standings &amp; Purse Limits</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {franchises.map((f) => (
            <div
              key={f.id}
              onClick={() => handlePlaceBidForFranchise(f.id)}
              className="glass-card rounded-2xl p-4 border border-gray-800 hover:border-indigo-500/60 cursor-pointer transition space-y-3"
            >
              <div className="flex items-center space-x-3">
                <img src={f.logo_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${f.short_code}`} alt={f.name} className="w-12 h-12 rounded-xl bg-gray-900 p-1 border border-gray-700 object-contain" />
                <div className="flex-1 truncate">
                  <h4 className="font-bold text-white text-base truncate">{f.name}</h4>
                  <p className="text-xs text-gray-400">Code: <strong className="text-indigo-400">{f.short_code}</strong></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-gray-900/60 p-2.5 rounded-xl text-xs text-center border border-gray-800">
                <div>
                  <p className="text-gray-400">Purse</p>
                  <p className="text-sm font-extrabold text-amber-400">{f.purse} pts</p>
                </div>
                <div>
                  <p className="text-gray-400">Max Bid</p>
                  <p className="text-sm font-extrabold text-blue-400">{f.max_permissible_bid} pts</p>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handlePlaceBidForFranchise(f.id); }}
                className="w-full py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-extrabold text-xs rounded-xl shadow-md hover:from-indigo-500 hover:to-pink-500 flex items-center justify-center space-x-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>BID FOR {f.short_code} ({nextRequiredBid} PTS)</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
