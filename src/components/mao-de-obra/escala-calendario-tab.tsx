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
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border-strong)] rounded-md overflow-hidden">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-8 w-8 flex items-center justify-center hover:bg-[var(--hover)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-4 text-xs font-semibold text-[var(--text)] min-w-[130px] text-center font-mono">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="h-8 w-8 flex items-center justify-center hover:bg-[var(--hover)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCurrentMonth(today.getMonth() + 1)}
            className="h-8 px-3 text-xs font-medium bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)] rounded-md hover:bg-[var(--hover)] transition-colors"
          >
            Mês Atual
          </button>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-3)]">
          <span className="flex items-center gap-1.5">
            <i className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
            Falta
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
            Atestado
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />
            Folga flex.
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-1.5 h-1.5 rounded-full bg-[var(--violet)]" />
            Férias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-grid place-items-center w-4 h-4 rounded-[3px] border border-[var(--border-strong)] font-mono text-[10px] text-[var(--text-2)] bg-[var(--surface-2)]">
              D
            </span>
            Turma de folga
          </span>
        </div>
      </div>

      {/* Grid do Calendário + Painel Lateral */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendário */}
        <div className="flex-1 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
          {/* Cabeçalho com dias da semana */}
          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
            {WEEK_DAYS.map((day) => {
              return (
                <div
                  key={day}
                  className="py-2.5 text-center text-xs font-medium text-[var(--text-3)]"
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
                className="min-h-[96px] border-b border-r border-[var(--border)] bg-[var(--bg)]"
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
                    "min-h-[96px] p-2 text-left flex flex-col gap-1 transition-colors relative cursor-pointer",
                    !isLastInRow && "border-r border-[var(--border)]",
                    !isLastRow && "border-b border-[var(--border)]",
                    isSelected
                      ? "bg-[var(--accent-weak)] shadow-[inset_0_0_0_1px_var(--accent)]"
                      : "hover:bg-[var(--hover)]"
                  )}
                >
                  {/* Topo da célula: dia e turma de folga */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={cn(
                        "font-mono text-xs font-medium w-[22px] h-[22px] flex items-center justify-center rounded-full",
                        isToday
                          ? "bg-[var(--text)] text-[var(--bg)]"
                          : isSunOrSat
                          ? "text-[var(--text-3)]"
                          : "text-[var(--text)]"
                      )}
                    >
                      {d.dia}
                    </span>

                    {/* Folga turma */}
                    <span className="text-[10.5px] text-[var(--text-3)] flex items-center gap-1">
                      folga
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded font-mono text-[10px] font-bold"
                        style={{
                          backgroundColor: turmaInfo?.cor ? `${turmaInfo.cor}22` : 'var(--accent-weak)',
                          color: turmaInfo?.cor || 'var(--accent)',
                          border: `1px solid ${turmaInfo?.cor ? `${turmaInfo.cor}55` : 'var(--border-strong)'}`
                        }}
                      >
                        {d.turma_escalada}
                      </span>
                    </span>
                  </div>

                  {/* Feriado */}
                  {isFeriado && (
                    <div className="text-[10.5px] text-[var(--amber)] truncate w-full" title={d.feriado_nome || 'Feriado'}>
                      {d.feriado_nome}
                    </div>
                  )}

                  {/* Ocorrências com dot */}
                  {occs.length > 0 && (
                    <div className="flex flex-col gap-0.5 w-full overflow-hidden mt-0.5">
                      {occs.slice(0, 3).map((occ, oIdx) => {
                        const shortName = formatOperatorShortName(occ.operadorNome);
                        const dotColor = getDotColor(occ.tipo);

                        return (
                          <div
                            key={`${occ.id}-${oIdx}`}
                            className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-2)] truncate"
                            title={`${occ.operadorNome} (${getSimpleTypeLabel(occ.tipo)})`}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                            <span className="truncate">{shortName}</span>
                          </div>
                        );
                      })}
                      {occs.length > 3 && (
                        <span className="text-[11px] text-[var(--text-3)]">
                          +{occs.length - 3} mais
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel lateral: Detalhe do Dia + Resumo do Mês */}
        <div className="w-full lg:w-[300px] space-y-4">
          {/* Card Detalhe do Dia Selecionado */}
          <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
            {selectedDay ? (
              <div>
                <div className="flex items-center justify-between p-3.5 border-b border-[var(--border)]">
                  <h2 className="text-xs font-semibold text-[var(--text)]">
                    {selectedDay.escala.dia_semana_curto}, {String(selectedDay.escala.dia).padStart(2, '0')}/{String(selectedDay.escala.mes).padStart(2, '0')}
                  </h2>
                  <span className="text-xs text-[var(--text-3)]">
                    folga turma {selectedDay.escala.turma_escalada}
                  </span>
                </div>

                {selectedDay.escala.e_feriado && (
                  <div className="px-4 py-2 border-b border-[var(--border)] flex justify-between items-center text-xs">
                    <b className="text-[var(--amber)]">{selectedDay.escala.feriado_nome}</b>
                    <span className="text-[var(--text-3)]">Feriado</span>
                  </div>
                )}

                {selectedDay.occsDodia.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--text-3)]">
                    Nenhuma ocorrência neste dia.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)] max-h-56 overflow-y-auto">
                    {selectedDay.occsDodia.map((occ) => {
                      const op = operators.find((o) => o.id === occ.operadorId);
                      const turma = op?.letra as OperatorTurma | undefined;
                      const dotColor = getDotColor(occ.tipo);

                      return (
                        <div key={occ.id} className="p-3 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <b className="text-xs font-medium text-[var(--text)]">{occ.operadorNome}</b>
                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)]">
                              <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
                              {getSimpleTypeLabel(occ.tipo)}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--text-3)] font-mono">
                            T{occ.turno} · Turma {turma || occ.operadorLetra}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[var(--text-3)]">
                Clique em um dia no calendário para ver os detalhes.
              </div>
            )}
          </div>

          {/* Card Resumo do Mês */}
          <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between p-3.5 border-b border-[var(--border)]">
              <h2 className="text-xs font-semibold text-[var(--text)]">
                Resumo de {MONTH_NAMES[currentMonth - 1].toLowerCase()}
              </h2>
              <span className="text-xs text-[var(--text-3)]">operadores</span>
            </div>

            <div className="divide-y divide-[var(--border)]">
              <div className="flex items-center justify-between p-3">
                <span className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />
                  Folga flexível
                </span>
                <strong className="font-mono text-xs text-[var(--text)]">{monthStats.folgasFlexiveis}</strong>
              </div>

              <div className="flex items-center justify-between p-3">
                <span className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--violet)]" />
                  Férias
                </span>
                <strong className="font-mono text-xs text-[var(--text)]">{monthStats.ferias}</strong>
              </div>

              <div className="flex items-center justify-between p-3">
                <span className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
                  Falta injustificada
                </span>
                <strong className="font-mono text-xs text-[var(--text)]">{monthStats.faltas}</strong>
              </div>

              <div className="flex items-center justify-between p-3">
                <span className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                  Atestado
                </span>
                <strong className="font-mono text-xs text-[var(--text)]">{monthStats.atestados}</strong>
              </div>

              {/* Feriados no Mês */}
              {monthDays.filter((d) => d.e_feriado).length > 0 && (
                <>
                  <div className="p-2.5 bg-[var(--surface-2)]">
                    <span className="text-[11px] text-[var(--text-3)]">Feriados</span>
                  </div>
                  {monthDays.filter((d) => d.e_feriado).map((d) => (
                    <div key={d.data} className="flex items-center justify-between p-3">
                      <span className="text-xs text-[var(--text-2)]">{d.feriado_nome}</span>
                      <strong className="font-mono text-xs text-[var(--text-3)]">{String(d.dia).padStart(2, '0')}/{String(currentMonth).padStart(2, '0')}</strong>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
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
