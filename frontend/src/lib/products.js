import { t } from '../i18n';
import { num, round2 } from './format';

// 30 L jars are always sold; 20 L bottles and refundable deposits are switched on per company
// by the super admin (settings.features). With both off the app looks exactly as before.

export const JAR = 'jar';
export const BOTTLE = 'bottle';

/** { bottles, deposit } — what the super admin has switched on for this company. */
export function features(settings) {
  return { bottles: Boolean(settings?.features?.bottles), deposit: Boolean(settings?.features?.deposit) };
}

/** Products the company sells. */
export function companyProducts(settings) {
  return features(settings).bottles ? [JAR, BOTTLE] : [JAR];
}

/** Products this customer takes (all the company's when no customer is chosen yet). */
export function customerProducts(customer, settings) {
  const all = companyProducts(settings);
  if (!customer || all.length === 1) return all;
  const list = all.filter((p) => (p === JAR ? customer.takes_jar !== false : Boolean(customer.takes_bottle)));
  return list.length ? list : [JAR];
}

export const productName = (p) => t(p === BOTTLE ? 'prod.bottle' : 'prod.jar');

/** "3 जार" / "2 बाटल्या". */
export const countText = (p, n) => (p === BOTTLE ? t('prod.bottlesN', { n }) : t('entry.jarsN', { n }));

/** The shop's default rate for a product. */
export const defaultRate = (settings, p) => (p === BOTTLE ? settings?.bottle_rate : settings?.default_rate) ?? '';

/** The customer's special rate, else the default. */
export function rateFor(customer, settings, p) {
  const special = customer?.[`${p}_rate`];
  return special !== null && special !== undefined ? String(special) : String(defaultRate(settings, p) || '');
}

export const depositRate = (settings, p) => num(p === BOTTLE ? settings?.bottle_deposit : settings?.jar_deposit);

/** Does this entry take / refund deposit for this customer? */
export const usesDeposit = (settings, customer) => features(settings).deposit && !customer?.no_deposit;

export const heldOf = (customer, p) => Number(p === BOTTLE ? customer?.current_bottles : customer?.current_jars) || 0;
export const depositHeldOf = (customer, p) => Number(p === BOTTLE ? customer?.bottle_deposit_held : customer?.jar_deposit_held) || 0;

/**
 * Deposit to suggest: on a give, top the customer up to (items held after) × deposit;
 * on a return, give back what is more than that (never more than they paid).
 */
export function suggestedDeposit({ settings, customer, product, heldAfter, isGive }) {
  const need = round2(Math.max(0, heldAfter) * depositRate(settings, product));
  const held = depositHeldOf(customer, product);
  return isGive ? Math.max(0, round2(need - held)) : Math.max(0, Math.min(held, round2(held - need)));
}
