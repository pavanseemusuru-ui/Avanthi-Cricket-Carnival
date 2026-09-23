import React from 'react';
import type { Franchise, Player, AuctionState } from '../types';
import { X, BarChart3, Shield } from 'lucide-react';

interface SquadAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchises: Franchise[];
  players: Player[];
  auctionState: AuctionState | null;
}

export const SquadAnalysisModal: React.FC<SquadAnalysisModalProps> = ({
  isOpen,
  onClose,
  franchises,
  players,
  auctionState,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-5xl rounded-3xl p-6 border border-gray-800 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Squad Analysis &amp; Composition Matrix</h2>
              <p className="text-xs text-gray-400">Batting/Bowling balance, Spend per bucket, Mandatory bucket completion</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-900 text-gray-400 hover:text-white border border-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {franchises.map((f) => {
            const squadPlayers = players.filter(
              (p) => (p.sold_franchise_id || p.retained_franchise_id || p.referred_franchise_id) === f.id
            );

            const batters = squadPlayers.filter((p) => p.is_skilled_batter).length;
            const bowlers = squadPlayers.filter((p) => p.is_skilled_bowler).length;
            const keepers = squadPlayers.filter((p) => p.is_wicket_keeper).length;

            return (
              <div key={f.id} className="glass-card rounded-2xl p-4 border border-gray-800 space-y-3 text-xs">
                <div className="flex items-center space-x-3">
                  <img src={f.logo_url} alt={f.name} className="w-10 h-10 rounded-xl bg-gray-900 p-1 border border-gray-700" />
                  <div className="flex-1 truncate">
                    <h4 className="font-bold text-white text-sm truncate">{f.name}</h4>
                    <p className="text-amber-400 font-semibold">{f.purse} pts left &bull; {f.squad_count} players</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-900/60 p-2 rounded-xl text-center border border-gray-800">
                  <div>
                    <p className="text-gray-400">Batters</p>
                    <p className="font-bold text-blue-400">{batters}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Bowlers</p>
                    <p className="font-bold text-emerald-400">{bowlers}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">WKs</p>
                    <p className="font-bold text-yellow-400">{keepers}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-semibold">Bucket Quota Compliance:</p>
                  <div className="flex gap-1">
                    {['B1', 'B2', 'B3', 'B4', 'B5'].map((b) => {
                      const count = f.bucket_counts?.[b] || 0;
                      const req = auctionState?.bucket_minimums?.[b] ?? 2;
                      const isMet = count >= req;
                      return (
                        <span
                          key={b}
                          className={`flex-1 text-center py-0.5 rounded text-[10px] font-bold ${
                            isMet ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-900'
                          }`}
                        >
                          {b}:{count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
