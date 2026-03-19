import { useState } from 'react';
import { useAccount, useDisconnect, useConnect } from 'wagmi';

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending, error } = useConnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <button
        className="btn btn-ghost"
        onClick={() => disconnect()}
        style={{ gap: 6, fontSize: 12, fontWeight: 500 }}
      >
        <span className="dot-live" />
        {short(address)}
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-accent"
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: 12, fontWeight: 700 }}
      >
        {isPending ? 'Connecting…' : 'Connect'}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 100,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 8,
            minWidth: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <p className="label" style={{ padding: '4px 8px 8px' }}>Select wallet</p>
            {connectors.length === 0 && (
              <p style={{ color: 'var(--text-2)', fontSize: 12, padding: '0 8px 4px' }}>No wallets found</p>
            )}
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                className="btn btn-ghost"
                disabled={isPending}
                onClick={() => { connect({ connector }, { onSuccess: () => setOpen(false) }); }}
                style={{ width: '100%', justifyContent: 'flex-start', height: 36, padding: '0 10px', fontSize: 13 }}
              >
                {isPending ? 'Connecting…' : connector.name}
              </button>
            ))}
            {error && (
              <p style={{ color: 'var(--loss)', fontSize: 11, padding: '4px 8px 0', wordBreak: 'break-word' }}>
                {error.message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}


