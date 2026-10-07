import { AlertCircle, CheckCircle2, HelpCircle, Info, Trash2 } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { t } from '../i18n';

/** Toasts, "Are you sure?" confirmation and small alert popups, available everywhere. */
const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolver = useRef(null);
  const [alertState, setAlertState] = useState(null);
  const alertResolver = useRef(null);

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 4500 : 2800);
  }, []);

  const confirm = useCallback((opts) => {
    setConfirmState({
      title: t('common.confirmTitle'),
      confirmText: t('common.confirmDelete'),
      danger: true,
      ...(typeof opts === 'string' ? { message: opts } : opts),
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  /**
   * Small centred popup for a problem the user must read, e.g. "Only 66 jars available…".
   * alert({ title, message, icon, actionText }) resolves true if the action button was tapped.
   */
  const alert = useCallback((opts) => {
    setAlertState({ title: t('common.cannotSave'), icon: '⚠️', ...(typeof opts === 'string' ? { message: opts } : opts) });
    return new Promise((resolve) => {
      alertResolver.current = resolve;
    });
  }, []);

  const closeAlert = (value) => {
    alertResolver.current?.(value);
    alertResolver.current = null;
    setAlertState(null);
  };

  const close = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setConfirmState(null);
  };

  return (
    <UiContext.Provider value={{ toast, confirm, alert }}>
      {children}

      <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end">
        {toasts.map((x) => {
          const Ico = x.type === 'error' ? AlertCircle : x.type === 'info' ? Info : CheckCircle2;
          const tone = x.type === 'error' ? 'text-red-600' : x.type === 'info' ? 'text-brand-600' : 'text-emerald-600';
          return (
            <div
              key={x.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl bg-surface px-4 py-3 text-sm font-medium text-ink shadow-pop ring-1 ring-line"
            >
              <Ico size={18} className={`mt-px shrink-0 ${tone}`} />
              <span className="min-w-0 flex-1 leading-snug">{x.message}</span>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div className="no-print fixed inset-0 z-[70] flex animate-fade-in items-end justify-center bg-slate-950/40 p-4 backdrop-blur-[2px] sm:items-center" onClick={() => close(false)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm animate-pop-in rounded-2xl bg-surface p-5 shadow-pop ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${confirmState.danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
                {confirmState.danger ? <Trash2 size={18} /> : <HelpCircle size={18} />}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-ink">{confirmState.title}</h2>
                {confirmState.message && <p className="mt-1 text-sm leading-relaxed text-muted">{confirmState.message}</p>}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button className="btn-light" onClick={() => close(false)}>{t('common.cancel')}</button>
              <button className={confirmState.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)} autoFocus>
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertState && (
        <div className="no-print fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-slate-950/40 p-6 backdrop-blur-[2px]" onClick={() => closeAlert(false)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-xs animate-pop-in rounded-2xl bg-surface p-5 text-center shadow-pop ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-2xl ring-1 ring-amber-200">{alertState.icon}</div>
            <h2 className="mt-3 text-base font-semibold text-ink">{alertState.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{alertState.message}</p>
            <div className={`mt-5 grid gap-2 ${alertState.actionText ? 'grid-cols-2' : ''}`}>
              <button className={alertState.actionText ? 'btn-light' : 'btn-primary'} onClick={() => closeAlert(false)} autoFocus={!alertState.actionText}>
                {t('common.ok')}
              </button>
              {alertState.actionText && (
                <button className="btn-primary" onClick={() => closeAlert(true)} autoFocus>
                  {alertState.actionText}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}

export function useUi() {
  return useContext(UiContext);
}
