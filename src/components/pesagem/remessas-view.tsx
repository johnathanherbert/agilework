'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type RowSelectionState,
  type PaginationState,
  type FilterFn,
  type Column,
  type Table as TanstackTable,
  type Row,
} from '@tanstack/react-table';
import {
  Search,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Filter,
  Check,
} from 'lucide-react';
import { RemessaData } from '@/types/aging';
import { cn, copyToClipboard } from '@/lib/utils';

/* ============================================================================
 * Helpers
 * ========================================================================== */

const toNum = (raw: unknown): number => {
  if (typeof raw === 'number') return raw;
  if (raw === null || raw === undefined || raw === '') return NaN;
  let s = String(raw).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
};

const fmtQ = (n: number, min = 0, max = 3) =>
  isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

/** Aceita DD/MM/AAAA (dados) e AAAA-MM-DD (input date), sempre em horário local */
function parseDate(str?: string | null): Date | null {
  if (!str) return null;
  const s = String(str).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

function today0(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dias entre hoje e a data de disponibilidade (negativo = atrasada) */
function daysFromToday(str?: string | null): number | null {
  const d = parseDate(str);
  if (!d) return null;
  return Math.round((d.getTime() - today0().getTime()) / 86400000);
}

type Prazo = 'late' | 'today' | 'soon' | 'later' | 'none';
function prazoOf(r: RemessaData): Prazo {
  const d = daysFromToday(r.data_disponibilidade);
  if (d === null) return 'none';
  if (d < 0) return 'late';
  if (d === 0) return 'today';
  if (d <= 7) return 'soon';
  return 'later';
}
const PRAZO_META: Record<Prazo, { label: string; color: string }> = {
  late: { label: 'Atrasada', color: 'var(--red)' },
  today: { label: 'Hoje', color: 'var(--amber)' },
  soon: { label: 'Até 7 dias', color: 'var(--accent)' },
  later: { label: 'Futura', color: 'var(--text-3)' },
  none: { label: 'Sem data', color: 'var(--text-3)' },
};

/* ============================================================================
 * Filtros
 * ========================================================================== */

const numberRangeFilter: FilterFn<RemessaData> = (row, columnId, filterValue) => {
  const val = toNum(row.getValue(columnId));
  const [min, max] = (filterValue || []) as [number | undefined, number | undefined];
  if (min === undefined && max === undefined) return true;
  if (isNaN(val)) return false;
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
};

const dateRangeFilter: FilterFn<RemessaData> = (row, columnId, filterValue) => {
  const [start, end] = (filterValue || []) as [string | undefined, string | undefined];
  if (!start && !end) return true;
  const d = parseDate(row.getValue<string>(columnId));
  if (!d) return false;
  const s = parseDate(start);
  const e = parseDate(end);
  if (s && d < s) return false;
  if (e && d > e) return false;
  return true;
};

const prazoFilter: FilterFn<RemessaData> = (row, _id, filterValue) => {
  if (!filterValue || filterValue === 'all') return true;
  const p = prazoOf(row.original);
  if (filterValue === 'week') return p === 'late' || p === 'today' || p === 'soon';
  return p === filterValue;
};

type FilterType = 'text' | 'select' | 'range' | 'date' | 'none';
const COLUMN_FILTER_TYPES: Record<string, FilterType> = {
  numero_remessa: 'text',
  item: 'text',
  material: 'text',
  descricao_material: 'text',
  centro: 'select',
  deposito: 'select',
  quantidade: 'range',
  unidade_medida: 'select',
  data_disponibilidade: 'date',
  data_picking: 'date',
  peso_total_remessa: 'range',
};

/* ============================================================================
 * Subcomponentes
 * ========================================================================== */

const fieldCls =
  'h-7 w-full min-w-0 px-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded text-[11.5px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]';

function ColumnFilterWidget({
  column,
  table,
  filterType,
}: {
  column: Column<RemessaData, unknown>;
  table: TanstackTable<RemessaData>;
  filterType: FilterType;
}) {
  if (filterType === 'text') {
    return (
      <input
        value={(column.getFilterValue() as string) ?? ''}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        placeholder="Filtrar"
        className={fieldCls}
      />
    );
  }

  if (filterType === 'select') {
    const values = Array.from(
      new Set(
        table
          .getPreFilteredRowModel()
          .rows.map((r: Row<RemessaData>) => {
            const v = r.getValue(column.id);
            return v != null ? String(v) : '';
          })
          .filter((v: string) => v !== '')
      )
    ).sort();
    return (
      <select
        value={(column.getFilterValue() as string) ?? ''}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        className={cn(fieldCls, 'pr-1 cursor-pointer')}
      >
        <option value="">Todos</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  if (filterType === 'range') {
    const cur = column.getFilterValue() as [number | undefined, number | undefined] | undefined;
    const set = (i: 0 | 1, v: string) => {
      const n = v === '' ? undefined : toNum(v);
      const next: [number | undefined, number | undefined] = [cur?.[0], cur?.[1]];
      next[i] = n !== undefined && !isNaN(n) ? n : undefined;
      column.setFilterValue(next[0] === undefined && next[1] === undefined ? undefined : next);
    };
    return (
      <div className="flex gap-1">
        <input inputMode="decimal" placeholder="Mín" className={cn(fieldCls, 'text-right')} value={cur?.[0] ?? ''} onChange={(e) => set(0, e.target.value)} />
        <input inputMode="decimal" placeholder="Máx" className={cn(fieldCls, 'text-right')} value={cur?.[1] ?? ''} onChange={(e) => set(1, e.target.value)} />
      </div>
    );
  }

  if (filterType === 'date') {
    const cur = column.getFilterValue() as [string | undefined, string | undefined] | undefined;
    const set = (i: 0 | 1, v: string) => {
      const next: [string | undefined, string | undefined] = [cur?.[0], cur?.[1]];
      next[i] = v || undefined;
      column.setFilterValue(!next[0] && !next[1] ? undefined : next);
    };
    return (
      <div className="flex gap-1">
        <input type="date" title="De" className={cn(fieldCls, 'px-1 font-mono')} value={cur?.[0] ?? ''} onChange={(e) => set(0, e.target.value)} />
        <input type="date" title="Até" className={cn(fieldCls, 'px-1 font-mono')} value={cur?.[1] ?? ''} onChange={(e) => set(1, e.target.value)} />
      </div>
    );
  }

  return null;
}

/* ============================================================================
 * View
 * ========================================================================== */

interface RemessasViewProps {
  remessas: RemessaData[];
  materialFilter?: string;
}

type ColMeta = { label: string; align?: 'right'; cls?: string; filterType?: FilterType };

const PAGE_SIZES = [25, 50, 100, 250, 500];

export function RemessasView({ remessas, materialFilter }: RemessasViewProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'data_disponibilidade', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [showFilters, setShowFilters] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  };

  // Filtro de material vindo de fora: só substitui o filtro "material", mantendo os demais
  useEffect(() => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== 'material');
      return materialFilter ? [...rest, { id: 'material', value: materialFilter }] : rest;
    });
  }, [materialFilter]);

  // Atalho "/" para a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) {
        if (e.key === 'Escape') ae.blur();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copyCell = async (text: string, label: string) => {
    if (await copyToClipboard(text)) notify(`${label} ${text} copiado`);
  };

  /* ---------------- colunas ---------------- */
  const columns = useMemo<ColumnDef<RemessaData, unknown>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer align-middle"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected();
            }}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
            aria-label="Selecionar página"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer align-middle"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Selecionar linha"
          />
        ),
        size: 36,
        enableSorting: false,
        enableColumnFilter: false,
        meta: { label: '' } as ColMeta,
      },
      {
        id: 'prazo',
        accessorFn: (r) => daysFromToday(r.data_disponibilidade) ?? 99999,
        header: 'Prazo',
        filterFn: prazoFilter,
        cell: ({ row }) => {
          const p = prazoOf(row.original);
          const d = daysFromToday(row.original.data_disponibilidade);
          const txt = d === null ? '—' : d < 0 ? `${-d} d atraso` : d === 0 ? 'hoje' : `em ${d} d`;
          return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: p === 'late' ? 'var(--red)' : undefined }}>
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: PRAZO_META[p].color }} />
              <span className={cn('text-[12px]', p === 'later' || p === 'none' ? 'text-[var(--text-3)]' : '')}>{txt}</span>
            </span>
          );
        },
        size: 100,
        meta: { label: 'Prazo', filterType: 'none' } as ColMeta,
      },
      {
        accessorKey: 'numero_remessa',
        header: 'Remessa',
        cell: ({ getValue }) => {
          const v = String(getValue() ?? '');
          return (
            <button type="button" onClick={(e) => { e.stopPropagation(); copyCell(v, 'Remessa'); }} className="font-mono font-medium text-[var(--text)] hover:text-[var(--accent)]" title="Copiar remessa">
              {v}
            </button>
          );
        },
        size: 110,
        meta: { label: 'Remessa' } as ColMeta,
      },
      {
        accessorKey: 'item',
        header: 'Item',
        cell: ({ getValue }) => <span className="font-mono text-[var(--text-2)]">{String(getValue() ?? '')}</span>,
        size: 56,
        meta: { label: 'Item', cls: 'hidden sm:table-cell' } as ColMeta,
      },
      {
        accessorKey: 'material',
        header: 'Material',
        cell: ({ getValue }) => {
          const v = String(getValue() ?? '');
          return (
            <button type="button" onClick={(e) => { e.stopPropagation(); copyCell(v, 'Material'); }} className="font-mono text-[var(--text)] hover:text-[var(--accent)]" title="Copiar material">
              {v}
            </button>
          );
        },
        size: 90,
        meta: { label: 'Material' } as ColMeta,
      },
      {
        accessorKey: 'descricao_material',
        header: 'Descrição',
        cell: ({ getValue }) => {
          const raw = String(getValue() ?? '');
          const ctrl = raw.includes('**');
          return (
            <span className="flex items-center gap-1.5 min-w-0" title={raw.replace(/\*\*/g, '')}>
              <span className="truncate text-[var(--text)]">{raw.replace(/\*\*/g, '')}</span>
              {ctrl && (
                <span className="shrink-0 text-[10.5px] font-medium text-[var(--amber)] border border-[var(--border-strong)] rounded px-1 leading-4">
                  Controlado
                </span>
              )}
            </span>
          );
        },
        size: 260,
        meta: { label: 'Descrição', cls: 'hidden md:table-cell max-w-[320px]' } as ColMeta,
      },
      {
        accessorKey: 'quantidade',
        header: 'Quantidade',
        cell: ({ getValue, row }) => (
          <span className="font-mono text-[var(--text)] whitespace-nowrap">
            {fmtQ(toNum(getValue()))}
            <span className="ml-1 text-[11px] text-[var(--text-3)]">{row.original.unidade_medida || ''}</span>
          </span>
        ),
        filterFn: numberRangeFilter,
        size: 120,
        meta: { label: 'Quantidade', align: 'right' } as ColMeta,
      },
      {
        accessorKey: 'unidade_medida',
        header: 'UMB',
        cell: ({ getValue }) => <span className="font-mono text-[var(--text-3)]">{String(getValue() ?? '')}</span>,
        size: 56,
        meta: { label: 'UMB', cls: 'hidden xl:table-cell' } as ColMeta,
      },
      {
        accessorKey: 'centro',
        header: 'Centro',
        cell: ({ getValue }) => <span className="font-mono text-[var(--text-2)]">{String(getValue() ?? '')}</span>,
        size: 64,
        meta: { label: 'Centro', cls: 'hidden xl:table-cell' } as ColMeta,
      },
      {
        accessorKey: 'deposito',
        header: 'Depósito',
        cell: ({ getValue }) => <span className="font-mono text-[var(--text-2)]">{String(getValue() ?? '')}</span>,
        size: 72,
        meta: { label: 'Depósito', cls: 'hidden lg:table-cell' } as ColMeta,
      },
      {
        accessorKey: 'data_disponibilidade',
        header: 'Disponib.',
        sortingFn: (a, b, id) =>
          (parseDate(a.getValue<string>(id))?.getTime() ?? Infinity) - (parseDate(b.getValue<string>(id))?.getTime() ?? Infinity),
        cell: ({ getValue }) => <span className="font-mono text-[var(--text-2)]">{String(getValue() ?? '—')}</span>,
        filterFn: dateRangeFilter,
        size: 96,
        meta: { label: 'Data disponib.', cls: 'hidden sm:table-cell' } as ColMeta,
      },
      {
        accessorKey: 'data_picking',
        header: 'Picking',
        sortingFn: (a, b, id) =>
          (parseDate(a.getValue<string>(id))?.getTime() ?? Infinity) - (parseDate(b.getValue<string>(id))?.getTime() ?? Infinity),
        cell: ({ getValue }) => {
          const v = getValue() as string | undefined;
          return v ? <span className="font-mono text-[var(--text-2)]">{v}</span> : <span className="text-[var(--text-3)]">—</span>;
        },
        filterFn: dateRangeFilter,
        size: 96,
        meta: { label: 'Data picking', cls: 'hidden lg:table-cell' } as ColMeta,
      },
      {
        accessorKey: 'peso_total_remessa',
        header: 'Peso remessa',
        cell: ({ getValue }) => {
          const n = toNum(getValue());
          return isNaN(n) ? <span className="text-[var(--text-3)]">—</span> : <span className="font-mono text-[var(--text-2)]">{fmtQ(n, 0, 3)}</span>;
        },
        filterFn: numberRangeFilter,
        size: 104,
        meta: { label: 'Peso remessa', align: 'right', cls: 'hidden lg:table-cell' } as ColMeta,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: remessas,
    columns,
    state: { sorting, columnFilters, rowSelection, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    globalFilterFn: (row, _id, value) => {
      const q = String(value || '').trim().toLowerCase();
      if (!q) return true;
      const r = row.original;
      return [r.numero_remessa, r.item, r.material, r.descricao_material, r.deposito]
        .map((v) => String(v ?? '').toLowerCase())
        .some((v) => v.includes(q));
    },
  });

  /* ---------------- indicadores ---------------- */
  const filteredRows = table.getFilteredRowModel().rows;
  const stats = useMemo(() => {
    const all = remessas;
    const remSet = new Set<string>();
    const matSet = new Set<string>();
    const pesoByRem = new Map<string, number>();
    const cnt: Record<Prazo, number> = { late: 0, today: 0, soon: 0, later: 0, none: 0 };
    const lateRem = new Set<string>();
    all.forEach((r) => {
      const rem = String(r.numero_remessa);
      remSet.add(rem);
      matSet.add(String(r.material));
      const p = prazoOf(r);
      cnt[p]++;
      if (p === 'late') lateRem.add(rem);
      const peso = toNum(r.peso_total_remessa);
      if (!isNaN(peso) && !pesoByRem.has(rem)) pesoByRem.set(rem, peso); // peso é da remessa: conta uma vez
    });
    let peso = 0;
    pesoByRem.forEach((v) => (peso += v));
    return { rem: remSet.size, mat: matSet.size, itens: all.length, peso, cnt, lateRem: lateRem.size };
  }, [remessas]);

  const filtStats = useMemo(() => {
    const rem = new Set<string>();
    const byUmb = new Map<string, number>();
    filteredRows.forEach((r: Row<RemessaData>) => {
      rem.add(String(r.original.numero_remessa));
      const q = toNum(r.original.quantidade);
      if (!isNaN(q)) {
        const u = r.original.unidade_medida || '';
        byUmb.set(u, (byUmb.get(u) || 0) + q);
      }
    });
    return { rem: rem.size, byUmb: Array.from(byUmb.entries()).sort((a, b) => b[1] - a[1]) };
  }, [filteredRows]);

  /* ---------------- prazo rápido ---------------- */
  const prazoVal = (columnFilters.find((f) => f.id === 'prazo')?.value as string) || 'all';
  const setPrazo = (v: string) =>
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== 'prazo');
      return v === 'all' ? rest : [...rest, { id: 'prazo', value: v }];
    });

  /* ---------------- seleção ---------------- */
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  const exportCols = table
    .getAllLeafColumns()
    .filter((c) => c.id !== 'select' && c.id !== 'prazo' && c.getIsVisible());

  const handleCopySelected = async () => {
    if (!selectedCount) return;
    const head = exportCols.map((c) => (c.columnDef.meta as ColMeta | undefined)?.label || c.id).join('\t');
    const body = selectedRows
      .map((row: Row<RemessaData>) =>
        exportCols
          .map((c) => {
            const v = row.getValue(c.id);
            return typeof v === 'number' ? fmtQ(v) : v != null ? String(v) : '';
          })
          .join('\t')
      )
      .join('\n');
    if (await copyToClipboard(`${head}\n${body}`)) notify(`${selectedCount} linha(s) copiadas · cole no Excel`);
  };

  const handleCopyNumbers = async () => {
    const nums = Array.from(new Set(selectedRows.map((r: Row<RemessaData>) => String(r.original.numero_remessa))));
    if (await copyToClipboard(nums.join('\n'))) notify(`${nums.length} remessa(s) copiadas`);
  };

  const handleClearFilters = () => {
    setColumnFilters(materialFilter ? [{ id: 'material', value: materialFilter }] : []);
    setGlobalFilter('');
  };

  const colFilterCount = columnFilters.filter((f) => f.id !== 'prazo' && f.id !== 'material').length;
  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== '';
  const matChip = columnFilters.find((f) => f.id === 'material')?.value as string | undefined;

  const { pageIndex, pageSize } = table.getState().pagination;
  const filteredCount = filteredRows.length;
  const totalPages = table.getPageCount();
  const from = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, filteredCount);

  const pageButtons = useMemo(() => {
    const total = totalPages;
    const cur = pageIndex;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const out: (number | '…')[] = [0];
    let a = Math.max(1, cur - 1);
    let b = Math.min(total - 2, cur + 1);
    if (cur <= 3) { a = 1; b = 4; }
    if (cur >= total - 4) { a = total - 5; b = total - 2; }
    if (a > 1) out.push('…');
    for (let i = a; i <= b; i++) out.push(i);
    if (b < total - 2) out.push('…');
    out.push(total - 1);
    return out;
  }, [totalPages, pageIndex]);

  const segBtn = (on: boolean) =>
    cn(
      'h-[30px] px-3 text-[12px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap border-r border-[var(--border-strong)] last:border-r-0',
      on ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
    );
  const btn =
    'h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';

  const PRAZO_SEG: [string, string, number, string?][] = [
    ['all', 'Todas', stats.itens],
    ['late', 'Atrasadas', stats.cnt.late, 'var(--red)'],
    ['today', 'Hoje', stats.cnt.today, 'var(--amber)'],
    ['week', 'Próx. 7 dias', stats.cnt.late + stats.cnt.today + stats.cnt.soon, 'var(--accent)'],
  ];

  /* ============================================================================
   * Render
   * ========================================================================== */
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] min-h-[420px] text-[var(--text)]">
      {/* ---------- Cabeçalho ---------- */}
      <div className="shrink-0 px-1 pb-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">Remessas abertas</h2>
            <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">
              Itens aguardando picking · ordenados pela data de disponibilidade
            </p>
          </div>
        </div>

        {/* Indicadores sem caixa */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-y-3 border-b border-[var(--border)] pb-3">
          {[
            { l: 'Remessas', v: stats.rem.toLocaleString('pt-BR'), s: `${stats.itens.toLocaleString('pt-BR')} itens · ${stats.mat} materiais` },
            { l: 'Atrasadas', v: stats.cnt.late.toLocaleString('pt-BR'), s: `${stats.lateRem} remessa(s) com item vencido`, c: stats.cnt.late ? 'var(--red)' : undefined, dot: 'var(--red)', go: 'late' },
            { l: 'Disponíveis hoje', v: stats.cnt.today.toLocaleString('pt-BR'), s: `${stats.cnt.soon} nos próximos 7 dias`, dot: 'var(--amber)', go: 'today' },
            { l: 'Peso total', v: fmtQ(stats.peso, 0, 1), s: 'soma por remessa (sem repetir itens)' },
          ].map((k, i) => (
            <button
              key={k.l}
              type="button"
              disabled={!k.go}
              onClick={() => k.go && setPrazo(prazoVal === k.go ? 'all' : k.go)}
              className={cn(
                'text-left min-w-0 px-4 disabled:cursor-default',
                i === 0 ? 'pl-0' : 'border-l border-[var(--border)]',
                i === 2 && 'max-sm:border-l-0 max-sm:pl-0'
              )}
            >
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
                {k.dot && <span className="w-[7px] h-[7px] rounded-full" style={{ background: k.dot }} />}
                {k.l}
              </span>
              <span className={cn('block font-mono text-[22px] font-semibold tracking-tight leading-tight mt-0.5', k.go && prazoVal === k.go && 'underline underline-offset-4 decoration-1')} style={{ color: k.c }}>
                {k.v}
              </span>
              <span className="block text-[11.5px] text-[var(--text-3)] truncate">{k.s}</span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
            {PRAZO_SEG.map(([k, l, n, c]) => (
              <button key={k} type="button" onClick={() => setPrazo(k)} className={segBtn(prazoVal === k)}>
                {c && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />}
                {l}
                <span className="font-mono text-[10.5px] text-[var(--text-3)]">{n.toLocaleString('pt-BR')}</span>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 h-8 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] text-[var(--text-3)] focus-within:border-[var(--accent)] flex-1 min-w-[200px] max-w-[360px]">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              ref={searchRef}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Remessa, material ou descrição"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)]"
            />
            {globalFilter ? (
              <button type="button" onClick={() => setGlobalFilter('')} title="Limpar busca" className="hover:text-[var(--text)]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1">/</kbd>
            )}
          </label>

          <button type="button" onClick={() => setShowFilters((v) => !v)} className={cn(btn, showFilters && 'bg-[var(--hover)] text-[var(--text)] border-[var(--text-3)]')}>
            <Filter className="h-3.5 w-3.5" />
            Filtros por coluna
            {colFilterCount > 0 && <span className="font-mono text-[11px] text-[var(--accent)]">{colFilterCount}</span>}
          </button>

          {matChip && (
            <span className="inline-flex items-center gap-1.5 h-[26px] pl-2.5 pr-1 rounded-full bg-[var(--accent-weak)] text-[12px]">
              Material <span className="font-mono">{matChip}</span>
              <button
                type="button"
                onClick={() => setColumnFilters((p) => p.filter((f) => f.id !== 'material'))}
                className="h-5 w-5 rounded-full grid place-items-center text-[var(--text-2)] hover:bg-[var(--border)]"
                title="Remover filtro de material"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {hasActiveFilters && (
            <button type="button" onClick={handleClearFilters} className="text-[12px] font-medium text-[var(--accent)] px-1">
              Limpar filtros
            </button>
          )}

          <span className="ml-auto text-[12px] text-[var(--text-3)] whitespace-nowrap">
            <span className="font-mono text-[var(--text-2)]">{filteredCount.toLocaleString('pt-BR')}</span> de{' '}
            {remessas.length.toLocaleString('pt-BR')} itens
            {filtStats.rem > 0 && (
              <>
                {' '}· <span className="font-mono text-[var(--text-2)]">{filtStats.rem}</span> remessas
              </>
            )}
            {filtStats.byUmb.slice(0, 2).map(([u, q]) => (
              <span key={u}>
                {' '}· <span className="font-mono text-[var(--text-2)]">{fmtQ(q, 0, 1)}</span> {u}
              </span>
            ))}
          </span>
        </div>

        {/* Ações em massa (só com seleção) */}
        {selectedCount > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap py-2 px-3 border border-[var(--accent)] bg-[var(--accent-weak)] rounded-[var(--radius)]">
            <span className="text-[12.5px] mr-1">
              <span className="font-mono font-medium">{selectedCount}</span> selecionado{selectedCount > 1 ? 's' : ''}
            </span>
            <button type="button" onClick={handleCopySelected} className={btn}>
              <Copy className="h-3.5 w-3.5" /> Copiar linhas
            </button>
            <button type="button" onClick={handleCopyNumbers} className={btn}>
              <Copy className="h-3.5 w-3.5" /> Copiar nº das remessas
            </button>
            <button type="button" onClick={() => setRowSelection({})} className="ml-auto text-[12px] font-medium text-[var(--text-2)] hover:text-[var(--text)]">
              Limpar seleção
            </button>
          </div>
        )}
      </div>

      {/* ---------- Tabela ---------- */}
      <div className="flex-1 overflow-auto border-t border-[var(--border-strong)]">
        <table className="w-full border-separate border-spacing-0 text-[12.5px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as ColMeta | undefined;
                  const canSort = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      style={{ width: h.getSize() }}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        'sticky top-0 z-10 bg-[var(--bg)] h-8 px-2.5 border-b border-[var(--border)] text-[11.5px] font-medium whitespace-nowrap select-none',
                        sorted ? 'text-[var(--text)]' : 'text-[var(--text-3)]',
                        canSort && 'cursor-pointer hover:text-[var(--text)]',
                        meta?.align === 'right' ? 'text-right' : 'text-left',
                        h.column.id === 'select' && 'pl-3 pr-1',
                        meta?.cls
                      )}
                    >
                      <span className={cn('inline-flex items-center gap-1', meta?.align === 'right' && 'flex-row-reverse')}>
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === 'asc' && <ArrowUp className="h-3 w-3" />}
                        {sorted === 'desc' && <ArrowDown className="h-3 w-3" />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
            {showFilters && (
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h) => {
                  const meta = h.column.columnDef.meta as ColMeta | undefined;
                  const ft = COLUMN_FILTER_TYPES[h.column.id] || 'none';
                  return (
                    <th key={`f-${h.id}`} className={cn('sticky top-8 z-10 bg-[var(--bg)] px-1.5 py-1.5 border-b border-[var(--border)] font-normal', meta?.cls)}>
                      {h.column.getCanFilter() && ft !== 'none' ? <ColumnFilterWidget column={h.column} table={table} filterType={ft} /> : null}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-14 text-center text-[13px] text-[var(--text-3)]">
                  {hasActiveFilters ? (
                    <>
                      Nenhuma remessa com esses filtros.{' '}
                      <button type="button" onClick={handleClearFilters} className="text-[var(--accent)] font-medium">
                        Limpar filtros
                      </button>
                    </>
                  ) : (
                    'Nenhuma remessa aberta.'
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row: Row<RemessaData>) => {
                const late = prazoOf(row.original) === 'late';
                const sel = row.getIsSelected();
                return (
                  <tr
                    key={row.id}
                    onClick={() => row.toggleSelected(!sel)}
                    className={cn('group cursor-pointer', sel ? 'bg-[var(--accent-weak)]' : 'hover:bg-[var(--surface-2)]')}
                  >
                    {row.getVisibleCells().map((cell, ci) => {
                      const meta = cell.column.columnDef.meta as ColMeta | undefined;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'h-9 px-2.5 border-b border-[var(--border)] align-middle whitespace-nowrap',
                            meta?.align === 'right' && 'text-right',
                            cell.column.id === 'select' && 'pl-3 pr-1 relative',
                            meta?.cls
                          )}
                        >
                          {ci === 0 && late && <span className="absolute left-0 top-2.5 w-[3px] h-4 rounded-sm bg-[var(--red)]" />}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Paginação ---------- */}
      <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap pt-2.5 border-t border-[var(--border)] text-[12px] text-[var(--text-3)]">
        <div className="flex items-center gap-2">
          <span>Por página</span>
          <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
            {PAGE_SIZES.map((s) => (
              <button key={s} type="button" onClick={() => table.setPageSize(s)} className={cn(segBtn(pageSize === s), 'h-[26px] px-2 font-mono text-[11.5px]')}>
                {s}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11.5px] text-[var(--text-2)] ml-1">
            {from.toLocaleString('pt-BR')}–{to.toLocaleString('pt-BR')} de {filteredCount.toLocaleString('pt-BR')}
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-0.5">
            <button type="button" className="h-7 w-7 grid place-items-center rounded hover:bg-[var(--hover)] disabled:opacity-30" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} title="Primeira">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="h-7 w-7 grid place-items-center rounded hover:bg-[var(--hover)] disabled:opacity-30" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} title="Anterior">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {pageButtons.map((p, i) =>
              p === '…' ? (
                <span key={`g${i}`} className="w-6 text-center">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => table.setPageIndex(p)}
                  className={cn(
                    'h-7 min-w-7 px-1.5 rounded font-mono text-[11.5px]',
                    p === pageIndex ? 'bg-[var(--text)] text-[var(--bg)] font-medium' : 'text-[var(--text-2)] hover:bg-[var(--hover)]'
                  )}
                >
                  {p + 1}
                </button>
              )
            )}
            <button type="button" className="h-7 w-7 grid place-items-center rounded hover:bg-[var(--hover)] disabled:opacity-30" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} title="Próxima">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="h-7 w-7 grid place-items-center rounded hover:bg-[var(--hover)] disabled:opacity-30" onClick={() => table.setPageIndex(totalPages - 1)} disabled={!table.getCanNextPage()} title="Última">
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Confirmação discreta de cópia */}
      {flash && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium shadow-lg">
          <Check className="h-3.5 w-3.5" /> {flash}
        </div>
      )}
    </div>
  );
}
