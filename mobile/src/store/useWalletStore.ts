import { create } from 'zustand';

interface WalletState {
  address: `0x${string}` | null;
  chainId: number | null;
  usdcBalance: bigint;   // USDC balance (6 decimals)
  ethBalance: bigint;    // ETH balance (18 decimals)
  isConnected: boolean;

  setAddress:     (address: `0x${string}` | null) => void;
  setChainId:     (chainId: number | null) => void;
  setUsdcBalance: (balance: bigint) => void;
  setEthBalance:  (balance: bigint) => void;
  setConnected:   (connected: boolean) => void;
  disconnect:     () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  chainId: null,
  usdcBalance: 0n,
  ethBalance: 0n,
  isConnected: false,

  setAddress:     (address)   => set({ address,    isConnected: address !== null }),
  setChainId:     (chainId)   => set({ chainId }),
  setUsdcBalance: (balance)   => set({ usdcBalance: balance }),
  setEthBalance:  (balance)   => set({ ethBalance: balance }),
  setConnected:   (connected) => set({ isConnected: connected }),
  disconnect: () => set({
    address: null,
    chainId: null,
    usdcBalance: 0n,
    ethBalance: 0n,
    isConnected: false,
  }),
}));
