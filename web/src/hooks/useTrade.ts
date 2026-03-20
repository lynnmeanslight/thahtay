import { useCallback, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt, getTransactionCount } from '@wagmi/core';
import { maxUint256 } from 'viem';
import { THAHTAYHOOK_ABI } from '../contracts/abis/ThaHtayHook';
import { ERC20_ABI } from '../contracts/abis/index';
import { ADDRESSES, unichainSepolia } from '../contracts/addresses';
import { useQueryClient } from '@tanstack/react-query';
import { wagmiConfig } from '../providers/config';

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

export function useTrade() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = ADDRESSES.unichainSepolia;
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<TxStatus>(DEFAULT_STATUS);

  const resetStatus = () => setStatus(DEFAULT_STATUS);

  // Returns true if an approval tx was sent (so callers can refresh the nonce).
  const ensureApproval = useCallback(async (amount: bigint): Promise<boolean> => {
    const allowance = await readContract(wagmiConfig, {
      address: addresses.usdc,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, addresses.thaHtayHook],
    }) as bigint;

    if (allowance >= amount) return false;

    const approveTx = await writeContractAsync({
      address: addresses.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [addresses.thaHtayHook, maxUint256],
      chainId: unichainSepolia.id,
    });
    // Wait for approval to be confirmed before proceeding — otherwise gas
    // estimation for the next call sees allowance=0 and reverts.
    await waitForTransactionReceipt(wagmiConfig, { hash: approveTx });
    return true;
  }, [address, addresses, writeContractAsync]);

  const openPosition = useCallback(async (
    isLong: boolean,
    sizeInternal: bigint,
    leverage: number,
    totalUsdcRequired: bigint,
    referrer: `0x${string}` = '0x0000000000000000000000000000000000000000',
  ) => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      const approved = await ensureApproval(totalUsdcRequired);
      // If an approval was just confirmed, MetaMask's nonce cache may be stale
      // (still pointing at the approve's nonce). Fetch the current pending nonce
      // explicitly so the openPosition tx gets the correct next nonce.
      const nonce = approved
        ? await getTransactionCount(wagmiConfig, { address: address!, blockTag: 'pending' })
        : undefined;
      // Contract expects size in USDC 6-decimal units; sizeInternal is 18-decimal internal.
      const sizeUsdc = sizeInternal / BigInt(10 ** 12);
      const leverageInt = Math.max(1, Math.min(10, Math.round(leverage)));
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'openPosition',
        args: [isLong, sizeUsdc, BigInt(leverageInt), referrer],
        chainId: unichainSepolia.id,
        ...(nonce !== undefined ? { nonce } : {}),
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
        chainId: unichainSepolia.id,
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
      const approved = await ensureApproval(amount);
      const nonce = approved
        ? await getTransactionCount(wagmiConfig, { address: address!, blockTag: 'pending' })
        : undefined;
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'addMargin',
        args: [amount],
        chainId: unichainSepolia.id,
        ...(nonce !== undefined ? { nonce } : {}),
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
        chainId: unichainSepolia.id,
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
        chainId: unichainSepolia.id,
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, writeContractAsync]);

  return { openPosition, closePosition, addMargin, removeMargin, liquidate, status, resetStatus };
}
