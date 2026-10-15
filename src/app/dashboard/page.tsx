"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import ProtectedRoute from "@/components/auth/protected-route";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import { getCurrentActiveShift, getShiftPhase } from "@/lib/production-schedule";
import { PRODUCTION_COLLECTION } from "@/lib/production-helpers";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileText,
  Scale,
  Factory,
  TrendingUp,
  Users,
  Package,
  Shield,
  Settings,
  QrCode,
  Lock,
  Search,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

/* ============================================================================
 * Portal inicial do AgileWork
 * Menu de módulos com uma linha de status ao vivo em cada um.
 * ========================================================================== */

type Role = "all" | "pesagem" | "leader" | "maoDeObra" | "solicitacoes" | "admin";
type Tone = "red" | "amber" | "green" | "muted";
type Status = { text: string; tone: Tone } | null;

type Mod = {
  id: string;
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  group: "Operação" | "Pessoas e pedidos" | "Sistema";
  role: Role;
  need: string;
  why: string;
  keywords: string;
};

const TONE: Record<Tone, string> = { red: "var(--red)", amber: "var(--amber)", green: "var(--green)", muted: "var(--text-3)" };
const ATRASO_MIN = 120;
const RECENT_KEY = "aw_portal_recent";

const MODULES: Mod[] = [
  { id: "nts", href: "/almoxarifado/nts", title: "Notas técnicas", desc: "Fila de pagamento de matéria-prima", icon: FileText, group: "Operação", role: "all", need: "", why: "", keywords: "nt nota tecnica almoxarifado pagamento fila" },
  { id: "pesagem", href: "/pesagem", title: "Pesagem e estoque", desc: "Aging, residuais, pendências e remessas", icon: Scale, group: "Operação", role: "pesagem", need: "Liberação de Pesagem", why: "O módulo de Pesagem precisa de liberação da administração ou da supervisão.", keywords: "pesagem estoque aging residual lote pes remessa" },
  { id: "scanner", href: "/pesagem?tab=scan", title: "Consulta de lote", desc: "Bipe a etiqueta e veja saldo e posição", icon: QrCode, group: "Operação", role: "pesagem", need: "Liberação de Pesagem", why: "A consulta de lote faz parte do módulo de Pesagem.", keywords: "scanner bipe etiqueta lote consulta coletor" },
  { id: "producao", href: "/producao", title: "Painel de produção", desc: "Bateladas programadas e realizadas por turno", icon: Factory, group: "Operação", role: "leader", need: "Líder de produção ou supervisor", why: "O painel de produção e os apontamentos são restritos a líderes de turno e supervisores.", keywords: "producao turno batelada ordem apontamento" },
  { id: "heijunka", href: "/heijunka", title: "Heijunka", desc: "Nivelamento e ritmo das linhas", icon: TrendingUp, group: "Operação", role: "leader", need: "Líder de produção ou supervisor", why: "O quadro Heijunka é restrito à gestão das linhas e líderes de turno.", keywords: "heijunka nivelamento ritmo linha envase" },
  { id: "mao", href: "/mao-de-obra", title: "Mão de obra", desc: "Presença, faltas e alocação de postos", icon: Users, group: "Pessoas e pedidos", role: "maoDeObra", need: "Supervisor ou líder autorizado", why: "A gestão de efetivo exige autorização de Mão de Obra dada pelo supervisor.", keywords: "mao de obra presenca falta folga posto efetivo" },
  { id: "solic", href: "/solicitacoes", title: "Solicitações", desc: "Pedidos e requisições de material", icon: Package, group: "Pessoas e pedidos", role: "solicitacoes", need: "Supervisor ou usuário autorizado", why: "Criar solicitações de material requer permissão habilitada no seu perfil.", keywords: "solicitacao pedido requisicao material" },
  { id: "users", href: "/settings/users", title: "Usuários", desc: "Aprovação de contas e permissões", icon: Shield, group: "Sistema", role: "admin", need: "Administrador", why: "Aprovar contas e conceder acessos é restrito ao administrador.", keywords: "usuario conta permissao acesso aprovacao" },
  { id: "settings", href: "/settings", title: "Configurações", desc: "Tema, sons e preferências", icon: Settings, group: "Sistema", role: "all", need: "", why: "", keywords: "configuracao tema som preferencia perfil" },
];
const GROUPS: Mod["group"][] = ["Operação", "Pessoas e pedidos", "Sistema"];

const pad = (n: number) => String(n).padStart(2, "0");
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function dur(min: number) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${pad(min % 60)}`;
}
function created(i: any): Date | null {
  const ts = i.created_at;
  if (ts?.toDate) return ts.toDate();
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  const m = String(i.created_date || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const t = String(i.created_time || "").match(/^(\d{1,2}):(\d{2})/);
  return new Date(+m[3], +m[2] - 1, +m[1], t ? +t[1] : 0, t ? +t[2] : 0);
}
const store = {
  get: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* ignora */
    }
  },
};

/* ============================================================================
 * Página
 * ========================================================================== */
export default function Dashboard() {
  const router = useRouter();
  const { user, userData } = useFirebase();
  const [items, setItems] = useState<any[]>([]);
  const [prod, setProd] = useState<any[]>([]);
  const [live, setLive] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [denied, setDenied] = useState<Mod | null>(null);
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);

  // Foco imediato na barra de busca ao abrir a página
  useEffect(() => {
    searchRef.current?.focus();
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    try {
      setRecent(JSON.parse(store.get(RECENT_KEY) || "[]"));
    } catch {
      /* ignora */
    }
  }, []);

  // status ao vivo (só o necessário para as linhas de status)
  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(
      collection(db, "nt_items"),
      (s) => {
        setItems(s.docs.map((d) => d.data()));
        setLive(true);
      },
      () => setLive(false)
    );
    const u2 = onSnapshot(collection(db, PRODUCTION_COLLECTION), (s) => setProd(s.docs.map((d) => d.data())));
    return () => {
      u1();
      u2();
    };
  }, [user]);

  /* ---------------- permissões ---------------- */
  const role = userData?.role as string | undefined;
  const isAdmin = userData?.email === ADMIN_EMAIL || role === "admin";
  const can = (r: Role) => {
    if (r === "all" || isAdmin) return true;
    if (!userData) return false;
    switch (r) {
      case "pesagem":
        return role === "supervisor" || Boolean((userData as any).allowedPesagem);
      case "leader":
        return role === "leader" || role === "supervisor";
      case "maoDeObra":
        return role === "supervisor" || (role === "leader" && Boolean(userData.allowedMaoDeObra));
      case "solicitacoes":
        return role === "supervisor" || Boolean(userData.allowedSolicitacoes);
      default:
        return false;
    }
  };
  const roleLabel = isAdmin ? "Administrador" : role === "supervisor" ? "Supervisor" : role === "leader" ? "Líder de produção" : "Operador";
  const rawName = (userData?.name || (userData as any)?.displayName || user?.displayName || user?.email || "").split(/[\s@._]/)[0];
  const firstName = rawName ? rawName[0].toUpperCase() + rawName.slice(1) : "";

  /* ---------------- turno ---------------- */
  const shift = useMemo(() => getCurrentActiveShift(now), [now]);
  const phase = useMemo(() => (shift ? getShiftPhase(shift.n, now) : null), [shift, now]);

  /* ---------------- status de cada módulo ---------------- */
  const status = useMemo<Record<string, Status>>(() => {
    const t = now.getTime();
    let fila = 0;
    let late = 0;
    let urg = 0;
    for (const i of items) {
      if (i.status === "Pago" || i.status === "Pago Parcial") continue;
      fila++;
      if (i.priority) urg++;
      const c = created(i);
      if (c && (t - c.getTime()) / 60000 > ATRASO_MIN) late++;
    }
    const orders = prod.filter((p) => p.tipo === "ordem" && (!shift || p.turno === shift.n));
    const pg = orders.reduce((a, o) => a + (o.prog || 0), 0);
    const rl = orders.reduce((a, o) => a + (o.real || 0), 0);
    const rate = pg ? Math.round((rl / pg) * 100) : null;

    return {
      nts: !live
        ? null
        : fila === 0
        ? { text: "Fila vazia", tone: "green" }
        : late || urg
        ? { text: `${fila} na fila · ${late ? `${late} atrasado${late > 1 ? "s" : ""}` : `${urg} urgente${urg > 1 ? "s" : ""}`}`, tone: "red" }
        : { text: `${fila} na fila`, tone: "muted" },
      producao: rate === null ? (shift ? { text: `${shift.label} · sem ordens`, tone: "muted" } : null) : { text: `${shift?.label ?? "Turno"} · ${rate}% (${rl}/${pg})`, tone: rate >= 85 ? "green" : "amber" },
    };
  }, [items, prod, shift, live, now]);

  /* ---------------- busca e ordenação ---------------- */
  const visible = useMemo(() => {
    const s = norm(q.trim());
    const list = MODULES.filter((m) => !s || norm(`${m.title} ${m.desc} ${m.keywords}`).includes(s));
    // permitidos primeiro em cada grupo
    return list.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || Number(can(b.role)) - Number(can(a.role)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, userData]);

  const recentMods = useMemo(() => recent.map((id) => MODULES.find((m) => m.id === id)).filter((m): m is Mod => !!m && can(m.role)).slice(0, 4), [recent, userData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setCursor(0), [q]);

  const open = (m: Mod, e?: { preventDefault(): void }) => {
    if (!can(m.role)) {
      e?.preventDefault();
      setDenied(m);
      return;
    }
    const next = [m.id, ...recent.filter((x) => x !== m.id)].slice(0, 6);
    setRecent(next);
    store.set(RECENT_KEY, JSON.stringify(next));
    if (!e) router.push(m.href);
  };

  // atalhos: "/" busca · ↑↓ navega · Enter abre
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const inSearch = ae === searchRef.current;
      if (!inSearch && ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
      if (e.key === "/" && !inSearch) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!inSearch || !visible.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(visible.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        open(visible[cursor]);
      } else if (e.key === "Escape") {
        setQ("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cursor, recent, userData]);

  const h = now.getHours();
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const searching = q.trim().length > 0;

  /* ---------------- item ---------------- */
  const Tile = ({ m, idx }: { m: Mod; idx: number }) => {
    const ok = can(m.role);
    const st = ok ? status[m.id] : null;
    const Icon = m.icon;
    const active = searching && idx === cursor;
    return (
      <Link
        href={m.href}
        onClick={(e) => open(m, e)}
        onMouseEnter={() => searching && setCursor(idx)}
        className={cn(
          "group grid grid-cols-[32px_minmax(0,1fr)_14px] gap-3 items-start px-4 py-3.5 border-b border-r border-[var(--border)] transition-colors",
          active ? "bg-[var(--accent-weak)]" : "hover:bg-[var(--surface-2)]"
        )}
      >
        <span
          className={cn(
            "h-8 w-8 rounded-[6px] border grid place-items-center",
            ok ? "border-[var(--border-strong)] text-[var(--text-2)] group-hover:text-[var(--text)]" : "border-[var(--border)] text-[var(--text-3)]"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className={cn("flex items-center gap-1.5 text-[13.5px] font-medium", ok ? "text-[var(--text)]" : "text-[var(--text-3)]")}>
            {m.title}
            {!ok && <Lock className="h-3 w-3" />}
          </span>
          <span className="block text-[12px] text-[var(--text-3)] leading-snug mt-0.5">{ok ? m.desc : m.need}</span>
          {st && (
            <span className="flex items-center gap-1.5 mt-1.5 text-[12px] font-mono" style={{ color: st.tone === "muted" ? "var(--text-2)" : TONE[st.tone] }}>
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: TONE[st.tone] }} />
              {st.text}
            </span>
          )}
        </span>
        <ArrowUpRight className={cn("h-3.5 w-3.5 mt-1 transition-colors", ok ? "text-[var(--text-3)] group-hover:text-[var(--text)]" : "text-transparent")} />
      </Link>
    );
  };

  // grade com bordas coladas (sem cartões soltos): a borda externa fica no contêiner
  const Grid = ({ mods, offset = 0 }: { mods: Mod[]; offset?: number }) => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-[var(--border)]">
      {mods.map((m, i) => (
        <Tile key={m.id} m={m} idx={offset + i} />
      ))}
    </div>
  );

  /* ============================================================================
   * Render
   * ========================================================================== */
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col md:pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12 pb-24 md:pb-12">
            <div className="max-w-[960px] mx-auto">
              {/* Saudação */}
              <h1 className="text-[22px] font-semibold tracking-tight">
                {greet}
                {firstName ? `, ${firstName}` : ""}
              </h1>
              <p className="mt-1 text-[12.5px] text-[var(--text-3)] flex items-center gap-x-3 gap-y-1 flex-wrap">
                <span className="capitalize">{now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
                <span>· {roleLabel}</span>
                {shift && (
                  <span>
                    · <span className="text-[var(--text-2)]">{shift.label}</span>
                    {phase?.leftMinutes !== undefined && <span className="font-mono"> · restam {dur(phase.leftMinutes)}</span>}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  · <span className="w-[6px] h-[6px] rounded-full" style={{ background: live ? "var(--green)" : "var(--amber)" }} />
                  {live ? "ao vivo" : "conectando…"}
                </span>
              </p>

              {/* Busca */}
              <label className="mt-6 flex items-center gap-2.5 h-11 px-3.5 border border-[var(--border-strong)] rounded-[8px] bg-[var(--surface)] text-[var(--text-3)] focus-within:border-[var(--accent)]">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  ref={searchRef}
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ir para… (NT, lote, produção, usuários)"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)]"
                  aria-label="Buscar módulo"
                />
                {searching ? (
                  <span className="text-[11px] hidden sm:inline">↑↓ e Enter</span>
                ) : (
                  <kbd className="font-mono text-[10.5px] border border-[var(--border-strong)] rounded px-1.5">/</kbd>
                )}
              </label>

              {searching ? (
                <section className="mt-6">
                  {visible.length ? (
                    <Grid mods={visible} />
                  ) : (
                    <p className="py-10 text-center text-[13px] text-[var(--text-3)]">Nenhum módulo para “{q}”.</p>
                  )}
                </section>
              ) : (
                <>
                  {/* Recentes */}
                  {recentMods.length > 0 && (
                    <section className="mt-8">
                      <h2 className="text-[12px] font-semibold text-[var(--text-2)] mb-2">Recentes</h2>
                      <div className="flex flex-wrap gap-2">
                        {recentMods.map((m) => {
                          const Icon = m.icon;
                          return (
                            <Link
                              key={m.id}
                              href={m.href}
                              onClick={(e) => open(m, e)}
                              className="inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[13px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)]"
                            >
                              <Icon className="h-4 w-4" strokeWidth={1.7} />
                              {m.title}
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Módulos por grupo */}
                  {GROUPS.map((g) => {
                    const mods = visible.filter((m) => m.group === g);
                    if (!mods.length) return null;
                    return (
                      <section key={g} className="mt-8">
                        <h2 className="text-[12px] font-semibold text-[var(--text-2)] mb-2">{g}</h2>
                        <Grid mods={mods} />
                      </section>
                    );
                  })}
                </>
              )}

              <p className="mt-8 text-[11.5px] text-[var(--text-3)]">
                Módulos com cadeado precisam de liberação. Toque para ver qual perfil é necessário.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Acesso restrito */}
      <Dialog open={!!denied} onOpenChange={(o) => !o && setDenied(null)}>
        <DialogContent className="sm:max-w-sm bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px]">
          <div className="px-5 pt-5 pb-4">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--amber)]">
              <Lock className="h-3 w-3" /> Acesso restrito
            </span>
            <DialogTitle className="text-[16px] font-semibold mt-1">{denied?.title}</DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--text-2)] mt-1.5 leading-relaxed">{denied?.why}</DialogDescription>
            <dl className="mt-4 border-t border-[var(--border)] text-[12.5px]">
              <div className="flex justify-between py-2 border-b border-[var(--border)]">
                <dt className="text-[var(--text-3)]">Seu perfil</dt>
                <dd>{roleLabel}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border)]">
                <dt className="text-[var(--text-3)]">Necessário</dt>
                <dd className="text-[var(--amber)]">{denied?.need}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] text-[var(--text-3)]">Peça a liberação ao seu supervisor ou ao administrador do sistema.</p>
          </div>
          <div className="flex justify-end px-5 py-3 border-t border-[var(--border)]">
            <button type="button" onClick={() => setDenied(null)} className="h-9 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium">
              Entendi
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
