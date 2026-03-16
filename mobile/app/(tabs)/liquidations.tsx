import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { fetchAtRiskPositions, fetchLiquidations } from '../../src/services/graphService';
import { useTrade } from '../../src/hooks/useTrade';
import { formatPrice, formatUSD } from '../../src/utils/formatting';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

// At-risk threshold: warn when margin ratio < 10%
const WARN_RATIO = 10;

export default function LiquidationMonitor() {
  const { address } = useAccount();
  const { liquidate, status } = useTrade();

  const {
    data: atRisk = [],
    isLoading: loadingAtRisk,
    refetch: refetchAtRisk,
  } = useQuery({
    queryKey: ['atRisk'],
    queryFn: () => fetchAtRiskPositions(),
    refetchInterval: 10_000,
  });

  const {
    data: recent = [],
    isLoading: loadingRecent,
    refetch: refetchRecent,
  } = useQuery({
    queryKey: ['liquidations'],
    queryFn: () => fetchLiquidations(),
    refetchInterval: 15_000,
  });

  const handleLiquidate = async (trader: string) => {
    try {
      await liquidate(trader as `0x${string}`);
      refetchAtRisk();
      Alert.alert('Success', 'Position liquidated. Bonus sent to your wallet.');
    } catch (e: any) {
      Alert.alert('Failed', e?.shortMessage ?? e?.message ?? 'Liquidation failed');
    }
  };

  const isLoading = loadingAtRisk || loadingRecent;
  const refetch = () => { refetchAtRisk(); refetchRecent(); };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.heading}>Liquidation Monitor</Text>
        <Text style={styles.subheading}>
          Earn 5% bonus by liquidating at-risk positions.
        </Text>

        {/* At-risk positions */}
        <Text style={styles.sectionTitle}>At Risk ({atRisk.length})</Text>
        {atRisk.length === 0 && !loadingAtRisk && (
          <Text style={styles.emptyText}>No positions at risk</Text>
        )}
        {atRisk.map((pos: any) => {
          const marginRatio = parseFloat(pos.marginRatio ?? '100');
          const isAtRisk = marginRatio <= WARN_RATIO;
          return (
            <View key={pos.id} style={styles.riskCard}>
              <View style={styles.riskHeader}>
                <Text style={styles.trader}>
                  {shortenAddress(pos.trader)}
                </Text>
                <View
                  style={[
                    styles.ratioBadge,
                    { backgroundColor: isAtRisk ? colors.loss + '33' : colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.ratioText,
                      { color: isAtRisk ? colors.loss : colors.textSecondary },
                    ]}
                  >
                    {marginRatio.toFixed(2)}% margin
                  </Text>
                </View>
              </View>

              <View style={styles.riskDetails}>
                <Detail label="Side" value={pos.isLong ? 'Long' : 'Short'} />
                <Detail label="Size" value={formatUSD(BigInt(pos.size ?? '0'), 18)} />
                <Detail
                  label="Entry"
                  value={formatPrice(BigInt(pos.entryPrice ?? '0'))}
                />
                <Detail label="Lev" value={`${pos.leverage}x`} />
              </View>

              {address && (
                <Pressable
                  style={[styles.liqBtn, status.isLoading && { opacity: 0.5 }]}
                  onPress={() => handleLiquidate(pos.trader)}
                  disabled={status.isLoading}
                >
                  {status.isLoading ? (
                    <ActivityIndicator color={colors.bg} size="small" />
                  ) : (
                    <Text style={styles.liqBtnText}>Liquidate (+5% bonus)</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Recent liquidations */}
        <Text style={styles.sectionTitle}>Recent Liquidations</Text>
        {recent.length === 0 && !loadingRecent && (
          <Text style={styles.emptyText}>No recent liquidations</Text>
        )}
        {recent.slice(0, 10).map((liq: any, i: number) => (
          <View key={liq.id ?? i} style={styles.historyRow}>
            <View>
              <Text style={styles.historyTrader}>{shortenAddress(liq.trader)}</Text>
              <Text style={styles.historyTime}>
                {new Date(Number(liq.timestamp) * 1000).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.historyBonus}>
              +{formatUSD(BigInt(liq.bonus ?? '0'), 18)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function shortenAddress(addr: string): string {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 16 },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '800',
  },
  subheading: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    textAlign: 'center',
    paddingVertical: 8,
  },
  riskCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trader: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ratioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratioText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  riskDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: { color: colors.textMuted, fontSize: typography.xs },
  detailValue: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  liqBtn: {
    backgroundColor: colors.loss,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  liqBtnText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: typography.sm,
  },
  historyRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyTrader: { color: colors.textPrimary, fontSize: typography.sm, fontWeight: '600' },
  historyTime: { color: colors.textMuted, fontSize: typography.xs, marginTop: 2 },
  historyBonus: {
    color: colors.profit,
    fontSize: typography.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
