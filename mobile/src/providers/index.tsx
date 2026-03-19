import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from '@wagmi/core';
import { PrivyProvider } from '@privy-io/expo';

// ─── Chain definitions ────────────────────────────────────────────────────────
export const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://sepolia.uniscan.xyz' },
  },
  testnet: true,
});

export const unichainMainnet = defineChain({
  id: 130,
  name: 'Unichain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://uniscan.xyz' },
  },
});

// ─── Wagmi config ─────────────────────────────────────────────────────────────
export const wagmiConfig = createConfig({
  chains: [unichainSepolia, unichainMainnet],
  connectors: [
    injected(), // MetaMask mobile browser
  ],
  transports: {
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
    [unichainMainnet.id]: http('https://mainnet.unichain.org'),
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
