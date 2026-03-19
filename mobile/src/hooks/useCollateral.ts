import { useCallback, useState } from 'react';
import { useAccount, useWriteContract, useChainId, useReadContract } from 'wagmi';
import { readContract } from '@wagmi/core';
import { maxUint256 } from 'viem';
import { THAHTAYHOOK_ABI } from '../contracts/abis/ThaHtayHook';
import { ERC20_ABI } from '../contracts/abis/index';
import { getAddresses } from '../contracts/addresses';
import { useQueryClient } from '@tanstack/react-query';
import { wagmiConfig } from '../providers';

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

export function useCollateral() {
  const { address } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const addresses = getAddresses(chainId as 84532 | 8453);
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<TxStatus>(DEFAULT_STATUS);

  const resetStatus = () => setStatus(DEFAULT_STATUS);

  const { data: collateralBalance = 0n, refetch: refetchBalance } = useReadContract({
    address: addresses.thaHtayHook,
    abi: THAHTAYHOOK_ABI,
    functionName: 'collateralBalance',
    args: [address!],
    query: { enabled: !!address },
  });

  const deposit = useCallback(async (amount: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      const allowance = await readContract(wagmiConfig, {
        address: addresses.usdc,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, addresses.thaHtayHook],
      }) as bigint;

      if (allowance < amount) {
        await writeContractAsync({
          address: addresses.usdc,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [addresses.thaHtayHook, maxUint256],
        });
      }

      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'depositCollateral',
        args: [amount],
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
      queryClient.invalidateQueries({ queryKey: ['collateralBalance', address] });
      void refetchBalance();
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, writeContractAsync, queryClient, refetchBalance]);

  const withdraw = useCallback(async (amount: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'withdrawCollateral',
        args: [amount],
      });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
      queryClient.invalidateQueries({ queryKey: ['collateralBalance', address] });
      void refetchBalance();
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, writeContractAsync, queryClient, refetchBalance]);

  return { collateralBalance: collateralBalance as bigint, deposit, withdraw, status, resetStatus };
}
