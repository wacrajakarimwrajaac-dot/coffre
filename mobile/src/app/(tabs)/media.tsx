import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediaThumb } from '@/components/ItemRow';
import { Empty, s } from '@/components/ui';
import { isMedia, kindOf } from '@/lib/media';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

type Filter = 'all' | 'photo' | 'video';

export default function Media() {
  const st = useStore();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const gap = 4;
  const size = Math.floor((width - 32 - gap * 2) / 3);

  const all = useMemo(() => st.items.filter(isMedia), [st.items]);
  const shown = useMemo(() => all.filter((i) => filter === 'all' || kindOf(i) === filter), [all, filter]);
  const photos = all.filter((i) => kindOf(i) === 'photo').length;
  const videos = all.length - photos;

  const chips: [Filter, string][] = [['all', `Tout ${all.length}`], ['photo', `Photos ${photos}`], ['video', `Vidéos ${videos}`]];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={shown}
        numColumns={3}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ padding: 16, gap, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <Text style={s.h1}>Médias</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {chips.map(([f, label]) => (
                <Pressable key={f} onPress={() => setFilter(f)}
                  style={{ borderWidth: 1, borderColor: filter === f ? C.primary : C.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Text style={{ color: filter === f ? C.primary : C.muted }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<Empty title="Aucun média" hint="Les photos et vidéos de tous tes dossiers apparaissent ici." />}
        renderItem={({ item }) => <MediaThumb item={item} size={size} />}
      />
    </SafeAreaView>
  );
}
