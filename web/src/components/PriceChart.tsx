import { memo, useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
      const entry = { t: Date.now(), price: priceNum };
      // Seed two points on first receipt so the chart renders immediately
      // (no pool swaps on a quiet testnet means price never changes again)
      const next = prev.length === 0
        ? [{ t: entry.t - 1000, price: priceNum }, entry]
        : [...prev, entry];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [currentPrice]);

  const priceNum = currentPrice > 0n ? 1e18 / Number(currentPrice) : 0;
  const firstPrice = data[0]?.price ?? priceNum;
  const isUp = priceNum >= firstPrice;
  const trendColor = isUp ? colors.profit : colors.loss;
  const changePct = firstPrice > 0 ? ((priceNum - firstPrice) / firstPrice) * 100 : 0;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="label" style={{ marginBottom: 6 }}>ETH / USDC</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-1px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text)',
              lineHeight: 1,
            }}>
              ${formatPrice(currentPrice)}
            </span>
            {data.length > 1 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>
                {isUp ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 2 }}>
          <span className="dot-live" />
          <span className="label">live</span>
        </div>
      </div>

      {data.length < 2 ? (
        <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Awaiting data…</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={72}>
          <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--text)',
              }}
              formatter={(v: number) => [`$${v.toFixed(2)}`]}
              labelFormatter={() => ''}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={trendColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
