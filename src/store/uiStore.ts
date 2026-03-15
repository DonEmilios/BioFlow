import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  configPanelOpen: boolean;
  sidebarSearchQuery: string;
  toggleSidebar: () => void;
  setConfigPanelOpen: (open: boolean) => void;
  setSidebarSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  configPanelOpen: false,
  sidebarSearchQuery: "",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
  setSidebarSearchQuery: (query) => set({ sidebarSearchQuery: query }),
}));
