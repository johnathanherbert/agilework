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

  // Contagem de ocorrências do mês para o sumário
  const monthStats = useMemo(() => {
    let ferias = 0, faltas = 0, atestados = 0, folgasFlexiveis = 0;
    monthDays.forEach((d) => {
      const occs = occsByDate.get(d.data) || [];
      occs.forEach((o) => {
        if (o.tipo === 'ferias') ferias++;
        else if (o.tipo === 'falta_injustificada' || o.tipo === 'falta_justificada') faltas++;
        else if (o.tipo === 'atestado') atestados++;
        else if (o.tipo === 'folga_flexivel') folgasFlexiveis++;
      });
    });
    return { ferias, faltas, atestados, folgasFlexiveis };
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

        {/* Legenda de Turmas */}
        <div className="flex items-center gap-2 flex-wrap">
          {turmas.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-md text-white font-black text-[11px] flex items-center justify-center shadow-xs"
                style={{ backgroundColor: TURMAS_INFO[t].cor }}
              >
                {t}
              </div>
              <span className="text-[11px] font-bold text-muted-foreground hidden sm:inline">
                Turma {t} — folga
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] text-muted-foreground font-bold">Feriado</span>
          </div>
        </div>
      </div>

      {/* Grid do Calendário + Painel Lateral */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendário */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Cabeçalho com dias da semana */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className={cn(
                  "py-2 text-center text-[11px] font-bold uppercase tracking-wider",
                  day === 'Dom' || day === 'Sáb'
                    ? "text-slate-400 dark:text-slate-600"
                    : "text-muted-foreground"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grade de Dias */}
          <div className="grid grid-cols-7">
            {/* Espaços em branco antes do primeiro dia */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div
                key={`blank-${i}`}
                className="min-h-[72px] border-b border-r border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/20"
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

              return (
                <button
                  key={d.data}
                  type="button"
                  onClick={() => handleDayClick(d)}
                  className={cn(
                    "min-h-[72px] p-2 text-left flex flex-col gap-1 transition-colors relative",
                    !isLastInRow && "border-r border-slate-100 dark:border-slate-800/60",
                    !isLastRow && "border-b border-slate-100 dark:border-slate-800/60",
                    isSelected
                      ? "bg-primary/5 ring-1 ring-inset ring-primary/40"
                      : isSunOrSat
                      ? "bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/30"
                      : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
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
                      <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                    )}
                  </div>

                  {/* Badge de Turma de Folga */}
                  <div
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-white text-[9px] font-black w-fit shadow-xs"
                    style={{ backgroundColor: turmaInfo.cor }}
                  >
                    {d.turma_escalada}
                  </div>

                  {/* Dots de Ocorrências */}
                  {(hasFolga || hasFerias || hasFalta || hasAtestado) && (
                    <div className="flex gap-0.5 flex-wrap mt-auto">
                      {hasFalta && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Falta" />}
                      {hasAtestado && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Atestado" />}
                      {hasFolga && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Folga Flexível" />}
                      {hasFerias && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Férias" />}
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
            <p className="text-xs font-black text-foreground mb-3 uppercase tracking-wide">Sumário do Mês</p>
            <div className="space-y-2">
              {[
                { label: 'Folgas Flexíveis', value: monthStats.folgasFlexiveis, color: 'text-sky-600', dot: 'bg-sky-400' },
                { label: 'Férias', value: monthStats.ferias, color: 'text-indigo-600', dot: 'bg-indigo-500' },
                { label: 'Faltas', value: monthStats.faltas, color: 'text-red-600', dot: 'bg-red-500' },
                { label: 'Atestados', value: monthStats.atestados, color: 'text-rose-600', dot: 'bg-rose-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
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
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-black text-foreground">
                    {selectedDay.escala.dia_semana_curto}, {String(selectedDay.escala.dia).padStart(2, '0')}/{String(selectedDay.escala.mes).padStart(2, '0')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div
                      className="w-4 h-4 rounded text-white text-[9px] font-black flex items-center justify-center"
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
                    className="text-[11px] text-primary font-bold hover:underline"
                  >
                    + Ocorrência
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
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Ocorrências</p>
                  {selectedDay.occsDodia.map((occ) => (
                    <div
                      key={occ.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                    >
                      <OccurrenceIcon tipo={occ.tipo} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{occ.operadorNome}</p>
                        <p className="text-[10px] text-muted-foreground">{OCC_LABELS[occ.tipo]}</p>
                      </div>
                    </div>
                  ))}
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
  hora_extra: 'Hora Extra',
};

function OccurrenceIcon({ tipo }: { tipo: string }) {
  if (tipo === 'ferias') return <Palmtree className="w-4 h-4 text-indigo-500 shrink-0" />;
  if (tipo === 'folga_flexivel') return <CalendarDays className="w-4 h-4 text-sky-500 shrink-0" />;
  if (tipo === 'atestado') return <Stethoscope className="w-4 h-4 text-rose-500 shrink-0" />;
  if (tipo === 'falta_injustificada' || tipo === 'falta_justificada') return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
}
