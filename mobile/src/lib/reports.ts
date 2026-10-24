import { File as FsFile } from 'expo-file-system';
import { APP_VERSION, deviceSummary } from './appInfo';
import { supabase } from './supabase';
import { uid } from './util';

export type ReportCategory = 'bug' | 'suggestion' | 'account' | 'other';
export type ReportStatus = 'new' | 'in_progress' | 'resolved' | 'closed';

export interface Report {
  id: string;
  category: ReportCategory;
  message: string;
  status: ReportStatus;
  adminReply: string | null;
  createdAt: string;
}

/** Sends a problem report / suggestion; the optional screenshot goes to the private "reports" bucket. */
export async function sendReport(input: {
  category: ReportCategory; message: string; contactEmail?: string; screenshot?: { uri: string; mime: string };
}) {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error('Non connecté');

  let screenshotPath: string | null = null;
  if (input.screenshot) {
    const ext = input.screenshot.mime.includes('png') ? 'png' : 'jpg';
    screenshotPath = `${user.id}/${uid()}.${ext}`;
    const body = await new FsFile(input.screenshot.uri).arrayBuffer();
    const up = await supabase.storage.from('reports').upload(screenshotPath, body, { contentType: input.screenshot.mime });
    if (up.error) screenshotPath = null; // the report is still useful without the picture
  }

  const { platform, device } = deviceSummary();
  const { error } = await supabase.from('reports').insert({
    category: input.category,
    message: input.message.trim(),
    contact_email: input.contactEmail?.trim() || null,
    platform, device, app_version: APP_VERSION,
    screenshot_path: screenshotPath,
  });
  if (error) throw new Error(error.message);
}

export async function myReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports').select('id, category, message, status, admin_reply, created_at')
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, category: r.category, message: r.message, status: r.status,
    adminReply: r.admin_reply, createdAt: r.created_at,
  }));
}
