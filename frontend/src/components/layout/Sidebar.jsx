import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  HardDrive,
  Eraser,
  FileText,
  History,
  Sparkles,
  LogOut,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections = [
    {
      title: 'MAIN',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/cases', label: 'Cases', icon: Briefcase },
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        { to: '/recovery', label: 'Evidence Recovery', icon: HardDrive },
        { to: '/sanitization', label: 'Secure Erasure', icon: Eraser },
      ]
    },
    {
      title: 'RECORDS',
      items: [
        { to: '/reports', label: 'Reports', icon: FileText },
        { to: '/audit', label: 'Audit Log', icon: History },
        { to: '/analyst', label: 'Forensic Analyst', icon: Sparkles },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 select-none z-20 shadow-sm">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-base tracking-tight text-slate-900 leading-tight">
              Cyphora
            </div>
            <p className="text-[11px] text-slate-500">Secure. Recover. Verify.</p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Operator Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs flex-shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'IN'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user?.name || 'Investigator'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {user?.role || 'INVESTIGATOR'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

