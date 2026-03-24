import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useState } from 'react';
import { USDC_FAUCET_ABI } from '../contracts/abis/index';
import { ADDRESSES, unichainSepolia } from '../contracts/addresses';
import { wagmiConfig } from '../providers/config';
import { colors } from '../theme/colors';

export function FaucetPage() {
  const { address, isConnected } = useAccount();
  const addresses = ADDRESSES.unichainSepolia;
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const { data: hasClaimed, refetch: refetchClaimed } = useReadContract({
    address: addresses.usdcFaucet,
    abi: USDC_FAUCET_ABI,
    functionName: 'hasClaimed',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: faucetBalance, refetch: refetchBalance } = useReadContract({
    address: addresses.usdcFaucet,
    abi: USDC_FAUCET_ABI,
    functionName: 'faucetBalance',
    query: { refetchInterval: 15_000 },
  });

  const balanceDisplay = faucetBalance != null
    ? (Number(faucetBalance as bigint) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })
    : '—';

  const handleClaim = async () => {
    setError('');
    setIsLoading(true);
    try {
      const tx = await writeContractAsync({
        address: addresses.usdcFaucet,
        abi: USDC_FAUCET_ABI,
        functionName: 'claim',
        chainId: unichainSepolia.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: tx });
      setIsSuccess(true);
      refetchClaimed();
      refetchBalance();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    } finally {
      setIsLoading(false);
    }
  };

  const alreadyClaimed = !!hasClaimed;
  const faucetEmpty = faucetBalance != null && (faucetBalance as bigint) < 100n * 1_000_000n;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(126,108,242,0.18) 0%, rgba(126,108,242,0.05) 100%)',
        border: `1px solid rgba(126,108,242,0.35)`,
        borderRadius: 16,
        padding: '28px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🎁</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: colors.textPrimary }}>
          Claim 100 USDC
        </h2>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: colors.textSecondary, lineHeight: 1.5 }}>
          Promotional campaign — one claim per wallet.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>
          Use this USDC to open your first perpetual position on ThaHtay.
        </p>
      </div>

      {/* Faucet stats */}
      <div style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: colors.textSecondary }}>Faucet Balance</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: faucetEmpty ? colors.loss : colors.profit, fontVariantNumeric: 'tabular-nums' }}>
          ${balanceDisplay} USDC
        </span>
      </div>

      {/* Claim status / button */}
      <div style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        {!isConnected ? (
          <p style={{ margin: 0, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>
            Connect your wallet to claim USDC.
          </p>
        ) : alreadyClaimed || isSuccess ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <p style={{ margin: 0, fontWeight: 700, color: colors.profit, fontSize: 16 }}>
              100 USDC claimed!
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.textMuted }}>
              This wallet has already received the promotional USDC.
            </p>
          </div>
        ) : faucetEmpty ? (
          <p style={{ margin: 0, textAlign: 'center', color: colors.loss, fontSize: 14 }}>
            The faucet is currently empty. Check back soon.
          </p>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: colors.textSecondary }}>
                Connected as
              </p>
              <code style={{ fontSize: 12, color: colors.textMuted, wordBreak: 'break-all' }}>
                {address}
              </code>
            </div>
            <button
              className="btn-accent"
              disabled={isLoading}
              onClick={handleClaim}
              style={{ width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 700 }}
            >
              {isLoading ? 'Claiming…' : 'Claim 100 USDC'}
            </button>
          </>
        )}

        {error && (
          <p style={{ margin: 0, color: colors.loss, fontSize: 13, textAlign: 'center' }}>{error}</p>
        )}
      </div>

      {/* How it works */}
      <div style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '16px 20px',
      }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
          How it works
        </p>
        <ol style={{ margin: 0, paddingLeft: 18, color: colors.textSecondary, fontSize: 13, lineHeight: 1.8 }}>
          <li>Connect your wallet on Unichain Sepolia.</li>
          <li>Click <strong style={{ color: colors.textPrimary }}>Claim 100 USDC</strong> — one time per wallet.</li>
          <li>Use the USDC as margin to open a long or short ETH perp position.</li>
        </ol>
      </div>
    </div>
  );
}
