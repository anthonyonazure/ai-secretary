/**
 * Expo Router screen — in-person consent QR (Story 4.3, shape C).
 *
 * Reached via `router.push({ pathname: '/consent-qr', params: { ackToken } })`
 * from the recording controller when the orchestrator's surface list
 * includes shape C. Rendered as a full-screen route; the recording user
 * shows the device to the in-person counterpart for scanning.
 */

import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ConsentQrScreen } from '../components/recording/consent-qr-screen';

export default function ConsentQrRoute() {
  const { ackToken } = useLocalSearchParams<{ ackToken: string }>();
  const token = typeof ackToken === 'string' ? ackToken : 'pending';
  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Consent QR', headerShown: true }} />
      <ConsentQrScreen ackToken={token} />
    </View>
  );
}
