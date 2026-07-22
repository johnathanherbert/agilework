"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Eraser, Factory, Printer, Wifi, WifiOff } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ProtectedRoute from '@/components/auth/protected-route';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { useProductionRealtime } from '@/hooks/useProductionRealtime';
import { moveProductionItem, mergeSplitProductionItem } from '@/lib/production-helpers';
import { TurnoColumn } from '@/components/producao/turno-column';
import { ProductionItemModal } from '@/components/producao/production-item-modal';
import { ProductionDeleteDialog } from '@/components/producao/production-delete-dialog';
import { ClearTurnoDialog } from '@/components/producao/clear-turno-dialog';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import { cn } from '@/lib/utils';

const TURNOS: ProductionTurno[] = [3, 1, 2];

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

  // Coleta todos os estilos da página atual (inline + externos)
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

  // Clona o painel e ajusta para impressão
  const clone = el.cloneNode(true) as HTMLElement;

  // Mostra o header de impressão
  const header = clone.querySelector('#producao-print-header') as HTMLElement | null;
  if (header) {
    header.style.display = 'flex';
    header.classList.remove('hidden');
    // Atualiza a data no momento da impressão
    const dateEl = header.querySelector('[data-print-date]') as HTMLElement | null;
    if (dateEl) dateEl.textContent = new Date().toLocaleString('pt-BR');
  }

  // Remove todos os botões
  clone.querySelectorAll('button').forEach((b) => b.remove());

  // Expande todas as zonas com scroll
  clone.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const s = el.style;
    s.overflow = 'visible';
    s.maxHeight = 'none';
    if (s.height && s.height !== 'auto' && s.height !== '100%') s.height = 'auto';
  });

  pw.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Painel de Produção — ${new Date().toLocaleDateString('pt-BR')}</title>
      ${linkTags}
      <style>
        ${styleSheetText}
        @page { size: A4 landscape; margin: 10mm 8mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { background: white !important; margin: 0; padding: 12px; }
        #producao-print-root { display: flex; flex-direction: column; gap: 12px; }
        #producao-print-header { display: flex !important; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1.5px solid #0066B3; margin-bottom: 8px; }
        .print-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 12px !important; align-items: start !important; height: auto !important; }
        .print-col { height: auto !important; overflow: visible !important; display: flex; flex-direction: column; }
        .print-col > * { height: auto !important; overflow: visible !important; max-height: none !important; flex: none !important; }
        button { display: none !important; }
      </style>
    </head>
    <body>
      ${clone.outerHTML}
    </body>
    </html>
  `);
  pw.document.close();

  pw.addEventListener('load', () => {
    setTimeout(() => {
      pw.focus();
      pw.print();
    }, 300);
  });
}

export default function ProducaoPage() {
  const { userData, loading: authLoading } = useFirebase();
  const router = useRouter();
  const { items, loading, connected } = useProductionRealtime();

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
    tipo: 'ordem',
    defaultTurno: 1,
  });
  const [itemToDelete, setItemToDelete] = useState<ProductionItem | null>(null);
  const [turnoToClear, setTurnoToClear] = useState<ProductionTurno | 'all' | null>(null);

  const isLeaderOrAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'leader';

  // Guarda de acesso: somente líderes e o admin global podem ver esta página
  useEffect(() => {
    if (!authLoading) {
      if (!userData || !isLeaderOrAdmin) {
        toast.error('Acesso negado. Apenas líderes e administradores podem ver esta página.');
        router.push('/dashboard');
      }
    }
  }, [authLoading, userData, isLeaderOrAdmin, router]);

  const itemsByTurno = useMemo(() => {
    const map: Record<ProductionTurno, ProductionItem[]> = { 1: [], 2: [], 3: [] };
    items.forEach((item) => {
      if (map[item.turno]) map[item.turno].push(item);
    });
    return map;
  }, [items]);

  const totaisGerais = useMemo(() => {
    const ordens = items.filter(i => i.tipo === 'ordem');
    return {
      real: ordens.reduce((acc, curr) => acc + curr.real, 0),
      prog: ordens.reduce((acc, curr) => acc + curr.prog, 0),
      qtd: ordens.length,
    };
  }, [items]);

  const openCreateModal = (turno: ProductionTurno, tipo: ProductionTipo, via?: ProductionVia) => {
    setModal({ open: true, mode: 'create', tipo, defaultTurno: turno, defaultVia: via, item: null });
  };

  const openEditModal = (item: ProductionItem) => {
    setModal({ open: true, mode: 'edit', tipo: item.tipo, defaultTurno: item.turno, defaultVia: item.via, item });
  };

  const handleMove = async (itemId: string, destination: { turno: ProductionTurno; via?: ProductionVia }) => {
    try {
      const draggedItem = items.find((i) => i.id === itemId);

      // Se o item arrastado é o "filho" de uma ordem dividida e está sendo solto
      // de volta no turno/via de origem do "pai", mescla ao invés de mover
      if (draggedItem?.splitParentId) {
        const parentItem = items.find((i) => i.id === draggedItem.splitParentId);
        if (parentItem && parentItem.turno === destination.turno && parentItem.via === destination.via) {
          await mergeSplitProductionItem(parentItem.id, draggedItem.id);
          toast.success('Ordem mesclada de volta ao turno de origem!');
          return;
        }
      }

      await moveProductionItem(itemId, destination);
    } catch (error: any) {
      console.error('Erro ao mover item:', error);
      toast.error(error.message || 'Erro ao mover o item');
    }
  };

  if (authLoading || !userData || !isLeaderOrAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        {/* flex-col + overflow-hidden: cabeçalho fixo, main ocupa o restante */}
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300 overflow-hidden">
          <Topbar />
          <main className="flex-1 flex flex-col overflow-hidden px-6 pt-5 pb-0 gap-4">
            {/* ── Cabeçalho ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shrink-0">
                  <Factory className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">Painel de Produção</h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    Programação de pesagem por turno.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-full shadow-sm mr-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mr-1">Total Geral:</span>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-sm font-extrabold text-primary leading-none">{totaisGerais.real}</span>
                    <span className="text-[11px] font-medium text-slate-400 dark:text-muted-foreground leading-none">/{totaisGerais.prog}</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-muted-foreground ml-1 border-l border-slate-200 dark:border-border/80 pl-2">
                    {totaisGerais.qtd} {totaisGerais.qtd === 1 ? 'produto' : 'produtos'}
                  </span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border',
                    connected
                      ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40'
                      : 'text-muted-foreground bg-muted border-border'
                  )}
                >
                  {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {connected ? 'Tempo real ativo' : 'Conectando...'}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={printPanel}
                  title="Imprimir painel de produção"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                      title="Limpar itens do quadro"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      Limpar Turno
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setTurnoToClear(1)} className="cursor-pointer">
                      Limpar 1º Turno
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTurnoToClear(2)} className="cursor-pointer">
                      Limpar 2º Turno
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTurnoToClear(3)} className="cursor-pointer">
                      Limpar 3º Turno
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setTurnoToClear('all')} 
                      className="cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground font-medium"
                    >
                      Limpar Todos os Turnos
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* ── Grid de colunas com scroll interno por coluna ── */}
            <div id="producao-print-root" className="flex-1 min-h-0 flex flex-col">
              {/* Cabeçalho visível apenas na janela de impressão (manipulado via JS) */}
              <div id="producao-print-header" className="hidden">
                <div>
                  <p className="text-lg font-bold" style={{ color: '#0066B3' }}>Painel de Produção</p>
                  <p className="text-sm text-gray-500">Programação de pesagem por turno · Via Úmida e Via Seca</p>
                </div>
                <p className="text-xs text-gray-400" data-print-date>
                  {new Date().toLocaleString('pt-BR')}
                </p>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 pb-6 print-grid">
                  {TURNOS.map((t) => (
                    <div key={t} className="rounded-xl bg-card border border-border/80 animate-pulse print-col" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 pb-6 print-grid">
                  {TURNOS.map((turno) => (
                    <div key={turno} className="print-col min-h-0 flex flex-col">
                      <TurnoColumn
                        turno={turno}
                        items={itemsByTurno[turno]}
                        onItemClick={openEditModal}
                        onCreateClick={(tipo, via) => openCreateModal(turno, tipo, via)}
                        onMove={handleMove}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <ProductionItemModal
        open={modal.open}
        onOpenChange={(open) => setModal((m) => ({ ...m, open }))}
        mode={modal.mode}
        tipo={modal.tipo}
        item={modal.item}
        defaultTurno={modal.defaultTurno}
        defaultVia={modal.defaultVia}
        onRequestDelete={(item) => {
          setModal((m) => ({ ...m, open: false }));
          setItemToDelete(item);
        }}
      />

      <ProductionDeleteDialog
        item={itemToDelete}
        onOpenChange={(open) => {
          if (!open) setItemToDelete(null);
        }}
      />

      <ClearTurnoDialog 
        open={turnoToClear !== null} 
        onOpenChange={(open) => { if (!open) setTurnoToClear(null); }} 
        turnoToClear={turnoToClear}
      />
    </ProtectedRoute>
  );
}
