"use client";

import { useMemo, useState } from 'react';
import {
  Operator,
  LaborOccurrence,
  ProductionTurno,
  OperatorTurma,
  LaborOccurrenceType,
  EscalaDay,
} from '@/types';
import { getEscalaForMonth, getFeriadosYear, TURMAS_INFO } from '@/lib/escala-helpers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EscalaDiaModal } from './escala-dia-modal';
import {
  ChevronLeft,
  ChevronRight,
  Palmtree,
  AlertTriangle,
  Stethoscope,
  CalendarDays,
  Flame,
  Info,
  Clock,
  Plus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface EscalaCalendarioProps {
  operators: Operator[];
  occurrences: LaborOccurrence[];
  selectedTurno: ProductionTurno | 'ALL';
  onSelectDate?: (dateStr: string) => void;
  onOpenOcorrencia?: (op?: Operator, type?: LaborOccurrenceType, date?: string) => void;
}

interface DayDetail {
  escala: EscalaDay;
  occsDodia: LaborOccurrence[];
}

// Helpers para exibição visual simples de ocorrências no calendário
function formatOperatorShortName(name: string): string {
  if (!name) return 'Op';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const second = parts[1];
  if (['da', 'de', 'do', 'dos', 'das'].includes(second.toLowerCase()) && parts[2]) {
    return `${first} ${parts[2][0]?.toUpperCase() || ''}.`;
  }
  return `${first} ${second[0]?.toUpperCase() || ''}.`;
}

function getSimpleTypeLabel(tipo: LaborOccurrenceType): string {
  switch (tipo) {
    case 'falta_injustificada': return 'Falta';
    case 'falta_justificada': return 'Falta J.';
    case 'atestado': return 'Atestado';
    case 'folga_flexivel': return 'Folga';
    case 'ferias': return 'Férias';
    case 'hora_extra': return 'H. Extra';
    default: return 'Ausente';
  }
}

function getDotColor(tipo: LaborOccurrenceType): string {
  switch (tipo) {
    case 'falta_injustificada': return 'bg-red-500';
    case 'falta_justificada': return 'bg-amber-500';
    case 'atestado': return 'bg-rose-400';
    case 'folga_flexivel': return 'bg-sky-400';
    case 'ferias': return 'bg-indigo-500';
    case 'hora_extra': return 'bg-emerald-500';
    default: return 'bg-slate-400';
  }
}

export function EscalaCalendarioTab({
  operators,
  occurrences,
  selectedTurno,
  onSelectDate,
  onOpenOcorrencia,
}: EscalaCalendarioProps) {
  const today = new Date();
  const [currentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Starts on today's month if 2026, otherwise January
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    return (y === 2026 && m >= 1 && m <= 12) ? m : 1;
  });

  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null);

  const feriados = useMemo(() => getFeriadosYear(), []);
  const feriadoMap = useMemo(() => {
    const map = new Map<string, string>();
    feriados.forEach((f) => map.set(f.data, f.nome));
    return map;
  }, [feriados]);

  // Turmas de A-D para a legenda
  const turmas: OperatorTurma[] = ['A', 'B', 'C', 'D'];

  // Dias da escala do mês
  const monthDays: EscalaDay[] = useMemo(
    () => getEscalaForMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Mapa de ocorrências por data filtradas pelo turno selecionado
  const occsByDate = useMemo(() => {
    const map = new Map<string, LaborOccurrence[]>();
    const relevantOps = new Set(
      operators
        .filter((op) => selectedTurno === 'ALL' || op.turno === selectedTurno)
        .map((op) => op.id)
    );

    occurrences.forEach((occ) => {
      if (!relevantOps.has(occ.operadorId)) return;
      const start = new Date(occ.dataInicio + 'T12:00:00Z');
      const end = new Date((occ.dataFim || occ.dataInicio) + 'T12:00:00Z');
      const cur = new Date(start);
      while (cur <= end) {
        const ds = cur.toISOString().split('T')[0];
        if (!map.has(ds)) map.set(ds, []);
        map.get(ds)!.push(occ);
        cur.setDate(cur.getDate() + 1);
      }
    });

    return map;
  }, [occurrences, operators, selectedTurno]);

  // Primeiro dia da semana do mês (0=Dom)
  const firstDayOfWeek = useMemo(() => {
    if (monthDays.length === 0) return 0;
    return new Date(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01T12:00:00Z`).getDay();
  }, [currentYear, currentMonth, monthDays]);

  // Total de células (blanks + dias)
  const totalCells = firstDayOfWeek + monthDays.length;
  const rows = Math.ceil(totalCells / 7);

  const handlePrevMonth = () => setCurrentMonth((m) => (m === 1 ? 12 : m - 1));
  const handleNextMonth = () => setCurrentMonth((m) => (m === 12 ? 1 : m + 1));

  const [modalDateStr, setModalDateStr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleDayClick = (d: EscalaDay) => {
    const occsDodia = occsByDate.get(d.data) || [];
    setSelectedDay({ escala: d, occsDodia });
    setModalDateStr(d.data);
    setModalOpen(true);
    if (onSelectDate) onSelectDate(d.data);
  };

  const todayStr = today.toISOString().split('T')[0];

  // Sumário: conta operadores únicos afetados no mês (não dias)
  const monthStats = useMemo(() => {
    const feriasOps = new Set<string>();
    const faltasOps = new Set<string>();
    const atestadosOps = new Set<string>();
    const folgasOps = new Set<string>();

    monthDays.forEach((d) => {
      const occs = occsByDate.get(d.data) || [];
      occs.forEach((o) => {
        if (o.tipo === 'ferias') feriasOps.add(o.operadorId);
        else if (o.tipo === 'falta_injustificada' || o.tipo === 'falta_justificada') faltasOps.add(o.operadorId);
        else if (o.tipo === 'atestado') atestadosOps.add(o.operadorId);
        else if (o.tipo === 'folga_flexivel') folgasOps.add(o.operadorId);
      });
    });

    return {
      ferias: feriasOps.size,
      faltas: faltasOps.size,
      atestados: atestadosOps.size,
      folgasFlexiveis: folgasOps.size,
    };
  }, [monthDays, occsByDate]);

  return (
    <div className="space-y-4">
      {/* Header do Calendário */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Navegação de Mês */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-9 w-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="px-4 text-sm font-black text-foreground min-w-[140px] text-center">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="h-9 w-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCurrentMonth(today.getMonth() + 1)}
            className="h-9 px-3 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            Mês Atual
          </button>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Turmas — apenas badges coloridos */}
          {turmas.map((t) => (
            <div key={t} className="flex items-center gap-1">
              <div
                className="w-5 h-5 rounded-md text-white font-black text-[11px] flex items-center justify-center shadow-xs"
                style={{ backgroundColor: TURMAS_INFO[t].cor }}
              >
                {t}
              </div>
            </div>
          ))}

          <div className="w-px h-4 bg-border mx-1" />

          {/* Tipos de ocorrência */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground font-medium">Falta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            <span className="text-[11px] text-muted-foreground font-medium">Atestado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
            <span className="text-[11px] text-muted-foreground font-medium">Folga</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground font-medium">Férias</span>
          </div>

          <div className="w-px h-4 bg-border mx-1" />

          <div className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] text-muted-foreground font-medium">Feriado</span>
          </div>
        </div>
      </div>

      {/* Grid do Calendário + Painel Lateral */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendário */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Cabeçalho com dias da semana */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {WEEK_DAYS.map((day) => {
              const isWeekend = day === 'Dom' || day === 'Sáb';
              return (
                <div
                  key={day}
                  className={cn(
                    "py-3 text-center text-[11px] font-bold uppercase tracking-wider",
                    isWeekend
                      ? "bg-slate-50/80 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600"
                      : "text-muted-foreground"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Grade de Dias */}
          <div className="grid grid-cols-7">
            {/* Espaços em branco antes do primeiro dia */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div
                key={`blank-${i}`}
                className="min-h-[88px] border-b border-r border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/20"
              />
            ))}

            {/* Dias do mês */}
            {monthDays.map((d, idx) => {
              const isSunOrSat = d.e_fim_de_semana;
              const isFeriado = d.e_feriado;
              const isToday = d.data === todayStr;
              const occs = occsByDate.get(d.data) || [];
              const turmaInfo = TURMAS_INFO[d.turma_escalada];
              const isSelected = selectedDay?.escala.data === d.data;

              // Agrupa ocorrências do dia por tipo para os dots
              const hasFolga = occs.some((o) => o.tipo === 'folga_flexivel');
              const hasFerias = occs.some((o) => o.tipo === 'ferias');
              const hasFalta = occs.some((o) => o.tipo === 'falta_injustificada' || o.tipo === 'falta_justificada');
              const hasAtestado = occs.some((o) => o.tipo === 'atestado');

              // Coluna do dia (0-6, 0=Dom)
              const col = (firstDayOfWeek + idx) % 7;
              const isLastInRow = col === 6;
              const isLastRow = Math.floor((firstDayOfWeek + idx) / 7) === rows - 1;

              // Ring de prioridade de ocorrência
              const ringClass = hasFalta
                ? 'ring-1 ring-inset ring-red-400/40'
                : hasAtestado
                ? 'ring-1 ring-inset ring-rose-400/40'
                : hasFolga
                ? 'ring-1 ring-inset ring-sky-400/40'
                : hasFerias
                ? 'ring-1 ring-inset ring-indigo-400/40'
                : '';

                return (
                  <button
                    key={d.data}
                    type="button"
                    onClick={() => handleDayClick(d)}
                    className={cn(
                      "min-h-[88px] p-2 text-left flex flex-col gap-1 transition-colors relative",
                      !isLastInRow && "border-r border-slate-100 dark:border-slate-800/60",
                      !isLastRow && "border-b border-slate-100 dark:border-slate-800/60",
                      isFeriado && "bg-amber-50/40 dark:bg-amber-950/10",
                      isSelected
                        ? "bg-primary/5 ring-1 ring-inset ring-primary/40"
                        : isSunOrSat
                        ? "bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/30"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30",
                      !isSelected && ringClass
                    )}
                  >
                    {/* Número do dia e indicador de hoje */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-sm font-black w-7 h-7 flex items-center justify-center rounded-full",
                          isToday
                            ? "bg-primary text-white shadow-sm"
                            : isSunOrSat
                            ? "text-slate-400 dark:text-slate-600"
                            : "text-foreground"
                        )}
                      >
                        {d.dia}
                      </span>

                      {/* Indicador de feriado */}
                      {isFeriado && (
                        <span title={d.feriado_nome || 'Feriado'}>
                          <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>

                    {/* Badge de Turma de Folga — pill arredondado */}
                    <div
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[9px] font-black w-fit shadow-xs tracking-wide"
                      style={{ backgroundColor: turmaInfo.cor }}
                    >
                      {d.turma_escalada}
                    </div>

                    {/* Nome dos operadores e ocorrência no canto inferior direito */}
                    {occs.length > 0 && (
                      <div className="mt-auto self-end flex flex-col items-end gap-0.5 text-right w-full overflow-hidden">
                        {occs.slice(0, 2).map((occ, oIdx) => {
                          const shortName = formatOperatorShortName(occ.operadorNome);
                          const typeLabel = getSimpleTypeLabel(occ.tipo);
                          const dotColor = getDotColor(occ.tipo);

                          return (
                            <div
                              key={`${occ.id}-${oIdx}`}
                              className="text-[9.5px] leading-tight font-medium text-slate-700 dark:text-slate-300 truncate max-w-full flex items-center justify-end gap-1"
                              title={`${occ.operadorNome} (${typeLabel}) - ${occ.operadorCargo} · Turma ${occ.operadorLetra}`}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                              <span className="truncate">{shortName}</span>
                              <span className="text-[8.5px] text-muted-foreground font-normal shrink-0">({typeLabel})</span>
                            </div>
                          );
                        })}
                        {occs.length > 2 && (
                          <span className="text-[8.5px] font-bold text-muted-foreground">
                            +{occs.length - 2} mais
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
            })}
          </div>
        </div>

        {/* Painel lateral do dia selecionado + Sumário do Mês */}
        <div className="w-full lg:w-72 space-y-3">
          {/* Sumário do Mês */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4">
            <p className="text-xs font-black text-foreground mb-3 uppercase tracking-wide">
              Sumário — {MONTH_NAMES[currentMonth - 1]}
            </p>

            {/* Grid 2x2 de mini-cards */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: 'Folgas',
                  value: monthStats.folgasFlexiveis,
                  bg: 'bg-sky-50 dark:bg-sky-950/30',
                  border: 'border-sky-100 dark:border-sky-900/40',
                  valueColor: 'text-sky-600 dark:text-sky-400',
                  dot: 'bg-sky-400',
                },
                {
                  label: 'Férias no Mês',
                  value: monthStats.ferias,
                  bg: 'bg-indigo-50 dark:bg-indigo-950/30',
                  border: 'border-indigo-100 dark:border-indigo-900/40',
                  valueColor: 'text-indigo-600 dark:text-indigo-400',
                  dot: 'bg-indigo-500',
                },
                {
                  label: 'Faltas',
                  value: monthStats.faltas,
                  bg: 'bg-red-50 dark:bg-red-950/30',
                  border: 'border-red-100 dark:border-red-900/40',
                  valueColor: 'text-red-600 dark:text-red-400',
                  dot: 'bg-red-500',
                },
                {
                  label: 'Atestados',
                  value: monthStats.atestados,
                  bg: 'bg-rose-50 dark:bg-rose-950/30',
                  border: 'border-rose-100 dark:border-rose-900/40',
                  valueColor: 'text-rose-600 dark:text-rose-400',
                  dot: 'bg-rose-400',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex flex-col gap-1 p-2.5 rounded-xl border",
                    item.bg,
                    item.border
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", item.dot)} />
                    <span className="text-[10px] text-muted-foreground font-semibold leading-tight">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={cn("text-xl font-black leading-none", item.valueColor)}>{item.value}</span>
                    <span className="text-[9px] text-muted-foreground font-semibold">op.</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Feriados do mês */}
            {monthDays.filter((d) => d.e_feriado).length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Feriados</p>
                {monthDays.filter((d) => d.e_feriado).map((d) => (
                  <div key={d.data} className="flex items-center gap-1.5 mb-1">
                    <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-foreground">{d.feriado_nome}</p>
                      <p className="text-[10px] text-muted-foreground">Dia {d.dia}/{currentMonth}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detalhes do Dia Selecionado */}
          {selectedDay ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-black text-foreground">
                    {selectedDay.escala.dia_semana_curto},{' '}
                    {String(selectedDay.escala.dia).padStart(2, '0')}/{String(selectedDay.escala.mes).padStart(2, '0')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div
                      className="w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center"
                      style={{ backgroundColor: TURMAS_INFO[selectedDay.escala.turma_escalada].cor }}
                    >
                      {selectedDay.escala.turma_escalada}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Turma {selectedDay.escala.turma_escalada} de folga
                    </span>
                  </div>
                </div>

                {onOpenOcorrencia && (
                  <button
                    type="button"
                    onClick={() => onOpenOcorrencia(undefined, undefined, selectedDay.escala.data)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    Ocorrência
                  </button>
                )}
              </div>

              {selectedDay.escala.e_feriado && (
                <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                  <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 font-bold">{selectedDay.escala.feriado_nome}</p>
                </div>
              )}

              {selectedDay.occsDodia.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sem ocorrências neste dia
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Ocorrências</p>
                  {selectedDay.occsDodia.map((occ) => {
                    const op = operators.find((o) => o.id === occ.operadorId);
                    const turma = op?.letra as OperatorTurma | undefined;
                    const avatarColor = turma ? TURMAS_INFO[turma]?.cor : '#94a3b8';
                    const avatarLetter = op?.nome?.charAt(0)?.toUpperCase() ?? '?';

                    return (
                      <div
                        key={occ.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-default"
                      >
                        {/* Avatar colorido do operador */}
                        <div
                          className="w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {avatarLetter}
                        </div>
                        <OccurrenceIcon tipo={occ.tipo} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{occ.operadorNome}</p>
                          <p className="text-[10px] text-muted-foreground">{OCC_LABELS[occ.tipo]}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Clique em um dia para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhamento do Dia */}
      <EscalaDiaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        dateStr={modalDateStr}
        operators={operators}
        occurrences={occurrences}
        selectedTurno={selectedTurno}
        onOpenOcorrencia={onOpenOcorrencia}
        onNavigateToQuadro={(ds) => {
          setModalOpen(false);
          if (onSelectDate) onSelectDate(ds);
        }}
      />
    </div>
  );
}

// Ícone de ocorrência por tipo
const OCC_LABELS: Record<string, string> = {
  falta_injustificada: 'Falta Injustificada',
  falta_justificada: 'Falta Justificada',
  atestado: 'Atestado Médico',
  folga_flexivel: 'Folga Flexível',
  ferias: 'Férias',
  atraso: 'Atraso',
  hora_extra: 'Hora Extra',
};

function OccurrenceIcon({ tipo }: { tipo: string }) {
  if (tipo === 'ferias') return <Palmtree className="w-4 h-4 text-indigo-500 shrink-0" />;
  if (tipo === 'folga_flexivel') return <CalendarDays className="w-4 h-4 text-sky-500 shrink-0" />;
  if (tipo === 'atestado') return <Stethoscope className="w-4 h-4 text-rose-500 shrink-0" />;
  if (tipo === 'atraso') return <Clock className="w-4 h-4 text-orange-500 shrink-0" />;
  if (tipo === 'falta_injustificada' || tipo === 'falta_justificada') return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
}
