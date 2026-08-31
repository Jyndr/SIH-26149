import React from 'react';
import { useAuthStore } from '../../store/authStore';

const Topbar = () => {
  const { user } = useAuthStore();

  return (
    <header className="fixed top-0 right-0 left-64 h-16 flex justify-between items-center px-lg z-30 bg-surface border-b border-outline-variant">
      <div className="flex items-center gap-xl h-full">
        <div className="flex items-center h-full space-x-md">
          <a className="text-on-surface-variant hover:text-primary transition-colors font-label-caps text-label-caps uppercase h-full flex items-center" href="#">
            Case: #4402-B
          </a>
          <a className="text-on-surface-variant hover:text-primary transition-colors font-label-caps text-label-caps uppercase h-full flex items-center" href="#">
            System: Secure
          </a>
        </div>
      </div>

      <div className="flex items-center gap-lg">
        {/* Search */}
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline-variant group-focus-within:text-primary text-[18px]">
            search
          </span>
          <input
            className="bg-surface-container-low border border-outline-variant rounded-full py-1 pl-xl pr-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 transition-all focus:shadow-glow-focus font-code-md text-code-md"
            placeholder="Search parameters..."
            type="text"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-sm">
          <button className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors">
            <span className="material-symbols-outlined">security</span>
          </button>
          <button className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors">
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded border border-outline-variant bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[16px]">person</span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
