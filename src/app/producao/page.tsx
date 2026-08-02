"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  Factory, 
  Printer, 
  Wifi, 
  WifiOff, 
  TrendingUp, 
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Search,
  Layers,
  Sparkles,
  X
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ProtectedRoute from '@/components/auth/protected-route';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
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

  const header = clone.querySelector('#producao-print-header') as HTMLElement | null;
  if (header) {
    header.style.display = 'flex';
    header.classList.remove('hidden');
    const dateEl = header.querySelector('[data-print-date]') as HTMLElement | null;
    if (dateEl) dateEl.textContent = new Date().toLocaleString('pt-BR');
  }

  clone.querySelectorAll('button').forEach((b) => b.remove());

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

  // Estados de Visibilidade dos Turnos e Filtros
  const [visibleTurnos, setVisibleTurnos] = useState<ProductionTurno[]>([3, 1, 2]);
  const [cardDetailMode, setCardDetailMode] = useState<'auto' | 'compact' | 'expanded'>('auto');
  const [selectedFamily, setSelectedFamily] = useState<string | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
    tipo: 'ordem',
    defaultTurno: 1,
  });
  const [itemToDelete, setItemToDelete] = useState<ProductionItem | null>(null);
  const [turnoToClear, setTurnoToClear] = useState<ProductionTurno | 'all' | null>(null);
  const [showHeijunka, setShowHeijunka] = useState(false);

  const isAdmin = userData?.email === ADMIN_EMAIL;
  const isLeaderOrAdmin = isAdmin || userData?.role === 'leader';

  useEffect(() => {
    if (!authLoading) {
      if (!userData || !isLeaderOrAdmin) {
        toast.error('Acesso negado. Apenas líderes e administradores podem ver esta página.');
        router.push('/dashboard');
      }
    }
  }, [authLoading, userData, isLeaderOrAdmin, router]);

  // Lista de Famílias únicas
  const familiesAvailable = useMemo(() => {
    const fromWip = getWipFamilies();
    const fromItems = new Set<string>();
    items.forEach((i) => {
      if (i.familia) fromItems.add(i.familia.trim());
    });
    return Array.from(new Set([...fromWip, ...Array.from(fromItems)])).sort();
  }, [items]);

  // Totais Gerais compactos do topo
  const totaisGerais = useMemo(() => {
    const ordens = items.filter(i => i.tipo === 'ordem');
    return {
      real: ordens.reduce((acc, curr) => acc + curr.real, 0),
      prog: ordens.reduce((acc, curr) => acc + curr.prog, 0),
      qtd: ordens.length,
    };
  }, [items]);

  const totaisPDPA = useMemo(() => {
    const pdpaItems = items.filter(i => i.tipo === 'auto' || i.tipo === 'direta');
    return {
      real: pdpaItems.reduce((acc, curr) => acc + curr.real, 0),
      prog: pdpaItems.reduce((acc, curr) => acc + curr.prog, 0),
      qtd: pdpaItems.length,
    };
  }, [items]);

  // Filtro de itens no quadro
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedFamily !== 'ALL') {
        if (!item.familia || item.familia.trim().toUpperCase() !== selectedFamily.toUpperCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const prodMatch = item.produto.toLowerCase().includes(q);
        const codeMatch = item.codigoReceita?.toLowerCase().includes(q);
        const famMatch = item.familia?.toLowerCase().includes(q);
        if (!prodMatch && !codeMatch && !famMatch) return false;
      }
      return true;
    });
  }, [items, selectedFamily, searchQuery]);

  const itemsByTurno = useMemo(() => {
    const map: Record<ProductionTurno, ProductionItem[]> = { 1: [], 2: [], 3: [] };
    filteredItems.forEach((item) => {
      if (map[item.turno]) map[item.turno].push(item);
    });
    return map;
  }, [filteredItems]);

  // Alternar visibilidade do turno
  const toggleTurnoVisibility = (turno: ProductionTurno) => {
    setVisibleTurnos((current) => {
      if (current.includes(turno)) {
        if (current.length === 1) {
          toast('Pelo menos um turno deve permanecer visível.', { icon: 'ℹ️' });
          return current;
        }
        return current.filter((t) => t !== turno);
      } else {
        return [...current, turno];
      }
    });
  };

  const selectOnlyTurno = (turno: ProductionTurno | 'all') => {
    if (turno === 'all') {
      setVisibleTurnos([3, 1, 2]);
    } else {
      setVisibleTurnos([turno]);
    }
  };

  const isExpandedView =
    cardDetailMode === 'expanded' || (cardDetailMode === 'auto' && visibleTurnos.length < 3);

  const openCreateModal = (turno: ProductionTurno, tipo: ProductionTipo, via?: ProductionVia) => {
    setModal({ open: true, mode: 'create', tipo, defaultTurno: turno, defaultVia: via, item: null });
  };

  const openEditModal = (item: ProductionItem) => {
    setModal({ open: true, mode: 'edit', tipo: item.tipo, defaultTurno: item.turno, defaultVia: item.via, item });
  };

  const handleMove = async (itemId: string, destination: { turno: ProductionTurno; via?: ProductionVia }) => {
    try {
      const draggedItem = items.find((i) => i.id === itemId);

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

  const gridColumnsClass =
    visibleTurnos.length === 1
      ? 'grid-cols-1'
      : visibleTurnos.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 lg:grid-cols-3';

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-slate-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300 overflow-hidden">
          <Topbar />
          <main className="flex-1 flex flex-col overflow-hidden px-6 pt-4 pb-3 gap-3">
            {/* ── Topbar Compacto e Limpo ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shrink-0">
                  <Factory className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">Painel de Produção</h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    Programação por turno · Úmida & Seca
                  </p>
                </div>
              </div>

              {/* Indicadores Globais Limpos */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-full shadow-2xs">
                  <span className="text-[11px] font-bold uppercase text-slate-500 mr-0.5">Ordens:</span>
                  <span className="text-sm font-black text-primary tabular-nums">{totaisGerais.real}</span>
                  <span className="text-xs text-slate-400 font-bold">/{totaisGerais.prog}</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-full shadow-2xs">
                  <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400 mr-0.5">PD/PA:</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{totaisPDPA.real}</span>
                  <span className="text-xs text-emerald-700/70 dark:text-emerald-400/70 font-bold">/{totaisPDPA.prog}</span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border',
                    connected
                      ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40'
                      : 'text-muted-foreground bg-muted border-border'
                  )}
                >
                  {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {connected ? 'Ao vivo' : 'Conectando'}
                </div>

                <RotasQuickAdd defaultTurno={visibleTurnos[0] || 1} />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
                  onClick={printPanel}
                  title="Imprimir painel"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>

                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-8"
                  onClick={() => setShowHeijunka(true)}
                  title="Fechar dia de produção e atualizar dashboard"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Lançar Heijunka
                </Button>
              </div>
            </div>

            {/* ── Barra Única de Controles de Exibição & Filtro ── */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-card border border-slate-200 dark:border-border/80 p-2 rounded-xl shadow-2xs shrink-0">
              {/* Seletor de Visibilidade dos Turnos */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 px-1">Ocultar/Exibir Turnos:</span>
                <button
                  type="button"
                  onClick={() => selectOnlyTurno('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                    visibleTurnos.length === 3
                      ? 'bg-primary text-primary-foreground'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  Todos
                </button>

                <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

                {([3, 1, 2] as ProductionTurno[]).map((t) => {
                  const isVisible = visibleTurnos.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTurnoVisibility(t)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border',
                        isVisible
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                      )}
                    >
                      {isVisible ? <Eye className="h-3 w-3 text-sky-400 dark:text-sky-600" /> : <EyeOff className="h-3 w-3 text-slate-400" />}
                      {t}º Turno
                    </button>
                  );
                })}
              </div>

              {/* Filtros Rápido + Modo de Card */}
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                {/* Busca por texto */}
                <div className="relative w-44 sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por produto ou SA..."
                    className="pl-8 text-xs h-7 bg-slate-50 dark:bg-muted/40 border-slate-200 dark:border-border/80 rounded-lg"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Filtro de Família */}
                <Select
                  value={selectedFamily}
                  onValueChange={(val) => setSelectedFamily(val)}
                >
                  <SelectTrigger className="h-7 text-xs w-36 bg-slate-50 dark:bg-muted/40 border-slate-200 dark:border-border/80">
                    <SelectValue placeholder="Todas as Famílias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas Famílias</SelectItem>
                    {familiesAvailable.map((fam) => (
                      <SelectItem key={fam} value={fam}>
                        {fam}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Botão Densidade de Cards */}
                <button
                  type="button"
                  onClick={() => setCardDetailMode(cardDetailMode === 'expanded' ? 'compact' : 'expanded')}
                  className="px-2 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-border/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                  title="Alternar entre modo compacto e expandido dos cards"
                >
                  {isExpandedView ? <Minimize2 className="h-3 w-3 text-primary" /> : <Maximize2 className="h-3 w-3 text-primary" />}
                  <span>{isExpandedView ? 'Expandido' : 'Compacto'}</span>
                </button>
              </div>
            </div>

            {/* ── Grid Principal dos Quadro de Turnos ── */}
            <div id="producao-print-root" className="flex-1 min-h-0 flex flex-col">
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
                <div className={cn('grid gap-4 flex-1 pb-2 print-grid', gridColumnsClass)}>
                  {visibleTurnos.map((t) => (
                    <div key={t} className="rounded-2xl bg-card border border-border/80 animate-pulse print-col" />
                  ))}
                </div>
              ) : (
                <div className={cn('grid gap-4 flex-1 min-h-0 pb-2 print-grid', gridColumnsClass)}>
                  {visibleTurnos.map((turno) => (
                    <div key={turno} className="print-col min-h-0 flex flex-col">
                      <TurnoColumn
                        turno={turno}
                        items={itemsByTurno[turno]}
                        onItemClick={openEditModal}
                        onCreateClick={(tipo, via) => openCreateModal(turno, tipo, via)}
                        onMove={handleMove}
                        isExpandedView={isExpandedView}
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

      <HeijunkaDialog 
        open={showHeijunka} 
        onOpenChange={setShowHeijunka} 
        items={items}
      />
    </ProtectedRoute>
  );
}
