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
  const addresses = getAddresses(chainId as 84532 | 8453);
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
    if (isConnected && address) { setAddress(address); setChainId(chainId); }
    else disconnect();
  }, [isConnected, address, chainId, setAddress, setChainId, disconnect]);

  useEffect(() => { if (ethBalance) setEthBalance(ethBalance.value); }, [ethBalance, setEthBalance]);
  useEffect(() => { if (usdcBalance != null) setUsdcBalance(usdcBalance as bigint); }, [usdcBalance, setUsdcBalance]);

  return null;
}

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('trade');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <WalletSync />

      <header className="nav">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            thahtay
          </span>
          <span style={{
            background: 'rgba(0,212,161,0.1)',
            color: 'var(--accent)',
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}>
            perp
          </span>
        </div>
        <WalletButton />
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main style={{ flex: 1, maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 16px' }}>
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
