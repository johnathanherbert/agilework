"use client";

import { useState } from 'react';
import { Plus, Lock, GitBranch } from 'lucide-react';
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

function IndicadorRealProg({ real, prog }: { real: number; prog: number }) {
  const completo = prog > 0 && real >= prog;
  return (
    <Badge
      variant={completo ? 'success' : 'destructive'}
      className="text-sm font-bold px-2.5 py-1 whitespace-nowrap shrink-0"
      title={`Realizado ${real} de ${prog} programado`}
    >
      {real}/{prog}
    </Badge>
  );
}

export function TurnoColumn({ turno, items, onItemClick, onCreateClick, onMove }: TurnoColumnProps) {
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const ordens = items.filter((i) => i.tipo === 'ordem');
  const umida = ordens.filter((i) => i.via === 'UMIDA');
  const seca = ordens.filter((i) => i.via === 'SECA');
  const auto = items.filter((i) => i.tipo === 'auto');
  const direta = items.filter((i) => i.tipo === 'direta');

  const totalUmida = umida.reduce((acc, curr) => acc + curr.real, 0);
  const totalSeca = seca.reduce((acc, curr) => acc + curr.real, 0);

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
      if (payload.tipo !== expectedTipo) return; // Não misturar tipos entre zonas

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

  const renderOrdemCard = (item: ProductionItem) => {
    const faltam = Math.max(item.prog - item.real, 0);
    return (
      <div
        key={item.id}
        draggable={!item.locked}
        onDragStart={(e) => !item.locked && handleDragStart(e, item)}
        onClick={() => onItemClick(item)}
        title={item.locked ? 'Ordem dividida: bloqueada para edição até o turno de destino arrastar de volta' : undefined}
        className={cn(
          'border rounded-lg p-3 flex items-center justify-between gap-2 cursor-pointer hover:shadow-sm transition-all',
          item.locked
            ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-900 opacity-80 cursor-not-allowed active:cursor-not-allowed'
            : 'bg-muted/40 border-border/80 hover:bg-muted/70 active:cursor-grabbing'
        )}
      >
        <div className="flex flex-col min-w-0 gap-1">
          <div className="flex items-center gap-1.5">
            {item.locked && <Lock className="h-3 w-3 text-yellow-700 dark:text-yellow-500 shrink-0" />}
            {item.splitParentId && <GitBranch className="h-3 w-3 text-primary shrink-0" />}
            {item.familia && (
              <span className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[110px]">
                {item.familia}
              </span>
            )}
          </div>
          <span className="text-sm font-bold truncate max-w-[150px]" title={item.produto}>{item.produto}</span>
          {faltam > 0 && (
            <span className="text-[11px] text-muted-foreground font-medium">Faltam {faltam}</span>
          )}
        </div>
        <IndicadorRealProg real={item.real} prog={item.prog} />
      </div>
    );
  };

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
          'flex items-center justify-between gap-2 p-2.5 mb-2 last:mb-0 rounded-lg border cursor-pointer hover:shadow-sm transition-all',
          completo
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
            : 'bg-muted/40 border-border/80 hover:bg-muted/70'
        )}
      >
        <div className="flex flex-col min-w-0 gap-0.5">
          <span className="text-sm font-bold truncate max-w-[150px]" title={item.produto}>{item.produto}</span>
          {faltam > 0 && (
            <span className="text-[11px] text-muted-foreground font-medium">Faltam {faltam}</span>
          )}
        </div>
        <IndicadorRealProg real={item.real} prog={item.prog} />
      </div>
    );
  };

  const viaDropZone = (via: ProductionVia, list: ProductionItem[]) => {
    const zoneKey = `${turno}-${via}`;
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setDragOverZone(zoneKey)}
        onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
        onDrop={(e) => handleDrop(e, zoneKey, 'ordem', { turno, via })}
        className={cn(
          'p-2 flex flex-col gap-2 min-h-[110px] rounded-lg border-2 border-dashed transition-colors',
          dragOverZone === zoneKey ? 'border-primary bg-primary/5' : 'border-transparent'
        )}
      >
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center mt-4 select-none">
            Sem ordens programadas
          </p>
        ) : (
          list.map(renderOrdemCard)
        )}
      </div>
    );
  };

  const extraDropZone = (tipo: 'auto' | 'direta', list: ProductionItem[], title: string) => {
    const zoneKey = `${turno}-${tipo}`;
    return (
      <div className="p-3 flex-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">{title}</h4>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
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
            'rounded-lg border-2 border-dashed min-h-[64px] transition-colors',
            dragOverZone === zoneKey ? 'border-primary bg-primary/5' : 'border-transparent'
          )}
        >
          {list.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-1">Nenhum registro</p>
          ) : (
            list.map(renderExtraCard)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border/80 rounded-xl shadow-sm flex flex-col overflow-hidden">
      <div className="bg-primary text-primary-foreground text-center font-bold text-lg py-3">
        {turnoLabels[turno]}
      </div>

      <div className="grid grid-cols-2 border-b border-border/80 bg-muted/30 text-center text-xs font-bold uppercase tracking-wide">
        <div className="flex items-center justify-center gap-2 py-2 border-r border-border/80">
          Via Úmida
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
            onClick={() => onCreateClick('ordem', 'UMIDA')}
            title="Adicionar ordem na via úmida"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2 py-2">
          Via Seca
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
            onClick={() => onCreateClick('ordem', 'SECA')}
            title="Adicionar ordem na via seca"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 flex-1">
        <div className="border-r border-border/80">{viaDropZone('UMIDA', umida)}</div>
        <div>{viaDropZone('SECA', seca)}</div>
      </div>

      <div className="grid grid-cols-2 text-center border-y border-border/80 bg-muted/30">
        <div className="py-2 border-r border-border/80 font-bold text-primary text-lg" title="Total realizado via úmida">
          {String(totalUmida).padStart(2, '0')}
        </div>
        <div className="py-2 font-bold text-primary text-lg" title="Total realizado via seca">
          {String(totalSeca).padStart(2, '0')}
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border/80">
        {extraDropZone('auto', auto, 'Pesagem Automática')}
        {extraDropZone('direta', direta, 'Pesagem Direta')}
      </div>
    </div>
  );
}
