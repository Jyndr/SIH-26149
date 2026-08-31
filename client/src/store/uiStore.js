import { create } from 'zustand';

let toastId = 0;

const useUIStore = create((set) => ({
  toasts: [],
  pushToast: (type, message) => {
    const id = ++toastId;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export { useUIStore };
export default useUIStore;
