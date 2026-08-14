import { PaymentMode } from '@contracts';

export const PAYMENT_MODE_LABELS: { value: PaymentMode; label: string }[] = [
  { value: PaymentMode.CREDIT_CARD, label: 'Credit Card' },
  { value: PaymentMode.CARD_ON_FILE, label: 'Card on File' },
  { value: PaymentMode.ACH, label: 'ACH' },
  { value: PaymentMode.PAYPAL, label: 'PayPal' },
  { value: PaymentMode.CHECK, label: 'Check' },
];

export function formatPaymentMode(mode: PaymentMode | null | string): string {
  if (!mode) return '—';
  return PAYMENT_MODE_LABELS.find((p) => p.value === mode)?.label ?? String(mode);
}

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  NET_7: '7 Days Net',
  NET_15: '15 Days Net',
  NET_30: '30 Days Net',
};

export function formatPaymentTerms(terms: string | null): string {
  if (!terms) return '—';
  return PAYMENT_TERMS_LABELS[terms] ?? terms;
}

/**
 * `client.payment_details` is a mode-shaped JSON blob captured at signup / the
 * client's self-service Payment Settings page (see RegisterForm's
 * `buildPaymentDetailsJson`) — it's the actual source of truth for what the
 * client entered, unlike `card_on_file` which is only populated by the
 * (currently unreachable) tokenised card-on-file flow.
 */
export function parsePaymentDetails(
  mode: PaymentMode | null,
  raw: string | null,
): { label: string; value: string }[] {
  if (!raw) return [];
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }
  const field = (key: string): string | null => {
    const v = data[key];
    return typeof v === 'string' && v.trim() ? v : null;
  };

  switch (mode) {
    case PaymentMode.CREDIT_CARD:
      return [
        field('holder') && { label: 'Cardholder Name', value: field('holder')! },
        field('number') && { label: 'Card Last Four Digits', value: field('number')! },
        field('expiry') && { label: 'Card Expiry Date', value: field('expiry')! },
        field('zip') && { label: 'Billing ZIP / Postal', value: field('zip')! },
      ].filter((x): x is { label: string; value: string } => !!x);
    case PaymentMode.CARD_ON_FILE:
      return [
        field('holder') && { label: 'Cardholder Name', value: field('holder')! },
        field('number') && { label: 'Card Last Four Digits', value: field('number')! },
        field('expiry') && { label: 'Card Expiry Date', value: field('expiry')! },
        field('billingAddress') && { label: 'Billing Address', value: field('billingAddress')! },
        data['consent'] === true && { label: 'Card-on-File Consent', value: 'Authorized' },
      ].filter((x): x is { label: string; value: string } => !!x);
    case PaymentMode.CHECK:
      return [
        field('payee') && { label: 'Payee Name', value: field('payee')! },
        field('number') && { label: 'Check Number', value: field('number')! },
        field('routing') && { label: 'Routing Number', value: field('routing')! },
        field('account') && { label: 'Account Number', value: field('account')! },
      ].filter((x): x is { label: string; value: string } => !!x);
    case PaymentMode.PAYPAL:
      return field('email') ? [{ label: 'PayPal Email', value: field('email')! }] : [];
    case PaymentMode.ACH:
      return [
        field('holderName') && { label: 'Account Holder', value: field('holderName')! },
        field('routing') && { label: 'Routing Number', value: field('routing')! },
        field('account') && { label: 'Account Number', value: field('account')! },
      ].filter((x): x is { label: string; value: string } => !!x);
    default:
      return [];
  }
}
