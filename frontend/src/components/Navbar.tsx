import React from 'react';
import type { ViewMode } from '../types';
import { Trophy, Tv, Smartphone, ShieldCheck, UserPlus, BarChart3, History, Download } from 'lucide-react';

interface NavbarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenSquadAnalysis: () => void;
  onOpenAuditLog: () => void;
  onExportExcel: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  onOpenSquadAnalysis,
  onOpenAuditLog,
  onExportExcel,
}) => {
  const navItems: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'public', label: 'Public Live View', icon: Trophy },
    { id: 'projector', label: 'Projector Display', icon: Tv },
    { id: 'bidding', label: 'Franchise Bidding', icon: Smartphone },
    { id: 'admin', label: 'Admin Control', icon: ShieldCheck },
    { id: 'register', label: 'Player Registration', icon: UserPlus },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-gray-800 px-4 py-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Title / Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectView('public')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-red-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-xl shadow-lg">
            ACC
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide leading-tight">
              Avanthi Cricket Carnival
            </h1>
            <p className="text-xs text-indigo-400 font-medium">Player Auction Portal 2026–27</p>
          </div>
        </div>

        {/* View switcher buttons */}
        <nav className="flex flex-wrap items-center justify-center gap-1.5 bg-gray-900/60 p-1.5 rounded-xl border border-gray-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Utilities */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenSquadAnalysis}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/80 transition"
            title="Squad Analysis"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Squad Analysis</span>
          </button>

          <button
            onClick={onOpenAuditLog}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/60 hover:bg-purple-900/80 transition"
            title="Audit Log"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Audit Log</span>
          </button>

          <button
            onClick={onExportExcel}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 hover:bg-amber-900/80 transition"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
