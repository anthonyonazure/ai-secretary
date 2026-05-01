import { Stack } from 'expo-router';
import { View } from 'react-native';

import { RecordingController } from '../components/recording/recording-controller';

export default function RecordScreen() {
  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Record', headerShown: true }} />
      <RecordingController />
    </View>
  );
}
