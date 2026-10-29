// Lemon Squeezy webhook: signature check and mapping of a subscription event to a row of web_subscriptions.
// No imports, so it runs the same in Supabase Edge Functions (Deno) and in the Node test.

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** True when `signature` is the HMAC-SHA256 (hex) of the raw request body made with the signing secret. */
export async function validSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export interface SubscriptionRow {
  user_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'inactive';
  provider: 'lemonsqueezy';
  provider_customer_id: string | null;
  provider_subscription_id: string;
  current_period_end: string | null;
  updated_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the row to store, or null when the event is not about a subscription or has no valid user. */
export function toRow(payload: any, now = new Date()): SubscriptionRow | null {
  const event = String(payload?.meta?.event_name ?? '');
  if (!event.startsWith('subscription_') || event.startsWith('subscription_payment_')) return null;
  const userId = String(payload?.meta?.custom_data?.user_id ?? '');
  const a = payload?.data?.attributes;
  if (!UUID.test(userId) || !a || !payload?.data?.id) return null;

  const renews = a.renews_at ? new Date(a.renews_at) : null;
  const ends = a.ends_at ? new Date(a.ends_at) : null;
  let status: SubscriptionRow['status'];
  let end: Date | null;
  switch (String(a.status)) {
    case 'active':
    case 'on_trial':
    case 'past_due': // payment failed: Lemon Squeezy retries, access lasts until the period end
      status = 'active';
      end = renews ?? ends;
      break;
    case 'cancelled': // cancelled but paid until ends_at
      status = 'cancelled';
      end = ends ?? renews;
      break;
    case 'expired':
    case 'unpaid':
    case 'paused':
      status = 'expired';
      end = ends ?? now;
      break;
    default:
      status = 'inactive';
      end = null;
  }
  return {
    user_id: userId, status, provider: 'lemonsqueezy', provider_customer_id: a.customer_id != null ? String(a.customer_id) : null,
    provider_subscription_id: String(payload.data.id), current_period_end: end ? end.toISOString() : null, updated_at: now.toISOString(),
  };
}
