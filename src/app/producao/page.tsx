"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Sparkles,
  Printer,
  Share2,
  Image as ImageIcon,
  Maximize2,
  TrendingUp,
  Plus,
  Search,
  Check,
  MoreVertical,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import ProtectedRoute from '@/components/auth/protected-route';
import { useProductionRealtime } from '@/hooks/useProductionRealtime';
import {
  updateProductionItem,
  moveProductionItem,
  mergeSplitProductionItem,
} from '@/lib/production-helpers';
import { getWipFamilies } from '@/lib/wip-recipes';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import {
  SHIFT_SCHEDULES,
  getShiftPhase,
  getCurrentActiveShift,
  getProductionInsights,
  generateWhatsAppSummary,
  ProductionInsight,
  formatTime,
} from '@/lib/production-schedule';
import { DaySummaryBar } from '@/components/producao/day-summary-bar';
import { ShiftsOverview } from '@/components/producao/shifts-overview';
import { AttentionPoints } from '@/components/producao/attention-points';
import { SideBySideView } from '@/components/producao/side-by-side-view';
import { DetailedReportView } from '@/components/producao/detailed-report-view';
import { ProductionItemModal } from '@/components/producao/production-item-modal';
import { ProductionDeleteDialog } from '@/components/producao/production-delete-dialog';
import { ClearTurnoDialog } from '@/components/producao/clear-turno-dialog';
import { HeijunkaDialog } from '@/components/producao/heijunka-dialog';
import { RotasQuickAdd } from '@/components/producao/rotas-quick-add';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  tipo: ProductionTipo;
  item?: ProductionItem | null;
  defaultTurno: ProductionTurno;
  defaultVia?: ProductionVia;
}

// Carregador assíncrono para html2canvas
function loadHtml2Canvas(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if ((window as any).html2canvas) return Promise.resolve((window as any).html2canvas);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="html2canvas"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).html2canvas));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve((window as any).html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function ProducaoPageContent() {
  const { items, loading } = useProductionRealtime();

  // Relógio e Data em tempo real
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Modo de Visualização ('side' = Lado a lado, 'list' = Detalhado)
  const [viewMode, setViewMode] = useState<'side' | 'list'>('side');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pp_mode');
      if (saved === 'side' || saved === 'list') {
        setViewMode(saved);
      }
    } catch {}
  }, []);

  const handleSetViewMode = (mode: 'side' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('pp_mode', mode);
    } catch {}
  };

  // Turnos selecionados nos chips (ex: [3, 1, 2])
  const [visibleShifts, setVisibleShifts] = useState<ProductionTurno[]>([3, 1, 2]);

  // Filtros da Toolbar
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('');
  const [selectedVia, setSelectedVia] = useState<string>('');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Estados dos Modais
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    mode: 'create',
    tipo: 'ordem',
    item: null,
    defaultTurno: 1,
    defaultVia: 'UMIDA',
  });

  const [deleteTarget, setDeleteTarget] = useState<ProductionItem | null>(null);
  const [clearTurnoTarget, setClearTurnoTarget] = useState<ProductionTurno | 'all' | null>(null);
  const [heijunkaOpen, setHeijunkaOpen] = useState(false);
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  // Famílias disponíveis combinadas (WIP Recipes + famílias usadas nos itens)
  const familiesAvailable = useMemo(() => {
    const wip = getWipFamilies();
    const fromItems = items
      .map((i) => i.familia)
      .filter((f): f is string => Boolean(f && f.trim()));
    const unique = Array.from(new Set([...wip, ...fromItems])).sort();
    return unique;
  }, [items]);

  // Turno atual ativo
  const currentShift = useMemo(() => getCurrentActiveShift(now), [now]);

  // Insights / Pontos de atenção
  const insights = useMemo(() => getProductionInsights(items, now), [items, now]);

  // Chips de Turno
  const handleToggleShiftChip = (turno: ProductionTurno | 'all') => {
    if (turno === 'all') {
      if (visibleShifts.length === 3) {
        // Se todos já estão ativos, desativa e deixa apenas o atual ou 1º
        const target = currentShift ? currentShift.n : 1;
        setVisibleShifts([target]);
      } else {
        setVisibleShifts([3, 1, 2]);
      }
      return;
    }

    if (visibleShifts.includes(turno)) {
      if (visibleShifts.length > 1) {
        setVisibleShifts(visibleShifts.filter((t) => t !== turno));
      }
    } else {
      setVisibleShifts([...visibleShifts, turno].sort((a, b) => {
        const order = [3, 1, 2];
        return order.indexOf(a) - order.indexOf(b);
      }));
    }
  };

  // Ajuste rápido de quantidade (+ / -) com persistência em tempo real
  const handleUpdateQty = async (item: ProductionItem, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.locked) {
      toast.error('Este item está travado por divisão de ordem.');
      return;
    }
    const newReal = Math.max(0, Math.min(item.prog, item.real + delta));
    if (newReal === item.real) return;

    try {
      await updateProductionItem(item.id, { real: newReal });
    } catch (err) {
      toast.error('Falha ao atualizar quantidade.');
    }
  };

  // Arrastar e soltar (drag & drop)
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
          toast.success('Itens mesclados de volta com sucesso!');
          return;
        } catch {
          toast.error('Falha ao mesclar item dividido.');
          return;
        }
      }
    }

    try {
      await moveProductionItem(itemId, destination);
      toast.success('Item transferido com sucesso');
    } catch {
      toast.error('Erro ao mover item.');
    }
  };

  // Scroll e destaque suave até o item ao clicar num Ponto de Atenção
  const handleSelectInsight = useCallback((insight: ProductionInsight) => {
    if (!visibleShifts.includes(insight.turno)) {
      setVisibleShifts((prev) => [...prev, insight.turno]);
    }

    setTimeout(() => {
      const el = document.getElementById(insight.targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('flash-highlight');
        void el.offsetWidth;
        el.classList.add('flash-highlight');
      }
    }, 80);
  }, [visibleShifts]);

  // Exportação para WhatsApp
  const handleExportWhatsApp = async () => {
    const text = generateWhatsAppSummary(items, now);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Resumo copiado para a área de transferência! Cole no WhatsApp.', {
        icon: '📋',
      });
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast.success('Resumo copiado!');
    }
  };

  // Geração de Imagem PNG (Screenshot de alta qualidade)
  const handleGenerateImage = async () => {
    const reportEl = document.getElementById('report-panel');
    if (!reportEl) return;

    const toastId = toast.loading('Gerando imagem do painel...');
    const wasCapture = document.body.classList.contains('capture');

    try {
      const html2canvas = await loadHtml2Canvas();
      document.body.classList.add('capture');

      await new Promise((r) => setTimeout(r, 100));
      const bg = getComputedStyle(document.body).backgroundColor || '#0e1013';

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        backgroundColor: bg,
        ignoreElements: (element: Element) => element.classList.contains('no-print'),
      });

      if (!wasCapture) {
        document.body.classList.remove('capture');
      }

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          toast.error('Erro ao gerar imagem.', { id: toastId });
          return;
        }

        try {
          // Tenta copiar direto para a área de transferência
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Imagem copiada! Cole direto no WhatsApp (Ctrl+V)', { id: toastId, icon: '🖼️' });
        } catch {
          // Fallback: download da imagem
          const a = document.createElement('a');
          const fileName = `painel_producao_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${formatTime(now).replace(':', '')}.png`;
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast.success('Imagem baixada com sucesso!', { id: toastId });
        }
      }, 'image/png');
    } catch (err) {
      if (!wasCapture) document.body.classList.remove('capture');
      toast.error('Não foi possível gerar a imagem. Use o Modo Captura e Win+Shift+S.', { id: toastId });
    }
  };

  // Modo Captura (tela limpa e fullscreen para prints/projeções)
  const toggleCaptureMode = () => {
    if (!isCaptureMode) {
      setIsCaptureMode(true);
      document.body.classList.add('capture');
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
      toast('Modo Captura ativado. Pressione ESC para sair.', { icon: '🔍' });
    } else {
      setIsCaptureMode(false);
      document.body.classList.remove('capture');
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
    }
  };

  // Monitora a tecla ESC e fullscreenchange para sair do modo captura
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.body.classList.contains('capture') && !modalState.open) {
        setIsCaptureMode(false);
        document.body.classList.remove('capture');
      }
    };
    const handleFsChange = () => {
      if (!document.fullscreenElement && document.body.classList.contains('capture')) {
        setIsCaptureMode(false);
        document.body.classList.remove('capture');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [modalState.open]);

  // Impressão / PDF
  const handlePrint = () => {
    window.print();
  };

  // Abertura do modal de criação de ordem
  const handleOpenCreateOrder = (turno?: ProductionTurno, via?: ProductionVia) => {
    const defaultT = turno || (currentShift ? currentShift.n : 1);
    setModalState({
      open: true,
      mode: 'create',
      tipo: 'ordem',
      item: null,
      defaultTurno: defaultT,
      defaultVia: via || 'UMIDA',
    });
  };

  // Dias da semana e meses em português
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* App Sidebar Rail */}
      <div className="app-sidebar">
        <Sidebar />
      </div>

      {/* Conteúdo Principal com Topbar */}
      <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
        <div className="app-topbar">
          <Topbar />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 main-content-area" id="main-scroll">
          {/* Cabeçalho da Página */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-1 no-print">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                Painel de produção
              </h1>
              <p className="text-xs text-[var(--text-3)] mt-0.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
                <span>
                  Programação de {DIAS_CURTO[now.getDay()]}, {String(now.getDate()).padStart(2, '0')}/{String(now.getMonth() + 1).padStart(2, '0')} · úmida, seca e PD/PA ·{' '}
                  <b className="font-medium text-[var(--text-2)]">
                    {currentShift ? `${currentShift.l} em andamento` : 'fora de turno'}
                  </b>
                </span>
              </p>
            </div>

            {/* Ações do Topo */}
            <div className="flex items-center gap-2 flex-wrap actions-panel">
              {/* Grupo Segmentado de Compartilhamento / Exportação */}
              <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-2xs">
                {/* <button
                  type="button"
                  onClick={handleExportWhatsApp}
                  className="h-8 px-2.5 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] border-r border-[var(--border-strong)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copia um resumo formatado para colar no WhatsApp"
                >
                  <Share2 size={13} className="text-[#25D366]" />
                  <span>WhatsApp</span>
                </button> */}

                <button
                  type="button"
                  onClick={handleGenerateImage}
                  className="h-8 px-2.5 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] border-r border-[var(--border-strong)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Gera uma imagem do painel para copiar ou baixar"
                >
                  <ImageIcon size={13} />
                  <span>Imagem</span>
                </button>

                <button
                  type="button"
                  onClick={toggleCaptureMode}
                  className={cn(
                    "h-8 px-2.5 text-xs font-medium border-r border-[var(--border-strong)] flex items-center gap-1.5 transition-colors cursor-pointer",
                    isCaptureMode ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
                  )}
                  title="Tela limpa para print ou projeção (ESC para sair)"
                >
                  <Maximize2 size={13} />
                  <span>Captura</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-8 px-2.5 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Imprimir ou salvar em PDF"
                >
                  <Printer size={13} />
                  <span>PDF</span>
                </button>
              </div>

              {/* Pesquisar Rotas / Receitas */}
              {/* <RotasQuickAdd
                defaultTurno={currentShift ? currentShift.n : 1}
                triggerButton={
                  <button
                    type="button"
                    className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Sparkles size={13} className="text-[var(--accent)]" />
                    <span>Pesquisar rotas</span>
                  </button>
                }
              /> */}

              {/* Heijunka */}
              <button
                type="button"
                onClick={() => setHeijunkaOpen(true)}
                className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <TrendingUp size={13} />
                <span>Lançar Heijunka</span>
              </button>

              {/* Adicionar Ordem Principal */}
              <button
                type="button"
                onClick={() => handleOpenCreateOrder()}
                className="h-8 px-3.5 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>Ordem</span>
              </button>

              {/* Menu Extra (Limpar Quadro / Turnos) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] flex items-center justify-center cursor-pointer shadow-2xs"
                    title="Mais opções do quadro"
                  >
                    <MoreVertical size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs">Gerenciar Quadro</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setClearTurnoTarget(1)}
                    className="text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Limpar 1º Turno</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setClearTurnoTarget(2)}
                    className="text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Limpar 2º Turno</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setClearTurnoTarget(3)}
                    className="text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Limpar 3º Turno</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setClearTurnoTarget('all')}
                    className="text-xs text-[var(--red)] focus:text-[var(--red)] flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Limpar quadro inteiro</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Toolbar de Filtros e Modos */}
          <div className="flex items-center gap-2 flex-wrap no-print toolbar-container text-xs">
            {/* Seletor de Modo: Lado a Lado | Detalhado */}
            <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleSetViewMode('side')}
                className={cn(
                  "h-7 px-3 font-medium transition-colors cursor-pointer border-r border-[var(--border-strong)]",
                  viewMode === 'side'
                    ? "bg-[var(--hover)] text-[var(--text)]"
                    : "text-[var(--text-3)] hover:text-[var(--text)]"
                )}
              >
                Lado a lado
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('list')}
                className={cn(
                  "h-7 px-3 font-medium transition-colors cursor-pointer",
                  viewMode === 'list'
                    ? "bg-[var(--hover)] text-[var(--text)]"
                    : "text-[var(--text-3)] hover:text-[var(--text)]"
                )}
              >
                Detalhado
              </button>
            </div>

            <span className="w-[1px] h-5 bg-[var(--border)] mx-1" />

            {/* Chips de Turno */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleToggleShiftChip('all')}
                className={cn(
                  "h-7 px-2.5 rounded-full border border-[var(--border-strong)] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                  visibleShifts.length === 3
                    ? "bg-[var(--hover)] text-[var(--text)]"
                    : "text-[var(--text-3)] hover:text-[var(--text)]"
                )}
              >
                <span
                  className={cn(
                    "w-3 h-3 rounded-[3px] border border-[var(--text-3)] flex items-center justify-center text-[9px]",
                    visibleShifts.length === 3 && "bg-[var(--text)] border-[var(--text)] text-[var(--bg)] font-bold"
                  )}
                >
                  {visibleShifts.length === 3 && <Check size={8} strokeWidth={3} />}
                </span>
                <span>Todos</span>
              </button>

              {SHIFT_SCHEDULES.map((s) => {
                const isActive = visibleShifts.includes(s.n);
                return (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => handleToggleShiftChip(s.n)}
                    className={cn(
                      "h-7 px-2.5 rounded-full border border-[var(--border-strong)] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                      isActive
                        ? "bg-[var(--hover)] text-[var(--text)]"
                        : "text-[v1ar(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    <span
                      className={cn(
                        "w-3 h-3 rounded-[3px] border border-[var(--text-3)] flex items-center justify-center text-[9px]",
                        isActive && "bg-[var(--text)] border-[var(--text)] text-[var(--bg)] font-bold"
                      )}
                    >
                      {isActive && <Check size={8} strokeWidth={3} />}
                    </span>
                    <span>{s.l}</span>
                  </button>
                );
              })}
            </div>

            <span className="w-[1px] h-5 bg-[var(--border)] mx-1" />

            {/* Busca Rápida */}
            <label className="h-8 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] flex items-center gap-2 text-[var(--text-3)] focus-within:border-[var(--accent)] w-56 transition-colors shadow-2xs">
              <Search size={13} className="shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Produto, código ou máquina"
                className="bg-transparent border-0 outline-none text-xs text-[var(--text)] placeholder:text-[var(--text-3)] w-full"
              />
            </label>

            {/* Filtro de Família */}
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="h-8 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text-2)] focus:border-[var(--accent)] outline-none cursor-pointer shadow-2xs"
            >
              <option value="">Todas as famílias</option>
              {familiesAvailable.map((fam) => (
                <option key={fam} value={fam}>
                  {fam}
                </option>
              ))}
            </select>

            {/* Filtro de Via */}
            <select
              value={selectedVia}
              onChange={(e) => setSelectedVia(e.target.value)}
              className="h-8 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text-2)] focus:border-[var(--accent)] outline-none cursor-pointer shadow-2xs"
            >
              <option value="">Úmida e seca</option>
              <option value="umida">Só úmida</option>
              <option value="seca">Só seca</option>
            </select>

            {/* Checkbox Ocultar Concluídas */}
            <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)] cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-0 cursor-pointer accent-[var(--accent)]"
              />
              <span>Ocultar concluídas</span>
            </label>
          </div>

          {/* Área Principal de Relatório e Visualização */}
          <div id="report-panel" className="space-y-4">
            {/* Carimbo Estratégico de Data e Hora da Produção (Visível no Painel, Imagem e Impressão) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] grid place-items-center font-bold text-xs font-mono shrink-0">
                  AW
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[var(--text)] leading-none">
                      Painel de Produção · Pesagem
                    </h2>
                    {currentShift && (
                      <span className="px-2 py-0.5 rounded-[4px] border border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)] font-semibold text-[10.5px] font-mono leading-none">
                        {currentShift.l}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-[var(--text-3)] mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
                    <span>Programação do dia · {items.filter(x => x.tipo === 'ordem').length} ordens monitoradas</span>
                  </p>
                </div>
              </div>

              {/* Data e Hora em Destaque */}
              <div className="flex items-start sm:items-end flex-col bg-[var(--surface-2)] sm:bg-transparent p-2 sm:p-0 rounded-[6px] border sm:border-0 border-[var(--border)]">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-2)]">
                  <svg className="w-3.5 h-3.5 text-[var(--text-3)] stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  <span className="font-medium text-[var(--text)]">
                    {DIAS[now.getDay()]}, {String(now.getDate()).padStart(2, '0')}/{String(now.getMonth() + 1).padStart(2, '0')}/{now.getFullYear()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-[var(--accent)] stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="font-mono text-sm font-bold text-[var(--text)] tracking-wider">
                    {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}:{String(now.getSeconds()).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-[var(--text-3)] font-mono">
                    (Ao vivo)
                  </span>
                </div>
              </div>
            </div>

            {/* 1. Totais do Dia (Daybar) */}
            <DaySummaryBar items={items} now={now} />

            {/* 2. Visão Geral dos 3 Turnos (Cards de Resumo) */}
            <ShiftsOverview
              items={items}
              now={now}
              onShiftClick={(turno) => {
                if (!visibleShifts.includes(turno)) {
                  setVisibleShifts((prev) => [...prev, turno]);
                }
                setTimeout(() => {
                  const el = document.getElementById(`sh-${turno}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
              }}
            />

            {/* 3. Visualização Principal: Lado a Lado OU Detalhado */}
            {viewMode === 'side' ? (
              <SideBySideView
                items={items}
                visibleShifts={visibleShifts}
                now={now}
                searchQuery={searchQuery}
                selectedFamily={selectedFamily || null}
                selectedVia={selectedVia || null}
                hideCompleted={hideCompleted}
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
                onAddClick={handleOpenCreateOrder}
                onUpdateQty={handleUpdateQty}
                onMoveItem={handleMoveItem}
              />
            ) : (
              <DetailedReportView
                items={items}
                visibleShifts={visibleShifts}
                now={now}
                searchQuery={searchQuery}
                selectedFamily={selectedFamily || null}
                selectedVia={selectedVia || null}
                hideCompleted={hideCompleted}
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
                onAddClick={handleOpenCreateOrder}
                onUpdateQty={handleUpdateQty}
              />
            )}

            {/* 4. Pontos de Atenção (Insights Operacionais Automáticos) */}
            <AttentionPoints insights={insights} onSelectInsight={handleSelectInsight} />

            {/* Carimbo de Auditoria e Snapshot (Visível no Painel, Imagem e Impressão) */}
            <div className="pt-2 pb-1 text-[11px] text-[var(--text-3)] font-mono border-t border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                <span>AgileWork · Módulo de Pesagem & Produção</span>
              </span>
              <span>
                Snapshot emitido em {String(now.getDate()).padStart(2, '0')}/{String(now.getMonth() + 1).padStart(2, '0')}/{now.getFullYear()} às {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}:{String(now.getSeconds()).padStart(2, '0')}
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* Modais de Gerenciamento e Diálogos */}
      {modalState.open && (
        <ProductionItemModal
          open={modalState.open}
          onOpenChange={(open) => setModalState((prev) => ({ ...prev, open }))}
          mode={modalState.mode}
          tipo={modalState.tipo}
          item={modalState.item || undefined}
          defaultTurno={modalState.defaultTurno}
          defaultVia={modalState.defaultVia}
          allItems={items}
          onRequestDelete={(it) => {
            setModalState((prev) => ({ ...prev, open: false }));
            setDeleteTarget(it);
          }}
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
