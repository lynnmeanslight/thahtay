import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  type TextInputProps,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatUSD } from '../utils/formatting';

interface MarginInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (v: string) => void;
  usdcBalance?: bigint; // 6-decimal
  label?: string;
  error?: string;
}

export function MarginInput({
  value,
  onChangeText,
  usdcBalance,
  label = 'Collateral',
  error,
  ...rest
}: MarginInputProps) {
  const handleMax = () => {
    if (!usdcBalance) return;
    // Format 6-decimal balance as plain string
    const formatted = (Number(usdcBalance) / 1e6).toFixed(2);
    onChangeText(formatted);
  };

  const balanceStr = usdcBalance != null ? formatUSD(usdcBalance, 6) : null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {balanceStr && (
          <Text style={styles.balance}>Bal: {balanceStr}</Text>
        )}
      </View>

      <View style={[styles.inputContainer, !!error && styles.inputError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          returnKeyType="done"
          {...rest}
        />
        <Text style={styles.unit}>USDC</Text>
        {usdcBalance != null && (
          <Pressable style={styles.maxBtn} onPress={handleMax}>
            <Text style={styles.maxText}>MAX</Text>
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  balance: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 8,
  },
  inputError: {
    borderColor: colors.loss,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.md,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: '500',
  },
  maxBtn: {
    backgroundColor: colors.primary + '22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  maxText: {
    color: colors.primary,
    fontSize: typography.xs,
    fontWeight: '700',
  },
  errorText: {
    color: colors.loss,
    fontSize: typography.xs,
  },
});
