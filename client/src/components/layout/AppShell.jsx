import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const AppShell = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#0F0F10]">
      <Sidebar />
      <Topbar />
      <main className="ml-64 pt-16 min-h-screen p-lg">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
