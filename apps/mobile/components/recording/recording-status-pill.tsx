import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
  useAnimatedValue,
} from 'react-native';

import {
  describeAriaSeconds,
  useRecordingTimer,
} from '@aisecretary/shared/hooks/use-recording-timer';

export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RecordingDevice {
  name: string;
  type: 'builtin' | 'bluetooth' | 'usb';
}

export type RecordingStatusPillVariant = 'compact' | 'standard' | 'with-device';

export interface RecordingStatusPillProps {
  state: RecordingState;
  elapsedSeconds: number;
  device?: RecordingDevice;
  variant?: RecordingStatusPillVariant;
  onPress?: () => void;
}

/**
 * V2 inline-waveform recording-status primitive — React Native counterpart
 * to the web component (UX spec U1, FR11). Single visual primitive across
 * phone lock-screen widget, in-app pill, and bot status row. V1 / V3 are
 * discarded.
 *
 * Reduced-motion handling: detects `AccessibilityInfo.isReduceMotionEnabled`
 * at mount + subscribes to the change event. When enabled, bars freeze in
 * the same staggered silhouette as the web counterpart.
 */
export function RecordingStatusPill({
  state,
  elapsedSeconds,
  device,
  variant = 'standard',
  onPress,
}: RecordingStatusPillProps) {
  const isActive = state === 'recording';
  const timer = useRecordingTimer(elapsedSeconds, isActive);
  const reduceMotion = useReduceMotionPreference();

  const accessibilityLabel = useMemo(() => {
    const verb = state === 'paused' ? 'Recording paused' : 'Recording';
    const duration = describeAriaSeconds(timer.ariaSeconds);
    const deviceClause = device ? `, via ${device.name}` : '';
    return `${verb}, ${duration}${deviceClause}`;
  }, [state, timer.ariaSeconds, device]);

  if (state === 'idle') return null;

  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel}
      className={pillClassName(variant)}
    >
      <Waveform animated={isActive && !reduceMotion} />
      <Text className="font-sans text-sm font-medium text-fg">
        {state === 'paused' ? 'Paused' : 'Recording'}
      </Text>
      <Text className="font-mono text-sm text-fg" accessibilityElementsHidden>
        {timer.display}
      </Text>
      {variant === 'with-device' && device ? <DeviceChip device={device} /> : null}
    </Container>
  );
}

function pillClassName(variant: RecordingStatusPillVariant): string {
  // min-h-11 = 44px AAA touch target — same floor as web.
  const base =
    'flex-row items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 min-h-11';
  return variant === 'compact' ? `${base} self-start` : base;
}

function Waveform({ animated }: { animated: boolean }) {
  // Five animated bars; each holds an Animated.Value driving scaleY.
  // Reanimated would be more efficient but adds turbo-module setup —
  // the JS-driven Animated API is fine for a 5-bar idle animation that
  // pauses when the recording stops.
  return (
    <View className="flex-row items-end h-5" accessibilityElementsHidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Bar key={i} index={i} animated={animated} />
      ))}
    </View>
  );
}

function Bar({ index, animated }: { index: number; animated: boolean }) {
  const scale = useAnimatedValue(animated ? 0.35 : staticHeight(index));

  useEffect(() => {
    if (!animated) {
      scale.setValue(staticHeight(index));
      return;
    }
    const phaseDelayMs = index * 100;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(phaseDelayMs),
        Animated.timing(scale, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.35,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, index, scale]);

  return (
    <Animated.View
      style={{
        marginHorizontal: 1,
        width: 3,
        height: '100%',
        borderRadius: 2,
        backgroundColor: 'var(--color-accent)' as unknown as string,
        transform: [{ scaleY: scale }],
        // NativeWind picks up bg-accent from className; the inline color above
        // is only the fallback path for surfaces without NativeWind transforms.
      }}
      className="bg-accent"
    />
  );
}

function staticHeight(index: number): number {
  // Mirrors the web reduced-motion silhouette so both platforms are
  // visually identical when motion is off.
  return [0.55, 0.85, 0.7, 0.95, 0.6][index] ?? 0.7;
}

function DeviceChip({ device }: { device: RecordingDevice }) {
  return (
    <View className="flex-row items-center gap-1 rounded-sm bg-accent-soft px-2 py-0.5">
      <Text className="text-xs text-fg-muted" accessibilityElementsHidden>
        {device.type === 'bluetooth' ? '⌁' : device.type === 'usb' ? '◎' : '◉'}
      </Text>
      <Text className="text-xs text-fg-muted" numberOfLines={1}>
        {device.name}
      </Text>
    </View>
  );
}

function useReduceMotionPreference(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!cancelled) setEnabled(value);
      })
      .catch(() => {
        // No-op: missing API on older platforms means default to motion-on.
      });
    if (Platform.OS !== 'web') {
      const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
      return () => {
        cancelled = true;
        sub.remove();
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
