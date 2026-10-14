'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AgingData, LoteInvestigacao, ConfiguracaoResiduais } from '@/types/aging';
import { PesagemTodoItem, PesagemTodoStatus, PesagemTodoPriority } from '@/types/pesagem-todo';
import {
  createPesagemTodo,
  updatePesagemTodoStatus,
  addPesagemTodoNote,
  deletePesagemTodoNote,
  updatePesagemTodo,
  deletePesagemTodo,
} from '@/lib/pesagem-todo-helpers';
import { removeLoteInvestigacao } from '@/lib/dashpesagem-api';
import { copyToClipboard, cn } from '@/lib/utils';
import { Search, Plus, X, Copy, RefreshCw, Loader2, Trash2, RotateCcw, ArrowUpRight, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { getAllUsers } from '@/lib/firestore-helpers';
import { useFirebase } from '@/components/providers/firebase-provider';

export interface PersonOption {
  email: string;
  name: string;
  role?: string;
}

/* ============================================================================
 * Modelo de trabalho
 * ----------------------------------------------------------------------------
 * Cada lote acompanhado é um CASO que percorre um fluxo fixo (quadro kanban):
 *   Triagem → Investigação → Ação no SAP → Chamado Aberto → Concluído
 * - Categoria define o checklist (definição de pronto) do caso.
 * - Prioridade define o prazo (SLA). WIP limita casos por etapa.
 * - Concluir exige causa raiz + checklist obrigatório + desfecho.
 * Campos novos ficam no mesmo documento do Firestore (todos opcionais),
 * então itens antigos continuam funcionando.
 * ========================================================================== */

type Etapa = 'triagem' | 'investigacao' | 'acao_sap' | 'validacao' | 'concluido';
type Cat =
  | 'sistemico_maior'
  | 'fisico_maior'
  | 'troca_lote'
  | 'divergencia_pesagem'
  | 'trz_negativo'
  | 'saldo_negativo'
  | 'residual_parado'
  | 'lote_vencido'
  | 'outro';

type CheckItem = { id: string; t: string; req?: boolean; done: boolean; by?: string; at?: string };
type Evento = { id: string; tipo: string; texto: string; by?: string; at: string };
type Extra = {
  etapa?: Etapa;
  categoria?: Cat;
  checklist?: CheckItem[];
  causa_raiz?: string;
  responsavel?: string;
  prazo?: string;
  fisico_contado?: number;
  fisico_em?: string;
  documento_sap?: string;
  eventos?: Evento[];
};

const ETAPAS: { k: Etapa; l: string; d: string; status: PesagemTodoStatus; wip?: number }[] = [
  { k: 'triagem', l: 'Triagem', d: 'Entrou, ainda sem análise', status: 'pendente' },
  { k: 'investigacao', l: 'Investigação', d: 'Contagem, MB51, rastreio', status: 'em_investigacao', wip: 10 },
  { k: 'acao_sap', l: 'Ação no SAP', d: 'Ajuste, transferência, estorno', status: 'aguardando_sap', wip: 8 },
  { k: 'validacao', l: 'Chamado Aberto', d: 'Chamado de ajuste de saída aberto · aguardando saída do estoque', status: 'em_investigacao', wip: 6 },
  { k: 'concluido', l: 'Concluído', d: 'Últimos 14 dias', status: 'concluido' },
];
const etapaMeta = (e: Etapa) => ETAPAS.find((x) => x.k === e) || ETAPAS[0];
const etapaFromStatus = (s: PesagemTodoStatus): Etapa =>
  s === 'concluido' ? 'concluido' : s === 'aguardando_sap' ? 'acao_sap' : s === 'em_investigacao' ? 'investigacao' : 'triagem';

const CATS: Record<Cat, { l: string; hint: string; tpl: { t: string; req?: boolean }[] }> = {
  sistemico_maior: {
    l: 'Saldo sem físico',
    hint: 'SAP mostra mais do que existe na área',
    tpl: [
      { t: 'Contar o físico na área PES', req: true },
      { t: 'Consultar movimentos do lote na MB51', req: true },
      { t: 'Verificar baixa de OP ou remessa não lançada' },
      { t: 'Checar possível troca de lote' },
      { t: 'Lançar ajuste ou abrir RNC', req: true },
    ],
  },
  fisico_maior: {
    l: 'Físico sem saldo',
    hint: 'Existe material na área sem saldo no SAP',
    tpl: [
      { t: 'Contar o físico e conferir etiqueta do lote', req: true },
      { t: 'Rastrear origem na MB51 / LT10', req: true },
      { t: 'Verificar devolução não lançada' },
      { t: 'Checar troca com outro lote do material' },
      { t: 'Regularizar entrada ou transferência', req: true },
    ],
  },
  troca_lote: {
    l: 'Troca de lote',
    hint: 'Consumo ou movimento no lote errado',
    tpl: [
      { t: 'Identificar os lotes envolvidos', req: true },
      { t: 'Conferir etiquetas físicas e ordens de pesagem', req: true },
      { t: 'Verificar OPs afetadas' },
      { t: 'Comunicar a Qualidade (desvio)', req: true },
      { t: 'Corrigir os movimentos no SAP', req: true },
    ],
  },
  divergencia_pesagem: {
    l: 'Divergência de pesagem',
    hint: 'Quantidade pesada diferente do previsto',
    tpl: [
      { t: 'Conferir registro da pesagem (ordem / batch record)', req: true },
      { t: 'Verificar calibração da balança' },
      { t: 'Pesar novamente o saldo', req: true },
      { t: 'Ajustar saldo no SAP', req: true },
    ],
  },
  trz_negativo: {
    l: 'TR-ZONE negativo',
    hint: 'Saldo abaixo de zero na 922',
    tpl: [
      { t: 'Localizar OT pendente (LT23 / LT10)', req: true },
      { t: 'Confirmar ou estornar a OT', req: true },
      { t: 'Validar saldo na LX02', req: true },
    ],
  },
  saldo_negativo: {
    l: 'Saldo negativo',
    hint: 'Saldo abaixo de zero fora da TR-ZONE',
    tpl: [
      { t: 'Consultar movimentos na MB51', req: true },
      { t: 'Identificar movimento que gerou o negativo', req: true },
      { t: 'Corrigir no SAP', req: true },
    ],
  },
  residual_parado: {
    l: 'Residual parado',
    hint: 'Sobra pequena sem consumo previsto',
    tpl: [
      { t: 'Verificar remessa ou OP que consuma o saldo', req: true },
      { t: 'Decidir: consumir, devolver ou baixar', req: true },
      { t: 'Executar o movimento (ZWM296 / MIGO)', req: true },
    ],
  },
  lote_vencido: {
    l: 'Lote vencido',
    hint: 'Validade expirada com saldo',
    tpl: [
      { t: 'Confirmar validade no SAP', req: true },
      { t: 'Bloquear o estoque (MIGO)', req: true },
      { t: 'Segregar o físico', req: true },
      { t: 'Encaminhar à Qualidade / descarte' },
    ],
  },
  outro: {
    l: 'Outro',
    hint: 'Acompanhamento geral',
    tpl: [{ t: 'Analisar e definir ação', req: true }],
  },
};
const CAT_KEYS = Object.keys(CATS) as Cat[];
const normalizeCat = (c?: string): Cat => {
  if (!c) return 'outro';
  if (c in CATS) return c as Cat;
  const found = (Object.keys(CATS) as Cat[]).find((k) => CATS[k].l.toLowerCase() === c.toLowerCase());
  return found || 'outro';
};

const CAUSAS: { k: string; l: string }[] = [
  { k: 'erro_pesagem', l: 'Erro de pesagem' },
  { k: 'troca_lote', l: 'Troca de lote' },
  { k: 'baixa_pendente', l: 'Consumo / baixa não lançada' },
  { k: 'devolucao_nao_lancada', l: 'Devolução não lançada' },
  { k: 'transferencia_pendente', l: 'OT / transferência pendente' },
  { k: 'movimento_incorreto', l: 'Movimento SAP incorreto' },
  { k: 'perda_processo', l: 'Perda de processo' },
  { k: 'erro_cadastro', l: 'Erro de cadastro / UMB' },
  { k: 'sem_divergencia', l: 'Sem divergência (falso alerta)' },
  { k: 'nao_identificada', l: 'Não identificada' },
];
const causaL = (k?: string) => {
  if (!k) return '';
  const found = CAUSAS.find((c) => c.k === k);
  return found ? found.l : k;
};

const PRIO: { k: PesagemTodoPriority; l: string; w: number; c: string }[] = [
  { k: 'critica', l: 'Crítica', w: 6, c: 'var(--red)' },
  { k: 'alta', l: 'Alta', w: 3, c: 'var(--amber)' },
  { k: 'media', l: 'Média', w: 1, c: 'var(--text-3)' },
  { k: 'baixa', l: 'Baixa', w: 0, c: 'var(--text-3)' },
];
const prioMeta = (p: PesagemTodoPriority) => PRIO.find((x) => x.k === p) || PRIO[2];
const SLA_DIAS: Record<PesagemTodoPriority, number> = { critica: 1, alta: 3, media: 7, baixa: 14 };

const DIAS_SEM_REGISTRO = 2;
const DIAS_PARADO = 5;
const DIAS_SAP = 3;
const DIAS_CONCLUIDOS_QUADRO = 14;
const IGNORAR_DIAS = 7;

const DESFECHOS = [
  'Ajuste de inventário lançado',
  'Transferência / OT confirmada',
  'Consumo lançado na OP',
  'Devolvido ao almoxarifado',
  'Estorno do movimento incorreto',
  'Saldo conferido, sem divergência',
];

/* ============================================================================
 * Helpers
 * ========================================================================== */
type Tone = 'red' | 'amber' | 'green' | 'muted';
const TONE: Record<Tone, string> = { red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)', muted: 'var(--text-3)' };

const up = (s?: string | null) => String(s ?? '').trim().toUpperCase();
const uid = () => Math.random().toString(36).slice(2, 10);
const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlK = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e4) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl(v);
};
const qf = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
const sgn = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + qf(Math.abs(v));
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysSince = (s?: string) => {
  if (!s) return 0;
  const t = new Date(s);
  return isNaN(t.getTime()) ? 0 : Math.max(0, Math.round((day0(new Date()).getTime() - day0(t).getTime()) / 86400000));
};
const dt = (s?: string) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const dShort = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = (d: number) => (d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} d`);
const clean = (s?: string) => (s || '').replace(/\*\*/g, '');
const parseNum = (s: string) => {
  let x = String(s).trim().replace(/\s/g, '');
  if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(x);
  return isNaN(n) ? null : n;
};
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  let m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
const initials = (emailOrName?: string) => {
  if (!emailOrName) return '';
  const str = emailOrName.includes('@')
    ? emailOrName.split('@')[0].replace(/\d+/g, ' ')
    : emailOrName;
  const n = str.split(/[._\s-]+/).filter(Boolean);
  return ((n[0]?.[0] || '') + (n[1]?.[0] || n[0]?.[1] || '')).toUpperCase();
};
const shortName = (emailOrName?: string) => {
  if (!emailOrName) return '';
  const trimmed = emailOrName.trim();
  if (!trimmed.includes('@')) {
    return trimmed.replace(/\s*\d+$/, '');
  }
  const prefix = trimmed.split('@')[0];
  const cleaned = prefix.replace(/\d+/g, ' ').trim();
  const n = cleaned.split(/[._\s-]+/).filter(Boolean);
  if (n.length === 0) {
    const raw = prefix.split(/[._-]+/).filter(Boolean);
    return raw.map((p) => p[0].toUpperCase() + p.slice(1)).slice(0, 2).join(' ');
  }
  return n.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).slice(0, 2).join(' ');
};
function isTrZone(i: Pick<AgingData, 'deposito' | 'tipo_deposito' | 'posicao_deposito'>) {
  const t = up(i.tipo_deposito);
  const p = up(i.posicao_deposito).replace(/[\s_]/g, '-');
  return t.includes('922') || t.includes('TR-ZONE') || p.includes('TR-ZONE') || up(i.deposito) === '922';
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

function Dot({ c, className }: { c: string; className?: string }) {
  return <span className={cn('inline-block w-[7px] h-[7px] rounded-full shrink-0', className)} style={{ background: c }} />;
}
function Avatar({ email, name, size = 20 }: { email?: string; name?: string; size?: number }) {
  if (!email && !name) return <span className="inline-grid place-items-center rounded-full border border-dashed border-[var(--border-strong)] text-[var(--text-3)]" style={{ width: size, height: size, fontSize: size * 0.45 }} title="Sem responsável">?</span>;
  const label = name || (email ? shortName(email) : '');
  return (
    <span
      className="inline-grid place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] font-mono text-[var(--text-2)] shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      title={label || email}
    >
      {initials(label || email)}
    </span>
  );
}

/* ============================================================================
 * Tipos derivados
 * ========================================================================== */
type Reason = { k: string; tone: Tone; text: string; w: number };
type Row = PesagemTodoItem &
  Extra & {
    key: string;
    synth: boolean;
    etapaX: Etapa;
    cat: Cat;
    checklistX: CheckItem[];
    reqDone: number;
    reqTot: number;
    allDone: number;
    estoque_atual: number;
    valor_atual: number;
    posicao_atual: string;
    deposito_atual: string;
    dias_aging_atual?: number;
    localizado: boolean;
    diff: 'ok' | 'saiu' | 'reduziu' | 'aumentou' | 'posicao';
    diffQ: number;
    diffV: number;
    vu: number;
    prazoX: Date;
    slaDias: number;
    reasons: Reason[];
    score: number;
    diasAberto: number;
    diasSemAtividade: number;
    valorRef: number;
    isDone: boolean;
  };
type Cand = { item: AgingData; cat: Cat; prio: PesagemTodoPriority; why: string; valor: number };
type Prefill = { lote?: string; cat?: Cat; prio?: PesagemTodoPriority; motivo?: string };

/* ============================================================================
 * Props
 * ========================================================================== */
interface TodoViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
  todoItems: PesagemTodoItem[];
  lotesInvestigacao?: LoteInvestigacao[];
  currentUserEmail?: string;
  /** opcional: usa os limites de aging/residual configurados para a detecção automática */
  configResiduais?: ConfiguracaoResiduais;
  onNavigateToMaterial?: (material: string) => void;
  onAtualizarDb?: () => void;
  isAtualizandoDb?: boolean;
  onInvestigacaoChange?: () => void;
  selectedLote?: string | null;
  onClearSelectedLote?: () => void;
}

/* ============================================================================
 * View
 * ========================================================================== */
export function TodoView({
  agingData,
  valores,
  todoItems,
  lotesInvestigacao = [],
  currentUserEmail,
  configResiduais,
  onNavigateToMaterial,
  onAtualizarDb,
  isAtualizandoDb,
  onInvestigacaoChange,
  selectedLote,
  onClearSelectedLote,
}: TodoViewProps) {
  const { userData, user } = useFirebase();
  const me = userData?.email || user?.email || auth.currentUser?.email || currentUserEmail || 'operador';

  const [view, setView] = useState<'quadro' | 'lista' | 'metricas'>('quadro');
  const [quick, setQuick] = useState<'todos' | 'atencao' | 'vencidos' | 'semresp' | 'meus'>('todos');
  const [q, setQ] = useState('');
  const [catF, setCatF] = useState<'all' | Cat>('all');
  const [prioF, setPrioF] = useState<'all' | PesagemTodoPriority>('all');
  const [selKey, setSelKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [fisico, setFisico] = useState('');
  const [newStep, setNewStep] = useState('');
  const [customCausaOpen, setCustomCausaOpen] = useState(false);
  const [customCausaInput, setCustomCausaInput] = useState('');
  const [resolving, setResolving] = useState<Row | null>(null);
  const [create, setCreate] = useState<{ open: boolean; prefill: Prefill }>({ open: false, prefill: {} });
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Etapa | null>(null);
  const [detectOpen, setDetectOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Extra & { prioridade?: PesagemTodoPriority; status?: PesagemTodoStatus }>>>({});
  const [appUsers, setAppUsers] = useState<{ uid: string; name?: string; email?: string; role?: string }[]>([]);
  const realizedRef = useRef<Record<string, string>>({});

  const searchRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Carrega lista de usuários cadastrados no sistema em tempo real
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const qUsers = query(collection(db, 'users'));
      unsub = onSnapshot(
        qUsers,
        (snap) => {
          const list = snap.docs.map((d) => ({
            uid: d.id,
            ...d.data(),
          }));
          setAppUsers(list);
        },
        (err) => {
          console.warn('Erro ao escutar usuários, tentando getAllUsers fallback:', err);
          getAllUsers().then((u: any) => setAppUsers(u || [])).catch(() => {});
        }
      );
    } catch {
      getAllUsers().then((u: any) => setAppUsers(u || [])).catch(() => {});
    }
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const v = store.get('pes_case_view');
    if (v === 'quadro' || v === 'lista' || v === 'metricas') setView(v);
    try {
      setDismissed(JSON.parse(store.get('pes_case_dismiss') || '{}'));
    } catch {
      /* ignora */
    }
  }, []);
  const changeView = (v: typeof view) => {
    setView(v);
    store.set('pes_case_view', v);
  };

  /* ---------------- estoque atual por lote ---------------- */
  const priceOf = useCallback((m: string) => valores[m] ?? valores[String(m).replace(/^0+/, '')] ?? 0, [valores]);

  const estoque = useMemo(() => {
    const m = new Map<string, { row: AgingData; total: number }>();
    for (const i of agingData) {
      if (!i.lote) continue;
      const k = up(i.lote);
      const q = Number(i.estoque_disponivel) || 0;
      const cur = m.get(k);
      if (!cur) m.set(k, { row: i, total: q });
      else {
        cur.total += q;
        if (Math.abs(q) > Math.abs(Number(cur.row.estoque_disponivel) || 0)) cur.row = i;
      }
    }
    return m;
  }, [agingData]);

  /* ---------------- itens: Firestore + lotes marcados em investigação ---------------- */
  const allItems = useMemo<(PesagemTodoItem & Extra)[]>(() => {
    const has = new Set(todoItems.map((t) => up(t.lote)));
    const synth: (PesagemTodoItem & Extra)[] = [];
    for (const inv of lotesInvestigacao || []) {
      const k = up(inv.lote);
      if (!k || has.has(k)) continue;
      const s = estoque.get(k)?.row;
      const qtd = estoque.get(k)?.total || 0;
      const mat = inv.material || s?.material || '';
      const vu = priceOf(mat);
      synth.push({
        id: `inv-${k}`,
        material: mat,
        texto_breve_material: s?.texto_breve_material || '',
        lote: inv.lote,
        unidade_medida: s?.unidade_medida || 'KG',
        quantidade_inicial: qtd,
        valor_unitario_inicial: vu,
        valor_total_inicial: Math.max(0, qtd) * vu,
        deposito_inicial: s?.deposito || 'PES',
        tipo_deposito_inicial: s?.tipo_deposito || 'PES',
        posicao_deposito_inicial: s?.posicao_deposito || '',
        dias_aging_inicial: s?.dias_aging ?? 0,
        data_vencimento: s?.data_vencimento || '',
        status: 'em_investigacao',
        prioridade: 'alta',
        motivo_inicial: inv.motivo || 'Marcado em investigação',
        notas: [],
        tags: ['Investigação'],
        created_at: inv.created_at || new Date().toISOString(),
        updated_at: inv.created_at || new Date().toISOString(),
        created_by_name: inv.created_by || 'Investigação',
      } as PesagemTodoItem & Extra);
    }
    return [...(todoItems as (PesagemTodoItem & Extra)[]), ...synth];
  }, [todoItems, lotesInvestigacao, estoque, priceOf]);

  /* ---------------- enriquecimento ---------------- */
  const rows = useMemo<Row[]>(() => {
    const hoje = day0(new Date());
    return allItems.map((t) => {
      const key = up(t.lote) || t.id;
      const s = estoque.get(key);
      const saiu = !s || Math.abs(s.total) < 0.0005;
      const estoque_atual = s ? s.total : 0;
      const vu = (s && priceOf(s.row.material)) || t.valor_unitario_inicial || 0;
      const valor_atual = Math.max(0, estoque_atual) * vu;
      const posicao_atual = s?.row.posicao_deposito || '';
      const deposito_atual = s?.row.deposito || '';
      const diffQ = estoque_atual - (t.quantidade_inicial || 0);
      const diffV = valor_atual - (t.valor_total_inicial || 0);
      const posMudou =
        !!s &&
        ((!!posicao_atual && !!t.posicao_deposito_inicial && up(posicao_atual) !== up(t.posicao_deposito_inicial)) ||
          (!!deposito_atual && !!t.deposito_inicial && up(deposito_atual) !== up(t.deposito_inicial)));
      const diff: Row['diff'] = saiu ? 'saiu' : Math.abs(diffQ) > 0.001 ? (diffQ < 0 ? 'reduziu' : 'aumentou') : posMudou ? 'posicao' : 'ok';

      const opt = optimistic[key] || {};
      const mergedT = { ...t, ...opt };
      const isDone = mergedT.status === 'concluido';
      const etapaX: Etapa = isDone ? 'concluido' : mergedT.etapa && mergedT.etapa !== 'concluido' ? (mergedT.etapa as Etapa) : etapaFromStatus(mergedT.status);
      const cat: Cat = normalizeCat(mergedT.categoria) || (s && isTrZone(s.row) && s.total < 0 ? 'trz_negativo' : s && s.total < 0 ? 'saldo_negativo' : 'outro');
      const checklistX: CheckItem[] =
        mergedT.checklist && mergedT.checklist.length ? mergedT.checklist : (CATS[cat] || CATS.outro).tpl.map((x, i) => ({ id: `t${i}`, t: x.t, req: !!x.req, done: false }));
      const reqTot = checklistX.filter((c) => c.req).length;
      const reqDone = checklistX.filter((c) => c.req && c.done).length;
      const allDone = checklistX.filter((c) => c.done).length;

      const created = new Date(mergedT.created_at);
      const prazoX = (mergedT.prazo && parseDate(mergedT.prazo)) || day0(new Date(created.getTime() + SLA_DIAS[mergedT.prioridade || 'media'] * 86400000));
      const slaDias = Math.round((day0(prazoX).getTime() - hoje.getTime()) / 86400000);

      const lastNote = (mergedT.notas || []).reduce<string | undefined>((m, n) => (!m || n.created_at > m ? n.created_at : m), undefined);
      const lastEv = (mergedT.eventos || []).reduce<string | undefined>((m, n) => (!m || n.at > m ? n.at : m), undefined);
      const lastAct = [mergedT.updated_at, lastNote, lastEv, mergedT.created_at].filter(Boolean).sort().pop() as string;
      const diasAberto = daysSince(mergedT.created_at);
      const diasSemAtividade = daysSince(lastAct);
      const registros = (mergedT.notas || []).length + (mergedT.eventos || []).filter((e) => e.tipo !== 'sistema').length;

      const reasons: Reason[] = [];
      if (!isDone) {
        if (diff === 'saiu') reasons.push({ k: 'saiu', tone: 'red', text: 'Saiu do estoque · confirme e conclua', w: 10 });
        else if (diff === 'reduziu') reasons.push({ k: 'qtd', tone: 'amber', text: `Saldo caiu ${sgn(diffQ)} ${mergedT.unidade_medida}`, w: 6 });
        else if (diff === 'aumentou') reasons.push({ k: 'qtd', tone: 'amber', text: `Saldo subiu ${sgn(diffQ)} ${mergedT.unidade_medida}`, w: 5 });
        else if (diff === 'posicao') reasons.push({ k: 'pos', tone: 'amber', text: `Mudou para ${posicao_atual || deposito_atual}`, w: 5 });
        if (slaDias < 0) reasons.push({ k: 'sla', tone: 'red', text: `Prazo vencido há ${-slaDias} d`, w: 8 });
        else if (slaDias <= 1) reasons.push({ k: 'sla', tone: 'amber', text: slaDias === 0 ? 'Prazo vence hoje' : 'Prazo vence amanhã', w: 4 });
        if (!mergedT.responsavel) reasons.push({ k: 'resp', tone: 'amber', text: 'Sem responsável', w: 3 });
        if (etapaX === 'triagem' && diasAberto >= 1) reasons.push({ k: 'triagem', tone: 'amber', text: `Aguardando triagem há ${diasAberto} d`, w: 3 });
        if (!registros && diasAberto >= DIAS_SEM_REGISTRO) reasons.push({ k: 'nota', tone: 'amber', text: `Sem registro há ${diasAberto} d`, w: 4 });
        else if (diasSemAtividade >= DIAS_PARADO) reasons.push({ k: 'parado', tone: 'amber', text: `Parado há ${diasSemAtividade} d`, w: 4 });
        if (etapaX === 'acao_sap' && diasSemAtividade >= DIAS_SAP) reasons.push({ k: 'sap', tone: 'amber', text: `No SAP há ${diasSemAtividade} d`, w: 3 });
        if (etapaX === 'validacao' && reqDone === reqTot && mergedT.causa_raiz)
          reasons.push({ k: 'pronto', tone: 'green', text: 'Pronto para concluir', w: 2 });
      }
      const valorRef = saiu ? mergedT.valor_total_inicial || 0 : valor_atual;
      const score =
        reasons.reduce((a, r) => a + r.w, 0) + prioMeta(mergedT.prioridade).w + Math.min(3, Math.log10(1 + valorRef / 1000));

      return {
        ...mergedT,
        key,
        synth: mergedT.id.startsWith('inv-') && !realizedRef.current[key],
        id: realizedRef.current[key] || mergedT.id,
        etapaX,
        cat,
        checklistX,
        reqDone,
        reqTot,
        allDone,
        estoque_atual,
        valor_atual,
        posicao_atual,
        deposito_atual,
        dias_aging_atual: s?.row.dias_aging,
        localizado: !saiu,
        diff,
        diffQ,
        diffV,
        vu,
        prazoX,
        slaDias,
        reasons,
        score,
        diasAberto,
        diasSemAtividade,
        valorRef,
        isDone,
      } as Row;
    });
  }, [allItems, estoque, priceOf, optimistic]);

  const open = useMemo(() => rows.filter((r) => !r.isDone), [rows]);
  const needsYou = (r: Row) => r.reasons.some((x) => x.tone === 'red' || x.tone === 'amber');

  /* ---------------- detecção automática ---------------- */
  const candidates = useMemo<Cand[]>(() => {
    const openKeys = new Set(open.map((r) => r.key));
    const now = Date.now();
    const diasCrit = configResiduais?.dias_critico ?? 15;
    const maxRes = (configResiduais?.limite_maximo ?? 999) / 1000;
    const hoje = day0(new Date());
    const out: Cand[] = [];
    const seen = new Set<string>();
    for (const i of agingData) {
      const k = up(i.lote);
      if (!k || seen.has(k) || openKeys.has(k) || (dismissed[k] && dismissed[k] > now)) continue;
      const qtd = Number(i.estoque_disponivel) || 0;
      const v = Math.max(0, qtd) * priceOf(i.material);
      const venc = parseDate(i.data_vencimento);
      let c: Cand | null = null;
      if (qtd < 0 && isTrZone(i)) c = { item: i, cat: 'trz_negativo', prio: 'alta', why: `TR-ZONE com ${qf(qtd)} ${i.unidade_medida || ''}`, valor: v };
      else if (qtd < 0) c = { item: i, cat: 'saldo_negativo', prio: 'alta', why: `Saldo negativo ${qf(qtd)} ${i.unidade_medida || ''}`, valor: v };
      else if (qtd > 0 && venc && venc < hoje) c = { item: i, cat: 'lote_vencido', prio: 'alta', why: `Vencido em ${dShort(venc)} com saldo`, valor: v };
      else if (up(i.unidade_medida || 'KG') === 'KG' && qtd > 0 && qtd <= maxRes && (i.dias_aging || 0) >= diasCrit)
        c = { item: i, cat: 'residual_parado', prio: 'media', why: `Residual de ${qf(qtd)} kg parado há ${i.dias_aging} d`, valor: v };
      if (c) {
        seen.add(k);
        out.push(c);
      }
    }
    const order: Record<string, number> = { trz_negativo: 0, saldo_negativo: 1, lote_vencido: 2, residual_parado: 3 };
    return out.sort((a, b) => order[a.cat] - order[b.cat] || b.valor - a.valor).slice(0, 60);
  }, [agingData, open, dismissed, priceOf, configResiduais]);

  const dismiss = (lote: string) => {
    const next = { ...dismissed, [up(lote)]: Date.now() + IGNORAR_DIAS * 86400000 };
    setDismissed(next);
    store.set('pes_case_dismiss', JSON.stringify(next));
  };

  /* ---------------- indicadores ---------------- */
  const stats = useMemo(() => {
    const done = rows.filter((r) => r.isDone);
    const resolvedAt = (r: Row) => new Date(r.resolvido_em || r.updated_at);
    const d30 = done.filter((r) => daysSince(r.resolvido_em || r.updated_at) <= 30);
    const leads = d30.map((r) => Math.max(0, (resolvedAt(r).getTime() - new Date(r.created_at).getTime()) / 86400000)).sort((a, b) => a - b);
    const avg = leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : null;
    const p85 = leads.length ? leads[Math.min(leads.length - 1, Math.floor(leads.length * 0.85))] : null;
    const done7 = done.filter((r) => daysSince(r.resolvido_em || r.updated_at) <= 7).length;
    const in7 = rows.filter((r) => daysSince(r.created_at) <= 7).length;
    const noPrazo = d30.filter((r) => day0(resolvedAt(r)) <= day0(r.prazoX)).length;
    return {
      open: open.length,
      openValor: open.reduce((a, r) => a + r.valorRef, 0),
      att: open.filter(needsYou).length,
      vencidos: open.filter((r) => r.slaDias < 0).length,
      semResp: open.filter((r) => !r.responsavel).length,
      meus: open.filter((r) => r.responsavel === me).length,
      avg,
      p85,
      done7,
      in7,
      noPrazoPct: d30.length ? Math.round((noPrazo / d30.length) * 100) : null,
      d30: d30.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, open, me]);

  /* ---------------- filtro ---------------- */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (quick === 'atencao' && (r.isDone || !needsYou(r))) return false;
        if (quick === 'vencidos' && (r.isDone || r.slaDias >= 0)) return false;
        if (quick === 'semresp' && (r.isDone || r.responsavel)) return false;
        if (quick === 'meus' && r.responsavel !== me) return false;
        if (catF !== 'all' && r.cat !== catF) return false;
        if (prioF !== 'all' && r.prioridade !== prioF) return false;
        if (s) {
          const hay = [r.lote, r.material, r.texto_breve_material, r.motivo_inicial, r.desfecho, r.responsavel, causaL(r.causa_raiz), CATS[r.cat].l, ...(r.notas || []).map((n) => n.texto)]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => b.score - a.score || b.valorRef - a.valorRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, quick, catF, prioF, q, me]);

  const peopleOptions = useMemo<PersonOption[]>(() => {
    const map = new Map<string, PersonOption>();

    const myDisplayName = userData?.name?.trim() || user?.displayName?.trim() || auth.currentUser?.displayName?.trim();

    if (me && me !== 'operador') {
      map.set(me.toLowerCase(), {
        email: me,
        name: myDisplayName || shortName(me),
      });
    }

    for (const u of appUsers) {
      const email = u.email?.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      const existing = map.get(key);
      const name = u.name?.trim() || existing?.name || shortName(email);
      map.set(key, {
        email,
        name,
        role: u.role,
      });
    }

    for (const r of rows) {
      if (r.responsavel && r.responsavel.includes('@')) {
        const key = r.responsavel.toLowerCase();
        if (!map.has(key)) {
          const userMatch = appUsers.find((u) => u.email?.toLowerCase() === key);
          map.set(key, { email: r.responsavel, name: userMatch?.name?.trim() || shortName(r.responsavel) });
        }
      }
      if (r.created_by_name && r.created_by_name.includes('@')) {
        const key = r.created_by_name.toLowerCase();
        if (!map.has(key)) {
          const userMatch = appUsers.find((u) => u.email?.toLowerCase() === key);
          map.set(key, { email: r.created_by_name, name: userMatch?.name?.trim() || shortName(r.created_by_name) });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [appUsers, me, rows, user?.displayName, userData?.name]);

  const people = useMemo(() => peopleOptions.map((p) => p.email), [peopleOptions]);

  const getPersonName = useCallback(
    (identifier?: string) => {
      if (!identifier) return '';
      const trimmed = identifier.trim();
      const lower = trimmed.toLowerCase();

      // 1. Usuário atual logado
      if (
        (me && lower === me.toLowerCase()) ||
        (user?.email && lower === user.email.toLowerCase()) ||
        (user?.uid && lower === user.uid.toLowerCase())
      ) {
        if (userData?.name?.trim()) return userData.name.trim();
        if (user?.displayName?.trim()) return user.displayName.trim();
        if (auth.currentUser?.displayName?.trim()) return auth.currentUser.displayName.trim();
      }

      // 2. Base de usuários cadastrados (appUsers do Firestore)
      const foundUser = appUsers.find(
        (u) =>
          (u.email && u.email.toLowerCase() === lower) ||
          (u.uid && u.uid.toLowerCase() === lower) ||
          (u.name && u.name.toLowerCase() === lower)
      );
      if (foundUser?.name?.trim()) return foundUser.name.trim();

      // 3. Opções de pessoas combinadas (peopleOptions)
      const foundOpt = peopleOptions.find(
        (p) => p.email.toLowerCase() === lower || p.name.toLowerCase() === lower
      );
      if (foundOpt?.name?.trim() && !foundOpt.name.includes('@')) {
        return foundOpt.name.trim();
      }

      // 4. Se não contém '@', é provavelmente um nome já formatado
      if (!trimmed.includes('@')) {
        return trimmed.replace(/\s*\d+$/, '');
      }

      // 5. Fallback limpo a partir do email
      return shortName(trimmed);
    },
    [appUsers, me, peopleOptions, user, userData]
  );

  const sel = useMemo(() => (selKey ? rows.find((r) => r.key === selKey) || null : null), [rows, selKey]);
  useEffect(() => {
    setNote('');
    setFisico('');
    setNewStep('');
    if (sel) {
      const isCustom = !!sel.causa_raiz && !CAUSAS.some((c) => c.k === sel.causa_raiz);
      setCustomCausaOpen(isCustom);
      setCustomCausaInput(isCustom ? sel.causa_raiz || '' : '');
    } else {
      setCustomCausaOpen(false);
      setCustomCausaInput('');
    }
  }, [selKey, sel?.causa_raiz]);

  // Lote vindo de outra tela
  useEffect(() => {
    if (!selectedLote) return;
    const k = up(selectedLote);
    if (rows.some((r) => r.key === k)) {
      setQuick('todos');
      setSelKey(k);
      onClearSelectedLote?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLote, rows]);

  /* ============================================================================
   * Persistência
   * ========================================================================== */
  const ev = (tipo: string, texto: string): Evento => ({ id: uid(), tipo, texto, by: me, at: new Date().toISOString() });

  const run = async (fn: () => Promise<unknown>, ok: string, err: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      console.error(e);
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Lote só marcado em investigação vira caso real na primeira ação
  const ensureReal = async (r: Row, notaInicial?: string): Promise<string> => {
    if (!r.synth) return r.id;
    if (realizedRef.current[r.key]) return realizedRef.current[r.key];

    const id = await createPesagemTodo({
      material: r.material,
      texto_breve_material: r.texto_breve_material,
      lote: r.lote,
      quantidade: r.quantidade_inicial,
      unidade_medida: r.unidade_medida,
      deposito: r.deposito_inicial,
      tipo_deposito: r.tipo_deposito_inicial,
      posicao_deposito: r.posicao_deposito_inicial,
      valor_unitario: r.valor_unitario_inicial,
      valor_total: r.valor_total_inicial,
      dias_aging: r.dias_aging_inicial,
      data_vencimento: r.data_vencimento,
      motivo_inicial: r.motivo_inicial || 'Marcado em investigação',
      prioridade: r.prioridade || 'alta',
      status: r.status || 'em_investigacao',
      categoria: r.cat,
      checklist: r.checklistX,
      etapa: r.etapaX,
      responsavel: r.responsavel,
      causa_raiz: r.causa_raiz,
      nota_inicial: notaInicial,
    } as any);

    realizedRef.current[r.key] = id;
    return id;
  };

  /** grava campos novos; materializa checklist/categoria no primeiro salvamento */
  const patch = async (r: Row, fields: Partial<Extra>, evento?: Evento) => {
    // 1. Atualização otimista imediata na interface
    setOptimistic((prev) => ({
      ...prev,
      [r.key]: {
        ...(prev[r.key] || {}),
        ...fields,
        ...(evento ? { eventos: [...(r.eventos || []), evento] } : {}),
      },
    }));

    try {
      const id = await ensureReal(r);
      await updatePesagemTodo(id, {
        categoria: fields.categoria ?? r.cat,
        checklist: fields.checklist ?? r.checklistX,
        etapa: fields.etapa ?? r.etapaX,
        ...fields,
        ...(evento ? { eventos: [...(r.eventos || []), evento] } : {}),
      } as any);
      return id;
    } catch (err) {
      setOptimistic((prev) => {
        const copy = { ...prev };
        delete copy[r.key];
        return copy;
      });
      throw err;
    }
  };

  const wipCount = (e: Etapa) => open.filter((r) => r.etapaX === e).length;

  const moveTo = (r: Row, to: Etapa) => {
    if (to === r.etapaX) return;
    if (to === 'concluido') return setResolving(r);
    const lim = etapaMeta(to).wip;
    if (lim && wipCount(to) >= lim) toast(`${etapaMeta(to).l} já tem ${wipCount(to)} casos (limite ${lim}). Considere fechar algum antes.`);
    run(
      async () => {
        const id = await ensureReal(r);
        const st = etapaMeta(to).status;
        if (r.status !== st) await updatePesagemTodoStatus(id, st);
        await updatePesagemTodo(id, {
          categoria: r.cat,
          checklist: r.checklistX,
          etapa: to,
          eventos: [...(r.eventos || []), ev('etapa', r.isDone ? `Reaberto em ${etapaMeta(to).l}` : `${etapaMeta(r.etapaX).l} → ${etapaMeta(to).l}`)],
        } as any);
      },
      '',
      'Não foi possível mover o caso'
    );
  };

  const toggleCheck = (r: Row, id: string) => {
    const c = r.checklistX.find((x) => x.id === id);
    if (!c) return;
    const done = !c.done;
    const list = r.checklistX.map((x) => (x.id === id ? { ...x, done, by: done ? me : undefined, at: done ? new Date().toISOString() : undefined } : x));
    run(() => patch(r, { checklist: list }, done ? ev('check', `Feito: ${c.t}`) : undefined), '', 'Não foi possível salvar');
  };

  const addStep = (r: Row) => {
    const t = newStep.trim();
    if (!t) return;
    run(
      async () => {
        await patch(r, { checklist: [...r.checklistX, { id: uid(), t, done: false }] }, ev('check', `Passo adicionado: ${t}`));
        setNewStep('');
      },
      '',
      'Não foi possível adicionar'
    );
  };

  const setCategoria = (r: Row, c: Cat) => {
    if (c === r.cat) return;
    const keep = r.checklistX.some((x) => x.done);
    const checklist = keep ? r.checklistX : (CATS[c] || CATS.outro).tpl.map((x, i) => ({ id: `t${i}`, t: x.t, req: !!x.req, done: false }));
    const label = (CATS[c] || CATS.outro).l;
    run(
      () => patch(r, { categoria: c, checklist }, ev('cat', `Categoria: ${label}`)),
      keep ? `Categoria alterada: ${label} (checklist mantido)` : `Categoria alterada: ${label}`,
      'Não foi possível salvar a categoria'
    );
  };

  const setPrioridade = (r: Row, p: PesagemTodoPriority) => {
    if (p === r.prioridade) return;
    run(() => patch(r, { prioridade: p } as any, ev('prio', `Prioridade: ${prioMeta(p).l}`)), '', 'Não foi possível salvar');
  };

  const setResp = (r: Row, email: string) => {
    const cleanEmail = (email || '').trim();
    if (cleanEmail === (r.responsavel || '')) return;
    const dispName = getPersonName(cleanEmail);
    const toastMsg = cleanEmail ? `Responsável atribuído: ${dispName}` : 'Responsável desatribuído';
    run(
      () => patch(r, { responsavel: cleanEmail }, ev('resp', cleanEmail ? `Responsável: ${dispName}` : 'Sem responsável')),
      toastMsg,
      'Não foi possível atribuir o responsável'
    );
  };

  const setPrazo = (r: Row, iso: string) => run(() => patch(r, { prazo: iso }, ev('prazo', `Prazo: ${iso.split('-').reverse().join('/')}`)), '', 'Não foi possível salvar');

  const registrarFisico = (r: Row) => {
    const n = parseNum(fisico);
    if (n === null || n < 0) return toast.error('Informe a quantidade contada');
    const sys = r.localizado ? r.estoque_atual : r.quantidade_inicial;
    const dif = sys - n;
    const contarIdx = r.checklistX.findIndex((c) => !c.done && /^contar|pesar novamente/i.test(c.t));
    const checklist = contarIdx >= 0 ? r.checklistX.map((c, i) => (i === contarIdx ? { ...c, done: true, by: me, at: new Date().toISOString() } : c)) : r.checklistX;
    run(
      async () => {
        await patch(
          r,
          { fisico_contado: n, fisico_em: new Date().toISOString(), checklist },
          ev('fisico', `Contagem física ${qf(n)} ${r.unidade_medida} · SAP ${qf(sys)} · diferença ${sgn(-dif)} ${r.unidade_medida}`)
        );
        setFisico('');
      },
      'Contagem registrada',
      'Não foi possível registrar'
    );
  };

  const setCausa = (r: Row, k: string) => {
    const val = (k || '').trim();
    if (val === (r.causa_raiz || '')) return;
    const label = causaL(val);
    const toastMsg = val ? `Causa raiz: ${label}` : 'Causa raiz em apuração';
    run(
      () => patch(r, { causa_raiz: val }, ev('causa', val ? `Causa raiz: ${label}` : 'Causa raiz em apuração')),
      toastMsg,
      'Não foi possível salvar a causa raiz'
    );
  };

  const deleteEvento = (r: Row, evId: string) => {
    const evToDelete = (r.eventos || []).find((e) => e.id === evId);
    const updated = (r.eventos || []).filter((e) => e.id !== evId);
    const patchPayload: Partial<Extra> = { eventos: updated };

    // Se o evento apagado for de causa raiz, reverte para a causa anterior (ou limpa se não houver)
    if (evToDelete?.tipo === 'causa') {
      const lastCausaEv = [...updated].reverse().find((e) => e.tipo === 'causa');
      if (lastCausaEv) {
        const match = lastCausaEv.texto.replace(/^Causa raiz:\s*/, '').trim();
        const prevKey = CAUSAS.find((c) => c.l.toLowerCase() === match.toLowerCase())?.k || match;
        patchPayload.causa_raiz = prevKey;
      } else {
        patchPayload.causa_raiz = '';
      }
    }

    // Se o evento apagado for de categoria, reverte para a categoria anterior (ou padrão)
    if (evToDelete?.tipo === 'cat') {
      const lastCatEv = [...updated].reverse().find((e) => e.tipo === 'cat');
      if (lastCatEv) {
        const match = lastCatEv.texto.replace(/^Categoria:\s*/, '').trim();
        const prevCat = (Object.keys(CATS) as Cat[]).find((c) => CATS[c].l.toLowerCase() === match.toLowerCase()) || 'outro';
        patchPayload.categoria = prevCat;
      } else {
        const sys = r.localizado ? r.estoque_atual : r.quantidade_inicial;
        const defaultCat: Cat = sys < 0 ? 'saldo_negativo' : 'outro';
        patchPayload.categoria = defaultCat;
      }
    }

    run(
      () => patch(r, patchPayload),
      'Registro apagado do histórico',
      'Não foi possível apagar o registro'
    );
  };

  const saveNote = (r: Row) => {
    const t = note.trim();
    if (!t) return;
    run(
      async () => {
        if (r.synth) {
          const id = await ensureReal(r, t);
          await updatePesagemTodo(id, { categoria: r.cat, checklist: r.checklistX, etapa: r.etapaX } as any);
        } else await addPesagemTodoNote(r.id, r.notas, t);
        setNote('');
      },
      '',
      'Não foi possível salvar a nota'
    );
  };

  const confirmResolve = (r: Row, d: { causa: string; desfecho: string; doc: string; override: string }) =>
    run(
      async () => {
        const id = await ensureReal(r);
        const evs = [...(r.eventos || [])];
        if (d.override) evs.push(ev('sistema', `Concluído com pendências no checklist: ${d.override}`));
        evs.push(ev('etapa', `Concluído · ${causaL(d.causa)}${d.doc ? ` · doc. SAP ${d.doc}` : ''}`));
        await updatePesagemTodo(id, { categoria: r.cat, checklist: r.checklistX, etapa: 'concluido', causa_raiz: d.causa, documento_sap: d.doc || '', eventos: evs } as any);
        await updatePesagemTodoStatus(id, 'concluido', d.desfecho);
        if (r.synth || (r.tags || []).includes('Investigação')) {
          await removeLoteInvestigacao(r.lote).catch(() => {});
          onInvestigacaoChange?.();
        }
        setResolving(null);
        const idx = filtered.findIndex((x) => x.key === r.key);
        const next = filtered.slice(idx + 1).find((x) => !x.isDone) || filtered.slice(0, idx).reverse().find((x) => !x.isDone);
        setSelKey(next ? next.key : null);
      },
      `Lote ${r.lote} concluído`,
      'Não foi possível concluir'
    );

  const remove = (r: Row) => {
    if (!window.confirm(`Excluir o caso do lote ${r.lote}? Histórico e notas serão perdidos.`)) return;
    run(
      async () => {
        if (r.synth) {
          await removeLoteInvestigacao(r.lote);
          onInvestigacaoChange?.();
        } else await deletePesagemTodo(r.id);
        setSelKey(null);
      },
      'Caso excluído',
      'Não foi possível excluir'
    );
  };

  /* ---------------- relatório ---------------- */
  const relatorio = (r: Row) => {
    const sys = r.localizado ? r.estoque_atual : 0;
    const un = r.unidade_medida;
    const lines: string[] = [
      `RELATÓRIO DE INVESTIGAÇÃO · LOTE ${r.lote}`,
      `Material: ${r.material} – ${clean(r.texto_breve_material)}`,
      `Categoria: ${CATS[r.cat].l} · Prioridade: ${prioMeta(r.prioridade).l}`,
      `Aberto em ${dt(r.created_at)} por ${r.created_by_name ? getPersonName(r.created_by_name) : '—'} · Responsável: ${r.responsavel ? getPersonName(r.responsavel) : '—'}`,
      `Situação: ${etapaMeta(r.etapaX).l} · Prazo: ${r.prazoX.toLocaleDateString('pt-BR')}`,
      '',
      '1. Ocorrência',
      r.motivo_inicial || '—',
      `Saldo no registro: ${qf(r.quantidade_inicial)} ${un} em ${r.posicao_deposito_inicial || '—'} / ${r.deposito_inicial || '—'} (${brl(r.valor_total_inicial)})`,
      `Saldo atual no SAP: ${r.localizado ? `${qf(sys)} ${un} em ${r.posicao_atual || '—'} / ${r.deposito_atual || '—'} (${brl(r.valor_atual)})` : 'sem saldo'}`,
    ];
    if (r.fisico_contado !== undefined)
      lines.push(`Contagem física (${dt(r.fisico_em)}): ${qf(r.fisico_contado)} ${un} · diferença SAP × físico: ${sgn(sys - r.fisico_contado)} ${un} (${brl((sys - r.fisico_contado) * r.vu)})`);
    lines.push('', '2. Investigação');
    r.checklistX.forEach((c) => lines.push(`[${c.done ? 'x' : ' '}] ${c.t}${c.done && c.by ? ` · ${getPersonName(c.by)} ${dt(c.at)}` : ''}`));
    const notas = [...(r.notas || [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    if (notas.length) {
      lines.push('', 'Registros:');
      notas.forEach((n) => lines.push(`- ${dt(n.created_at)} · ${n.created_by_name ? getPersonName(n.created_by_name) : '—'}: ${n.texto}`));
    }
    lines.push('', '3. Causa raiz', causaL(r.causa_raiz) || 'Em apuração');
    lines.push('', '4. Ação e desfecho', r.desfecho || 'Em andamento');
    if (r.documento_sap) lines.push(`Documento SAP: ${r.documento_sap}`);
    if (r.isDone) lines.push(`Concluído em ${dt(r.resolvido_em)} por ${r.resolvido_por_name ? getPersonName(r.resolvido_por_name) : '—'}`);
    copyToClipboard(lines.join('\n')).then((ok) => (ok ? toast.success('Relatório copiado') : toast.error('Não foi possível copiar')));
  };

  /* ---------------- teclado ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const typing = ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName);
      if (e.key === 'Escape') {
        if (typing) ae!.blur();
        else if (!resolving && !create.open && selKey) setSelKey(null);
        return;
      }
      if (typing || resolving || create.open || e.ctrlKey || e.metaKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'c') {
        e.preventDefault();
        setCreate({ open: true, prefill: {} });
      }
      if (sel && e.key === 'n') {
        e.preventDefault();
        noteRef.current?.focus();
      }
      if (sel && e.key === 'a' && sel.responsavel !== me) setResp(sel, me);
      if ((e.key === 'j' || e.key === 'k') && filtered.length) {
        e.preventDefault();
        const i = filtered.findIndex((r) => r.key === selKey);
        const n = filtered[Math.max(0, Math.min(filtered.length - 1, i < 0 ? 0 : i + (e.key === 'j' ? 1 : -1)))];
        setSelKey(n.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selKey, sel, resolving, create.open, me]);

  /* ============================================================================
   * UI
   * ========================================================================== */
  const btn =
    'h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40';
  const primary = 'h-8 px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40';
  const seg = (on: boolean) =>
    cn(
      'h-[30px] px-3 text-[12px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap border-r border-[var(--border-strong)] last:border-r-0',
      on ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
    );
  const selectCls = 'h-8 px-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[12.5px] text-[var(--text-2)] outline-none';

  const slaText = (r: Row) =>
    r.isDone ? '' : r.slaDias < 0 ? `atrasado ${-r.slaDias} d` : r.slaDias === 0 ? 'vence hoje' : r.slaDias === 1 ? 'vence amanhã' : `${r.slaDias} d`;
  const slaColor = (r: Row) => (r.isDone ? undefined : r.slaDias < 0 ? 'var(--red)' : r.slaDias <= 1 ? 'var(--amber)' : undefined);
  const stripe = (r: Row) => {
    const top = r.reasons.find((x) => x.tone === 'red') || r.reasons.find((x) => x.tone === 'amber');
    return top ? TONE[top.tone] : undefined;
  };

  const cardHistory = (r: Row): { dot: string; color: string; text: string; fullText?: string }[] => {
    const items: { dot: string; color: string; text: string; fullText?: string }[] = [];

    // 1. Mudanças de estoque (tempo real)
    let diffItem: { dot: string; color: string; text: string; fullText?: string } | null = null;
    if (r.diff === 'saiu') {
      diffItem = {
        dot: 'var(--red)',
        color: 'var(--red)',
        text: `Saiu do estoque · saldo zerado`,
        fullText: `Saiu do estoque · Lote zerado no SAP (era ${qf(r.quantidade_inicial)} ${r.unidade_medida})`,
      };
    } else if (r.diff === 'reduziu') {
      diffItem = {
        dot: 'var(--amber)',
        color: 'var(--amber)',
        text: `Saldo caiu ${sgn(r.diffQ)} ${r.unidade_medida} (${qf(r.quantidade_inicial)} → ${qf(r.estoque_atual)})`,
        fullText: `Saldo reduziu: de ${qf(r.quantidade_inicial)} para ${qf(r.estoque_atual)} ${r.unidade_medida} (${sgn(r.diffQ)})`,
      };
    } else if (r.diff === 'aumentou') {
      diffItem = {
        dot: 'var(--amber)',
        color: 'var(--amber)',
        text: `Saldo subiu ${sgn(r.diffQ)} ${r.unidade_medida} (${qf(r.quantidade_inicial)} → ${qf(r.estoque_atual)})`,
        fullText: `Saldo aumentou: de ${qf(r.quantidade_inicial)} para ${qf(r.estoque_atual)} ${r.unidade_medida} (${sgn(r.diffQ)})`,
      };
    } else if (r.diff === 'posicao') {
      const posNova = r.posicao_atual || r.deposito_atual || 'nova posição';
      const posAntiga = r.posicao_deposito_inicial || r.deposito_inicial || '—';
      diffItem = {
        dot: 'var(--amber)',
        color: 'var(--amber)',
        text: `Posição mudou para ${posNova}`,
        fullText: `Posição alterada de ${posAntiga} para ${posNova}`,
      };
    }

    if (diffItem) items.push(diffItem);

    // 2. Concluído
    if (r.isDone) {
      const desfecho = r.desfecho || (r.causa_raiz ? causaL(r.causa_raiz) : '') || 'Concluído';
      const quando = r.resolvido_em ? ` · ${ago(daysSince(r.resolvido_em))}` : '';
      items.push({
        dot: 'var(--green)',
        color: 'var(--text-3)',
        text: `Concluído: ${desfecho}${quando}`,
        fullText: `Caso concluído: ${desfecho}${quando}`,
      });
    }

    // 3. Notas recentes ou eventos manuais
    const notes = (r.notas || []).map((n) => ({
      at: n.created_at,
      text: `Nota: ${n.texto}`,
      by: n.created_by_name || n.created_by,
    }));
    const events = (r.eventos || [])
      .filter((e) => e.tipo !== 'sistema' || (!e.texto.startsWith('Categoria') && !e.texto.startsWith('Caso aberto')))
      .map((e) => ({
        at: e.at,
        text: e.texto,
        by: e.by,
      }));
    const combined = [...notes, ...events].sort((a, b) => (a.at < b.at ? 1 : -1));
    if (combined.length > 0) {
      const latest = combined[0];
      const author = latest.by ? ` · ${getPersonName(latest.by)}` : '';
      const tempo = latest.at ? ` (${ago(daysSince(latest.at))})` : '';
      items.push({
        dot: 'var(--accent)',
        color: 'var(--text-2)',
        text: `${latest.text}${author}${tempo}`,
        fullText: `${latest.text}${author}${tempo}`,
      });
    }

    // 4. Físico contado (quando não houve diff e não está concluído)
    if (!diffItem && !r.isDone && r.fisico_contado !== undefined && r.fisico_contado !== null) {
      const dif = r.estoque_atual - r.fisico_contado;
      const diffStr = Math.abs(dif) > 0.001 ? ` · dif ${sgn(dif)}` : ' · bateu com físico';
      items.push({
        dot: 'var(--accent)',
        color: 'var(--text-2)',
        text: `Físico contado: ${qf(r.fisico_contado)} ${r.unidade_medida}${diffStr}`,
        fullText: `Contagem física: ${qf(r.fisico_contado)} ${r.unidade_medida}${diffStr}`,
      });
    }

    // 5. Se não tiver nada ainda, exibir atenção ou estável
    if (items.length === 0) {
      const otherReason = r.reasons.find((x) => x.k !== 'sla' && x.k !== 'resp');
      if (otherReason) {
        items.push({
          dot: TONE[otherReason.tone],
          color: TONE[otherReason.tone],
          text: otherReason.text,
          fullText: otherReason.text,
        });
      } else {
        const pos = r.posicao_atual || r.posicao_deposito_inicial || r.deposito_atual || r.deposito_inicial || 'PES';
        items.push({
          dot: 'var(--text-3)',
          color: 'var(--text-3)',
          text: `Saldo estável: ${qf(r.estoque_atual)} ${r.unidade_medida} em ${pos}`,
          fullText: `Estoque estável: ${qf(r.estoque_atual)} ${r.unidade_medida} no local ${pos}`,
        });
      }
    }

    return items;
  };

  /* ---------- item do quadro ---------- */
  const boardItem = (r: Row) => {
    const on = selKey === r.key;
    const s = stripe(r);
    const hists = cardHistory(r);
    return (
      <button
        key={r.key}
        type="button"
        draggable={!busy}
        onDragStart={(e) => {
          setDragKey(r.key);
          e.dataTransfer.effectAllowed = 'move';
          try {
            e.dataTransfer.setData('text/plain', r.key);
          } catch {
            /* ignora */
          }
        }}
        onDragEnd={() => {
          setDragKey(null);
          setOverCol(null);
        }}
        onClick={() => setSelKey(on ? null : r.key)}
        className={cn(
          'relative w-full text-left px-3 py-2.5 border-b border-[var(--border)] cursor-pointer',
          on ? 'bg-[var(--accent-weak)]' : 'hover:bg-[var(--surface-2)]',
          dragKey === r.key && 'opacity-40',
          r.isDone && !on && 'opacity-65'
        )}
      >
        {s && <span className="absolute left-0 top-3 w-[3px] h-4 rounded-r-sm" style={{ background: s }} />}
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-semibold truncate">{r.lote}</span>
          {(r.prioridade === 'critica' || r.prioridade === 'alta') && !r.isDone && (
            <span className="text-[10.5px] font-medium border border-[var(--border-strong)] rounded px-1 leading-4" style={{ color: prioMeta(r.prioridade).c }}>
              {prioMeta(r.prioridade).l}
            </span>
          )}
          <span className="ml-auto">
            <Avatar email={r.responsavel} name={getPersonName(r.responsavel)} size={20} />
          </span>
        </span>
        <span className="block text-[12px] text-[var(--text-2)] truncate mt-0.5">{clean(r.texto_breve_material) || r.material}</span>
        <span className="flex items-center gap-2 mt-1.5 text-[11.5px] text-[var(--text-3)]">
          <span className="truncate">{CATS[r.cat].l}</span>
          <span className="font-mono">{brlK(r.valorRef)}</span>
          <span className="ml-auto flex items-center gap-2 shrink-0">
            {r.reqTot > 0 && !r.isDone && (
              <span className="font-mono" title="Checklist obrigatório">
                {r.reqDone}/{r.reqTot}
              </span>
            )}
            {r.isDone ? <span>{ago(daysSince(r.resolvido_em || r.updated_at))}</span> : <span className="font-mono" style={{ color: slaColor(r) }}>{slaText(r)}</span>}
          </span>
        </span>
        <div className="mt-2 pt-1.5 border-t border-[var(--border)] flex flex-col gap-1 min-w-0">
          {hists.map((h, idx) => (
            <span
              key={idx}
              className="flex items-center gap-1.5 text-[11.5px] min-w-0"
              style={{ color: h.color }}
              title={h.fullText || h.text}
            >
              <Dot c={h.dot} />
              <span className="truncate">{h.text}</span>
            </span>
          ))}
        </div>
      </button>
    );
  };

  /* ---------- quadro ---------- */
  const renderBoard = () => (
    <div className="flex gap-0 overflow-x-auto snap-x snap-mandatory border-t border-[var(--border-strong)] -mx-3 px-3 sm:mx-0 sm:px-0">
      {ETAPAS.map((e, ci) => {
        const items = filtered.filter((r) => r.etapaX === e.k && (e.k !== 'concluido' || daysSince(r.resolvido_em || r.updated_at) <= DIAS_CONCLUIDOS_QUADRO));
        const total = open.filter((r) => r.etapaX === e.k).length;
        const over = e.wip && total > e.wip;
        const valor = items.reduce((a, r) => a + r.valorRef, 0);
        return (
          <section
            key={e.k}
            onDragOver={(ev2) => {
              if (!dragKey) return;
              ev2.preventDefault();
              setOverCol(e.k);
            }}
            onDragLeave={() => setOverCol((c) => (c === e.k ? null : c))}
            onDrop={(ev2) => {
              ev2.preventDefault();
              const r = rows.find((x) => x.key === dragKey);
              setDragKey(null);
              setOverCol(null);
              if (r) moveTo(r, e.k);
            }}
            className={cn(
              'snap-start shrink-0 w-[85vw] sm:w-[280px] lg:w-auto lg:flex-1 lg:min-w-[220px] min-w-0',
              ci > 0 && 'border-l border-[var(--border)]',
              overCol === e.k && 'bg-[var(--accent-weak)]'
            )}
          >
            <header className="sticky top-0 z-[1] bg-[var(--bg)] px-3 pt-2.5 pb-2 border-b border-[var(--border)]">
              <div className="flex items-baseline gap-2">
                <b className="text-[13px] font-semibold">{e.l}</b>
                <span className={cn('font-mono text-[11.5px]', over ? 'text-[var(--red)]' : 'text-[var(--text-3)]')} title={e.wip ? `Limite de ${e.wip} casos (WIP)` : undefined}>
                  {e.k === 'concluido' ? items.length : e.wip ? `${total}/${e.wip}` : total}
                </span>
                <span className="ml-auto font-mono text-[11px] text-[var(--text-3)]">{items.length ? brlK(valor) : ''}</span>
              </div>
              <p className="text-[11px] text-[var(--text-3)] truncate">{e.d}</p>
            </header>
            <div className="lg:max-h-[calc(100vh-330px)] lg:overflow-y-auto">
              {items.length ? items.map(boardItem) : <p className="px-3 py-6 text-[12px] text-[var(--text-3)] text-center">{dragKey ? 'Solte aqui' : 'Nenhum caso'}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );

  /* ---------- lista ---------- */
  const renderList = () =>
    filtered.length === 0 ? (
      <p className="py-14 text-center text-[13px] text-[var(--text-3)] border-t border-[var(--border-strong)]">Nenhum caso com esses filtros.</p>
    ) : (
      <div className="border-t border-[var(--border-strong)] overflow-x-auto">
        <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1.3fr)_110px_90px_96px_28px] gap-3 h-8 items-center px-3 text-[11.5px] text-[var(--text-3)] border-b border-[var(--border)] min-w-[820px]">
          <span>Lote · material</span>
          <span>Etapa</span>
          <span>O que pede atenção</span>
          <span className="text-right">Saldo agora</span>
          <span className="text-right">Valor</span>
          <span className="text-right">Prazo</span>
          <span />
        </div>
        {filtered.map((r) => {
          const on = selKey === r.key;
          const s = stripe(r);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setSelKey(on ? null : r.key)}
              className={cn(
                'relative w-full text-left grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1.3fr)_110px_90px_96px_28px] gap-x-3 gap-y-1 items-center px-3 py-2.5 border-b border-[var(--border)] md:min-w-[820px]',
                on ? 'bg-[var(--accent-weak)]' : 'hover:bg-[var(--surface-2)]',
                r.isDone && !on && 'opacity-65'
              )}
            >
              {s && <span className="absolute left-0 top-3 w-[3px] h-4 rounded-r-sm" style={{ background: s }} />}
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold">{r.lote}</span>
                  <span className="text-[11.5px] text-[var(--text-3)] truncate">{CATS[r.cat].l}</span>
                </span>
                <span className="block text-[12px] text-[var(--text-3)] truncate">
                  <span className="font-mono text-[var(--text-2)]">{r.material}</span> · {clean(r.texto_breve_material)}
                </span>
              </span>
              <span className="hidden md:flex items-center gap-2 text-[12px] text-[var(--text-2)]">
                <Avatar email={r.responsavel} name={getPersonName(r.responsavel)} size={18} />
                {etapaMeta(r.etapaX).l}
              </span>
              <span className="min-w-0 max-md:col-span-2 max-md:order-last text-[12.5px]">
                {r.isDone ? (
                  <span className="text-[var(--text-3)] truncate block">{causaL(r.causa_raiz) || r.desfecho || 'Concluído'}</span>
                ) : (
                  <span className="flex flex-col gap-0.5 text-[11.5px]">
                    {cardHistory(r).slice(0, 2).map((h, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 truncate" style={{ color: h.color }} title={h.fullText || h.text}>
                        <Dot c={h.dot} /> <span className="truncate">{h.text}</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="hidden md:block text-right font-mono text-[12.5px] whitespace-nowrap" style={{ color: !r.localizado ? 'var(--red)' : r.diff === 'reduziu' || r.diff === 'aumentou' ? 'var(--amber)' : undefined }}>
                {r.localizado ? qf(r.estoque_atual) : '0'} <span className="text-[11px] text-[var(--text-3)]">{r.unidade_medida}</span>
              </span>
              <span className="text-right font-mono text-[12.5px]">{brlK(r.valorRef)}</span>
              <span className="hidden md:block text-right font-mono text-[12px]" style={{ color: slaColor(r) }}>
                {r.isDone ? ago(daysSince(r.resolvido_em || r.updated_at)) : slaText(r)}
              </span>
              <ChevronRight className="hidden md:block h-3.5 w-3.5 text-[var(--text-3)]" />
            </button>
          );
        })}
        <p className="px-3 pt-2 text-[11.5px] text-[var(--text-3)]">
          {filtered.length} caso(s) · {brl(filtered.reduce((a, r) => a + r.valorRef, 0))} · <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> navega
        </p>
      </div>
    );

  /* ---------- métricas ---------- */
  const metrics = useMemo(() => {
    const weekStart = (d: Date) => {
      const x = day0(d);
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x.getTime();
    };
    const now = weekStart(new Date());
    const weeks = Array.from({ length: 8 }, (_, i) => now - (7 - i) * 7 * 86400000);
    const inW = weeks.map((w) => rows.filter((r) => weekStart(new Date(r.created_at)) === w).length);
    const outW = weeks.map((w) => rows.filter((r) => r.isDone && weekStart(new Date(r.resolvido_em || r.updated_at)) === w).length);
    const done90 = rows.filter((r) => r.isDone && daysSince(r.resolvido_em || r.updated_at) <= 90);
    const causas = new Map<string, { n: number; v: number }>();
    done90.forEach((r) => {
      const k = r.causa_raiz || 'nao_informada';
      const c = causas.get(k) || { n: 0, v: 0 };
      c.n++;
      c.v += Math.abs(r.valor_total_inicial || 0);
      causas.set(k, c);
    });
    const pareto = Array.from(causas.entries()).sort((a, b) => b[1].n - a[1].n);
    const catOpen = CAT_KEYS.map((c) => ({ c, n: open.filter((r) => r.cat === c).length, v: open.filter((r) => r.cat === c).reduce((a, r) => a + r.valorRef, 0) })).filter((x) => x.n);
    const wip = ETAPAS.slice(0, 4).map((e) => {
      const its = open.filter((r) => r.etapaX === e.k);
      return { e, n: its.length, idade: its.length ? Math.round(its.reduce((a, r) => a + r.diasAberto, 0) / its.length) : 0 };
    });
    return { weeks, inW, outW, pareto, done90: done90.length, catOpen, wip };
  }, [rows, open]);

  const renderMetrics = () => {
    const mx = Math.max(1, ...metrics.inW, ...metrics.outW);
    const pTot = metrics.pareto.reduce((a, [, x]) => a + x.n, 0);
    let acc = 0;
    const cMax = Math.max(1, ...metrics.catOpen.map((x) => x.v));
    return (
      <div className="border-t border-[var(--border-strong)]">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-y-3 py-4 border-b border-[var(--border)]">
          {[
            { l: 'Lead time médio · 30 d', v: stats.avg !== null ? `${stats.avg.toFixed(1)} d` : '—', s: stats.p85 !== null ? `85% fecham em até ${stats.p85.toFixed(0)} d` : 'sem casos concluídos' },
            { l: 'Concluídos no prazo', v: stats.noPrazoPct !== null ? `${stats.noPrazoPct}%` : '—', s: `${stats.d30} concluído(s) em 30 d` },
            { l: 'Entrada × saída · 7 d', v: `${stats.in7} / ${stats.done7}`, s: stats.in7 > stats.done7 ? 'fila crescendo' : 'fila estável ou caindo', c: stats.in7 > stats.done7 ? 'var(--amber)' : undefined },
            { l: 'Valor em aberto', v: brlK(stats.openValor), s: `${stats.open} caso(s)` },
          ].map((k, i) => (
            <div key={k.l} className={cn('px-4 min-w-0', i === 0 ? 'pl-0' : 'border-l border-[var(--border)]', i === 2 && 'max-lg:border-l-0 max-lg:pl-0')}>
              <span className="block text-[12px] text-[var(--text-3)]">{k.l}</span>
              <span className="block font-mono text-[22px] font-semibold tracking-tight leading-tight mt-0.5" style={{ color: k.c }}>
                {k.v}
              </span>
              <span className="block text-[11.5px] text-[var(--text-3)] truncate">{k.s}</span>
            </div>
          ))}
        </section>

        <div className="grid lg:grid-cols-2 gap-x-8">
          <section className="py-4 border-b border-[var(--border)]">
            <div className="flex items-baseline justify-between mb-3">
              <b className="text-[12px] font-semibold text-[var(--text-2)]">Vazão por semana</b>
              <span className="flex gap-3 text-[11.5px] text-[var(--text-3)]">
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[var(--text-3)]" />abertos</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[var(--text)]" />concluídos</span>
              </span>
            </div>
            <div className="flex items-end gap-2 h-[120px] border-b border-[var(--border)]">
              {metrics.weeks.map((w, i) => (
                <div key={w} className="flex-1 h-full flex items-end justify-center gap-[3px]" title={`Semana de ${dShort(new Date(w))}: ${metrics.inW[i]} abertos, ${metrics.outW[i]} concluídos`}>
                  <span className="w-[38%] rounded-t-sm bg-[var(--text-3)]" style={{ height: `${(metrics.inW[i] / mx) * 100}%`, minHeight: metrics.inW[i] ? 2 : 0 }} />
                  <span className="w-[38%] rounded-t-sm bg-[var(--text)]" style={{ height: `${(metrics.outW[i] / mx) * 100}%`, minHeight: metrics.outW[i] ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {metrics.weeks.map((w) => (
                <span key={w} className="flex-1 text-center font-mono text-[10.5px] text-[var(--text-3)]">{dShort(new Date(w))}</span>
              ))}
            </div>
          </section>

          <section className="py-4 border-b border-[var(--border)]">
            <div className="flex items-baseline justify-between mb-2">
              <b className="text-[12px] font-semibold text-[var(--text-2)]">Causas raiz · 90 d</b>
              <span className="text-[11.5px] text-[var(--text-3)]">{metrics.done90} concluído(s)</span>
            </div>
            {metrics.pareto.length === 0 ? (
              <p className="py-6 text-[12px] text-[var(--text-3)]">Sem casos concluídos no período.</p>
            ) : (
              metrics.pareto.map(([k, x]) => {
                acc += x.n;
                return (
                  <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(60px,1.2fr)_36px_44px] gap-3 items-center py-1.5 text-[12.5px]">
                    <span className="truncate">{causaL(k) || 'Não informada'}</span>
                    <span className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                      <span className="block h-full bg-[var(--text-2)]" style={{ width: `${(x.n / pTot) * 100}%` }} />
                    </span>
                    <span className="font-mono text-right">{x.n}</span>
                    <span className="font-mono text-right text-[11.5px] text-[var(--text-3)]" title="Acumulado">
                      {Math.round((acc / pTot) * 100)}%
                    </span>
                  </div>
                );
              })
            )}
          </section>

          <section className="py-4 border-b border-[var(--border)]">
            <b className="block text-[12px] font-semibold text-[var(--text-2)] mb-2">Em aberto por categoria</b>
            {metrics.catOpen.length === 0 ? (
              <p className="py-6 text-[12px] text-[var(--text-3)]">Nenhum caso aberto.</p>
            ) : (
              metrics.catOpen
                .sort((a, b) => b.v - a.v)
                .map((x) => (
                  <button key={x.c} type="button" onClick={() => { setCatF(x.c); changeView('lista'); }} className="w-full grid grid-cols-[minmax(0,1fr)_minmax(60px,1.2fr)_32px_84px] gap-3 items-center py-1.5 text-[12.5px] text-left group">
                    <span className="truncate group-hover:text-[var(--accent)]">{CATS[x.c].l}</span>
                    <span className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                      <span className="block h-full bg-[var(--text-2)]" style={{ width: `${(x.v / cMax) * 100}%` }} />
                    </span>
                    <span className="font-mono text-right">{x.n}</span>
                    <span className="font-mono text-right">{brlK(x.v)}</span>
                  </button>
                ))
            )}
          </section>

          <section className="py-4 border-b border-[var(--border)]">
            <b className="block text-[12px] font-semibold text-[var(--text-2)] mb-2">Trabalho em andamento</b>
            {metrics.wip.map(({ e, n, idade }) => (
              <div key={e.k} className="grid grid-cols-[minmax(0,1fr)_70px_90px] gap-3 items-center py-1.5 text-[12.5px] border-b border-[var(--border)] last:border-b-0">
                <span>{e.l}</span>
                <span className={cn('font-mono text-right', e.wip && n > e.wip ? 'text-[var(--red)]' : '')}>
                  {n}
                  {e.wip ? <span className="text-[var(--text-3)]">/{e.wip}</span> : null}
                </span>
                <span className="font-mono text-right text-[var(--text-3)]">{n ? `idade ${idade} d` : '—'}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  };

  /* ---------- detalhe ---------- */
  const renderDetail = (r: Row) => {
    const sys = r.localizado ? r.estoque_atual : 0;
    const temFisico = r.fisico_contado !== undefined && r.fisico_contado !== null;
    const difFis = temFisico ? sys - (r.fisico_contado as number) : 0;
    const idx = ETAPAS.findIndex((e) => e.k === r.etapaX);
    const next = ETAPAS[idx + 1];
    const timeline: { at: string; by?: string; texto: string; kind: 'open' | 'note' | 'ev' | 'done'; noteId?: string; evId?: string; tipo?: string }[] = [
      { at: r.created_at, by: r.created_by_name, texto: `Caso aberto${r.motivo_inicial ? ` · ${r.motivo_inicial}` : ''}`, kind: 'open' as const },
      ...(r.eventos || []).map((e) => ({ at: e.at, by: e.by, texto: e.texto, kind: 'ev' as const, evId: e.id, tipo: e.tipo })),
      ...(r.notas || []).map((n) => ({ at: n.created_at, by: n.created_by_name, texto: n.texto, kind: 'note' as const, noteId: n.id })),
    ].sort((a, b) => (a.at < b.at ? -1 : 1));
    if (r.isDone && !(r.eventos || []).some((e) => e.texto.startsWith('Concluído')))
      timeline.push({ at: r.resolvido_em || r.updated_at, by: r.resolvido_por_name, texto: `Concluído${r.desfecho ? ` · ${r.desfecho}` : ''}`, kind: 'done' });

    const label = 'text-[12px] text-[var(--text-3)]';
    return (
      <>
        <div className="xl:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSelKey(null)} />
        <aside className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[480px] bg-[var(--surface)] border-l border-[var(--border-strong)] shadow-[-16px_0_40px_rgba(0,0,0,.35)] flex flex-col">
          {/* cabeçalho */}
          <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button type="button" onClick={() => copyToClipboard(r.lote).then(() => toast.success('Lote copiado'))} className="group text-left" title="Copiar lote">
                  <span className="font-mono text-[22px] font-semibold tracking-tight">{r.lote}</span>
                  <Copy className="inline h-3.5 w-3.5 ml-2 text-[var(--text-3)] opacity-60 group-hover:opacity-100" />
                </button>
                <p className="text-[12.5px] text-[var(--text-2)] truncate">
                  <span className="font-mono text-[var(--text)]">{r.material}</span> · {clean(r.texto_breve_material) || 'sem descrição'}
                </p>
              </div>
              <button type="button" onClick={() => setSelKey(null)} className="h-8 w-8 grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)]" title="Fechar (Esc)">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* etapas */}
            <div className="flex mt-3 border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden">
              {ETAPAS.map((e, i) => (
                <button
                  key={e.k}
                  type="button"
                  disabled={busy}
                  onClick={() => moveTo(r, e.k)}
                  title={e.d}
                  className={cn(
                    'flex-1 h-8 text-[11.5px] font-medium border-r border-[var(--border-strong)] last:border-r-0 truncate px-1',
                    i < idx && 'text-[var(--text-2)] bg-[var(--surface-2)]',
                    i === idx && 'bg-[var(--text)] text-[var(--bg)]',
                    i > idx && 'text-[var(--text-3)] hover:text-[var(--text)]'
                  )}
                >
                  {e.l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {/* atenção */}
            {r.reasons.length > 0 && (
              <ul className="pt-2">
                {r.reasons.map((x) => (
                  <li key={x.k} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                    <Dot c={TONE[x.tone]} />
                    <span className="flex-1">{x.text}</span>
                    {x.k === 'resp' && (!r.responsavel || r.responsavel.toLowerCase() !== me.toLowerCase()) && (
                      <button type="button" onClick={() => setResp(r, me)} className="text-[12px] font-medium text-[var(--accent)] hover:underline">
                        Assumir
                      </button>
                    )}
                    {(x.k === 'saiu' || x.k === 'pronto') && (
                      <button type="button" onClick={() => setResolving(r)} className="text-[12px] font-medium text-[var(--accent)]">
                        Concluir
                      </button>
                    )}
                    {(x.k === 'nota' || x.k === 'parado') && (
                      <button type="button" onClick={() => noteRef.current?.focus()} className="text-[12px] font-medium text-[var(--accent)]">
                        Registrar
                      </button>
                    )}
                    {x.k === 'triagem' && (
                      <button type="button" onClick={() => moveTo(r, 'investigacao')} className="text-[12px] font-medium text-[var(--accent)]">
                        Iniciar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* atributos */}
            <div className="mt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)]">
                <span className={label}>Categoria</span>
                <select value={r.cat} disabled={busy} onChange={(e) => setCategoria(r, e.target.value as Cat)} className={cn(selectCls, 'max-w-[220px]')}>
                  {CAT_KEYS.map((c) => (
                    <option key={c} value={c}>
                      {CATS[c].l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)]">
                <span className={label}>Prioridade</span>
                <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden">
                  {PRIO.map((p) => (
                    <button key={p.k} type="button" disabled={busy} onClick={() => setPrioridade(r, p.k)} className={cn(seg(r.prioridade === p.k), 'h-[26px] px-2.5')}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)]">
                <span className={label}>Responsável</span>
                <span className="flex items-center gap-2">
                  {(!r.responsavel || r.responsavel.toLowerCase() !== me.toLowerCase()) && (
                    <button type="button" onClick={() => setResp(r, me)} className="text-[12px] font-medium text-[var(--accent)] hover:underline">
                      Assumir
                    </button>
                  )}
                  <select value={r.responsavel || ''} disabled={busy} onChange={(e) => setResp(r, e.target.value)} className={cn(selectCls, 'max-w-[220px]')}>
                    <option value="">Ninguém (Não atribuído)</option>
                    {peopleOptions.map((p) => {
                      const isMe = p.email.toLowerCase() === me.toLowerCase();
                      return (
                        <option key={p.email} value={p.email}>
                          {p.name}
                          {isMe ? ' (você)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)]">
                <span className={label}>
                  Prazo <span className="text-[11px]">· SLA {SLA_DIAS[r.prioridade]} d</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-mono" style={{ color: slaColor(r) }}>
                    {slaText(r)}
                  </span>
                  <input
                    type="date"
                    value={isoDay(r.prazoX)}
                    disabled={busy || r.isDone}
                    onChange={(e) => e.target.value && setPrazo(r, e.target.value)}
                    className="h-8 px-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[12.5px] font-mono text-[var(--text-2)] outline-none"
                  />
                </span>
              </div>
            </div>

            {/* saldo */}
            <b className="block mt-5 mb-1 text-[12px] font-semibold text-[var(--text-2)]">Saldo</b>
            <table className="w-full text-[12.5px] border-separate border-spacing-0">
              <thead>
                <tr className="text-[11.5px] text-[var(--text-3)]">
                  <th className="h-7 text-left font-medium border-b border-[var(--border)]" />
                  <th className="h-7 text-right font-medium border-b border-[var(--border)]">No registro</th>
                  <th className="h-7 text-right font-medium border-b border-[var(--border)]">SAP agora</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(
                  [
                    ['Quantidade', `${qf(r.quantidade_inicial)} ${r.unidade_medida}`, r.localizado ? `${qf(sys)} ${r.unidade_medida}` : 'sem saldo', r.diff === 'saiu' || r.diff === 'reduziu' || r.diff === 'aumentou'],
                    ['Valor', brl(r.valor_total_inicial), brl(r.valor_atual), Math.abs(r.diffV) > 0.01],
                    ['Posição', `${r.posicao_deposito_inicial || '—'} · ${r.deposito_inicial || '—'}`, r.localizado ? `${r.posicao_atual || '—'} · ${r.deposito_atual || '—'}` : '—', r.diff === 'posicao'],
                    ['Aging', `${r.dias_aging_inicial ?? 0} d`, r.dias_aging_atual !== undefined ? `${r.dias_aging_atual} d` : '—', false],
                  ] as [string, string, string, boolean][]
                ).map(([l, a, b, ch]) => (
                  <tr key={l}>
                    <td className="h-8 border-b border-[var(--border)] font-sans text-[var(--text-3)]">{l}</td>
                    <td className="h-8 border-b border-[var(--border)] text-right text-[var(--text-3)]">{a}</td>
                    <td className="h-8 border-b border-[var(--border)] text-right" style={{ color: ch ? (r.localizado ? 'var(--amber)' : 'var(--red)') : undefined }}>
                      {b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {temFisico && (
              <p className="mt-2 text-[12.5px]">
                Contagem física <span className="font-mono">{qf(r.fisico_contado as number)} {r.unidade_medida}</span>
                <span className="text-[var(--text-3)]"> · {dt(r.fisico_em)}</span>
                <span className="block font-mono" style={{ color: Math.abs(difFis) > 0.0005 ? 'var(--red)' : 'var(--green)' }}>
                  {Math.abs(difFis) > 0.0005
                    ? `SAP ${difFis > 0 ? 'tem' : 'falta'} ${qf(Math.abs(difFis))} ${r.unidade_medida} ${difFis > 0 ? 'a mais' : ''} · ${brl(Math.abs(difFis) * r.vu)}`
                    : 'SAP e físico batem'}
                </span>
              </p>
            )}
            {!r.isDone && (
              <form
                className="flex gap-2 mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  registrarFisico(r);
                }}
              >
                <div className="flex items-center flex-1 h-9 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] focus-within:border-[var(--accent)]">
                  <input
                    value={fisico}
                    onChange={(e) => setFisico(e.target.value)}
                    inputMode="decimal"
                    placeholder="Quantidade contada na área"
                    className="flex-1 min-w-0 bg-transparent outline-none px-2.5 font-mono text-[13px] placeholder:font-sans placeholder:text-[var(--text-3)]"
                  />
                  <span className="pr-2.5 text-[12px] text-[var(--text-3)]">{r.unidade_medida}</span>
                </div>
                <button type="submit" disabled={busy || !fisico.trim()} className={cn(btn, 'h-9')}>
                  Registrar contagem
                </button>
              </form>
            )}

            {/* checklist */}
            <div className="flex items-baseline justify-between mt-5 mb-1">
              <b className="text-[12px] font-semibold text-[var(--text-2)]">Checklist · {CATS[r.cat].l}</b>
              <span className="font-mono text-[11.5px] text-[var(--text-3)]">
                {r.allDone}/{r.checklistX.length}
              </span>
            </div>
            <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden mb-1">
              <div className="h-full bg-[var(--text-2)]" style={{ width: `${r.checklistX.length ? (r.allDone / r.checklistX.length) * 100 : 0}%` }} />
            </div>
            {r.checklistX.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy || r.isDone}
                onClick={() => toggleCheck(r, c.id)}
                className="w-full grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 items-start py-2 border-b border-[var(--border)] text-left disabled:cursor-default"
              >
                <span
                  className={cn('mt-[2px] h-4 w-4 rounded-[4px] border grid place-items-center', c.done ? 'bg-[var(--text)] border-[var(--text)] text-[var(--bg)]' : 'border-[var(--border-strong)]')}
                >
                  {c.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[12.5px]', c.done && 'text-[var(--text-3)] line-through decoration-[var(--text-3)]')}>
                    {c.t}
                    {c.req && !c.done && <span className="ml-1.5 text-[10.5px] text-[var(--amber)]">obrigatório</span>}
                  </span>
                  {c.done && c.by && (
                    <span className="block text-[11px] text-[var(--text-3)]">
                      {getPersonName(c.by)} · {dt(c.at)}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {!r.isDone && (
              <form
                className="flex gap-2 mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addStep(r);
                }}
              >
                <input
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  placeholder="Adicionar passo"
                  className="flex-1 min-w-0 h-8 px-2.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[12.5px] outline-none focus:border-[var(--accent)]"
                />
                <button type="submit" disabled={busy || !newStep.trim()} className={btn}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </form>
            )}

            {/* causa raiz */}
            <div className="mt-5 py-2.5 border-y border-[var(--border)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-[var(--text-2)]">Causa raiz</span>
                {r.isDone ? (
                  <span className="text-[12.5px] font-medium text-[var(--text-2)] truncate max-w-[240px]">
                    {causaL(r.causa_raiz) || 'Em apuração'}
                  </span>
                ) : (
                  <select
                    value={
                      customCausaOpen || (!!r.causa_raiz && !CAUSAS.some((c) => c.k === r.causa_raiz))
                        ? '__custom__'
                        : r.causa_raiz || ''
                    }
                    disabled={busy}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') {
                        setCustomCausaOpen(true);
                        setCustomCausaInput(
                          r.causa_raiz && !CAUSAS.some((c) => c.k === r.causa_raiz) ? r.causa_raiz : ''
                        );
                      } else {
                        setCustomCausaOpen(false);
                        setCausa(r, v);
                      }
                    }}
                    className={cn(selectCls, 'max-w-[240px]')}
                  >
                    <option value="">Em apuração</option>
                    {CAUSAS.map((c) => (
                      <option key={c.k} value={c.k}>
                        {c.l}
                      </option>
                    ))}
                    <option value="__custom__">Personalizada (outra)…</option>
                  </select>
                )}
              </div>

              {!r.isDone && (customCausaOpen || (!!r.causa_raiz && !CAUSAS.some((c) => c.k === r.causa_raiz))) && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
                  <input
                    value={customCausaInput}
                    onChange={(e) => setCustomCausaInput(e.target.value)}
                    placeholder="Descreva a causa raiz personalizada…"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customCausaInput.trim()) setCausa(r, customCausaInput.trim());
                      }
                    }}
                    className="flex-1 min-w-0 h-8 px-2.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[12.5px] outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    disabled={busy || !customCausaInput.trim() || customCausaInput.trim() === r.causa_raiz}
                    onClick={() => setCausa(r, customCausaInput.trim())}
                    className={cn(btn, 'h-8 px-3 text-[12px]')}
                  >
                    Salvar
                  </button>
                </div>
              )}
            </div>
            {r.isDone && (
              <p className="mt-2 text-[12.5px] text-[var(--text-2)]">
                <span className="text-[var(--text-3)]">Desfecho · </span>
                {r.desfecho || '—'}
                {r.documento_sap && <span className="block font-mono text-[12px] text-[var(--text-3)]">Doc. SAP {r.documento_sap}</span>}
              </p>
            )}

            {/* histórico */}
            <b className="block mt-5 mb-2 text-[12px] font-semibold text-[var(--text-2)]">Histórico</b>
            <ol className="relative pl-5 before:absolute before:left-[3px] before:top-1 before:bottom-1 before:w-px before:bg-[var(--border-strong)]">
              {timeline.map((t, i) => (
                <li key={i} className="relative pb-3 group">
                  <span
                    className={cn(
                      'absolute -left-5 top-[5px] w-[7px] h-[7px] rounded-full',
                      t.kind === 'note' ? 'bg-[var(--text-2)]' : t.kind === 'done' ? 'bg-[var(--green)]' : 'bg-[var(--surface)] border border-[var(--text-3)]'
                    )}
                  />
                  <span className={cn('block text-[12.5px] leading-relaxed whitespace-pre-wrap', t.kind === 'ev' && 'text-[var(--text-2)]')}>{t.texto}</span>
                  <span className="flex items-center gap-2 text-[11px] text-[var(--text-3)]">
                    <span className="font-mono">{dt(t.at)}</span>
                    {t.by && <span>· {getPersonName(t.by)}</span>}
                    {t.kind === 'note' && t.noteId && !r.isDone && (
                      <button
                        type="button"
                        onClick={() => run(() => deletePesagemTodoNote(r.id, r.notas, t.noteId as string), 'Nota removida', 'Não foi possível remover')}
                        className="opacity-0 group-hover:opacity-100 hover:text-[var(--red)] transition-opacity"
                        title="Remover nota"
                      >
                        apagar
                      </button>
                    )}
                    {t.kind === 'ev' && t.evId && !r.isDone && (
                      <button
                        type="button"
                        onClick={() => deleteEvento(r, t.evId as string)}
                        className="opacity-0 group-hover:opacity-100 hover:text-[var(--red)] transition-opacity"
                        title="Apagar este registro do histórico"
                      >
                        apagar
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {!r.isDone && (
              <div>
                <textarea
                  ref={noteRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      saveNote(r);
                    }
                  }}
                  rows={3}
                  placeholder="O que foi verificado, com quem falou, próximo passo…"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] resize-y"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-[var(--text-3)]">Ctrl+Enter salva</span>
                  <button type="button" onClick={() => saveNote(r)} disabled={!note.trim() || busy} className={btn}>
                    Registrar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ações */}
          <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-t border-[var(--border)] pb-[max(12px,env(safe-area-inset-bottom))]">
            {r.isDone ? (
              <button type="button" disabled={busy} onClick={() => moveTo(r, 'investigacao')} className={btn}>
                <RotateCcw className="h-3.5 w-3.5" /> Reabrir
              </button>
            ) : next ? (
              <button type="button" disabled={busy} onClick={() => moveTo(r, next.k)} className={primary}>
                {next.k === 'concluido' ? 'Concluir' : `Avançar para ${next.l}`}
              </button>
            ) : null}
            {!r.isDone && next?.k !== 'concluido' && (
              <button type="button" disabled={busy} onClick={() => setResolving(r)} className={btn}>
                Concluir
              </button>
            )}
            <button type="button" onClick={() => relatorio(r)} className={btn} title="Copia o relatório de investigação formatado">
              <Copy className="h-3.5 w-3.5" /> Relatório
            </button>
            {onNavigateToMaterial && (
              <button type="button" onClick={() => onNavigateToMaterial(r.material)} className={btn} title="Ver material no estoque">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => remove(r)} className="ml-auto h-8 w-8 grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--red)]" title="Excluir caso">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      </>
    );
  };

  /* ---------- detectados ---------- */
  const renderDetected = () =>
    candidates.length > 0 && (
      <section className="mb-3 border-y border-[var(--border)]">
        <button type="button" onClick={() => setDetectOpen((v) => !v)} className="w-full flex items-center gap-2 py-2.5 text-left text-[12.5px]">
          <Dot c="var(--amber)" />
          <span>
            <b className="font-medium">{candidates.length} lote(s) com sinais de problema</b>
            <span className="text-[var(--text-3)]"> ainda sem caso aberto · {brlK(candidates.reduce((a, c) => a + c.valor, 0))}</span>
          </span>
          <ChevronDown className={cn('ml-auto h-4 w-4 text-[var(--text-3)] transition-transform', detectOpen && 'rotate-180')} />
        </button>
        {detectOpen && (
          <div className="max-h-[320px] overflow-y-auto border-t border-[var(--border)]">
            {candidates.map((c) => (
              <div key={c.item.lote} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_90px_auto] gap-x-3 gap-y-1 items-center px-1 py-2 border-b border-[var(--border)] last:border-b-0">
                <span className="min-w-0">
                  <span className="font-mono text-[13px] font-medium">{c.item.lote}</span>
                  <span className="block text-[12px] text-[var(--text-3)] truncate">
                    <span className="font-mono text-[var(--text-2)]">{c.item.material}</span> · {clean(c.item.texto_breve_material)}
                  </span>
                </span>
                <span className="text-[12.5px] max-md:order-last max-md:col-span-2">
                  <span className="text-[var(--text-2)]">{CATS[c.cat].l}</span>
                  <span className="text-[var(--text-3)]"> · {c.why}</span>
                </span>
                <span className="hidden md:block font-mono text-[12.5px] text-right">{brlK(c.valor)}</span>
                <span className="flex items-center gap-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setCreate({ open: true, prefill: { lote: c.item.lote, cat: c.cat, prio: c.prio, motivo: c.why } })}
                    className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] text-[12px] font-medium text-[var(--text-2)] hover:text-[var(--text)]"
                  >
                    Abrir caso
                  </button>
                  <button type="button" onClick={() => dismiss(c.item.lote)} className="h-7 px-2 text-[12px] text-[var(--text-3)] hover:text-[var(--text)]" title={`Ocultar por ${IGNORAR_DIAS} dias`}>
                    Ignorar
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    );

  /* ============================================================================
   * Render
   * ========================================================================== */
  const QUICK = [
    { k: 'todos' as const, l: 'Todos', n: undefined as number | undefined },
    { k: 'atencao' as const, l: 'Precisam de você', n: stats.att, alert: stats.att > 0 },
    { k: 'vencidos' as const, l: 'Prazo vencido', n: stats.vencidos, alert: stats.vencidos > 0 },
    { k: 'semresp' as const, l: 'Sem responsável', n: stats.semResp },
    { k: 'meus' as const, l: 'Meus', n: stats.meus },
  ];

  return (
    <div className="text-[var(--text)]">
      {/* cabeçalho */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">Pendências de estoque</h2>
          <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">Casos de investigação de lote, do alerta até o ajuste no SAP</p>
        </div>
        <div className="flex items-center gap-2">
          {onAtualizarDb && (
            <button type="button" onClick={onAtualizarDb} disabled={isAtualizandoDb} className={btn} title="Atualizar estoque do SAP">
              <RefreshCw className={cn('h-3.5 w-3.5', isAtualizandoDb && 'animate-spin')} />
              {/* <span className="hidden sm:inline">Atualizar estoque</span> */}
            </button>
          )}
          <button type="button" onClick={() => setCreate({ open: true, prefill: {} })} className={primary} title="Novo caso (c)">
            <Plus className="h-3.5 w-3.5" /> Novo caso
          </button>
        </div>
      </div>

      {/* resumo */}
      <section className="flex lg:grid lg:grid-cols-5 overflow-x-auto no-scrollbar pb-4 mb-3 border-b border-[var(--border)]">
        {[
          { l: 'Em aberto', v: String(stats.open), s: brlK(stats.openValor), go: () => setQuick('todos') },
          { l: 'Precisam de você', v: String(stats.att), s: 'prazo, mudança de saldo, sem registro', c: stats.att ? 'var(--red)' : undefined, dot: 'var(--red)', go: () => setQuick('atencao') },
          { l: 'Prazo vencido', v: String(stats.vencidos), s: 'acima do SLA da prioridade', c: stats.vencidos ? 'var(--red)' : undefined, go: () => setQuick('vencidos') },
          { l: 'Sem responsável', v: String(stats.semResp), s: 'ninguém assumiu', c: stats.semResp ? 'var(--amber)' : undefined, go: () => setQuick('semresp') },
          { l: 'Lead time · 30 d', v: stats.avg !== null ? `${stats.avg.toFixed(1)} d` : '—', s: `${stats.done7} concluído(s) em 7 d`, go: () => changeView('metricas') },
        ].map((k, i) => (
          <button key={k.l} type="button" onClick={k.go} className={cn('text-left shrink-0 min-w-[150px] lg:min-w-0 px-4 group', i === 0 ? 'pl-0' : 'border-l border-[var(--border)]')}>
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)] whitespace-nowrap">
              {k.dot && <Dot c={k.dot} />}
              {k.l}
            </span>
            <span className="block font-mono text-[22px] font-semibold tracking-tight leading-tight mt-0.5 group-hover:underline underline-offset-4 decoration-1" style={{ color: k.c }}>
              {k.v}
            </span>
            <span className="block text-[11.5px] text-[var(--text-3)] truncate">{k.s}</span>
          </button>
        ))}
      </section>

      {renderDetected()}

      {/* barra */}
      <div className="flex items-center gap-2 flex-wrap pb-3">
        <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
          {(['quadro', 'lista', 'metricas'] as const).map((v) => (
            <button key={v} type="button" onClick={() => changeView(v)} className={seg(view === v)}>
              {v === 'quadro' ? 'Quadro' : v === 'lista' ? 'Lista' : 'Métricas'}
            </button>
          ))}
        </div>
        {view !== 'metricas' && (
          <>
            <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)] max-w-full overflow-x-auto no-scrollbar">
              {QUICK.map((x) => (
                <button key={x.k} type="button" onClick={() => setQuick(x.k)} className={seg(quick === x.k)}>
                  {x.l}
                  {x.n !== undefined && x.n > 0 && <span className={cn('font-mono text-[10.5px]', x.alert ? 'text-[var(--red)]' : 'text-[var(--text-3)]')}>{x.n}</span>}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 h-8 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] text-[var(--text-3)] focus-within:border-[var(--accent)] flex-1 min-w-[180px] max-w-[280px]">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lote, material, nota…" className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)]" />
              {q ? (
                <button type="button" onClick={() => setQ('')} className="hover:text-[var(--text)]">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1">/</kbd>
              )}
            </label>
            <select value={catF} onChange={(e) => setCatF(e.target.value as any)} className={selectCls}>
              <option value="all">Todas as categorias</option>
              {CAT_KEYS.map((c) => (
                <option key={c} value={c}>
                  {CATS[c].l}
                </option>
              ))}
            </select>
            <select value={prioF} onChange={(e) => setPrioF(e.target.value as any)} className={selectCls}>
              <option value="all">Toda prioridade</option>
              {PRIO.map((p) => (
                <option key={p.k} value={p.k}>
                  {p.l}
                </option>
              ))}
            </select>
            {(catF !== 'all' || prioF !== 'all' || q || quick !== 'todos') && (
              <button
                type="button"
                onClick={() => {
                  setCatF('all');
                  setPrioF('all');
                  setQ('');
                  setQuick('todos');
                }}
                className="text-[12px] font-medium text-[var(--accent)] px-1"
              >
                Limpar
              </button>
            )}
          </>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-3)] ml-auto" />}
      </div>

      {view === 'quadro' && renderBoard()}
      {view === 'lista' && renderList()}
      {view === 'metricas' && renderMetrics()}

      <p className="mt-3 text-[11px] text-[var(--text-3)] hidden md:block">
        Arraste entre as etapas · <kbd className="font-mono">c</kbd> novo caso · <kbd className="font-mono">a</kbd> assumir · <kbd className="font-mono">n</kbd> nota ·{' '}
        <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> navega · <kbd className="font-mono">Esc</kbd> fecha
      </p>

      {sel && renderDetail(sel)}

      {resolving && <ResolveDialog row={resolving} busy={busy} onClose={() => setResolving(null)} onConfirm={(d) => confirmResolve(resolving, d)} />}

      <CreateDialog
        open={create.open}
        prefill={create.prefill}
        me={me}
        people={people}
        peopleOptions={peopleOptions}
        onClose={() => setCreate({ open: false, prefill: {} })}
        estoque={estoque}
        agingData={agingData}
        priceOf={priceOf}
        existing={new Set(open.map((r) => r.key))}
        onCreated={(lote) => {
          setQuick('todos');
          setSelKey(up(lote));
        }}
      />
    </div>
  );
}

/* ============================================================================
 * Concluir: definição de pronto
 * ========================================================================== */
function ResolveDialog({
  row,
  busy,
  onClose,
  onConfirm,
}: {
  row: Row;
  busy: boolean;
  onClose: () => void;
  onConfirm: (d: { causa: string; desfecho: string; doc: string; override: string }) => void;
}) {
  const isPredefined = CAUSAS.some((c) => c.k === row.causa_raiz);
  const [causaSelect, setCausaSelect] = useState(
    !row.causa_raiz ? '' : isPredefined ? row.causa_raiz : '__custom__'
  );
  const [customCausa, setCustomCausa] = useState(!isPredefined ? (row.causa_raiz || '') : '');
  const finalCausa = causaSelect === '__custom__' ? customCausa.trim() : causaSelect;

  const [desfecho, setDesfecho] = useState('');
  const [doc, setDoc] = useState(row.documento_sap || '');
  const [override, setOverride] = useState(false);
  const [just, setJust] = useState('');

  const pend = row.checklistX.filter((c) => c.req && !c.done);
  const falso = finalCausa === 'sem_divergencia';
  const checkOk = pend.length === 0 || falso || (override && just.trim().length > 3);
  const ok = !!finalCausa && desfecho.trim().length > 2 && checkOk;

  const item = (done: boolean, text: string, extra?: string) => (
    <li className="flex items-start gap-2 py-1.5 text-[12.5px]">
      <span className={cn('mt-[2px] h-4 w-4 rounded-full grid place-items-center shrink-0', done ? 'bg-[var(--green)] text-[var(--bg)]' : 'border border-[var(--border-strong)]')}>
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>
        {text}
        {extra && <span className="block text-[11.5px] text-[var(--text-3)]">{extra}</span>}
      </span>
    </li>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px] max-h-[92vh] flex flex-col">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] text-left">
          <DialogTitle className="text-[15px] font-semibold">Concluir lote {row.lote}</DialogTitle>
          <DialogDescription className="text-[12.5px] text-[var(--text-3)]">
            {row.material} · {clean(row.texto_breve_material)} · {CATS[row.cat].l}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <b className="block text-[12px] font-semibold text-[var(--text-2)]">Definição de pronto</b>
          <ul className="mt-1 mb-4">
            {item(!!finalCausa, 'Causa raiz definida', finalCausa ? causaL(finalCausa) : undefined)}
            {item(pend.length === 0 || falso, 'Checklist obrigatório completo', pend.length && !falso ? `Faltam: ${pend.map((p) => p.t).join(' · ')}` : undefined)}
            {item(desfecho.trim().length > 2, 'Desfecho descrito')}
          </ul>

          <label className="block text-[12px] text-[var(--text-3)] mb-1">Causa raiz</label>
          <select
            value={causaSelect}
            onChange={(e) => {
              setCausaSelect(e.target.value);
              if (e.target.value !== '__custom__') setCustomCausa('');
            }}
            className="w-full h-9 px-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] outline-none focus:border-[var(--accent)] mb-2"
          >
            <option value="">Selecione…</option>
            {CAUSAS.map((c) => (
              <option key={c.k} value={c.k}>
                {c.l}
              </option>
            ))}
            <option value="__custom__">Outra causa raiz (personalizada)…</option>
          </select>

          {causaSelect === '__custom__' && (
            <input
              type="text"
              value={customCausa}
              onChange={(e) => setCustomCausa(e.target.value)}
              placeholder="Descreva a causa raiz personalizada…"
              className="w-full h-9 px-2.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] outline-none focus:border-[var(--accent)] mb-3"
              autoFocus
            />
          )}

          <label className="block text-[12px] text-[var(--text-3)] mb-1">Desfecho</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DESFECHOS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDesfecho(d)}
                className={cn('h-7 px-2.5 rounded-full border text-[12px]', desfecho === d ? 'border-[var(--text-3)] bg-[var(--hover)] text-[var(--text)]' : 'border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)]')}
              >
                {d}
              </button>
            ))}
          </div>
          <textarea
            value={desfecho}
            onChange={(e) => setDesfecho(e.target.value)}
            rows={3}
            placeholder="Ex.: ajuste 551 lançado após contagem, diferença de 2,5 kg por consumo não baixado na OP 1234"
            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] outline-none focus:border-[var(--accent)] mb-3"
          />

          <label className="block text-[12px] text-[var(--text-3)] mb-1">Documento SAP (opcional)</label>
          <input
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            placeholder="Nº do documento de material, OT ou RNC"
            className="w-full h-9 px-2.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] font-mono text-[13px] outline-none focus:border-[var(--accent)]"
          />

          {pend.length > 0 && !falso && (
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="accent-[var(--accent)]" />
                Concluir com pendências no checklist
              </label>
              {override && (
                <input
                  value={just}
                  onChange={(e) => setJust(e.target.value)}
                  placeholder="Justificativa (fica no histórico)"
                  className="mt-2 w-full h-9 px-2.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] outline-none focus:border-[var(--accent)]"
                />
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] text-[12.5px] text-[var(--text-2)] hover:text-[var(--text)]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!ok || busy}
            onClick={() => onConfirm({ causa: finalCausa, desfecho: desfecho.trim(), doc: doc.trim(), override: override && pend.length && !falso ? just.trim() : '' })}
            className="h-9 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Concluir caso
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
 * Novo caso: o lote preenche o resto a partir do estoque
 * ========================================================================== */
function CreateDialog({
  open,
  prefill,
  me,
  people,
  peopleOptions,
  onClose,
  estoque,
  agingData,
  priceOf,
  existing,
  onCreated,
}: {
  open: boolean;
  prefill: Prefill;
  me: string;
  people: string[];
  peopleOptions?: PersonOption[];
  onClose: () => void;
  estoque: Map<string, { row: AgingData; total: number }>;
  agingData: AgingData[];
  priceOf: (m: string) => number;
  existing: Set<string>;
  onCreated: (lote: string) => void;
}) {
  const [lote, setLote] = useState('');
  const [material, setMaterial] = useState('');
  const [desc, setDesc] = useState('');
  const [qtd, setQtd] = useState('');
  const [cat, setCat] = useState<Cat>('sistemico_maior');
  const [prio, setPrio] = useState<PesagemTodoPriority>('media');
  const [resp, setResp] = useState(me);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const fill = (v: string) => {
    const f = estoque.get(up(v));
    if (f) {
      setMaterial(f.row.material);
      setDesc(f.row.texto_breve_material || '');
      setQtd(String(f.total).replace('.', ','));
    }
  };

  useEffect(() => {
    if (!open) return;
    setLote(prefill.lote || '');
    setMaterial('');
    setDesc('');
    setQtd('');
    setCat(prefill.cat || 'sistemico_maior');
    setPrio(prefill.prio || 'media');
    setResp(me);
    setMotivo(prefill.motivo || '');
    setNota('');
    if (prefill.lote) fill(prefill.lote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const found = estoque.get(up(lote));
  const dup = !!lote.trim() && existing.has(up(lote));
  const q = parseNum(qtd) ?? 0;
  const vu = priceOf(material.trim());
  const prazo = new Date(Date.now() + SLA_DIAS[prio] * 86400000);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!material.trim() || !lote.trim()) return toast.error('Informe lote e material');
    if (dup) return toast.error('Esse lote já tem caso aberto');
    setSaving(true);
    try {
      const id = await createPesagemTodo({
        material: material.trim(),
        texto_breve_material: desc.trim(),
        lote: lote.trim(),
        quantidade: q,
        unidade_medida: found?.row.unidade_medida || 'KG',
        deposito: found?.row.deposito || 'PES',
        tipo_deposito: found?.row.tipo_deposito,
        posicao_deposito: found?.row.posicao_deposito || '',
        valor_unitario: vu,
        valor_total: Math.max(0, q) * vu,
        dias_aging: found?.row.dias_aging,
        data_vencimento: found?.row.data_vencimento,
        motivo_inicial: motivo.trim() || CATS[cat].hint,
        prioridade: prio,
        nota_inicial: nota.trim(),
        categoria: cat,
        responsavel: resp,
      } as any);
      const respName = resp ? (peopleOptions?.find((p) => p.email.toLowerCase() === resp.toLowerCase())?.name || shortName(resp)) : '';
      await updatePesagemTodo(id, {
        etapa: 'triagem',
        categoria: cat,
        checklist: CATS[cat].tpl.map((x, i) => ({ id: `t${i}`, t: x.t, req: !!x.req, done: false })),
        responsavel: resp,
        eventos: [{ id: uid(), tipo: 'sistema', texto: `Categoria ${CATS[cat].l} · prioridade ${prioMeta(prio).l}${respName ? ` · responsável ${respName}` : ''}`, by: me, at: new Date().toISOString() }],
      } as any);
      toast.success(`Caso do lote ${lote.trim()} aberto`);
      onCreated(lote.trim());
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível abrir o caso');
    } finally {
      setSaving(false);
    }
  };

  const field = 'h-9 w-full px-2.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]';
  const label = 'block text-[12px] text-[var(--text-3)] mb-1';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px] max-h-[92vh] flex flex-col">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] text-left">
          <DialogTitle className="text-[15px] font-semibold">Novo caso</DialogTitle>
          <DialogDescription className="text-[12.5px] text-[var(--text-3)]">Informe o lote: material, saldo e posição vêm do estoque atual.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Lote</label>
              <input
                autoFocus
                value={lote}
                onChange={(e) => {
                  setLote(e.target.value);
                  fill(e.target.value);
                }}
                placeholder="Ex.: M5Q3116-1"
                className={cn(field, 'font-mono', dup && 'border-[var(--red)]')}
              />
              <p className="mt-1 text-[11.5px]" style={{ color: dup ? 'var(--red)' : found ? 'var(--green)' : 'var(--text-3)' }}>
                {dup
                  ? 'Já existe caso aberto para esse lote.'
                  : found
                  ? `Encontrado · ${qf(found.total)} ${found.row.unidade_medida || 'KG'} em ${found.row.posicao_deposito || found.row.deposito || '—'} · ${found.row.dias_aging ?? 0} d`
                  : lote.trim()
                  ? 'Fora do estoque atual · preencha manualmente'
                  : '\u00a0'}
              </p>
            </div>
            <div>
              <label className={label}>Material</label>
              <input
                value={material}
                onChange={(e) => {
                  setMaterial(e.target.value);
                  if (!desc) {
                    const f = agingData.find((x) => x.material === e.target.value.trim());
                    if (f) setDesc(f.texto_breve_material || '');
                  }
                }}
                className={cn(field, 'font-mono')}
              />
            </div>
            <div>
              <label className={label}>Saldo no registro</label>
              <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" className={cn(field, 'font-mono text-right')} />
            </div>
            <div className="col-span-2">
              <label className={label}>Descrição</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} className={field} />
            </div>
            <div className="col-span-2">
              <label className={label}>Categoria</label>
              <select value={cat} onChange={(e) => setCat(e.target.value as Cat)} className={field}>
                {CAT_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {CATS[c].l} — {CATS[c].hint}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11.5px] text-[var(--text-3)]">Checklist: {CATS[cat].tpl.map((t) => t.t).join(' · ')}</p>
            </div>
            <div className="col-span-2">
              <label className={label}>
                Prioridade <span className="text-[11px]">· prazo {prazo.toLocaleDateString('pt-BR')}</span>
              </label>
              <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden">
                {PRIO.map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => setPrio(p.k)}
                    className={cn('flex-1 h-9 text-[12.5px] border-r border-[var(--border-strong)] last:border-r-0', prio === p.k ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)]')}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className={label}>Responsável</label>
              <select value={resp} onChange={(e) => setResp(e.target.value)} className={field}>
                <option value="">Ninguém (fica em triagem)</option>
                {peopleOptions && peopleOptions.length > 0
                  ? peopleOptions.map((p) => {
                      const isMe = p.email.toLowerCase() === me.toLowerCase();
                      return (
                        <option key={p.email} value={p.email}>
                          {p.name} {isMe ? '(você)' : ''}
                        </option>
                      );
                    })
                  : people.map((p) => (
                      <option key={p} value={p}>
                        {shortName(p)}
                        {p === me ? ' (você)' : ''}
                      </option>
                    ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={label}>Motivo</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={CATS[cat].hint} className={field} />
            </div>
            <div className="col-span-2">
              <label className={label}>Primeiro registro (opcional)</label>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className={cn(field, 'h-auto py-2')} />
            </div>
            {vu > 0 && q !== 0 && (
              <p className="col-span-2 text-[12px] text-[var(--text-3)]">
                Valor no registro: <span className="font-mono text-[var(--text-2)]">{brl(Math.max(0, q) * vu)}</span>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] text-[12.5px] text-[var(--text-2)] hover:text-[var(--text)]">
              Cancelar
            </button>
            <button type="submit" disabled={saving || dup || !lote.trim() || !material.trim()} className="h-9 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Abrir caso
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
