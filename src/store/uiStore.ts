import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  configPanelOpen: boolean;
  terminalOpen: boolean;
  sidebarSearchQuery: string;
  toggleSidebar: () => void;
  setConfigPanelOpen: (open: boolean) => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  setSidebarSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  configPanelOpen: false,
  terminalOpen: true,
  sidebarSearchQuery: "",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setSidebarSearchQuery: (query) => set({ sidebarSearchQuery: query }),
}));
