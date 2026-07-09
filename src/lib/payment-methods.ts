/**
 * Formats a saved `IClientPaymentMethod` for display. `details` is the same
 * opaque, per-type JSON blob the client's Payment Settings page writes
 * (shape differs by type — see each case below) — never used for real charge
 * processing (see `resolveClientCardExpiry` for why the card variant only
 * ever has a masked number/expiry, never a real PAN).
 */
export function formatPaymentMethodType(type: string): string {
  switch (type) {
    case 'CREDIT_CARD':
      return 'Credit Card';
    case 'CARD_ON_FILE':
      return 'Card on File';
    case 'ACH':
      return 'ACH Transfer';
    case 'PAYPAL':
      return 'PayPal';
    case 'CHECK':
      return 'Check';
    default:
      return type;
  }
}

export function formatPaymentMethodSummary(method: { type: string; details: string | null }): string {
  if (!method.details) return 'No details on file';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(method.details) as Record<string, unknown>;
  } catch {
    return 'No details on file';
  }

  const str = (v: unknown): string => (typeof v === 'string' ? v : '');

  switch (method.type) {
    case 'CREDIT_CARD':
    case 'CARD_ON_FILE': {
      const last4Match = /(\d{4})\D*$/.exec(str(parsed['number']));
      const expiry = str(parsed['expiry']);
      if (!last4Match) return 'Card on file';
      return `Card ending in ${last4Match[1]}${expiry ? ` (Exp ${expiry})` : ''}`;
    }
    case 'ACH': {
      const last4 = str(parsed['account']).slice(-4);
      const bank = str(parsed['bankName']);
      const prefix = bank ? `${bank} ` : '';
      return last4 ? `${prefix}Account ending in ${last4}` : `${prefix}ACH account on file`;
    }
    case 'PAYPAL':
      return str(parsed['email']) || 'PayPal account linked';
    case 'CHECK':
      return str(parsed['payee']) ? `Payee: ${str(parsed['payee'])}` : 'Check on file';
    default:
      return 'No details on file';
  }
}
