import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { C } from '@/lib/theme';

export function Logo({ size = 28, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Image source={require('../../assets/logo-mark.png')} style={{ width: size, height: size }} contentFit="contain" />
      {withName && <Text style={{ color: C.text, fontSize: size * 0.62, fontWeight: '700', letterSpacing: -0.3 }}>Coffre</Text>}
    </View>
  );
}
