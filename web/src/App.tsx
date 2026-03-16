import { useState, useEffect } from 'react';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { Providers } from './providers/index';
import { WalletButton } from './components/WalletButton';
import { TradePage } from './pages/TradePage';
import { PositionsPage } from './pages/PositionsPage';
import { LiquidationsPage } from './pages/LiquidationsPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { useWalletStore } from './store/useWalletStore';
import { getAddresses } from './contracts/addresses';
import { ERC20_ABI } from './contracts/abis/index';
import { useReadContract } from 'wagmi';
import { colors } from './theme/colors';
import { formatUSD } from './utils/formatting';

type Tab = 'trade' | 'positions' | 'liquidations' | 'portfolio';

const TABS: { id: Tab; label: string }[] = [
  { id: 'trade',        label: 'Trade' },
  { id: 'positions',    label: 'Positions' },
  { id: 'liquidations', label: 'Liquidate' },
  { id: 'portfolio',    label: 'Portfolio' },
];

function WalletSync() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const addresses = getAddresses(chainId as 1301 | 130);
  const { setAddress, setChainId, setUsdcBalance, setEthBalance, disconnect } = useWalletStore();

  const { data: ethBalance } = useBalance({ address });
  const { data: usdcBalance } = useReadContract({
    address: addresses.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  useEffect(() => {
    if (isConnected && address) {
      setAddress(address);
      setChainId(chainId);
    } else {
      disconnect();
    }
  }, [isConnected, address, chainId, setAddress, setChainId, disconnect]);

  useEffect(() => {
    if (ethBalance) setEthBalance(ethBalance.value);
  }, [ethBalance, setEthBalance]);

  useEffect(() => {
    if (usdcBalance != null) setUsdcBalance(usdcBalance as bigint);
  }, [usdcBalance, setUsdcBalance]);

  return null;
}

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('trade');
  const { usdcBalance, isConnected } = useWalletStore();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <WalletSync />

      {/* Top navbar */}
      <header
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: colors.primary, fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px' }}>
            ThaHtay
          </span>
          <span
            style={{
              background: colors.primary + '22',
              color: colors.primary,
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              marginLeft: 6,
            }}
          >
            PERP
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isConnected && (
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: '4px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600 }}>USDC</span>
              <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatUSD(usdcBalance, 6)}
              </span>
            </div>
          )}
          <WalletButton />
        </div>
      </header>

      {/* Tab bar */}
      <nav
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          padding: '0 20px',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? colors.primary : 'transparent'}`,
              color: activeTab === tab.id ? colors.primary : colors.textSecondary,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 13,
              padding: '12px 16px',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Page content */}
      <main
        style={{
          flex: 1,
          maxWidth: 520,
          width: '100%',
          margin: '0 auto',
          padding: '20px 16px',
          boxSizing: 'border-box',
        }}
      >
        {activeTab === 'trade'        && <TradePage />}
        {activeTab === 'positions'    && <PositionsPage />}
        {activeTab === 'liquidations' && <LiquidationsPage />}
        {activeTab === 'portfolio'    && <PortfolioPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <AppInner />
    </Providers>
  );
}
