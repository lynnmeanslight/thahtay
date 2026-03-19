// Contract addresses per chain
// Fill in after deployment

export const ADDRESSES = {
  // Base Sepolia (chainId: 84532)
  baseSepolia: {
    thaHtayHook:        '0x77167b93196ed109a91bcd0ec1cfbbee2d2c30c0' as `0x${string}`,
    positionManager:    '0x049a4783eba3f9d2ed2e7ae1cc39e6488a9477fe' as `0x${string}`,
    fundingRateManager: '0x22ae03af86dbb58f6f5e4daa4b14dd0719830856' as `0x${string}`,
    liquidationEngine:  '0xdf346a14e5878376bf8f4e300bb82ae1e8bfacb8' as `0x${string}`,
    usdc:               '0x999b01E1f0A37401b4Bc0DE63F16284Ae9296b9E' as `0x${string}`,
    poolManager:        '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as `0x${string}`,
  },
  // Base Mainnet (chainId: 8453)
  baseMainnet: {
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

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://base-sepolia.drpc.org'] },
    public:  { http: ['https://base-sepolia.drpc.org'] },
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
    public:  { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
});

export const SUPPORTED_CHAINS = [baseSepolia, baseMainnet] as const;
export const DEFAULT_CHAIN = baseSepolia;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id'];

export function getAddresses(chainId: SupportedChainId) {
  if (chainId === 84532) return ADDRESSES.baseSepolia;
  if (chainId === 8453)  return ADDRESSES.baseMainnet;
  return ADDRESSES.baseSepolia;
}
