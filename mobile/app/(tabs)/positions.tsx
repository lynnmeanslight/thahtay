import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useAccount } from 'wagmi';
import { usePosition } from '../../src/hooks/usePosition';
import { PositionCard } from '../../src/components/PositionCard';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function PositionsScreen() {
  const { address } = useAccount();
  const { position, isLoading, refetch } = usePosition(address);

  if (!address) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Connect wallet to view positions</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.heading}>Open Positions</Text>

        {isLoading && !position && (
          <Text style={styles.emptyText}>Loading...</Text>
        )}

        {!isLoading && !position && (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No open positions</Text>
            <Text style={styles.emptySubtext}>
              Open a trade on the Trade tab to get started.
            </Text>
          </View>
        )}

        {position && (
          <PositionCard position={position} onClose={refetch} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 12 },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.md,
    textAlign: 'center',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: typography.sm,
    textAlign: 'center',
  },
});
