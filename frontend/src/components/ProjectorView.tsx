import React, { useEffect, useState } from 'react';
import type { AuctionState, Franchise } from '../types';
import { Flame, Clock, Award, Shield, AlertTriangle } from 'lucide-react';

interface ProjectorViewProps {
  auctionState: AuctionState | null;
  franchises: Franchise[];
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({ auctionState, franchises }) => {
  const activePlayer = auctionState?.current_player;
  const currentBidder = auctionState?.current_bidder;
  const scarcityWarnings = auctionState?.scarcity_warnings || {};
  const activeWarnings = Object.values(scarcityWarnings).filter((w) => w.warning_active);

  // High contrast timer state
  const [timer, setTimer] = useState(auctionState?.timer_seconds || 30);

  useEffect(() => {
    if (auctionState?.timer_seconds !== undefined) {
      setTimer(auctionState.timer_seconds);
    }
  }, [auctionState?.timer_seconds]);

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-between select-none">
      {/* Top Header: Tournament Banner & Scarcity Ticker */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-500 via-red-600 to-indigo-600 flex items-center justify-center font-black text-2xl shadow-2xl">
            ACC
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-amber-200 to-white">
              Avanthi Cricket Carnival
            </h1>
            <p className="text-sm font-semibold text-indigo-400">Player Auction 2026–27 &bull; Live Screen</p>
          </div>
        </div>

        {/* Bucket Badge & Round */}
        <div className="flex items-center space-x-4">
          {activeWarnings.length > 0 && (
            <div className="hidden lg:flex items-center space-x-2 bg-red-950/90 border border-red-500 text-red-300 px-4 py-2 rounded-xl text-xs font-bold animate-pulse-warning">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>SCARCITY ALERT: {activeWarnings.map((w) => w.bucket).join(', ')}</span>
            </div>
          )}

          <div className="bg-indigo-950/80 border border-indigo-500/50 px-5 py-2 rounded-2xl text-center">
            <p className="text-[10px] text-indigo-300 font-bold uppercase">Current Lot Category</p>
            <p className="text-xl font-black text-yellow-400">{auctionState?.current_bucket || 'B3'} BUCKET</p>
          </div>
        </div>
      </div>

      {/* Center Stage: Large Photo, Stats & Bidding Box */}
      {activePlayer ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center py-6">
          {/* Left Column: Huge Photograph (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative group w-72 h-72 md:w-96 md:h-96">
              <img
                src={activePlayer.photo_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=player'}
                alt={activePlayer.name}
                className="w-full h-full rounded-3xl object-cover border-4 border-indigo-500/50 shadow-2xl bg-gray-900 shadow-indigo-500/20"
              />
              <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-xl border border-white/20 text-sm font-bold text-yellow-400">
                LOT #{activePlayer.random_lot_number || activePlayer.id}
              </div>
              <div className="absolute bottom-4 right-4 bg-indigo-600 text-white font-extrabold px-4 py-1.5 rounded-xl text-sm shadow-lg border border-indigo-400">
                {activePlayer.derived_player_type}
              </div>
            </div>

            <div className="mt-4 text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-wide">{activePlayer.name}</h2>
              <p className="text-base font-semibold text-indigo-300 mt-1">
                {activePlayer.program} &bull; {activePlayer.branch} &bull; Year {activePlayer.year_of_study} ({activePlayer.bucket})
              </p>
            </div>
          </div>

          {/* Right Column: Stats, Bidding Display & Big Countdown Timer (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Career Statistics Summary */}
            <div className="bg-gray-900/80 rounded-3xl p-6 border border-gray-800 shadow-xl space-y-3">
              <h3 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider flex items-center space-x-2">
                <Award className="w-4 h-4 text-yellow-400" />
                <span>Career Statistics &amp; Skill Breakdown</span>
              </h3>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-black/60 p-3 rounded-2xl border border-gray-800">
                  <p className="text-xs text-gray-400 font-medium">Matches</p>
                  <p className="text-2xl font-black text-white">{activePlayer.matches}</p>
                </div>
                <div className="bg-black/60 p-3 rounded-2xl border border-gray-800">
                  <p className="text-xs text-gray-400 font-medium">Runs / Avg</p>
                  <p className="text-2xl font-black text-amber-400">{activePlayer.runs}</p>
                  <p className="text-[10px] text-gray-500 font-bold">Avg {activePlayer.batting_avg}</p>
                </div>
                <div className="bg-black/60 p-3 rounded-2xl border border-gray-800">
                  <p className="text-xs text-gray-400 font-medium">Wickets / Econ</p>
                  <p className="text-2xl font-black text-emerald-400">{activePlayer.wickets}</p>
                  <p className="text-[10px] text-gray-500 font-bold">Econ {activePlayer.economy}</p>
                </div>
                <div className="bg-black/60 p-3 rounded-2xl border border-gray-800">
                  <p className="text-xs text-gray-400 font-medium">Strike Rate</p>
                  <p className="text-2xl font-black text-blue-400">{activePlayer.strike_rate}</p>
                </div>
              </div>
            </div>

            {/* Live Pricing & Current Bidder Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-tr from-gray-900 to-indigo-950 p-6 rounded-3xl border border-indigo-500/40 shadow-2xl flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base Price</p>
                  <p className="text-2xl font-black text-gray-300">{activePlayer.base_price} CREDITS</p>
                </div>

                <div className="mt-4 pt-4 border-t border-indigo-900/60">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Current Bid</p>
                  <p className="text-5xl font-black text-amber-400 tracking-tight">
                    {auctionState?.current_bid_price || activePlayer.base_price}
                  </p>
                </div>
              </div>

              {/* Countdown Timer Box */}
              <div
                className={`p-6 rounded-3xl border flex flex-col items-center justify-center shadow-2xl ${
                  timer <= 5
                    ? 'bg-red-950/90 border-red-500 animate-pulse-warning'
                    : 'bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Countdown Timer</span>
                </div>
                <span className={`text-6xl font-black tracking-tighter ${timer <= 5 ? 'text-red-400' : 'text-white'}`}>
                  {timer}s
                </span>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Resets to 20s after each tap</p>
              </div>
            </div>

            {/* Highest Bidder Display Card */}
            <div className="bg-gradient-to-r from-amber-950/60 via-gray-900 to-amber-950/60 p-5 rounded-3xl border border-amber-500/40 flex items-center justify-between shadow-xl">
              <div className="flex items-center space-x-4">
                {currentBidder ? (
                  <>
                    <img src={currentBidder.logo_url} alt={currentBidder.name} className="w-14 h-14 rounded-2xl bg-black p-1 border border-amber-400" />
                    <div>
                      <p className="text-xs font-extrabold text-amber-400 uppercase tracking-widest">Leading Bidder</p>
                      <h3 className="text-2xl font-black text-white">{currentBidder.name}</h3>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Status</p>
                    <h3 className="text-xl font-bold text-gray-400">Awaiting opening bid...</h3>
                  </div>
                )}
              </div>

              {currentBidder && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Purse Left</p>
                  <p className="text-xl font-black text-emerald-400">{currentBidder.purse} pts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="my-auto py-24 text-center space-y-4">
          <Flame className="w-20 h-20 text-yellow-500 mx-auto animate-bounce" />
          <h2 className="text-4xl font-black text-white">READY FOR NEXT LOT</h2>
          <p className="text-lg font-medium text-gray-400">The auctioneer will initiate the next bidding round.</p>
        </div>
      )}

      {/* Bottom Bar: All 11 Franchise Status Badges (§14) */}
      <div className="border-t border-gray-800 pt-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center space-x-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span>All 11 Franchise Status (In Play / Passed / Blocked)</span>
        </p>

        <div className="grid grid-cols-11 gap-2">
          {franchises.map((f) => {
            const isCurrentBidder = currentBidder?.id === f.id;
            const isPassed = auctionState?.passed_franchise_ids.includes(f.id);
            const isBlocked = f.is_blocked;

            return (
              <div
                key={f.id}
                className={`p-2 rounded-xl text-center border text-xs transition ${
                  isCurrentBidder
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300 font-extrabold shadow-lg shadow-amber-500/20 animate-pulse-glow'
                    : isPassed
                    ? 'bg-gray-950/80 border-gray-800 text-gray-600 line-through opacity-60'
                    : isBlocked
                    ? 'bg-red-950/40 border-red-800/60 text-red-400 font-semibold'
                    : 'bg-gray-900/60 border-gray-700/60 text-gray-200'
                }`}
              >
                <img src={f.logo_url} alt={f.short_code} className="w-8 h-8 mx-auto rounded-lg mb-1 bg-black/50 p-0.5" />
                <p className="font-extrabold text-[11px] truncate">{f.short_code}</p>
                <p className="text-[9px] text-gray-400 font-semibold">{f.purse} pts</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
