// Contract addresses per chain
// Fill in after deployment

export const ADDRESSES = {
  // Unichain Sepolia (chainId: 1301)
  unichainSepolia: {
    thaHtayHook:        '0xab307e812680b93e32bf23126e8a11924ea2b0c0' as `0x${string}`,
    positionManager:    '0x8d1d1bf157477b95cee7ba54e2df585ecd970019' as `0x${string}`,
    fundingRateManager: '0xc73d840622dc2ea97f7fd981ea4ce8b88617bf29' as `0x${string}`,
    liquidationEngine:  '0x88b11e2a5194f42d26d68f3fe78436b99524922c' as `0x${string}`,
    usdc:               '0x631fedeca55aa01ad5844e94ecb604caf29bfdb4' as `0x${string}`,
    poolManager:        '0x00b036b58a818b1bc34d502d3fe730db729e62ac' as `0x${string}`,
  },
  // Unichain Mainnet (chainId: 130)
  unichainMainnet: {
    thaHtayHook:        '0x0000000000000000000000000000000000000000' as `0x${string}`,
    positionManager:    '0x0000000000000000000000000000000000000000' as `0x${string}`,
    fundingRateManager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    liquidationEngine:  '0x0000000000000000000000000000000000000000' as `0x${string}`,
    usdc:               '0x0000000000000000000000000000000000000000' as `0x${string}`,
    poolManager:        '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
} as const;

// Base chain definitions for wagmi/viem
import { defineChain } from 'viem';

export const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
    public:  { http: ['https://sepolia.unichain.org'] },
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
    public:  { http: ['https://mainnet.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://uniscan.xyz' },
  },
});

export const SUPPORTED_CHAINS = [unichainSepolia, unichainMainnet] as const;
export const DEFAULT_CHAIN = unichainSepolia;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id'];

export function getAddresses(chainId: SupportedChainId) {
  if (chainId === 1301) return ADDRESSES.unichainSepolia;
  if (chainId === 130)  return ADDRESSES.unichainMainnet;
  return ADDRESSES.unichainSepolia;
}
