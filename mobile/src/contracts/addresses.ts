// Contract addresses per chain
// Fill in after deployment

export const ADDRESSES = {
  // Unichain Sepolia (chainId: 1301)
  unichainSepolia: {
    thaHtayHook:        '0xeb5851c6014C5a5F5A062C1331826b0789C3F0C0' as `0x${string}`,
    positionManager:    '0x2071faEe2ee61fb5a295BF03a1D51f26D2F9FaBD' as `0x${string}`,
    fundingRateManager: '0x723Bb79a7951415563129eE3583e573432aD6Fda' as `0x${string}`,
    liquidationEngine:  '0x4503A9d28Dc625676e327184Ea76c654Dd657419' as `0x${string}`,
    usdc:               '0x31d0220469e10c4E71834a79b1f276d740d3768F' as `0x${string}`,
    poolManager:        '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as `0x${string}`,
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

// Unichain chain definitions for wagmi/viem
import { defineChain } from 'viem';

export const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://unichain-sepolia.g.alchemy.com/v2/YMzKKvdFJU9ZBB0r2yGuo'] },
    public:  { http: ['https://unichain-sepolia.g.alchemy.com/v2/YMzKKvdFJU9ZBB0r2yGuo'] },
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
