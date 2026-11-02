import { Check, SkipForward } from 'lucide-react';
import { t } from '../i18n';
import { money } from '../lib/format';

// The route drawn as a winding road through a small landscape: one stop per bend, alternating
// right / left. Asphalt with white edge lines and a moving yellow centre line; the driven part
// (up to the current stop) is a green line that draws itself, and a truck drives along it to
// the current stop. Stops and name cards are HTML on the same coordinates (sharp, tappable).
// All motion is CSS (index.css "road view") and switches off for "reduce motion".

const W = 360; // drawing width (scaled to the screen)
const GAP = 124; // vertical distance between stops
const TOP = 84; // first stop below the start
const BEND = 0.62; // how round the bends are
const DECOR = ['🌳', '🌲', '🏡', '🌳', '🌴', '🌲', '🏠', '🌳'];

const pad = (n) => String(n).padStart(2, '0');
/** Length of one bend (sampled), to stop the truck a fixed distance before the current stop. */
function bendLength(a, b) {
  const c1 = { x: a.x, y: a.y + GAP * BEND };
  const c2 = { x: b.x, y: b.y - GAP * BEND };
  let len = 0;
  let prev = a;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const p = {
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    };
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}
const curve = (a, b) => `C ${a.x} ${a.y + GAP * BEND}, ${b.x} ${b.y - GAP * BEND}, ${b.x} ${b.y}`;

export default function RouteRoadView({ stops, currentIndex, onPick }) {
  const n = stops.length;
  if (!n) return null;

  const pts = stops.map((_, i) => ({ x: i % 2 === 0 ? W * 0.66 : W * 0.3, y: TOP + i * GAP }));
  const start = { x: pts[0].x, y: 14 };
  const end = { x: W * 0.5, y: pts[n - 1].y + GAP * 0.78 };
  const H = end.y + 40;

  // Driven so far: to the current stop, or to the last delivered / skipped one.
  let reached = currentIndex;
  if (reached < 0) stops.forEach((s, i) => s.status !== 'pending' && (reached = i));

  const lead = `M ${start.x} ${start.y} L ${pts[0].x} ${pts[0].y}`;
  const road = `${lead} ${pts.slice(1).map((p, i) => curve(pts[i], p)).join(' ')} ${curve(pts[n - 1], end)}`;
  const driven = reached >= 0 ? `${lead} ${pts.slice(1, reached + 1).map((p, i) => curve(pts[i], p)).join(' ')}` : '';
  const drivenLength = reached >= 0 ? pts[0].y - start.y + pts.slice(1, reached + 1).reduce((sum, p, i) => sum + bendLength(pts[i], p), 0) : 0;
  const truckStop = drivenLength > 0 ? Math.max(0, (drivenLength - 48) / drivenLength).toFixed(3) : 0;
  const from = Math.max(reached, 0);
  const ahead = `M ${pts[from].x} ${pts[from].y} ${pts.slice(from + 1).map((p, i) => curve(pts[from + i], p)).join(' ')} ${curve(pts[n - 1], end)}`;

  // Scenery on the free side of each bend (the name card takes the other side).
  const decor = pts.flatMap((p, i) => {
    const right = p.x > W / 2;
    const x = right ? W * 0.9 : W * 0.08;
    return [
      { x, y: p.y - 26, e: DECOR[i % DECOR.length], s: 22 },
      { x: right ? W * 0.12 : W * 0.88, y: p.y + GAP * 0.5, e: DECOR[(i + 3) % DECOR.length], s: 18 },
    ];
  });

  const pct = (v, of) => `${(v / of) * 100}%`;

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-emerald-50 to-lime-100 ring-1 ring-emerald-100 dark:from-slate-800 dark:via-emerald-950/60 dark:to-slate-900 dark:ring-white/10"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="rr-asphalt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#475569" />
              <stop offset="1" stopColor="#334155" />
            </linearGradient>
            <filter id="rr-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="rr-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.22" />
            </filter>
          </defs>

          {/* scenery */}
          <circle cx={W * 0.86} cy={34} r={16} fill="#fde68a" opacity="0.9" />
          <circle cx={W * 0.86} cy={34} r={24} fill="#fde68a" opacity="0.25" />
          {decor.map((d, i) => (
            <text key={i} x={d.x} y={d.y} fontSize={d.s} textAnchor="middle" dominantBaseline="central" className="road-sway" style={{ animationDelay: `${(i % 5) * 0.4}s` }}>
              {d.e}
            </text>
          ))}

          {/* road: shoulder, white edge lines, asphalt */}
          <path d={road} fill="none" stroke="#a8a29e" strokeOpacity="0.45" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" filter="url(#rr-shadow)" />
          <path d={road} fill="none" stroke="#f8fafc" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
          <path d={road} fill="none" stroke="url(#rr-asphalt)" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round" />

          {/* road ahead: moving yellow centre line */}
          <path d={ahead} fill="none" stroke="#facc15" strokeWidth="3" strokeDasharray="14 10" strokeLinecap="round" className="road-dash" />

          {/* driven so far: green line that draws itself */}
          {driven && (
            <path d={driven} pathLength="1" fill="none" stroke="#22c55e" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" filter="url(#rr-glow)" className="road-draw" />
          )}

          {/* start gate and finish line */}
          <g transform={`translate(${start.x} ${start.y + 4})`}>
            <rect x="-24" y="-4" width="48" height="8" rx="2" fill="#0f172a" opacity="0.85" />
          </g>
          <g transform={`translate(${end.x} ${end.y})`}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect key={i} x={-21 + i * 7} y={-4} width="7" height="4" fill={i % 2 ? '#0f172a' : '#fff'} />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect key={`b${i}`} x={-21 + i * 7} y={0} width="7" height="4" fill={i % 2 ? '#fff' : '#0f172a'} />
            ))}
            <text y="22" fontSize="20" textAnchor="middle" dominantBaseline="central">🏁</text>
          </g>

          {/* the truck: drives along the green line and stops just before the current stop */}
          <g>
            {driven ? (
              <animateMotion dur="1.6s" begin="0s" fill="freeze" path={driven} keyPoints={`0;${truckStop}`} keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
            ) : null}
            <g transform={driven ? 'translate(0 0)' : `translate(${start.x} ${start.y + 30})`}>
              <g className="road-bob">
                <ellipse cx="0" cy="18" rx="13" ry="3.5" fill="#0f172a" opacity="0.18" />
                <text fontSize="26" textAnchor="middle" dominantBaseline="central">🚚</text>
              </g>
            </g>
          </g>
        </svg>

        {stops.map((s, i) => {
          const p = pts[i];
          const right = p.x > W / 2;
          const done = s.status === 'done';
          const skipped = s.status === 'skipped';
          const current = i === currentIndex;
          const delay = `${0.15 + i * 0.07}s`;
          const node = done
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white ring-white'
            : current
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white ring-white'
              : skipped
                ? 'bg-slate-500 text-white ring-white'
                : 'bg-white text-slate-800 ring-white';
          const card = current
            ? 'bg-white ring-2 ring-blue-500 shadow-pop dark:bg-slate-800'
            : done
              ? 'bg-white/95 ring-1 ring-emerald-300 dark:bg-slate-800/95'
              : skipped
                ? 'bg-white/80 ring-1 ring-slate-200 dark:bg-slate-800/80'
                : 'bg-white/95 ring-1 ring-slate-200 dark:bg-slate-800/95 dark:ring-white/10';
          const icon = done ? '✅' : skipped ? '⏭' : current ? '📍' : '🏠';
          const sub = done
            ? `${t('route.jarsN', { n: s.delivered?.jars ?? s.quantity })}${s.done_at ? ` · ${s.done_at}` : ''}`
            : skipped
              ? t(`route.reason.${s.skip_reason || 'other'}`)
              : `💧 ${t('route.jarsN', { n: s.quantity })}${s.pending_amount > 0 ? ` · ${money(s.pending_amount)}` : ''}`;

          return (
            <div key={s.id ?? `p${s.customer_id}`}>
              {current && (
                <span className="pointer-events-none absolute z-[1] h-14 w-14 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(p.x, W), top: pct(p.y, H) }} aria-hidden="true">
                  <span className="road-pulse absolute inset-0 rounded-full bg-blue-500/50" />
                  <span className="road-pulse absolute inset-0 rounded-full bg-blue-500/40" style={{ animationDelay: '0.8s' }} />
                </span>
              )}
              <button
                type="button"
                onClick={onPick ? () => onPick(i) : undefined}
                disabled={!onPick}
                className={`road-node absolute z-[3] grid place-items-center rounded-full font-bold tabular-nums shadow-pop ring-4 ${current ? 'h-14 w-14 text-base' : 'h-11 w-11 text-sm'} ${node}`}
                style={{ left: pct(p.x, W), top: pct(p.y, H), animationDelay: delay }}
                aria-label={`${pad(i + 1)} ${s.name}`}
              >
                {done ? <Check size={20} strokeWidth={3} /> : skipped ? <SkipForward size={17} /> : pad(i + 1)}
              </button>
              <button
                type="button"
                onClick={onPick ? () => onPick(i) : undefined}
                disabled={!onPick}
                className={`road-card absolute z-[2] flex max-w-[56%] items-center gap-2 rounded-2xl py-1.5 pl-2 pr-3 text-left shadow-soft backdrop-blur ${card}`}
                style={{
                  ...(right ? { right: pct(W - p.x + (current ? 34 : 30), W) } : { left: pct(p.x + (current ? 34 : 30), W) }),
                  top: pct(p.y, H),
                  animationDelay: `calc(${delay} + 0.12s)`,
                }}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base ${done ? 'bg-emerald-50' : current ? 'bg-blue-50' : 'bg-slate-50 dark:bg-white/5'}`}>{icon}</span>
                <span className="min-w-0">
                  <span className={`block truncate text-[13px] font-bold leading-tight ${skipped ? 'text-slate-400 line-through' : current ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>{s.name}</span>
                  <span className={`block truncate text-[11px] font-medium ${done ? 'text-emerald-600' : current ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}>{sub}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-muted">
        {[
          ['bg-gradient-to-br from-emerald-400 to-emerald-600', t('route.done')],
          ['bg-gradient-to-br from-blue-500 to-indigo-600', t('route.nowLabel')],
          ['bg-white ring-1 ring-slate-300', t('route.pending')],
          ['bg-slate-500', t('route.skipped')],
        ].map(([cls, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${cls}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
