import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { createPublicClient, http } from 'viem';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPrice } from '../utils/formatting';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN } from '../contracts/addresses';

const POLL_INTERVAL = 4000; // 4 seconds
const MAX_POINTS = 60;

interface DataPoint {
  value: number;
  label?: string;
}

interface PriceChartProps {
  currentPrice: bigint;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48; // horizontal padding

export function PriceChart({ currentPrice }: PriceChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPriceNum = Number(currentPrice) / 1e18;

  useEffect(() => {
    // Seed with current price
    if (currentPrice > 0n && data.length === 0) {
      setData([{ value: currentPriceNum }]);
    }
  }, [currentPrice]);

  useEffect(() => {
    if (currentPrice <= 0n) return;

    intervalRef.current = setInterval(() => {
      const priceNum = Number(currentPrice) / 1e18;
      setData(prev => {
        const next = [...prev, { value: priceNum }];
        if (next.length > MAX_POINTS) next.shift();
        return next;
      });
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentPrice]);

  if (data.length < 2) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Text style={styles.loadingText}>Loading chart...</Text>
      </View>
    );
  }

  const minVal = Math.min(...data.map(d => d.value));
  const maxVal = Math.max(...data.map(d => d.value));
  const latestVal = data[data.length - 1]?.value ?? 0;
  const firstVal = data[0]?.value ?? latestVal;
  const isUp = latestVal >= firstVal;
  const lineColor = isUp ? colors.profit : colors.loss;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.priceText}>{formatPrice(currentPrice)}</Text>
        <Text style={[styles.changeText, { color: lineColor }]}>
          {isUp ? '+' : ''}
          {(((latestVal - firstVal) / (firstVal || 1)) * 100).toFixed(2)}%
        </Text>
      </View>
      <LineChart
        data={data}
        width={CHART_WIDTH}
        height={120}
        color={lineColor}
        thickness={2}
        startFillColor={lineColor}
        startOpacity={0.15}
        endOpacity={0}
        areaChart
        hideDataPoints
        xAxisColor="transparent"
        yAxisColor="transparent"
        rulesColor={colors.border}
        rulesType="solid"
        backgroundColor={colors.bg}
        hideYAxisText
        adjustToWidth
        curved
        isAnimated
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  loading: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  priceText: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changeText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
});
