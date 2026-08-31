import React from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const params = useParams();
  const caseMatch = location.pathname.match(/^\/cases\/([^/]+)/);
  const caseId = params.caseId || caseMatch?.[1];

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: 'dashboard'
    },
    { 
      path: '/cases', 
      label: 'Cases', 
      icon: 'folder_managed'
    },
    { 
      path: `/cases/${caseId}/evidence` || '#', 
      label: 'Evidence', 
      icon: 'analytics'
    },
    { 
      path: `/cases/${caseId}/jobs` || '#', 
      label: 'Jobs', 
      icon: 'assignment_turned_in'
    },
    { 
      path: `/cases/${caseId}/sanitize` || '#', 
      label: 'Sanitization', 
      icon: 'security'
    },
    { 
      path: `/cases/${caseId}/audit` || '#', 
      label: 'Audit', 
      icon: 'history_edu'
    },
    { 
      path: `/cases/${caseId}/reports` || '#', 
      label: 'Reports', 
      icon: 'assessment'
    },
  ];

  return (
    <nav className="fixed left-0 top-0 h-full flex flex-col z-40 w-64 bg-surface border-r border-outline-variant">
      {/* Logo & Brand */}
      <div className="p-lg border-b border-outline-variant">
        <div className="flex items-center gap-md">
          <div className="w-10 h-10 rounded-full border border-outline-variant bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">shield</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md font-bold text-primary">ForensicGuard</h1>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-1">Lead Analyst</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-md">
        <ul className="flex flex-col space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-md px-md py-sm transition-all duration-150 ${
                    isActive
                      ? 'text-primary bg-primary-container/10 border-r-2 border-primary opacity-90'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`
                }
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-label-caps text-label-caps uppercase">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer Actions */}
      <div className="p-md border-t border-outline-variant">
        <button className="w-full flex items-center justify-center gap-sm py-sm border border-error text-error rounded hover:bg-error/10 transition-colors font-label-caps text-label-caps uppercase">
          <span className="material-symbols-outlined text-[16px]">warning</span>
          Sanitize Disk
        </button>
        <ul className="flex flex-col space-y-1 mt-md">
          <li>
            <a className="flex items-center gap-md px-md py-sm text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
              <span className="material-symbols-outlined">settings</span>
              <span className="font-label-caps text-label-caps uppercase">Settings</span>
            </a>
          </li>
          <li>
            <a className="flex items-center gap-md px-md py-sm text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
              <span className="material-symbols-outlined">logout</span>
              <span className="font-label-caps text-label-caps uppercase">Logout</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Sidebar;
