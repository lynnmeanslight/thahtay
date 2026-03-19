export const THAHTAYHOOK_ABI = [
  // ─── Open Position ────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'openPosition',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'isLong',   type: 'bool'    },
      { name: 'size',     type: 'uint256' },
      { name: 'leverage', type: 'uint256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [],
  },
  // ─── Close Position ───────────────────────────────────────────────────
  {
    type: 'function',
    name: 'closePosition',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // ─── Add Margin ───────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'addMargin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  // ─── Remove Margin ────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'removeMargin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  // ─── Liquidate ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'liquidate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [],
  },
  // ─── Views ────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getSpotPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getUnrealizedPnl',
    stateMutability: 'view',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [{ name: '', type: 'int256' }],
  },
  {
    type: 'function',
    name: 'getLiquidationPrice',
    stateMutability: 'view',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'protocolFees',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ─── Events ───────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'PositionOpened',
    inputs: [
      { name: 'trader',           type: 'address', indexed: true  },
      { name: 'isLong',           type: 'bool',    indexed: true  },
      { name: 'size',             type: 'uint256', indexed: false },
      { name: 'margin',           type: 'uint256', indexed: false },
      { name: 'entryPrice',       type: 'uint256', indexed: false },
      { name: 'leverage',         type: 'uint256', indexed: false },
      { name: 'liquidationPrice', type: 'uint256', indexed: false },
      { name: 'referrer',         type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PositionClosed',
    inputs: [
      { name: 'trader',      type: 'address', indexed: true  },
      { name: 'exitPrice',   type: 'uint256', indexed: false },
      { name: 'realizedPnl', type: 'int256',  indexed: false },
      { name: 'fundingPaid', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MarginAdded',
    inputs: [
      { name: 'trader', type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MarginRemoved',
    inputs: [
      { name: 'trader', type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Liquidated',
    inputs: [
      { name: 'trader',            type: 'address', indexed: true  },
      { name: 'liquidator',        type: 'address', indexed: true  },
      { name: 'liquidationPrice',  type: 'uint256', indexed: false },
      { name: 'bonus',             type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FundingUpdated',
    inputs: [
      { name: 'fundingRate',           type: 'int256',  indexed: false },
      { name: 'longCumulativeIndex',   type: 'uint256', indexed: false },
      { name: 'shortCumulativeIndex',  type: 'uint256', indexed: false },
    ],
  },
  // ─── Deposit / Withdraw Collateral ────────────────────────────────────
  {
    type: 'function',
    name: 'depositCollateral',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawCollateral',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'collateralBalance',
    stateMutability: 'view',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'CollateralDeposited',
    inputs: [
      { name: 'trader', type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CollateralWithdrawn',
    inputs: [
      { name: 'trader', type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
