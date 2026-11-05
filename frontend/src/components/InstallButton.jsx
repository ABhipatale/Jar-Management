import { useEffect, useState } from 'react';
import { Download, PlusSquare, Share } from 'lucide-react';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { onInstalled, promptInstall, useInstall } from '../lib/install';
import { Modal } from './ui';

/**
 * Sidebar "Install App" button (below the summary button). Shown only when installing is
 * possible and the app is not installed yet: Android / desktop Chrome & Edge open the native
 * dialog; iPhone / iPad Safari get a short Share → Add to Home Screen guide.
 */
export default function InstallButton({ collapsed = false, onDone }) {
  const { installed, canPrompt, ios } = useInstall();
  const { toast } = useUi();
  const [help, setHelp] = useState(false); // iPhone steps

  useEffect(() => onInstalled(() => {
    toast(t('install.done'));
    setHelp(false);
  }), [toast]);

  if (installed || (!canPrompt && !ios)) return null;

  const click = async () => {
    if (!canPrompt) {
      setHelp(true);
      return;
    }
    const res = await promptInstall();
    if (res === 'dismissed') toast(t('install.later'), 'info');
    onDone?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={click}
        title={collapsed ? t('install.title') : undefined}
        aria-label={collapsed ? t('install.title') : undefined}
        className={`btn-glow flex w-full items-center gap-3 rounded-xl text-left text-white transition active:scale-[.98] ${collapsed ? 'mx-auto h-11 w-11 justify-center' : 'px-3 py-2.5'}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/20 ring-1 ring-white/25">
          <Download size={17} aria-hidden="true" />
        </span>
        {!collapsed && (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{t('install.title')}</span>
            <span className="block truncate text-[11px] font-normal text-white/80">{t('install.sub')}</span>
          </span>
        )}
      </button>

      {help && (
        <Modal title={t('install.iosTitle')} description={t('install.iosSub')} onClose={() => setHelp(false)}>
          <ol className="space-y-3">
            {[
              [Share, t('install.step1')],
              [PlusSquare, t('install.step2')],
              [Download, t('install.step3')],
            ].map(([I, text], n) => (
              <li key={n} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <I size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 text-sm text-ink"><b className="mr-1 text-muted">{n + 1}.</b>{text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t('install.iosNote')}</p>
          <button type="button" className="btn-primary mt-4 w-full py-3" onClick={() => setHelp(false)}>{t('install.ok')}</button>
        </Modal>
      )}
    </>
  );
}
