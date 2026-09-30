"use client";

import { useMemo } from 'react';
import { ProductionItem } from '@/types';
import { SHIFT_SCHEDULES, getShiftStats, getItemStatus } from '@/lib/production-schedule';
import { cn } from '@/lib/utils';

interface DaySummaryBarProps {
  items: ProductionItem[];
  now: Date;
}

export function DaySummaryBar({ items, now }: DaySummaryBarProps) {
  const totals = useMemo(() => {
    const ordens = items.filter((x) => x.tipo === 'ordem');
    const auto = items.filter((x) => x.tipo === 'auto');
    const direta = items.filter((x) => x.tipo === 'direta');
    const pdpa = [...auto, ...direta];

    const ordensProg = ordens.reduce((a, c) => a + c.prog, 0);
    const ordensReal = ordens.reduce((a, c) => a + c.real, 0);
    const ordensPct = ordensProg > 0 ? Math.round((ordensReal / ordensProg) * 100) : 0;

    const pdpaProg = pdpa.reduce((a, c) => a + c.prog, 0);
    const pdpaReal = pdpa.reduce((a, c) => a + c.real, 0);
    const pdpaPct = pdpaProg > 0 ? Math.round((pdpaReal / pdpaProg) * 100) : 0;

    const umida = ordens.filter((x) => x.via === 'UMIDA');
    const seca = ordens.filter((x) => x.via === 'SECA');

    const uReal = umida.reduce((a, c) => a + c.real, 0);
    const uProg = umida.reduce((a, c) => a + c.prog, 0);
    const uPct = uProg > 0 ? Math.round((uReal / uProg) * 100) : 0;

    const sReal = seca.reduce((a, c) => a + c.real, 0);
    const sProg = seca.reduce((a, c) => a + c.prog, 0);
    const sPct = sProg > 0 ? Math.round((sReal / sProg) * 100) : 0;

    const aReal = auto.reduce((a, c) => a + c.real, 0);
    const aProg = auto.reduce((a, c) => a + c.prog, 0);

    const dReal = direta.reduce((a, c) => a + c.real, 0);
    const dProg = direta.reduce((a, c) => a + c.prog, 0);

    const openBalance = ordens.filter((x) => x.real < x.prog).reduce((a, c) => a + (c.prog - c.real), 0);
    const naoConcluidas = ordens
      .filter((x) => getItemStatus(x, now).k === 'nao')
      .reduce((a, c) => a + (c.prog - c.real), 0);
    const lpCount = ordens.filter((x) => x.lp).length;

    const shiftSplits = SHIFT_SCHEDULES.map((s) => {
      const st = getShiftStats(s.n, items);
      return {
        shift: s,
        ordensProg: st.prog,
        ordensReal: st.real,
        pdpaProg: st.pdpaTotal[1],
        pdpaReal: st.pdpaTotal[0],
      };
    });

    return {
      lots: ordens.length,
      pdpaCount: pdpa.length,
      ordensProg,
      ordensReal,
      ordensPct,
      pdpaProg,
      pdpaReal,
      pdpaPct,
      uReal,
      uProg,
      uPct,
      sReal,
      sProg,
      sPct,
      aReal,
      aProg,
      dReal,
      dProg,
      openBalance,
      naoConcluidas,
      lpCount,
      shiftSplits,
    };
  }, [items, now]);

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
      {/* Bloco 1: Ordens do Dia */}
      <div className="p-4 md:p-5 border-b md:border-b-0 md:border-r border-[var(--border)] min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center text-xs text-[var(--text-3)] mb-1.5">
            <span className="font-medium">Ordens entregues no dia</span>
            <span className="font-mono">{totals.lots} {totals.lots === 1 ? 'lote' : 'lotes'}</span>
          </div>

          <div className="flex items-baseline gap-1.5 mb-2.5">
            <strong className="text-3xl lg:text-[34px] font-semibold tracking-tight leading-none text-[var(--text)] font-mono">
              {totals.ordensReal}
            </strong>
            <span className="text-lg text-[var(--text-3)] font-medium font-mono">
              /{totals.ordensProg}
            </span>
            <em className="not-italic ml-auto font-mono text-sm lg:text-[15px] font-medium text-[var(--text-2)]">
              {totals.ordensPct}%
            </em>
          </div>

          <div className="h-2 w-full bg-[var(--track)] rounded-full overflow-hidden relative">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                totals.ordensReal >= totals.ordensProg && totals.ordensProg > 0
                  ? "bg-[var(--green)]"
                  : "bg-[var(--accent)]"
              )}
              style={{ width: `${Math.min(totals.ordensPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3.5 mt-3 pt-2 text-xs text-[var(--text-3)] flex-wrap border-t border-[var(--border)]/60">
          {totals.shiftSplits.map(({ shift, ordensProg, ordensReal }) => (
            <span key={shift.n} className="flex items-center gap-1">
              <span>{shift.short}</span>
              <b className="font-mono font-medium text-[var(--text-2)]">
                {ordensProg > 0 ? `${ordensReal}/${ordensProg}` : '—'}
              </b>
            </span>
          ))}
        </div>
      </div>

      {/* Bloco 2: PD/PA do Dia */}
      <div className="p-4 md:p-5 border-b md:border-b-0 md:border-r border-[var(--border)] min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center text-xs text-[var(--text-3)] mb-1.5">
            <span className="font-medium">PD/PA entregues no dia</span>
            <span className="font-mono">{totals.pdpaCount} {totals.pdpaCount === 1 ? 'item' : 'itens'}</span>
          </div>

          <div className="flex items-baseline gap-1.5 mb-2.5">
            <strong className="text-3xl lg:text-[34px] font-semibold tracking-tight leading-none text-[var(--text)] font-mono">
              {totals.pdpaReal}
            </strong>
            <span className="text-lg text-[var(--text-3)] font-medium font-mono">
              /{totals.pdpaProg}
            </span>
            <em className="not-italic ml-auto font-mono text-sm lg:text-[15px] font-medium text-[var(--text-2)]">
              {totals.pdpaPct}%
            </em>
          </div>

          <div className="h-2 w-full bg-[var(--track)] rounded-full overflow-hidden relative">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                totals.pdpaReal >= totals.pdpaProg && totals.pdpaProg > 0
                  ? "bg-[var(--green)]"
                  : "bg-[var(--accent)]"
              )}
              style={{ width: `${Math.min(totals.pdpaPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3.5 mt-3 pt-2 text-xs text-[var(--text-3)] flex-wrap border-t border-[var(--border)]/60">
          {totals.shiftSplits.map(({ shift, pdpaProg, pdpaReal }) => (
            <span key={shift.n} className="flex items-center gap-1">
              <span>{shift.short}</span>
              <b className="font-mono font-medium text-[var(--text-2)]">
                {pdpaProg > 0 ? `${pdpaReal}/${pdpaProg}` : '—'}
              </b>
            </span>
          ))}
        </div>
      </div>

      {/* Bloco 3: Detalhamento Operacional */}
      <div className="p-4 md:p-5 min-w-0 flex flex-col justify-center">
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-[var(--text-3)]">Úmida</dt>
          <dd className="font-mono text-right text-[var(--text-2)]">
            {totals.uReal}/{totals.uProg} <span className="text-[var(--text-3)]">·</span> {totals.uPct}%
          </dd>

          <dt className="text-[var(--text-3)]">Seca</dt>
          <dd className="font-mono text-right text-[var(--text-2)]">
            {totals.sReal}/{totals.sProg} <span className="text-[var(--text-3)]">·</span> {totals.sPct}%
          </dd>

          <dt className="text-[var(--text-3)]">PD/PA automática · direta</dt>
          <dd className="font-mono text-right text-[var(--text-2)]">
            {totals.aReal}/{totals.aProg} <span className="text-[var(--text-3)]">·</span> {totals.dReal}/{totals.dProg}
          </dd>

          <dt className="text-[var(--text-3)]">Saldo a produzir</dt>
          <dd className="font-mono text-right text-[var(--text-2)]">{totals.openBalance}</dd>

          <dt className="text-[var(--text-3)]">Não concluídas (turnos encerrados)</dt>
          <dd className={cn("font-mono text-right font-medium", totals.naoConcluidas > 0 ? "text-[var(--red)]" : "text-[var(--text-2)]")}>
            {totals.naoConcluidas}
          </dd>

          <dt className="text-[var(--text-3)]">Lotes piloto</dt>
          <dd className="font-mono text-right text-[var(--text-2)]">{totals.lpCount}</dd>
        </dl>
      </div>
    </section>
  );
}
