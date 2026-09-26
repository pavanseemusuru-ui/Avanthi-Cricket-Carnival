import React, { useState } from 'react';
import type { AuctionState, Franchise } from '../types';
import { api } from '../services/api';
import { Smartphone, Zap, AlertCircle, Shield, LogOut, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FranchiseBiddingViewProps {
  auctionState: AuctionState | null;
  franchises: Franchise[];
  onRefreshState: () => void;
  onLogout: () => void;
}

export const FranchiseBiddingView: React.FC<FranchiseBiddingViewProps> = ({
  auctionState,
  franchises,
  onRefreshState,
  onLogout,
}) => {
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<number | null>(franchises[0]?.id || null);
  const [biddingError, setBiddingError] = useState<string | null>(null);
  const [isSubmittingId, setIsSubmittingId] = useState<number | null>(null);

  const activePlayer = auctionState?.current_player;
  const currentBidder = auctionState?.current_bidder;
  const nextRequiredBid = auctionState?.next_required_bid || 20;

  const handlePlaceBid = async (franchiseId: number) => {
    if (!activePlayer) return;
    const f = franchises.find((item) => item.id === franchiseId);
    if (!f) return;

    setBiddingError(null);
    setIsSubmittingId(franchiseId);
    try {
      await api.placeBid(franchiseId, nextRequiredBid, `Franchise:${f.short_code}`);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
      onRefreshState();
    } catch (err: any) {
      setBiddingError(err.message || 'Bid rejected');
    } finally {
      setIsSubmittingId(null);
    }
  };

  const handleTogglePass = async (franchiseId: number, isPassed: boolean) => {
    setBiddingError(null);
    try {
      if (isPassed) {
        await api.unpassFranchise(franchiseId);
      } else {
        await api.passFranchise(franchiseId);
      }
      onRefreshState();
    } catch (err: any) {
      setBiddingError(err.message || 'Action failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Console Title Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-zinc-800 text-center space-y-2 shadow-2xl relative">
        <button
          type="button"
          onClick={onLogout}
          className="absolute right-4 top-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-bold"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        <div className="flex items-center justify-center space-x-2 text-lime-400 text-xs font-bold uppercase tracking-wider">
          <Smartphone className="w-4 h-4" />
          <span>Team Captains &amp; Franchise Bidding Deck</span>
        </div>
        <h1 className="text-2xl font-black text-white">Grid Franchise Bidding Console</h1>
        <p className="text-xs text-zinc-400">
          Tap any team card below to place an instant bid for that franchise. No slow dropdowns!
        </p>
      </div>

      {/* Error Alert */}
      {biddingError && (
        <div className="bg-red-950/90 border border-red-500/80 p-4 rounded-2xl flex items-center space-x-3 text-xs text-red-300 font-bold shadow-xl animate-bounce">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{biddingError}</span>
        </div>
      )}

      {/* Hero Active Lot Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-zinc-800 shadow-2xl space-y-4">
        {activePlayer ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <img
                src={activePlayer.photo_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=player'}
                alt={activePlayer.name}
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-2 border-zinc-700 bg-zinc-950 shadow-lg"
              />
              <div>
                <span className="px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-extrabold uppercase">
                  Bucket {activePlayer.bucket} &bull; {activePlayer.derived_player_type}
                </span>
                <h2 className="text-2xl font-black text-white mt-1">{activePlayer.name}</h2>
                <p className="text-xs text-zinc-400">
                  {activePlayer.program} &bull; {activePlayer.branch} (Year {activePlayer.year_of_study})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 bg-[#121318] p-4 rounded-2xl border border-zinc-800 text-center w-full md:w-auto justify-around shadow-xl">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-semibold">Base Price</p>
                <p className="text-base font-bold text-zinc-300">{activePlayer.base_price} pts</p>
              </div>

              <div className="border-x border-zinc-800 px-6">
                <p className="text-[10px] text-amber-400 uppercase font-bold">Current Bid</p>
                <p className="text-3xl font-black text-amber-400">
                  {auctionState?.current_bid_price || activePlayer.base_price} pts
                </p>
                {currentBidder && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-white text-black text-[10px] font-black rounded">
                    {currentBidder.short_code}
                  </span>
                )}
              </div>

              <div>
                <p className="text-[10px] text-lime-400 uppercase font-bold">Next Bid Required</p>
                <p className="text-2xl font-black text-lime-300">{nextRequiredBid} pts</p>
              </div>

              {/* Prominent Large Timer Box */}
              <div className="border-l border-zinc-800 pl-6 text-center">
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 inline animate-spin-slow text-lime-400" /> Timer
                </p>
                <span className={`text-4xl md:text-5xl font-black font-mono tracking-tighter block mt-0.5 ${
                  (auctionState?.timer_seconds ?? 30) <= 5
                    ? 'text-red-500 animate-pulse scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]'
                    : (auctionState?.timer_seconds ?? 30) <= 10
                    ? 'text-amber-400'
                    : 'text-lime-400'
                }`}>
                  {String(auctionState?.timer_seconds ?? 30).padStart(2, '0')}s
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500 space-y-1">
            <Shield className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-base font-bold text-zinc-400">Awaiting next lot call by auctioneer...</p>
          </div>
        )}
      </div>

      {/* Grid of All 11 Franchises */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Select &amp; Tap Team to Place Bid</span>
          </h2>
          <span className="text-xs text-zinc-400 font-semibold">11 Franchises In Play</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {franchises.map((f) => {
            const isCurrentBidder = currentBidder?.id === f.id;
            const isPassed = Boolean(auctionState?.passed_franchise_ids?.includes(f.id));
            const maxBid = f.max_permissible_bid ?? 1000;
            const isBlocked = nextRequiredBid > maxBid || f.is_blocked;
            const isSelected = selectedFranchiseId === f.id;
            const isSubmittingThis = isSubmittingId === f.id;

            return (
              <div
                key={f.id}
                onClick={() => setSelectedFranchiseId(f.id)}
                className={`glass-card rounded-3xl p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden ${
                  isCurrentBidder
                    ? 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-400/50'
                    : isSelected
                    ? 'border-zinc-500 bg-[#16171d]'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src={f.logo_url} alt={f.name} className="w-12 h-12 rounded-2xl bg-zinc-950 p-1 border border-zinc-800 object-contain" />
                    <div>
                      <h3 className="font-black text-white text-sm leading-tight">{f.name}</h3>
                      <p className="text-[11px] text-zinc-400">{f.short_code}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                      isCurrentBidder
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
                        : isPassed
                        ? 'bg-zinc-800 text-zinc-500 border-zinc-700 line-through'
                        : 'bg-lime-950/80 text-lime-400 border-lime-800/60'
                    }`}
                  >
                    {isCurrentBidder ? 'HIGH BIDDER' : isPassed ? 'PASSED' : 'IN PLAY'}
                  </span>
                </div>

                {/* Purse Stats */}
                <div className="grid grid-cols-2 gap-2 bg-[#121318] p-2.5 rounded-2xl border border-zinc-800 text-xs text-center">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Purse</p>
                    <p className="text-sm font-black text-amber-400">{f.purse} pts</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Max Permissible</p>
                    <p className="text-sm font-black text-lime-400">{f.max_permissible_bid} pts</p>
                  </div>
                </div>

                {/* Bucket Checklist */}
                <div className="flex gap-1 text-[9px] font-bold text-center">
                  {['B1', 'B2', 'B3', 'B4', 'B5'].map((b) => {
                    const count = f.bucket_counts?.[b] || 0;
                    const req = auctionState?.bucket_minimums?.[b] ?? 2;
                    const isMet = count >= req;
                    return (
                      <span
                        key={b}
                        className={`flex-1 py-0.5 rounded ${
                          isMet ? 'bg-lime-950/80 text-lime-400 border border-lime-800/60' : 'bg-red-950/50 text-red-400 border border-red-900/60'
                        }`}
                      >
                        {b}:{count}
                      </span>
                    );
                  })}
                </div>

                {/* 1-Tap Bid Action Button */}
                <div className="space-y-2 pt-1">
                  <button
                    disabled={!activePlayer || isCurrentBidder || isBlocked || isSubmittingThis}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaceBid(f.id);
                    }}
                    className={`w-full py-3 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center space-x-1.5 transition transform active:scale-95 ${
                      isCurrentBidder
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 cursor-not-allowed'
                        : isBlocked
                        ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-zinc-200 font-black'
                    }`}
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>
                      {isCurrentBidder
                        ? 'HOLDING HIGH BID'
                        : isBlocked
                        ? 'BID BLOCKED'
                        : `BID ${nextRequiredBid} PTS`}
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePass(f.id, Boolean(isPassed));
                    }}
                    className={`w-full py-1.5 rounded-xl text-[10px] font-extrabold border transition ${
                      isPassed
                        ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        : 'bg-[#121318] text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    {isPassed ? 'RE-ENTER (UNPASS)' : 'PASS ON LOT'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
