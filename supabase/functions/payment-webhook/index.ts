// Supabase Edge Function: receives Lemon Squeezy subscription webhooks and updates public.web_subscriptions.
// Deploy:  supabase functions deploy payment-webhook --no-verify-jwt
// Secrets: supabase secrets set LEMON_SIGNING_SECRET=<signing secret of the webhook>
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { toRow, validSignature } from './lemonsqueezy.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get('x-signature'), Deno.env.get('LEMON_SIGNING_SECRET') ?? ''))) {
    return new Response('Invalid signature', { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const row = toRow(payload);
  if (!row) return new Response('Ignored', { status: 200 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { error } = await db.from('web_subscriptions').upsert(row, { onConflict: 'user_id' });
  if (error) return new Response(error.message, { status: 500 }); // Lemon Squeezy retries on 5xx
  return new Response('ok', { status: 200 });
});
