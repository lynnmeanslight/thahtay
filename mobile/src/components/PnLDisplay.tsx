import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPnl } from '../utils/formatting';

interface PnLDisplayProps {
  pnl: bigint;
  pnlPercent?: number; // e.g. 3.45
  size?: 'sm' | 'md' | 'lg';
}

export function PnLDisplay({ pnl, pnlPercent, size = 'md' }: PnLDisplayProps) {
  const isProfit = pnl >= 0n;
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Pulse animation on PnL change
    opacity.value = 0.4;
    scale.value = 0.96;
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  }, [pnl]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const fontSize =
    size === 'sm' ? typography.sm : size === 'lg' ? typography.xl : typography.md;

  const color = isProfit ? colors.profit : colors.loss;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Animated.Text style={[styles.pnl, { color, fontSize }]}>
        {formatPnl(pnl)}
      </Animated.Text>
      {pnlPercent !== undefined && (
        <Animated.Text style={[styles.percent, { color }]}>
          ({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
        </Animated.Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pnl: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  percent: {
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
