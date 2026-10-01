"use client";

import { NT } from '@/types';
import { cn, parseDateTime, isItemDelayed } from '@/lib/utils';

interface NTStatsProps {
  nts: NT[];
  className?: string;
}

export function NTStats({ nts, className }: NTStatsProps) {
  // Calcular métricas
  const totalNTs = nts.length;
  let totalItems = 0;
  let pendingItems = 0;
  let paidItems = 0;
  let delayedItems = 0;

  nts.forEach(nt => {
    if (!nt.items) return;

    nt.items.forEach(item => {
      totalItems++;
      if (item.status === 'Ag. Pagamento') {
        pendingItems++;
        try {
          const { creationDate } = parseDateTime(
            item.created_date || nt.created_date,
            item.created_time || nt.created_time
          );
          if (creationDate && !isNaN(creationDate.getTime())) {
            if (isItemDelayed(creationDate, item.code)) {
              delayedItems++;
            }
          }
        } catch (error) {}
      } else if (item.status === 'Pago') {
        paidItems++;
      } else if (item.status === 'Pago Parcial') {
        // Tratar parcial se houver
        pendingItems++;
      }
    });
  });

  return (
    <section className={cn(
      "grid grid-cols-2 md:grid-cols-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] select-none divide-y md:divide-y-0 md:divide-x divide-[var(--border)]",
      className
    )}>
      {/* Bloco 1: NTs abertas */}
      <div className="p-3 md:p-3.5">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
          NTs abertas
        </label>
        <div className="flex items-baseline gap-2">
          <strong className="text-xl md:text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
            {totalNTs}
          </strong>
          <small className="text-xs text-[var(--text-3)] font-normal">
            {totalItems} itens
          </small>
        </div>
      </div>

      {/* Bloco 2: Em atraso */}
      <div className={cn("p-3 md:p-3.5", delayedItems > 0 && "text-[var(--red)]")}>
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] inline-block shrink-0" />
          Em atraso
        </label>
        <div className="flex items-baseline gap-2">
          <strong className={cn(
            "text-xl md:text-2xl font-semibold font-mono tracking-tight",
            delayedItems > 0 ? "text-[var(--red)]" : "text-[var(--text)]"
          )}>
            {delayedItems}
          </strong>
          <small className="text-xs text-[var(--text-3)] font-normal">
            &gt; 2h abertas
          </small>
        </div>
      </div>

      {/* Bloco 3: Itens pendentes */}
      <div className="p-3 md:p-3.5">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] inline-block shrink-0" />
          Itens pendentes
        </label>
        <div className="flex items-baseline gap-2">
          <strong className="text-xl md:text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
            {pendingItems}
          </strong>
          <small className="text-xs text-[var(--text-3)] font-normal">
            aguardando pesagem
          </small>
        </div>
      </div>

      {/* Bloco 4: Pagos / Concluídos hoje */}
      <div className="p-3 md:p-3.5">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] inline-block shrink-0" />
          Concluídas / Pagos
        </label>
        <div className="flex items-baseline gap-2">
          <strong className="text-xl md:text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
            {paidItems}
          </strong>
          <small className="text-xs text-[var(--text-3)] font-normal">
            {totalItems > 0 ? `${Math.round((paidItems / totalItems) * 100)}%` : '0%'} pagos
          </small>
        </div>
      </div>
    </section>
  );
}