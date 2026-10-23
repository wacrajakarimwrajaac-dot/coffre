import { Stack } from 'expo-router';
import { FlatList } from 'react-native';
import { ItemCard } from '@/components/ItemCard';
import { Empty } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function Tasks() {
  const st = useStore();
  const tasks = st.items
    .filter((i) => i.type === 'task')
    .sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  return (
    <>
      <Stack.Screen options={{ title: 'Tâches & rappels' }} />
      <FlatList
        data={tasks}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Empty title="Aucune tâche" hint="Ajoute une tâche avec un rappel depuis un dossier." />}
        renderItem={({ item }) => <ItemCard item={item} folderLabel={st.folderPath(item.folderId)} onChanged={st.reload} />}
      />
    </>
  );
}
