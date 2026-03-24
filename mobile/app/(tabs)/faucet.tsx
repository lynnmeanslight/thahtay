import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { USDC_FAUCET_ABI } from '../../src/contracts/abis/index';
import { ADDRESSES } from '../../src/contracts/addresses';
import { wagmiConfig } from '../../src/providers/index';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function FaucetScreen() {
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

  const faucetEmpty = faucetBalance != null && (faucetBalance as bigint) < 100n * 1_000_000n;
  const alreadyClaimed = !!hasClaimed || isSuccess;

  const handleClaim = async () => {
    setError('');
    setIsLoading(true);
    try {
      const tx = await writeContractAsync({
        address: addresses.usdcFaucet,
        abi: USDC_FAUCET_ABI,
        functionName: 'claim',
        chainId: 1301,
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Faucet</Text>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.emoji}>🎁</Text>
          <Text style={styles.heroTitle}>Claim 100 USDC</Text>
          <Text style={styles.heroSubtitle}>
            Promotional campaign — one claim per wallet.{'\n'}
            Use it to open your first perp position.
          </Text>
        </View>

        {/* Balance */}
        <View style={styles.card}>
          <Text style={styles.label}>Faucet Balance</Text>
          <Text style={[styles.value, { color: faucetEmpty ? colors.loss : colors.profit }]}>
            ${balanceDisplay} USDC
          </Text>
        </View>

        {/* Claim */}
        <View style={styles.card}>
          {!isConnected ? (
            <Text style={styles.hint}>Connect your wallet to claim USDC.</Text>
          ) : alreadyClaimed ? (
            <View style={styles.center}>
              <Text style={styles.emoji}>✅</Text>
              <Text style={[styles.heroTitle, { color: colors.profit }]}>100 USDC claimed!</Text>
              <Text style={styles.hint}>This wallet has already received the promotional USDC.</Text>
            </View>
          ) : faucetEmpty ? (
            <Text style={[styles.hint, { color: colors.loss }]}>
              The faucet is currently empty. Check back soon.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>Connected as</Text>
              <Text style={styles.address}>{address}</Text>
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleClaim}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Claim 100 USDC</Text>
                )}
              </TouchableOpacity>
            </>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>

        {/* How it works */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How it works</Text>
          {['Connect your wallet on Unichain Sepolia.', 'Tap Claim 100 USDC — one time per wallet.', 'Use the USDC as margin to open a long or short ETH perp.'].map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 12 },
  heading: { fontSize: typography.xl, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  hero: {
    backgroundColor: 'rgba(126,108,242,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(126,108,242,0.3)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emoji: { fontSize: 40 },
  heroTitle: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  heroSubtitle: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  label: { fontSize: typography.sm, color: colors.textSecondary },
  value: { fontSize: typography.md, fontWeight: '700' },
  hint: { fontSize: typography.sm, color: colors.textMuted, textAlign: 'center' },
  address: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace', flexWrap: 'wrap' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: typography.md },
  error: { color: colors.loss, fontSize: typography.sm, textAlign: 'center' },
  center: { alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(126,108,242,0.2)',
    color: colors.primary,
    textAlign: 'center',
    fontSize: typography.xs,
    fontWeight: '700',
    lineHeight: 20,
  },
  stepText: { flex: 1, fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 },
});
