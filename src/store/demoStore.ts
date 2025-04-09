import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Demo, DemoSession } from '@/types';

interface DemoStore {
  demos: Demo[];
  currentSession: DemoSession | null;
  debugMode: boolean;
  setDemos: (demos: Demo[]) => void;
  addDemo: (demo: Demo) => void;
  setCurrentSession: (session: DemoSession | null) => void;
  toggleDebugMode: () => void;
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set) => ({
      demos: [],
      currentSession: null,
      debugMode: false,
      setDemos: (demos) => set({ demos }),
      addDemo: (demo) => set((state) => ({ demos: [...state.demos, demo] })),
      setCurrentSession: (session) => set({ currentSession: session }),
      toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
    }),
    {
      name: 'demo-store',
    }
  )
); 