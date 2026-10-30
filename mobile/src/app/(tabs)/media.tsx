import { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediaThumb } from '@/components/ItemRow';
import { Empty, Pill, s } from '@/components/ui';
import { isMedia, kindOf } from '@/lib/media';
import { useStore } from '@/lib/store';

type Filter = 'all' | 'photo' | 'video';

export default function Media() {
  const st = useStore();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const gap = 4;
  const size = Math.floor((width - 40 - gap * 2) / 3);

  const all = useMemo(() => st.items.filter(isMedia), [st.items]);
  const shown = useMemo(() => all.filter((i) => filter === 'all' || kindOf(i) === filter), [all, filter]);
  const photos = all.filter((i) => kindOf(i) === 'photo').length;
  const chips: [Filter, string][] = [['all', `Tout · ${all.length}`], ['photo', `Photos · ${photos}`], ['video', `Vidéos · ${all.length - photos}`]];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={shown}
        numColumns={3}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, gap, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 12 }}>
            <Text style={s.h1}>Médias</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {chips.map(([f, label]) => <Pill key={f} label={label} on={filter === f} onPress={() => setFilter(f)} />)}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<Empty title="Aucun média" hint="Les photos et vidéos de tous tes dossiers apparaissent ici." />}
        renderItem={({ item }) => <MediaThumb item={item} size={size} />}
      />
    </SafeAreaView>
  );
}
