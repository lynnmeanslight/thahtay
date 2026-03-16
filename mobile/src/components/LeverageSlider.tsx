import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface LeverageSliderProps {
  value: number; // 1–10
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const TRACK_WIDTH = 280;
const THUMB_SIZE = 24;

export function LeverageSlider({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 0.5,
}: LeverageSliderProps) {
  const snapPoints = [1, 2, 3, 5, 7, 10];

  const valueToX = (v: number) =>
    ((v - min) / (max - min)) * (TRACK_WIDTH - THUMB_SIZE);

  const xToValue = (x: number): number => {
    const raw = (x / (TRACK_WIDTH - THUMB_SIZE)) * (max - min) + min;
    const stepped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, stepped));
  };

  const thumbX = useSharedValue(valueToX(value));
  const startX = useSharedValue(0);

  const emitChange = useCallback(
    (x: number) => {
      const v = xToValue(x);
      onChange(v);
    },
    [onChange],
  );

  const gesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = thumbX.value;
    })
    .onUpdate(e => {
      thumbX.value = clamp(
        startX.value + e.translationX,
        0,
        TRACK_WIDTH - THUMB_SIZE,
      );
      runOnJS(emitChange)(thumbX.value);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value + THUMB_SIZE / 2,
  }));

  const handleSnapPress = (snap: number) => {
    thumbX.value = valueToX(snap);
    onChange(snap);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Leverage</Text>
        <Text style={styles.valueText}>{value.toFixed(1)}x</Text>
      </View>

      {/* Track */}
      <View style={styles.trackContainer}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.thumb, thumbStyle]}>
            <View style={styles.thumbInner} />
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Snap point labels */}
      <View style={styles.snaps}>
        {snapPoints.map(snap => (
          <Pressable key={snap} onPress={() => handleSnapPress(snap)}>
            <Text
              style={[
                styles.snapLabel,
                value >= snap && styles.snapLabelActive,
              ]}
            >
              {snap}x
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    width: TRACK_WIDTH,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  valueText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  trackContainer: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    marginBottom: 8,
  },
  track: {
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg,
  },
  snaps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: THUMB_SIZE / 2,
  },
  snapLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },
  snapLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
