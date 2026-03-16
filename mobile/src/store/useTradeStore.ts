import { create } from 'zustand';

export type Side = 'long' | 'short';

interface TradeState {
  side: Side;
  sizeInput: string;   // Raw string for input field
  leverageInput: number; // 1–10
  referrer: `0x${string}` | null;

  setSide: (side: Side) => void;
  setSizeInput: (value: string) => void;
  setLeverageInput: (value: number) => void;
  setReferrer: (address: `0x${string}` | null) => void;
  reset: () => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  side: 'long',
  sizeInput: '',
  leverageInput: 5,
  referrer: null,

  setSide:         (side)    => set({ side }),
  setSizeInput:    (value)   => set({ sizeInput: value }),
  setLeverageInput:(value)   => set({ leverageInput: value }),
  setReferrer:     (address) => set({ referrer: address }),
  reset: () => set({ sizeInput: '', leverageInput: 5, side: 'long' }),
}));
