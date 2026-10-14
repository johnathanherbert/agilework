'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { AgingData, RemessaData, ConfiguracaoResiduais, LoteInvestigacao } from '@/types/aging';
import { isMaterialEspecial } from '@/lib/materiais-especiais';
import {
  fetchAgingData,
  fetchMaterialValores,
  fetchRemessas,
  fetchConfiguracaoResiduais,
  fetchDashboardHistorico,
  fetchLotesInvestigacao,
  triggerSapAutomation,
  checkSapAutomationStatus,
  fetchAgingStatus,
} from '@/lib/dashpesagem-api';

import { AgingTable, EnrichedRow } from '@/components/pesagem/aging-table';
import { AgingFinancial } from '@/components/pesagem/aging-financial';
import { OnepageView } from '@/components/pesagem/onepage-view';
import { RemessasView } from '@/components/pesagem/remessas-view';
import { ConsultaRapidaView } from '@/components/pesagem/consulta-rapida-view';
import { ToolsView } from '@/components/pesagem/tools-view';
import { ResiduaisView } from '@/components/pesagem/residuais-view';
import { TodoView } from '@/components/pesagem/todo-view';
import { ValorUpload } from '@/components/pesagem/valor-upload';
import { RemessaUpload } from '@/components/pesagem/remessa-upload';
import { ConfiguracaoResiduaisComponent } from '@/components/pesagem/configuracao-residuais';
import { ExcelUpload } from '@/components/pesagem/excel-upload';
import { MoverModal } from '@/components/pesagem/mover-modal';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import ProtectedRoute from '@/components/auth/protected-route';
import { PesagemTodoItem } from '@/types/pesagem-todo';
import { subscribePesagemTodos } from '@/lib/pesagem-todo-helpers';
import { rememberMaterialDescriptions } from '@/lib/material-descriptions';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  FileText,
  AlertTriangle,
  AlertCircle,
  Truck,
  QrCode,
  Wrench,
  Settings as SettingsIcon,
  RefreshCw,
  Upload,
  X,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { PageLoader } from '@/components/line-loader';

/* ============================================================================
 * Regras compartilhadas (uma fonte só para a página inteira)
 * ========================================================================== */
type Tab = 'fin' | 'one' | 'res' | 'todo' | 'rem' | 'scan' | 'tools' | 'settings';
type Spec = 'trz' | 'ok' | 'al' | 'cr' | 'INF' | 'CFA' | 'v30';

const DEFAULT_CONFIG: ConfiguracaoResiduais = {
  limite_verde: 100,
  limite_amarelo: 900,
  limite_maximo: 999,
  materiais_alto_valor: [],
  dias_atencao: 3,
  dias_alerta: 7,
  dias_critico: 15,
};

const SPEC_LABEL: Record<Spec, string> = {
  trz: 'TR-ZONE negativo',
  ok: 'Normal',
  al: 'Alerta',
  cr: 'Crítico',
  INF: 'INF',
  CFA: 'CFA',
  v30: 'Vence em 30 d',
};

const TAB_ALIASES: Record<string, Tab> = {
  fin: 'fin', financeiro: 'fin',
  one: 'one', onepage: 'one',
  res: 'res', residuais: 'res',
  todo: 'todo', tarefas: 'todo', investigacao: 'todo', pendencias: 'todo',
  rem: 'rem', remessas: 'rem',
  scan: 'scan', scanner: 'scan',
  tools: 'tools', ferramentas: 'tools',
  settings: 'settings', config: 'settings',
};

const POLL_MS = 8000;
const BASE_STALE_H = 12;

const U = (s?: string | null) => String(s ?? '').trim().toUpperCase();

/** Data local: aceita DD/MM/AAAA e AAAA-MM-DD sem cair no fuso UTC */
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  let m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

function isTrZone(item: Pick<AgingData, 'deposito' | 'tipo_deposito' | 'posicao_deposito'>) {
  const t = U(item.tipo_deposito);
  const p = U(item.posicao_deposito).replace(/[\s_]/g, '-');
  const d = U(item.deposito);
  return t.includes('922') || t.includes('TR-ZONE') || t.includes('TRZONE') || p.includes('TR-ZONE') || p.includes('TRZONE') || d === '922' || d === 'TR-ZONE';
}

/** Agrupamento operacional: PES · 999 (AJUSTE/AJU-SAÍDA) · TR-ZONE · DEP */
function depGroup(item: Pick<AgingData, 'deposito' | 'tipo_deposito' | 'posicao_deposito'>): string {
  if (isTrZone(item)) return 'TR-ZONE';
  const t = U(item.tipo_deposito);
  const p = U(item.posicao_deposito);
  const d = U(item.deposito);
  if (t === '999' || p.includes('AJU')) return '999';
  if (t === 'DEP' || p.includes('DEVOL') || (d === 'DEP' && t !== 'PES' && !p.includes('PESAGEM'))) return 'DEP';
  if (t === 'PES' || p.includes('PES')) return 'PES';
  return t || 'PES';
}

/** Onepage manda posições (PESAGEM, AJUSTE…); o filtro da página trabalha com grupos */
const posToGroup = (pos: string) => depGroup({ posicao_deposito: pos, tipo_deposito: '', deposito: '' });

const brlK = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e4) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/* ============================================================================
 * Página
 * ========================================================================== */
export default function PesagemPage() {
  const router = useRouter();
  const { userData, user } = useFirebase();
  const userEmail = user?.email || userData?.email || undefined;

  const isAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin';
  const canAccess = isAdmin || userData?.role === 'supervisor' || Boolean(userData?.allowedPesagem);

  /* ---------------- dados ---------------- */
  const [data, setData] = useState<AgingData[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [remessas, setRemessas] = useState<RemessaData[]>([]);
  const [config, setConfig] = useState<ConfiguracaoResiduais>(DEFAULT_CONFIG);
  const [lotesInvestigacao, setLotesInvestigacao] = useState<LoteInvestigacao[]>([]);
  const [todoItems, setTodoItems] = useState<PesagemTodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | Date | null>(null);
  const lastSyncRef = useRef<string | null>(null);

  /* ---------------- navegação e filtros ---------------- */
  const [activeTab, setActiveTab] = useState<Tab>('fin');
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedDep, setSelectedDep] = useState('all');
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [residuaisActive, setResiduaisActive] = useState(false);
  const [selectedTodoLote, setSelectedTodoLote] = useState<string | null>(null);

  /* ---------------- modais ---------------- */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [moverOpen, setMoverOpen] = useState(false);
  const [moverItems, setMoverItems] = useState<EnrichedRow[]>([]);
  const [isAtualizandoDb, setIsAtualizandoDb] = useState(false);
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const diasAlerta = config?.dias_alerta ?? 7;
  const diasCritico = config?.dias_critico ?? 15;
  // Mesma regra de Configurações e Onepage: crítico a partir de N dias (inclusive)
  const classify = useCallback((d: number) => (d >= diasCritico ? 'cr' : d >= diasAlerta ? 'al' : 'ok'), [diasAlerta, diasCritico]);
  const priceOf = useCallback((mat: string) => valores[mat] ?? valores[mat.replace(/^0+/, '')] ?? 0, [valores]);

  /* ---------------- abas sincronizadas com a URL ---------------- */
  const goTab = useCallback((t: Tab) => {
    setActiveTab(t);
    setResiduaisActive(t === 'res');
    setMoreOpen(false);
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (t === 'fin') p.delete('tab');
      else p.set('tab', t);
      const qs = p.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = TAB_ALIASES[p.get('tab')?.toLowerCase() || ''];
    if (p.get('code')) setActiveTab('scan');
    else if (t) {
      setActiveTab(t);
      setResiduaisActive(t === 'res');
    }
    const onScan = () => setActiveTab('scan');
    window.addEventListener('agilework:barcode_scanned', onScan);
    return () => window.removeEventListener('agilework:barcode_scanned', onScan);
  }, []);

  /* ---------------- carregamento ---------------- */
  const loadData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      const [aging, vals, rems, cfg, historico, inv] = await Promise.all([
        fetchAgingData(),
        fetchMaterialValores(),
        fetchRemessas().catch(() => [] as RemessaData[]),
        fetchConfiguracaoResiduais().catch(() => DEFAULT_CONFIG),
        fetchDashboardHistorico(2).catch(() => [] as any[]),
        fetchLotesInvestigacao().catch(() => [] as LoteInvestigacao[]),
      ]);
      setData(aging);
      setValores(vals);
      setRemessas(rems);
      setConfig({ ...DEFAULT_CONFIG, ...cfg });
      setLotesInvestigacao(inv);
      rememberMaterialDescriptions(aging);
      rememberMaterialDescriptions(rems);
      const ts = aging[0]?.created_at || historico[0]?.snapshot_at || null;
      setLastUpdate(ts);
      if (aging[0]?.created_at) lastSyncRef.current = String(aging[0].created_at);
    } catch (err) {
      console.error('Erro ao carregar dados de pesagem:', err);
      setError('Não foi possível carregar o estoque. Verifique a conexão com a base.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Carga inicial + verificação de nova base (pausa com a aba do navegador oculta)
  useEffect(() => {
    loadData(true);
    const check = async () => {
      if (document.hidden) return;
      try {
        const st = await fetchAgingStatus();
        if (!st?.last_updated) return;
        const ts = String(st.last_updated);
        if (lastSyncRef.current && lastSyncRef.current !== ts) {
          lastSyncRef.current = ts;
          setLastUpdate(ts);
          toast.success(`Estoque atualizado · ${Number(st.total_rows || 0).toLocaleString('pt-BR')} lotes`);
          loadData(false);
        } else if (!lastSyncRef.current) {
          lastSyncRef.current = ts;
          setLastUpdate(ts);
        }
      } catch {
        /* silencioso */
      }
    };
    const iv = setInterval(check, POLL_MS);
    const onVis = () => !document.hidden && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      if (syncPollRef.current) clearInterval(syncPollRef.current);
    };
  }, [loadData]);

  useEffect(() => {
    const unsub = subscribePesagemTodos(
      (items) => {
        setTodoItems(items);
        rememberMaterialDescriptions(items);
      },
      (err) => console.warn('Erro ao escutar pendências:', err)
    );
    return () => unsub();
  }, []);

  /* ---------------- extração SAP ---------------- */
  const handleAtualizarDb = async () => {
    if (isAtualizandoDb) return;
    setIsAtualizandoDb(true);
    const id = toast.loading('Pedindo extração ao Planilha Sync…');
    try {
      const res = await triggerSapAutomation('extrair_relatorio', userEmail || 'AgileWork');
      if (!res.success || !res.job) {
        toast.error(`Não foi possível iniciar: ${res.error || 'erro desconhecido'}`, { id });
        setIsAtualizandoDb(false);
        return;
      }
      const jobId = res.job.id;
      toast.loading('Extraindo do SAP e sincronizando…', { id });
      let n = 0;
      if (syncPollRef.current) clearInterval(syncPollRef.current);
      syncPollRef.current = setInterval(async () => {
        n++;
        const stop = () => {
          if (syncPollRef.current) clearInterval(syncPollRef.current);
          syncPollRef.current = null;
          setIsAtualizandoDb(false);
        };
        try {
          const st = await checkSapAutomationStatus(jobId);
          if (st?.status === 'completed') {
            stop();
            toast.success('Estoque atualizado a partir do SAP', { id });
            loadData(false);
          } else if (st?.status === 'failed') {
            stop();
            toast.error(`Extração falhou: ${st.result_message || 'erro no script'}`, { id });
          } else if (n >= 60) {
            stop();
            toast.error('Sem resposta do Planilha Sync em 2 min. Confira se o app está aberto.', { id });
          }
        } catch {
          if (n >= 60) stop();
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id });
      setIsAtualizandoDb(false);
    }
  };

  /* ---------------- derivados ---------------- */
  const activeTodoCount = useMemo(() => {
    const s = new Set<string>();
    todoItems.forEach((t) => t.status !== 'concluido' && t.lote && s.add(U(t.lote)));
    lotesInvestigacao.forEach((i) => i.lote && s.add(U(i.lote)));
    return s.size;
  }, [todoItems, lotesInvestigacao]);

  const groups = useMemo(() => data.map((i) => depGroup(i)), [data]);

  const baseData = useMemo(
    () => (selectedDep === 'all' ? data : data.filter((_, i) => groups[i] === selectedDep)),
    [data, groups, selectedDep]
  );

  const depCounts = useMemo(() => {
    const c: Record<string, number> = { all: data.length };
    groups.forEach((g) => (c[g] = (c[g] || 0) + 1));
    return c;
  }, [data, groups]);

  const uniqueDeps = useMemo(() => {
    const order = ['PES', '999', 'TR-ZONE', 'DEP'];
    const found = Array.from(new Set(groups));
    return [...order.filter((d) => found.includes(d)), ...found.filter((d) => !order.includes(d)).sort()];
  }, [groups]);

  const matchesSpec = useCallback(
    (item: AgingData, spec: string) => {
      const d = item.dias_aging || 0;
      switch (spec) {
        case 'trz':
          return isTrZone(item) && (Number(item.estoque_disponivel) || 0) < 0;
        case 'ok':
        case 'al':
        case 'cr':
          return classify(d) === spec;
        case 'INF':
          return isMaterialEspecial(item.material) === 'inf';
        case 'CFA':
          return isMaterialEspecial(item.material) === 'cfa';
        case 'v30': {
          const v = parseDate(item.data_vencimento);
          if (!v) return false;
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const lim = new Date(hoje);
          lim.setDate(hoje.getDate() + 30);
          return v >= hoje && v <= lim;
        }
        default:
          return true;
      }
    },
    [classify]
  );

  const kpis = useMemo(() => {
    const k: Record<string, { n: number; v: number }> = {};
    ['total', 'trz', 'ok', 'al', 'cr', 'INF', 'CFA', 'v30'].forEach((x) => (k[x] = { n: 0, v: 0 }));
    for (const item of baseData) {
      const v = Math.max(0, Number(item.estoque_disponivel) || 0) * priceOf(item.material);
      k.total.n++;
      k.total.v += v;
      for (const s of ['ok', 'al', 'cr', 'INF', 'CFA', 'v30']) {
        if (matchesSpec(item, s)) {
          k[s].n++;
          k[s].v += v;
        }
      }
    }
    // TR-ZONE negativo é alerta da base inteira, independente do depósito escolhido
    for (const item of data) if (matchesSpec(item, 'trz')) k.trz.n++;
    return k;
  }, [baseData, data, priceOf, matchesSpec]);

  const displayData = useMemo(() => {
    if (!selectedSpec) return baseData;
    const src = selectedSpec === 'trz' ? data : baseData;
    return src.filter((i) => matchesSpec(i, selectedSpec));
  }, [baseData, data, selectedSpec, matchesSpec]);

  const totalResiduaisCount = useMemo(() => {
    const max = (config?.limite_maximo ?? 999) / 1000;
    return baseData.filter((i) => U(i.unidade_medida || 'KG') === 'KG' && (Number(i.estoque_disponivel) || 0) > 0 && (Number(i.estoque_disponivel) || 0) <= max).length;
  }, [baseData, config]);

  const upd = useMemo(() => {
    if (!lastUpdate) return null;
    const d = new Date(lastUpdate);
    if (isNaN(d.getTime())) return { text: String(lastUpdate), stale: false };
    return {
      text: d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      stale: (Date.now() - d.getTime()) / 3600000 > BASE_STALE_H,
    };
  }, [lastUpdate]);

  const hasFilters = selectedDep !== 'all' || !!selectedSpec || !!selectedMaterialFilter || !!searchTerm;
  const clearFilters = () => {
    setSelectedSpec(null);
    setSelectedMaterialFilter(undefined);
    setSearchTerm('');
    setSelectedDep('all');
  };

  // Esc limpa filtros, mas não enquanto digita ou com modal aberto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (moreOpen) return setMoreOpen(false);
      if (selectedSpec || selectedMaterialFilter || searchTerm) {
        setSelectedSpec(null);
        setSelectedMaterialFilter(undefined);
        setSearchTerm('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSpec, selectedMaterialFilter, searchTerm, moreOpen]);

  /* ---------------- navegação entre telas ---------------- */
  const handleNavigateToTodo = (lote: string) => {
    setSelectedTodoLote(lote);
    goTab('todo');
  };
  const filterMaterialOnFin = (mat: string) => {
    setSelectedMaterialFilter(mat);
    goTab('fin');
  };

  /* ---------------- abas ---------------- */
  const TABS: { k: Tab; l: string; short: string; Icon: any; n?: number; alert?: boolean }[] = [
    { k: 'fin', l: 'Financeiro', short: 'Financeiro', Icon: TrendingUp },
    { k: 'one', l: 'Onepage', short: 'Onepage', Icon: FileText },
    { k: 'res', l: 'Residuais', short: 'Residuais', Icon: AlertTriangle, n: totalResiduaisCount },
    { k: 'todo', l: 'Pendências', short: 'Pendências', Icon: AlertCircle, n: activeTodoCount, alert: activeTodoCount > 0 },
    { k: 'rem', l: 'Remessas', short: 'Remessas', Icon: Truck },
    { k: 'scan', l: 'Scanner', short: 'Scanner', Icon: QrCode },
    { k: 'tools', l: 'Ferramentas', short: 'Ferramentas', Icon: Wrench },
    { k: 'settings', l: 'Configurações', short: 'Config.', Icon: SettingsIcon },
  ];
  // No celular: o que se usa no chão de fábrica fica à mão; o resto vai para "Mais"
  const MOBILE_MAIN: Tab[] = ['scan', 'todo', 'res', 'fin'];
  const mobileMore = TABS.filter((t) => !MOBILE_MAIN.includes(t.k));

  const showKpis = activeTab === 'fin' || activeTab === 'res';
  const showFilters = activeTab === 'fin' || activeTab === 'res';

  const btn =
    'h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50';
  const primary =
    'h-8 px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap';

  /* ---------------- sem acesso ---------------- */
  if (!canAccess) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
          <Sidebar />
          <div className="flex-1 flex flex-col md:pl-[52px] min-w-0">
            <Topbar />
            <main className="flex-1 grid place-items-center p-6">
              <div className="max-w-sm text-center">
                <h2 className="text-[18px] font-semibold">Acesso restrito</h2>
                <p className="mt-1.5 text-[13px] text-[var(--text-3)] leading-relaxed">
                  O módulo de Pesagem e Estoque precisa de liberação da administração ou da supervisão.
                </p>
                <button type="button" onClick={() => router.push('/dashboard')} className={cn(primary, 'mt-5 h-9')}>
                  Voltar ao Dashboard
                </button>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  /* ============================================================================
   * Render
   * ========================================================================== */
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col md:pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />

          <main className="flex-1 overflow-y-auto px-3 sm:px-6 pt-0 pb-24 md:pb-8 min-w-0">
            {/* ---------- Sub-navegação ---------- */}
            <div className="sticky top-0 z-20 bg-[var(--bg)] flex items-center gap-3 border-b border-[var(--border)] mb-4 -mx-3 sm:-mx-6 px-3 sm:px-6">
              <nav className="hidden md:flex gap-1 overflow-x-auto no-scrollbar min-w-0">
                {TABS.map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    onClick={() => goTab(t.k)}
                    className={cn(
                      'relative h-11 px-2.5 text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap',
                      activeTab === t.k ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
                    )}
                  >
                    {t.l}
                    {!!t.n && (
                      <span className={cn('font-mono text-[11px]', t.alert ? 'text-[var(--red)]' : 'text-[var(--text-3)]')}>{t.n}</span>
                    )}
                    {activeTab === t.k && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-[var(--text)]" />}
                  </button>
                ))}
              </nav>
              <span className="md:hidden h-11 inline-flex items-center text-[14px] font-semibold">
                {TABS.find((t) => t.k === activeTab)?.l}
              </span>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                {upd && (
                  <span
                    className={cn('hidden lg:inline-flex items-center gap-1.5 text-[12px]', upd.stale ? 'text-[var(--amber)]' : 'text-[var(--text-3)]')}
                    title={upd.stale ? `Base com mais de ${BASE_STALE_H} h` : 'Última sincronização'}
                  >
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: upd.stale ? 'var(--amber)' : 'var(--green)' }} />
                    Base de <span className="font-mono">{upd.text}</span>
                  </span>
                )}
                <button type="button" onClick={handleAtualizarDb} disabled={isAtualizandoDb} className={btn} title="Extrair estoque do SAP via Planilha Sync">
                  <RefreshCw className={cn('h-3.5 w-3.5', isAtualizandoDb && 'animate-spin')} />
                  <span className="hidden sm:inline">{isAtualizandoDb ? 'Sincronizando…' : 'Sincronizar SAP'}</span>
                </button>
                <button type="button" onClick={() => setUploadOpen(true)} className={cn(primary, 'max-sm:px-2.5')} title="Enviar planilha de estoque">
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Upload</span>
                </button>
              </div>
            </div>

            {/* Erro com dados já carregados: aviso discreto */}
            {error && data.length > 0 && (
              <p className="mb-4 flex items-center gap-2 text-[12.5px] text-[var(--red)]">
                <span className="w-[7px] h-[7px] rounded-full bg-[var(--red)]" />
                {error}
                <button type="button" onClick={() => loadData(false)} className="font-medium text-[var(--accent)]">
                  Tentar de novo
                </button>
                <button type="button" onClick={() => setError(null)} className="ml-auto text-[var(--text-3)] hover:text-[var(--text)]" title="Fechar">
                  <X className="h-3.5 w-3.5" />
                </button>
              </p>
            )}

            {/* ---------- Indicadores ---------- */}
            {showKpis && !loading && data.length > 0 && (
              <section className="flex xl:grid xl:grid-cols-8 overflow-x-auto no-scrollbar pb-4 mb-3 border-b border-[var(--border)] -mx-3 px-3 sm:mx-0 sm:px-0">
                {(
                  [
                    { s: null, l: 'Total de lotes', n: kpis.total.n, sub: brlK(kpis.total.v) },
                    { s: 'trz', l: 'TR-ZONE negativo', n: kpis.trz.n, sub: kpis.trz.n ? 'saldo abaixo de zero' : 'nenhum', c: kpis.trz.n ? 'var(--red)' : '', dot: kpis.trz.n ? 'var(--red)' : '' },
                    { s: 'ok', l: `Normal · < ${diasAlerta} d`, n: kpis.ok.n, sub: brlK(kpis.ok.v), dot: 'var(--green)' },
                    { s: 'al', l: `Alerta · ${diasAlerta}–${diasCritico - 1} d`, n: kpis.al.n, sub: brlK(kpis.al.v), dot: 'var(--amber)', c: kpis.al.n ? 'var(--amber)' : '' },
                    { s: 'cr', l: `Crítico · ≥ ${diasCritico} d`, n: kpis.cr.n, sub: brlK(kpis.cr.v), dot: 'var(--red)', c: kpis.cr.n ? 'var(--red)' : '' },
                    { s: 'INF', l: 'INF', n: kpis.INF.n, sub: brlK(kpis.INF.v) },
                    { s: 'CFA', l: 'CFA', n: kpis.CFA.n, sub: brlK(kpis.CFA.v) },
                    { s: 'v30', l: 'Vence em 30 d', n: kpis.v30.n, sub: brlK(kpis.v30.v), c: kpis.v30.n ? 'var(--amber)' : '' },
                  ] as { s: string | null; l: string; n: number; sub: string; c?: string; dot?: string }[]
                ).map((k, i) => {
                  const on = selectedSpec === k.s;
                  return (
                    <button
                      key={k.l}
                      type="button"
                      onClick={() => setSelectedSpec(k.s === null || on ? null : k.s)}
                      className={cn(
                        'relative text-left shrink-0 min-w-[132px] xl:min-w-0 px-3.5 group',
                        i > 0 && 'border-l border-[var(--border)]',
                        i === 0 && 'pl-0',
                        k.n === 0 && k.s !== null && 'opacity-55'
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)] whitespace-nowrap">
                        {k.dot && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: k.dot }} />}
                        {k.l}
                      </span>
                      <span className="block font-mono text-[20px] font-semibold tracking-tight leading-tight mt-0.5 group-hover:underline underline-offset-4 decoration-1" style={{ color: k.c || undefined }}>
                        {k.n.toLocaleString('pt-BR')}
                      </span>
                      <span className="block text-[11.5px] text-[var(--text-3)] font-mono truncate">{k.sub}</span>
                      {on && k.s !== null && <span className={cn('absolute right-3.5 -bottom-4 h-0.5 bg-[var(--accent)]', i === 0 ? 'left-0' : 'left-3.5')} />}
                    </button>
                  );
                })}
              </section>
            )}

            {/* ---------- Depósito + filtros ativos ---------- */}
            {showFilters && !loading && data.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)] max-w-full overflow-x-auto no-scrollbar">
                  {['all', ...uniqueDeps].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDep(d)}
                      className={cn(
                        'h-[30px] px-3 text-[12px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap border-r border-[var(--border-strong)] last:border-r-0',
                        selectedDep === d ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
                      )}
                    >
                      {d === 'all' ? 'Todos' : d}
                      <span className="font-mono text-[10.5px] text-[var(--text-3)]">{(depCounts[d] || 0).toLocaleString('pt-BR')}</span>
                    </button>
                  ))}
                </div>

                {[
                  selectedDep !== 'all' && { k: 'dep', t: `Depósito ${selectedDep}`, clear: () => setSelectedDep('all') },
                  selectedSpec && { k: 'spec', t: SPEC_LABEL[selectedSpec as Spec] || selectedSpec, clear: () => setSelectedSpec(null) },
                  selectedMaterialFilter && { k: 'mat', t: `Material ${selectedMaterialFilter}`, clear: () => setSelectedMaterialFilter(undefined) },
                  searchTerm && { k: 'q', t: `“${searchTerm}”`, clear: () => setSearchTerm('') },
                ]
                  .filter(Boolean)
                  .map((c: any) => (
                    <span key={c.k} className="inline-flex items-center gap-1 h-[26px] pl-2.5 pr-1 rounded-full bg-[var(--accent-weak)] text-[12px]">
                      {c.t}
                      <button type="button" onClick={c.clear} className="h-5 w-5 grid place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--border)]" title="Remover">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                {hasFilters && (
                  <button type="button" onClick={clearFilters} className="text-[12px] font-medium text-[var(--accent)] px-1">
                    Limpar filtros
                  </button>
                )}
              </div>
            )}

            {/* ---------- Estados ---------- */}
            {loading && (
              <PageLoader label="Carregando estoque…" />
            )}

            {!loading && error && data.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-[13px] text-[var(--text-2)]">{error}</p>
                <button type="button" onClick={() => loadData(true)} className={cn(btn, 'mt-3')}>
                  Tentar de novo
                </button>
              </div>
            )}

            {/* ---------- Conteúdo ---------- */}
            {!loading && (data.length > 0 || !error) && (
              <>
                {activeTab === 'fin' && (
                  <div className="space-y-4">
                    <AgingFinancial
                      data={displayData}
                      allData={data}
                      valores={valores}
                      selectedCriticality={selectedSpec}
                      onCriticalityChange={(c: string | null) => setSelectedSpec(c)}
                      selectedMaterial={selectedMaterialFilter}
                      onMaterialChange={(m: string | undefined) => setSelectedMaterialFilter(m)}
                      configResiduais={config}
                    />
                    <AgingTable
                      data={displayData}
                      valores={valores}
                      remessas={remessas}
                      configResiduais={config}
                      lotesInvestigacao={lotesInvestigacao}
                      todoItems={todoItems}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      residuaisActive={residuaisActive}
                      onToggleResiduais={() => setResiduaisActive((v) => !v)}
                      onOpenMoverModal={(rows: EnrichedRow[]) => {
                        setMoverItems(rows);
                        setMoverOpen(true);
                      }}
                      onInvestigacaoChange={() => loadData(false)}
                      selectedMaterialFilter={selectedMaterialFilter}
                      onClearMaterialFilter={() => setSelectedMaterialFilter(undefined)}
                      currentUserEmail={userEmail || 'Web Pesagem'}
                      onAtualizarDb={handleAtualizarDb}
                      onNavigateToTodo={handleNavigateToTodo}
                    />
                  </div>
                )}

                {activeTab === 'res' && (
                  <ResiduaisView
                    agingData={baseData}
                    allData={data}
                    valores={valores}
                    remessas={remessas}
                    configResiduais={config}
                    selectedCriticality={selectedSpec}
                    onCriticalityChange={(c: string | null) => setSelectedSpec(c)}
                    onNavigateToRemessas={(m: string) => {
                      setSelectedMaterialFilter(m);
                      goTab('rem');
                    }}
                    lotesInvestigacao={lotesInvestigacao}
                    todoItems={todoItems}
                    onInvestigacaoChange={() => loadData(false)}
                    currentUserEmail={userEmail}
                    onAtualizarDb={handleAtualizarDb}
                    isAtualizandoDb={isAtualizandoDb}
                    onNavigateToTodo={handleNavigateToTodo}
                  />
                )}

                {activeTab === 'todo' && (
                  <TodoView
                    agingData={data}
                    valores={valores}
                    todoItems={todoItems}
                    lotesInvestigacao={lotesInvestigacao}
                    currentUserEmail={userEmail}
                    onNavigateToMaterial={filterMaterialOnFin}
                    onAtualizarDb={handleAtualizarDb}
                    isAtualizandoDb={isAtualizandoDb}
                    onInvestigacaoChange={() => loadData(false)}
                    selectedLote={selectedTodoLote}
                    onClearSelectedLote={() => setSelectedTodoLote(null)}
                  />
                )}

                {activeTab === 'one' && (
                  <OnepageView
                    agingData={data}
                    valores={valores}
                    lotesInvestigacao={lotesInvestigacao}
                    onInvestigacaoChange={() => loadData(false)}
                    currentUserEmail={userEmail}
                    lastUpdate={lastUpdate}
                    configResiduais={config}
                    onFilterMaterial={filterMaterialOnFin}
                    onFilterPosicao={(pos: string) => {
                      setSelectedDep(posToGroup(pos));
                      goTab('fin');
                    }}
                  />
                )}

                {activeTab === 'rem' && <RemessasView remessas={remessas} materialFilter={selectedMaterialFilter} />}

                {activeTab === 'scan' && (
                  <ConsultaRapidaView
                    agingData={data}
                    remessas={remessas}
                    valores={valores}
                    currentUserEmail={userEmail}
                    onAtualizarDb={handleAtualizarDb}
                    onNavigateToTab={(t: string) => TAB_ALIASES[t] && goTab(TAB_ALIASES[t])}
                    isEmbedded
                  />
                )}

                {activeTab === 'tools' && <ToolsView agingData={data} valores={valores} />}

                {activeTab === 'settings' && (
                  <div className="max-w-[880px]">
                    <div className="mb-6">
                      <h2 className="text-[18px] font-semibold tracking-tight">Configurações do módulo</h2>
                      <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">Faixas de aging e residuais, tabela de preços e base de remessas.</p>
                    </div>
                    <ConfiguracaoResiduaisComponent onConfigChange={() => loadData(false)} />
                    <ValorUpload onUploadComplete={() => loadData(false)} />
                    <RemessaUpload onUploadComplete={() => loadData(false)} />
                  </div>
                )}
              </>
            )}
          </main>

          {/* ---------- Navegação inferior (celular) ---------- */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--surface)] border-t border-[var(--border)] grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
            {MOBILE_MAIN.map((k) => {
              const t = TABS.find((x) => x.k === k)!;
              const on = activeTab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => goTab(k)}
                  className={cn('relative h-14 flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium', on ? 'text-[var(--text)]' : 'text-[var(--text-3)]')}
                >
                  {on && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-[var(--text)]" />}
                  <span className="relative">
                    <t.Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                    {!!t.n && (
                      <span
                        className={cn(
                          'absolute -top-1.5 left-3 min-w-[15px] h-[15px] px-[3px] rounded-full text-[9px] font-semibold font-mono grid place-items-center border-2 border-[var(--surface)]',
                          t.alert ? 'bg-[var(--red)] text-white' : 'bg-[var(--text-3)] text-[var(--bg)]'
                        )}
                      >
                        {t.n > 99 ? '99+' : t.n}
                      </span>
                    )}
                  </span>
                  {t.short}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                'relative h-14 flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium',
                moreOpen || !MOBILE_MAIN.includes(activeTab) ? 'text-[var(--text)]' : 'text-[var(--text-3)]'
              )}
            >
              {!MOBILE_MAIN.includes(activeTab) && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-[var(--text)]" />}
              <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.7} />
              Mais
            </button>
          </nav>

          {moreOpen && (
            <>
              <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMoreOpen(false)} />
              <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-[var(--surface)] border-t border-[var(--border-strong)] rounded-t-[12px] pb-[max(12px,env(safe-area-inset-bottom))]">
                <div className="w-9 h-1 rounded-full bg-[var(--border-strong)] mx-auto mt-2 mb-1" />
                {mobileMore.map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    onClick={() => goTab(t.k)}
                    className={cn(
                      'w-full flex items-center gap-3 h-12 px-5 text-[14px] border-b border-[var(--border)] last:border-b-0',
                      activeTab === t.k ? 'text-[var(--text)] font-medium' : 'text-[var(--text-2)]'
                    )}
                  >
                    <t.Icon className="h-[18px] w-[18px] text-[var(--text-3)]" strokeWidth={1.7} />
                    {t.l}
                    {activeTab === t.k && <span className="ml-auto w-[7px] h-[7px] rounded-full bg-[var(--text)]" />}
                  </button>
                ))}
                {upd && (
                  <p className={cn('px-5 pt-3 text-[12px] flex items-center gap-1.5', upd.stale ? 'text-[var(--amber)]' : 'text-[var(--text-3)]')}>
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: upd.stale ? 'var(--amber)' : 'var(--green)' }} />
                    Base de <span className="font-mono">{upd.text}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------- Upload da base ---------- */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px]">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] text-left">
            <DialogTitle className="text-[15px] font-semibold">Enviar planilha de estoque</DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--text-3)]">
              Exportação MB52 ou LX02 do SAP. Substitui a base de aging atual.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <ExcelUpload
              onUploadComplete={() => {
                loadData(false);
                setUploadOpen(false);
              }}
              onClose={() => setUploadOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Mover no SAP ---------- */}
      <MoverModal
        open={moverOpen}
        onOpenChange={setMoverOpen}
        items={moverItems}
        onRemoveItem={(i: number) => setMoverItems((p) => p.filter((_, x) => x !== i))}
        onSuccess={() => {
          loadData(false);
          setMoverOpen(false);
        }}
        currentUserEmail={userEmail}
      />
    </ProtectedRoute>
  );
}
