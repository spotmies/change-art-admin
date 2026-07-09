export type CardExpiryStatus = 'expired' | 'expiring_soon' | 'ok';

/**
 * Resolves a client's card expiry for expiry-warning purposes.
 * `card_exp_month`/`card_exp_year` (the real tokenized card flow) are never
 * actually set by any reachable UI today — clients only ever set their
 * expiry through the self-reported Payment Settings page, which stores it as
 * an opaque `payment_details` JSON blob (`{ expiry: "MM/YY", ... }`). Prefer
 * the real columns if they're ever populated; otherwise parse the
 * self-reported blob when the client's payment mode is a card.
 */
export function resolveClientCardExpiry(client: {
  card_on_file?: { exp_month: number; exp_year: number } | null;
  payment_mode?: string | null;
  payment_details?: string | null;
}): { exp_month: number; exp_year: number } | null {
  if (client.card_on_file) return client.card_on_file;
  if (client.payment_mode !== 'CREDIT_CARD' && client.payment_mode !== 'CARD_ON_FILE') return null;
  if (!client.payment_details) return null;
  try {
    const parsed = JSON.parse(client.payment_details) as { expiry?: string };
    const match = /^(\d{2})\/(\d{2})$/.exec(parsed.expiry ?? '');
    if (!match) return null;
    return { exp_month: Number(match[1]), exp_year: 2000 + Number(match[2]) };
  } catch {
    return null;
  }
}

export interface ClientCardSummary {
  last4: string | null;
  exp_month: number;
  exp_year: number;
  brand: string | null;
}

/**
 * Full display summary of a client's card — same source-of-truth precedence
 * as `resolveClientCardExpiry` (real `card_on_file` first, then the
 * self-reported `payment_details` blob), but also carries the masked last-4
 * and brand for UI that needs to show more than just the expiry, e.g.
 * "Card ending in 6858 (Exp 08/26)" on the client detail page.
 */
export function resolveClientCardSummary(client: {
  card_on_file?: { brand?: string | null; last4: string; exp_month: number; exp_year: number } | null;
  payment_mode?: string | null;
  payment_details?: string | null;
}): ClientCardSummary | null {
  if (client.card_on_file) {
    return {
      last4: client.card_on_file.last4,
      exp_month: client.card_on_file.exp_month,
      exp_year: client.card_on_file.exp_year,
      brand: client.card_on_file.brand ?? null,
    };
  }
  if (client.payment_mode !== 'CREDIT_CARD' && client.payment_mode !== 'CARD_ON_FILE') return null;
  if (!client.payment_details) return null;
  try {
    const parsed = JSON.parse(client.payment_details) as { number?: string; expiry?: string; brand?: string };
    const match = /^(\d{2})\/(\d{2})$/.exec(parsed.expiry ?? '');
    if (!match) return null;
    const last4Match = /(\d{4})\D*$/.exec(parsed.number ?? '');
    return {
      last4: last4Match ? last4Match[1] : null,
      exp_month: Number(match[1]),
      exp_year: 2000 + Number(match[2]),
      brand: parsed.brand && parsed.brand !== 'generic' ? parsed.brand : null,
    };
  } catch {
    return null;
  }
}

/**
 * A card is valid through the end of its expiry month (e.g. exp 08/2026
 * covers through Aug 31, 2026). "Expiring soon" means it lapses this
 * calendar month or next (e.g. today is any day in July 2026 and the card
 * expires in July or August 2026) — a fixed calendar-month comparison, not a
 * rolling "N days from now" window. A rolling 30-day window would miss a
 * card expiring Aug 31 when checked from early July, even though "expires
 * next month" is exactly true in plain calendar terms.
 */
export function getCardExpiryStatus(
  card: { exp_month: number; exp_year: number } | null | undefined,
): CardExpiryStatus | null {
  if (!card) return null;
  const now = new Date();
  const endOfMonth = new Date(card.exp_year, card.exp_month, 0, 23, 59, 59, 999);
  if (endOfMonth.getTime() < now.getTime()) return 'expired';

  const nowMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const expMonthIndex = card.exp_year * 12 + (card.exp_month - 1);
  if (expMonthIndex - nowMonthIndex <= 1) return 'expiring_soon';
  return 'ok';
}
