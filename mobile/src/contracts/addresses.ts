// Contract addresses per chain
// Fill in after deployment

export const ADDRESSES = {
  // Unichain Sepolia (chainId: 1301)
  unichainSepolia: {
    thaHtayHook:        '0xAB307e812680b93E32BF23126e8a11924ea2B0C0' as `0x${string}`,
    positionManager:    '0x8d1D1bf157477B95cee7Ba54E2DF585ecd970019' as `0x${string}`,
    fundingRateManager: '0xC73D840622Dc2eA97f7fd981Ea4Ce8b88617Bf29' as `0x${string}`,
    liquidationEngine:  '0x88b11E2A5194F42D26D68f3Fe78436b99524922c' as `0x${string}`,
    usdc:               '0x631FEDecA55Aa01aD5844E94ecB604caF29bfdb4' as `0x${string}`,
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
