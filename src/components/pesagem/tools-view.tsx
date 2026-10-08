'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { AgingData, ListaTecnicaItem } from '@/types/aging';
import { Search, Plus, Trash2, Copy, X, Loader2, ChevronRight, ListTree, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchListaTecnica } from '@/lib/dashpesagem-api';
import { cn, copyToClipboard } from '@/lib/utils';

/* ============================================================================
 * Helpers
 * ========================================================================== */

interface ToolsViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
}

interface SimulatedItem {
  id: string;
  material: string;
  descricao: string;
  unidade: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
}

type MatInfo = { descricao: string; unidade: string; estoquePES: number; lotesPES: number; estoqueTotal: number };

/** Aceita '1.250,50', '150,5', '1250.50', '1,250.50', 'R$ 24,50' */
function parseFlexibleNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  let s = String(input).trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot && (s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const r = parseFloat(s);
  return isNaN(r) ? 0 : r;
}

const formatForInput = (v: number) =>
  !v || isNaN(v) ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false });
const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qf = (v: number, max = 3) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: max });
const pad6 = (m: string) => String(m ?? '').trim().replace(/\D/g, '').padStart(6, '0');
const strip0 = (m: string) => String(m ?? '').replace(/^0+/, '');

/* ============================================================================
 * Componente
 * ========================================================================== */

type Tool = 'valorizar' | 'bom';

export function ToolsView({ agingData, valores }: ToolsViewProps) {
  const [tool, setTool] = useState<Tool>('valorizar');

  // Valorizar
  const [materialInput, setMaterialInput] = useState('');
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [simulatedItems, setSimulatedItems] = useState<SimulatedItem[]>([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugIdx, setSugIdx] = useState(0);
  const qtyRef = useRef<HTMLInputElement>(null);

  // Lista técnica
  const [ltSearchInput, setLtSearchInput] = useState('');
  const [ltLoading, setLtLoading] = useState(false);
  const [ltResults, setLtResults] = useState<ListaTecnicaItem[]>([]);
  const [ltMode, setLtMode] = useState<'mp' | 'semi'>('mp');
  const [ltSearched, setLtSearched] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  /* ---------------- base ---------------- */
  const materialInfoMap = useMemo(() => {
    const map: Record<string, MatInfo> = {};
    agingData.forEach((item) => {
      const mat = pad6(item.material);
      if (!map[mat]) {
        map[mat] = { descricao: item.texto_breve_material || '', unidade: item.unidade_medida || 'KG', estoquePES: 0, lotesPES: 0, estoqueTotal: 0 };
      }
      const qty = Number(item.estoque_disponivel || 0);
      map[mat].estoqueTotal += qty;
      if (String(item.deposito || '').trim().toUpperCase() === 'PES') {
        map[mat].estoquePES += qty;
        map[mat].lotesPES += 1;
      }
    });
    return map;
  }, [agingData]);

  const priceOf = (mat: string) => {
    const m = pad6(mat);
    return valores[m] ?? valores[strip0(m)] ?? 0;
  };
  const infoOf = (mat: string): MatInfo | undefined => materialInfoMap[pad6(mat)];

  const precosCount = Object.keys(valores).length;
  const pesMaterials = useMemo(() => Object.values(materialInfoMap).filter((i) => i.estoquePES > 0).length, [materialInfoMap]);
  const semPreco = useMemo(
    () => Object.keys(materialInfoMap).filter((m) => materialInfoMap[m].estoquePES > 0 && !priceOf(m)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materialInfoMap, valores]
  );

  /* ============================================================================
   * Valorizar MP
   * ========================================================================== */
  const normalizedMaterial = useMemo(() => {
    const clean = materialInput.trim().replace(/\D/g, '');
    return clean ? clean.padStart(6, '0') : '';
  }, [materialInput]);

  const suggestions = useMemo(() => {
    const q = materialInput.trim().toLowerCase();
    if (q.length < 2) return [];
    const all = Array.from(new Set([...Object.keys(materialInfoMap), ...Object.keys(valores).map(pad6)]));
    const qd = q.replace(/\D/g, '');
    return all
      .map((mat) => {
        const desc = materialInfoMap[mat]?.descricao || '';
        const codeHit = qd && (mat.includes(qd) || strip0(mat).startsWith(qd));
        const descHit = desc.toLowerCase().includes(q);
        if (!codeHit && !descHit) return null;
        return {
          material: mat,
          descricao: desc,
          valor: priceOf(mat),
          estoquePES: materialInfoMap[mat]?.estoquePES || 0,
          unidade: materialInfoMap[mat]?.unidade || 'KG',
          score: (codeHit && strip0(mat).startsWith(qd) ? 0 : 1) + (materialInfoMap[mat]?.estoquePES ? 0 : 0.5),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score - b!.score)
      .slice(0, 8) as { material: string; descricao: string; valor: number; estoquePES: number; unidade: string }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialInput, valores, materialInfoMap]);

  const registeredUnitValue = normalizedMaterial ? priceOf(normalizedMaterial) : 0;
  const customPrice = parseFlexibleNumber(customPriceInput);
  const effectiveUnitValue = customPrice > 0 ? customPrice : registeredUnitValue;
  const usingCustom = customPrice > 0;
  const info = normalizedMaterial ? infoOf(normalizedMaterial) : undefined;
  const unidade = info?.unidade || 'KG';
  const parsedQuantity = parseFlexibleNumber(quantidadeInput);
  const calculatedTotal = parsedQuantity * effectiveUnitValue;
  const pesTotalValue = (info?.estoquePES || 0) * effectiveUnitValue;
  const overPes = !!info && info.estoquePES > 0 && parsedQuantity > info.estoquePES + 0.0001;

  const selectMaterial = (mat: string, focusQty = true) => {
    setMaterialInput(mat);
    setCustomPriceInput('');
    setSugOpen(false);
    const i = infoOf(mat);
    setQuantidadeInput(i && i.estoquePES > 0 ? formatForInput(i.estoquePES) : '');
    if (focusQty) requestAnimationFrame(() => qtyRef.current?.select());
  };

  const addQty = (n: number) => setQuantidadeInput(formatForInput(Math.round((parsedQuantity + n) * 1000) / 1000));

  const canAdd = !!normalizedMaterial && parsedQuantity > 0 && effectiveUnitValue > 0;
  const handleAdd = () => {
    if (!normalizedMaterial) return toast.error('Informe o código do material');
    if (parsedQuantity <= 0) return toast.error('Informe uma quantidade maior que zero');
    if (effectiveUnitValue <= 0) return toast.error('Informe o valor unitário');
    setSimulatedItems((prev) => {
      const same = prev.find((p) => p.material === normalizedMaterial && p.valorUnitario === effectiveUnitValue);
      if (same) {
        // mesmo material e mesmo preço: soma na linha existente
        return prev.map((p) =>
          p === same ? { ...p, quantidade: p.quantidade + parsedQuantity, valorTotal: (p.quantidade + parsedQuantity) * p.valorUnitario } : p
        );
      }
      return [
        {
          id: `${normalizedMaterial}-${Date.now()}`,
          material: normalizedMaterial,
          descricao: info?.descricao || 'Matéria-prima',
          unidade,
          valorUnitario: effectiveUnitValue,
          quantidade: parsedQuantity,
          valorTotal: calculatedTotal,
        },
        ...prev,
      ];
    });
    toast.success(`${normalizedMaterial} adicionado`);
    setMaterialInput('');
    setQuantidadeInput('');
    setCustomPriceInput('');
  };

  const removeItem = (id: string) => {
    const it = simulatedItems.find((s) => s.id === id);
    setSimulatedItems((p) => p.filter((s) => s.id !== id));
    if (it) toast((t) => (
      <span className="text-[13px]">
        {it.material} removido{' '}
        <button
          className="ml-2 underline font-medium"
          onClick={() => {
            setSimulatedItems((p) => [it, ...p]);
            toast.dismiss(t.id);
          }}
        >
          Desfazer
        </button>
      </span>
    ));
  };

  const totalValue = useMemo(() => simulatedItems.reduce((a, i) => a + i.valorTotal, 0), [simulatedItems]);
  const totalsByUnit = useMemo(() => {
    const m = new Map<string, number>();
    simulatedItems.forEach((i) => m.set(i.unidade, (m.get(i.unidade) || 0) + i.quantidade));
    return Array.from(m.entries());
  }, [simulatedItems]);

  const copySummary = async (fmt: 'texto' | 'excel') => {
    if (!simulatedItems.length) return;
    const text =
      fmt === 'excel'
        ? [
            ['Material', 'Descrição', 'Quantidade', 'UMB', 'Valor unitário', 'Valor total'].join('\t'),
            ...simulatedItems.map((i) =>
              [i.material, i.descricao, qf(i.quantidade), i.unidade, qf(i.valorUnitario, 2), qf(i.valorTotal, 2)].join('\t')
            ),
            ['', 'Total', '', '', '', qf(totalValue, 2)].join('\t'),
          ].join('\n')
        : [
            '*Valorização de matérias-primas · PES*',
            ...simulatedItems.map((i) => `${i.material} · ${i.descricao}: ${qf(i.quantidade)} ${i.unidade} × ${brl(i.valorUnitario)} = ${brl(i.valorTotal)}`),
            '',
            `*Total:* ${brl(totalValue)} · ${totalsByUnit.map(([u, q]) => `${qf(q)} ${u}`).join(' + ')}`,
          ].join('\n');
    const ok = await copyToClipboard(text);
    ok ? toast.success(fmt === 'excel' ? 'Copiado para colar no Excel' : 'Resumo copiado') : toast.error('Não foi possível copiar');
  };

  /* ============================================================================
   * Lista técnica
   * ========================================================================== */
  const handleSearchListaTecnica = async (term?: string, mode?: 'mp' | 'semi') => {
    const q = (term ?? ltSearchInput).trim();
    const m = mode || ltMode;
    if (!q) {
      setLtResults([]);
      setLtSearched('');
      return;
    }
    setLtLoading(true);
    try {
      const digits = q.replace(/\D/g, '');
      let r: ListaTecnicaItem[] = [];
      if (digits) r = await fetchListaTecnica(m === 'mp' ? { materia_prima: digits } : { semi_acabado: digits });
      if (!r.length) r = await fetchListaTecnica({ search: q });
      setLtResults(r);
      setLtSearched(q);
      setOpenGroups({});
    } catch (err) {
      console.error(err);
      toast.error('Erro ao consultar a lista técnica');
    } finally {
      setLtLoading(false);
    }
  };

  // Agrupa: por MP (onde é usado) ou por semi-acabado (fórmula)
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; code: string; desc: string; rows: ListaTecnicaItem[] }>();
    ltResults.forEach((r) => {
      const code = ltMode === 'mp' ? String(r.materia_prima) : String(r.semi_acabado);
      const desc = ltMode === 'mp' ? r.descricao_materia_prima : r.descricao_semi_acabado;
      if (!map.has(code)) map.set(code, { key: code, code, desc: desc || '', rows: [] });
      map.get(code)!.rows.push(r);
    });
    return Array.from(map.values()).map((g) => {
      if (ltMode === 'mp') {
        const i = infoOf(g.code);
        const price = priceOf(g.code);
        const est = i?.estoquePES || 0;
        return { ...g, estoquePES: est, unidade: i?.unidade || g.rows[0]?.un_materia_prima || 'KG', price, value: est * price, formulaValue: 0, bottleneck: null as null | { mat: string; lotes: number } };
      }
      // Fórmula: custo por lote e quantos lotes o estoque PES cobre (gargalo)
      let formulaValue = 0;
      let bottleneck: null | { mat: string; lotes: number } = null;
      g.rows.forEach((r) => {
        const p = priceOf(r.materia_prima);
        const q = Number(r.qtd_materia_prima) || 0;
        formulaValue += q * p;
        const est = infoOf(r.materia_prima)?.estoquePES || 0;
        if (q > 0) {
          const lotes = Math.floor(est / q);
          if (!bottleneck || lotes < bottleneck.lotes) bottleneck = { mat: String(r.materia_prima), lotes };
        }
      });
      return { ...g, estoquePES: 0, unidade: 'UN', price: 0, value: 0, formulaValue, bottleneck };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ltResults, ltMode, materialInfoMap, valores]);

  const goValorizar = (mat: string) => {
    selectMaterial(pad6(mat), false);
    setTool('valorizar');
    const i = infoOf(mat);
    if (!i || i.estoquePES <= 0) toast(`${pad6(mat)} sem saldo no depósito PES`);
  };
  const goWhereUsed = (mat: string) => {
    setLtSearchInput(mat);
    setLtMode('mp');
    setTool('bom');
    handleSearchListaTecnica(mat, 'mp');
  };

  // Atalho "/" foca a busca da ferramenta ativa
  const matRef = useRef<HTMLInputElement>(null);
  const ltRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
      if (e.key === '/') {
        e.preventDefault();
        (tool === 'valorizar' ? matRef : ltRef).current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool]);

  /* ============================================================================
   * UI
   * ========================================================================== */
  const input =
    'h-10 w-full px-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]';
  const btn =
    'h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';
  const primary =
    'h-10 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[13px] font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed';
  const label = 'block text-[12px] text-[var(--text-3)] mb-1.5';

  const TABS: { k: Tool | 'soon1' | 'soon2'; l: string; soon?: boolean }[] = [
    { k: 'valorizar', l: 'Valorizar MP' },
    { k: 'bom', l: 'Lista técnica' },
    { k: 'soon1', l: 'Simulador de descarte', soon: true },
    { k: 'soon2', l: 'Conversor de densidade', soon: true },
  ];

  return (
    <div className="text-[var(--text)]">
      {/* ---------- Cabeçalho ---------- */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">Ferramentas</h2>
          <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">Valorização de estoque PES e consulta de lista técnica</p>
        </div>
        <p className="text-[12px] text-[var(--text-3)]">
          <span className="font-mono text-[var(--text-2)]">{precosCount.toLocaleString('pt-BR')}</span> preços cadastrados ·{' '}
          <span className="font-mono text-[var(--text-2)]">{pesMaterials}</span> materiais com saldo em PES
          {semPreco > 0 && (
            <>
              {' '}· <span className="text-[var(--amber)]"><span className="font-mono">{semPreco}</span> sem preço</span>
            </>
          )}
        </p>
      </div>

      {/* ---------- Abas ---------- */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-5 overflow-x-auto">
        {TABS.map((t) => {
          const on = t.k === tool;
          return (
            <button
              key={t.k}
              type="button"
              disabled={t.soon}
              onClick={() => !t.soon && setTool(t.k as Tool)}
              className={cn(
                'relative h-9 px-3 text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-1.5',
                on ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]',
                t.soon && 'cursor-default hover:text-[var(--text-3)] opacity-60'
              )}
            >
              {t.l}
              {t.soon && <span className="text-[10.5px] border border-[var(--border-strong)] rounded px-1 leading-4">em breve</span>}
              {t.k === 'valorizar' && simulatedItems.length > 0 && <span className="font-mono text-[11px] text-[var(--text-3)]">{simulatedItems.length}</span>}
              {on && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-[var(--text)]" />}
            </button>
          );
        })}
      </div>

      {/* ======================================================================
       * VALORIZAR MP
       * ==================================================================== */}
      {tool === 'valorizar' && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Formulário */}
          <section>
            <div className="relative">
              <label className={label} htmlFor="mat">Material</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] pointer-events-none" />
                <input
                  id="mat"
                  ref={matRef}
                  value={materialInput}
                  onChange={(e) => {
                    setMaterialInput(e.target.value);
                    setSugOpen(true);
                    setSugIdx(0);
                    setCustomPriceInput('');
                  }}
                  onFocus={() => setSugOpen(true)}
                  onBlur={() => setTimeout(() => setSugOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (!sugOpen || !suggestions.length) {
                      if (e.key === 'Enter' && normalizedMaterial) selectMaterial(normalizedMaterial);
                      return;
                    }
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSugIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSugIdx((i) => Math.max(i - 1, 0)); }
                    if (e.key === 'Enter') { e.preventDefault(); selectMaterial(suggestions[sugIdx].material); }
                    if (e.key === 'Escape') setSugOpen(false);
                  }}
                  placeholder="Código ou descrição"
                  autoComplete="off"
                  className={cn(input, 'pl-9 font-mono')}
                />
              </div>
              {sugOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] shadow-lg py-1 max-h-72 overflow-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.material}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectMaterial(s.material); }}
                      onMouseEnter={() => setSugIdx(i)}
                      className={cn('w-full grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2.5 items-center px-3 py-2 text-left', i === sugIdx && 'bg-[var(--hover)]')}
                    >
                      <span className="font-mono text-[12.5px] font-medium">{s.material}</span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] truncate">{s.descricao || '—'}</span>
                        <span className="block text-[11px] text-[var(--text-3)] font-mono">
                          {s.estoquePES > 0 ? `${qf(s.estoquePES)} ${s.unidade} em PES` : 'sem saldo em PES'}
                        </span>
                      </span>
                      <span className={cn('font-mono text-[11.5px]', s.valor ? 'text-[var(--text-2)]' : 'text-[var(--amber)]')}>
                        {s.valor ? brl(s.valor) : 'sem preço'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {normalizedMaterial && (
              <div className="mt-3 pb-3 border-b border-[var(--border)]">
                <p className="text-[13px] leading-snug">
                  <span className="font-mono font-medium mr-2">{normalizedMaterial}</span>
                  <span className="text-[var(--text-2)]">{info?.descricao || 'Fora da base de estoque atual'}</span>
                </p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-[var(--text-3)]">Saldo PES</dt>
                    <dd className="font-mono">{qf(info?.estoquePES || 0)} {unidade}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-3)]">Lotes PES</dt>
                    <dd className="font-mono">{info?.lotesPES || 0}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-3)]">Preço base</dt>
                    <dd className={cn('font-mono', !registeredUnitValue && 'text-[var(--amber)]')}>
                      {registeredUnitValue ? brl(registeredUnitValue) : 'não cadastrado'}
                    </dd>
                  </div>
                </dl>
                <button type="button" onClick={() => goWhereUsed(normalizedMaterial)} className="mt-2 text-[12px] font-medium text-[var(--accent)] inline-flex items-center gap-1">
                  Onde este material é usado <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <label className={label} htmlFor="qty">Quantidade ({unidade})</label>
                {overPes && <span className="text-[11.5px] text-[var(--amber)]">acima do saldo PES</span>}
              </div>
              <input
                id="qty"
                ref={qtyRef}
                value={quantidadeInput}
                onChange={(e) => setQuantidadeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canAdd && handleAdd()}
                inputMode="decimal"
                placeholder="0,000"
                className={cn(input, 'font-mono text-right')}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {info && info.estoquePES > 0 && (
                  <button type="button" onClick={() => setQuantidadeInput(formatForInput(info.estoquePES))} className="h-7 px-2.5 rounded-full border border-[var(--border-strong)] text-[11.5px] text-[var(--text)] hover:border-[var(--text-3)]">
                    Saldo PES · <span className="font-mono">{qf(info.estoquePES)}</span>
                  </button>
                )}
                {[1, 5, 10, 50, 100].map((n) => (
                  <button key={n} type="button" onClick={() => addQty(n)} className="h-7 px-2.5 rounded-full border border-[var(--border-strong)] font-mono text-[11.5px] text-[var(--text-3)] hover:text-[var(--text)]">
                    +{n}
                  </button>
                ))}
                {parsedQuantity > 0 && (
                  <button type="button" onClick={() => setQuantidadeInput('')} className="h-7 px-2 text-[11.5px] text-[var(--text-3)] hover:text-[var(--text)]">
                    zerar
                  </button>
                )}
              </div>
            </div>

            {normalizedMaterial && (
              <div className="mt-4">
                <label className={label} htmlFor="price">
                  Valor unitário (R$/{unidade}) {registeredUnitValue > 0 && <span className="text-[var(--text-3)]">· opcional, sobrescreve o cadastro</span>}
                </label>
                <input
                  id="price"
                  value={customPriceInput}
                  onChange={(e) => setCustomPriceInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canAdd && handleAdd()}
                  inputMode="decimal"
                  placeholder={registeredUnitValue ? qf(registeredUnitValue, 4) : 'Informe o preço'}
                  className={cn(input, 'font-mono text-right', !registeredUnitValue && !customPrice && 'border-[var(--amber)]')}
                />
                {!registeredUnitValue && (
                  <p className="mt-1.5 text-[11.5px] text-[var(--amber)]">Material sem preço cadastrado. O valor informado vale só para esta simulação.</p>
                )}
              </div>
            )}

            <button type="button" onClick={handleAdd} disabled={!canAdd} className={cn(primary, 'w-full mt-5')}>
              <Plus className="h-4 w-4" /> Adicionar à lista
            </button>
          </section>

          {/* Resultado + lista */}
          <section className="min-w-0">
            <div className="pb-4 border-b border-[var(--border)]">
              <span className="block text-[12px] text-[var(--text-3)]">
                Valor calculado {normalizedMaterial && <span className="font-mono">· {normalizedMaterial}</span>}
              </span>
              <span className="block font-mono text-[34px] sm:text-[40px] font-semibold tracking-tight leading-tight">{brl(calculatedTotal)}</span>
              <span className="block font-mono text-[12.5px] text-[var(--text-3)] mt-0.5">
                {qf(parsedQuantity)} {unidade} × {brl(effectiveUnitValue)}
                {usingCustom && <span className="font-sans text-[var(--amber)]"> · preço informado</span>}
              </span>
              {normalizedMaterial && (info?.estoquePES || 0) > 0 && (
                <p className="mt-3 text-[12.5px] text-[var(--text-2)]">
                  Saldo PES inteiro: <span className="font-mono text-[var(--text)]">{brl(pesTotalValue)}</span>
                  <span className="text-[var(--text-3)]"> ({qf(info!.estoquePES)} {unidade} em {info!.lotesPES} lote{info!.lotesPES === 1 ? '' : 's'})</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-4 pb-2 flex-wrap">
              <h3 className="text-[13px] font-semibold">
                Lista valorizada <span className="font-mono font-normal text-[var(--text-3)]">{simulatedItems.length}</span>
              </h3>
              {simulatedItems.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => copySummary('texto')} className={btn}><Copy className="h-3.5 w-3.5" /> Resumo</button>
                  <button type="button" onClick={() => copySummary('excel')} className={btn}><Copy className="h-3.5 w-3.5" /> Excel</button>
                  <button
                    type="button"
                    onClick={() => {
                      const prev = simulatedItems;
                      setSimulatedItems([]);
                      toast((t) => (
                        <span className="text-[13px]">
                          Lista limpa{' '}
                          <button className="ml-2 underline font-medium" onClick={() => { setSimulatedItems(prev); toast.dismiss(t.id); }}>
                            Desfazer
                          </button>
                        </span>
                      ));
                    }}
                    className="h-8 px-2 text-[12.5px] text-[var(--text-3)] hover:text-[var(--red)]"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {simulatedItems.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-[var(--text-3)] border-t border-[var(--border)]">
                Nenhum item ainda. Escolha um material, ajuste a quantidade e tecle Enter.
              </p>
            ) : (
              <div className="overflow-x-auto border-t border-[var(--border-strong)]">
                <table className="w-full text-[12.5px] border-separate border-spacing-0">
                  <thead>
                    <tr className="text-[11.5px] text-[var(--text-3)]">
                      <th className="h-8 px-2 text-left font-medium border-b border-[var(--border)]">Material</th>
                      <th className="h-8 px-2 text-left font-medium border-b border-[var(--border)] hidden sm:table-cell">Descrição</th>
                      <th className="h-8 px-2 text-right font-medium border-b border-[var(--border)]">Quantidade</th>
                      <th className="h-8 px-2 text-right font-medium border-b border-[var(--border)] hidden md:table-cell">R$/un</th>
                      <th className="h-8 px-2 text-right font-medium border-b border-[var(--border)]">Total</th>
                      <th className="h-8 w-9 border-b border-[var(--border)]" />
                    </tr>
                  </thead>
                  <tbody>
                    {simulatedItems.map((i) => (
                      <tr key={i.id} className="group hover:bg-[var(--surface-2)]">
                        <td className="h-9 px-2 border-b border-[var(--border)] font-mono font-medium">{i.material}</td>
                        <td className="h-9 px-2 border-b border-[var(--border)] text-[var(--text-2)] max-w-[240px] truncate hidden sm:table-cell" title={i.descricao}>{i.descricao}</td>
                        <td className="h-9 px-2 border-b border-[var(--border)] text-right font-mono whitespace-nowrap">
                          {qf(i.quantidade)} <span className="text-[11px] text-[var(--text-3)]">{i.unidade}</span>
                        </td>
                        <td className="h-9 px-2 border-b border-[var(--border)] text-right font-mono text-[var(--text-3)] hidden md:table-cell">{brl(i.valorUnitario)}</td>
                        <td className="h-9 px-2 border-b border-[var(--border)] text-right font-mono">{brl(i.valorTotal)}</td>
                        <td className="h-9 px-1 border-b border-[var(--border)] text-center">
                          <button type="button" onClick={() => removeItem(i.id)} className="h-7 w-7 inline-grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--red)] opacity-60 group-hover:opacity-100" title="Remover">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="pt-3 px-2 text-[12px] text-[var(--text-3)]" colSpan={2}>
                        {simulatedItems.length} {simulatedItems.length === 1 ? 'item' : 'itens'}
                      </td>
                      <td className="pt-3 px-2 text-right font-mono text-[12px] text-[var(--text-2)] whitespace-nowrap">
                        {totalsByUnit.map(([u, q]) => `${qf(q)} ${u}`).join(' + ')}
                      </td>
                      <td className="hidden md:table-cell" />
                      <td className="pt-3 px-2 text-right font-mono text-[16px] font-semibold whitespace-nowrap">{brl(totalValue)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================================
       * LISTA TÉCNICA
       * ==================================================================== */}
      {tool === 'bom' && (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
              {([
                ['mp', 'Onde a MP é usada'],
                ['semi', 'Fórmula do semi-acabado'],
              ] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setLtMode(k);
                    if (ltSearchInput.trim()) handleSearchListaTecnica(ltSearchInput, k);
                  }}
                  className={cn(
                    'h-[34px] px-3 text-[12.5px] font-medium border-r border-[var(--border-strong)] last:border-r-0 whitespace-nowrap',
                    ltMode === k ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>

            <form
              className="flex gap-2 flex-1 min-w-[260px] max-w-[560px]"
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchListaTecnica();
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] pointer-events-none" />
                <input
                  ref={ltRef}
                  value={ltSearchInput}
                  onChange={(e) => setLtSearchInput(e.target.value)}
                  placeholder={ltMode === 'mp' ? 'Código ou nome da matéria-prima' : 'Código ou nome do semi-acabado'}
                  className={cn(input, 'h-[34px] pl-9 font-mono')}
                />
                {ltSearchInput && (
                  <button type="button" onClick={() => { setLtSearchInput(''); setLtResults([]); setLtSearched(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-3)] hover:text-[var(--text)]" title="Limpar">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button type="submit" disabled={ltLoading || !ltSearchInput.trim()} className={cn(primary, 'h-[34px]')}>
                {ltLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Pesquisar
              </button>
            </form>
          </div>

          {/* Resultados */}
          {ltLoading ? (
            <p className="py-16 text-center text-[12.5px] text-[var(--text-3)] inline-flex w-full justify-center items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando lista técnica…
            </p>
          ) : groups.length > 0 ? (
            <>
              <p className="mt-4 mb-2 text-[12px] text-[var(--text-3)]">
                <span className="font-mono text-[var(--text-2)]">{ltResults.length}</span> vínculos em{' '}
                <span className="font-mono text-[var(--text-2)]">{groups.length}</span> {ltMode === 'mp' ? 'matéria(s)-prima(s)' : 'fórmula(s)'} · estoque considerado: depósito PES
              </p>

              <div className="border-t border-[var(--border-strong)]">
                {groups.map((g) => {
                  const many = groups.length > 1;
                  const open = !many || openGroups[g.key] !== false;
                  return (
                    <section key={g.key} className="border-b border-[var(--border)] py-3">
                      {/* Cabeçalho do grupo */}
                      <div className="flex items-start gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => many && setOpenGroups((p) => ({ ...p, [g.key]: !open }))}
                          className={cn('min-w-0 flex-1 text-left', many && 'cursor-pointer')}
                        >
                          <span className="flex items-baseline gap-2">
                            {many && <ChevronRight className={cn('h-3.5 w-3.5 self-center text-[var(--text-3)] transition-transform', open && 'rotate-90')} />}
                            <span className="font-mono text-[15px] font-semibold">{g.code}</span>
                            <span className="text-[13px] text-[var(--text-2)] truncate">{g.desc}</span>
                          </span>
                          <span className={cn('block text-[12px] text-[var(--text-3)] mt-0.5', many && 'pl-[22px]')}>
                            {ltMode === 'mp' ? (
                              <>
                                Usada em <span className="font-mono text-[var(--text-2)]">{g.rows.length}</span> produto(s) · PES{' '}
                                <span className="font-mono text-[var(--text-2)]">{qf(g.estoquePES)} {g.unidade}</span>
                                {g.estoquePES > 0 && (
                                  <> · {g.price ? <span className="font-mono text-[var(--text-2)]">{brl(g.value)}</span> : <span className="text-[var(--amber)]">sem preço</span>}</>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-[var(--text-2)]">{g.rows.length}</span> componente(s) · lote de{' '}
                                <span className="font-mono text-[var(--text-2)]">{qf(Number(g.rows[0]?.qtd_semi_acabado) || 0)} UN</span>
                                {g.formulaValue > 0 && <> · custo MP por lote <span className="font-mono text-[var(--text-2)]">{brl(g.formulaValue)}</span></>}
                                {g.bottleneck && (
                                  <>
                                    {' '}· PES cobre{' '}
                                    <span className={cn('font-mono', g.bottleneck.lotes === 0 ? 'text-[var(--red)]' : 'text-[var(--text-2)]')}>
                                      {g.bottleneck.lotes} lote{g.bottleneck.lotes === 1 ? '' : 's'}
                                    </span>
                                    <span> (limitado por {g.bottleneck.mat})</span>
                                  </>
                                )}
                              </>
                            )}
                          </span>
                        </button>
                        {ltMode === 'mp' && (
                          <button type="button" onClick={() => goValorizar(g.code)} className={btn}>
                            <Calculator className="h-3.5 w-3.5" /> Valorizar PES
                          </button>
                        )}
                      </div>

                      {/* Linhas */}
                      {open && (
                        <div className={cn('mt-2 overflow-x-auto', many && 'pl-[22px]')}>
                          <table className="w-full text-[12.5px] border-separate border-spacing-0">
                            <thead>
                              <tr className="text-[11.5px] text-[var(--text-3)]">
                                <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)]">{ltMode === 'mp' ? 'Semi-acabado' : 'Matéria-prima'}</th>
                                <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)]">Descrição</th>
                                <th className="h-7 px-2 text-right font-medium border-b border-[var(--border)]">Qtd. MP / lote</th>
                                {ltMode === 'mp' ? (
                                  <th className="h-7 px-2 text-right font-medium border-b border-[var(--border)] hidden sm:table-cell">Tam. lote</th>
                                ) : (
                                  <>
                                    <th className="h-7 px-2 text-right font-medium border-b border-[var(--border)]">Saldo PES</th>
                                    <th className="h-7 px-2 text-right font-medium border-b border-[var(--border)] hidden md:table-cell">Cobre</th>
                                    <th className="h-7 px-2 text-right font-medium border-b border-[var(--border)] hidden md:table-cell">R$ / lote</th>
                                  </>
                                )}
                                <th className="h-7 w-8 border-b border-[var(--border)]" />
                              </tr>
                            </thead>
                            <tbody>
                              {g.rows.map((r, idx) => {
                                if (ltMode === 'mp') {
                                  return (
                                    <tr key={r.id || `${r.semi_acabado}-${idx}`} className="hover:bg-[var(--surface-2)]">
                                      <td className="h-8 px-2 border-b border-[var(--border)] font-mono font-medium">{r.semi_acabado}</td>
                                      <td className="h-8 px-2 border-b border-[var(--border)] text-[var(--text-2)] max-w-[360px] truncate" title={r.descricao_semi_acabado}>{r.descricao_semi_acabado}</td>
                                      <td className="h-8 px-2 border-b border-[var(--border)] text-right font-mono whitespace-nowrap">
                                        {qf(Number(r.qtd_materia_prima) || 0)} <span className="text-[11px] text-[var(--text-3)]">{r.un_materia_prima}</span>
                                      </td>
                                      <td className="h-8 px-2 border-b border-[var(--border)] text-right font-mono text-[var(--text-3)] hidden sm:table-cell">{qf(Number(r.qtd_semi_acabado) || 0)} UN</td>
                                      <td className="h-8 px-1 border-b border-[var(--border)] text-right">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setLtSearchInput(String(r.semi_acabado));
                                            setLtMode('semi');
                                            handleSearchListaTecnica(String(r.semi_acabado), 'semi');
                                          }}
                                          className="h-7 w-7 inline-grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--text)]"
                                          title="Ver fórmula completa"
                                        >
                                          <ListTree className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                }
                                const i = infoOf(r.materia_prima);
                                const est = i?.estoquePES || 0;
                                const q = Number(r.qtd_materia_prima) || 0;
                                const cobre = q > 0 ? Math.floor(est / q) : null;
                                const p = priceOf(r.materia_prima);
                                const isNeck = g.bottleneck?.mat === String(r.materia_prima);
                                return (
                                  <tr key={r.id || `${r.materia_prima}-${idx}`} className="hover:bg-[var(--surface-2)]">
                                    <td className="h-8 px-2 border-b border-[var(--border)] font-mono font-medium">
                                      <button type="button" onClick={() => goValorizar(String(r.materia_prima))} className="hover:text-[var(--accent)]" title="Valorizar">
                                        {r.materia_prima}
                                      </button>
                                    </td>
                                    <td className="h-8 px-2 border-b border-[var(--border)] text-[var(--text-2)] max-w-[300px] truncate" title={r.descricao_materia_prima}>{r.descricao_materia_prima}</td>
                                    <td className="h-8 px-2 border-b border-[var(--border)] text-right font-mono whitespace-nowrap">
                                      {qf(q)} <span className="text-[11px] text-[var(--text-3)]">{r.un_materia_prima}</span>
                                    </td>
                                    <td className={cn('h-8 px-2 border-b border-[var(--border)] text-right font-mono whitespace-nowrap', est <= 0 && 'text-[var(--text-3)]')}>
                                      {qf(est)} <span className="text-[11px] text-[var(--text-3)]">{i?.unidade || r.un_materia_prima}</span>
                                    </td>
                                    <td className={cn('h-8 px-2 border-b border-[var(--border)] text-right font-mono hidden md:table-cell', cobre === 0 ? 'text-[var(--red)]' : isNeck ? 'text-[var(--amber)]' : 'text-[var(--text-2)]')}>
                                      {cobre === null ? '—' : `${cobre} lote${cobre === 1 ? '' : 's'}`}
                                    </td>
                                    <td className="h-8 px-2 border-b border-[var(--border)] text-right font-mono hidden md:table-cell">
                                      {p ? brl(q * p) : <span className="text-[var(--amber)] font-sans text-[11.5px]">sem preço</span>}
                                    </td>
                                    <td className="h-8 px-1 border-b border-[var(--border)] text-right">
                                      <button type="button" onClick={() => goWhereUsed(String(r.materia_prima))} className="h-7 w-7 inline-grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--text)]" title="Onde esta MP é usada">
                                        <ListTree className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          ) : ltSearched ? (
            <p className="py-14 text-center text-[12.5px] text-[var(--text-3)]">
              Nenhum vínculo para <span className="font-mono text-[var(--text-2)]">{ltSearched}</span>.
              {ltMode === 'mp' ? ' Tente o modo Fórmula do semi-acabado ou parte do nome.' : ' Tente o modo Onde a MP é usada ou parte do nome.'}
            </p>
          ) : (
            <p className="py-14 text-center text-[12.5px] text-[var(--text-3)]">
              {ltMode === 'mp'
                ? 'Informe uma matéria-prima para ver em quais produtos ela entra e quanto vale o saldo em PES.'
                : 'Informe um semi-acabado para ver a fórmula, o custo de MP por lote e quantos lotes o estoque PES cobre.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
1