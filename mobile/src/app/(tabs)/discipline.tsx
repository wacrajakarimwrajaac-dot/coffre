import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HabitsView, StatsView, TodayView } from '@/components/discipline';
import { Icon } from '@/components/Icon';
import { Tabs, s } from '@/components/ui';
import { useHabits } from '@/lib/habitsStore';
import { C } from '@/lib/theme';

type Tab = 'today' | 'habits' | 'stats';
const TABS: [Tab, string][] = [['today', 'Aujourd’hui'], ['habits', 'Habitudes'], ['stats', 'Statistiques']];

export default function Discipline() {
  const hb = useHabits();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('today');
  const [refreshing, setRefreshing] = useState(false);
  const raw = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const date = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={async () => { setRefreshing(true); await hb.reload(); setRefreshing(false); }} />}
      >
        <Text style={s.h1}>Discipline</Text>
        <Text style={[s.muted, { fontSize: 14, marginBottom: 18 }]}>{date}</Text>
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <View style={{ height: 14 }} />
        {hb.error && <Text style={{ color: C.danger }}>{hb.error}</Text>}
        {tab === 'today' && <TodayView />}
        {tab === 'habits' && <HabitsView />}
        {tab === 'stats' && <StatsView />}
      </ScrollView>

      <Pressable onPress={() => router.push('/discipline/new')}
        style={{ position: 'absolute', right: 20, bottom: 16 + 0 * insets.bottom, height: 54, borderRadius: 27, paddingHorizontal: 20, backgroundColor: C.primary,
          flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
        <Icon name="plus" size={22} color={C.primaryInk} strokeWidth={2.4} />
        <Text style={{ color: C.primaryInk, fontWeight: '700', fontSize: 15 }}>Habitude</Text>
      </Pressable>
    </SafeAreaView>
  );
}
