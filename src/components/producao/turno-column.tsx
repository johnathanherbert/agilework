"use client";

import { useState } from 'react';
import { 
  Plus, 
  Lock, 
  GitBranch, 
  GripVertical, 
  Zap, 
  Hand, 
  Droplets, 
  Wind, 
  ClipboardList,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import { findWipRecipeByProduct, findWipRecipeByCode } from '@/lib/wip-recipes';

interface DragPayload {
  itemId: string;
  tipo: ProductionTipo;
  via?: ProductionVia;
}

interface TurnoColumnProps {
  turno: ProductionTurno;
  items: ProductionItem[];
  onItemClick: (item: ProductionItem) => void;
  onCreateClick: (tipo: ProductionTipo, via?: ProductionVia) => void;
  onMove: (itemId: string, destination: { turno: ProductionTurno; via?: ProductionVia }) => void;
  isExpandedView?: boolean;
}

const turnoLabels: Record<ProductionTurno, string> = {
  1: '1º Turno',
  2: '2º Turno',
  3: '3º Turno',
};

const badgeBase = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold leading-none';

/** Badge de progresso por item (Real / Prog) com números ampliados */
function IndicadorRealProg({ real, prog }: { real: number; prog: number }) {
  const completo = prog > 0 && real >= prog;
  return (
    <Badge
      variant="outline"
      className={cn(
        badgeBase,
        'whitespace-nowrap shrink-0 tabular-nums font-black shadow-2xs transition-colors',
        completo
          ? 'border-[#003760] bg-[#003760] text-white dark:border-blue-500 dark:bg-blue-600'
          : 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
      )}
      title={`Realizado ${real} de ${prog} programado`}
    >
      {real}/{prog}
    </Badge>
  );
}

export function TurnoColumn({
  turno,
  items,
  onItemClick,
  onCreateClick,
  onMove,
  isExpandedView = false,
}: TurnoColumnProps) {
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const ordens = items.filter((i) => i.tipo === 'ordem');
  const umida = ordens.filter((i) => i.via === 'UMIDA');
  const seca = ordens.filter((i) => i.via === 'SECA');
  const auto = items.filter((i) => i.tipo === 'auto');
  const direta = items.filter((i) => i.tipo === 'direta');

  const umidaReal = umida.reduce((a, c) => a + c.real, 0);
  const umidaProg = umida.reduce((a, c) => a + c.prog, 0);
  const umidaPct = umidaProg > 0 ? Math.min(Math.round((umidaReal / umidaProg) * 100), 100) : 0;

  const secaReal = seca.reduce((a, c) => a + c.real, 0);
  const secaProg = seca.reduce((a, c) => a + c.prog, 0);
  const secaPct = secaProg > 0 ? Math.min(Math.round((secaReal / secaProg) * 100), 100) : 0;

  const totalReal = umidaReal + secaReal;
  const totalProg = umidaProg + secaProg;
  const totalPct = totalProg > 0 ? Math.min(Math.round((totalReal / totalProg) * 100), 100) : 0;
  const totalOrdens = ordens.length;

  const pdpaItems = [...auto, ...direta];
  const pdpaReal = pdpaItems.reduce((a, c) => a + c.real, 0);
  const pdpaProg = pdpaItems.reduce((a, c) => a + c.prog, 0);
  const pdpaPct = pdpaProg > 0 ? Math.min(Math.round((pdpaReal / pdpaProg) * 100), 100) : 0;

  // Distribui o espaço vertical entre o quadro de Ordens e o de PD/PA
  // proporcionalmente à quantidade de itens de cada um, para aproveitar melhor a tela.
  const ordensWeight = totalOrdens + 1;
  const pdpaWeight = pdpaItems.length + 1;

  const handleDragStart = (e: React.DragEvent, item: ProductionItem) => {
    const payload: DragPayload = { itemId: item.id, tipo: item.tipo, via: item.via };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (
    e: React.DragEvent,
    zoneKey: string,
    expectedTipo: ProductionTipo,
    destination: { turno: ProductionTurno; via?: ProductionVia }
  ) => {
    e.preventDefault();
    setDragOverZone(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload: DragPayload = JSON.parse(raw);
      if (payload.tipo !== expectedTipo) return;
      if (expectedTipo === 'ordem' && destination.via && payload.via && payload.via !== destination.via) {
        toast.error('Não é possível mover uma ordem entre vias diferentes (Úmida/Seca)');
        return;
      }
      onMove(payload.itemId, destination);
    } catch (err) {
      console.error('Erro ao processar drop:', err);
    }
  };

  /** Renderiza Card de Ordem */
  const renderOrdemCard = (item: ProductionItem) => {
    const completo = item.prog > 0 && item.real >= item.prog;
    const emAndamento = item.real > 0 && item.real < item.prog;
    const isHovered = hoveredCard === item.id;
    const pct = item.prog > 0 ? Math.min(Math.round((item.real / item.prog) * 100), 100) : 0;

    const recipe = item.codigoReceita 
      ? findWipRecipeByCode(item.codigoReceita) 
      : findWipRecipeByProduct(item.produto);

    const codigoSA = item.codigoReceita || recipe?.codigo;
    const familia = item.familia || recipe?.familia;

    if (isExpandedView) {
      return (
        <div
          key={item.id}
          draggable={!item.locked}
          onDragStart={(e) => !item.locked && handleDragStart(e, item)}
          onMouseEnter={() => setHoveredCard(item.id)}
          onMouseLeave={() => setHoveredCard(null)}
          onClick={() => onItemClick(item)}
          className={cn(
            'p-2.5 rounded-md border border-l-4 cursor-pointer transition-colors duration-150 select-none group flex flex-col gap-1',
            item.locked
              ? 'bg-slate-100/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 border-l-slate-500 opacity-90'
              : completo
              ? 'bg-white dark:bg-card border-slate-200 dark:border-border/80 border-l-slate-800 dark:border-l-slate-400 hover:bg-slate-50 dark:hover:bg-muted/10'
              : emAndamento
              ? 'bg-white dark:bg-card border-slate-200 dark:border-border/80 border-l-amber-500 hover:bg-slate-50 dark:hover:bg-muted/10'
              : 'bg-white dark:bg-card border-slate-200 dark:border-border/80 border-l-slate-300 dark:border-l-slate-700 hover:border-slate-400'
          )}
        >
          {/* Header do Card Expandido */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 min-w-0">
              {!item.locked && (
                <GripVertical
                  className={cn(
                    'h-3.5 w-3.5 text-slate-300 transition-opacity shrink-0',
                    isHovered ? 'opacity-100' : 'opacity-40'
                  )}
                />
              )}
              {item.locked && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
              {item.splitParentId && <GitBranch className="h-3.5 w-3.5 text-slate-500 shrink-0" />}

              {familia && (
                <span className={cn(badgeBase, 'max-w-[130px] shrink-0 truncate uppercase tracking-wide border-slate-200 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300')}>
                  {familia}
                </span>
              )}

              {codigoSA && (
                <span className={cn(badgeBase, 'shrink-0 font-mono font-extrabold border-slate-200 bg-slate-100/90 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400')}>
                  {codigoSA}
                </span>
              )}
            </div>

            <IndicadorRealProg real={item.real} prog={item.prog} />
          </div>

          {/* Nome do Produto */}
          <span className="text-xs font-bold text-slate-800 dark:text-foreground leading-snug truncate">
            {item.produto}
          </span>

          {/* Barra de Progresso + Status */}
          <div className="space-y-0.5 pt-0.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>
                {completo ? (
                  <span className="text-slate-800 dark:text-slate-200 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3 text-slate-600 dark:text-slate-400" /> Concluído
                  </span>
                ) : emAndamento ? (
                  <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-0.5">
                    <Clock className="h-3 w-3 text-amber-500" /> Em andamento
                  </span>
                ) : (
                  <span className="text-slate-400">Pendente</span>
                )}
              </span>
              <span className="font-black text-xs tabular-nums">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300 rounded-full',
                  completo
                    ? 'bg-slate-700 dark:bg-slate-400'
                    : emAndamento
                    ? 'bg-amber-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Modo Compacto
    return (
      <div
        key={item.id}
        draggable={!item.locked}
        onDragStart={(e) => !item.locked && handleDragStart(e, item)}
        onMouseEnter={() => setHoveredCard(item.id)}
        onMouseLeave={() => setHoveredCard(null)}
        onClick={() => onItemClick(item)}
        title={
          item.locked
            ? 'Ordem dividida — bloqueada'
            : `${item.produto}${familia ? ` · ${familia}` : ''}${codigoSA ? ` · SA: ${codigoSA}` : ''}`
        }
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-l-[3px] cursor-pointer transition-colors duration-150 select-none group',
          item.locked
            ? 'bg-slate-100/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 border-l-slate-500 opacity-80 cursor-not-allowed'
            : completo
            ? 'bg-white dark:bg-card border-slate-200 dark:border-border/80 border-l-slate-700 dark:border-l-slate-400 hover:bg-slate-50 dark:hover:bg-muted/10'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/80 border-l-slate-300 dark:border-l-slate-700 hover:border-slate-400 active:cursor-grabbing'
        )}
      >
        <div className="flex items-center gap-0.5 shrink-0">
          {item.locked && <Lock className="h-2.5 w-2.5 text-slate-500" />}
          {item.splitParentId && <GitBranch className="h-2.5 w-2.5 text-slate-500" />}
          {!item.locked && (
            <GripVertical
              className={cn(
                'h-3 w-3 text-slate-300 transition-opacity duration-100',
                isHovered ? 'opacity-100' : 'opacity-0'
              )}
            />
          )}
        </div>

        {familia && (
          <span className={cn(badgeBase, 'max-w-[90px] shrink-0 truncate uppercase tracking-wide border-slate-200 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300')}>
            {familia}
          </span>
        )}

        <span
          className="text-[11px] font-bold text-slate-800 dark:text-foreground truncate flex-1 leading-tight"
          title={item.produto}
        >
          {item.produto}
        </span>

        {completo && <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">✓</span>}

        <IndicadorRealProg real={item.real} prog={item.prog} />
      </div>
    );
  };

  /** Card PA/PD */
  const renderExtraCard = (item: ProductionItem) => {
    const completo = item.prog > 0 && item.real >= item.prog;
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item)}
        onClick={() => onItemClick(item)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-l-[3px] cursor-pointer transition-colors duration-150 select-none',
          completo
            ? 'bg-white dark:bg-card border-slate-200 dark:border-border/80 border-l-slate-700 dark:border-l-slate-400 hover:bg-slate-50 dark:hover:bg-muted/10'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/80 border-l-slate-300 dark:border-l-slate-700 hover:border-slate-400'
        )}
      >
        {completo && <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">✓</span>}
        <span className="text-[11px] font-bold text-slate-800 dark:text-foreground truncate flex-1 leading-tight" title={item.produto}>
          {item.produto}
        </span>
        <IndicadorRealProg real={item.real} prog={item.prog} />
      </div>
    );
  };

  /** Zona de drop para ordens por via */
  const viaDropZone = (via: ProductionVia, list: ProductionItem[]) => {
    const zoneKey = `${turno}-${via}`;
    const isUmida = via === 'UMIDA';
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setDragOverZone(zoneKey)}
        onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
        onDrop={(e) => handleDrop(e, zoneKey, 'ordem', { turno, via })}
        className={cn(
          'p-1.5 flex flex-col gap-1 min-h-[80px] rounded-lg border-2 border-dashed transition-colors duration-150',
          dragOverZone === zoneKey
            ? isUmida
              ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-900/10'
              : 'border-sky-400 bg-sky-50/60 dark:bg-sky-900/10'
            : 'border-transparent'
        )}
      >
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-5 text-slate-300 dark:text-muted-foreground/50 select-none">
            <ClipboardList className="h-4 w-4" />
            <span className="text-[10px] italic">Sem ordens</span>
          </div>
        ) : (
          list.map(renderOrdemCard)
        )}
      </div>
    );
  };

  /** Zona de drop para pesagem automática / direta */
  const extraDropZone = (tipo: 'auto' | 'direta', list: ProductionItem[], title: string) => {
    const zoneKey = `${turno}-${tipo}`;
    const isAuto = tipo === 'auto';
    const totalR = list.reduce((a, c) => a + c.real, 0);
    const totalP = list.reduce((a, c) => a + c.prog, 0);

    return (
      <div className={cn('px-2.5 py-2 h-full', isAuto ? 'bg-blue-50 dark:bg-blue-950/10' : 'bg-sky-50 dark:bg-sky-950/10')}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isAuto
              ? <Zap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              : <Hand className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            }
            <span className={cn(
              'text-[10.5px] uppercase tracking-wide font-extrabold shrink-0',
              isAuto ? 'text-blue-700 dark:text-blue-300' : 'text-sky-700 dark:text-sky-300'
            )}>
              {title}
            </span>
            {list.length > 0 && (
              <span className="text-[10px] font-black text-slate-500 tabular-nums">
                {totalR}/{totalP} · {list.length}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'h-5 w-5 rounded-full shrink-0',
              isAuto
                ? 'text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                : 'text-sky-700 hover:bg-sky-100 dark:hover:bg-sky-900/30'
            )}
            onClick={() => onCreateClick(tipo)}
            title={`Adicionar em ${title}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setDragOverZone(zoneKey)}
          onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
          onDrop={(e) => handleDrop(e, zoneKey, tipo, { turno })}
          className={cn(
            'rounded-md border-2 border-dashed min-h-[36px] transition-colors duration-150 flex flex-col gap-1 p-1',
            dragOverZone === zoneKey
              ? isAuto
                ? 'border-blue-400 bg-blue-50/80 dark:bg-blue-900/20'
                : 'border-sky-400 bg-sky-50/80 dark:bg-sky-900/20'
              : 'border-transparent'
          )}
        >
          {list.length === 0 ? (
            <div className="flex items-center justify-center py-1.5 text-slate-300 dark:text-muted-foreground/40 select-none">
              <span className="text-[10px] italic">Nenhum registro</span>
            </div>
          ) : (
            list.map(renderExtraCard)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-card border border-slate-300 dark:border-border rounded-lg shadow-sm flex flex-col overflow-hidden h-auto sm:h-full">

      {/* ── Header Principal do Quadro (KPI do Turno com números ampliados) ── */}
      <div className="bg-primary text-primary-foreground px-3.5 py-2.5 flex items-center justify-between shrink-0 border-b border-black/10">
        <div className="flex items-center gap-2">
          <span className="font-black text-base tracking-wide">{turnoLabels[turno]}</span>
          {totalOrdens > 0 && (
            <span className={cn(badgeBase, 'bg-blue-900/55 border-blue-200/30 text-blue-50')}>
              {totalOrdens} {totalOrdens === 1 ? 'ordem' : 'ordens'}
            </span>
          )}
        </div>

        {/* KPIs com fontes maiores e mais visíveis */}
        <div className="flex items-center gap-2">
          {totalOrdens > 0 ? (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md" title="KPI Ordens: Realizado vs Programado">
              <span className="text-xs font-bold text-primary/60">Ordens:</span>
              <span className="text-sm font-black leading-none tabular-nums text-primary">{totalReal}</span>
              <span className="text-xs font-bold text-primary/50 leading-none tabular-nums">/{totalProg}</span>
              <span className={cn(badgeBase, 'ml-1 border-blue-700 bg-blue-700 text-white')}>
                {totalPct}%
              </span>
            </div>
          ) : (
            <span className="text-xs font-semibold opacity-70">Sem ordens</span>
          )}

          <div className="flex items-center gap-1.5 bg-sky-700 px-2.5 py-1 rounded-md" title="KPI Pesagens PD/PA no turno">
            <span className="text-xs font-bold text-sky-100">PD/PA:</span>
            <span className="text-sm font-black text-white leading-none tabular-nums">{pdpaReal}</span>
            <span className="text-xs font-bold text-sky-100 leading-none tabular-nums">/{pdpaProg}</span>
            {pdpaProg > 0 && (
              <span className={cn(badgeBase, 'ml-0.5 border-sky-900 bg-sky-900 text-sky-50')}>{pdpaPct}%</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Subheader de Indicadores por Via (Números ampliados) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-300 dark:border-border shrink-0">
        {/* KPI Via Úmida */}
        <div className="flex items-center justify-between px-3 py-2 border-b sm:border-b-0 sm:border-r border-slate-300 dark:border-border bg-blue-50 dark:bg-blue-950/20">
          <div className="flex items-center gap-1.5 min-w-0">
            <Droplets className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300 leading-none shrink-0">
                Úmida
              </span>
              <span className="text-xs font-black text-blue-700 dark:text-blue-300 tabular-nums">
                {umidaReal}/{umidaProg}
              </span>
              {umidaProg > 0 && (
                <span className="text-[10px] text-blue-700 dark:text-blue-300 font-extrabold tabular-nums">
                  ({umidaPct}%)
                </span>
              )}
            </div>
          </div>
          <Button
            type="button" size="icon" variant="ghost"
            className="h-5 w-5 rounded-full text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 shrink-0"
            onClick={() => onCreateClick('ordem', 'UMIDA')}
            title="Adicionar ordem na via úmida"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* KPI Via Seca */}
        <div className="flex items-center justify-between px-3 py-2 bg-cyan-50/80 dark:bg-cyan-950/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wind className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide text-cyan-800 dark:text-cyan-300 leading-none shrink-0">
                Seca
              </span>
              <span className="text-xs font-black text-cyan-800 dark:text-cyan-300 tabular-nums">
                {secaReal}/{secaProg}
              </span>
              {secaProg > 0 && (
                <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-extrabold tabular-nums">
                  ({secaPct}%)
                </span>
              )}
            </div>
          </div>
          <Button
            type="button" size="icon" variant="ghost"
            className="h-5 w-5 rounded-full text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 shrink-0"
            onClick={() => onCreateClick('ordem', 'SECA')}
            title="Adicionar ordem na via seca"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Zonas de Drop das Ordens (Scroll Interno, altura proporcional à quantidade) ── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 overflow-hidden min-h-0 bg-slate-100 dark:bg-muted/10"
        style={{ flexGrow: ordensWeight, flexBasis: 0, minHeight: 90 }}
      >
        <div className="border-b sm:border-b-0 sm:border-r border-slate-300 dark:border-border overflow-y-auto overscroll-contain">
          {viaDropZone('UMIDA', umida)}
        </div>
        <div className="overflow-y-auto overscroll-contain">
          {viaDropZone('SECA', seca)}
        </div>
      </div>

      {/* ── Rodapé KPI de Pesagem Direta & Automática com números ampliados ── */}
      <div className="bg-sky-50 dark:bg-sky-950/30 px-3 py-1.5 border-t border-b border-sky-200 dark:border-sky-900/60 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-black text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
          Entregas PD/PA:
        </span>
        <div className="flex items-center gap-1.5 tabular-nums">
          <span className="text-sm font-black text-sky-700 dark:text-sky-300">{pdpaReal}</span>
          <span className="text-xs text-slate-500 font-bold">/{pdpaProg}</span>
          {pdpaProg > 0 && (
            <Badge variant="outline" className={cn(badgeBase, 'font-black bg-white dark:bg-card border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300')}>
              {pdpaPct}%
            </Badge>
          )}
        </div>
      </div>

      {/* ── Pesagens Automática & Direta (lado a lado, altura proporcional à quantidade) ── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-slate-200 dark:divide-border/80 overflow-hidden min-h-0"
        style={{ flexGrow: pdpaWeight, flexBasis: 0, minHeight: 70, maxHeight: 320 }}
      >
        <div className="overflow-y-auto overscroll-contain max-h-[160px] sm:max-h-none">{extraDropZone('auto', auto, 'Automática')}</div>
        <div className="overflow-y-auto overscroll-contain max-h-[160px] sm:max-h-none">{extraDropZone('direta', direta, 'Direta')}</div>
      </div>
    </div>
  );
}
