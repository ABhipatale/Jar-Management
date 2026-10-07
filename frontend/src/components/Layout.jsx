import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, Bell, CalendarClock, ChevronsLeft, ChevronsRight, CloudOff, Droplets, Home, LayoutDashboard, ListChecks,
  LogOut, Menu, Monitor, Moon, Plus, PlusCircle, Receipt, Search, Settings as SettingsIcon, Sun, Users, Wallet, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import api from '../api/client';
import { discard, outboxItems, subscribe, syncOutbox } from '../lib/outbox';
import { t, tx } from '../i18n';
import { logoSrc, useBranding } from '../lib/branding';
import { businessName, businessPlace, daysUntil, fmtDate } from '../lib/format';
import { getTheme, setTheme } from '../lib/theme';
import { useDebounced } from '../lib/useApi';
import { DevCredit, PendingText } from './ui';

/* Phone: top bar + bottom menu + drawer. Laptop/desktop (lg+): collapsible sidebar + top bar. */

const BOTTOM = [
  { to: '/', label: t('nav.home'), icon: Home, end: true },
  { to: '/customers', label: t('nav.customers'), icon: Users },
  { to: '/jars', label: t('nav.jars'), icon: Droplets },
  { to: '/entry', label: t('nav.entry'), icon: Plus, main: true },
  { to: '/payments', label: t('nav.payments'), icon: Wallet },
  { to: '/reports', label: t('nav.reports'), icon: BarChart3 },
];

const GROUPS = [
  {
    title: null,
    items: [
      { to: '/', label: t('nav.home'), icon: LayoutDashboard, end: true },
      { to: '/entry', label: t('nav.entry'), icon: PlusCircle },
      { to: '/customers', label: t('nav.customers'), icon: Users },
      { to: '/payments', label: t('nav.payments'), icon: Wallet },
    ],
  },
  {
    title: t('nav.groupJars'),
    items: [
      { to: '/bookings', label: t('book.title'), icon: CalendarClock },
      { to: '/jars', label: t('nav.jars'), icon: Droplets },
      { to: '/transactions', label: t('nav.allJarEntries'), icon: ListChecks },
    ],
  },
  {
    title: t('nav.groupMoney'),
    items: [
      { to: '/reports', label: t('nav.reports'), icon: BarChart3 },
      { to: '/expenses', label: t('nav.expenses'), icon: Receipt },
    ],
  },
  {
    title: t('nav.groupSystem'),
    items: [
      { to: '/notifications', label: t('notif.title'), icon: Bell, badge: true },
      { to: '/settings', label: t('nav.settings'), icon: SettingsIcon },
    ],
  },
];

const SB_KEY = 'rws_sidebar_collapsed';

export default function Layout() {
  const { settings } = useSettings();
  const { user, logout, stopImpersonating } = useAuth();
  const branding = useBranding();
  const place = [businessPlace(settings), t('common.jarMgmt')].filter(Boolean).join(' · ');
  // Last 3 days of the company's plan: a "please pay" line on every screen.
  const planEnd = user?.company?.expires_at;
  const planDays = planEnd ? daysUntil(planEnd) : null;
  const planEnding = !user?.company?.auto_renew && planDays !== null && planDays >= 1 && planDays <= 3;
  const { toast, confirm } = useUi();
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState(outboxItems);
  const [showQueue, setShowQueue] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SB_KEY) === '1';
    } catch {
      return false;
    }
  });
  const location = useLocation();

  useEffect(() => {
    setDrawer(false);
    setSearchOpen(false);
    window.scrollTo?.(0, 0);
  }, [location.pathname]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(SB_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });

  // 🔔 open due reminders + today's bookings (also lets the server process them).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const load = () => api.get('/notifications/count').then((r) => setUnread(r.data.unread)).catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    window.addEventListener('rws:notifications', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('rws:notifications', load);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribe(setQueue);
    const trySync = async () => {
      const n = await syncOutbox();
      if (n) toast(t(n === 1 ? 'layout.syncedOne' : 'layout.synced', { n }));
    };
    const on = () => {
      setOnline(true);
      trySync();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    trySync();
    const timer = setInterval(trySync, 30000);
    return () => {
      unsub();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(timer);
    };
  }, [toast]);

  const failed = queue.filter((q) => q.error);

  const doLogout = async () => {
    setDrawer(false);
    if (queue.length && !(await confirm({ message: t('layout.logoutConfirm'), confirmText: t('nav.logout') }))) return;
    logout();
  };

  return (
    <div className="min-h-dvh bg-app" style={{ '--sb': collapsed ? '72px' : '248px' }}>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[var(--sb)] flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex">
        <div className={`flex h-16 items-center gap-2.5 border-b border-line ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
          <img src={logoSrc(branding)} alt="" className="h-9 w-8 shrink-0 rounded-md object-contain" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold text-ink">{businessName(settings)}</div>
              <div className="truncate text-xs text-muted">{place}</div>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label={t('layout.menu')}>
          {GROUPS.map((g, gi) => (
            <div key={gi}>
              {g.title && !collapsed && <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</div>}
              {g.title && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-line" />}
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <SideLink key={it.to} item={it} collapsed={collapsed} badge={it.badge ? unread : 0} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          {!collapsed && <ThemeSwitch />}
          <div className={`flex items-center gap-2.5 rounded-lg p-1.5 ${collapsed ? 'flex-col' : ''}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-medium text-ink">{user?.name || 'Admin'}</div>
                <div className="truncate text-xs text-muted">{user?.email}</div>
              </div>
            )}
            <button className="icon-btn" onClick={doLogout} title={t('nav.logout')} aria-label={t('nav.logout')}>
              <LogOut size={17} />
            </button>
          </div>
          <button className="icon-btn w-full" onClick={toggleCollapsed} title={collapsed ? t('layout.expand') : t('layout.collapse')} aria-label={collapsed ? t('layout.expand') : t('layout.collapse')}>
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
      </aside>

      <div className="transition-[padding] duration-200 lg:pl-[var(--sb)]">
        {planEnding && (
          <div className="no-print pt-safe flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-[13px] font-semibold text-amber-950" role="status">
            <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
            <span>{planDays === 1 ? t('plan.endsTomorrow', { date: fmtDate(planEnd) }) : t('plan.endsIn', { days: planDays, date: fmtDate(planEnd) })}</span>
            <Link to="/billing" className="ml-1 shrink-0 rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-semibold text-amber-50 hover:bg-amber-900">
              {t('bill.payNow')}
            </Link>
          </div>
        )}
        {/* Super admin "logged in as" this company (support). */}
        {user?.impersonating && (
          <div className="no-print pt-safe flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 ring-1 ring-amber-300">
            <span>{t('imp.banner', { name: businessName(settings) })}</span>
            <button className="btn-light btn-sm" onClick={stopImpersonating}>
              {t('imp.exit')}
            </button>
          </div>
        )}
        {/* ── Top bar ───────────────────────────────────────────────── */}
        <header className="no-print pt-safe sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 lg:h-16 lg:px-8">
            <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
              <img src={logoSrc(branding)} alt="" className="h-9 w-8 shrink-0 rounded-md object-contain" />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[15px] font-semibold text-ink">{businessName(settings)}</div>
                <div className="truncate text-xs text-muted">{place}</div>
              </div>
            </Link>
            <div className="hidden max-w-md flex-1 lg:block">
              <CustomerSearch />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button className="icon-btn lg:hidden" onClick={() => setSearchOpen(true)} aria-label={t('layout.search')}>
                <Search size={20} />
              </button>
              <Link to="/notifications" className="icon-btn relative" aria-label={t('notif.title')}>
                <Bell size={20} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              <Link to="/entry" className="btn-primary btn-sm ml-1 hidden lg:inline-flex">
                <Plus size={16} /> {t('layout.newEntry')}
              </Link>
              <button className="icon-btn lg:hidden" onClick={() => setDrawer(true)} aria-label={t('layout.menu')}>
                <Menu size={21} />
              </button>
            </div>
          </div>

          {(!online || queue.length > 0) && (
            <button
              onClick={() => setShowQueue((s) => !s)}
              className={`flex w-full items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium text-white ${failed.length ? 'bg-red-600' : 'bg-amber-500'}`}
            >
              <CloudOff size={15} />
              {!online ? tx('layout.offline') : ''}
              {queue.length > 0 && `${t(queue.length === 1 ? 'layout.waitingOne' : 'layout.waiting', { n: queue.length })}${failed.length ? t('layout.needAttention', { n: failed.length }) : ''} ›`}
            </button>
          )}
        </header>

        {showQueue && queue.length > 0 && (
          <div className="no-print mx-auto mt-4 max-w-6xl px-4 lg:px-8">
            <div className="card ring-amber-300">
              <div className="mb-2 font-semibold">{t('layout.waitingTitle')}</div>
              {queue.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-2 border-t border-line py-2 text-sm">
                  <div>
                    <div>{q.label}</div>
                    {q.error && <div className="text-red-600">{t('layout.notSaved', { error: q.error })}</div>}
                  </div>
                  {q.error && (
                    <button className="btn-light btn-sm" onClick={() => discard(q.id)}>
                      {t('layout.discard')}
                    </button>
                  )}
                </div>
              ))}
              <p className="mt-2 text-xs text-muted">{t('layout.syncNote')}</p>
            </div>
          </div>
        )}

        <main className="main-above-nav mx-auto max-w-6xl px-4 pt-5 lg:px-8 lg:pt-7">
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
          <DevCredit className="mt-10" />
        </main>
      </div>

      {/* ── Phone bottom menu ─────────────────────────────────────── */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden" aria-label={t('layout.menu')}>
        <div className="mx-auto grid h-16 max-w-2xl grid-cols-6">
          {BOTTOM.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `relative flex h-16 flex-col items-center justify-end pb-2 text-[11px] font-medium leading-none ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
              {({ isActive }) => (
                <>
                  {isActive && !n.main && <span className="absolute inset-x-5 top-0 h-[2.5px] rounded-b-full bg-brand-600" />}
                  {n.main ? (
                    <span className={`absolute -top-3 left-1/2 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full text-white shadow-pop ring-[3px] ring-surface ${isActive ? 'bg-brand-700' : 'bg-brand-600'}`}>
                      <Plus size={22} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <n.icon size={21} strokeWidth={isActive ? 2.3 : 1.9} className="mb-1.5" />
                  )}
                  <span className={isActive ? 'font-semibold' : ''}>{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Phone drawer ──────────────────────────────────────────── */}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 animate-fade-in bg-slate-950/40 backdrop-blur-[2px] lg:hidden" onClick={() => setDrawer(false)}>
          <div className="pt-safe ml-auto flex h-full w-[82%] max-w-xs animate-sheet-in flex-col bg-surface shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold text-ink">{user?.name || 'Admin'}</div>
                  <div className="truncate text-xs text-muted">{user?.email}</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(false)} aria-label={t('common.close')}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto p-3">
              {GROUPS.map((g, gi) => (
                <div key={gi}>
                  {g.title && <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</div>}
                  {g.items.map((it) => (
                    <SideLink key={it.to} item={it} badge={it.badge ? unread : 0} />
                  ))}
                </div>
              ))}
            </nav>
            <div className="space-y-2 border-t border-line p-3 pb-6">
              <ThemeSwitch />
              <button className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50" onClick={doLogout}>
                <LogOut size={18} /> {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phone search overlay ──────────────────────────────────── */}
      {searchOpen && (
        <div className="no-print fixed inset-0 z-50 animate-fade-in bg-slate-950/40 backdrop-blur-[2px] lg:hidden" onClick={() => setSearchOpen(false)}>
          <div className="pt-safe animate-toast-in bg-surface p-3 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <CustomerSearch autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function SideLink({ item, collapsed = false, badge = 0 }) {
  const I = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition ${collapsed ? 'justify-center' : ''} ${
          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-surface-2 hover:text-ink'
        }`
      }
    >
      <I size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {badge > 0 && (
        <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ${collapsed ? 'absolute right-1 top-0.5' : 'ml-auto'}`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

/** Light / dark / auto switch (saved on this device). */
export function ThemeSwitch() {
  const [theme, setThemeState] = useState(getTheme);
  const opts = [
    { v: 'light', icon: Sun, label: t('theme.light') },
    { v: 'dark', icon: Moon, label: t('theme.dark') },
    { v: 'auto', icon: Monitor, label: t('theme.auto') },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 ring-1 ring-line" role="radiogroup" aria-label={t('theme.title')}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={theme === o.v}
          title={o.label}
          onClick={() => {
            setTheme(o.v);
            setThemeState(o.v);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${theme === o.v ? 'bg-surface text-ink shadow-soft ring-1 ring-line' : 'text-slate-500 hover:text-ink'}`}
        >
          <o.icon size={14} /> {o.label}
        </button>
      ))}
    </div>
  );
}

/** Find a customer by name or mobile from anywhere. */
function CustomerSearch({ autoFocus = false, onDone }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [hi, setHi] = useState(0);
  const dq = useDebounced(q, 200);
  const navigate = useNavigate();
  const box = useRef(null);

  useEffect(() => {
    if (!dq.trim()) {
      setResults([]);
      return;
    }
    let live = true;
    api
      .get('/customers', { params: { search: dq } })
      .then((r) => live && (setResults(r.data.data.slice(0, 7)), setHi(0)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [dq]);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const go = (c) => {
    setQ('');
    setOpen(false);
    onDone?.();
    navigate(`/customers/${c.id}`);
  };

  return (
    <div className="relative" ref={box}>
      <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="input !py-2 !pl-9 text-[15px]"
        type="search"
        autoFocus={autoFocus}
        value={q}
        placeholder={t('layout.search')}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setHi((h) => Math.min(h + 1, results.length - 1));
          if (e.key === 'ArrowUp') setHi((h) => Math.max(h - 1, 0));
          if (e.key === 'Enter' && results[hi]) go(results[hi]);
          if (e.key === 'Escape') (setOpen(false), onDone?.());
        }}
      />
      {open && q.trim() && (
        <div className="absolute z-50 mt-1.5 w-full animate-pop-in overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-line">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">{t('layout.searchEmpty')}</div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => go(c)}
                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${i === hi ? 'bg-surface-2' : ''}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{c.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                  <span className="block text-xs text-muted">{c.mobile}</span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block text-muted">
                    <Droplets size={11} className="mr-0.5 inline" />
                    {c.current_jars}
                  </span>
                  <PendingText amount={c.pending_amount} />
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
