import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPrice, formatUSD, formatPnl } from '../utils/formatting';
import { PnLDisplay } from './PnLDisplay';
import { usePnL } from '../hooks/usePnL';
import { useLiquidationPrice } from '../hooks/useLiquidationPrice';
import { usePrice } from '../hooks/usePrice';
import { useTrade } from '../hooks/useTrade';
import type { GqlPosition } from '../services/graphService';

interface PositionCardProps {
  position: GqlPosition;
  onClose?: () => void;
}

export function PositionCard({ position, onClose }: PositionCardProps) {
  const { price: currentPrice } = usePrice();
  const { pnl, pnlPercent, isProfit } = usePnL(position, 0n); // funding owed simplified
  const liqPrice = useLiquidationPrice(position);
  const { closePosition, addMargin, status, resetStatus } = useTrade();

  const [showAddMargin, setShowAddMargin] = useState(false);
  const [marginInput, setMarginInput] = useState('');

  const isLong = position.isLong;
  const sideColor = isLong ? colors.profit : colors.loss;
  const sideLabel = isLong ? 'LONG' : 'SHORT';

  const handleClose = async () => {
    try {
      await closePosition();
      onClose?.();
    } catch (_) {}
  };

  const handleAddMargin = async () => {
    const amount = parseFloat(marginInput);
    if (isNaN(amount) || amount <= 0) return;
    // Convert USDC 6-decimal
    const amountBigInt = BigInt(Math.floor(amount * 1e6));
    try {
      await addMargin(amountBigInt);
      setShowAddMargin(false);
      setMarginInput('');
    } catch (_) {}
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.market}>ETH-USDC</Text>
          <View style={[styles.sideBadge, { backgroundColor: sideColor + '22' }]}>
            <Text style={[styles.sideText, { color: sideColor }]}>{sideLabel}</Text>
          </View>
          <Text style={styles.leverage}>{position.leverage}x</Text>
        </View>
        <PnLDisplay pnl={pnl} pnlPercent={pnlPercent} size="sm" />
      </View>

      {/* Stats grid */}
      <View style={styles.grid}>
        <StatRow label="Size" value={formatUSD(BigInt(position.size), 18)} />
        <StatRow label="Entry Price" value={formatPrice(BigInt(position.entryPrice))} />
        <StatRow label="Mark Price" value={formatPrice(currentPrice)} />
        <StatRow
          label="Liq. Price"
          value={liqPrice > 0n ? formatPrice(liqPrice) : '—'}
          valueColor={colors.loss}
        />
        <StatRow label="Margin" value={formatUSD(BigInt(position.margin), 18)} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => setShowAddMargin(true)}
        >
          <Text style={styles.btnSecondaryText}>Add Margin</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnDanger, status.isLoading && { opacity: 0.6 }]}
          onPress={handleClose}
          disabled={status.isLoading}
        >
          {status.isLoading ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <Text style={styles.btnDangerText}>Close</Text>
          )}
        </Pressable>
      </View>

      {/* Add Margin Modal */}
      <Modal visible={showAddMargin} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add Margin</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="USDC amount"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={marginInput}
              onChangeText={setMarginInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => { setShowAddMargin(false); setMarginInput(''); }}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, status.isLoading && { opacity: 0.6 }]}
                onPress={handleAddMargin}
                disabled={status.isLoading}
              >
                {status.isLoading ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  market: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: '700',
  },
  sideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sideText: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  leverage: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },
  grid: {
    gap: 8,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: typography.sm,
  },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: typography.sm,
  },
  btnDanger: {
    backgroundColor: colors.loss + '22',
    borderWidth: 1,
    borderColor: colors.loss + '44',
  },
  btnDangerText: {
    color: colors.loss,
    fontWeight: '700',
    fontSize: typography.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    fontSize: typography.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
