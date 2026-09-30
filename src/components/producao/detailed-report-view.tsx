"use client";

import React from 'react';
import { Plus, Minus, Lock, GitBranch } from 'lucide-react';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import {
  SHIFT_SCHEDULES,
  getShiftStats,
  getShiftPhase,
  getItemStatus,
  getCarryNote,
} from '@/lib/production-schedule';
import { cn } from '@/lib/utils';

interface DetailedReportViewProps {
  items: ProductionItem[];
  visibleShifts: ProductionTurno[];
  now: Date;
  searchQuery: string;
  selectedFamily: string | null;
  selectedVia: string | null;
  hideCompleted: boolean;
  onItemClick: (item: ProductionItem) => void;
  onAddClick: (turno: ProductionTurno, via?: ProductionVia) => void;
  onUpdateQty: (item: ProductionItem, delta: number, e: React.MouseEvent) => void;
}

export function DetailedReportView({
  items,
  visibleShifts,
  now,
  searchQuery,
  selectedFamily,
  selectedVia,
  hideCompleted,
  onItemClick,
  onAddClick,
  onUpdateQty,
}: DetailedReportViewProps) {
  const activeShiftList = SHIFT_SCHEDULES.filter((s) => visibleShifts.includes(s.n));

  const filterItem = (item: ProductionItem) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchProd = item.produto.toLowerCase().includes(q);
      const matchCode = (item.codigoReceita || '').toLowerCase().includes(q);
      const matchFam = (item.familia || '').toLowerCase().includes(q);
      if (!matchProd && !matchCode && !matchFam) return false;
    }
    if (selectedFamily && item.tipo === 'ordem') {
      const fam = (item.familia || '').toLowerCase();
      if (!fam.startsWith(selectedFamily.toLowerCase())) return false;
    }
    if (selectedVia && item.tipo === 'ordem') {
      if (selectedVia === 'umida' && item.via !== 'UMIDA') return false;
      if (selectedVia === 'seca' && item.via !== 'SECA') return false;
    }
    if (hideCompleted && item.prog > 0 && item.real >= item.prog) {
      return false;
    }
    return true;
  };

  if (!activeShiftList.length) {
    return (
      <div className="p-12 text-center text-xs text-[var(--text-3)] border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)]">
        Nenhum turno selecionado para visualização.
      </div>
    );
  }

  return (
    <div className="space-y-4" id="shifts">
      {activeShiftList.map((shift) => {
        const stats = getShiftStats(shift.n, items);
        const phase = getShiftPhase(shift.n, now);
        const elapsedPct = phase.k === 'now' ? Math.round((phase.el || 0) * 100) : null;

        const shiftOrders = items.filter((x) => x.turno === shift.n && x.tipo === 'ordem');
        const umidaOrders = shiftOrders.filter((x) => x.via === 'UMIDA');
        const secaOrders = shiftOrders.filter((x) => x.via === 'SECA');

        const shiftPdpa = items.filter((x) => x.turno === shift.n && (x.tipo === 'auto' || x.tipo === 'direta'));
        const autoPdpa = shiftPdpa.filter((x) => x.tipo === 'auto');
        const diretaPdpa = shiftPdpa.filter((x) => x.tipo === 'direta');

        return (
          <section
            key={shift.n}
            id={`sh-${shift.n}`}
            className={cn(
              "border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs",
              phase.k === 'now' && "border-l-4 border-l-[var(--accent)]"
            )}
          >
            {/* Cabeçalho do Turno */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3.5 sm:px-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex items-baseline gap-3">
                <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">
                  {shift.l}
                </h2>
                <span className="font-mono text-xs text-[var(--text-3)]">
                  {String(shift.ini[1] < 0 ? 24 + shift.ini[1] : shift.ini[1]).padStart(2, '0')}:{String(shift.ini[2]).padStart(2, '0')}–{String(shift.fim[1]).padStart(2, '0')}:{String(shift.fim[2]).padStart(2, '0')}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ml-1",
                    phase.k === 'now' ? "text-[var(--text)] font-semibold" : "text-[var(--text-3)]"
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

              <div className="flex items-center gap-4 sm:gap-6 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
                {/* KPI Ordens */}
                <div className="grid grid-cols-[auto_90px] gap-x-2 gap-y-0.5 items-center text-xs">
                  <label className="col-span-2 text-[11.5px] text-[var(--text-3)]">Ordens</label>
                  <b className="font-mono font-medium text-sm text-[var(--text)]">
                    {stats.real}<small className="text-xs text-[var(--text-3)]">/{stats.prog}</small>{' '}
                    <span className="text-xs font-normal text-[var(--text-2)]">· {stats.pct}%</span>
                  </b>
                  <div className="h-1.5 w-full bg-[var(--track)] rounded-full overflow-hidden relative">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        stats.real >= stats.prog && stats.prog > 0 ? "bg-[var(--green)]" : "bg-[var(--text-2)]"
                      )}
                      style={{ width: `${Math.min(stats.pct, 100)}%` }}
                    />
                    {elapsedPct !== null && (
                      <b
                        className="absolute -top-0.5 -bottom-0.5 w-[2px] bg-[var(--accent)]"
                        style={{ left: `calc(${Math.min(elapsedPct, 100)}% - 1px)` }}
                        title={`Tempo decorrido: ${elapsedPct}%`}
                      />
                    )}
                  </div>
                </div>

                {/* KPI PD/PA */}
                <div className="grid grid-cols-[auto_90px] gap-x-2 gap-y-0.5 items-center text-xs">
                  <label className="col-span-2 text-[11.5px] text-[var(--text-3)]">PD/PA</label>
                  <b className="font-mono font-medium text-sm text-[var(--text)]">
                    {stats.pdpaTotal[0]}<small className="text-xs text-[var(--text-3)]">/{stats.pdpaTotal[1]}</small>{' '}
                    <span className="text-xs font-normal text-[var(--text-2)]">· {stats.pdpaPct}%</span>
                  </b>
                  <div className="h-1.5 w-full bg-[var(--track)] rounded-full overflow-hidden relative">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        stats.pdpaTotal[0] >= stats.pdpaTotal[1] && stats.pdpaTotal[1] > 0 ? "bg-[var(--green)]" : "bg-[var(--text-2)]"
                      )}
                      style={{ width: `${Math.min(stats.pdpaPct, 100)}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAddClick(shift.n)}
                  className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 no-print cursor-pointer shrink-0"
                >
                  <Plus size={13} />
                  <span>Ordem</span>
                </button>
              </div>
            </div>

            {/* Corpo do Turno com 2 painéis (Ordens e PD/PA) */}
            {!stats.lots && !shiftPdpa.length ? (
              <div className="p-6 text-center text-xs text-[var(--text-3)]">
                Nenhuma ordem programada para este turno.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
                {/* Tabela de Ordens */}
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full border-collapse table-fixed text-left text-xs">
                    <colgroup>
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '86px' }} />
                      <col />
                      <col style={{ width: '170px' }} />
                      <col style={{ width: '96px' }} />
                      <col style={{ width: '110px' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[11.5px] font-medium text-[var(--text-3)] h-8">
                        <th className="pl-4 pr-2 font-medium">Máquina</th>
                        <th className="px-2 font-medium">Código</th>
                        <th className="px-2 font-medium">Produto</th>
                        <th className="px-2 font-medium">Status</th>
                        <th className="px-2 font-medium text-right">Real/Prog</th>
                        <th className="pr-4 pl-2 font-medium">Avanço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Grupo ÚMIDA */}
                      {(!selectedVia || selectedVia === 'umida') && (
                        <React.Fragment>
                          <tr className="bg-[var(--surface-2)] font-semibold text-[12px] text-[var(--text)] border-b border-[var(--border)]">
                            <td colSpan={6} className="py-2 pl-4 pr-4">
                              <div className="flex items-center justify-between">
                                <span>
                                  ÚMIDA
                                  <span className="font-mono font-normal text-[var(--text-3)] ml-2">
                                    {umidaOrders.reduce((a, c) => a + c.real, 0)}/{umidaOrders.reduce((a, c) => a + c.prog, 0)}{' '}
                                    ·{' '}
                                    {umidaOrders.reduce((a, c) => a + c.prog, 0) > 0
                                      ? Math.round(
                                          (umidaOrders.reduce((a, c) => a + c.real, 0) /
                                            umidaOrders.reduce((a, c) => a + c.prog, 0)) *
                                            100
                                        )
                                      : 0}
                                    %
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onAddClick(shift.n, 'UMIDA')}
                                  className="text-xs font-normal text-[var(--text-3)] hover:text-[var(--text)] no-print cursor-pointer"
                                >
                                  + adicionar
                                </button>
                              </div>
                            </td>
                          </tr>

                          {umidaOrders.filter(filterItem).length === 0 ? (
                            <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-center">
                              <td colSpan={6} className="py-3 text-xs">
                                {umidaOrders.length > 0 ? 'Nenhuma ordem no filtro' : 'Sem ordens'}
                              </td>
                            </tr>
                          ) : (
                            umidaOrders.filter(filterItem).map((x) => {
                              const st = getItemStatus(x, now);
                              const note = getCarryNote(x, items, now);
                              const pct = x.prog > 0 ? Math.round((x.real / x.prog) * 100) : 0;

                              return (
                                <tr
                                  key={x.id}
                                  id={`item-${x.id}`}
                                  onClick={() => onItemClick(x)}
                                  className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group"
                                >
                                  <td className="py-2 pl-4 pr-2 align-middle">
                                    <span className={cn("font-mono text-xs whitespace-nowrap", x.familia ? "text-[var(--text)]" : "text-[var(--amber)]")}>
                                      {x.familia || 'Sem máquina'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 align-middle font-mono text-xs text-[var(--text-3)] whitespace-nowrap">
                                    {x.codigoReceita || '—'}
                                  </td>
                                  <td className="py-2 px-2 align-middle min-w-0">
                                    <div className="font-medium text-[var(--text)] leading-snug">
                                      {x.lp && (
                                        <span className="inline-block text-[10.5px] font-semibold text-[var(--purple)] border border-[var(--purple)] rounded px-1 mr-1.5 leading-tight">
                                          LP
                                        </span>
                                      )}
                                      {x.locked && <Lock size={12} className="inline mr-1 text-[var(--amber)]" />}
                                      {x.splitParentId && <GitBranch size={12} className="inline mr-1 text-[var(--accent)]" />}
                                      {x.produto}
                                    </div>
                                    {note && (
                                      <span className={cn("text-[11.5px] block mt-0.5", note.type === 'warn' ? "text-[var(--amber)]" : "text-[var(--text-3)]")}>
                                        {note.text}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 align-middle whitespace-nowrap">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1.5 text-xs",
                                        st.k === 'ok' && "text-[var(--text-2)]",
                                        st.k === 'and' && "text-[var(--text)]",
                                        st.k === 'nao' && "text-[var(--red)] font-medium",
                                        (st.k === 'pend' || st.k === 'prog') && "text-[var(--text-3)]"
                                      )}
                                    >
                                      <i
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                                          st.k === 'ok' && "bg-[var(--green)]",
                                          st.k === 'and' && "bg-[var(--amber)]",
                                          st.k === 'nao' && "bg-[var(--red)]",
                                          (st.k === 'pend' || st.k === 'prog') && "border border-[var(--text-3)] bg-transparent"
                                        )}
                                      />
                                      {st.l}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 align-middle text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1 font-mono text-xs">
                                      <button
                                        type="button"
                                        onClick={(e) => onUpdateQty(x, -1, e)}
                                        disabled={x.locked || x.real <= 0}
                                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                        title="Diminuir 1"
                                      >
                                        <Minus size={11} />
                                      </button>
                                      <span className="font-semibold text-[var(--text)]">{x.real}</span>
                                      <small className="text-[var(--text-3)]">/{x.prog}</small>
                                      <button
                                        type="button"
                                        onClick={(e) => onUpdateQty(x, 1, e)}
                                        disabled={x.locked || x.real >= x.prog}
                                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                        title="Aumentar 1"
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 pr-4 pl-2 align-middle">
                                    <div className="flex items-center gap-2">
                                      <div className="h-1 flex-1 bg-[var(--track)] rounded-full overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all duration-300",
                                            pct >= 100 ? "bg-[var(--green)]" : "bg-[var(--text-2)]"
                                          )}
                                          style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-[11px] text-[var(--text-3)] w-8 text-right">
                                        {pct}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </React.Fragment>
                      )}

                      {/* Grupo SECA */}
                      {(!selectedVia || selectedVia === 'seca') && (
                        <React.Fragment>
                          <tr className="bg-[var(--surface-2)] font-semibold text-[12px] text-[var(--text)] border-b border-[var(--border)]">
                            <td colSpan={6} className="py-2 pl-4 pr-4">
                              <div className="flex items-center justify-between">
                                <span>
                                  SECA
                                  <span className="font-mono font-normal text-[var(--text-3)] ml-2">
                                    {secaOrders.reduce((a, c) => a + c.real, 0)}/{secaOrders.reduce((a, c) => a + c.prog, 0)}{' '}
                                    ·{' '}
                                    {secaOrders.reduce((a, c) => a + c.prog, 0) > 0
                                      ? Math.round(
                                          (secaOrders.reduce((a, c) => a + c.real, 0) /
                                            secaOrders.reduce((a, c) => a + c.prog, 0)) *
                                            100
                                        )
                                      : 0}
                                    %
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onAddClick(shift.n, 'SECA')}
                                  className="text-xs font-normal text-[var(--text-3)] hover:text-[var(--text)] no-print cursor-pointer"
                                >
                                  + adicionar
                                </button>
                              </div>
                            </td>
                          </tr>

                          {secaOrders.filter(filterItem).length === 0 ? (
                            <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-center">
                              <td colSpan={6} className="py-3 text-xs">
                                {secaOrders.length > 0 ? 'Nenhuma ordem no filtro' : 'Sem ordens'}
                              </td>
                            </tr>
                          ) : (
                            secaOrders.filter(filterItem).map((x) => {
                              const st = getItemStatus(x, now);
                              const note = getCarryNote(x, items, now);
                              const pct = x.prog > 0 ? Math.round((x.real / x.prog) * 100) : 0;

                              return (
                                <tr
                                  key={x.id}
                                  id={`item-${x.id}`}
                                  onClick={() => onItemClick(x)}
                                  className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group"
                                >
                                  <td className="py-2 pl-4 pr-2 align-middle">
                                    <span className={cn("font-mono text-xs whitespace-nowrap", x.familia ? "text-[var(--text)]" : "text-[var(--amber)]")}>
                                      {x.familia || 'Sem máquina'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 align-middle font-mono text-xs text-[var(--text-3)] whitespace-nowrap">
                                    {x.codigoReceita || '—'}
                                  </td>
                                  <td className="py-2 px-2 align-middle min-w-0">
                                    <div className="font-medium text-[var(--text)] leading-snug">
                                      {x.lp && (
                                        <span className="inline-block text-[10.5px] font-semibold text-[var(--purple)] border border-[var(--purple)] rounded px-1 mr-1.5 leading-tight">
                                          LP
                                        </span>
                                      )}
                                      {x.locked && <Lock size={12} className="inline mr-1 text-[var(--amber)]" />}
                                      {x.splitParentId && <GitBranch size={12} className="inline mr-1 text-[var(--accent)]" />}
                                      {x.produto}
                                    </div>
                                    {note && (
                                      <span className={cn("text-[11.5px] block mt-0.5", note.type === 'warn' ? "text-[var(--amber)]" : "text-[var(--text-3)]")}>
                                        {note.text}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 align-middle whitespace-nowrap">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1.5 text-xs",
                                        st.k === 'ok' && "text-[var(--text-2)]",
                                        st.k === 'and' && "text-[var(--text)]",
                                        st.k === 'nao' && "text-[var(--red)] font-medium",
                                        (st.k === 'pend' || st.k === 'prog') && "text-[var(--text-3)]"
                                      )}
                                    >
                                      <i
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                                          st.k === 'ok' && "bg-[var(--green)]",
                                          st.k === 'and' && "bg-[var(--amber)]",
                                          st.k === 'nao' && "bg-[var(--red)]",
                                          (st.k === 'pend' || st.k === 'prog') && "border border-[var(--text-3)] bg-transparent"
                                        )}
                                      />
                                      {st.l}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 align-middle text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1 font-mono text-xs">
                                      <button
                                        type="button"
                                        onClick={(e) => onUpdateQty(x, -1, e)}
                                        disabled={x.locked || x.real <= 0}
                                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                        title="Diminuir 1"
                                      >
                                        <Minus size={11} />
                                      </button>
                                      <span className="font-semibold text-[var(--text)]">{x.real}</span>
                                      <small className="text-[var(--text-3)]">/{x.prog}</small>
                                      <button
                                        type="button"
                                        onClick={(e) => onUpdateQty(x, 1, e)}
                                        disabled={x.locked || x.real >= x.prog}
                                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                        title="Aumentar 1"
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 pr-4 pl-2 align-middle">
                                    <div className="flex items-center gap-2">
                                      <div className="h-1 flex-1 bg-[var(--track)] rounded-full overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all duration-300",
                                            pct >= 100 ? "bg-[var(--green)]" : "bg-[var(--text-2)]"
                                          )}
                                          style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-[11px] text-[var(--text-3)] w-8 text-right">
                                        {pct}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </React.Fragment>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Tabela de PD/PA */}
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full border-collapse table-fixed text-left text-xs">
                    <colgroup>
                      <col />
                      <col style={{ width: '96px' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[11.5px] font-medium text-[var(--text-3)] h-8">
                        <th className="pl-4 pr-2 font-medium">Entregas PD/PA</th>
                        <th className="pr-4 pl-2 font-medium text-right">Real/Prog</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Automática */}
                      <tr className="bg-[var(--surface-2)] font-semibold text-[12px] text-[var(--text)] border-b border-[var(--border)]">
                        <td colSpan={2} className="py-2 pl-4 pr-4">
                          <span>
                            AUTOMÁTICA
                            <span className="font-mono font-normal text-[var(--text-3)] ml-2">
                              {autoPdpa.reduce((a, c) => a + c.real, 0)}/{autoPdpa.reduce((a, c) => a + c.prog, 0)} · {autoPdpa.length} {autoPdpa.length === 1 ? 'item' : 'itens'}
                            </span>
                          </span>
                        </td>
                      </tr>

                      {autoPdpa.filter(filterItem).length === 0 ? (
                        <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-center">
                          <td colSpan={2} className="py-2.5 text-xs">
                            Nenhum registro
                          </td>
                        </tr>
                      ) : (
                        autoPdpa.filter(filterItem).map((x) => {
                          const isDone = x.prog > 0 && x.real >= x.prog;
                          const isNao = phase.k === 'done' && x.real < x.prog;

                          return (
                            <tr
                              key={x.id}
                              id={`item-${x.id}`}
                              onClick={() => onItemClick(x)}
                              className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group"
                            >
                              <td className="py-2 pl-4 pr-2 align-middle min-w-0">
                                <span
                                  className={cn(
                                    "inline-block w-2 h-2 rounded-full mr-2",
                                    isDone && "bg-[var(--green)]",
                                    !isDone && x.real > 0 && "bg-[var(--amber)]",
                                    isNao && "bg-[var(--red)]",
                                    !isDone && x.real === 0 && !isNao && "border border-[var(--text-3)] bg-transparent"
                                  )}
                                />
                                <span className="font-normal text-[var(--text)] leading-snug">
                                  {x.produto}
                                </span>
                              </td>
                              <td className="py-2 pr-4 pl-2 align-middle text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1 font-mono text-xs">
                                  <button
                                    type="button"
                                    onClick={(e) => onUpdateQty(x, -1, e)}
                                    disabled={x.real <= 0}
                                    className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                    title="Diminuir 1"
                                  >
                                    <Minus size={11} />
                                  </button>
                                  <span className="font-semibold text-[var(--text)]">{x.real}</span>
                                  <small className="text-[var(--text-3)]">/{x.prog}</small>
                                  <button
                                    type="button"
                                    onClick={(e) => onUpdateQty(x, 1, e)}
                                    disabled={x.real >= x.prog}
                                    className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                    title="Aumentar 1"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {/* Direta */}
                      <tr className="bg-[var(--surface-2)] font-semibold text-[12px] text-[var(--text)] border-t-2 border-b border-[var(--border)]">
                        <td colSpan={2} className="py-2 pl-4 pr-4">
                          <span>
                            DIRETA
                            <span className="font-mono font-normal text-[var(--text-3)] ml-2">
                              {diretaPdpa.reduce((a, c) => a + c.real, 0)}/{diretaPdpa.reduce((a, c) => a + c.prog, 0)} · {diretaPdpa.length} {diretaPdpa.length === 1 ? 'item' : 'itens'}
                            </span>
                          </span>
                        </td>
                      </tr>

                      {diretaPdpa.filter(filterItem).length === 0 ? (
                        <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-center">
                          <td colSpan={2} className="py-2.5 text-xs">
                            Nenhum registro
                          </td>
                        </tr>
                      ) : (
                        diretaPdpa.filter(filterItem).map((x) => {
                          const isDone = x.prog > 0 && x.real >= x.prog;
                          const isNao = phase.k === 'done' && x.real < x.prog;

                          return (
                            <tr
                              key={x.id}
                              id={`item-${x.id}`}
                              onClick={() => onItemClick(x)}
                              className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group"
                            >
                              <td className="py-2 pl-4 pr-2 align-middle min-w-0">
                                <span
                                  className={cn(
                                    "inline-block w-2 h-2 rounded-full mr-2",
                                    isDone && "bg-[var(--green)]",
                                    !isDone && x.real > 0 && "bg-[var(--amber)]",
                                    isNao && "bg-[var(--red)]",
                                    !isDone && x.real === 0 && !isNao && "border border-[var(--text-3)] bg-transparent"
                                  )}
                                />
                                <span className="font-normal text-[var(--text)] leading-snug">
                                  {x.produto}
                                </span>
                              </td>
                              <td className="py-2 pr-4 pl-2 align-middle text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1 font-mono text-xs">
                                  <button
                                    type="button"
                                    onClick={(e) => onUpdateQty(x, -1, e)}
                                    disabled={x.real <= 0}
                                    className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                    title="Diminuir 1"
                                  >
                                    <Minus size={11} />
                                  </button>
                                  <span className="font-semibold text-[var(--text)]">{x.real}</span>
                                  <small className="text-[var(--text-3)]">/{x.prog}</small>
                                  <button
                                    type="button"
                                    onClick={(e) => onUpdateQty(x, 1, e)}
                                    disabled={x.real >= x.prog}
                                    className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                    title="Aumentar 1"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
