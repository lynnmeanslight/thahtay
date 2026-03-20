import { useState, useEffect } from 'react';
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi';
// useChainId kept for WalletSync below; NetworkGuard uses useAccount().chain instead
import { Providers } from './providers/index';
import { WalletButton } from './components/WalletButton';
import { TradePage } from './pages/TradePage';
import { PositionsPage } from './pages/PositionsPage';
import { LiquidationsPage } from './pages/LiquidationsPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { useWalletStore } from './store/useWalletStore';
import { ADDRESSES, unichainSepolia } from './contracts/addresses';
import { ERC20_ABI } from './contracts/abis/index';
import { useReadContract } from 'wagmi';

type Tab = 'trade' | 'positions' | 'liquidations' | 'portfolio';

const TABS: { id: Tab; label: string }[] = [
  { id: 'trade',        label: 'Trade' },
  { id: 'positions',    label: 'Positions' },
  { id: 'liquidations', label: 'Liquidate' },
  { id: 'portfolio',    label: 'Portfolio' },
];

function NetworkGuard() {
  const { isConnected, chain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  // Use chain from useAccount — reflects the actual injected wallet chain.
  // useChainId() returns the wagmi config default (1301) even when MetaMask
  // is on a different chain, so it can't detect the wrong-chain state.
  const wrongChain = isConnected && chain?.id !== unichainSepolia.id;

  if (!wrongChain) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,10,10,0.92)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '32px 28px',
        maxWidth: 340,
        width: '90%',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 32 }}>⛓️</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
            Wrong Network
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            ThaHtay runs on <strong style={{ color: 'var(--accent)' }}>Unichain Sepolia</strong>.
            Please switch your wallet network to continue.
          </p>
        </div>
        <button
          className="btn-accent"
          disabled={isPending}
          onClick={() => switchChain({ chainId: unichainSepolia.id })}
          style={{ width: '100%', padding: '12px 0', fontSize: 14 }}
        >
          {isPending ? 'Switching…' : 'Switch to Unichain Sepolia'}
        </button>
      </div>
    </div>
  );
}

function WalletSync() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const addresses = ADDRESSES.unichainSepolia;
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

function BalancePill() {
  const { isConnected, ethBalance, usdcBalance } = useWalletStore();
  if (!isConnected) return null;

  const ethDisplay = (Number(ethBalance) / 1e18).toFixed(4);
  const usdcDisplay = (Number(usdcBalance) / 1e6).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '3px 8px',
        color: 'var(--text)',
        fontWeight: 600,
      }}>
        {ethDisplay} <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>ETH</span>
      </span>
      <span style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '3px 8px',
        color: 'var(--accent)',
        fontWeight: 600,
      }}>
        ${usdcDisplay} <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>USDC</span>
      </span>
    </div>
  );
}

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('trade');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <NetworkGuard />
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
        <BalancePill />
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
