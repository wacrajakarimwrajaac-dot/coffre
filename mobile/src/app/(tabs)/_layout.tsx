import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '@/lib/theme';

const icon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.line },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="media" options={{ title: 'Médias', tabBarIcon: icon('🖼️') }} />
      <Tabs.Screen name="discipline" options={{ title: 'Discipline', tabBarIcon: icon('🔥') }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
