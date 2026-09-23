import React from 'react';
import type { AuditLog, Franchise, Player } from '../types';
import { X, History, RotateCcw, AlertTriangle } from 'lucide-react';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLog[];
  franchises: Franchise[];
  players: Player[];
  onUndo: (auditId: number, reason: string) => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  auditLogs,
  franchises,
  players,
  onUndo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-5xl rounded-3xl p-6 border border-gray-800 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Authoritative Audit Trail (§16)</h2>
              <p className="text-xs text-gray-400">Complete record of every bid, pass, hammer, skip, direct assign, and undo action</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-900 text-gray-400 hover:text-white border border-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="w-full text-xs text-left text-gray-300">
            <thead className="bg-gray-900/80 uppercase text-[10px] text-gray-400 font-semibold border-b border-gray-800">
              <tr>
                <th className="p-3">ID #</th>
                <th className="p-3">Action</th>
                <th className="p-3">Player</th>
                <th className="p-3">Franchise</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Timestamp / Reason</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 bg-gray-950/40">
              {auditLogs.map((log) => {
                const player = players.find((p) => p.id === log.player_id);
                const franchise = franchises.find((f) => f.id === log.franchise_id);

                return (
                  <tr key={log.id} className={`hover:bg-gray-800/40 transition ${log.is_undone ? 'opacity-50 line-through bg-red-950/20' : ''}`}>
                    <td className="p-3 font-mono font-bold text-gray-400">#{log.id}</td>
                    <td className="p-3 font-bold text-amber-400">{log.action_type}</td>
                    <td className="p-3 font-semibold text-white">{player ? player.name : '—'}</td>
                    <td className="p-3 text-indigo-300">{franchise ? franchise.short_code : '—'}</td>
                    <td className="p-3 font-bold text-emerald-400">{log.amount ? `${log.amount} pts` : '—'}</td>
                    <td className="p-3 text-gray-300 font-semibold">{log.performed_by}</td>
                    <td className="p-3">
                      <p className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      <p className="text-gray-300 text-[11px] truncate max-w-xs">{log.reason || '—'}</p>
                    </td>
                    <td className="p-3">
                      {log.is_undone ? (
                        <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold uppercase text-[10px]">
                          UNDONE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold uppercase text-[10px]">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {!log.is_undone && ['HAMMER_SOLD', 'DIRECT_ASSIGN', 'ALLOT'].includes(log.action_type) && (
                        <button
                          onClick={() => {
                            const reason = prompt(`Enter reason for undoing Audit #${log.id}:`);
                            if (reason) onUndo(log.id, reason);
                          }}
                          className="px-2.5 py-1 bg-purple-950 text-purple-300 hover:bg-purple-900 border border-purple-800 rounded font-bold text-[10px] transition flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>UNDO</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
