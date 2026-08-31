import React from 'react';
import { useAuthStore } from '../../store/authStore';

const Topbar = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{user?.name || 'User'}</span>
          <span className="text-gray-400 ml-2">({user?.role || 'INVESTIGATOR'})</span>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Topbar;
