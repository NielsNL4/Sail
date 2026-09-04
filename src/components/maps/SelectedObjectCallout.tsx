import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useEffectEvent, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { strings } from '@/i18n';

import type { MapPressPoint } from './BaseMap.types';
import { getCalloutPosition } from './calloutPosition';

export interface CalloutRow {
  label: string;
  value: string;
}

interface SelectedObjectCalloutProps {
  accentColor: string;
  closing: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onClosed: () => void;
  onDismiss: () => void;
  point: MapPressPoint;
  rows: CalloutRow[];
  safeBottom: number;
  safeTop: number;
  screenHeight: number;
  screenWidth: number;
  title: string;
}

export function SelectedObjectCallout({
  accentColor,
  closing,
  icon,
  label,
  onClosed,
  onDismiss,
  point,
  rows,
  safeBottom,
  safeTop,
  screenHeight,
  screenWidth,
  title,
}: SelectedObjectCalloutProps) {
  const [cardHeight, setCardHeight] = useState(190);
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.94));
  const [translateY] = useState(() => new Animated.Value(5));
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const handleClosed = useEffectEvent(onClosed);
  const position = getCalloutPosition(
    point,
    screenWidth,
    screenHeight,
    safeTop,
    safeBottom,
    cardHeight,
  );

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setReduceMotion(enabled);
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;

    opacity.stopAnimation();
    scale.stopAnimation();
    translateY.stopAnimation();
    const duration = reduceMotion ? 0 : closing ? 140 : 180;
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        duration,
        easing: closing ? Easing.in(Easing.quad) : Easing.out(Easing.cubic),
        toValue: closing ? 0 : 1,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        duration,
        easing: closing ? Easing.in(Easing.quad) : Easing.out(Easing.cubic),
        toValue: closing ? 0.96 : 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration,
        easing: closing ? Easing.in(Easing.quad) : Easing.out(Easing.cubic),
        toValue: closing ? 4 : 0,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished && closing) handleClosed();
    });
    return () => animation.stop();
  }, [closing, opacity, reduceMotion, scale, translateY]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        {
          left: position.left,
          top: position.top,
          width: position.width,
        },
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {!position.above ? (
        <View
          style={[
            styles.arrowUp,
            { borderBottomColor: '#f8fdff', left: position.arrowLeft },
          ]}
        />
      ) : null}
      <View
        onLayout={(event) => {
          const measuredHeight = Math.ceil(event.nativeEvent.layout.height);
          setCardHeight((height) =>
            height === measuredHeight ? height : measuredHeight,
          );
        }}
        style={[styles.card, { borderTopColor: accentColor }]}
      >
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: accentColor }]}>
            <Ionicons color="#ffffff" name={icon} size={18} />
          </View>
          <View style={styles.heading}>
            <Text style={styles.label}>{label}</Text>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={strings.closeObjectInfo}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Ionicons color="#075985" name="close" size={20} />
          </Pressable>
        </View>
        {rows.length > 0 ? (
          <View style={styles.rows}>
            {rows.slice(0, 4).map((row) => (
              <View key={`${row.label}-${row.value}`} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text numberOfLines={2} style={styles.rowValue}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {position.above ? (
        <View
          style={[
            styles.arrowDown,
            { borderTopColor: '#f8fdff', left: position.arrowLeft },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1050,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: 'rgba(125, 211, 252, 0.75)',
    borderRadius: 16,
    backgroundColor: 'rgba(248, 253, 255, 0.97)',
    boxShadow: '0 8px 24px rgba(8, 47, 73, 0.24)',
    elevation: 9,
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  iconBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  heading: {
    minWidth: 0,
    flex: 1,
  },
  label: {
    color: '#0369a1',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 1,
    color: '#082f49',
    fontSize: 16,
    fontWeight: '800',
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#e0f2fe',
  },
  closeButtonPressed: {
    backgroundColor: '#bae6fd',
    transform: [{ scale: 0.96 }],
  },
  rows: {
    paddingHorizontal: 12,
    paddingBottom: 11,
  },
  row: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(186, 230, 253, 0.65)',
  },
  rowLabel: {
    width: 70,
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
  },
  rowValue: {
    flex: 1,
    color: '#1e3a4b',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  arrowUp: {
    zIndex: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDown: {
    zIndex: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
