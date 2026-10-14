"use client";

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, Notification } from '@/components/providers/notification-provider';
import { cn } from '@/lib/utils';

/* ============================================================================
 * Helpers
 * ========================================================================== */
type Tab = 'all' | 'unread' | 'nt' | 'production';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function dayLabel(d: Date) {
  const today = day0(new Date());
  const t = day0(d);
  if (t === today) return 'Hoje';
  if (t === today - 86400000) return 'Ontem';
  if (today - t < 7 * 86400000) return DIAS[d.getDay()];
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

const NT_TYPES = ['nt_created', 'nt_updated', 'nt_deleted', 'item_paid'];

// Tipo → cor do ponto e rótulo curto (sem caixas coloridas)
const TYPE_META: Record<string, { c: string; l: string }> = {
  nt_created: { c: 'var(--accent)', l: 'Nova NT' },
  nt_updated: { c: 'var(--amber)', l: 'NT alterada' },
  nt_deleted: { c: 'var(--red)', l: 'NT excluída' },
  item_paid: { c: 'var(--green)', l: 'Item pago' },
  production_updated: { c: 'var(--text-2)', l: 'Produção' },
  chat_mention: { c: 'var(--accent)', l: 'Menção' },
};
const typeMeta = (t: string) => TYPE_META[t] || { c: 'var(--text-3)', l: 'Aviso' };

// Só considera número de NT quando vem marcado (parte "entity", "NT 123", "#123" ou entityId numérico)
function ntOf(n: Notification): string {
  const ent = n.parts?.find((p) => p.variant === 'entity' && /\d{4,10}/.test(p.text));
  if (ent) return ent.text.replace(/\D/g, '');
  const m = n.message?.match(/NT\s*#?(\d{4,10})/i) || n.message?.match(/#(\d{4,10})/);
  if (m) return m[1];
  if (n.entityId && /^\d{4,10}$/.test(n.entityId)) return n.entityId;
  return '';
}

/* ============================================================================
 * Componente
 * ========================================================================== */
export const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications, notificationsEnabled } =
    useNotifications();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [bump, setBump] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const prevUnread = useRef(unreadCount);

  // Pulso no contador quando chega notificação nova
  useEffect(() => {
    const grew = unreadCount > prevUnread.current;
    prevUnread.current = unreadCount; // atualiza sempre (antes ficava preso quando crescia)
    if (!grew) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 500);
    return () => clearTimeout(t);
  }, [unreadCount]);

  // Fechar ao clicar fora / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.activeElement === searchRef.current && q) setQ('');
      else setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, q]);

  useEffect(() => {
    if (!open) setConfirmClear(false);
  }, [open]);

  /* ---------------- dados ---------------- */
  const counts = useMemo(
    () => ({
      all: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
      nt: notifications.filter((n) => NT_TYPES.includes(n.type)).length,
      production: notifications.filter((n) => n.type === 'production_updated').length,
    }),
    [notifications]
  );

  const list = useMemo(() => {
    let l = notifications;
    if (tab === 'unread') l = l.filter((n) => !n.read);
    else if (tab === 'nt') l = l.filter((n) => NT_TYPES.includes(n.type));
    else if (tab === 'production') l = l.filter((n) => n.type === 'production_updated');
    const s = q.trim().toLowerCase();
    if (s) {
      l = l.filter((n) =>
        [n.title, n.message, n.entityId, ...(n.parts || []).map((p) => p.text)].join(' ').toLowerCase().includes(s)
      );
    }
    return [...l].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, tab, q]);

  /* ---------------- ações ---------------- */
  const go = (n: Notification, nt?: string) => {
    if (!n.read) markAsRead(n.id);
    const code = nt ?? ntOf(n);
    if (code) router.push(`/almoxarifado/nts?search=${encodeURIComponent(code)}`);
    else if (NT_TYPES.includes(n.type)) router.push('/almoxarifado/nts');
    else if (n.type === 'production_updated') router.push('/producao');
    else return; // sem destino: só marca como lida e mantém o painel aberto
    setOpen(false);
  };

  const NtChip = ({ n, code, label }: { n: Notification; code: string; label: string }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        go(n, code);
      }}
      title={`Abrir NT ${code}`}
      className="font-mono text-[11.5px] px-1 mx-0.5 rounded-[3px] border border-[var(--border-strong)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {label}
    </button>
  );

  const body = (n: Notification) => {
    if (n.parts?.length) {
      return n.parts.map((p, i) => {
        if (p.variant === 'entity' && /\d{4,10}/.test(p.text)) {
          return <NtChip key={i} n={n} code={p.text.replace(/\D/g, '')} label={p.text} />;
        }
        return (
          <span
            key={i}
            className={cn(
              p.variant === 'actor' && 'font-medium text-[var(--text)]',
              p.variant === 'entity' && 'font-medium text-[var(--text)]',
              p.variant === 'accent' && 'font-medium text-[var(--text)]',
              p.variant === 'status-success' && 'text-[var(--green)]',
              p.variant === 'status-warning' && 'text-[var(--amber)]',
              p.variant === 'muted' && 'text-[var(--text-3)]'
            )}
          >
            {p.text}
          </span>
        );
      });
    }
    const m = n.message?.match(/NT\s*#?(\d{4,10})/i) || n.message?.match(/#(\d{4,10})/);
    if (m) {
      const [a, ...rest] = n.message.split(m[0]);
      return (
        <>
          {a}
          <NtChip n={n} code={m[1]} label={m[0]} />
          {rest.join(m[0])}
        </>
      );
    }
    return n.message;
  };

  const TABS: { k: Tab; l: string; n: number; alert?: boolean }[] = [
    { k: 'all', l: 'Todas', n: counts.all },
    { k: 'unread', l: 'Não lidas', n: counts.unread, alert: counts.unread > 0 },
    { k: 'nt', l: 'NTs', n: counts.nt },
    { k: 'production', l: 'Produção', n: counts.production },
  ];

  const iconBtn = 'h-7 w-7 grid place-items-center rounded-[6px] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)]';

  let lastDay = '';

  /* ============================================================================
   * Render
   * ========================================================================== */
  return (
    <div className="relative inline-block">
      {/* Gatilho */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
        className={cn(
          'relative h-[30px] w-[30px] grid place-items-center rounded-[6px] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)]',
          open && 'bg-[var(--hover)] text-[var(--text)]'
        )}
        title="Notificações"
      >
        <svg className="w-4 h-4 stroke-current fill-none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
          {!notificationsEnabled && <path d="M3 3l18 18" />}
        </svg>
        {notificationsEnabled && unreadCount > 0 && (
          <span
            className={cn(
              'absolute top-[1px] right-0 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[var(--red)] text-white text-[9.5px] font-semibold grid place-items-center border-2 border-[var(--surface)] transition-transform',
              bump && 'scale-125'
            )}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <>
          {/* fundo escuro só no celular */}
          <div className="sm:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
          <section
            ref={panelRef}
            role="dialog"
            aria-label="Notificações"
            className={cn(
              'z-50 flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] shadow-[0_16px_40px_rgba(0,0,0,.45)] overflow-hidden',
              // desktop: dropdown ancorado no sino
              'sm:absolute sm:top-[calc(100%+8px)] sm:right-0 sm:w-[400px] sm:h-[min(580px,calc(100vh-72px))] sm:rounded-[8px]',
              // celular: painel de baixo
              'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[85dvh] max-sm:rounded-t-[12px] max-sm:border-b-0'
            )}
          >
            {/* Cabeçalho */}
            <div className="flex items-center gap-2 pl-4 pr-2 pt-3 pb-1">
              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold leading-tight">Notificações</h2>
                <p className="text-[12px] text-[var(--text-3)] mt-0.5">
                  {!notificationsEnabled
                    ? 'Pausadas · ative em Configurações'
                    : unreadCount
                    ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
                    : 'Tudo lido'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-0.5">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllAsRead} className="h-7 px-2 rounded-[6px] text-[12px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)]">
                    Marcar todas como lidas
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className={iconBtn} title="Fechar (Esc)">
                  <svg className="w-4 h-4 stroke-current fill-none" strokeWidth={1.6} strokeLinecap="round" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Abas */}
            <div className="flex gap-1 px-2.5 pt-2 border-b border-[var(--border)]">
              {TABS.map((t) => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setTab(t.k)}
                  className={cn(
                    'relative h-8 px-2 text-[12.5px] font-medium inline-flex items-center gap-1.5',
                    tab === t.k ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
                  )}
                >
                  {t.l}
                  {t.n > 0 && (
                    <span className={cn('font-mono text-[10.5px]', t.alert ? 'text-[var(--red)]' : 'text-[var(--text-3)]')}>{t.n}</span>
                  )}
                  {tab === t.k && <span className="absolute left-1.5 right-1.5 -bottom-px h-0.5 bg-[var(--text)]" />}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div className="px-3 pt-2.5 pb-1.5">
              <label className="flex items-center gap-2 h-8 px-2.5 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text-3)] focus-within:border-[var(--accent)]">
                <svg className="w-3.5 h-3.5 stroke-current fill-none shrink-0" strokeWidth={1.6} strokeLinecap="round" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por NT, pessoa ou texto"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)]"
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} className="hover:text-[var(--text)]" title="Limpar busca">
                    <svg className="w-3.5 h-3.5 stroke-current fill-none" strokeWidth={1.6} strokeLinecap="round" viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </label>
            </div>

            {/* Lista agrupada por dia */}
            <div className="flex-1 overflow-y-auto pb-2">
              {list.length === 0 ? (
                <p className="px-6 py-12 text-center text-[12.5px] text-[var(--text-3)] leading-relaxed">
                  {q ? (
                    <>Nada encontrado para “{q}”.</>
                  ) : tab === 'unread' ? (
                    'Nenhuma notificação não lida.'
                  ) : tab === 'nt' ? (
                    'Nenhuma notificação de NT.'
                  ) : tab === 'production' ? (
                    'Nenhuma notificação de produção.'
                  ) : (
                    'Nenhuma notificação por aqui.'
                  )}
                </p>
              ) : (
                list.map((n) => {
                  const d = new Date(n.createdAt);
                  const dl = dayLabel(d);
                  const header = dl !== lastDay;
                  lastDay = dl;
                  const tm = typeMeta(n.type);
                  return (
                    <Fragment key={n.id}>
                      {header && (
                        <div className="sticky top-0 z-[1] bg-[var(--surface)] px-4 pt-3 pb-1 text-[11px] font-medium text-[var(--text-3)]">
                          {dl}
                        </div>
                      )}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => go(n)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go(n))}
                        className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-3 pl-4 pr-3 py-2.5 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--hover)] outline-none focus-visible:bg-[var(--hover)]"
                      >
                        {/* traço de não lida */}
                        {!n.read && <span className="absolute left-0 top-3 w-[3px] h-4 rounded-r-sm bg-[var(--accent)]" />}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)]">
                            <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: tm.c }} />
                            {tm.l}
                          </div>
                          <p className={cn('text-[13px] mt-0.5 truncate', n.read ? 'text-[var(--text-2)]' : 'font-medium text-[var(--text)]')}>
                            {n.title}
                          </p>
                          <p className={cn('text-[12.5px] leading-snug mt-0.5 break-words', n.read ? 'text-[var(--text-3)]' : 'text-[var(--text-2)]')}>
                            {body(n)}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <time className="font-mono text-[11px] text-[var(--text-3)] whitespace-nowrap" title={d.toLocaleString('pt-BR')}>
                            {hm(d)}
                          </time>
                          <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                            {!n.read && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(n.id);
                                }}
                                className="h-6 w-6 grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                                title="Marcar como lida"
                              >
                                <svg className="w-3.5 h-3.5 stroke-current fill-none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                  <path d="m5 12 5 5 9-10" />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(n.id);
                              }}
                              className="h-6 w-6 grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--surface-2)]"
                              title="Remover"
                            >
                              <svg className="w-3.5 h-3.5 stroke-current fill-none" strokeWidth={1.6} strokeLinecap="round" viewBox="0 0 24 24">
                                <path d="M6 6l12 12M18 6 6 18" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  );
                })
              )}
            </div>

            {/* Rodapé */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[var(--border)] text-[12px] pb-[max(10px,env(safe-area-inset-bottom))]">
              {notifications.length > 0 ? (
                confirmClear ? (
                  <span className="flex items-center gap-2 text-[var(--text-2)]">
                    Apagar todas?
                    <button
                      type="button"
                      onClick={() => {
                        clearNotifications();
                        setConfirmClear(false);
                      }}
                      className="font-medium text-[var(--red)]"
                    >
                      Apagar
                    </button>
                    <button type="button" onClick={() => setConfirmClear(false)} className="text-[var(--text-3)] hover:text-[var(--text)]">
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmClear(true)} className="text-[var(--text-3)] hover:text-[var(--red)]">
                    Limpar todas
                  </button>
                )
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push('/settings');
                }}
                className="text-[var(--text-2)] hover:text-[var(--text)]"
              >
                Preferências
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
