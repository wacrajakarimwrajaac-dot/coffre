import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HabitsView, StatsView, TodayView } from '@/components/discipline';
import { s } from '@/components/ui';
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
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary}
          onRefresh={async () => { setRefreshing(true); await hb.reload(); setRefreshing(false); }} />}
      >
        <View>
          <Text style={s.h1}>🔥 Discipline</Text>
          <Text style={s.muted}>{date}</Text>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: C.panel, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.line }}>
          {TABS.map(([t, label]) => (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: tab === t ? C.card : 'transparent' }}>
              <Text style={{ color: tab === t ? C.text : C.muted, fontWeight: tab === t ? '700' : '500', fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {hb.error && <Text style={{ color: C.danger }}>{hb.error}</Text>}
        {tab === 'today' && <TodayView />}
        {tab === 'habits' && <HabitsView />}
        {tab === 'stats' && <StatsView />}
      </ScrollView>

      <Pressable onPress={() => router.push('/discipline/new')}
        style={{ position: 'absolute', right: 20, bottom: 20, height: 56, borderRadius: 28, paddingHorizontal: 20, backgroundColor: C.primary,
          flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
        <Text style={{ color: C.primaryInk, fontSize: 24, marginTop: -2 }}>＋</Text>
        <Text style={{ color: C.primaryInk, fontWeight: '800' }}>Habitude</Text>
      </Pressable>
    </SafeAreaView>
  );
}
