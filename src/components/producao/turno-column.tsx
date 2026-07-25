"use client";

import { useState } from 'react';
import { Plus, Lock, GitBranch, GripVertical, Zap, Hand, Droplets, Wind, ClipboardList } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';

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
}

const turnoLabels: Record<ProductionTurno, string> = {
  1: '1º Turno',
  2: '2º Turno',
  3: '3º Turno',
};

/** Badge realizado/programado por item */
function IndicadorRealProg({ real, prog }: { real: number; prog: number }) {
  const completo = prog > 0 && real >= prog;
  return (
    <Badge
      variant={completo ? 'success' : 'destructive'}
      className="text-[10px] font-bold px-1.5 py-0 whitespace-nowrap shrink-0 tabular-nums leading-tight"
      title={`Realizado ${real} de ${prog} programado`}
    >
      {real}/{prog}
    </Badge>
  );
}

export function TurnoColumn({ turno, items, onItemClick, onCreateClick, onMove }: TurnoColumnProps) {
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const ordens = items.filter((i) => i.tipo === 'ordem');
  const umida = ordens.filter((i) => i.via === 'UMIDA');
  const seca = ordens.filter((i) => i.via === 'SECA');
  const auto = items.filter((i) => i.tipo === 'auto');
  const direta = items.filter((i) => i.tipo === 'direta');

  const umidaReal = umida.reduce((a, c) => a + c.real, 0);
  const umidaProg = umida.reduce((a, c) => a + c.prog, 0);
  const secaReal = seca.reduce((a, c) => a + c.real, 0);
  const secaProg = seca.reduce((a, c) => a + c.prog, 0);
  const totalReal = umidaReal + secaReal;
  const totalProg = umidaProg + secaProg;
  const totalOrdens = ordens.length;

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

  /** Card de Ordem — UMA LINHA: ícones | nome | badge */
  const renderOrdemCard = (item: ProductionItem) => {
    const completo = item.prog > 0 && item.real >= item.prog;
    const isHovered = hoveredCard === item.id;

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
            : `${item.produto}${item.familia ? ` · ${item.familia}` : ''} · clique para editar`
        }
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer transition-all duration-150 select-none group',
          item.locked
            ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-900/60 opacity-80 cursor-not-allowed'
            : completo
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/60 hover:shadow-sm'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/70 hover:border-slate-300 dark:hover:border-primary/30 hover:shadow-sm active:cursor-grabbing shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        )}
      >
        {/* Ícones de estado — espaço mínimo */}
        <div className="flex items-center gap-0.5 shrink-0">
          {item.locked && <Lock className="h-2.5 w-2.5 text-yellow-600" />}
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

        {/* Família (pill pequena) */}
        {item.familia && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0 leading-none max-w-[56px] truncate">
            {item.familia}
          </span>
        )}

        {/* Nome do produto — ocupa o máximo de espaço */}
        <span
          className="text-[11px] font-semibold text-slate-800 dark:text-foreground truncate flex-1 leading-tight"
          title={item.produto}
        >
          {item.produto}
        </span>

        {/* Status concluído inline */}
        {completo && (
          <span className="text-[9px] font-bold text-green-600 dark:text-green-400 shrink-0">✓</span>
        )}

        {/* Badge real/prog */}
        <IndicadorRealProg real={item.real} prog={item.prog} />
      </div>
    );
  };

  /** Card PA/PD — uma linha compacta */
  const renderExtraCard = (item: ProductionItem) => {
    const completo = item.prog > 0 && item.real >= item.prog;
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item)}
        onClick={() => onItemClick(item)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition-all duration-150 select-none',
          completo
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/60 hover:shadow-sm'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/70 hover:border-slate-300 dark:hover:border-primary/30 hover:shadow-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        )}
      >
        {completo && <span className="text-[9px] font-bold text-green-600 dark:text-green-400 shrink-0">✓</span>}
        <span className="text-[11px] font-semibold text-slate-800 dark:text-foreground truncate flex-1 leading-tight" title={item.produto}>
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
          <div className="flex flex-col items-center justify-center gap-1 py-4 text-slate-300 dark:text-muted-foreground/50 select-none">
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
      <div className={cn('px-2 py-1.5', isAuto ? 'bg-violet-50/40 dark:bg-violet-950/10' : 'bg-amber-50/40 dark:bg-amber-950/10')}>
        {/* Header compacto da seção */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isAuto
              ? <Zap className="h-3 w-3 text-violet-500 shrink-0" />
              : <Hand className="h-3 w-3 text-amber-500 shrink-0" />
            }
            <span className={cn(
              'text-[10px] uppercase tracking-wide font-bold shrink-0',
              isAuto ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'
            )}>
              {title}
            </span>
            {list.length > 0 && (
              <span className="text-[9px] font-semibold text-slate-400 tabular-nums">
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
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setDragOverZone(zoneKey)}
          onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
          onDrop={(e) => handleDrop(e, zoneKey, tipo, { turno })}
          className={cn(
            'rounded-md border-2 border-dashed min-h-[40px] transition-colors duration-150 flex flex-col gap-1 p-1',
            dragOverZone === zoneKey
              ? isAuto
                ? 'border-violet-400 bg-violet-50/80 dark:bg-violet-900/20'
                : 'border-amber-400 bg-amber-50/80 dark:bg-amber-900/20'
              : 'border-transparent'
          )}
        >
          {list.length === 0 ? (
            <div className="flex items-center justify-center py-2 text-slate-300 dark:text-muted-foreground/40 select-none">
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
    <div className="bg-slate-50 dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl shadow-sm flex flex-col overflow-hidden h-full">

      {/* ── Header do turno ── */}
      <div className="bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between shrink-0">
        <span className="font-bold text-sm tracking-wide">{turnoLabels[turno]}</span>
        <div className="flex items-center gap-2">
          {totalOrdens > 0 ? (
            <>
              <div className="flex items-baseline gap-0.5 tabular-nums">
                <span className="text-base font-extrabold leading-none">{totalReal}</span>
                <span className="text-[10px] font-medium opacity-70 leading-none">/{totalProg}</span>
              </div>
              <span className="opacity-30 text-xs">|</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-sm font-bold leading-none">{totalOrdens}</span>
                <span className="text-[9px] font-medium opacity-70 leading-none">
                  {totalOrdens === 1 ? 'prod.' : 'prod.'}
                </span>
              </div>
            </>
          ) : (
            <span className="text-[10px] font-medium opacity-60">Sem ordens</span>
          )}
        </div>
      </div>

      {/* ── Subheader: Via Úmida | Via Seca ── */}
      <div className="grid grid-cols-2 border-b border-slate-200 dark:border-border/80 bg-white dark:bg-card shrink-0">
        {/* Via Úmida */}
        <div className="flex items-center justify-between px-2 py-1.5 border-r border-slate-200 dark:border-border/80">
          <div className="flex items-center gap-1 min-w-0">
            <Droplets className="h-3 w-3 text-sky-500 shrink-0" />
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400 leading-none shrink-0">
                Úmida
              </span>
              {umida.length > 0 && (
                <span className="text-[9px] text-slate-400 tabular-nums leading-none">
                  {umidaReal}/{umidaProg} · {umida.length}
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
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Via Seca */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <Wind className="h-3 w-3 text-amber-500 shrink-0" />
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 leading-none shrink-0">
                Seca
              </span>
              {seca.length > 0 && (
                <span className="text-[9px] text-slate-400 tabular-nums leading-none">
                  {secaReal}/{secaProg} · {seca.length}
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
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* ── Zonas de drop das ordens (scroll interno) ── */}
      <div className="grid grid-cols-2 flex-1 overflow-hidden min-h-0 bg-slate-50 dark:bg-muted/10">
        <div className="border-r border-slate-200 dark:border-border/80 overflow-y-auto overscroll-contain">
          {viaDropZone('UMIDA', umida)}
        </div>
        <div className="overflow-y-auto overscroll-contain">
          {viaDropZone('SECA', seca)}
        </div>
      </div>

      {/* ── Totalizadores por via ── */}
      <div className="grid grid-cols-2 border-t border-slate-200 dark:border-border/80 bg-white dark:bg-card shrink-0">
        <div className="flex items-center justify-center gap-1.5 py-1.5 border-r border-slate-200 dark:border-border/80">
          <Droplets className="h-3 w-3 text-sky-400 shrink-0" />
          <div className="flex items-baseline gap-0.5 tabular-nums">
            <span className="text-sm font-extrabold text-sky-600 dark:text-sky-400 leading-none">{umidaReal}</span>
            <span className="text-[9px] text-slate-400 font-medium leading-none">/{umidaProg}</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-1.5">
          <Wind className="h-3 w-3 text-amber-400 shrink-0" />
          <div className="flex items-baseline gap-0.5 tabular-nums">
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 leading-none">{secaReal}</span>
            <span className="text-[9px] text-slate-400 font-medium leading-none">/{secaProg}</span>
          </div>
        </div>
      </div>

      {/* ── Pesagens (scroll interno) ── */}
      <div className="flex flex-col divide-y divide-slate-200 dark:divide-border/80 shrink-0 max-h-[320px] overflow-y-auto overscroll-contain border-t border-slate-200 dark:border-border/80">
        {extraDropZone('auto', auto, 'Pesagem Automática')}
        {extraDropZone('direta', direta, 'Pesagem Direta')}
      </div>
    </div>
  );
}
