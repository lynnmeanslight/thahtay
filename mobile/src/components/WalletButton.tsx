import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useLoginWithOAuth, usePrivy } from '@privy-io/expo';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

function formatUserLabel(user: ReturnType<typeof usePrivy>['user']): string {
  if (!user) return 'User';
  const email = user.linked_accounts.find(a => a.type === 'email');
  if (email?.address) return email.address;
  const wallet = user.linked_accounts.find(a => a.type === 'wallet');
  if (wallet?.address) return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  return `User ${user.id.slice(0, 6)}`;
}

export function WalletButton() {
  const { user, isReady, logout } = usePrivy();
  const { login, state } = useLoginWithOAuth();
  const hasPrivyAppId = !!process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  const isLoggedIn = !!user;
  const isBusy = state.status === 'loading';

  const handleLogin = async () => {
    if (!hasPrivyAppId || isBusy) return;
    await login({ provider: 'google' });
  };

  if (!isLoggedIn) {
    return (
      <Pressable
        style={[styles.connectBtn, (!isReady || isBusy || !hasPrivyAppId) && styles.disabledBtn]}
        onPress={handleLogin}
        disabled={!isReady || isBusy || !hasPrivyAppId}
      >
        <Text style={styles.connectText}>
          {!hasPrivyAppId ? 'Set PRIVY APP ID' : isBusy ? 'Signing in...' : 'Sign in'}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.connectedBtn} onPress={() => logout()}>
      <View style={styles.dot} />
      <Text style={styles.addressText}>{formatUserLabel(user)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  connectBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  connectText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: typography.sm,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  connectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.profit,
  },
  addressText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
