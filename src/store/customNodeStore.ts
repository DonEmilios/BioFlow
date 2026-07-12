import { create } from "zustand";
import { NodeRegistryEntry } from "@/lib/nodeRegistry";
import { fetchCustomNodes } from "@/lib/customNodeApi";

interface CustomNodeState {
  customNodes: NodeRegistryEntry[];
  loaded: boolean;
  refresh: () => Promise<void>;
  addCustomNode: (node: NodeRegistryEntry) => void;
}

export const useCustomNodeStore = create<CustomNodeState>((set, get) => ({
  customNodes: [],
  loaded: false,

  refresh: async () => {
    const customNodes = await fetchCustomNodes();
    set({ customNodes, loaded: true });
  },

  addCustomNode: (node) =>
    set({ customNodes: [...get().customNodes.filter((n) => n.id !== node.id), node] }),
}));
