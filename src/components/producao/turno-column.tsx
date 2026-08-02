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

/** Badge de progresso por item (Real / Prog) com números ampliados */
function IndicadorRealProg({ real, prog }: { real: number; prog: number }) {
  const completo = prog > 0 && real >= prog;
  return (
    <Badge
      variant={completo ? 'success' : 'destructive'}
      className="text-xs font-black px-2 py-0.5 whitespace-nowrap shrink-0 tabular-nums leading-tight shadow-2xs"
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
            'p-2.5 rounded-lg border cursor-pointer transition-all duration-150 select-none group flex flex-col gap-1 shadow-2xs hover:shadow-xs',
            item.locked
              ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60 opacity-85'
              : completo
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60'
              : emAndamento
              ? 'bg-sky-50/40 dark:bg-sky-950/10 border-sky-300 dark:border-sky-900/50'
              : 'bg-white dark:bg-card border-slate-200 dark:border-border/80 hover:border-primary/40'
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
              {item.locked && <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
              {item.splitParentId && <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />}

              {familia && (
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0 truncate max-w-[110px]">
                  {familia}
                </span>
              )}

              {codigoSA && (
                <span className="text-[9.5px] font-mono font-extrabold text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                  #{codigoSA}
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
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Concluído
                  </span>
                ) : emAndamento ? (
                  <span className="text-sky-600 dark:text-sky-400 font-bold flex items-center gap-0.5">
                    <Clock className="h-3 w-3" /> Em andamento
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
                    ? 'bg-emerald-500'
                    : emAndamento
                    ? 'bg-sky-500'
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
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer transition-all duration-150 select-none group',
          item.locked
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60 opacity-80 cursor-not-allowed'
            : completo
            ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 hover:shadow-2xs'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/70 hover:border-slate-300 dark:hover:border-primary/30 hover:shadow-2xs active:cursor-grabbing shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        )}
      >
        <div className="flex items-center gap-0.5 shrink-0">
          {item.locked && <Lock className="h-2.5 w-2.5 text-amber-600" />}
          {item.splitParentId && <GitBranch className="h-2.5 w-2.5 text-primary" />}
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
          <span className="text-[9.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0 leading-none max-w-[70px] truncate">
            {familia}
          </span>
        )}

        <span
          className="text-[11px] font-bold text-slate-800 dark:text-foreground truncate flex-1 leading-tight"
          title={item.produto}
        >
          {item.produto}
        </span>

        {completo && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
        )}

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
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer transition-all duration-150 select-none',
          completo
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 hover:shadow-2xs'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/70 hover:border-slate-300 dark:hover:border-primary/30 hover:shadow-2xs shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        )}
      >
        {completo && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>}
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
              ? 'border-sky-400 bg-sky-50/60 dark:bg-sky-900/10'
              : 'border-amber-400 bg-amber-50/60 dark:bg-amber-900/10'
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
      <div className={cn('px-2.5 py-2', isAuto ? 'bg-violet-50/40 dark:bg-violet-950/10' : 'bg-amber-50/40 dark:bg-amber-950/10')}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isAuto
              ? <Zap className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              : <Hand className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            }
            <span className={cn(
              'text-[10.5px] uppercase tracking-wide font-extrabold shrink-0',
              isAuto ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'
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
                ? 'text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                : 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30'
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
                ? 'border-violet-400 bg-violet-50/80 dark:bg-violet-900/20'
                : 'border-amber-400 bg-amber-50/80 dark:bg-amber-900/20'
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
    <div className="bg-slate-50 dark:bg-card border border-slate-200 dark:border-border/80 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">

      {/* ── Header Principal do Quadro (KPI do Turno com números ampliados) ── */}
      <div className="bg-primary text-primary-foreground px-3.5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-base tracking-wide">{turnoLabels[turno]}</span>
          {totalOrdens > 0 && (
            <Badge variant="outline" className="text-[10px] font-extrabold text-primary-foreground/90 border-primary-foreground/30 bg-white/10 px-2 py-0.5">
              {totalOrdens} {totalOrdens === 1 ? 'ordem' : 'ordens'}
            </Badge>
          )}
        </div>

        {/* KPIs com fontes maiores e mais visíveis */}
        <div className="flex items-center gap-2">
          {totalOrdens > 0 ? (
            <div className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-lg border border-white/20" title="KPI Ordens: Realizado vs Programado">
              <span className="text-xs font-bold opacity-90">Ordens:</span>
              <span className="text-sm font-black leading-none tabular-nums text-white">{totalReal}</span>
              <span className="text-xs font-bold opacity-80 leading-none tabular-nums">/{totalProg}</span>
              <Badge className="ml-1 text-[10px] font-black px-1.5 py-0 bg-white text-primary">
                {totalPct}%
              </Badge>
            </div>
          ) : (
            <span className="text-xs font-semibold opacity-70">Sem ordens</span>
          )}

          <div className="flex items-center gap-1.5 bg-emerald-500/30 px-2.5 py-1 rounded-lg border border-emerald-400/30" title="KPI Pesagens PD/PA no turno">
            <span className="text-xs font-bold text-emerald-200">PD/PA:</span>
            <span className="text-sm font-black text-white leading-none tabular-nums">{pdpaReal}</span>
            <span className="text-xs font-bold text-emerald-100/90 leading-none tabular-nums">/{pdpaProg}</span>
            {pdpaProg > 0 && (
              <span className="text-[9.5px] font-black text-emerald-200 ml-0.5">({pdpaPct}%)</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Subheader de Indicadores por Via (Números ampliados) ── */}
      <div className="grid grid-cols-2 border-b border-slate-200 dark:border-border/80 bg-white dark:bg-card shrink-0">
        {/* KPI Via Úmida */}
        <div className="flex items-center justify-between px-3 py-2 border-r border-slate-200 dark:border-border/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <Droplets className="h-4 w-4 text-sky-500 shrink-0" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide text-sky-600 dark:text-sky-400 leading-none shrink-0">
                Úmida
              </span>
              <span className="text-xs font-black text-sky-700 dark:text-sky-300 tabular-nums">
                {umidaReal}/{umidaProg}
              </span>
              {umidaProg > 0 && (
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-extrabold tabular-nums">
                  ({umidaPct}%)
                </span>
              )}
            </div>
          </div>
          <Button
            type="button" size="icon" variant="ghost"
            className="h-5 w-5 rounded-full text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30 shrink-0"
            onClick={() => onCreateClick('ordem', 'UMIDA')}
            title="Adicionar ordem na via úmida"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* KPI Via Seca */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wind className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400 leading-none shrink-0">
                Seca
              </span>
              <span className="text-xs font-black text-amber-700 dark:text-amber-300 tabular-nums">
                {secaReal}/{secaProg}
              </span>
              {secaProg > 0 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold tabular-nums">
                  ({secaPct}%)
                </span>
              )}
            </div>
          </div>
          <Button
            type="button" size="icon" variant="ghost"
            className="h-5 w-5 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0"
            onClick={() => onCreateClick('ordem', 'SECA')}
            title="Adicionar ordem na via seca"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Zonas de Drop das Ordens (Scroll Interno) ── */}
      <div className="grid grid-cols-2 flex-1 overflow-hidden min-h-0 bg-slate-50 dark:bg-muted/10">
        <div className="border-r border-slate-200 dark:border-border/80 overflow-y-auto overscroll-contain">
          {viaDropZone('UMIDA', umida)}
        </div>
        <div className="overflow-y-auto overscroll-contain">
          {viaDropZone('SECA', seca)}
        </div>
      </div>

      {/* ── Rodapé KPI de Pesagem Direta & Automática com números ampliados ── */}
      <div className="bg-emerald-50/80 dark:bg-emerald-950/20 px-3 py-1.5 border-t border-b border-emerald-200/80 dark:border-emerald-900/40 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Entregas PD/PA:
        </span>
        <div className="flex items-center gap-1.5 tabular-nums">
          <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{pdpaReal}</span>
          <span className="text-xs text-slate-500 font-bold">/{pdpaProg}</span>
          {pdpaProg > 0 && (
            <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 font-black bg-white dark:bg-card border-emerald-300 text-emerald-700">
              {pdpaPct}%
            </Badge>
          )}
        </div>
      </div>

      {/* ── Pesagens Automática & Direta (Scroll Interno) ── */}
      <div className="flex flex-col divide-y divide-slate-200 dark:divide-border/80 shrink-0 max-h-[260px] overflow-y-auto overscroll-contain">
        {extraDropZone('auto', auto, 'Pesagem Automática')}
        {extraDropZone('direta', direta, 'Pesagem Direta')}
      </div>
    </div>
  );
}
