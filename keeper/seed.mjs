import { createPublicClient, createWalletClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const chain = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.unichain.org'] } },
});

const DEPLOYER = '0x3766C6dDF41a590bB68FB925594Dc8b24663C765';
const PRIVATE_KEY = '0x40fb3cdae6c7a60a9c22e03c8d6ded7e20b3ea86d210f11521e34eac28984532';

const account = privateKeyToAccount(PRIVATE_KEY);
const wallet  = createWalletClient({ account, chain, transport: http() });
const pub     = createPublicClient({ chain, transport: http() });

const USDC    = '0x31d0220469e10c4E71834a79b1f276d740d3768F';
const KEEPER  = '0xb6d76596c7D6140911c8454E1d57302796776Fc7';
const ERC20   = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
]);

// Read real balance first
const balance = await pub.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [DEPLOYER] });
console.log('USDC balance (raw):', balance.toString(), '→', (Number(balance) / 1e6).toFixed(2), 'USDC');

// Send 80% of balance to the keeper
const toSend = balance * 80n / 100n;
if (toSend === 0n) {
  console.log('No USDC to send. Get testnet USDC first.');
  process.exit(1);
}
console.log('Sending', (Number(toSend) / 1e6).toFixed(2), 'USDC to keeper...');

const hash = await wallet.writeContract({
  address: USDC, abi: ERC20, functionName: 'transfer',
  args: [KEEPER, toSend],
});
console.log('tx:', hash);
const r = await pub.waitForTransactionReceipt({ hash });
console.log('confirmed block:', r.blockNumber.toString(), '| status:', r.status);
