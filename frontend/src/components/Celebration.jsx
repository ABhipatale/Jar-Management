import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

// Happy moments on the delivery route:
//   kind="stop"  — a delivery was just saved: confetti burst from the top + a "Delivered!"
//                  badge with who is next (gone by itself after ~3 s);
//   kind="route" — the whole route is finished: confetti rain + a trophy card (tap to close).
// Pure CSS animation (index.css "celebrations"); a short buzz on phones that support it.

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#facc15', '#ec4899'];

function pieces(count, kind) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 120 + Math.random() * 180;
    return {
      color: COLORS[i % COLORS.length],
      left: kind === 'route' ? `${Math.random() * 100}%` : '50%',
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      round: Math.random() > 0.6,
      dx: kind === 'route' ? `${(Math.random() - 0.5) * 30}vw` : `${Math.cos(angle) * dist}px`,
      dy: `${Math.sin(angle) * dist * 0.8 + 160}px`,
      rot: `${(Math.random() - 0.5) * 900}deg`,
      dur: kind === 'route' ? `${2.4 + Math.random() * 2}s` : `${1 + Math.random() * 0.6}s`,
      delay: kind === 'route' ? `${Math.random() * 1.6}s` : `${Math.random() * 0.15}s`,
    };
  });
}

export default function Celebration({ kind, next, delivered, onClose }) {
  const bits = useMemo(() => pieces(kind === 'route' ? 110 : 46, kind), [kind]);

  useEffect(() => {
    try {
      navigator.vibrate?.(kind === 'route' ? [60, 50, 60, 50, 140] : [35, 40, 35]);
    } catch {
      /* no vibration on this device */
    }
    if (kind === 'stop') {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const confetti = (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className={kind === 'route' ? 'confetti-rain' : 'confetti-burst'}
          style={{
            position: 'absolute',
            left: b.left,
            top: kind === 'route' ? 0 : '96px',
            width: b.w,
            height: b.round ? b.w : b.h,
            borderRadius: b.round ? '9999px' : '2px',
            background: b.color,
            '--dx': b.dx,
            '--dy': b.dy,
            '--rot': b.rot,
            '--dur': b.dur,
            '--delay': b.delay,
          }}
        />
      ))}
    </div>
  );

  if (kind === 'stop') {
    return createPortal(
      <>
        {confetti}
        <div className="celebrate-badge pointer-events-none fixed left-1/2 top-[max(16px,env(safe-area-inset-top))] z-[91] w-[min(92vw,380px)]" role="status">
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-white shadow-pop ring-1 ring-white/30">
            <span className="celebrate-pop grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 text-2xl">✅</span>
            <span className="min-w-0">
              <span className="block text-base font-bold leading-tight">{t('route.celebrateStop')}</span>
              {next ? (
                <span className="block truncate text-sm text-white/90">🚚 {t('route.celebrateNext', { name: next })}</span>
              ) : (
                <span className="block text-sm text-white/90">{t('route.celebrateLast')}</span>
              )}
            </span>
          </div>
        </div>
      </>,
      document.body
    );
  }

  return createPortal(
    <>
      {confetti}
      <div className="fixed inset-0 z-[89] grid animate-fade-in place-items-center bg-slate-950/45 p-6 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-label={t('route.celebrateRoute')}>
        <div className="celebrate-pop relative w-full max-w-sm overflow-hidden rounded-3xl bg-surface p-6 text-center shadow-pop ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
          <span
            className="shine-spin pointer-events-none absolute left-1/2 top-[-140px] h-[360px] w-[360px] -translate-x-1/2 opacity-60"
            style={{ background: 'conic-gradient(from 0deg, transparent 0 20deg, #fde68a55 20deg 35deg, transparent 35deg 70deg, #fde68a55 70deg 85deg, transparent 85deg 120deg, #fde68a55 120deg 135deg, transparent 135deg 170deg, #fde68a55 170deg 185deg, transparent 185deg 220deg, #fde68a55 220deg 235deg, transparent 235deg 270deg, #fde68a55 270deg 285deg, transparent 285deg 320deg, #fde68a55 320deg 335deg, transparent 335deg)' }}
            aria-hidden="true"
          />
          <div className="trophy-bounce relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-5xl shadow-pop ring-8 ring-amber-100">🏆</div>
          <h2 className="relative mt-5 text-2xl font-extrabold tracking-tight text-ink">{t('route.celebrateRoute')}</h2>
          <p className="relative mt-1 text-sm text-muted">{t('route.celebrateRouteSub', { n: delivered })}</p>
          <div className="relative mt-3 text-2xl" aria-hidden="true">
            🎉 💧 🚚 💧 🎉
          </div>
          <button type="button" className="btn relative mt-5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-base text-white shadow-soft" onClick={onClose}>
            {t('route.celebrateSee')}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
