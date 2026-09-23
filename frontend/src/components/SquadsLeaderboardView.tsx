import React, { useState } from 'react';
import type { Franchise, Player, AuctionState } from '../types';
import { Shield, Trophy, Users, Search } from 'lucide-react';

interface SquadsLeaderboardViewProps {
  franchises: Franchise[];
  players: Player[];
  auctionState: AuctionState | null;
}

export const SquadsLeaderboardView: React.FC<SquadsLeaderboardViewProps> = ({
  franchises,
  players,
  auctionState,
}) => {
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<number | null>(null);

  const selectedFranchise = franchises.find((f) => f.id === selectedFranchiseId);
  const selectedFranchisePlayers = selectedFranchise
    ? players.filter(
        (p) =>
          p.sold_franchise_id === selectedFranchise.id ||
          p.retained_franchise_id === selectedFranchise.id ||
          p.referred_franchise_id === selectedFranchise.id
      )
    : [];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="glass-panel rounded-3xl p-6 border border-indigo-500/30 text-center space-y-2 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/40">
          <Users className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-white">Franchises &amp; Squad Leaderboard</h1>
        <p className="text-xs text-gray-400">All 11 Franchises Standings, Squad Compositions, and Purse Limits</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {franchises.map((f) => {
          const squadMembers = players.filter(
            (p) =>
              p.sold_franchise_id === f.id ||
              p.retained_franchise_id === f.id ||
              p.referred_franchise_id === f.id
          );

          return (
            <div
              key={f.id}
              onClick={() => setSelectedFranchiseId(f.id)}
              className="glass-card rounded-3xl p-5 border border-gray-800 hover:border-indigo-500/60 transition cursor-pointer space-y-4 shadow-xl"
            >
              <div className="flex items-center space-x-3">
                <img src={f.logo_url} alt={f.name} className="w-12 h-12 rounded-2xl bg-gray-900 p-1 border border-gray-700 object-contain" />
                <div className="flex-1 truncate">
                  <h3 className="font-extrabold text-white text-base truncate">{f.name}</h3>
                  <p className="text-xs text-gray-400">Coordinator: {f.faculty_coordinator_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-gray-950/60 p-2.5 rounded-2xl text-xs text-center border border-gray-800">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Purse Left</p>
                  <p className="text-sm font-black text-amber-400">{f.purse} pts</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Squad Size</p>
                  <p className="text-sm font-black text-emerald-400">{f.squad_count} / 22</p>
                </div>
              </div>

              {/* Bucket Requirements */}
              <div className="text-[10px] space-y-1">
                <p className="text-gray-400 font-bold uppercase tracking-wider">Bucket Progress</p>
                <div className="grid grid-cols-5 gap-1 text-center font-bold">
                  {['B1', 'B2', 'B3', 'B4', 'B5'].map((b) => {
                    const count = f.bucket_counts?.[b] || 0;
                    const req = auctionState?.bucket_minimums?.[b] ?? 2;
                    const isMet = count >= req;
                    return (
                      <span
                        key={b}
                        className={`py-0.5 rounded ${
                          isMet ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-red-950/60 text-red-400 border border-red-900'
                        }`}
                      >
                        {b}:{count}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 text-center text-xs font-bold text-indigo-400 hover:text-white">
                View Full Squad ({squadMembers.length} Players) &rarr;
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Franchise Squad Modal */}
      {selectedFranchise && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border border-indigo-500/40 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedFranchiseId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full bg-gray-800"
            >
              &times;
            </button>

            <div className="flex items-center space-x-4 border-b border-gray-800 pb-4">
              <img src={selectedFranchise.logo_url} alt={selectedFranchise.name} className="w-16 h-16 rounded-2xl bg-gray-900 p-1 border border-gray-700" />
              <div>
                <h2 className="text-xl font-black text-white">{selectedFranchise.name} ({selectedFranchise.short_code})</h2>
                <p className="text-xs text-gray-400">Coordinator: {selectedFranchise.faculty_coordinator_name}</p>
                <div className="flex items-center space-x-3 text-xs pt-1">
                  <span className="text-amber-400 font-bold">Purse: {selectedFranchise.purse} pts</span>
                  <span className="text-emerald-400 font-bold">Squad: {selectedFranchise.squad_count}/22</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Acquired Squad Members ({selectedFranchisePlayers.length})</span>
              </h3>

              {selectedFranchisePlayers.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No players acquired yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedFranchisePlayers.map((p) => (
                    <div key={p.id} className="p-3 bg-gray-900/80 rounded-2xl border border-gray-800 flex items-center space-x-3 text-xs">
                      <img src={p.photo_url} alt={p.name} className="w-10 h-10 rounded-xl object-cover bg-gray-800" />
                      <div className="flex-1 truncate">
                        <p className="font-bold text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.program} &bull; {p.derived_player_type}</p>
                      </div>
                      <span className="font-extrabold text-amber-400 text-xs">
                        {p.sold_price !== undefined ? `${p.sold_price} pts` : 'Retained'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
