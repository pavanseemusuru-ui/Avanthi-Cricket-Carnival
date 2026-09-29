import React, { useState } from 'react';
import type { ViewMode, Player, Franchise } from '../types';
import { GlobalPlayerSearch } from './GlobalPlayerSearch';
import {
  Trophy, Tv, Zap, ShieldCheck, UserPlus,
  BarChart3, History, Download, Users, Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenSquadAnalysis: () => void;
  onOpenAuditLog: () => void;
  onExportExcel: () => void;
  players?: Player[];
  franchises?: Franchise[];
  /** When true, sidebar shows as icon-only narrow strip (projector mode) */
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenSquadAnalysis,
  onOpenAuditLog,
  onExportExcel,
  players = [],
  franchises = [],
  collapsed = false,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { id: ViewMode; label: string; icon: any; badge?: string }[] = [
    { id: 'public',    label: 'Live Auction',         icon: Trophy,     badge: 'LIVE' },
    { id: 'bidding',   label: 'Captain Bidding',       icon: Zap },
    { id: 'projector', label: 'Projector Stage',       icon: Tv },
    { id: 'register',  label: 'Player Registration',   icon: UserPlus },
    { id: 'squads',    label: 'Squad Leaderboard',     icon: Users },
    { id: 'admin',     label: 'Admin Portal',          icon: ShieldCheck },
  ];

  const handleNav = (view: ViewMode) => {
    onSelectView(view);
    setMobileOpen(false);
  };

  /* ── Collapsed (icon-only) variant used for Projector fullscreen ── */
  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col w-16 fixed top-0 left-0 bottom-0 z-40 bg-[#08080a] border-r border-zinc-800/70 items-center py-4 space-y-3 shadow-2xl">
        {/* ACC Logo */}
        <div
          onClick={() => handleNav('public')}
          className="w-9 h-9 rounded-xl bg-white text-black font-black text-[11px] flex items-center justify-center shadow-md cursor-pointer mb-2"
        >
          ACC
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              title={item.label}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-white text-black shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
            </button>
          );
        })}

        <div className="mt-auto space-y-2">
          <button onClick={onOpenSquadAnalysis} title="Squad Analysis"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-300 hover:bg-zinc-800 transition">
            <BarChart3 className="w-4 h-4 text-lime-400" />
          </button>
          <button onClick={onOpenAuditLog} title="Audit Log"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-300 hover:bg-zinc-800 transition">
            <History className="w-4 h-4 text-amber-400" />
          </button>
          <button onClick={onExportExcel} title="Export Excel"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-300 hover:bg-zinc-800 transition">
            <Download className="w-4 h-4 text-yellow-400" />
          </button>
        </div>
      </aside>
    );
  }

  /* ── Full expanded sidebar ── */
  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-50 bg-[#08080a]/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNav('public')}>
          <div className="w-9 h-9 rounded-xl bg-white text-black font-black flex items-center justify-center text-xs shadow-md">
            ACC
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Avanthi Carnival</h1>
            <p className="text-[10px] text-zinc-400 font-medium">Auction Portal 2026–27</p>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-bold"
        >
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed top-0 left-0 bottom-0 z-40 bg-[#08080a] border-r border-zinc-800/80 text-zinc-200 shadow-2xl">
        {/* Logo & Global Search */}
        <div className="p-4 border-b border-zinc-800/70 space-y-3">
          <div onClick={() => handleNav('public')} className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center font-black text-base shadow-md group-hover:scale-105 transition-transform">
              ACC
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight group-hover:text-zinc-300 transition-colors">
                Avanthi Carnival
              </h1>
              <p className="text-[10px] text-zinc-400 font-medium">Auction Portal 2026–27</p>
            </div>
          </div>

          <GlobalPlayerSearch players={players} franchises={franchises} />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Navigation</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-black shadow-lg font-extrabold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                    isActive ? 'bg-red-600 text-white' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Utilities */}
        <div className="p-4 border-t border-zinc-800/70 space-y-2 bg-[#050507]">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Quick Actions</p>

          <button onClick={onOpenSquadAnalysis}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#121318] text-zinc-300 border border-zinc-800 hover:bg-zinc-800/80 transition">
            <BarChart3 className="w-4 h-4 text-lime-400 shrink-0" />
            <span>Squad Analysis</span>
          </button>

          <button onClick={onOpenAuditLog}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#121318] text-zinc-300 border border-zinc-800 hover:bg-zinc-800/80 transition">
            <History className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Audit Log</span>
          </button>

          <button onClick={onExportExcel}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#121318] text-zinc-300 border border-zinc-800 hover:bg-zinc-800/80 transition">
            <Download className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>Export Excel</span>
          </button>

          <div className="pt-1 text-center text-[10px] text-zinc-500">
            <span className="inline-flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-zinc-400" />
              <span>Insta UI &bull; ACC 2026</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/90 backdrop-blur-md pt-16 px-4 pb-6 overflow-y-auto space-y-3">
          <div className="pb-2 border-b border-zinc-800">
            <GlobalPlayerSearch players={players} franchises={franchises} />
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button key={item.id} onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl font-bold text-xs ${
                  isActive ? 'bg-white text-black font-extrabold' : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                }`}>
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white">{item.badge}</span>}
              </button>
            );
          })}

          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <button onClick={() => { onOpenSquadAnalysis(); setMobileOpen(false); }}
              className="w-full flex items-center space-x-2 p-3 rounded-xl text-xs font-semibold bg-zinc-900 text-zinc-200 border border-zinc-800">
              <BarChart3 className="w-4 h-4 text-lime-400" /><span>Squad Analysis</span>
            </button>
            <button onClick={() => { onOpenAuditLog(); setMobileOpen(false); }}
              className="w-full flex items-center space-x-2 p-3 rounded-xl text-xs font-semibold bg-zinc-900 text-zinc-200 border border-zinc-800">
              <History className="w-4 h-4 text-amber-400" /><span>Audit Log</span>
            </button>
            <button onClick={() => { onExportExcel(); setMobileOpen(false); }}
              className="w-full flex items-center space-x-2 p-3 rounded-xl text-xs font-semibold bg-zinc-900 text-zinc-200 border border-zinc-800">
              <Download className="w-4 h-4 text-yellow-400" /><span>Export Excel</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
