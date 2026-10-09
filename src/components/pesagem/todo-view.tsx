'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { AgingData, LoteInvestigacao } from '@/types/aging';
import {
  PesagemTodoItem,
  PesagemTodoItemEnriched,
  PesagemTodoStatus,
  PesagemTodoPriority,
  PesagemTodoAcao,
  EstoqueDiffStatus,
} from '@/types/pesagem-todo';
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
import { getMaterialDescription, rememberMaterialDescriptions } from '@/lib/material-descriptions';
import { Search, Plus, X, Copy, RefreshCw, Loader2, ChevronRight, Trash2, RotateCcw, ArrowUpRight, ListChecks, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import toast from 'react-hot-toast';

/* ============================================================================
 * Configuração das regras de atenção
 * ========================================================================== */
const DIAS_SEM_NOTA = 2; // aberto há X dias sem nenhuma nota
const DIAS_PARADO = 7; // sem atividade (nota/status) há X dias
const DIAS_SAP = 3; // aguardando SAP há mais de X dias

/* ============================================================================
 * Tipos e helpers
 * ========================================================================== */
interface TodoViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
  todoItems: PesagemTodoItem[];
  lotesInvestigacao?: LoteInvestigacao[];
  currentUserEmail?: string;
  onNavigateToMaterial?: (material: string) => void;
  onAtualizarDb?: () => void;
  isAtualizandoDb?: boolean;
  onInvestigacaoChange?: () => void;
  selectedLote?: string | null;
  onClearSelectedLote?: () => void;
}

type Tone = 'red' | 'amber' | 'muted';
type Reason = { k: string; tone: Tone; text: string; w: number };
type Row = PesagemTodoItemEnriched & {
  key: string;
  reasons: Reason[];
  score: number;
  diasAberto: number;
  diasSemAtividade: number;
  ultimaAtividade: Date;
  valorRef: number;
};

const TONE: Record<Tone, string> = { red: 'var(--red)', amber: 'var(--amber)', muted: 'var(--text-3)' };
const STATUS: { k: PesagemTodoStatus; l: string; c: string }[] = [
  { k: 'pendente', l: 'Pendente', c: 'var(--text-3)' },
  { k: 'em_investigacao', l: 'Em investigação', c: 'var(--amber)' },
  { k: 'aguardando_sap', l: 'Aguardando SAP', c: 'var(--accent)' },
  { k: 'concluido', l: 'Concluído', c: 'var(--green)' },
];
const PRIO: { k: PesagemTodoPriority; l: string; w: number }[] = [
  { k: 'baixa', l: 'Baixa', w: 0 },
  { k: 'media', l: 'Média', w: 1 },
  { k: 'alta', l: 'Alta', w: 3 },
  { k: 'critica', l: 'Crítica', w: 6 },
];
const DESFECHOS = [
  'Transferido via MIGO',
  'Ajuste de inventário lançado',
  'Consumido em ordem de produção',
  'Devolvido ao almoxarifado',
  'Sem divergência após conferência',
];

const up = (s?: string | null) => String(s ?? '').trim().toUpperCase();
const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlK = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e4) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl(v);
};
const qf = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
const sgn = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + qf(Math.abs(v));
const days = (from: string | Date | undefined) => {
  if (!from) return 0;
  const t = new Date(from).getTime();
  return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};
const dt = (s?: string) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ago = (d: number) => (d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} d`);
const statusMeta = (s: PesagemTodoStatus) => STATUS.find((x) => x.k === s) || STATUS[0];
const prioMeta = (p: PesagemTodoPriority) => PRIO.find((x) => x.k === p) || PRIO[1];
const clean = (s?: string) => (s || '').replace(/\*\*/g, '');

/* Plano de ação: prazos em YYYY-MM-DD (data local) */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDaysISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const prazoFmt = (p?: string) => {
  if (!p) return 'sem prazo';
  const t = todayISO();
  if (p === t) return 'hoje';
  if (p === addDaysISO(1)) return 'amanhã';
  const [y, m, d] = p.split('-');
  return `${d}/${m}${y !== t.slice(0, 4) ? `/${y.slice(2)}` : ''}`;
};
const prazoTone = (a: PesagemTodoAcao): string | undefined => {
  if (a.feito || !a.prazo) return undefined;
  const t = todayISO();
  if (a.prazo < t) return 'var(--red)';
  if (a.prazo === t) return 'var(--amber)';
  return undefined;
};
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function Dot({ c, className }: { c: string; className?: string }) {
  return <span className={cn('inline-block w-[7px] h-[7px] rounded-full shrink-0', className)} style={{ background: c }} />;
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
  onNavigateToMaterial,
  onAtualizarDb,
  isAtualizandoDb,
  onInvestigacaoChange,
  selectedLote,
  onClearSelectedLote,
}: TodoViewProps) {
  const [tab, setTab] = useState<'atencao' | 'abertos' | 'plano' | 'concluidos' | 'todos'>('atencao');
  const [q, setQ] = useState('');
  const [prio, setPrio] = useState<'all' | PesagemTodoPriority>('all');
  const [sortBy, setSortBy] = useState<'atencao' | 'valor' | 'parado' | 'recente'>('atencao');
  const [selKey, setSelKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locallyDeletedKeys, setLocallyDeletedKeys] = useState<Set<string>>(new Set());

  const [note, setNote] = useState('');
  const [resolving, setResolving] = useState<Row | null>(null);
  const [desfecho, setDesfecho] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Plano de ação
  const [acaoTexto, setAcaoTexto] = useState('');
  const [acaoPrazo, setAcaoPrazo] = useState('');
  const [acaoResp, setAcaoResp] = useState('');
  const [planoFiltro, setPlanoFiltro] = useState<'abertas' | 'minhas' | 'feitas'>('abertas');

  const searchRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const acaoRef = useRef<HTMLInputElement>(null);

  /* ---------------- dados ---------------- */
  const estoqueMap = useMemo(() => {
    const m = new Map<string, AgingData>();
    agingData.forEach((i) => i.lote && m.set(up(i.lote), i));
    return m;
  }, [agingData]);

  const priceOf = (mat: string) => valores[mat] ?? valores[String(mat).replace(/^0+/, '')] ?? 0;

  // Itens do Firestore + lotes marcados em investigação que ainda não viraram item
  const allItems = useMemo<PesagemTodoItem[]>(() => {
    rememberMaterialDescriptions(agingData);
    rememberMaterialDescriptions(todoItems);
    const has = new Set(todoItems.map((t) => up(t.lote)));
    const synth: PesagemTodoItem[] = [];
    (lotesInvestigacao || []).forEach((inv) => {
      const k = up(inv.lote);
      if (!k || has.has(k) || locallyDeletedKeys.has(k)) return;
      const s = estoqueMap.get(k);
      const qtd = Number(s?.estoque_disponivel) || 0;
      const mat = inv.material || s?.material || '';
      const vu = priceOf(mat);
      const desc = s?.texto_breve_material || getMaterialDescription(mat);
      synth.push({
        id: `inv-${k}`,
        material: mat,
        texto_breve_material: desc,
        lote: inv.lote,
        unidade_medida: s?.unidade_medida || 'KG',
        quantidade_inicial: qtd,
        valor_unitario_inicial: vu,
        valor_total_inicial: qtd * vu,
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
      } as PesagemTodoItem);
    });
    return [...todoItems, ...synth].filter((t) => !locallyDeletedKeys.has(up(t.lote)));
  }, [todoItems, lotesInvestigacao, estoqueMap, valores, locallyDeletedKeys, agingData]);

  // Enriquecimento com o estoque atual + motivos de atenção
  const rows = useMemo<Row[]>(() => {
    return allItems.map((todo) => {
      const cur = estoqueMap.get(up(todo.lote));
      let diff_status: EstoqueDiffStatus = 'ativo_sem_alteracao';
      let estoque_atual = 0;
      let valor_total_atual = 0;
      let posicao_atual: string | undefined;
      let deposito_atual: string | undefined;
      let tipo_deposito_atual: string | undefined;
      let dias_aging_atual: number | undefined;
      const localizado = !!cur && Number(cur.estoque_disponivel ?? 0) > 0;

      if (!localizado) {
        diff_status = 'saiu_do_estoque';
      } else {
        estoque_atual = Number(cur!.estoque_disponivel) || 0;
        const vu = priceOf(cur!.material) || todo.valor_unitario_inicial || 0;
        valor_total_atual = estoque_atual * vu;
        posicao_atual = cur!.posicao_deposito || '';
        deposito_atual = cur!.deposito || '';
        tipo_deposito_atual = cur!.tipo_deposito || '';
        dias_aging_atual = cur!.dias_aging ?? 0;
        const dq = estoque_atual - todo.quantidade_inicial;
        const posMudou =
          (!!posicao_atual && !!todo.posicao_deposito_inicial && up(posicao_atual) !== up(todo.posicao_deposito_inicial)) ||
          (!!deposito_atual && !!todo.deposito_inicial && up(deposito_atual) !== up(todo.deposito_inicial));
        if (Math.abs(dq) > 0.001) diff_status = dq < 0 ? 'quantidade_reduziu' : 'quantidade_aumentou';
        else if (posMudou) diff_status = 'posicao_alterada';
      }
      const diff_quantidade = estoque_atual - todo.quantidade_inicial;
      const diff_valor = valor_total_atual - todo.valor_total_inicial;

      const lastNote = todo.notas.reduce<string | undefined>((m, n) => (!m || n.created_at > m ? n.created_at : m), undefined);
      const lastAct = [todo.updated_at, lastNote, todo.created_at].filter(Boolean).sort().pop() as string;
      const diasAberto = days(todo.created_at);
      const diasSemAtividade = days(lastAct);

      const reasons: Reason[] = [];
      if (todo.status !== 'concluido') {
        if (diff_status === 'saiu_do_estoque')
          reasons.push({ k: 'saiu', tone: 'red', text: 'Saiu do estoque · confirme e resolva', w: 10 });
        else if (diff_status === 'quantidade_reduziu')
          reasons.push({ k: 'qtd', tone: 'amber', text: `Saldo caiu ${sgn(diff_quantidade)} ${todo.unidade_medida}`, w: 6 });
        else if (diff_status === 'quantidade_aumentou')
          reasons.push({ k: 'qtd', tone: 'amber', text: `Saldo subiu ${sgn(diff_quantidade)} ${todo.unidade_medida}`, w: 5 });
        else if (diff_status === 'posicao_alterada')
          reasons.push({ k: 'pos', tone: 'amber', text: `Mudou para ${posicao_atual || deposito_atual}`, w: 5 });
        if (todo.prioridade === 'critica') reasons.push({ k: 'prio', tone: 'red', text: 'Prioridade crítica', w: 6 });
        const hoje = todayISO();
        const atrasadas = (todo.acoes || []).filter((a) => !a.feito && a.prazo && a.prazo < hoje);
        if (atrasadas.length)
          reasons.push({ k: 'acao', tone: 'red', text: atrasadas.length === 1 ? `Ação atrasada: ${atrasadas[0].texto}` : `${atrasadas.length} ações atrasadas`, w: 5 });
        if (!todo.notas.length && diasAberto >= DIAS_SEM_NOTA)
          reasons.push({ k: 'nota', tone: 'amber', text: `Sem nota há ${diasAberto} d`, w: 4 });
        else if (diasSemAtividade >= DIAS_PARADO)
          reasons.push({ k: 'parado', tone: 'amber', text: `Parado há ${diasSemAtividade} d`, w: 4 });
        if (todo.status === 'aguardando_sap' && diasSemAtividade >= DIAS_SAP)
          reasons.push({ k: 'sap', tone: 'amber', text: `No SAP há ${diasSemAtividade} d`, w: 3 });
      }
      const valorRef = localizado ? valor_total_atual : todo.valor_total_inicial;
      const score =
        reasons.reduce((s, r) => s + r.w, 0) + prioMeta(todo.prioridade).w + Math.min(3, Math.log10(1 + valorRef / 1000));

      const desc = todo.texto_breve_material || cur?.texto_breve_material || getMaterialDescription(todo.material) || '';

      return {
        ...todo,
        texto_breve_material: desc,
        key: up(todo.lote) || todo.id,
        estoque_atual,
        valor_total_atual,
        posicao_atual,
        deposito_atual,
        tipo_deposito_atual,
        dias_aging_atual,
        diff_status,
        diff_quantidade,
        diff_valor,
        localizado_no_estoque: localizado,
        reasons,
        score,
        diasAberto,
        diasSemAtividade,
        ultimaAtividade: new Date(lastAct),
        valorRef,
      } as Row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, estoqueMap, valores]);

  /* ---------------- indicadores ---------------- */
  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status !== 'concluido');
    const att = open.filter((r) => r.reasons.length);
    const saiu = open.filter((r) => r.diff_status === 'saiu_do_estoque');
    const parados = open.filter((r) => r.diasSemAtividade >= DIAS_PARADO);
    const done = rows.filter((r) => r.status === 'concluido');
    const done30 = done.filter((r) => days(r.resolvido_em) <= 30);
    const byStatus = STATUS.slice(0, 3).map((s) => ({ ...s, n: open.filter((r) => r.status === s.k).length }));
    const tempoMedio = done30.length
      ? Math.round(done30.reduce((s, r) => s + Math.max(0, (new Date(r.resolvido_em || r.updated_at).getTime() - new Date(r.created_at).getTime()) / 86400000), 0) / done30.length)
      : null;
    return {
      open: open.length,
      openValor: open.reduce((s, r) => s + r.valorRef, 0),
      att: att.length,
      attValor: att.reduce((s, r) => s + r.valorRef, 0),
      saiu: saiu.length,
      parados: parados.length,
      done: done.length,
      done30: done30.length,
      tempoMedio,
      byStatus,
      total: rows.length,
    };
  }, [rows]);

  /* ---------------- lista ---------------- */
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (tab === 'atencao' && (r.status === 'concluido' || !r.reasons.length)) return false;
        if (tab === 'abertos' && r.status === 'concluido') return false;
        if (tab === 'concluidos' && r.status !== 'concluido') return false;
        if (prio !== 'all' && r.prioridade !== prio) return false;
        if (s) {
          const hay = [r.material, r.texto_breve_material, r.lote, r.motivo_inicial, r.desfecho, ...(r.tags || []), ...r.notas.map((n) => n.texto)]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (tab === 'concluidos') return new Date(b.resolvido_em || b.updated_at).getTime() - new Date(a.resolvido_em || a.updated_at).getTime();
        if (sortBy === 'valor') return b.valorRef - a.valorRef;
        if (sortBy === 'parado') return b.diasSemAtividade - a.diasSemAtividade;
        if (sortBy === 'recente') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return b.score - a.score || b.valorRef - a.valorRef;
      });
  }, [rows, tab, q, prio, sortBy]);

  // Sem nada pedindo atenção, abre direto em "Abertos"
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current && rows.length) {
      firstLoad.current = false;
      if (!stats.att) setTab('abertos');
    }
  }, [rows.length, stats.att]);

  const sel = useMemo(() => (selKey ? rows.find((r) => r.key === selKey) || null : null), [rows, selKey]);
  useEffect(() => {
    setNote('');
    setAcaoTexto('');
    setAcaoPrazo('');
  }, [selKey]);

  // Seletor externo de lote (navegação direta a partir de tabelas)
  useEffect(() => {
    if (selectedLote) {
      const k = up(selectedLote);
      setSelKey(k);
      const found = rows.find((r) => r.key === k);
      if (found) {
        if (found.status === 'concluido') {
          setTab('todos');
        } else if (tab === 'concluidos') {
          setTab('abertos');
        }
      } else {
        setTab('todos');
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(`todo-${k}`);
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      onClearSelectedLote?.();
    }
  }, [selectedLote, rows, tab, onClearSelectedLote]);

  /* ---------------- persistência ---------------- */
  // Lote sintetizado (só em investigação) vira item real na primeira ação
  const ensureReal = async (
    r: Row,
    notaInicial?: string,
    initialStatus: PesagemTodoStatus = 'pendente',
    desfecho?: string
  ): Promise<string> => {
    if (!r.id.startsWith('inv-')) return r.id;
    return await createPesagemTodo({
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
      nota_inicial: notaInicial,
      status: initialStatus,
      desfecho: desfecho,
    });
  };

  const run = async (fn: () => Promise<unknown>, ok: string, err: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e: any) {
      console.error('Erro na ação de TODO:', e);
      const msg = e?.message ? `${err}: ${e.message}` : err;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const saveNote = (r: Row) => {
    const t = note.trim();
    if (!t) return;
    run(
      async () => {
        if (r.id.startsWith('inv-')) await ensureReal(r, t);
        else await addPesagemTodoNote(r.id, r.notas, t);
        setNote('');
      },
      'Nota registrada',
      'Não foi possível salvar a nota'
    );
  };

  const setStatus = (r: Row, s: PesagemTodoStatus) => {
    if (s === r.status) return;
    if (s === 'concluido') {
      setResolving(r);
      setDesfecho('');
      return;
    }
    run(
      async () => {
        if (r.id.startsWith('inv-')) {
          await ensureReal(r, undefined, s);
        } else {
          await updatePesagemTodoStatus(r.id, s);
        }
      },
      `Status: ${statusMeta(s).l}`,
      'Não foi possível alterar o status'
    );
  };

  const setPriority = (r: Row, p: PesagemTodoPriority) => {
    if (p === r.prioridade) return;
    run(
      async () => {
        const id = await ensureReal(r);
        await updatePesagemTodo(id, { prioridade: p });
      },
      '',
      'Não foi possível alterar a prioridade'
    );
  };

  const confirmResolve = () => {
    const r = resolving;
    if (!r) return;
    run(
      async () => {
        const d = desfecho.trim();
        if (r.id.startsWith('inv-')) {
          await ensureReal(r, undefined, 'concluido', d);
        } else {
          await updatePesagemTodoStatus(r.id, 'concluido', d);
        }
        await removeLoteInvestigacao(r.lote).catch((e) => console.warn('Aviso ao remover lote_investigacao:', e));
        onInvestigacaoChange?.();
        setResolving(null);
        setDesfecho('');
        // avança para o próximo da lista
        const idx = list.findIndex((x) => x.key === r.key);
        const next = list[idx + 1] || list[idx - 1];
        setSelKey(next && next.key !== r.key ? next.key : null);
      },
      `Lote ${r.lote} resolvido`,
      'Não foi possível concluir'
    );
  };

  const reopen = (r: Row) => run(() => updatePesagemTodoStatus(r.id, 'pendente'), 'Item reaberto', 'Não foi possível reabrir');

  const remove = (r: Row) => {
    if (!window.confirm(`Excluir o acompanhamento do lote ${r.lote}? As notas serão perdidas.`)) return;
    const k = up(r.lote);
    setLocallyDeletedKeys((prev) => new Set(prev).add(k));
    setSelKey(null);
    run(
      async () => {
        if (!r.id.startsWith('inv-')) {
          await deletePesagemTodo(r.id);
        }
        await removeLoteInvestigacao(r.lote).catch(() => {});
        onInvestigacaoChange?.();
      },
      'Acompanhamento excluído',
      'Não foi possível excluir'
    );
  };

  /* ---------------- plano de ação ---------------- */
  const saveAcoes = (r: Row, acoes: PesagemTodoAcao[], ok: string, err: string) =>
    run(
      async () => {
        const id = await ensureReal(r);
        await updatePesagemTodo(id, { acoes });
      },
      ok,
      err
    );

  const addAcao = (r: Row) => {
    const texto = acaoTexto.trim();
    if (!texto) return;
    const a: PesagemTodoAcao = {
      id: newId(),
      texto,
      responsavel: acaoResp.trim() || undefined,
      prazo: acaoPrazo || undefined,
      feito: false,
      created_at: new Date().toISOString(),
      created_by_name: currentUserEmail || undefined,
    };
    setAcaoTexto('');
    setAcaoPrazo('');
    saveAcoes(r, [...(r.acoes || []), a], 'Ação adicionada', 'Não foi possível adicionar a ação');
    requestAnimationFrame(() => acaoRef.current?.focus());
  };

  const toggleAcao = (r: Row, id: string) => {
    const acoes = (r.acoes || []).map((a) =>
      a.id === id ? { ...a, feito: !a.feito, feito_em: !a.feito ? new Date().toISOString() : undefined } : a
    );
    saveAcoes(r, acoes, '', 'Não foi possível atualizar a ação');
  };

  const removeAcao = (r: Row, id: string) =>
    saveAcoes(r, (r.acoes || []).filter((a) => a.id !== id), '', 'Não foi possível remover a ação');

  // Base para o plano de ação: respeita busca e prioridade, ignora a aba
  const baseRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (prio !== 'all' && r.prioridade !== prio) return false;
      if (s) {
        const hay = [r.material, r.texto_breve_material, r.lote, r.motivo_inicial, r.desfecho, ...(r.tags || []), ...r.notas.map((n) => n.texto), ...(r.acoes || []).map((a) => `${a.texto} ${a.responsavel || ''}`)]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, q, prio]);

  const meKeys = useMemo(() => {
    const e = (currentUserEmail || '').trim().toLowerCase();
    return e ? [e, e.split('@')[0]] : [];
  }, [currentUserEmail]);

  const plano = useMemo(() => {
    const t = todayISO();
    const em7 = addDaysISO(7);
    const all = baseRows.flatMap((r) => (r.acoes || []).map((a) => ({ a, r })));
    const abertas = all.filter((x) => !x.a.feito && x.r.status !== 'concluido');
    const minhas = abertas.filter((x) => {
      const resp = (x.a.responsavel || '').trim().toLowerCase();
      return resp && meKeys.some((k) => resp === k || resp.includes(k));
    });
    const feitas = all
      .filter((x) => x.a.feito)
      .sort((x, y) => (y.a.feito_em || '').localeCompare(x.a.feito_em || ''))
      .slice(0, 100);
    const src = planoFiltro === 'minhas' ? minhas : abertas;
    const byPrazo = (x: { a: PesagemTodoAcao }, y: { a: PesagemTodoAcao }) => (x.a.prazo || '9999').localeCompare(y.a.prazo || '9999');
    const groups =
      planoFiltro === 'feitas'
        ? [{ k: 'feitas', l: 'Concluídas', c: 'var(--green)', items: feitas }]
        : [
            { k: 'atrasadas', l: 'Atrasadas', c: 'var(--red)', items: src.filter((x) => x.a.prazo && x.a.prazo < t).sort(byPrazo) },
            { k: 'hoje', l: 'Hoje', c: 'var(--amber)', items: src.filter((x) => x.a.prazo === t) },
            { k: 'semana', l: 'Próximos 7 dias', c: 'var(--accent)', items: src.filter((x) => x.a.prazo && x.a.prazo > t && x.a.prazo <= em7).sort(byPrazo) },
            { k: 'depois', l: 'Depois', c: 'var(--text-3)', items: src.filter((x) => x.a.prazo && x.a.prazo > em7).sort(byPrazo) },
            { k: 'sem', l: 'Sem prazo', c: 'var(--text-3)', items: src.filter((x) => !x.a.prazo) },
          ];
    return {
      groups,
      nAbertas: abertas.length,
      nMinhas: minhas.length,
      nFeitas: all.filter((x) => x.a.feito).length,
      nAtrasadas: abertas.filter((x) => x.a.prazo && x.a.prazo < t).length,
      semPlano: baseRows.filter((r) => r.status !== 'concluido' && !(r.acoes || []).some((a) => !a.feito)).length,
    };
  }, [baseRows, planoFiltro, meKeys]);

  /* ---------------- teclado ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const isInput = ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName);
      const isNoteArea = ae === noteRef.current;

      // Se estiver digitando na nota
      if (isNoteArea) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (sel) saveNote(sel);
          return;
        }
        if (e.key === 'Escape') {
          ae?.blur();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (isInput) ae!.blur();
        else if (selKey) setSelKey(null);
        return;
      }

      if (isInput || resolving || createOpen) return;

      if (e.key === '/' || e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!list.length) return;
        e.preventDefault();
        const i = list.findIndex((r) => r.key === selKey);
        const d = e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1;
        const n = list[Math.max(0, Math.min(list.length - 1, i < 0 ? 0 : i + d))];
        setSelKey(n.key);
        requestAnimationFrame(() => document.getElementById(`todo-${n.key}`)?.scrollIntoView({ block: 'nearest' }));
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (!selKey && list.length > 0) {
          e.preventDefault();
          setSelKey(list[0].key);
        }
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        if (sel && sel.status !== 'concluido') {
          e.preventDefault();
          noteRef.current?.focus();
        }
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (sel && sel.status !== 'concluido') {
          e.preventDefault();
          setResolving(sel);
          setDesfecho('');
        }
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setCreateOpen(true);
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        if (sel && sel.status !== 'concluido') {
          e.preventDefault();
          acaoRef.current?.focus();
        }
        return;
      }

      // Atalhos operacionais com item selecionado
      if (sel && sel.status !== 'concluido') {
        if (e.key === '1') {
          e.preventDefault();
          setStatus(sel, 'pendente');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          setStatus(sel, 'em_investigacao');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          setStatus(sel, 'aguardando_sap');
          return;
        }
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          const prios: PesagemTodoPriority[] = ['baixa', 'media', 'alta', 'critica'];
          const nextPrio = prios[(prios.indexOf(sel.prioridade) + 1) % prios.length];
          setPriority(sel, nextPrio);
          return;
        }
        if (e.key === 'x' || e.key === 'X' || e.key === 'Delete') {
          e.preventDefault();
          remove(sel);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, selKey, sel, resolving, createOpen, note]);

  /* ============================================================================
   * UI
   * ========================================================================== */
  const btn =
    'h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40';
  const primary =
    'h-8 px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40';
  const seg = (on: boolean) =>
    cn(
      'h-[30px] px-3 text-[12px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap border-r border-[var(--border-strong)] last:border-r-0',
      on ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
    );

  const TABS = [
    { k: 'atencao' as const, l: 'Precisam de você', n: stats.att, alert: stats.att > 0 },
    { k: 'abertos' as const, l: 'Abertos', n: stats.open },
    { k: 'plano' as const, l: 'Plano de ação', n: plano.nAbertas, alert: plano.nAtrasadas > 0 },
    { k: 'concluidos' as const, l: 'Concluídos', n: stats.done },
    { k: 'todos' as const, l: 'Todos', n: stats.total },
  ];

  const emptyText =
    tab === 'atencao'
      ? 'Nada pedindo sua atenção agora. Os lotes abertos estão estáveis e com notas recentes.'
      : tab === 'abertos'
      ? 'Nenhum lote em acompanhamento.'
      : tab === 'plano'
      ? 'Nenhuma ação registrada no plano de ação.'
      : tab === 'concluidos'
      ? 'Nenhum acompanhamento concluído ainda.'
      : 'Nenhum registro.';

  return (
    <div className="text-[var(--text)]">
      {/* ---------- Cabeçalho ---------- */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">Pendências de estoque</h2>
          <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">
            Lotes em acompanhamento, comparados com o estoque atual · ordenados pelo que precisa de você primeiro
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onAtualizarDb && (
            <button type="button" onClick={onAtualizarDb} disabled={isAtualizandoDb} className={btn}>
              <RefreshCw className={cn('h-3.5 w-3.5', isAtualizandoDb && 'animate-spin')} /> Atualizar estoque
            </button>
          )}
          <button type="button" onClick={() => setCreateOpen(true)} className={primary}>
            <Plus className="h-3.5 w-3.5" /> Acompanhar lote
          </button>
        </div>
      </div>

      {/* ---------- Resumo ---------- */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-y-3 pb-4 border-b border-[var(--border)]">
        {[
          {
            l: 'Precisam de você',
            v: stats.att,
            s: stats.att ? `${brlK(stats.attValor)} envolvidos` : 'tudo sob controle',
            c: stats.att ? 'var(--red)' : undefined,
            dot: 'var(--red)',
            go: () => setTab('atencao'),
          },
          {
            l: 'Em aberto',
            v: stats.open,
            s: (
              <>
                {stats.byStatus.map((b, i) => (
                  <span key={b.k}>
                    {i > 0 && ' · '}
                    <span className="font-mono">{b.n}</span> {b.k === 'pendente' ? 'pend.' : b.k === 'em_investigacao' ? 'invest.' : 'SAP'}
                  </span>
                ))}
              </>
            ),
            go: () => setTab('abertos'),
          },
          {
            l: 'Prontos para resolver',
            v: stats.saiu,
            s: 'saíram do estoque',
            c: stats.saiu ? 'var(--amber)' : undefined,
            go: () => {
              setTab('atencao');
              setSortBy('atencao');
            },
          },
          {
            l: 'Resolvidos em 30 d',
            v: stats.done30,
            s: stats.tempoMedio !== null ? `média de ${stats.tempoMedio} d por lote` : `${stats.parados} parado(s) há ${DIAS_PARADO}+ d`,
            go: () => setTab('concluidos'),
          },
        ].map((k, i) => (
          <button
            key={k.l}
            type="button"
            onClick={k.go}
            className={cn('text-left px-4 min-w-0 group', i === 0 ? 'pl-0' : 'border-l border-[var(--border)]', i === 2 && 'max-lg:border-l-0 max-lg:pl-0')}
          >
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
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

      {/* ---------- Barra ---------- */}
      <div className="flex items-center gap-2 flex-wrap py-3">
        <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
          {TABS.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)} className={seg(tab === t.k)}>
              {t.l}
              <span className={cn('font-mono text-[10.5px]', t.alert ? 'text-[var(--red)]' : 'text-[var(--text-3)]')}>{t.n}</span>
            </button>
          ))}
        </div>
        {tab === 'plano' && (
          <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
            {[
              { k: 'abertas' as const, l: 'Em aberto', n: plano.nAbertas },
              { k: 'minhas' as const, l: 'Comigo', n: plano.nMinhas },
              { k: 'feitas' as const, l: 'Feitas', n: plano.nFeitas },
            ].map((t) => (
              <button key={t.k} type="button" onClick={() => setPlanoFiltro(t.k)} className={seg(planoFiltro === t.k)}>
                {t.l}
                <span className="font-mono text-[10.5px] text-[var(--text-3)]">{t.n}</span>
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 h-8 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] text-[var(--text-3)] focus-within:border-[var(--accent)] flex-1 min-w-[200px] max-w-[320px]">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lote, material, nota…"
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)]"
          />
          {q ? (
            <button type="button" onClick={() => setQ('')} className="hover:text-[var(--text)]">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1">/</kbd>
          )}
        </label>
        <select
          value={prio}
          onChange={(e) => setPrio(e.target.value as any)}
          className="h-8 px-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[12.5px] text-[var(--text-2)] outline-none"
        >
          <option value="all">Todas as prioridades</option>
          {PRIO.slice().reverse().map((p) => (
            <option key={p.k} value={p.k}>
              {p.l}
            </option>
          ))}
        </select>
        {tab !== 'concluidos' && tab !== 'plano' && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-8 px-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[12.5px] text-[var(--text-2)] outline-none"
          >
            <option value="atencao">Mais urgentes</option>
            <option value="valor">Maior valor</option>
            <option value="parado">Mais tempo parado</option>
            <option value="recente">Mais recentes</option>
          </select>
        )}
        <span className="ml-auto text-[11px] text-[var(--text-3)] hidden lg:flex items-center gap-1.5 flex-wrap">
          <span><kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> navega</span>
          <span>·</span>
          <span><kbd className="font-mono">n</kbd> nota (<kbd className="font-mono">Enter</kbd> envia)</span>
          <span>·</span>
          <span><kbd className="font-mono">t</kbd> ação</span>
          <span>·</span>
          <span><kbd className="font-mono">r</kbd> resolve</span>
          <span>·</span>
          <span><kbd className="font-mono">1-3</kbd> status</span>
          <span>·</span>
          <span><kbd className="font-mono">p</kbd> prioridade</span>
          <span>·</span>
          <span><kbd className="font-mono">x</kbd> excluir</span>
          <span>·</span>
          <span><kbd className="font-mono">a</kbd> novo</span>
        </span>
      </div>

      {/* ---------- Lista + detalhe ---------- */}
      <div className={cn('grid gap-6', sel && 'xl:grid-cols-[minmax(0,1fr)_440px]')}>
        <section className="min-w-0">
          {tab === 'plano' ? (
            /* ---------- Plano de ação ---------- */
            <div className="border-t border-[var(--border-strong)]">
              {planoFiltro !== 'feitas' && plano.semPlano > 0 && (
                <p className="flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--text-3)] border-b border-[var(--border)]">
                  <Dot c="var(--amber)" />
                  {plano.semPlano} lote(s) em aberto sem próximo passo definido · abra o lote e use <kbd className="font-mono">t</kbd> para adicionar
                </p>
              )}
              {plano.groups.every((g) => g.items.length === 0) ? (
                <div className="py-16 text-center">
                  <p className="text-[13px] text-[var(--text-2)]">
                    {planoFiltro === 'feitas'
                      ? 'Nenhuma ação concluída ainda.'
                      : planoFiltro === 'minhas'
                      ? 'Nenhuma ação atribuída a você.'
                      : 'Nenhuma ação planejada. Selecione um lote e defina os próximos passos.'}
                  </p>
                </div>
              ) : (
                plano.groups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <div key={g.k}>
                      <div className="flex items-center gap-2 h-8 px-3 text-[11.5px] text-[var(--text-3)] border-b border-[var(--border)] bg-[var(--surface-2)]">
                        <Dot c={g.c} />
                        <span className="font-medium text-[var(--text-2)]">{g.l}</span>
                        <span className="font-mono">{g.items.length}</span>
                      </div>
                      {g.items.map(({ a, r }) => {
                        const on = selKey === r.key;
                        const tone = prazoTone(a);
                        return (
                          <div
                            key={`${r.key}-${a.id}`}
                            className={cn(
                              'group grid grid-cols-[18px_minmax(0,1fr)_auto] md:grid-cols-[18px_minmax(0,1fr)_140px_80px_20px] gap-x-3 items-center px-3 py-2 border-b border-[var(--border)]',
                              on ? 'bg-[var(--accent-weak)]' : 'hover:bg-[var(--surface-2)]'
                            )}
                          >
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => toggleAcao(r, a.id)}
                              title={a.feito ? 'Marcar como pendente' : 'Marcar como feita'}
                              className={cn(
                                'h-[16px] w-[16px] rounded-[4px] border grid place-items-center',
                                a.feito ? 'bg-[var(--green)] border-[var(--green)] text-[var(--bg)]' : 'border-[var(--text-3)] hover:border-[var(--text)]'
                              )}
                            >
                              {a.feito && <Check className="h-3 w-3" strokeWidth={3} />}
                            </button>
                            <button type="button" onClick={() => setSelKey(on ? null : r.key)} className="min-w-0 text-left">
                              <span className={cn('block text-[13px] truncate', a.feito && 'line-through text-[var(--text-3)]')}>{a.texto}</span>
                              <span className="block text-[11.5px] text-[var(--text-3)] truncate">
                                <span className="font-mono text-[var(--text-2)]">{r.lote}</span> · {clean(r.texto_breve_material) || getMaterialDescription(r.material) || r.material}
                                <span className="md:hidden"> · {prazoFmt(a.prazo)}</span>
                              </span>
                            </button>
                            <span className="hidden md:block text-[12px] text-[var(--text-2)] truncate">{a.responsavel || <span className="text-[var(--text-3)]">—</span>}</span>
                            <span className="hidden md:block text-right font-mono text-[12px] whitespace-nowrap" style={{ color: tone || 'var(--text-3)' }}>
                              {a.feito ? ago(days(a.feito_em)) : prazoFmt(a.prazo)}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeAcao(r, a.id)}
                              className="hidden md:grid place-items-center text-[var(--text-3)] opacity-0 group-hover:opacity-100 hover:text-[var(--red)]"
                              title="Remover ação"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))
              )}
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center border-t border-[var(--border-strong)]">
              <p className="text-[13px] text-[var(--text-2)]">{emptyText}</p>
              {tab === 'atencao' && stats.open > 0 && (
                <button type="button" onClick={() => setTab('abertos')} className="mt-2 text-[12.5px] font-medium text-[var(--accent)]">
                  Ver os {stats.open} abertos
                </button>
              )}
            </div>
          ) : (
            <div className="border-t border-[var(--border-strong)]">
              <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_150px_96px_86px_14px] gap-4 h-8 items-center px-3 text-[11.5px] text-[var(--text-3)] border-b border-[var(--border)]">
                <span>Lote · material</span>
                <span>{tab === 'concluidos' ? 'Desfecho' : 'O que mudou'}</span>
                <span className="text-right">Saldo: registro → agora</span>
                <span className="text-right">Valor</span>
                <span className="text-right">{tab === 'concluidos' ? 'Resolvido' : 'Última ação'}</span>
                <span />
              </div>
              {list.map((r) => {
                const st = statusMeta(r.status);
                const done = r.status === 'concluido';
                const top = r.reasons[0];
                const on = selKey === r.key;
                return (
                  <button
                    key={r.key}
                    id={`todo-${r.key}`}
                    type="button"
                    onClick={() => setSelKey(on ? null : r.key)}
                    className={cn(
                      'relative w-full text-left grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_150px_96px_86px_14px] gap-x-4 gap-y-1 items-center px-3 py-2.5 border-b border-[var(--border)]',
                      on ? 'bg-[var(--accent-weak)]' : 'hover:bg-[var(--surface-2)]',
                      done && !on && 'opacity-70'
                    )}
                  >
                    {top && <span className="absolute left-0 top-3 w-[3px] h-4 rounded-sm" style={{ background: TONE[top.tone] }} />}

                    {/* Lote · material */}
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[13.5px] font-semibold">{r.lote}</span>
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-3)] whitespace-nowrap">
                          <Dot c={st.c} /> {st.l}
                        </span>
                        {(r.prioridade === 'critica' || r.prioridade === 'alta') && !done && (
                          <span
                            className="text-[10.5px] font-medium border border-[var(--border-strong)] rounded px-1 leading-4"
                            style={{ color: r.prioridade === 'critica' ? 'var(--red)' : 'var(--amber)' }}
                          >
                            {prioMeta(r.prioridade).l}
                          </span>
                        )}
                        {(r.acoes || []).length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-3)]"
                            style={{ color: (r.acoes || []).every((a) => a.feito) ? 'var(--green)' : undefined }}
                            title="Ações do plano feitas / total"
                          >
                            <ListChecks className="h-3 w-3" />
                            <span className="font-mono">
                              {(r.acoes || []).filter((a) => a.feito).length}/{(r.acoes || []).length}
                            </span>
                          </span>
                        )}
                      </span>
                      <span className="block text-[12px] text-[var(--text-3)] truncate">
                        <span className="font-mono text-[var(--text-2)]">{r.material}</span> · {clean(r.texto_breve_material) || getMaterialDescription(r.material) || 'sem descrição'}
                      </span>
                    </span>

                    {/* O que mudou */}
                    <span className="min-w-0 max-md:col-span-2 max-md:order-last">
                      {done ? (
                        <span className="block text-[12.5px] text-[var(--text-2)] truncate">{r.desfecho || 'Sem desfecho informado'}</span>
                      ) : r.reasons.length ? (
                        <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {r.reasons.slice(0, 2).map((x) => (
                            <span key={x.k} className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: x.tone === 'muted' ? undefined : TONE[x.tone] }}>
                              <Dot c={TONE[x.tone]} /> {x.text}
                            </span>
                          ))}
                          {r.reasons.length > 2 && <span className="text-[11.5px] text-[var(--text-3)]">+{r.reasons.length - 2}</span>}
                        </span>
                      ) : (
                        <span className="block text-[12.5px] text-[var(--text-3)] truncate">
                          {r.notas.length ? `“${r.notas[r.notas.length - 1].texto}”` : r.motivo_inicial || 'Estável'}
                        </span>
                      )}
                    </span>

                    {/* Saldo */}
                    <span className="hidden md:block text-right font-mono text-[12.5px] whitespace-nowrap">
                      <span className="text-[var(--text-3)]">{qf(r.quantidade_inicial)}</span>
                      <span className="text-[var(--text-3)] mx-1">→</span>
                      <span style={{ color: !r.localizado_no_estoque ? 'var(--red)' : Math.abs(r.diff_quantidade) > 0.001 ? 'var(--amber)' : undefined }}>
                        {qf(r.estoque_atual || 0)}
                      </span>
                      <span className="text-[11px] text-[var(--text-3)] ml-1">{r.unidade_medida}</span>
                    </span>

                    {/* Valor */}
                    <span className="text-right font-mono text-[12.5px] whitespace-nowrap">{brlK(r.valorRef)}</span>

                    {/* Atividade */}
                    <span className="hidden md:block text-right text-[12px] text-[var(--text-3)] whitespace-nowrap">
                      {done ? ago(days(r.resolvido_em || r.updated_at)) : <span style={{ color: r.diasSemAtividade >= DIAS_PARADO ? 'var(--amber)' : undefined }}>{ago(r.diasSemAtividade)}</span>}
                    </span>
                    <ChevronRight className={cn('hidden md:block h-3.5 w-3.5 text-[var(--text-3)] transition-transform', on && 'rotate-90 xl:rotate-0')} />
                  </button>
                );
              })}
              <p className="px-3 pt-2 text-[11.5px] text-[var(--text-3)]">
                {list.length} lote(s) · {brl(list.reduce((s, r) => s + r.valorRef, 0))}
              </p>
            </div>
          )}
        </section>

        {/* ---------- Detalhe ---------- */}
        {sel && (
          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto max-xl:fixed max-xl:inset-0 max-xl:z-40 max-xl:bg-[var(--bg)] max-xl:overflow-y-auto max-xl:p-4 xl:border-l xl:border-[var(--border)] xl:pl-6">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button type="button" onClick={() => copyToClipboard(sel.lote).then(() => toast.success('Lote copiado'))} className="group text-left" title="Copiar lote">
                  <span className="font-mono text-[22px] font-semibold tracking-tight">{sel.lote}</span>
                  <Copy className="inline h-3.5 w-3.5 ml-2 text-[var(--text-3)] opacity-60 group-hover:opacity-100" />
                </button>
                <p className="text-[12.5px] text-[var(--text-2)]">
                  <span className="font-mono text-[var(--text)]">{sel.material}</span> · {clean(sel.texto_breve_material) || getMaterialDescription(sel.material) || 'sem descrição'}
                </p>
              </div>
              <button type="button" onClick={() => setSelKey(null)} className="h-8 w-8 grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)]" title="Fechar (Esc)">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status e prioridade */}
            {sel.status !== 'concluido' ? (
              <div className="mt-4 space-y-2.5">
                <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
                  {STATUS.slice(0, 3).map((s) => (
                    <button key={s.k} type="button" disabled={busy} onClick={() => setStatus(sel, s.k)} className={cn(seg(sel.status === s.k), 'flex-1 justify-center')}>
                      <Dot c={s.c} /> {s.l}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[var(--text-3)]">
                  Prioridade
                  <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
                    {PRIO.map((p) => (
                      <button key={p.k} type="button" disabled={busy} onClick={() => setPriority(sel, p.k)} className={cn(seg(sel.prioridade === p.k), 'h-[26px] px-2.5')}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[12.5px] text-[var(--text-2)] flex items-start gap-2">
                <Dot c="var(--green)" className="mt-[6px]" />
                <span>
                  Resolvido por <b className="font-medium text-[var(--text)]">{sel.resolvido_por_name || 'operador'}</b> em {dt(sel.resolvido_em)}
                  {sel.desfecho && <span className="block text-[var(--text)] mt-1">{sel.desfecho}</span>}
                </span>
              </p>
            )}

            {/* Motivos de atenção */}
            {sel.reasons.length > 0 && (
              <ul className="mt-4 border-t border-[var(--border)]">
                {sel.reasons.map((x) => (
                  <li key={x.k} className="flex items-start gap-2 py-2 border-b border-[var(--border)] text-[12.5px]">
                    <Dot c={TONE[x.tone]} className="mt-[6px]" />
                    <span className="flex-1">{x.text}</span>
                    {x.k === 'saiu' && (
                      <button type="button" onClick={() => { setResolving(sel); setDesfecho(''); }} className="text-[12px] font-medium text-[var(--accent)]">
                        Resolver
                      </button>
                    )}
                    {(x.k === 'nota' || x.k === 'parado') && (
                      <button type="button" onClick={() => noteRef.current?.focus()} className="text-[12px] font-medium text-[var(--accent)]">
                        Anotar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Registro x agora */}
            <table className="w-full mt-4 text-[12.5px] border-separate border-spacing-0">
              <thead>
                <tr className="text-[11.5px] text-[var(--text-3)]">
                  <th className="h-7 text-left font-medium border-b border-[var(--border)]" />
                  <th className="h-7 text-right font-medium border-b border-[var(--border)]">No registro</th>
                  <th className="h-7 text-right font-medium border-b border-[var(--border)]">Agora</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  ['Saldo', `${qf(sel.quantidade_inicial)} ${sel.unidade_medida}`, sel.localizado_no_estoque ? `${qf(sel.estoque_atual || 0)} ${sel.unidade_medida}` : 'fora do estoque', Math.abs(sel.diff_quantidade) > 0.001 || !sel.localizado_no_estoque],
                  ['Valor', brl(sel.valor_total_inicial), brl(sel.valor_total_atual || 0), Math.abs(sel.diff_valor) > 0.01],
                  ['Posição', `${sel.posicao_deposito_inicial || '—'} · ${sel.deposito_inicial || '—'}`, sel.localizado_no_estoque ? `${sel.posicao_atual || '—'} · ${sel.deposito_atual || '—'}` : '—', sel.diff_status === 'posicao_alterada'],
                  ['Aging', `${sel.dias_aging_inicial ?? 0} d`, sel.dias_aging_atual !== undefined ? `${sel.dias_aging_atual} d` : '—', false],
                ].map(([l, a, b, ch]) => (
                  <tr key={l as string}>
                    <td className="h-8 border-b border-[var(--border)] font-sans text-[var(--text-3)]">{l}</td>
                    <td className="h-8 border-b border-[var(--border)] text-right text-[var(--text-3)]">{a}</td>
                    <td className="h-8 border-b border-[var(--border)] text-right" style={{ color: ch ? (sel.localizado_no_estoque ? 'var(--amber)' : 'var(--red)') : undefined }}>
                      {b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sel.data_vencimento && <p className="mt-1.5 text-[11.5px] text-[var(--text-3)]">Validade <span className="font-mono">{sel.data_vencimento}</span></p>}

            {/* Plano de ação */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-1.5">
                <b className="text-[12px] font-semibold text-[var(--text-2)]">Plano de ação</b>
                {(sel.acoes || []).length > 0 && (
                  <span className="font-mono text-[11px] text-[var(--text-3)]">
                    {(sel.acoes || []).filter((a) => a.feito).length}/{(sel.acoes || []).length}
                  </span>
                )}
                {(sel.acoes || []).length > 0 && (
                  <span className="flex-1 h-[3px] rounded-full bg-[var(--border)] overflow-hidden max-w-[120px]">
                    <span
                      className="block h-full bg-[var(--green)] transition-all"
                      style={{ width: `${((sel.acoes || []).filter((a) => a.feito).length / (sel.acoes || []).length) * 100}%` }}
                    />
                  </span>
                )}
              </div>
              {(sel.acoes || []).length === 0 && sel.status === 'concluido' && (
                <p className="text-[12px] text-[var(--text-3)]">Nenhuma ação registrada.</p>
              )}
              {(sel.acoes || []).length > 0 && (
                <ul className="border-t border-[var(--border)]">
                  {(sel.acoes || [])
                    .slice()
                    .sort((a, b) => Number(a.feito) - Number(b.feito) || (a.prazo || '9999').localeCompare(b.prazo || '9999'))
                    .map((a) => {
                      const tone = prazoTone(a);
                      return (
                        <li key={a.id} className="group flex items-start gap-2.5 py-2 border-b border-[var(--border)]">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleAcao(sel, a.id)}
                            title={a.feito ? 'Marcar como pendente' : 'Marcar como feita'}
                            className={cn(
                              'mt-[2px] h-[15px] w-[15px] shrink-0 rounded-[4px] border grid place-items-center',
                              a.feito ? 'bg-[var(--green)] border-[var(--green)] text-[var(--bg)]' : 'border-[var(--text-3)] hover:border-[var(--text)]'
                            )}
                          >
                            {a.feito && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                          </button>
                          <span className="flex-1 min-w-0">
                            <span className={cn('block text-[12.5px] leading-snug', a.feito && 'line-through text-[var(--text-3)]')}>{a.texto}</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
                              <span className="font-mono" style={{ color: tone }}>
                                {a.feito ? `feito ${ago(days(a.feito_em))}` : prazoFmt(a.prazo)}
                              </span>
                              {a.responsavel && <span>· {a.responsavel}</span>}
                            </span>
                          </span>
                          {sel.status !== 'concluido' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeAcao(sel, a.id)}
                              className="opacity-0 group-hover:opacity-100 text-[var(--text-3)] hover:text-[var(--red)]"
                              title="Remover ação"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
              {sel.status !== 'concluido' && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <input
                    ref={acaoRef}
                    value={acaoTexto}
                    onChange={(e) => setAcaoTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAcao(sel);
                      }
                    }}
                    placeholder="Próximo passo… (Enter adiciona)"
                    className="h-8 w-full px-2.5 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[12.5px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]"
                  />
                  {(acaoTexto || acaoPrazo || acaoResp) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { l: 'Hoje', v: todayISO() },
                        { l: 'Amanhã', v: addDaysISO(1) },
                        { l: '+3 d', v: addDaysISO(3) },
                        { l: '+7 d', v: addDaysISO(7) },
                      ].map((p) => (
                        <button
                          key={p.l}
                          type="button"
                          onClick={() => setAcaoPrazo(acaoPrazo === p.v ? '' : p.v)}
                          className={cn(
                            'h-6 px-2 rounded-full border text-[11px]',
                            acaoPrazo === p.v ? 'border-[var(--text-3)] bg-[var(--hover)] text-[var(--text)]' : 'border-[var(--border-strong)] text-[var(--text-3)] hover:text-[var(--text)]'
                          )}
                        >
                          {p.l}
                        </button>
                      ))}
                      <input
                        type="date"
                        value={acaoPrazo}
                        onChange={(e) => setAcaoPrazo(e.target.value)}
                        className="h-6 px-1.5 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[11px] text-[var(--text-2)] outline-none focus:border-[var(--accent)]"
                      />
                      <input
                        value={acaoResp}
                        onChange={(e) => setAcaoResp(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addAcao(sel);
                          }
                        }}
                        placeholder="Responsável"
                        className="h-6 flex-1 min-w-[90px] px-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[11px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]"
                      />
                      <button type="button" onClick={() => addAcao(sel)} disabled={!acaoTexto.trim() || busy} className={cn(btn, 'h-6 px-2 text-[11px]')}>
                        <Plus className="h-3 w-3" /> Adicionar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Histórico */}
            <div className="mt-5">
              <b className="block text-[12px] font-semibold text-[var(--text-2)] mb-2">Histórico</b>
              <ol className="relative pl-5 before:absolute before:left-[3px] before:top-1 before:bottom-1 before:w-px before:bg-[var(--border-strong)]">
                <li className="relative pb-3">
                  <span className="absolute -left-5 top-[5px] w-[7px] h-[7px] rounded-full bg-[var(--surface)] border border-[var(--text-3)]" />
                  <span className="block text-[12.5px]">
                    Aberto por <b className="font-medium">{sel.created_by_name || 'operador'}</b>
                    {sel.motivo_inicial && <span className="text-[var(--text-2)]"> · {sel.motivo_inicial}</span>}
                  </span>
                  <span className="block text-[11px] font-mono text-[var(--text-3)]">{dt(sel.created_at)}</span>
                </li>
                {sel.notas
                  .slice()
                  .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
                  .map((n) => (
                    <li key={n.id} className="relative pb-3 group">
                      <span className="absolute -left-5 top-[5px] w-[7px] h-[7px] rounded-full bg-[var(--text-2)]" />
                      <span className="block text-[12.5px] whitespace-pre-wrap leading-relaxed">{n.texto}</span>
                      <span className="flex items-center gap-2 text-[11px] text-[var(--text-3)]">
                        <span className="font-mono">{dt(n.created_at)}</span> · {n.created_by_name || 'operador'}
                        {sel.status !== 'concluido' && !sel.id.startsWith('inv-') && (
                          <button
                            type="button"
                            onClick={() => run(() => deletePesagemTodoNote(sel.id, sel.notas, n.id), 'Nota removida', 'Não foi possível remover')}
                            className="opacity-0 group-hover:opacity-100 hover:text-[var(--red)]"
                          >
                            remover
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                {sel.status === 'concluido' && (
                  <li className="relative">
                    <span className="absolute -left-5 top-[5px] w-[7px] h-[7px] rounded-full bg-[var(--green)]" />
                    <span className="block text-[12.5px]">Resolvido{sel.desfecho ? ` · ${sel.desfecho}` : ''}</span>
                    <span className="block text-[11px] font-mono text-[var(--text-3)]">{dt(sel.resolvido_em)}</span>
                  </li>
                )}
              </ol>
            </div>

            {/* Nova nota */}
            {sel.status !== 'concluido' && (
              <div className="mt-2">
                <textarea
                  ref={noteRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      saveNote(sel);
                    }
                  }}
                  rows={3}
                  placeholder="O que foi verificado, com quem falou, próximo passo…"
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] resize-y"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-[var(--text-3)]">
                    <kbd className="font-mono">Enter</kbd> envia · <kbd className="font-mono">Shift+Enter</kbd> linha · <kbd className="font-mono">Esc</kbd> sai
                  </span>
                  <button type="button" onClick={() => saveNote(sel)} disabled={!note.trim() || busy} className={btn}>
                    Salvar nota
                  </button>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-2 flex-wrap mt-5 pt-4 border-t border-[var(--border)]">
              {sel.status !== 'concluido' ? (
                <button type="button" onClick={() => { setResolving(sel); setDesfecho(''); }} disabled={busy} className={primary}>
                  Resolver
                </button>
              ) : (
                <button type="button" onClick={() => reopen(sel)} disabled={busy} className={btn}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                </button>
              )}
              {onNavigateToMaterial && (
                <button type="button" onClick={() => onNavigateToMaterial(sel.material)} className={btn}>
                  <ArrowUpRight className="h-3.5 w-3.5" /> Ver no estoque
                </button>
              )}
              <button type="button" onClick={() => remove(sel)} disabled={busy} className="ml-auto h-8 px-2 text-[12.5px] text-[var(--text-3)] hover:text-[var(--red)] inline-flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ---------- Resolver ---------- */}
      <Dialog open={!!resolving} onOpenChange={(o) => !o && !busy && setResolving(null)}>
        <DialogContent className="sm:max-w-md bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px]">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] text-left">
            <DialogTitle className="text-[15px] font-semibold">Resolver lote {resolving?.lote}</DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--text-3)]">
              {resolving?.material} · {clean(resolving?.texto_breve_material) || getMaterialDescription(resolving?.material)} · sai da lista de pendências e fica no histórico
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            {resolving && !resolving.localizado_no_estoque && (
              <p className="mb-3 text-[12.5px] text-[var(--text-2)] flex gap-2">
                <Dot c="var(--amber)" className="mt-[6px]" />O lote não tem mais saldo no estoque.
              </p>
            )}
            <label className="block text-[12px] text-[var(--text-3)] mb-1.5">Desfecho</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DESFECHOS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDesfecho(d)}
                  className={cn(
                    'h-7 px-2.5 rounded-full border text-[12px]',
                    desfecho === d ? 'border-[var(--text-3)] bg-[var(--hover)] text-[var(--text)]' : 'border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)]'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <textarea
              value={desfecho}
              onChange={(e) => setDesfecho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  confirmResolve();
                }
              }}
              rows={3}
              autoFocus
              placeholder="Ex.: transferido via MIGO 311, saldo conferido fisicamente na área"
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
            <button type="button" onClick={() => setResolving(null)} disabled={busy} className={cn(btn, 'h-9')}>
              Cancelar
            </button>
            <button type="button" onClick={confirmResolve} disabled={busy} className={cn(primary, 'h-9')}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Resolver
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Novo acompanhamento ---------- */}
      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        estoqueMap={estoqueMap}
        agingData={agingData}
        priceOf={priceOf}
        existing={new Set(rows.filter((r) => r.status !== 'concluido').map((r) => r.key))}
        onCreated={(lote) => {
          setTab('abertos');
          setSelKey(up(lote));
        }}
      />
    </div>
  );
}

/* ============================================================================
 * Modal de criação: o lote preenche o resto a partir do estoque
 * ========================================================================== */
function CreateDialog({
  open,
  onClose,
  estoqueMap,
  agingData,
  priceOf,
  existing,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  estoqueMap: Map<string, AgingData>;
  agingData: AgingData[];
  priceOf: (m: string) => number;
  existing: Set<string>;
  onCreated: (lote: string) => void;
}) {
  const [lote, setLote] = useState('');
  const [material, setMaterial] = useState('');
  const [desc, setDesc] = useState('');
  const [qtd, setQtd] = useState('');
  const [posicao, setPosicao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [prioridade, setPrioridade] = useState<PesagemTodoPriority>('media');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLote(''); setMaterial(''); setDesc(''); setQtd(''); setPosicao(''); setMotivo(''); setPrioridade('media'); setNota('');
    }
  }, [open]);

  const found = estoqueMap.get(up(lote));
  const dup = !!lote.trim() && existing.has(up(lote));

  const onLote = (v: string) => {
    setLote(v);
    const f = estoqueMap.get(up(v));
    if (f) {
      setMaterial(f.material);
      setDesc(f.texto_breve_material || getMaterialDescription(f.material));
      setQtd(String(f.estoque_disponivel ?? ''));
      setPosicao(f.posicao_deposito || '');
    }
  };
  const onMaterial = (v: string) => {
    setMaterial(v);
    if (!desc) {
      const f = agingData.find((x) => x.material === v.trim());
      setDesc(f?.texto_breve_material || getMaterialDescription(v.trim()));
    }
  };

  const q = parseFloat(String(qtd).replace(/\./g, '').replace(',', '.')) || 0;
  const vu = priceOf(material.trim());

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!material.trim() || !lote.trim()) return toast.error('Informe lote e material');
    if (dup) return toast.error('Esse lote já está em acompanhamento');
    setSaving(true);
    try {
      await createPesagemTodo({
        material: material.trim(),
        texto_breve_material: desc.trim() || getMaterialDescription(material.trim()),
        lote: lote.trim(),
        quantidade: q,
        unidade_medida: found?.unidade_medida || 'KG',
        deposito: found?.deposito || 'PES',
        tipo_deposito: found?.tipo_deposito,
        posicao_deposito: posicao,
        valor_unitario: vu,
        valor_total: q * vu,
        dias_aging: found?.dias_aging,
        data_vencimento: found?.data_vencimento,
        motivo_inicial: motivo.trim() || 'Acompanhamento manual',
        prioridade,
        nota_inicial: nota.trim(),
      });
      toast.success(`Lote ${lote.trim()} em acompanhamento`);
      onCreated(lote.trim());
      onClose();
    } catch {
      toast.error('Não foi possível criar o acompanhamento');
    } finally {
      setSaving(false);
    }
  };

  const field = 'h-9 w-full px-2.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]';
  const label = 'block text-[12px] text-[var(--text-3)] mb-1';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px]">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] text-left">
          <DialogTitle className="text-[15px] font-semibold">Acompanhar lote</DialogTitle>
          <DialogDescription className="text-[12.5px] text-[var(--text-3)]">
            Informe o lote: material, saldo e posição vêm do estoque atual.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Lote</label>
              <input autoFocus value={lote} onChange={(e) => onLote(e.target.value)} placeholder="Ex.: M5Q3116-1" className={cn(field, 'font-mono', dup && 'border-[var(--red)]')} />
              <p className="mt-1 text-[11.5px]" style={{ color: dup ? 'var(--red)' : found ? 'var(--green)' : 'var(--text-3)' }}>
                {dup
                  ? 'Já está em acompanhamento.'
                  : found
                  ? `Encontrado · ${qf(Number(found.estoque_disponivel) || 0)} ${found.unidade_medida || 'KG'} em ${found.posicao_deposito || found.deposito || '—'} · ${found.dias_aging ?? 0} d`
                  : lote.trim()
                  ? 'Fora do estoque atual · preencha manualmente'
                  : ' '}
              </p>
            </div>
            <div>
              <label className={label}>Material</label>
              <input value={material} onChange={(e) => onMaterial(e.target.value)} className={cn(field, 'font-mono')} />
            </div>
            <div>
              <label className={label}>Quantidade</label>
              <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" className={cn(field, 'font-mono text-right')} />
            </div>
            <div className="col-span-2">
              <label className={label}>Descrição</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} className={field} />
            </div>
            <div className="col-span-2">
              <label className={label}>Motivo</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: divergência de pesagem, saldo sem físico" className={field} />
            </div>
            <div className="col-span-2">
              <label className={label}>Prioridade</label>
              <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden">
                {PRIO.map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => setPrioridade(p.k)}
                    className={cn('flex-1 h-9 text-[12.5px] border-r border-[var(--border-strong)] last:border-r-0', prioridade === p.k ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)]')}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className={label}>Primeira nota (opcional)</label>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className={cn(field, 'h-auto py-2')} />
            </div>
            {vu > 0 && q > 0 && (
              <p className="col-span-2 text-[12px] text-[var(--text-3)]">
                Valor no registro: <span className="font-mono text-[var(--text-2)]">{brl(q * vu)}</span>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] text-[12.5px] text-[var(--text-2)] hover:text-[var(--text)]">
              Cancelar
            </button>
            <button type="submit" disabled={saving || dup || !lote.trim() || !material.trim()} className="h-9 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Acompanhar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
