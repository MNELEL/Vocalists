import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Tab = 'dashboard' | 'record' | 'profiles' | 'synthesis' | 'analysis' | 'settings';

interface AppState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string | null) => void;
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
  batterySaver: boolean;
  setBatterySaver: (value: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),
      selectedProfileId: null,
      setSelectedProfileId: (id) => set({ selectedProfileId: id }),
      hasSeenOnboarding: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      batterySaver: false,
      setBatterySaver: (value) => set({ batterySaver: value }),
    }),
    {
      name: 'voxclone-storage',
    }
  )
);
