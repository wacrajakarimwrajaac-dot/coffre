import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/lib/icons';
import { C } from '@/lib/theme';

const tab = (name: IconName) => ({ color, focused }: { color: any; focused: boolean }) => (
  <View style={{ alignItems: 'center' }}>
    <Icon name={name} size={23} color={color} strokeWidth={focused ? 2.2 : 1.7} />
  </View>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0 },
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tab('house') }} />
      <Tabs.Screen name="media" options={{ title: 'Médias', tabBarIcon: tab('images') }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: tab('sliders-horizontal') }} />
    </Tabs>
  );
}
