import React, { useState, useMemo } from 'react';
import type { Player, Franchise } from '../types';
import { Search, X, Shield, User, Award, CheckCircle2, AlertCircle } from 'lucide-react';

interface GlobalPlayerSearchProps {
  players: Player[];
  franchises: Franchise[];
}

export const GlobalPlayerSearch: React.FC<GlobalPlayerSearchProps> = ({ players, franchises }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.roll_number.toLowerCase().includes(q)
    ).slice(0, 20); // Limit to top 20 for fast rendering
  }, [searchQuery, players]);

  const getTeamInfo = (player: Player) => {
    const teamId = player.sold_franchise_id || player.retained_franchise_id || player.referred_franchise_id;
    if (!teamId) return null;
    return franchises.find((f) => f.id === teamId) || null;
  };

  const getStatusBadge = (player: Player) => {
    if (player.sold_franchise_id) {
      if (player.sold_type === 'retained') {
        return { label: 'RETAINED', bg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
      }
      if (player.sold_type === 'referred') {
        return { label: 'REFERRED', bg: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
      }
      if (player.sold_type === 'allotted') {
        return { label: 'ALLOTTED', bg: 'bg-blue-950/80 text-blue-300 border-blue-700/60' };
      }
      if (player.sold_type === 'scouted') {
        return { label: 'SCOUTED', bg: 'bg-teal-950/80 text-teal-300 border-teal-700/60' };
      }
      return { label: 'SOLD', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
    }
    if (player.retained_franchise_id) {
      return { label: 'RETAINED', bg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
    }
    if (player.referred_franchise_id) {
      return { label: 'REFERRED', bg: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
    }
    return { label: 'UNSOLD', bg: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60' };
  };

  return (
    <div className="relative w-full">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3.5 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search player name or roll no..."
          className="w-full pl-10 pr-9 py-2 rounded-xl text-xs bg-zinc-900/90 text-white placeholder-zinc-500 border border-zinc-700/80 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 p-0.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Dropdown Results */}
      {isOpen && searchQuery.trim().length > 0 && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0d0d12]/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl max-h-96 overflow-y-auto p-2 space-y-1">
            <div className="px-3 py-1.5 flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 border-b border-zinc-800/60 mb-1">
              <span>Search Results ({filteredPlayers.length})</span>
              <span>Click to view details</span>
            </div>

            {filteredPlayers.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-400 space-y-1">
                <AlertCircle className="w-5 h-5 mx-auto text-zinc-500 mb-1" />
                <p>No player found matching &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              filteredPlayers.map((player) => {
                const team = getTeamInfo(player);
                const status = getStatusBadge(player);

                return (
                  <div
                    key={player.id}
                    onClick={() => {
                      setSelectedPlayer(player);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/60 cursor-pointer border border-transparent hover:border-zinc-700/50 transition group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <img
                        src={player.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.roll_number}`}
                        alt={player.name}
                        className="w-10 h-10 rounded-xl bg-zinc-900 object-cover border border-zinc-700/60 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                            {player.name}
                          </h4>
                          <span className="text-[10px] font-mono text-indigo-400 font-semibold px-1.5 py-0.2 rounded bg-indigo-950/60 border border-indigo-800/40 shrink-0">
                            {player.roll_number}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {player.course} &bull; {player.branch} &bull; <strong className="text-zinc-300">{player.bucket}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${status.bg}`}>
                        {status.label}
                      </span>

                      {team && (
                        <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
                          {team.logo_url && (
                            <img src={team.logo_url} alt={team.name} className="w-4 h-4 rounded object-contain" />
                          )}
                          <span className="text-[10px] font-bold text-zinc-200">{team.short_code}</span>
                          {player.sold_price && (
                            <span className="text-[10px] font-extrabold text-emerald-400">({player.sold_price} Cr)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Selected Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-[#0e0e13] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center space-x-4">
              <img
                src={selectedPlayer.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPlayer.roll_number}`}
                alt={selectedPlayer.name}
                className="w-16 h-16 rounded-2xl bg-zinc-900 object-cover border-2 border-indigo-500/40 p-0.5 shadow-lg"
              />
              <div>
                <h3 className="text-lg font-black text-white">{selectedPlayer.name}</h3>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 font-mono text-xs font-bold border border-indigo-800/40">
                    {selectedPlayer.roll_number}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs font-bold">
                    {selectedPlayer.bucket}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-xs font-bold border border-amber-800/40">
                    Base: {selectedPlayer.base_price} Cr
                  </span>
                </div>
              </div>
            </div>

            {/* Sold Status Banner */}
            {(() => {
              const team = getTeamInfo(selectedPlayer);
              const status = getStatusBadge(selectedPlayer);
              return (
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  team ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-zinc-900/60 border-zinc-800'
                }`}>
                  <div>
                    <p className="text-[10px] uppercase font-extrabold text-zinc-400">Auction Status</p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${status.bg}`}>
                        {status.label}
                      </span>
                      {selectedPlayer.sold_price && (
                        <span className="text-sm font-extrabold text-emerald-400">
                          {selectedPlayer.sold_price} Credits
                        </span>
                      )}
                    </div>
                  </div>

                  {team ? (
                    <div className="flex items-center space-x-2.5 bg-zinc-900/90 px-3 py-2 rounded-xl border border-zinc-700/60">
                      {team.logo_url && (
                        <img src={team.logo_url} alt={team.name} className="w-7 h-7 rounded object-contain" />
                      )}
                      <div>
                        <p className="text-xs font-black text-white">{team.name}</p>
                        <p className="text-[10px] text-zinc-400 font-semibold">{team.short_code}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400 font-semibold">Not assigned to any team</span>
                  )}
                </div>
              );
            })()}

            {/* Academic & Skill Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Academic Info</p>
                <p className="text-zinc-200 font-semibold">{selectedPlayer.course} - {selectedPlayer.program}</p>
                <p className="text-zinc-400">Branch: {selectedPlayer.branch}</p>
                <p className="text-zinc-400">Year: Year {selectedPlayer.year_of_study}</p>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Skill Profile</p>
                <p className="text-indigo-400 font-bold">{selectedPlayer.derived_player_type}</p>
                <p className="text-zinc-400">Batting: {selectedPlayer.batting_arm}</p>
                {selectedPlayer.is_skilled_bowler && (
                  <p className="text-zinc-400">Bowling: {selectedPlayer.bowling_arm || ''} {selectedPlayer.bowling_type || ''}</p>
                )}
              </div>
            </div>

            {/* Performance Stats */}
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80 space-y-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Career Statistics</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="block text-[10px] text-zinc-500 font-bold">Matches</span>
                  <span className="font-extrabold text-white">{selectedPlayer.matches}</span>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="block text-[10px] text-zinc-500 font-bold">Runs</span>
                  <span className="font-extrabold text-amber-400">{selectedPlayer.runs}</span>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="block text-[10px] text-zinc-500 font-bold">Wickets</span>
                  <span className="font-extrabold text-emerald-400">{selectedPlayer.wickets}</span>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="block text-[10px] text-zinc-500 font-bold">Strike Rate</span>
                  <span className="font-extrabold text-indigo-400">{selectedPlayer.strike_rate}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlayer(null)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl border border-zinc-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
