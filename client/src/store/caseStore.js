import { create } from 'zustand';

const useCaseStore = create((set) => ({
  currentCase: null,
  setCurrentCase: (caseData) => set({ currentCase: caseData }),
  clearCurrentCase: () => set({ currentCase: null }),
}));

export default useCaseStore;
