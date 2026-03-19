import {createWalletClient,http,parseAbi} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import * as dotenv from 'dotenv';
dotenv.config({path:'.env'});

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const client = createWalletClient({account,transport:http(process.env.RPC_URL)});
const hook = process.env.HOOK_ADDRESS;

// Pyth oracle on Base Sepolia
const pythOracle = '0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a'; // Pyth Price Feeds
// ETH/USD price ID
const pythPriceId = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
// Max age: 60 minutes
const maxAge = 3600;

const abi = parseAbi(['function setPythConfig(address oracle, bytes32 priceId, uint256 maxAge) external']);

const hash = await client.writeContract({
  address: hook,
  abi,
  functionName: 'setPythConfig',
  args: [pythOracle, pythPriceId, maxAge]
});

console.log('tx:', hash);