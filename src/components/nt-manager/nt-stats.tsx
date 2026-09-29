"use client";

import { NT } from '@/types';
import { cn } from '@/lib/utils';

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
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        try {
          const [year, month, day] = item.created_date.split('-').map(Number);
          const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
          const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
          
          if (!isNaN(creationDate.getTime())) {
            const elapsed = Date.now() - creationDate.getTime();
            if (elapsed > twoHoursInMs) {
              delayedItems++;
            }
          }
        } catch (error) {}
      } else if (item.status === 'Pago') {
        paidItems++;
      }
    });
  });

  return (
    <section className={cn(
      "grid grid-cols-2 md:grid-cols-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] shadow-xs select-none",
      className
    )}>
      {/* Bloco 1: NTs abertas */}
      <div className="p-3 md:p-3.5 border-r border-b md:border-b-0 border-[var(--border)]">
        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1 uppercase tracking-wider">
          NTs abertas
        </label>
        <div className="flex items-baseline gap-2">
          <strong className="text-xl md:text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
            {totalNTs}
          </strong>
          <small className="text-[11px] text-[var(--text-3)]">
            {totalItems} itens
          </small>
        </div>
      </div>

      {/* Bloco 2: Em atraso (> 2h) */}
      <div className="p-3 md:p-3.5 border-b md:border-b-0 md:border-r border-[var(--border)]">
        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1 uppercase tracking-wider">
          Em atraso
        </label>
        <div className="flex items-baseline gap-2">
          <strong className={cn(
            "text-xl md:text-2xl font-semibold font-mono tracking-tight",
            delayedItems > 0 ? "text-[var(--red)]" : "text-[var(--text)]"
          )}>
            {delayedItems}
          </strong>
          <small className="text-[11px] text-[var(--text-3)]">
            &gt; 2h sem início
          </small>
        </div>
      </div>

      {/* Bloco 3: Itens pendentes */}
      <div className="p-3 md:p-3.5 border-r border-[var(--border)]">
        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1 uppercase tracking-wider">
          Itens pendentes
        </label>
        <div className="flex items-baseline gap-2">
          <strong className="text-xl md:text-2xl font-semibold font-mono tracking-tight text-[var(--amber)]">
            {pendingItems}
          </strong>
          <small className="text-[11px] text-[var(--text-3)]">
            aguardando pesagem
          </small>
        </div>
      </div>

      {/* Bloco 4: Pagos / Concluídos */}
      <div className="p-3 md:p-3.5">
        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1 uppercase tracking-wider">
          Pagos / Concluídos
        </label>
        <div className="flex items-baseline gap-2">
          <strong className="text-xl md:text-2xl font-semibold font-mono tracking-tight text-[var(--green)]">
            {paidItems}
          </strong>
          <small className="text-[11px] text-[var(--text-3)]">
            {totalItems > 0 ? `${Math.round((paidItems / totalItems) * 100)}%` : '0%'} concluído
          </small>
        </div>
      </div>
    </section>
  );
}