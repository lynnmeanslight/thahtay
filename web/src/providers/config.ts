import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { QueryClient } from '@tanstack/react-query';
import { unichainSepolia, unichainMainnet } from '../contracts/addresses';

export { unichainSepolia, unichainMainnet };

export const wagmiConfig = createConfig({
  chains: [unichainSepolia, unichainMainnet],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
  ],
  transports: {
    [unichainSepolia.id]: http(),
    [unichainMainnet.id]: http(),
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 2,
    },
  },
});
