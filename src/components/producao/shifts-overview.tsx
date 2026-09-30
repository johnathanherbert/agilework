"use client";

import { ProductionItem, ProductionTurno } from '@/types';
import {
  SHIFT_SCHEDULES,
  getShiftStats,
  getShiftPhase,
  RITMO_TOLERANCIA_PCT,
  formatDuration,
} from '@/lib/production-schedule';
import { cn } from '@/lib/utils';

interface ShiftsOverviewProps {
  items: ProductionItem[];
  now: Date;
  onShiftClick?: (turno: ProductionTurno) => void;
}

export function ShiftsOverview({ items, now, onShiftClick }: ShiftsOverviewProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
      {SHIFT_SCHEDULES.map((shift, idx) => {
        const stats = getShiftStats(shift.n, items);
        const phase = getShiftPhase(shift.n, now);
        const hasOrders = stats.lots > 0;
        const elapsedPct = phase.k === 'now' ? Math.round((phase.el || 0) * 100) : null;
        const isBadPace = phase.k === 'now' && hasOrders && stats.pct < (elapsedPct || 0) - RITMO_TOLERANCIA_PCT;

        let paceText = '';
        if (phase.k === 'now' && stats.prog > 0) {
          paceText = `${isBadPace ? 'Abaixo do ritmo' : 'No ritmo'} · ${elapsedPct}% do turno decorrido, termina em ${formatDuration(phase.leftMinutes || 0)}`;
        } else if (phase.k === 'next') {
          paceText = `Começa em ${formatDuration(phase.toMinutes || 0)}`;
        } else if (phase.k === 'done') {
          paceText = stats.prog > 0 && stats.real < stats.prog ? `Fechou com saldo de ${stats.prog - stats.real} OP(s)` : 'Turno finalizado';
        }

        return (
          <div
            key={shift.n}
            onClick={() => onShiftClick?.(shift.n)}
            className={cn(
              "p-4 border-b md:border-b-0 border-[var(--border)] min-w-0 transition-colors flex flex-col justify-between cursor-pointer hover:bg-[var(--hover)]",
              idx < SHIFT_SCHEDULES.length - 1 && "md:border-r",
              !hasOrders && "opacity-90"
            )}
          >
            <div>
              {/* Topo do card do turno */}
              <div className="flex justify-between items-center mb-2.5 gap-2">
                <b className="font-semibold text-[13px] text-[var(--text)]">{shift.l}</b>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11.5px] font-medium whitespace-nowrap",
                    phase.k === 'now' && "text-[var(--text)] font-semibold",
                    phase.k === 'done' && "text-[var(--text-3)]",
                    phase.k === 'next' && "text-[var(--text-3)]"
                  )}
                >
                  <i
                    className={cn(
                      "w-1.5 h-1.5 rounded-full inline-block",
                      phase.k === 'now' && "bg-[var(--accent)] animate-pulse",
                      phase.k === 'done' && "bg-[var(--text-3)]",
                      phase.k === 'next' && "border border-[var(--text-3)] bg-transparent"
                    )}
                  />
                  {phase.l}
                </span>
              </div>

              {/* Número grande de % e quantidade */}
              <div className="flex items-baseline gap-2 mb-2.5">
                <strong className={cn(
                  "text-2xl lg:text-[26px] font-semibold tracking-tight font-mono leading-none",
                  hasOrders ? "text-[var(--text)]" : "text-[var(--text-3)]"
                )}>
                  {hasOrders ? `${stats.pct}%` : '—'}
                </strong>
                <span className="text-xs text-[var(--text-3)] font-mono">
                  {hasOrders ? `${stats.real} de ${stats.prog} ordens` : 'sem ordens'}
                </span>
              </div>

              {/* Barra de Progresso com marcador de tempo decorrido */}
              <div className="h-1.5 w-full bg-[var(--track)] rounded-full overflow-hidden relative mb-3">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    stats.real >= stats.prog && stats.prog > 0 ? "bg-[var(--green)]" : "bg-[var(--text-2)]"
                  )}
                  style={{ width: `${Math.min(stats.pct, 100)}%` }}
                />
                {elapsedPct !== null && (
                  <b
                    className="absolute -top-0.5 -bottom-0.5 w-[2px] bg-[var(--accent)] pointer-events-none"
                    style={{ left: `calc(${Math.min(elapsedPct, 100)}% - 1px)` }}
                    title={`Tempo decorrido: ${elapsedPct}%`}
                  />
                )}
              </div>

              {/* Detalhes Úmida / Seca / PD/PA */}
              <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-xs">
                <dt className="text-[var(--text-3)]">Úmida</dt>
                <dd className="font-mono text-right text-[var(--text-2)]">
                  {stats.u[0]}/{stats.u[1]}
                </dd>
                <dt className="text-[var(--text-3)]">Seca</dt>
                <dd className="font-mono text-right text-[var(--text-2)]">
                  {stats.s[0]}/{stats.s[1]}
                </dd>
                <dt className="text-[var(--text-3)]">PD/PA</dt>
                <dd className="font-mono text-right text-[var(--text-2)]">
                  {stats.pdpaTotal[0]}/{stats.pdpaTotal[1]}
                </dd>
              </dl>
            </div>

            {/* Ritmo / Rodapé */}
            {paceText && (
              <div
                className={cn(
                  "mt-2.5 pt-2 border-t border-[var(--border)] text-xs leading-relaxed",
                  isBadPace ? "text-[var(--red)] font-medium" : "text-[var(--text-2)]"
                )}
              >
                <b>{isBadPace ? 'Abaixo do ritmo' : phase.k === 'now' ? 'No ritmo' : ''}</b>
                {phase.k === 'now' ? ` · ${elapsedPct}% do turno, fim em ${formatDuration(phase.leftMinutes || 0)}` : ` · ${paceText}`}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
