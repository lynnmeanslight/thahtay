import { useState } from 'react';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { colors } from '../theme/colors';

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending, error } = useConnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: '8px 14px',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: colors.profit,
            display: 'inline-block',
          }}
        />
        <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500 }}>
          {shortenAddress(address)}
        </span>
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: colors.primary,
          color: colors.bg,
          border: 'none',
          borderRadius: 10,
          padding: '10px 20px',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Connect Wallet
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
            }}
          />
          {/* picker */}
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 100,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 12,
              minWidth: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <p style={{ color: colors.textSecondary, fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
              Select Wallet
            </p>
            {connectors.length === 0 && (
              <p style={{ color: colors.textSecondary, fontSize: 12, margin: 0 }}>
                No wallets detected. Install MetaMask and refresh.
              </p>
            )}
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                disabled={isPending}
                onClick={() => {
                  connect(
                    { connector },
                    {
                      onSuccess: () => setOpen(false),
                      onError: (err) => {
                        console.error('Wallet connect error:', err);
                      },
                    },
                  );
                }}
                style={{
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isPending ? 'wait' : 'pointer',
                  textAlign: 'left',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Connecting…' : connector.name}
              </button>
            ))}
            {error && (
              <p style={{ color: colors.loss ?? '#f87171', fontSize: 12, margin: '4px 0 0', wordBreak: 'break-word' }}>
                {error.message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}


