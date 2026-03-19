import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { QueryClient } from '@tanstack/react-query';
import { baseSepolia, baseMainnet } from '../contracts/addresses';

export { baseSepolia, baseMainnet };

export const wagmiConfig = createConfig({
  chains: [baseSepolia, baseMainnet],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [baseMainnet.id]: http(),
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
