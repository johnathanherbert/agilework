"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  Printer, 
  Eye,
  EyeOff,
  TrendingUp,
  Plus
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import ProtectedRoute from '@/components/auth/protected-route';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useProductionRealtime } from '@/hooks/useProductionRealtime';
import { moveProductionItem, mergeSplitProductionItem } from '@/lib/production-helpers';
import { TurnoColumn } from '@/components/producao/turno-column';
import { ProductionItemModal } from '@/components/producao/production-item-modal';
import { ProductionDeleteDialog } from '@/components/producao/production-delete-dialog';
import { ClearTurnoDialog } from '@/components/producao/clear-turno-dialog';
import { HeijunkaDialog } from '@/components/producao/heijunka-dialog';
import { RotasQuickAdd } from '@/components/producao/rotas-quick-add';
import { getWipFamilies } from '@/lib/wip-recipes';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import { cn } from '@/lib/utils';

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  tipo: ProductionTipo;
  item?: ProductionItem | null;
  defaultTurno: ProductionTurno;
  defaultVia?: ProductionVia;
}

function printPanel() {
  const el = document.getElementById('producao-print-root');
  if (!el) return;

  const pw = window.open('', '_blank', 'width=1400,height=900');
  if (!pw) {
    alert('Permita pop-ups para imprimir o painel.');
    return;
  }

  const styleSheetText = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((r) => r.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  const linkTags = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map((l) => `<link rel="stylesheet" href="${l.href}">`)
    .join('\n');

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button').forEach((b) => b.remove());

  pw.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Painel de Produção · Pesagem</title>
        ${linkTags}
        <style>
          ${styleSheetText}
          body { padding: 16px; background: #fff !important; color: #000 !important; }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
        <script>
          setTimeout(() => { window.print(); window.close(); }, 500);
        </script>
      </body>
    </html>
  `);
  pw.document.close();
}

function ProducaoPageContent() {
  const router = useRouter();
  const { userData } = useFirebase();
  const { items, loading } = useProductionRealtime();

  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    mode: 'create',
    tipo: 'ordem',
    item: null,
    defaultTurno: 1,
    defaultVia: 'UMIDA',
  });

  const [deleteTarget, setDeleteTarget] = useState<ProductionItem | null>(null);
  const [clearTurnoTarget, setClearTurnoTarget] = useState<ProductionTurno | null>(null);
  const [heijunkaOpen, setHeijunkaOpen] = useState(false);

  // Filtros
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);

  const familiesAvailable = useMemo(() => getWipFamilies(), []);

  // Filtragem de Itens
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedFamily && item.tipo === 'ordem' && item.familia !== selectedFamily) {
        return false;
      }
      if (hideCompleted && item.prog > 0 && item.real >= item.prog) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchProd = item.produto.toLowerCase().includes(q);
        const matchCode = item.codigoReceita?.toLowerCase().includes(q);
        const matchFam = item.familia?.toLowerCase().includes(q);
        if (!matchProd && !matchCode && !matchFam) return false;
      }
      return true;
    });
  }, [items, selectedFamily, hideCompleted, searchQuery]);

  // Agrupamento por Turno
  const itemsByTurno = useMemo(() => {
    return {
      1: filteredItems.filter((i) => i.turno === 1),
      2: filteredItems.filter((i) => i.turno === 2),
      3: filteredItems.filter((i) => i.turno === 3),
    };
  }, [filteredItems]);

  // Estatísticas do Dia e por Turno para os Cards de Resumo
  const stats = useMemo(() => {
    const calc = (turnItems: ProductionItem[]) => {
      const ordens = turnItems.filter(i => i.tipo === 'ordem');
      const real = ordens.reduce((a, c) => a + c.real, 0);
      const prog = ordens.reduce((a, c) => a + c.prog, 0);
      const pct = prog > 0 ? Math.min(100, Math.round((real / prog) * 100)) : 0;
      return { real, prog, pct, count: ordens.length };
    };

    return {
      total: calc(items),
      t1: calc(items.filter(i => i.turno === 1)),
      t2: calc(items.filter(i => i.turno === 2)),
      t3: calc(items.filter(i => i.turno === 3)),
    };
  }, [items]);

  const handleMoveItem = async (
    itemId: string,
    destination: { turno: ProductionTurno; via?: ProductionVia }
  ) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (item.splitChildId || item.splitParentId) {
      if (item.splitParentId && destination.turno !== item.turno) {
        try {
          await mergeSplitProductionItem(item.id, item.splitParentId);
          toast.success('Itens mesclados novamente com sucesso!');
          return;
        } catch (err) {
          toast.error('Falha ao mesclar item dividido.');
          return;
        }
      }
    }

    try {
      await moveProductionItem(itemId, destination);
      toast.success('Item movido com sucesso');
    } catch (err) {
      toast.error('Erro ao mover item');
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* App Rail */}
      <Sidebar />

      {/* Conteúdo Principal com Topbar */}
      <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" id="producao-print-root">
          {/* Cabeçalho da Página */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1 select-none">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                Painel de Produção
              </h1>
              <p className="text-xs text-[var(--text-3)] mt-0.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
                Acompanhamento e nivelamento de ordens da pesagem em tempo real
              </p>
            </div>

            {/* Ações do Topo */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setHideCompleted(!hideCompleted)}
                className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {hideCompleted ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>{hideCompleted ? "Mostrar Concluídas" : "Ocultar Concluídas"}</span>
              </button>

              <button
                type="button"
                onClick={() => setHeijunkaOpen(true)}
                className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <TrendingUp size={13} className="text-[var(--accent)]" />
                <span>Heijunka</span>
              </button>

              <button
                type="button"
                onClick={printPanel}
                className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={13} />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Cards de Resumo dos 3 Turnos + Total do Dia */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs select-none">
            {/* Bloco 1: Total do Dia */}
            <div className="p-3.5 border-r border-b lg:border-b-0 border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <b className="font-semibold text-[var(--text)]">Total do Dia</b>
                <span className="text-[11px] font-mono text-[var(--text-3)]">Meta diária</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <strong className="text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
                  {stats.total.pct}%
                </strong>
                <span className="text-xs text-[var(--text-3)] font-mono">
                  {stats.total.real} de {stats.total.prog} OPs
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                  style={{ width: `${stats.total.pct}%` }}
                />
              </div>
            </div>

            {/* Bloco 2: 1º Turno */}
            <div className="p-3.5 border-r border-b lg:border-b-0 border-[var(--border)]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <b className="font-semibold text-[var(--text)]">1º Turno</b>
                <span className="text-[11px] font-mono text-[var(--text-3)]">06:00 – 14:00</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <strong className="text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
                  {stats.t1.pct}%
                </strong>
                <span className="text-xs text-[var(--text-3)] font-mono">
                  {stats.t1.real}/{stats.t1.prog} OPs
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", stats.t1.pct >= 100 ? "bg-[var(--green)]" : "bg-[var(--accent)]")}
                  style={{ width: `${stats.t1.pct}%` }}
                />
              </div>
            </div>

            {/* Bloco 3: 2º Turno */}
            <div className="p-3.5 border-r border-b lg:border-b-0 border-[var(--border)]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <b className="font-semibold text-[var(--text)]">2º Turno</b>
                <span className="text-[11px] font-mono text-[var(--text-3)]">14:00 – 22:00</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <strong className="text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
                  {stats.t2.pct}%
                </strong>
                <span className="text-xs text-[var(--text-3)] font-mono">
                  {stats.t2.real}/{stats.t2.prog} OPs
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", stats.t2.pct >= 100 ? "bg-[var(--green)]" : "bg-[var(--accent)]")}
                  style={{ width: `${stats.t2.pct}%` }}
                />
              </div>
            </div>

            {/* Bloco 4: 3º Turno */}
            <div className="p-3.5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <b className="font-semibold text-[var(--text)]">3º Turno</b>
                <span className="text-[11px] font-mono text-[var(--text-3)]">22:00 – 06:00</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <strong className="text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
                  {stats.t3.pct}%
                </strong>
                <span className="text-xs text-[var(--text-3)] font-mono">
                  {stats.t3.real}/{stats.t3.prog} OPs
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", stats.t3.pct >= 100 ? "bg-[var(--green)]" : "bg-[var(--accent)]")}
                  style={{ width: `${stats.t3.pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Add Rotas / Receitas */}
          <RotasQuickAdd
            defaultTurno={1}
          />

          {/* Grid Kanban dos 3 Turnos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
            {([1, 2, 3] as ProductionTurno[]).map((turno) => (
              <TurnoColumn
                key={turno}
                turno={turno}
                items={itemsByTurno[turno]}
                onItemClick={(item) => {
                  setModalState({
                    open: true,
                    mode: 'edit',
                    tipo: item.tipo,
                    item,
                    defaultTurno: item.turno,
                    defaultVia: item.via,
                  });
                }}
                onCreateClick={(tipo, via) => {
                  setModalState({
                    open: true,
                    mode: 'create',
                    tipo,
                    item: null,
                    defaultTurno: turno,
                    defaultVia: via || 'UMIDA',
                  });
                }}
                onMove={handleMoveItem}
              />
            ))}
          </div>
        </main>
      </div>

      {/* Modais */}
      {modalState.open && (
        <ProductionItemModal
          open={modalState.open}
          onOpenChange={(open) => setModalState((prev) => ({ ...prev, open }))}
          mode={modalState.mode}
          tipo={modalState.tipo}
          item={modalState.item || undefined}
          defaultTurno={modalState.defaultTurno}
          defaultVia={modalState.defaultVia}
        />
      )}

      {deleteTarget && (
        <ProductionDeleteDialog
          item={deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}

      {clearTurnoTarget !== null && (
        <ClearTurnoDialog
          open={clearTurnoTarget !== null}
          onOpenChange={(open) => !open && setClearTurnoTarget(null)}
          turnoToClear={clearTurnoTarget}
        />
      )}

      {heijunkaOpen && (
        <HeijunkaDialog
          open={heijunkaOpen}
          onOpenChange={setHeijunkaOpen}
          items={items}
        />
      )}
    </div>
  );
}

export default function ProducaoPage() {
  return (
    <ProtectedRoute>
      <ProducaoPageContent />
    </ProtectedRoute>
  );
}
