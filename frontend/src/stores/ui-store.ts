import { create } from "zustand";

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 560;
const DEFAULT_SIDEBAR_WIDTH = 400;

export interface UIState {
  selectedTaskId: number | null;
  setSelectedTaskId: (id: number | null) => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  resizeSidebar: (clientX: number) => void;
  addressErrorOpen: boolean;
  setAddressErrorOpen: (open: boolean) => void;
  pageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  setSidebarWidth: (w) =>
    set({ sidebarWidth: Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, w)) }),
  resizeSidebar: (clientX) => {
    const newWidth = typeof window !== "undefined" ? window.innerWidth - clientX : DEFAULT_SIDEBAR_WIDTH;
    set({
      sidebarWidth: Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth)),
    });
  },
  addressErrorOpen: false,
  setAddressErrorOpen: (open) => set({ addressErrorOpen: open }),
  pageLoading: true,
  setPageLoading: (loading) => set({ pageLoading: loading }),
}));
