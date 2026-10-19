import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, Bell, CalendarClock, ChevronsLeft, ChevronsRight, CloudOff, Droplets, Home, LayoutDashboard, ListChecks,
  LogOut, Menu, MessageCircle, Monitor, Moon, Plus, PlusCircle, Receipt, Search, Settings as SettingsIcon, Sun, Users, Wallet, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import api, { errorMessage } from '../api/client';
import { discard, outboxItems, subscribe, syncOutbox } from '../lib/outbox';
import { t, tx } from '../i18n';
import { logoSrc, useBranding } from '../lib/branding';
import { businessName, businessPlace, daysUntil, fmtDate, today } from '../lib/format';
import { messages, openWhatsAppLater } from '../lib/whatsapp';
import { getTheme, setTheme } from '../lib/theme';
import { useDebounced } from '../lib/useApi';
import { DevCredit, PendingText } from './ui';

/* Phone: top bar + bottom menu + drawer. Laptop/desktop (lg+): collapsible sidebar + top bar. */

// Five items, "Entry" in the middle (Reports is in the ☰ menu).
const BOTTOM = [
  { to: '/', label: t('nav.home'), icon: Home, end: true },
  { to: '/customers', label: t('nav.customers'), icon: Users },
  { to: '/entry', label: t('nav.entry'), icon: Plus, main: true },
  { to: '/jars', label: t('nav.jars'), icon: Droplets },
  { to: '/payments', label: t('nav.payments'), icon: Wallet },
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
  const planEnding = planDays !== null && planDays >= 1 && planDays <= 3;
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
        <div className={`flex h-16 items-center gap-3 border-b border-line ${collapsed ? 'justify-center px-2' : 'px-4.5'}`}>
          <div className="grid h-10 w-9.5 shrink-0 place-items-center rounded-xl bg-surface-2 p-1 ring-1 ring-line shadow-xs">
            <img src={logoSrc(branding)} alt="" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold tracking-tight text-ink">{businessName(settings)}</div>
              <div className="truncate text-xs font-medium text-muted">{place}</div>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4.5" aria-label={t('layout.menu')}>
          {GROUPS.map((g, gi) => (
            <div key={gi}>
              {g.title && !collapsed && <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.title}</div>}
              {g.title && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-line" />}
              <div className="space-y-1">
                {g.items.map((it) => (
                  <SideLink key={it.to} item={it} collapsed={collapsed} badge={it.badge ? unread : 0} />
                ))}
              </div>
            </div>
          ))}
          <div className="pt-1">
            <SummaryButton collapsed={collapsed} />
          </div>
        </nav>
        <div className="space-y-1.5 border-t border-line p-3">
          {!collapsed && <ThemeSwitch />}
          <div className={`flex items-center gap-2.5 rounded-xl bg-surface-2/60 p-2 ring-1 ring-line/60 ${collapsed ? 'flex-col' : ''}`}>
            <span className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-sky-500 text-sm font-bold text-white shadow-xs">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-semibold text-ink">{user?.name || 'Admin'}</div>
                <div className="truncate text-xs text-muted">{user?.email}</div>
              </div>
            )}
            <button className="icon-btn hover:text-red-600" onClick={doLogout} title={t('nav.logout')} aria-label={t('nav.logout')}>
              <LogOut size={16} />
            </button>
          </div>
          <button className="icon-btn w-full" onClick={toggleCollapsed} title={collapsed ? t('layout.expand') : t('layout.collapse')} aria-label={collapsed ? t('layout.expand') : t('layout.collapse')}>
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>
      </aside>

      <div className="transition-[padding] duration-200 lg:pl-[var(--sb)]">
        {planEnding && (
          <div className="no-print pt-safe flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-[13px] font-semibold text-amber-950 shadow-xs" role="status">
            <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
            <span>{planDays === 1 ? t('plan.endsTomorrow', { date: fmtDate(planEnd) }) : t('plan.endsIn', { days: planDays, date: fmtDate(planEnd) })}</span>
            <Link to="/billing" className="ml-1 shrink-0 rounded-full bg-amber-950 px-3 py-0.5 text-xs font-bold text-amber-50 hover:bg-amber-900 transition-colors">
              {t('bill.payNow')}
            </Link>
          </div>
        )}
        {/* Super admin "logged in as" this company (support). */}
        {user?.impersonating && (
          <div className="no-print pt-safe flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-2.5 text-center text-sm font-semibold text-amber-900 ring-1 ring-amber-300">
            <span>{t('imp.banner', { name: businessName(settings) })}</span>
            <button className="btn-light btn-sm" onClick={stopImpersonating}>
              {t('imp.exit')}
            </button>
          </div>
        )}
        {/* ── Top bar ───────────────────────────────────────────────── */}
        <header className="no-print pt-safe sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-lg">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:h-16 lg:px-8">
            <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
              <div className="grid h-9 w-8.5 shrink-0 place-items-center rounded-xl bg-surface-2 p-1 ring-1 ring-line shadow-xs">
                <img src={logoSrc(branding)} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[15px] font-bold tracking-tight text-ink">{businessName(settings)}</div>
                <div className="truncate text-xs font-medium text-muted">{place}</div>
              </div>
            </Link>
            <div className="hidden max-w-md flex-1 lg:block">
              <CustomerSearch />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button className="icon-btn lg:hidden" onClick={() => setSearchOpen(true)} aria-label={t('layout.search')}>
                <Search size={19} />
              </button>
              <Link to="/notifications" className="icon-btn relative" aria-label={t('notif.title')}>
                <Bell size={19} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface shadow-xs">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              <Link to="/entry" className="btn-primary btn-sm ml-1 hidden lg:inline-flex">
                <Plus size={16} strokeWidth={2.5} /> {t('layout.newEntry')}
              </Link>
              <button className="icon-btn lg:hidden" onClick={() => setDrawer(true)} aria-label={t('layout.menu')}>
                <Menu size={20} />
              </button>
            </div>
          </div>

          {(!online || queue.length > 0) && (
            <button
              onClick={() => setShowQueue((s) => !s)}
              className={`flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-colors ${failed.length ? 'bg-red-600' : 'bg-amber-500'}`}
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
              <div className="mb-2 font-bold text-ink">{t('layout.waitingTitle')}</div>
              {queue.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-2 border-t border-line py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-ink">{q.label}</div>
                    {q.error && <div className="text-red-600 font-medium">{t('layout.notSaved', { error: q.error })}</div>}
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
          <DevCredit className="mt-12" />
        </main>
      </div>

      {/* ── Phone bottom menu ─────────────────────────────────────── */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/90 backdrop-blur-xl lg:hidden shadow-[0_-4px_24px_rgb(0_0_0/0.06)]" aria-label={t('layout.menu')}>
        <div className="mx-auto grid h-16 max-w-2xl grid-cols-5">
          {BOTTOM.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `relative flex h-16 flex-col items-center justify-end pb-2 text-[11px] font-semibold leading-none transition-colors ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-800'}`}>
              {({ isActive }) => (
                <>
                  {isActive && !n.main && <span className="absolute inset-x-6 top-0 h-[2.5px] rounded-b-full bg-brand-600 shadow-[0_1px_4px_rgb(29_69_216/0.5)]" />}
                  {n.main ? (
                    <span
                      className={`btn-glow absolute -top-5.5 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full text-white ring-4 ring-app shadow-[0_10px_22px_-4px_rgb(29_69_216/0.5)] transition active:scale-95 ${isActive ? 'brightness-110' : ''}`}
                    >
                      <Plus size={26} strokeWidth={2.8} />
                    </span>
                  ) : (
                    <n.icon size={20} strokeWidth={isActive ? 2.4 : 1.9} className="mb-1.5" />
                  )}
                  <span>{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Phone drawer ──────────────────────────────────────────── */}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 animate-fade-in bg-slate-950/50 backdrop-blur-xs lg:hidden" onClick={() => setDrawer(false)}>
          <div className="pt-safe ml-auto flex h-full w-[84%] max-w-xs animate-sheet-in flex-col rounded-l-3xl bg-surface shadow-pop ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-15 items-center justify-between border-b border-line px-4.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-sky-500 text-sm font-bold text-white shadow-xs">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-bold text-ink">{user?.name || 'Admin'}</div>
                  <div className="truncate text-xs text-muted">{user?.email}</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(false)} aria-label={t('common.close')}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto p-3.5">
              {GROUPS.map((g, gi) => (
                <div key={gi}>
                  {g.title && <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.title}</div>}
                  <div className="space-y-1">
                    {g.items.map((it) => (
                      <SideLink key={it.to} item={it} badge={it.badge ? unread : 0} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <SummaryButton onDone={() => setDrawer(false)} />
              </div>
            </nav>
            <div className="space-y-2.5 border-t border-line p-3.5 pb-6">
              <ThemeSwitch />
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30" onClick={doLogout}>
                <LogOut size={17} /> {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phone search overlay ──────────────────────────────────── */}
      {searchOpen && (
        <div className="no-print fixed inset-0 z-50 animate-fade-in bg-slate-950/50 backdrop-blur-xs lg:hidden" onClick={() => setSearchOpen(false)}>
          <div className="pt-safe animate-toast-in bg-surface p-3.5 shadow-pop rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
            <CustomerSearch autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Menu item: send today's summary (jars, cash, udhari, payments) on WhatsApp. */
function SummaryButton({ collapsed = false, onDone }) {
  const { settings } = useSettings();
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await openWhatsAppLater(null, async () => {
        const { data } = await api.get('/dashboard', { params: { from: today(), to: today() } });
        const d = data.today;
        return messages.summary(settings, { date: today(), given: d.given, returned: d.returned, cash: d.cash, udhari: d.udhari, payments: d.payments, pending: d.pending });
      });
      onDone?.();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={busy}
      title={collapsed ? t('dash.sendSummary') : undefined}
      aria-label={collapsed ? t('dash.sendSummary') : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-[#128c4a] ring-1 ring-[#1fae55]/25 transition hover:bg-[#1fae55]/10 disabled:opacity-60 dark:text-emerald-400 dark:ring-emerald-500/30 dark:hover:bg-emerald-500/10 ${collapsed ? 'justify-center' : ''}`}
    >
      {busy ? (
        <span className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
      ) : (
        <MessageCircle size={18} className="shrink-0" aria-hidden="true" />
      )}
      {!collapsed && <span className="truncate text-left">{t('dash.sendSummary')}</span>}
    </button>
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
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-150 ${collapsed ? 'justify-center px-2' : ''} ${
          isActive
            ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20'
            : 'text-slate-600 hover:bg-surface-2 hover:text-ink active:scale-[0.98] dark:text-slate-700 dark:hover:text-white'
        }`
      }
    >
      <I size={18} className="shrink-0 transition-transform duration-150 group-hover:scale-105" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {badge > 0 && (
        <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-xs ${collapsed ? 'absolute right-1 top-1' : 'ml-auto'}`}>
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
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 ring-1 ring-line" role="radiogroup" aria-label={t('theme.title')}>
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
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            theme === o.v
              ? 'bg-surface text-ink shadow-xs ring-1 ring-line'
              : 'text-muted hover:text-ink'
          }`}
        >
          <o.icon size={13.5} /> {o.label}
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
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="input !h-10 !py-2 !pl-10 text-[14.5px] rounded-xl"
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
          if (e.key === 'Escape') {
            setOpen(false);
            onDone?.();
          }
        }}
      />
      {open && q.trim() && (
        <div className="absolute z-50 mt-2 w-full animate-pop-in overflow-hidden rounded-2xl bg-surface shadow-pop ring-1 ring-line">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">{t('layout.searchEmpty')}</div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => go(c)}
                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${i === hi ? 'bg-surface-2' : ''}`}
              >
                <span className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
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
