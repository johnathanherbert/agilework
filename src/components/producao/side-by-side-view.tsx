"use client";

import React, { useState } from 'react';
import { Plus, Minus, Lock, GitBranch } from 'lucide-react';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import {
  SHIFT_SCHEDULES,
  getShiftStats,
  getShiftPhase,
  getItemStatus,
  getCarryNote,
  formatDuration,
  RITMO_TOLERANCIA_PCT,
} from '@/lib/production-schedule';
import { cn } from '@/lib/utils';

interface SideBySideViewProps {
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
  onMoveItem?: (itemId: string, destination: { turno: ProductionTurno; via?: ProductionVia }) => void;
}

export function SideBySideView({
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
  onMoveItem,
}: SideBySideViewProps) {
  const [draggedItem, setDraggedItem] = useState<ProductionItem | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

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

  const handleDragStart = (e: React.DragEvent, item: ProductionItem) => {
    setDraggedItem(item);
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, zoneKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== zoneKey) {
      setDragOverKey(zoneKey);
    }
  };

  const handleDrop = (e: React.DragEvent, turno: ProductionTurno, via?: ProductionVia) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!draggedItem || !onMoveItem) return;

    if (draggedItem.turno !== turno || (draggedItem.tipo === 'ordem' && via && draggedItem.via !== via)) {
      onMoveItem(draggedItem.id, { turno, via });
    }
    setDraggedItem(null);
  };

  if (!activeShiftList.length) {
    return (
      <div className="p-12 text-center text-xs text-[var(--text-3)] border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)]">
        Nenhum turno selecionado para visualização.
      </div>
    );
  }

  return (
    <div
      className="grid gap-3 items-start"
      style={{
        gridTemplateColumns: `repeat(${Math.max(activeShiftList.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {activeShiftList.map((shift) => {
        const stats = getShiftStats(shift.n, items);
        const phase = getShiftPhase(shift.n, now);
        const elapsedPct = phase.k === 'now' ? Math.round((phase.el || 0) * 100) : null;
        const isBadPace = phase.k === 'now' && stats.lots > 0 && stats.pct < (elapsedPct || 0) - RITMO_TOLERANCIA_PCT;

        let paceText = '';
        if (phase.k === 'now' && stats.prog > 0) {
          paceText = `${isBadPace ? 'Abaixo do ritmo' : 'No ritmo'} · ${elapsedPct}% do turno · termina em ${formatDuration(phase.leftMinutes || 0)}`;
        } else if (phase.k === 'next') {
          paceText = `Começa em ${formatDuration(phase.toMinutes || 0)}`;
        }

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
              "border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] min-w-0 overflow-hidden shadow-xs transition-all",
              phase.k === 'now' && "border-t-[3px] border-t-[var(--accent)]"
            )}
          >
            {/* Cabeçalho da Coluna */}
            <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text)]">{shift.l}</h2>
                <span className="font-mono text-[13px] text-[var(--text-3)] font-medium">
                  {String(shift.ini[1] < 0 ? 24 + shift.ini[1] : shift.ini[1]).padStart(2, '0')}:{String(shift.ini[2]).padStart(2, '0')}–{String(shift.fim[1]).padStart(2, '0')}:{String(shift.fim[2]).padStart(2, '0')}
                </span>
                <span className="flex-1" />
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
                    phase.k === 'now' ? "text-[var(--text)] font-semibold" : "text-[var(--text-3)]"
                  )}
                >
                  <i
                    className={cn(
                      "w-2 h-2 rounded-full inline-block",
                      phase.k === 'now' && "bg-[var(--accent)] animate-pulse",
                      phase.k === 'done' && "bg-[var(--text-3)]",
                      phase.k === 'next' && "border border-[var(--text-3)] bg-transparent"
                    )}
                  />
                  {phase.l}
                </span>
                <button
                  type="button"
                  onClick={() => onAddClick(shift.n)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                  title="Adicionar ordem neste turno"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* KPIs com barras */}
              <div className="grid grid-cols-2 gap-3 mt-2.5">
                <div>
                  <div className="flex justify-between text-xs text-[var(--text-3)] mb-1 font-medium">
                    <span>Ordens</span>
                    <span className="font-mono font-bold text-[var(--text)]">{stats.prog > 0 ? `${stats.pct}%` : ''}</span>
                  </div>
                  <b className="font-mono text-xl font-bold text-[var(--text)] leading-none block">
                    {stats.real}<small className="text-[13.5px] text-[var(--text-3)] font-semibold">/{stats.prog}</small>
                  </b>
                  <div className="h-2 w-full bg-[var(--track)] rounded-full overflow-hidden relative mt-1.5">
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

                <div>
                  <div className="flex justify-between text-xs text-[var(--text-3)] mb-1 font-medium">
                    <span>PD/PA</span>
                    <span className="font-mono font-bold text-[var(--text)]">{stats.pdpaTotal[1] > 0 ? `${stats.pdpaPct}%` : ''}</span>
                  </div>
                  <b className="font-mono text-xl font-bold text-[var(--text)] leading-none block">
                    {stats.pdpaTotal[0]}<small className="text-[13.5px] text-[var(--text-3)] font-semibold">/{stats.pdpaTotal[1]}</small>
                  </b>
                  <div className="h-2 w-full bg-[var(--track)] rounded-full overflow-hidden relative mt-1.5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        stats.pdpaTotal[0] >= stats.pdpaTotal[1] && stats.pdpaTotal[1] > 0 ? "bg-[var(--green)]" : "bg-[var(--text-2)]"
                      )}
                      style={{ width: `${Math.min(stats.pdpaPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {paceText && (
                <div
                  className={cn(
                    "mt-2.5 text-[12.5px]",
                    isBadPace ? "text-[var(--red)] font-medium" : "text-[var(--text-2)]"
                  )}
                >
                  <b>{isBadPace ? 'Abaixo do ritmo' : phase.k === 'now' ? 'No ritmo' : ''}</b>
                  {phase.k === 'now' ? ` · ${paceText}` : ` ${paceText}`}
                </div>
              )}
            </div>

            {/* Conteúdo: Tabelas Mini Agrupadas */}
            {!stats.lots && !shiftPdpa.length ? (
              <div className="p-8 text-center text-xs text-[var(--text-3)]">
                Nenhuma ordem programada
              </div>
            ) : (
              <table className="w-full border-collapse table-fixed text-left">
                <colgroup>
                  <col style={{ width: '22px' }} />
                  <col style={{ width: '86px' }} />
                  <col />
                  <col style={{ width: '64px' }} />
                </colgroup>
                <tbody>
                  {/* Seção ÚMIDA */}
                  {(!selectedVia || selectedVia === 'umida') && (
                    <React.Fragment>
                      <tr
                        className={cn(
                          "bg-[var(--surface-2)] text-[13px] font-bold text-[var(--text)] border-b border-[var(--border)]",
                          dragOverKey === `${shift.n}-UMIDA` && "bg-[var(--accent-weak)]"
                        )}
                        onDragOver={(e) => handleDragOver(e, `${shift.n}-UMIDA`)}
                        onDrop={(e) => handleDrop(e, shift.n, 'UMIDA')}
                      >
                        <td colSpan={4} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <span>
                              ÚMIDA
                              <span className="font-mono font-bold text-[var(--text-3)] ml-2">
                                {umidaOrders.reduce((a, c) => a + c.real, 0)}/{umidaOrders.reduce((a, c) => a + c.prog, 0)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => onAddClick(shift.n, 'UMIDA')}
                              className="text-xs font-semibold text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                            >
                              + add
                            </button>
                          </div>
                        </td>
                      </tr>

                      {umidaOrders.filter(filterItem).map((x) => {
                        const st = getItemStatus(x, now);
                        const note = getCarryNote(x, items, now);
                        return (
                          <tr
                            key={x.id}
                            id={`item-${x.id}`}
                            draggable={!x.locked}
                            onDragStart={(e) => handleDragStart(e, x)}
                            onClick={() => onItemClick(x)}
                            className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group leading-snug"
                          >
                            <td className="py-2.5 pl-3 pr-0 align-top">
                              <i
                                className={cn(
                                  "w-2.5 h-2.5 rounded-full block mt-1",
                                  st.k === 'ok' && "bg-[var(--green)]",
                                  st.k === 'and' && "bg-[var(--amber)]",
                                  st.k === 'nao' && "bg-[var(--red)]",
                                  st.k === 'pend' && "border border-[var(--text-3)] bg-transparent",
                                  st.k === 'prog' && "border border-[var(--text-3)] bg-transparent"
                                )}
                              />
                            </td>
                            <td className="py-2.5 px-2 align-top">
                              <div className={cn("font-mono text-[12.5px] font-semibold truncate", x.familia ? "text-[var(--text-2)]" : "text-[var(--amber)]")}>
                                {x.familia || 'Sem máq.'}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 align-top min-w-0">
                              <div className="text-[13.5px] font-semibold text-[var(--text)] leading-snug">
                                {x.lp && (
                                  <span className="inline-block text-[11px] font-bold text-[var(--purple)] border border-[var(--purple)] rounded px-1.5 mr-1.5 leading-tight">
                                    LP
                                  </span>
                                )}
                                {x.locked && <Lock size={12} className="inline mr-1 text-[var(--amber)]" />}
                                {x.splitParentId && <GitBranch size={12} className="inline mr-1 text-[var(--accent)]" />}
                                {x.produto}
                              </div>
                              {note && (
                                <span className={cn("text-xs font-medium block mt-0.5", note.type === 'warn' ? "text-[var(--amber)]" : "text-[var(--text-3)]")}>
                                  {note.text}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 pl-1 align-top text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, -1, e)}
                                  disabled={x.locked || x.real <= 0}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title="Diminuir 1"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className={cn(
                                  "font-mono text-[14.5px] font-bold tracking-tight",
                                  x.real > x.prog ? "text-[var(--green)]" : st.k === 'nao' ? "text-[var(--red)]" : "text-[var(--text)]"
                                )}>
                                  {x.real}<small className="text-[12px] text-[var(--text-3)] font-semibold">/{x.prog}</small>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, 1, e)}
                                  disabled={x.locked}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title={x.real >= x.prog ? "Adicionar excedente / oportunidade (+1)" : "Aumentar 1"}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  )}

                  {/* Seção SECA */}
                  {(!selectedVia || selectedVia === 'seca') && (
                    <React.Fragment>
                      <tr
                        className={cn(
                          "bg-[var(--surface-2)] text-[13px] font-bold text-[var(--text)] border-b border-[var(--border)]",
                          dragOverKey === `${shift.n}-SECA` && "bg-[var(--accent-weak)]"
                        )}
                        onDragOver={(e) => handleDragOver(e, `${shift.n}-SECA`)}
                        onDrop={(e) => handleDrop(e, shift.n, 'SECA')}
                      >
                        <td colSpan={4} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <span>
                              SECA
                              <span className="font-mono font-bold text-[var(--text-3)] ml-2">
                                {secaOrders.reduce((a, c) => a + c.real, 0)}/{secaOrders.reduce((a, c) => a + c.prog, 0)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => onAddClick(shift.n, 'SECA')}
                              className="text-xs font-semibold text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                            >
                              + add
                            </button>
                          </div>
                        </td>
                      </tr>

                      {secaOrders.filter(filterItem).map((x) => {
                        const st = getItemStatus(x, now);
                        const note = getCarryNote(x, items, now);
                        return (
                          <tr
                            key={x.id}
                            id={`item-${x.id}`}
                            draggable={!x.locked}
                            onDragStart={(e) => handleDragStart(e, x)}
                            onClick={() => onItemClick(x)}
                            className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group leading-snug"
                          >
                            <td className="py-2.5 pl-3 pr-0 align-top">
                              <i
                                className={cn(
                                  "w-2.5 h-2.5 rounded-full block mt-1",
                                  st.k === 'ok' && "bg-[var(--green)]",
                                  st.k === 'and' && "bg-[var(--amber)]",
                                  st.k === 'nao' && "bg-[var(--red)]",
                                  st.k === 'pend' && "border border-[var(--text-3)] bg-transparent",
                                  st.k === 'prog' && "border border-[var(--text-3)] bg-transparent"
                                )}
                              />
                            </td>
                            <td className="py-2.5 px-2 align-top">
                              <div className={cn("font-mono text-[12.5px] font-semibold truncate", x.familia ? "text-[var(--text-2)]" : "text-[var(--amber)]")}>
                                {x.familia || 'Sem máq.'}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 align-top min-w-0">
                              <div className="text-[13.5px] font-semibold text-[var(--text)] leading-snug">
                                {x.lp && (
                                  <span className="inline-block text-[11px] font-bold text-[var(--purple)] border border-[var(--purple)] rounded px-1.5 mr-1.5 leading-tight">
                                    LP
                                  </span>
                                )}
                                {x.locked && <Lock size={12} className="inline mr-1 text-[var(--amber)]" />}
                                {x.splitParentId && <GitBranch size={12} className="inline mr-1 text-[var(--accent)]" />}
                                {x.produto}
                              </div>
                              {note && (
                                <span className={cn("text-xs font-medium block mt-0.5", note.type === 'warn' ? "text-[var(--amber)]" : "text-[var(--text-3)]")}>
                                  {note.text}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 pl-1 align-top text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, -1, e)}
                                  disabled={x.locked || x.real <= 0}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title="Diminuir 1"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className={cn(
                                  "font-mono text-[14.5px] font-bold tracking-tight",
                                  x.real > x.prog ? "text-[var(--green)]" : st.k === 'nao' ? "text-[var(--red)]" : "text-[var(--text)]"
                                )}>
                                  {x.real}<small className="text-[12px] text-[var(--text-3)] font-semibold">/{x.prog}</small>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, 1, e)}
                                  disabled={x.locked}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title={x.real >= x.prog ? "Adicionar excedente / oportunidade (+1)" : "Aumentar 1"}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  )}

                  {/* Seção PD/PA Automática */}
                  {autoPdpa.length > 0 && (
                    <React.Fragment>
                      <tr className="bg-[var(--surface-2)] text-[13px] font-bold text-[var(--text)] border-t-2 border-b border-[var(--border)]">
                        <td colSpan={4} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <span>
                              PD/PA · AUTOMÁTICA
                              <span className="font-mono font-bold text-[var(--text-3)] ml-2">
                                {autoPdpa.reduce((a, c) => a + c.real, 0)}/{autoPdpa.reduce((a, c) => a + c.prog, 0)}
                              </span>
                            </span>
                          </div>
                        </td>
                      </tr>

                      {autoPdpa.filter(filterItem).map((x) => {
                        const isDone = x.prog > 0 && x.real >= x.prog;
                        const isNao = phase.k === 'done' && x.real < x.prog;
                        return (
                          <tr
                            key={x.id}
                            id={`item-${x.id}`}
                            onClick={() => onItemClick(x)}
                            className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group leading-snug"
                          >
                            <td className="py-2.5 pl-3 pr-0 align-top">
                              <i
                                className={cn(
                                  "w-2.5 h-2.5 rounded-full block mt-1",
                                  isDone && "bg-[var(--green)]",
                                  !isDone && x.real > 0 && "bg-[var(--amber)]",
                                  isNao && "bg-[var(--red)]",
                                  !isDone && x.real === 0 && !isNao && "border border-[var(--text-3)] bg-transparent"
                                )}
                              />
                            </td>
                            <td colSpan={2} className="py-2.5 px-2 align-top min-w-0">
                              <div className="text-[13.5px] font-semibold text-[var(--text)] leading-snug">
                                {x.produto}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 pl-1 align-top text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, -1, e)}
                                  disabled={x.real <= 0}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title="Diminuir 1"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className={cn(
                                  "font-mono text-[14.5px] font-bold tracking-tight",
                                  x.real > x.prog ? "text-[var(--green)]" : isNao ? "text-[var(--red)]" : "text-[var(--text)]"
                                )}>
                                  {x.real}<small className="text-[12px] text-[var(--text-3)] font-semibold">/{x.prog}</small>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, 1, e)}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title={x.real >= x.prog ? "Adicionar excedente / oportunidade (+1)" : "Aumentar 1"}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  )}

                  {/* Seção PD/PA Direta */}
                  {diretaPdpa.length > 0 && (
                    <React.Fragment>
                      <tr className="bg-[var(--surface-2)] text-[13px] font-bold text-[var(--text)] border-t-2 border-b border-[var(--border)]">
                        <td colSpan={4} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <span>
                              PD/PA · DIRETA
                              <span className="font-mono font-bold text-[var(--text-3)] ml-2">
                                {diretaPdpa.reduce((a, c) => a + c.real, 0)}/{diretaPdpa.reduce((a, c) => a + c.prog, 0)}
                              </span>
                            </span>
                          </div>
                        </td>
                      </tr>

                      {diretaPdpa.filter(filterItem).map((x) => {
                        const isDone = x.prog > 0 && x.real >= x.prog;
                        const isNao = phase.k === 'done' && x.real < x.prog;
                        return (
                          <tr
                            key={x.id}
                            id={`item-${x.id}`}
                            onClick={() => onItemClick(x)}
                            className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors cursor-pointer group leading-snug"
                          >
                            <td className="py-2.5 pl-3 pr-0 align-top">
                              <i
                                className={cn(
                                  "w-2.5 h-2.5 rounded-full block mt-1",
                                  isDone && "bg-[var(--green)]",
                                  !isDone && x.real > 0 && "bg-[var(--amber)]",
                                  isNao && "bg-[var(--red)]",
                                  !isDone && x.real === 0 && !isNao && "border border-[var(--text-3)] bg-transparent"
                                )}
                              />
                            </td>
                            <td colSpan={2} className="py-2.5 px-2 align-top min-w-0">
                              <div className="text-[13.5px] font-semibold text-[var(--text)] leading-snug">
                                {x.produto}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 pl-1 align-top text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, -1, e)}
                                  disabled={x.real <= 0}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title="Diminuir 1"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className={cn(
                                  "font-mono text-[14.5px] font-bold tracking-tight",
                                  x.real > x.prog ? "text-[var(--green)]" : isNao ? "text-[var(--red)]" : "text-[var(--text)]"
                                )}>
                                  {x.real}<small className="text-[12px] text-[var(--text-3)] font-semibold">/{x.prog}</small>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => onUpdateQty(x, 1, e)}
                                  className="w-4 h-4 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                  title={x.real >= x.prog ? "Adicionar excedente / oportunidade (+1)" : "Aumentar 1"}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  )}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
