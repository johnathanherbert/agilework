"use client";

import { useMemo, useState } from 'react';
import {
  Operator,
  LaborOccurrence,
  ProductionTurno,
  OperatorTurma,
  LaborOccurrenceType,
} from '@/types';
import { getEscalaForDate, TURMAS_INFO } from '@/lib/escala-helpers';
import { getDailyPresenceSummary, DailyOperatorStatus } from '@/lib/labor-helpers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  CalendarDays,
  Palmtree,
  Plus,
  Search,
  Flame,
  Clock,
  Zap,
  Moon,
  Sun,
  Sunset,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Turnos e horários
const TURNO_INFO: Record<number, { label: string; horario: string; icon: React.ReactNode; color: string }> = {
  1: { label: 'Turno 1', horario: '07:20 – 15:50', icon: <Sun className="w-4 h-4" />, color: 'text-amber-600 dark:text-amber-400' },
  2: { label: 'Turno 2', horario: '15:50 – 23:45', icon: <Sunset className="w-4 h-4" />, color: 'text-orange-600 dark:text-orange-400' },
  3: { label: 'Turno 3', horario: '23:45 – 07:20', icon: <Moon className="w-4 h-4" />, color: 'text-blue-600 dark:text-blue-400' },
};

interface QuadroDiarioProps {
  operators: Operator[];
  occurrences: LaborOccurrence[];
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  selectedTurno: ProductionTurno | 'ALL';
  onOpenNewOperator: () => void;
  onOpenOcorrencia: (operator?: Operator, type?: LaborOccurrenceType) => void;
  onOpenSaldoFolgas: (operator: Operator) => void;
  onEditOperator: (operator: Operator) => void;
}

export function QuadroDiario({
  operators,
  occurrences,
  selectedDate,
  onDateChange,
  selectedTurno,
  onOpenNewOperator,
  onOpenOcorrencia,
  onOpenSaldoFolgas,
  onEditOperator,
}: QuadroDiarioProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Dados da escala do dia selecionado
  const escalaDia = useMemo(() => getEscalaForDate(selectedDate), [selectedDate]);
  const turmaDoDia = escalaDia ? escalaDia.turma_escalada : 'A';
  const turmaFolgaInfo = TURMAS_INFO[turmaDoDia];

  // Filtrar operadores pelo turno selecionado
  const operadoresPorTurno = useMemo(() => {
    const turnosParaExibir = selectedTurno === 'ALL' ? [1, 2, 3] : [selectedTurno];
    const result: Record<number, DailyOperatorStatus[]> = {};

    turnosParaExibir.forEach((t) => {
      const ops = operators.filter((op) => op.turno === t);
      const summary = getDailyPresenceSummary(selectedDate, ops, occurrences);

      const query = searchQuery.trim().toLowerCase();
      result[t] = query
        ? summary.operadoresStatus.filter((item) => {
            const op = item.operator;
            return op.nome.toLowerCase().includes(query) ||
              op.matricula.toLowerCase().includes(query) ||
              op.cargo.toLowerCase().includes(query);
          })
        : summary.operadoresStatus;
    });

    return result;
  }, [operators, occurrences, selectedDate, selectedTurno, searchQuery]);

  // Totais do dia calculados diretamente do resumo completo (sem sofrer interferência do campo de busca)
  const totaisDia = useMemo(() => {
    const turnosFiltrados = selectedTurno === 'ALL' ? [1, 2, 3] : [selectedTurno];
    const ops = operators.filter((op) => selectedTurno === 'ALL' || op.turno === selectedTurno);
    const summary = getDailyPresenceSummary(selectedDate, ops, occurrences);

    return {
      total: summary.total,
      presentes: summary.presentes,
      ausentes: summary.ausentes,
      folgaEscala: summary.folgasEscala,
      faltas: summary.faltas,
      atestados: summary.atestados,
      folgasFlexiveis: summary.folgasFlexiveis,
      ferias: summary.ferias,
    };
  }, [operators, occurrences, selectedDate, selectedTurno]);

  // Navegação de dias
  const handleShiftDay = (days: number) => {
    const dt = new Date(selectedDate + 'T12:00:00Z');
    dt.setDate(dt.getDate() + days);
    onDateChange(dt.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    onDateChange(new Date().toISOString().split('T')[0]);
  };

  const turnosParaExibir = selectedTurno === 'ALL' ? [1, 2, 3] : [selectedTurno];

  return (
    <div className="space-y-4">
      {/* Barra de data e info do dia */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Navegação de Data */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => handleShiftDay(-1)}
              className="h-9 w-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="h-9 px-3 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-x border-slate-200 dark:border-slate-800"
            >
              Hoje
            </button>
            <div className="relative flex items-center">
              <CalendarIcon className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="h-9 pl-8 pr-2.5 text-xs font-bold bg-transparent border-none outline-none w-36 cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => handleShiftDay(1)}
              className="h-9 w-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {escalaDia && (
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 hidden sm:inline">
              {escalaDia.dia_semana_curto}, {String(escalaDia.dia).padStart(2, '0')}/{String(escalaDia.mes).padStart(2, '0')}
            </span>
          )}

          {escalaDia?.e_feriado && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold">{escalaDia.feriado_nome}</span>
            </div>
          )}
        </div>

        {/* Turma de folga e busca */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Folga da escala do dia */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-xs"
            style={{ borderColor: `${turmaFolgaInfo?.cor}50`, backgroundColor: `${turmaFolgaInfo?.cor}12` }}
          >
            <div
              className="w-5 h-5 rounded-md text-white font-black text-[11px] flex items-center justify-center shadow-xs"
              style={{ backgroundColor: turmaFolgaInfo?.cor }}
            >
              {turmaDoDia}
            </div>
            <span className="text-xs font-bold" style={{ color: turmaFolgaInfo?.cor }}>
              Turma {turmaDoDia} de Folga · Dia {escalaDia?.dia_ciclo_28}/28
            </span>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar operador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs bg-white dark:bg-slate-900 rounded-lg w-[180px]"
            />
          </div>

          <Button
            size="sm"
            onClick={() => onOpenOcorrencia()}
            className="h-9 text-xs gap-1.5 font-bold rounded-lg bg-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Lançar Ocorrência
          </Button>
        </div>
      </div>

      {/* Cards de Totais Separando Faltas, Folgas Flexíveis e Férias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Efetivo Total</p>
          <p className="text-2xl font-black text-foreground mt-1">{totaisDia.total}</p>
          <p className="text-[11px] text-muted-foreground">quadro cadastrado</p>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Presentes</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{totaisDia.presentes}</p>
          <p className="text-[11px] text-emerald-600/80">escalados p/ trabalhar</p>
        </div>

        <div className={cn(
          "rounded-2xl p-4 shadow-xs border",
          (totaisDia.faltas + totaisDia.atestados) > 0
            ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <p className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400 tracking-wider">Faltas & Atestados</p>
          <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">{totaisDia.faltas + totaisDia.atestados}</p>
          <p className="text-[11px] text-muted-foreground">{totaisDia.faltas} faltas · {totaisDia.atestados} atestados</p>
        </div>

        <div className={cn(
          "rounded-2xl p-4 shadow-xs border",
          totaisDia.folgasFlexiveis > 0
            ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <p className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-400 tracking-wider">Folga Flexível</p>
          <p className="text-2xl font-black text-sky-700 dark:text-sky-300 mt-1">{totaisDia.folgasFlexiveis}</p>
          <p className="text-[11px] text-sky-600/80">folgas alinhadas</p>
        </div>

        <div className={cn(
          "rounded-2xl p-4 shadow-xs border",
          totaisDia.ferias > 0
            ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <p className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider">Em Férias</p>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">{totaisDia.ferias}</p>
          <p className="text-[11px] text-indigo-600/80">férias programadas</p>
        </div>

        <div
          className="rounded-2xl p-4 shadow-xs border col-span-2 sm:col-span-1"
          style={{ borderColor: `${turmaFolgaInfo?.cor}40`, backgroundColor: `${turmaFolgaInfo?.cor}08` }}
        >
          <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: turmaFolgaInfo?.cor }}>Folga Escala</p>
          <p className="text-2xl font-black mt-1" style={{ color: turmaFolgaInfo?.cor }}>{totaisDia.folgaEscala}</p>
          <p className="text-[11px] text-muted-foreground">Turma {turmaDoDia} — descanso</p>
        </div>
      </div>

      {/* Grade de Turnos */}
      <div className={cn(
        "grid gap-4",
        turnosParaExibir.length === 1 ? "grid-cols-1" :
        turnosParaExibir.length === 2 ? "grid-cols-1 lg:grid-cols-2" :
        "grid-cols-1 lg:grid-cols-3"
      )}>
        {turnosParaExibir.map((turno) => {
          const ti = TURNO_INFO[turno];
          const items = operadoresPorTurno[turno] || [];

          return (
            <div
              key={turno}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col"
            >
              {/* Header do Turno */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn("flex items-center justify-center w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs", ti.color)}>
                    {ti.icon}
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">{ti.label}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{ti.horario}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-bold text-xs">
                  {items.length} op.
                </Badge>
              </div>

              {/* Lista de Operadores */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum operador neste turno
                  </div>
                ) : (
                  items.map((item) => {
                    const op = item.operator;
                    const opTurmaInfo = TURMAS_INFO[op.letra];
                    const initials = op.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'OP';

                    return (
                      <div
                        key={op.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Avatar com cor da turma */}
                          <div
                            className="w-7 h-7 rounded-lg text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs"
                            style={{ backgroundColor: opTurmaInfo.cor }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{op.nome}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{op.matricula} · {op.cargo}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Status */}
                          <StatusChip statusHoje={item.statusHoje} statusLabel={item.statusLabel} corStatus={item.corStatus} />

                          {/* Ação rápida */}
                          {item.statusHoje !== 'folga_escala' && (
                            <button
                              type="button"
                              onClick={() => onOpenOcorrencia(op)}
                              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                              title="Lançar ocorrência"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chip de Status compacto
function StatusChip({
  statusHoje,
  statusLabel,
  corStatus,
}: {
  statusHoje: string;
  statusLabel: string;
  corStatus: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
        corStatus
      )}
    >
      {statusHoje === 'presente' && <CheckCircle2 className="w-3 h-3" />}
      {statusHoje === 'atestado' && <Stethoscope className="w-3 h-3" />}
      {(statusHoje === 'falta_injustificada' || statusHoje === 'falta_justificada') && <AlertTriangle className="w-3 h-3" />}
      {statusHoje === 'folga_flexivel' && <CalendarDays className="w-3 h-3" />}
      {statusHoje === 'ferias' && <Palmtree className="w-3 h-3" />}
      {statusHoje === 'folga_escala' && <Clock className="w-3 h-3" />}
      {statusHoje === 'hora_extra' && <Zap className="w-3 h-3" />}
      {statusLabel}
    </span>
  );
}
