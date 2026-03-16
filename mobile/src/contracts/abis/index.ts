export const POSITION_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getPosition',
    stateMutability: 'view',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'trader',           type: 'address' },
          { name: 'isLong',           type: 'bool'    },
          { name: 'size',             type: 'uint256' },
          { name: 'margin',           type: 'uint256' },
          { name: 'entryPrice',       type: 'uint256' },
          { name: 'leverage',         type: 'uint256' },
          { name: 'lastFundingIndex', type: 'uint256' },
          { name: 'openedAt',         type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'hasOpenPosition',
    stateMutability: 'view',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const FUNDING_RATE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'longCumulativeIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shortCumulativeIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'currentFundingRate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'int256' }],
  },
  {
    type: 'function',
    name: 'lastFundingTime',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'fundingEpoch',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;
