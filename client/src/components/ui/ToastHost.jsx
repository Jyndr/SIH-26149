import React from 'react';
import Toast from './Toast';
import useUIStore from '../../store/uiStore';

const ToastHost = () => {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="relative">
          <Toast message={toast.message} type={toast.type} onClose={() => dismissToast(toast.id)} />
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
