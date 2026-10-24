import { disconnectDrive } from './driveAuth';
import { supabase } from './supabase';

async function removeAllFiles(bucket: string, userId: string) {
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(userId, { limit: 100 });
    if (error) throw new Error(error.message);
    if (!data?.length) return;
    const { error: rmError } = await supabase.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
    if (rmError) throw new Error(rmError.message);
  }
}

/** Deletes every file, then the account itself (folders, items, reports cascade). Irreversible. */
export async function deleteAccount() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error('Non connecté');
  await removeAllFiles('files', user.id);
  await removeAllFiles('reports', user.id);
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  await disconnectDrive();
  await supabase.auth.signOut({ scope: 'local' });
}
