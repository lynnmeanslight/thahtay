import { useCallback, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { maxUint256 } from 'viem';
import { useChainId } from 'wagmi';
import { THAHTAYHOOK_ABI } from '../contracts/abis/ThaHtayHook';
import { ERC20_ABI } from '../contracts/abis/index';
import { getAddresses } from '../contracts/addresses';
import { useQueryClient } from '@tanstack/react-query';
import { wagmiConfig } from '../providers';

export type TradeAction = 'open' | 'close' | 'addMargin' | 'removeMargin' | 'liquidate';

interface TxStatus {
  isLoading: boolean;
  isSuccess: boolean;
  error: Error | null;
  txHash: `0x${string}` | undefined;
}

const DEFAULT_STATUS: TxStatus = {
  isLoading: false,
  isSuccess: false,
  error: null,
  txHash: undefined,
};

/**
 * Hook that wraps all ThaHtayHook write operations.
 * Handles USDC approval flow automatically before openPosition / addMargin.
 */
export function useTrade() {
  const { address } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const addresses = getAddresses(chainId as 1301 | 130);

  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<TxStatus>(DEFAULT_STATUS);

  const resetStatus = () => setStatus(DEFAULT_STATUS);

  const ensureApproval = useCallback(async (amount: bigint) => {
    // Check current allowance via wagmi config
    const allowance = await readContract(wagmiConfig, {
      address: addresses.usdc,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, addresses.thaHtayHook],
    }) as bigint;

    if (allowance >= amount) return; // Already approved

    // Approve max to avoid repeated approvals
    const approveTx = await writeContractAsync({
      address: addresses.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [addresses.thaHtayHook, maxUint256],
    });
    // Wait for approval to be confirmed before proceeding — otherwise gas
    // estimation for the next call sees allowance=0 and reverts.
    await waitForTransactionReceipt(wagmiConfig, { hash: approveTx });
  }, [address, addresses, writeContractAsync]);

  const openPosition = useCallback(async (
    isLong: boolean,
    sizeInternal: bigint,
    leverage: number,
    totalUsdcRequired: bigint, // 6-decimal USDC for approval
    referrer: `0x${string}` = '0x0000000000000000000000000000000000000000',
  ) => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      await ensureApproval(totalUsdcRequired);
      const sizeUsdc = sizeInternal / BigInt(10 ** 12);
      const leverageInt = BigInt(Math.max(1, Math.min(10, Math.round(leverage))));
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'openPosition',
        args: [isLong, sizeUsdc, leverageInt, referrer],
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
      queryClient.invalidateQueries({ queryKey: ['position', address] });
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, ensureApproval, writeContractAsync, queryClient]);

  const closePosition = useCallback(async () => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'closePosition',
        args: [],
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
      queryClient.invalidateQueries({ queryKey: ['position', address] });
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, writeContractAsync, queryClient]);

  const addMargin = useCallback(async (amount: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      await ensureApproval(amount);
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'addMargin',
        args: [amount],
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
      queryClient.invalidateQueries({ queryKey: ['position', address] });
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, ensureApproval, writeContractAsync, queryClient]);

  const removeMargin = useCallback(async (amount: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'removeMargin',
        args: [amount],
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
      queryClient.invalidateQueries({ queryKey: ['position', address] });
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, writeContractAsync, queryClient]);

  const liquidate = useCallback(async (trader: `0x${string}`) => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'liquidate',
        args: [trader],
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, writeContractAsync]);

  return {
    openPosition,
    closePosition,
    addMargin,
    removeMargin,
    liquidate,
    status,
    resetStatus,
  };
}
