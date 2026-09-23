import React, { useState } from 'react';
import type { ViewMode } from '../types';
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
  /** When true, sidebar shows as icon-only narrow strip (projector mode) */
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenSquadAnalysis,
  onOpenAuditLog,
  onExportExcel,
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
      <aside className="hidden md:flex flex-col w-16 fixed top-0 left-0 bottom-0 z-40 bg-[#0d121f]/90 border-r border-gray-800/60 items-center py-4 space-y-3 shadow-lg">
        {/* ACC Logo */}
        <div
          onClick={() => handleNav('public')}
          className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-pink-600 to-amber-500 flex items-center justify-center font-black text-white text-[10px] shadow-md cursor-pointer mb-2"
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
                  ? 'bg-gradient-to-br from-indigo-600 to-pink-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
            </button>
          );
        })}

        <div className="mt-auto space-y-2">
          <button onClick={onOpenSquadAnalysis} title="Squad Analysis"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-400 hover:bg-gray-800 transition">
            <BarChart3 className="w-4 h-4" />
          </button>
          <button onClick={onOpenAuditLog} title="Audit Log"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-purple-400 hover:bg-gray-800 transition">
            <History className="w-4 h-4" />
          </button>
          <button onClick={onExportExcel} title="Export Excel"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-amber-400 hover:bg-gray-800 transition">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  /* ── Full expanded sidebar ── */
  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-50 bg-[#0d121f]/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNav('public')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-pink-600 to-amber-500 flex items-center justify-center font-black text-white text-sm shadow-md">
            ACC
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Avanthi Carnival</h1>
            <p className="text-[10px] text-indigo-400 font-medium">Auction Portal 2026–27</p>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="px-3 py-1.5 rounded-xl bg-gray-800/80 text-gray-200 hover:text-white border border-gray-700 text-xs font-bold"
        >
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed top-0 left-0 bottom-0 z-40 bg-[#0d121f] border-r border-gray-800/80 text-gray-200 shadow-2xl">
        {/* Logo */}
        <div className="p-5 border-b border-gray-800/60">
          <div onClick={() => handleNav('public')} className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-pink-600 to-amber-500 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
              ACC
            </div>
            <div>
              <h1 className="text-base font-black text-white tracking-tight group-hover:text-pink-400 transition-colors">
                Avanthi Carnival
              </h1>
              <p className="text-[11px] text-indigo-400 font-medium">Auction Portal 2026–27</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Navigation</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 font-bold'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Utilities */}
        <div className="p-4 border-t border-gray-800/60 space-y-2 bg-gray-950/40">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Quick Actions</p>

          <button onClick={onOpenSquadAnalysis}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/60 transition">
            <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Squad Analysis</span>
          </button>

          <button onClick={onOpenAuditLog}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium bg-purple-950/40 text-purple-300 border border-purple-800/50 hover:bg-purple-900/60 transition">
            <History className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Audit Log</span>
          </button>

          <button onClick={onExportExcel}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/60 transition">
            <Download className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Export Excel</span>
          </button>

          <div className="pt-1 text-center text-[10px] text-gray-500">
            <span className="inline-flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-pink-400" />
              <span>Insta UI &bull; ACC 2026</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/85 backdrop-blur-sm pt-16 px-4 pb-6 overflow-y-auto space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button key={item.id} onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl font-bold text-sm ${
                  isActive ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white' : 'bg-gray-900/80 text-gray-300 border border-gray-800'
                }`}>
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.badge && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">{item.badge}</span>}
              </button>
            );
          })}

          <div className="pt-4 border-t border-gray-800 space-y-2">
            <button onClick={() => { onOpenSquadAnalysis(); setMobileOpen(false); }}
              className="w-full flex items-center space-x-2 p-3 rounded-xl text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              <BarChart3 className="w-4 h-4" /><span>Squad Analysis</span>
            </button>
            <button onClick={() => { onOpenAuditLog(); setMobileOpen(false); }}
              className="w-full flex items-center space-x-2 p-3 rounded-xl text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800">
              <History className="w-4 h-4" /><span>Audit Log</span>
            </button>
            <button onClick={() => { onExportExcel(); setMobileOpen(false); }}
              className="w-full flex items-center space-x-2 p-3 rounded-xl text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
              <Download className="w-4 h-4" /><span>Export Excel</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
