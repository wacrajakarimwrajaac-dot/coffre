import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { C } from '@/lib/theme';

export function Logo({ size = 32, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image source={require('../../assets/logo-mark.png')} style={{ width: size, height: size }} contentFit="contain" />
      {withName && <Text style={{ color: C.text, fontSize: size * 0.8, fontWeight: '800', letterSpacing: 0.3 }}>Coffre</Text>}
    </View>
  );
}
