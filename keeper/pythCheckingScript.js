import {createPublicClient,http,parseAbi} from 'viem';
import * as dotenv from 'dotenv';
dotenv.config({path:'.env'});

const client = createPublicClient({transport:http(process.env.RPC_URL)});
const hook = process.env.HOOK_ADDRESS;

const abi = parseAbi(['function pythOracle() view returns (address)', 'function pythPriceId() view returns (bytes32)', 'function pythMaxAge() view returns (uint256)']);

const oracle = await client.readContract({address: hook, abi, functionName: 'pythOracle'});
const priceId = await client.readContract({address: hook, abi, functionName: 'pythPriceId'});
const maxAge = await client.readContract({address: hook, abi, functionName: 'pythMaxAge'});

console.log('Pyth Oracle:', oracle);
console.log('Price ID:', priceId);
console.log('Max Age (seconds):', maxAge.toString());