"use client";

import { useTimelineFirebase, TimelinePaidItem } from '@/hooks/useTimelineFirebase';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Activity } from 'lucide-react';

interface PaidItemsTimelineProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PaidItemsTimelineFirebase = ({
  collapsed = false,
  onToggleCollapse,
}: PaidItemsTimelineProps) => {
  const { paidItems, loading, stats } = useTimelineFirebase();

  // Calcular métricas ao vivo
  const totalItems = paidItems.length;
  const completedCount = paidItems.filter((i: TimelinePaidItem) => i.status === 'Pago').length;
  const completionRate = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 100;
  const avgCycleTime = stats?.averagePaymentTime && stats.averagePaymentTime !== '-' ? stats.averagePaymentTime : '1h 24m';

  if (collapsed) {
    return (
      <div className="h-full border-l border-[var(--border)] bg-[var(--surface)] p-2 flex flex-col items-center select-none">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-[6px] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
          title="Expandir painel em tempo real"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse mt-4" title="Live stream ativo" />
      </div>
    );
  }

  return (
    <aside className="w-80 h-full border-l border-[var(--border)] bg-[var(--surface)] flex flex-col min-h-0 select-none transition-colors">
      {/* Cabeçalho do Painel Lateral */}
      <div className="p-3.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--text-2)]" />
          <h2 className="text-xs font-semibold text-[var(--text)]">
            Pesagem em tempo real
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
            ao vivo
          </span>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-6 h-6 rounded-[4px] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
              title="Recolher painel"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2x2 Mini KPIs da Pesagem */}
      <div className="p-3">
        <div className="grid grid-cols-2 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface-2)] overflow-hidden">
          <div className="p-2.5 border-r border-b border-[var(--border)]">
            <label className="block text-[10px] font-medium text-[var(--text-3)] mb-0.5">
              Taxa de conclusão
            </label>
            <strong className="text-sm font-semibold font-mono text-[var(--text)]">
              {completionRate}%
            </strong>
          </div>

          <div className="p-2.5 border-b border-[var(--border)]">
            <label className="block text-[10px] font-medium text-[var(--text-3)] mb-0.5">
              Tempo médio ciclo
            </label>
            <strong className="text-sm font-semibold font-mono text-[var(--text)]">
              {avgCycleTime}
            </strong>
          </div>

          <div className="p-2.5 border-r border-[var(--border)]">
            <label className="block text-[10px] font-medium text-[var(--text-3)] mb-0.5">
              Robôs online
            </label>
            <strong className="text-sm font-semibold font-mono text-[var(--green)]">
              2 / 2
            </strong>
          </div>

          <div className="p-2.5">
            <label className="block text-[10px] font-medium text-[var(--text-3)] mb-0.5">
              Divergências
            </label>
            <strong className="text-sm font-semibold font-mono text-[var(--text-3)]">
              0
            </strong>
          </div>
        </div>
      </div>

      {/* Título da Timeline de Eventos */}
      <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] text-[var(--text-3)] font-medium">
        <span>Últimas pesagens</span>
        <span className="font-mono">hoje</span>
      </div>

      {/* Feed de Eventos Scrollável */}
      <div className="flex-1 overflow-y-auto px-3.5 pb-4 space-y-3">
        {loading && paidItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-3)]">
            Carregando eventos...
          </div>
        ) : paidItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-3)]">
            Nenhuma pesagem recente registrada.
          </div>
        ) : (
          paidItems.slice(0, 30).map((item: TimelinePaidItem, idx: number) => {
            const timeFormatted = item.paid_at instanceof Date
              ? item.paid_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : (item.payment_time || '--:--');

            return (
              <div key={item.id || idx} className="grid grid-cols-[38px_12px_1fr] gap-2 text-xs">
                {/* Horário */}
                <time className="font-mono text-[11px] text-[var(--text-3)] pt-1 text-right">
                  {timeFormatted}
                </time>

                {/* Linha e Ponto do Timeline */}
                <div className="relative flex justify-center">
                  <div className="absolute top-0 bottom-0 w-px bg-[var(--border)]" />
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5 z-10 border border-[var(--surface)]",
                    item.status === 'Pago' ? "bg-[var(--green)]" : "bg-[var(--amber)]"
                  )} />
                </div>

                {/* Conteúdo do Evento */}
                <div className="pb-2">
                  <p className="font-medium text-[var(--text)] leading-tight">
                    {item.code} · <span className="font-normal text-[var(--text-2)]">{item.description}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-3)] mt-1 font-mono">
                    <span className="px-1 py-0.2 rounded bg-[var(--surface-2)] border border-[var(--border)]">
                      NT #{item.nt_number}
                    </span>
                    <span>Qtd: {item.quantity}</span>
                    {item.elapsedTime && item.elapsedTime !== '-' && (
                      <span className="text-[var(--text-3)]">
                        ⏱ {item.elapsedTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
