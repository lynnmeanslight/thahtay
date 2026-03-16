import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAccount } from 'wagmi';
import { usePrice } from '../../src/hooks/usePrice';
import { usePositionPreview } from '../../src/hooks/useLiquidationPrice';
import { usePosition } from '../../src/hooks/usePosition';
import { useTrade } from '../../src/hooks/useTrade';
import { useFundingRate } from '../../src/hooks/useFunding';
import { useTradeStore } from '../../src/store/useTradeStore';
import { useWalletStore } from '../../src/store/useWalletStore';
import { PriceChart } from '../../src/components/PriceChart';
import { LeverageSlider } from '../../src/components/LeverageSlider';
import { MarginInput } from '../../src/components/MarginInput';
import { WalletButton } from '../../src/components/WalletButton';
import { formatPrice, formatUSD, parseUsdcToInternal, parseUsdcToTransfer } from '../../src/utils/formatting';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function TradeScreen() {
  const { isConnected } = useAccount();
  const { price: currentPrice } = usePrice();
  const { longRate, shortRate } = useFundingRate();
  const { side, setSide, sizeInput, setSizeInput, leverageInput, setLeverageInput } =
    useTradeStore();
  const { usdcBalance } = useWalletStore();
  const { openPosition, status, resetStatus } = useTrade();

  const isLong = side === 'long';
  const preview = usePositionPreview(sizeInput, leverageInput, currentPrice, isLong);

  const [inputError, setInputError] = useState('');

  const validate = (): boolean => {
    const size = parseFloat(sizeInput);
    if (isNaN(size) || size <= 0) {
      setInputError('Enter a valid size');
      return false;
    }
    if (usdcBalance !== undefined && preview.totalRequired > BigInt(usdcBalance)) {
      setInputError('Insufficient USDC balance');
      return false;
    }
    setInputError('');
    return true;
  };

  const handleOpenPosition = async () => {
    if (!validate()) return;
    const usdcRequired6 = parseUsdcToTransfer(
      (Number(preview.totalRequired) / 1e18).toFixed(6),
    );
    try {
      await openPosition(
        isLong,
        preview.sizeInternal,
        leverageInput,
        usdcRequired6,
      );
      setSizeInput('');
      Alert.alert('Position Opened', `${isLong ? 'Long' : 'Short'} position opened successfully.`);
    } catch (e: any) {
      Alert.alert('Transaction Failed', e?.shortMessage ?? e?.message ?? 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.marketTitle}>ETH / USDC</Text>
            <WalletButton />
          </View>

          {/* Chart */}
          <PriceChart currentPrice={currentPrice} />

          {/* Funding rates */}
          <View style={styles.fundingRow}>
            <Text style={styles.fundingLabel}>Funding (1h)</Text>
            <Text style={[styles.fundingVal, { color: colors.profit }]}>
              L: {longRate >= 0 ? '+' : ''}{longRate.toFixed(4)}%
            </Text>
            <Text style={[styles.fundingVal, { color: colors.loss }]}>
              S: {shortRate >= 0 ? '+' : ''}{shortRate.toFixed(4)}%
            </Text>
          </View>

          {/* Long / Short toggle */}
          <View style={styles.sideToggle}>
            <Pressable
              style={[styles.sideBtn, isLong && styles.sideBtnLong]}
              onPress={() => setSide('long')}
            >
              <Text style={[styles.sideBtnText, isLong && { color: colors.bg }]}>
                Long
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sideBtn, !isLong && styles.sideBtnShort]}
              onPress={() => setSide('short')}
            >
              <Text style={[styles.sideBtnText, !isLong && { color: colors.bg }]}>
                Short
              </Text>
            </Pressable>
          </View>

          {/* Collateral input */}
          <MarginInput
            label="Collateral (USDC)"
            value={sizeInput}
            onChangeText={v => { setSizeInput(v); setInputError(''); }}
            usdcBalance={usdcBalance}
            error={inputError}
          />

          {/* Leverage slider */}
          <View style={styles.sliderWrap}>
            <LeverageSlider
              value={leverageInput}
              onChange={setLeverageInput}
            />
          </View>

          {/* Order summary */}
          <View style={styles.summaryCard}>
            <SummaryRow label="Position Size" value={formatUSD(preview.sizeInternal, 18)} />
            <SummaryRow label="Required Margin" value={formatUSD(preview.requiredMargin, 18)} />
            <SummaryRow label="Trading Fee (0.1%)" value={formatUSD(preview.tradingFee, 18)} />
            <SummaryRow label="Total Required" value={formatUSD(preview.totalRequired, 18)} highlight />
            <SummaryRow
              label="Liq. Price"
              value={preview.liquidationPrice > 0n ? formatPrice(preview.liquidationPrice) : '—'}
              valueColor={colors.loss}
            />
          </View>

          {/* CTA */}
          {isConnected ? (
            <Pressable
              style={[
                styles.ctaBtn,
                isLong ? styles.ctaLong : styles.ctaShort,
                status.isLoading && { opacity: 0.6 },
              ]}
              onPress={handleOpenPosition}
              disabled={status.isLoading}
            >
              {status.isLoading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.ctaText}>
                  {isLong ? 'Open Long' : 'Open Short'}
                </Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.connectPrompt}>
              <Text style={styles.connectPromptText}>
                Connect wallet to trade
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  valueColor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, highlight && { color: colors.textPrimary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          highlight && { fontWeight: '700' },
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 16 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marketTitle: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '800',
  },
  fundingRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  fundingLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
    flex: 1,
  },
  fundingVal: {
    fontSize: typography.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  sideToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  sideBtnLong: { backgroundColor: colors.profit },
  sideBtnShort: { backgroundColor: colors.loss },
  sideBtnText: {
    fontWeight: '700',
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  sliderWrap: { alignItems: 'center' },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontVariant: ['tabular-nums'],
  },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLong: { backgroundColor: colors.profit },
  ctaShort: { backgroundColor: colors.loss },
  ctaText: { color: colors.bg, fontWeight: '800', fontSize: typography.md },
  connectPrompt: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectPromptText: { color: colors.textMuted, fontSize: typography.sm },
});
