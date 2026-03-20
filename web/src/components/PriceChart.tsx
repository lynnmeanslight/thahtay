import { memo, useState, useEffect, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/formatting';
import { fetchPriceHistory } from '../services/graphService';

interface PricePoint {
  t: number;
  price: number;
}

interface PriceChartProps {
  currentPrice: bigint;
}

const MAX_POINTS = 120;

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + fmtTime(ts);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { t, price } = payload[0].payload as PricePoint;
  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #2a2a2a',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      lineHeight: 1.6,
      pointerEvents: 'none',
    }}>
      <div style={{ color: '#fafafa', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div style={{ color: '#787878' }}>{fmtDate(t)}</div>
    </div>
  );
}

export const PriceChart = memo(function PriceChart({ currentPrice }: PriceChartProps) {
  const [data, setData] = useState<PricePoint[]>([]);
  const lastPrice = useRef(0n);
  const seeded = useRef(false);

  useEffect(() => {
    fetchPriceHistory(200).then((snapshots) => {
      if (snapshots.length === 0 || seeded.current) return;
      seeded.current = true;
      setData(snapshots.map((s) => ({
        t: Number(s.timestamp) * 1000,
        price: 1e18 / Number(s.price),
      })));
    });
  }, []);

  useEffect(() => {
    if (currentPrice === 0n || currentPrice === lastPrice.current) return;
    lastPrice.current = currentPrice;
    const priceNum = 1e18 / Number(currentPrice);
    setData((prev) => {
      const entry = { t: Date.now(), price: priceNum };
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
  const trendColorDim = isUp ? '#22c55e22' : '#f43f5e22';
  const changePct = firstPrice > 0 ? ((priceNum - firstPrice) / firstPrice) * 100 : 0;

  const prices = data.map((d) => d.price);
  const high = prices.length ? Math.max(...prices) : 0;
  const low  = prices.length ? Math.min(...prices) : 0;
  const gradientId = isUp ? 'grad-up' : 'grad-down';

  // Y-axis domain with a little padding so the line isn't clipped at edges
  const yPad = (high - low) * 0.15 || priceNum * 0.002;
  const yDomain: [number, number] = [low - yPad, high + yPad];

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="label" style={{ marginBottom: 5, letterSpacing: '0.06em' }}>ETH / USDC</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-1.5px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text)',
              lineHeight: 1,
            }}>
              ${formatPrice(currentPrice)}
            </span>
            {data.length > 1 && (
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: trendColor,
                background: trendColorDim,
                padding: '2px 7px',
                borderRadius: 5,
              }}>
                {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginBottom: 6 }}>
            <span className="dot-live" />
            <span className="label">live</span>
          </div>
          {data.length > 1 && (
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <div>H <span style={{ color: colors.profit, fontVariantNumeric: 'tabular-nums' }}>${high.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div>L <span style={{ color: colors.loss,   fontVariantNumeric: 'tabular-nums' }}>${low.toLocaleString('en-US',  { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      {data.length < 2 ? (
        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Awaiting data…</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-up" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={colors.profit} stopOpacity={0.18} />
                <stop offset="100%" stopColor={colors.profit} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-down" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={colors.loss} stopOpacity={0.18} />
                <stop offset="100%" stopColor={colors.loss} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={yDomain} hide />
            <ReferenceLine y={firstPrice} stroke="#333" strokeDasharray="3 3" strokeWidth={1} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#444', strokeWidth: 1 }}
            />
            <Area
              type="monotoneX"
              dataKey="price"
              stroke={trendColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: trendColor, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
