import { memo, useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/formatting';

interface PricePoint {
  t: number;
  price: number;
}

interface PriceChartProps {
  currentPrice: bigint;
}

const MAX_POINTS = 60;

export const PriceChart = memo(function PriceChart({ currentPrice }: PriceChartProps) {
  const [data, setData] = useState<PricePoint[]>([]);
  const lastPrice = useRef(0n);

  useEffect(() => {
    if (currentPrice === 0n || currentPrice === lastPrice.current) return;
    lastPrice.current = currentPrice;

    const priceNum = 1e18 / Number(currentPrice);
    setData((prev) => {
      const next = [...prev, { t: Date.now(), price: priceNum }];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [currentPrice]);

  const priceNum = currentPrice > 0n ? 1e18 / Number(currentPrice) : 0;
  const firstPrice = data[0]?.price ?? priceNum;
  const trend = priceNum >= firstPrice ? colors.profit : colors.loss;

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: '12px 8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 8px' }}>
        <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: 14 }}>ETH-USDC</span>
        <span style={{ color: trend, fontWeight: 700, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
          ${formatPrice(currentPrice)}
        </span>
      </div>

      {data.length < 1 ? (
        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: colors.textMuted, fontSize: 12 }}>Loading price...</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data.length === 1 ? [data[0], data[0]] : data} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              contentStyle={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.textPrimary,
                fontSize: 12,
              }}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
              labelFormatter={() => ''}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={trend}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
