import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { QueryClient } from '@tanstack/react-query';
import { unichainSepolia } from '../contracts/addresses';

export { unichainSepolia };

export const wagmiConfig = createConfig({
  chains: [unichainSepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
  ],
  transports: {
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
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
