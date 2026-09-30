"use client";

import { ProductionInsight } from '@/lib/production-schedule';
import { cn } from '@/lib/utils';

interface AttentionPointsProps {
  insights: ProductionInsight[];
  onSelectInsight: (insight: ProductionInsight) => void;
}

export function AttentionPoints({ insights, onSelectInsight }: AttentionPointsProps) {
  if (!insights.length) return null;

  return (
    <section className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <h2 className="text-[13px] font-semibold text-[var(--text)]">Pontos de atenção</h2>
        <span className="text-xs text-[var(--text-3)] font-mono">
          {insights.length} {insights.length === 1 ? 'item' : 'itens'} · gerados automaticamente
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:[&>*:nth-child(n+3)]:border-t border-[var(--border)]">
        {insights.map((insight, index) => (
          <div
            key={insight.id}
            onClick={() => onSelectInsight(insight)}
            className={cn(
              "grid grid-cols-[10px_1fr_auto] gap-2.5 items-start p-3 md:px-4 md:py-3 cursor-pointer hover:bg-[var(--hover)] transition-colors",
              index % 2 === 0 && "md:border-r border-[var(--border)]"
            )}
          >
            <i
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: insight.color }}
            />
            <div className="min-w-0 pr-2">
              <b className="font-semibold text-xs text-[var(--text)] block leading-snug">
                {insight.title}
              </b>
              <p className="text-xs text-[var(--text-3)] mt-0.5 leading-relaxed">
                {insight.desc}
              </p>
            </div>
            {insight.tag && (
              <em className="not-italic text-[11px] font-mono text-[var(--text-3)] whitespace-nowrap mt-0.5">
                {insight.tag}
              </em>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
