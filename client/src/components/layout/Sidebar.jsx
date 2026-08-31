import React from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';
import { 
  FolderOpen, 
  FileText, 
  Shield, 
  BarChart3,
  Activity,
  Settings,
  LayoutDashboard
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const params = useParams();
  const caseMatch = location.pathname.match(/^\/cases\/([^/]+)/);
  const caseId = params.caseId || caseMatch?.[1];

  const navItems = [
    { 
      path: '/cases', 
      label: 'Cases', 
      icon: FolderOpen
    },
  ];

  const caseItems = caseId
    ? [
        { 
          path: `/cases/${caseId}`, 
          label: 'Overview', 
          icon: LayoutDashboard
        },
        { 
          path: `/cases/${caseId}/evidence`, 
          label: 'Evidence', 
          icon: FileText
        },
        { 
          path: `/cases/${caseId}/jobs`, 
          label: 'Jobs', 
          icon: Activity
        },
        { 
          path: `/cases/${caseId}/sanitize`, 
          label: 'Sanitization', 
          icon: Shield
        },
        { 
          path: `/cases/${caseId}/audit`, 
          label: 'Audit Trail', 
          icon: Settings
        },
        { 
          path: `/cases/${caseId}/reports`, 
          label: 'Reports', 
          icon: BarChart3
        },
      ]
    : [];

  return (
    <aside className="w-72 min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 border-r border-slate-800 shadow-2xl">
      {/* Logo & Brand */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Jyndr</h1>
            <p className="text-xs text-slate-400">Digital Forensics</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">
          Main Menu
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === `/cases/${caseId}` || item.path === '/cases'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {caseItems.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3 mt-6">
              Case Actions
            </p>
            {caseItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900/50 backdrop-blur-sm border-t border-slate-800">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span>All systems operational</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
