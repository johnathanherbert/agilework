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
      className="text-xs font-bold px-2 py-0.5 whitespace-nowrap shrink-0 tabular-nums"
      title={`Realizado ${real} de ${prog} programado`}
    >
      {real}/{prog}
    </Badge>
  );
}

/** Pill numérico reutilizável para o header/subheader */
function StatPill({
  value,
  label,
  colorClass,
}: {
  value: string | number;
  label: string;
  colorClass: string;
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-1 tabular-nums', colorClass)}>
      <strong className="font-bold text-sm leading-none">{value}</strong>
      <span className="text-[10px] font-medium opacity-80 leading-none">{label}</span>
    </span>
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

  // Totais por via
  const umidaReal = umida.reduce((a, c) => a + c.real, 0);
  const umidaProg = umida.reduce((a, c) => a + c.prog, 0);
  const secaReal = seca.reduce((a, c) => a + c.real, 0);
  const secaProg = seca.reduce((a, c) => a + c.prog, 0);

  // Totais gerais do turno (ordens)
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

      // Não permite mover uma ordem entre vias diferentes (Úmida <-> Seca);
      // a via é definida pela receita e não pode ser alterada por drag and drop
      if (expectedTipo === 'ordem' && destination.via && payload.via && payload.via !== destination.via) {
        toast.error('Não é possível mover uma ordem entre vias diferentes (Úmida/Seca)');
        return;
      }

      onMove(payload.itemId, destination);
    } catch (err) {
      console.error('Erro ao processar drop:', err);
    }
  };

  /** Card de Ordem de Produção */
  const renderOrdemCard = (item: ProductionItem) => {
    const faltam = Math.max(item.prog - item.real, 0);
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
        title={item.locked ? 'Ordem dividida — bloqueada até o turno de destino arrastar de volta' : 'Clique para editar · Arraste para mover'}
        className={cn(
          'rounded-lg border p-3 flex flex-col gap-1.5 cursor-pointer transition-all duration-150 select-none',
          item.locked
            ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-900/60 opacity-80 cursor-not-allowed'
            : completo
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/60 hover:shadow-sm'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/70 hover:border-slate-300 dark:hover:border-primary/30 hover:shadow-sm active:cursor-grabbing shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        )}
      >
        {/* Linha superior: família + drag handle + badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.locked && <Lock className="h-3 w-3 text-yellow-600 dark:text-yellow-400 shrink-0" />}
            {item.splitParentId && <GitBranch className="h-3 w-3 text-primary shrink-0" />}
            {item.familia && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary truncate max-w-[100px]">
                {item.familia}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!item.locked && (
              <GripVertical
                className={cn(
                  'h-3.5 w-3.5 text-slate-300 dark:text-muted-foreground/40 transition-opacity duration-100',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              />
            )}
            <IndicadorRealProg real={item.real} prog={item.prog} />
          </div>
        </div>

        {/* Nome do produto */}
        <span
          className="text-sm font-semibold text-slate-800 dark:text-foreground leading-snug line-clamp-2"
          title={item.produto}
        >
          {item.produto}
        </span>

        {/* Linha de status */}
        {completo ? (
          <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">✓ Concluído</span>
        ) : faltam > 0 ? (
          <span className="text-[11px] text-slate-400 dark:text-muted-foreground font-medium">
            Faltam <span className="text-slate-700 dark:text-foreground font-bold">{faltam}</span>
          </span>
        ) : null}
      </div>
    );
  };

  /** Card de Pesagem Automática / Direta */
  const renderExtraCard = (item: ProductionItem) => {
    const faltam = Math.max(item.prog - item.real, 0);
    const completo = item.prog > 0 && item.real >= item.prog;

    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item)}
        onClick={() => onItemClick(item)}
        className={cn(
          'flex flex-col gap-1 p-2.5 rounded-lg border cursor-pointer transition-all duration-150 select-none',
          completo
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/60 hover:shadow-sm'
            : 'bg-white dark:bg-card border-slate-200 dark:border-border/70 hover:border-slate-300 dark:hover:border-primary/30 hover:shadow-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-foreground leading-snug line-clamp-2 flex-1" title={item.produto}>
            {item.produto}
          </span>
          <IndicadorRealProg real={item.real} prog={item.prog} />
        </div>
        {completo ? (
          <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">✓ Concluído</span>
        ) : faltam > 0 ? (
          <span className="text-[11px] text-slate-400 dark:text-muted-foreground font-medium">
            Faltam <span className="text-slate-700 dark:text-foreground font-bold">{faltam}</span>
          </span>
        ) : null}
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
          'p-2 flex flex-col gap-2 min-h-[100px] rounded-lg border-2 border-dashed transition-colors duration-150',
          dragOverZone === zoneKey
            ? isUmida
              ? 'border-sky-400 bg-sky-50/60 dark:bg-sky-900/10'
              : 'border-amber-400 bg-amber-50/60 dark:bg-amber-900/10'
            : 'border-transparent'
        )}
      >
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-slate-300 dark:text-muted-foreground/50 select-none">
            <ClipboardList className="h-5 w-5" />
            <span className="text-[11px] italic">Sem ordens</span>
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
      <div className={cn('p-3', isAuto ? 'bg-violet-50/40 dark:bg-violet-950/10' : 'bg-amber-50/40 dark:bg-amber-950/10')}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {isAuto
              ? <Zap className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400 shrink-0" />
              : <Hand className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
            }
            <h4 className={cn(
              'text-[11px] uppercase tracking-wide font-bold shrink-0',
              isAuto ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'
            )}>
              {title}
            </h4>
            {/* Totais da seção */}
            {list.length > 0 && (
              <span className="text-[10px] font-semibold text-slate-400 dark:text-muted-foreground tabular-nums">
                {totalR}/{totalP} · {list.length} {list.length === 1 ? 'item' : 'itens'}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'h-6 w-6 rounded-full shrink-0',
              isAuto
                ? 'text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
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
            'rounded-lg border-2 border-dashed min-h-[56px] transition-colors duration-150 flex flex-col gap-2 p-1',
            dragOverZone === zoneKey
              ? isAuto
                ? 'border-violet-400 bg-violet-50/80 dark:bg-violet-900/20'
                : 'border-amber-400 bg-amber-50/80 dark:bg-amber-900/20'
              : 'border-transparent'
          )}
        >
          {list.length === 0 ? (
            <div className="flex items-center justify-center gap-1.5 py-3 text-slate-300 dark:text-muted-foreground/40 select-none">
              <span className="text-[11px] italic">Nenhum registro</span>
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
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shrink-0">
        <span className="font-bold text-base tracking-wide">{turnoLabels[turno]}</span>

        {/* Painel de estatísticas do turno */}
        <div className="flex items-center gap-3">
          {totalOrdens > 0 && (
            <>
              {/* Realizado / Programado total */}
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="text-lg font-extrabold leading-none">{totalReal}</span>
                <span className="text-[11px] font-medium opacity-70 leading-none">/{totalProg}</span>
                <span className="text-[10px] font-medium opacity-60 leading-none ml-0.5">real./prog.</span>
              </div>
              {/* Separador */}
              <span className="opacity-30 text-sm">|</span>
              {/* Quantidade de ordens */}
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold leading-none">{totalOrdens}</span>
                <span className="text-[10px] font-medium opacity-70 leading-none">
                  {totalOrdens === 1 ? 'produto' : 'produtos'}
                </span>
              </div>
            </>
          )}
          {totalOrdens === 0 && (
            <span className="text-[11px] font-medium opacity-60">Sem ordens</span>
          )}
        </div>
      </div>

      {/* ── Subheader: Via Úmida | Via Seca ── */}
      <div className="grid grid-cols-2 border-b border-slate-200 dark:border-border/80 bg-white dark:bg-card shrink-0">
        {/* Via Úmida */}
        <div className="flex items-center justify-between px-3 py-2 border-r border-slate-200 dark:border-border/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <Droplets className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400 leading-tight">
                Via Úmida
              </span>
              {umida.length > 0 && (
                <span className="text-[10px] text-slate-400 dark:text-muted-foreground tabular-nums leading-tight">
                  {umidaReal}/{umidaProg} · {umida.length} {umida.length === 1 ? 'ordem' : 'ordens'}
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30 shrink-0"
            onClick={() => onCreateClick('ordem', 'UMIDA')}
            title="Adicionar ordem na via úmida"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Via Seca */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wind className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 leading-tight">
                Via Seca
              </span>
              {seca.length > 0 && (
                <span className="text-[10px] text-slate-400 dark:text-muted-foreground tabular-nums leading-tight">
                  {secaReal}/{secaProg} · {seca.length} {seca.length === 1 ? 'ordem' : 'ordens'}
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0"
            onClick={() => onCreateClick('ordem', 'SECA')}
            title="Adicionar ordem na via seca"
          >
            <Plus className="h-3.5 w-3.5" />
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
        <div className="flex items-center justify-center gap-2 py-2.5 border-r border-slate-200 dark:border-border/80">
          <Droplets className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <div className="flex items-baseline gap-1 tabular-nums">
            <span className="text-base font-extrabold text-sky-600 dark:text-sky-400 leading-none">{umidaReal}</span>
            <span className="text-[10px] text-slate-400 dark:text-muted-foreground font-medium leading-none">/{umidaProg} prog.</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 py-2.5">
          <Wind className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <div className="flex items-baseline gap-1 tabular-nums">
            <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 leading-none">{secaReal}</span>
            <span className="text-[10px] text-slate-400 dark:text-muted-foreground font-medium leading-none">/{secaProg} prog.</span>
          </div>
        </div>
      </div>

      {/* ── Pesagens (scroll interno) ── */}
      <div className="flex flex-col divide-y divide-slate-200 dark:divide-border/80 shrink-0 max-h-[240px] overflow-y-auto overscroll-contain border-t border-slate-200 dark:border-border/80">
        {extraDropZone('auto', auto, 'Pesagem Automática')}
        {extraDropZone('direta', direta, 'Pesagem Direta')}
      </div>
    </div>
  );
}
