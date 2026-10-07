import { useId, useState } from 'react';

/* Small, dependency-free SVG charts (fast on phones, follow light/dark tokens). */

/** Tiny trend line for KPI cards. */
export function Sparkline({ data, color = '#3b6ff6', className = 'h-8 w-20' }) {
  const id = useId();
  const n = data.length;
  if (n < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [(i / (n - 1)) * 100, 28 - ((v - min) / range) * 24]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,30 L0,30 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Grouped bar chart with hover/tap tooltip.
 *   series: [{ name, color, values: number[] }], labels: string[]
 *   format: value → string (tooltip / axis)
 */
export function BarChart({ labels, series, height = 180, format = (v) => String(v), ariaLabel }) {
  const [active, setActive] = useState(null);
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = niceMax(max);
  const ticks = [0, nice / 2, nice];
  const groupW = 100 / Math.max(n, 1);
  const barW = (groupW * 0.72) / series.length;

  return (
    <div className="relative" role="img" aria-label={ariaLabel}>
      <div className="flex gap-2">
        {/* y-axis */}
        <div className="flex flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-muted" style={{ height }}>
          {[...ticks].reverse().map((v) => (
            <span key={v}>{format(v)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height: height - 20 }}>
            {ticks.map((v) => {
              const y = (height - 20) * (1 - v / nice);
              return <line key={v} x1="0" x2="100" y1={y} y2={y} stroke="var(--app-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={v ? '3 3' : undefined} />;
            })}
            {labels.map((_, i) =>
              series.map((s, si) => {
                const v = s.values[i] || 0;
                const h = ((height - 20) * v) / nice;
                const x = i * groupW + groupW * 0.14 + si * barW;
                return (
                  <rect
                    key={`${i}-${si}`}
                    x={x}
                    y={height - 20 - h}
                    width={Math.max(barW - 0.4, 0.4)}
                    height={Math.max(h, v ? 1 : 0)}
                    rx="0.6"
                    fill={s.color}
                    opacity={active === null || active === i ? 1 : 0.35}
                    className="transition-opacity"
                  />
                );
              })
            )}
          </svg>
          {/* hit areas for hover / tap */}
          <div className="absolute inset-x-0 top-0 flex" style={{ height: height - 20 }}>
            {labels.map((l, i) => (
              <button
                type="button"
                key={l + i}
                className="h-full flex-1 cursor-default focus:outline-none"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
                aria-label={`${l}: ${series.map((s) => `${s.name} ${format(s.values[i] || 0)}`).join(', ')}`}
              />
            ))}
          </div>
          {/* x labels (thinned out on small screens) */}
          <div className="mt-1 flex text-[10px] text-muted">
            {labels.map((l, i) => (
              <span key={l + i} className="flex-1 truncate text-center">
                {n <= 8 || i % Math.ceil(n / 7) === 0 || i === n - 1 ? l : ''}
              </span>
            ))}
          </div>
          {active !== null && (
            <div
              className="pointer-events-none absolute top-1 z-10 min-w-32 animate-fade-in rounded-lg bg-surface px-3 py-2 text-xs shadow-pop ring-1 ring-line"
              style={{ left: `clamp(0px, calc(${((active + 0.5) / n) * 100}% - 64px), calc(100% - 128px))` }}
            >
              <div className="mb-1 font-semibold text-ink">{labels[active]}</div>
              {series.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">{format(s.values[active] || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One horizontal bar split into segments + legend (e.g. jar stock). */
export function StackBar({ segments, total }) {
  const sum = total || segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        {segments.map((s) =>
          s.value > 0 ? <div key={s.label} className="h-full transition-all duration-500" style={{ width: `${(s.value / sum) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} /> : null
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
