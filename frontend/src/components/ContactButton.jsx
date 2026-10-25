import { useState } from 'react';
import { Contact } from 'lucide-react';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { pickContact } from '../lib/contacts';

/**
 * Square "pick from phone contacts" button. Calls onPick({ name, mobiles }) after a contact
 * with at least one valid mobile is chosen. Cancelling does nothing; problems show a toast.
 * size="sm": a small icon button that sits inside an input (e.g. the customer search box).
 */
export default function ContactButton({ onPick, className = '', size = 'md' }) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const c = await pickContact();
      if (!c) return; // cancelled: leave the form as it is
      if (!c.mobiles.length) return toast(t('contact.noMobile'), 'error');
      await onPick(c);
    } catch (err) {
      toast(err?.message === 'unsupported' ? t('contact.unsupported') : t('contact.error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className={`grid shrink-0 place-items-center bg-brand-50 text-brand-700 transition hover:bg-brand-100 active:scale-95 disabled:opacity-60 ${
        size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-12 w-12 rounded-xl ring-1 ring-inset ring-brand-500/25'
      } ${className}`}
      aria-label={t('contact.pick')}
      title={t('contact.pick')}
    >
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600/30 border-t-brand-600" aria-hidden="true" /> : <Contact size={size === 'sm' ? 18 : 21} aria-hidden="true" />}
    </button>
  );
}
