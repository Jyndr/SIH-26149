import React from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const params = useParams();
  const caseMatch = location.pathname.match(/^\/cases\/([^/]+)/);
  const caseId = params.caseId || caseMatch?.[1];

  const navItems = [
    { 
      path: '/cases', 
      label: 'Cases', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    },
  ];

  const caseItems = caseId
    ? [
        { 
          path: `/cases/${caseId}`, 
          label: 'Overview', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        },
        { 
          path: `/cases/${caseId}/sanitize`, 
          label: 'Sanitization', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )
        },
        { 
          path: `/cases/${caseId}/audit`, 
          label: 'Audit Trail', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        },
        { 
          path: `/cases/${caseId}/reports`, 
          label: 'Reports', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        },
      ]
    : [];

  return (
    <aside className="w-72 min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 border-r border-gray-800 shadow-2xl">
      {/* Logo & Brand */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Jyndr</h1>
            <p className="text-xs text-gray-400">Digital Forensics</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">
          Main Menu
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === `/cases/${caseId}` || item.path === '/cases'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/50' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-indigo-400'}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {caseItems.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mt-6 mb-3">
              Case Actions
            </p>
            {caseItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === `/cases/${caseId}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/50' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-indigo-400'}>
                      {item.icon}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-900/50 backdrop-blur-sm border-t border-gray-800">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span>All systems operational</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
