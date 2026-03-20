import { useCallback, useState } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { readContract, waitForTransactionReceipt, getTransactionCount } from '@wagmi/core';
import { maxUint256 } from 'viem';
import { THAHTAYHOOK_ABI } from '../contracts/abis/ThaHtayHook';
import { ERC20_ABI } from '../contracts/abis/index';
import { ADDRESSES, unichainSepolia } from '../contracts/addresses';
import { useQueryClient } from '@tanstack/react-query';
import { wagmiConfig } from '../providers/config';

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
  const queryClient = useQueryClient();
  const addresses = ADDRESSES.unichainSepolia;
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

  // Read the contract's actual USDC balance — can diverge from collateralBalance
  // if protocol fees were collected via withdrawFees() or the contract is underfunded.
  const { data: contractUsdcBalance = 0n } = useReadContract({
    address: addresses.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [addresses.thaHtayHook],
    query: { enabled: !!address },
  });

  // The effective withdrawable amount is the minimum of what the user is owed
  // and what the contract can actually pay out.
  const withdrawableBalance = collateralBalance < contractUsdcBalance
    ? (collateralBalance as bigint)
    : (contractUsdcBalance as bigint);

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

      let nonce: number | undefined;
      if (allowance < amount) {
        const approveTx = await writeContractAsync({
          address: addresses.usdc,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [addresses.thaHtayHook, maxUint256],
          chainId: unichainSepolia.id,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx });
        // After the approval confirms, MetaMask's nonce cache may be stale.
        // Fetch the current pending nonce so depositCollateral gets the right one.
        nonce = await getTransactionCount(wagmiConfig, { address: address!, blockTag: 'pending' });
      }

      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'depositCollateral',
        args: [amount],
        chainId: unichainSepolia.id,
        ...(nonce !== undefined ? { nonce } : {}),
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
    const capped = amount > (withdrawableBalance as bigint) ? (withdrawableBalance as bigint) : amount;
    if (capped === 0n) throw new Error('Nothing available to withdraw right now');
    setStatus({ ...DEFAULT_STATUS, isLoading: true });
    try {
      const txHash = await writeContractAsync({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'withdrawCollateral',
        args: [capped],
        chainId: unichainSepolia.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      setStatus({ isLoading: false, isSuccess: true, error: null, txHash });
      queryClient.invalidateQueries({ queryKey: ['collateralBalance', address] });
      void refetchBalance();
    } catch (e: unknown) {
      setStatus({ isLoading: false, isSuccess: false, error: e as Error, txHash: undefined });
      throw e;
    }
  }, [address, addresses, withdrawableBalance, writeContractAsync, queryClient, refetchBalance]);

  const isUnderfunded = (collateralBalance as bigint) > (contractUsdcBalance as bigint);

  return { collateralBalance: collateralBalance as bigint, withdrawableBalance: withdrawableBalance as bigint, isUnderfunded, deposit, withdraw, status, resetStatus };
}
