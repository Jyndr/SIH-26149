import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  FolderKanban, 
  FileText, 
  History, 
  LayoutDashboard, 
  LogOut, 
  Shield, 
  User, 
  Terminal,
  Eraser
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/cases', label: 'Case Management', icon: FolderKanban },
    { to: '/audit', label: 'Audit Chain of Custody', icon: History },
    { to: '/reports', label: 'Forensic Reports', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-[#080e1c] border-r border-slate-800 flex flex-col flex-shrink-0 select-none z-20">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/90 bg-[#060a15]/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wider text-slate-100 uppercase font-mono">Jyndr</span>
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-1 py-0.2 rounded font-mono font-bold">2.0</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight">FORENSIC SUITE // SIH-26149</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Core Operations
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <div className="pt-5 px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Workflows
        </div>

        <div className="px-3 py-2 text-xs text-slate-400 bg-slate-900/40 border border-slate-800/60 rounded">
          <div className="flex items-center gap-2 text-slate-300 mb-1 font-mono text-[11px]">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Active Pipeline</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Select or create a case to initiate Recovery or Sanitization operations.
          </p>
        </div>
      </div>

      {/* Operator Footer */}
      <div className="p-3 border-t border-slate-800/90 bg-[#060a15]/90">
        <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 flex-shrink-0 font-mono text-xs font-bold">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AK'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate font-mono">
                {user?.name || 'Analyst Akshat'}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {user?.role || 'INVESTIGATOR'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Terminate Session"
            className="text-slate-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
