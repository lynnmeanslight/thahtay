import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from '@wagmi/core';
import { PrivyProvider } from '@privy-io/expo';

// ─── Chain definitions ────────────────────────────────────────────────────────
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://base-sepolia.drpc.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
});

export const baseMainnet = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
});

// ─── Wagmi config ─────────────────────────────────────────────────────────────
export const wagmiConfig = createConfig({
  chains: [baseSepolia, baseMainnet],
  connectors: [
    injected(), // MetaMask mobile browser
  ],
  transports: {
    [baseSepolia.id]: http('https://base-sepolia.drpc.org'),
    [baseMainnet.id]: http('https://mainnet.base.org'),
  },
});

// ─── TanStack Query client ────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5_000,
    },
  },
});

// ─── Combined provider ────────────────────────────────────────────────────────
interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '';
  const privyClientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

  return (
    <PrivyProvider appId={privyAppId} clientId={privyClientId}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
