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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  SlidersHorizontal,
  FilterX,
  X,
} from 'lucide-react';
import { OcorrenciaDetalheModal } from './ocorrencia-detalhe-modal';
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
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | string>('ALL');
  const [turmaFilter, setTurmaFilter] = useState<'ALL' | OperatorTurma>('ALL');
  const [cargoFilter, setCargoFilter] = useState<'ALL' | string>('ALL');
  const [turnoViewFilter, setTurnoViewFilter] = useState<'ALL' | ProductionTurno>('ALL');
  const [occToView, setOccToView] = useState<LaborOccurrence | null>(null);

  // Lista única de cargos para filtro
  const listaCargos = useMemo(() => {
    const set = new Set<string>();
    operators.forEach((op) => {
      if (op.cargo) set.add(op.cargo);
    });
    return Array.from(set).sort();
  }, [operators]);

  // Turnos a serem exibidos (para supervisor/admin com 'ALL' ou turno individual da liderança)
  const turnosParaExibir = useMemo(() => {
    if (selectedTurno !== 'ALL') return [selectedTurno];
    if (turnoViewFilter !== 'ALL') return [turnoViewFilter];
    return [1, 2, 3];
  }, [selectedTurno, turnoViewFilter]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    statusFilter !== 'ALL' ||
    turmaFilter !== 'ALL' ||
    cargoFilter !== 'ALL' ||
    (selectedTurno === 'ALL' && turnoViewFilter !== 'ALL')
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setTurmaFilter('ALL');
    setCargoFilter('ALL');
    setTurnoViewFilter('ALL');
  };

  // Dados da escala do dia selecionado
  const escalaDia = useMemo(() => getEscalaForDate(selectedDate), [selectedDate]);
  const turmaDoDia = escalaDia ? escalaDia.turma_escalada : 'A';
  const turmaFolgaInfo = TURMAS_INFO[turmaDoDia];

  // Filtrar operadores com todos os critérios selecionados
  const operadoresPorTurno = useMemo(() => {
    const result: Record<number, DailyOperatorStatus[]> = {};
    const query = searchQuery.trim().toLowerCase();

    turnosParaExibir.forEach((t) => {
      const ops = operators.filter((op) => op.turno === t);
      const summary = getDailyPresenceSummary(selectedDate, ops, occurrences);

      result[t] = summary.operadoresStatus.filter((item) => {
        const op = item.operator;

        // Busca textual
        if (query) {
          const matches =
            op.nome.toLowerCase().includes(query) ||
            op.matricula.toLowerCase().includes(query) ||
            op.cargo.toLowerCase().includes(query);
          if (!matches) return false;
        }

        // Filtro de Turma (A, B, C, D)
        if (turmaFilter !== 'ALL' && op.letra !== turmaFilter) {
          return false;
        }

        // Filtro de Cargo
        if (cargoFilter !== 'ALL' && op.cargo !== cargoFilter) {
          return false;
        }

        // Filtro de Status
        if (statusFilter !== 'ALL') {
          if (statusFilter === 'ausentes') {
            if (item.statusHoje === 'presente' || item.statusHoje === 'folga_escala') return false;
          } else if (item.statusHoje !== statusFilter) {
            return false;
          }
        }

        return true;
      });
    });

    return result;
  }, [operators, occurrences, selectedDate, turnosParaExibir, searchQuery, turmaFilter, cargoFilter, statusFilter]);

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

  return (
    <div className="space-y-4">
      {/* Barra de data e info do dia */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Navegação de Data */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border-strong)] rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => handleShiftDay(-1)}
              className="h-8 w-8 flex items-center justify-center hover:bg-[var(--hover)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="h-8 px-3 text-xs font-medium hover:bg-[var(--hover)] transition-colors border-x border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)]"
            >
              Hoje
            </button>
            <div className="relative flex items-center">
              <CalendarIcon className="absolute left-2.5 h-3.5 w-3.5 text-[var(--text-3)] pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="h-8 pl-8 pr-2.5 text-xs font-mono bg-transparent border-none outline-none w-32 text-[var(--text)] cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => handleShiftDay(1)}
              className="h-8 w-8 flex items-center justify-center hover:bg-[var(--hover)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {escalaDia && (
            <span className="text-xs font-medium text-[var(--text-2)] hidden sm:inline font-mono">
              {escalaDia.dia_semana_curto}, {String(escalaDia.dia).padStart(2, '0')}/{String(escalaDia.mes).padStart(2, '0')}
            </span>
          )}

          {escalaDia?.e_feriado && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium">{escalaDia.feriado_nome}</span>
            </div>
          )}
        </div>

        {/* Folga da escala do dia */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-2)] font-mono">
          <span
            className="w-4 h-4 rounded text-white font-semibold text-[10px] flex items-center justify-center"
            style={{ backgroundColor: turmaFolgaInfo?.cor || 'var(--accent)' }}
          >
            {turmaDoDia}
          </span>
          <span>
            Turma {turmaDoDia} de Folga · Ciclo {escalaDia?.dia_ciclo_28}/28
          </span>
        </div>
      </div>

      {/* Grid de Métricas de Resumo Diário */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-[var(--border)] rounded-md bg-[var(--surface)] overflow-hidden divide-x divide-y sm:divide-y-0 divide-[var(--border)]">
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-3)]" />
            Efetivo Total
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] font-mono block">
            {totaisDia.total}
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">cadastrado</p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Presentes
          </label>
          <strong className="text-xl font-semibold tracking-tight text-emerald-400 font-mono block">
            {totaisDia.presentes}
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">em operação</p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-red-400 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Faltas & Atestados
          </label>
          <strong className="text-xl font-semibold tracking-tight text-red-400 font-mono block">
            {totaisDia.faltas + totaisDia.atestados}
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5 font-mono">
            {totaisDia.faltas} fal · {totaisDia.atestados} ate
          </p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-sky-400 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Folga Flexível
          </label>
          <strong className="text-xl font-semibold tracking-tight text-sky-400 font-mono block">
            {totaisDia.folgasFlexiveis}
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">alinhadas</p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-purple-400 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Em Férias
          </label>
          <strong className="text-xl font-semibold tracking-tight text-purple-400 font-mono block">
            {totaisDia.ferias}
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">programadas</p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
            Folga da Escala
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text-2)] font-mono block">
            {totaisDia.folgaEscala}
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">Turma {turmaDoDia}</p>
        </div>
      </div>

      {/* Barra de Filtros Compacta */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="h-3.5 w-3.5 text-[var(--text-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar operador, cargo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-[var(--surface)] border-[var(--border-strong)] rounded-md text-[var(--text)] placeholder:text-[var(--text-3)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filtro de Status */}
        <div className="w-[140px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs rounded-md bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text-2)]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]">
              <SelectItem value="ALL" className="text-xs">Todos os Status</SelectItem>
              <SelectItem value="presente" className="text-xs text-emerald-400">Presentes</SelectItem>
              <SelectItem value="folga_flexivel" className="text-xs text-sky-400">Folga Flexível</SelectItem>
              <SelectItem value="atestado" className="text-xs text-rose-400">Atestado Médico</SelectItem>
              <SelectItem value="falta_injustificada" className="text-xs text-red-400">Falta Injustificada</SelectItem>
              <SelectItem value="falta_justificada" className="text-xs text-amber-400">Falta Justificada</SelectItem>
              <SelectItem value="ferias" className="text-xs text-purple-400">Férias</SelectItem>
              <SelectItem value="folga_escala" className="text-xs text-[var(--text-3)]">Folga da Escala</SelectItem>
              <SelectItem value="hora_extra" className="text-xs text-emerald-400">Hora Extra</SelectItem>
              <SelectItem value="ausentes" className="text-xs text-amber-400">Todas Ausências</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro de Turma */}
        <div className="w-[120px]">
          <Select value={turmaFilter} onValueChange={(v: any) => setTurmaFilter(v)}>
            <SelectTrigger className="h-8 text-xs rounded-md bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text-2)]">
              <SelectValue placeholder="Turma" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]">
              <SelectItem value="ALL" className="text-xs">Todas Turmas</SelectItem>
              {(['A', 'B', 'C', 'D'] as const).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  Turma {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro de Cargo */}
        <div className="w-[150px]">
          <Select value={cargoFilter} onValueChange={setCargoFilter}>
            <SelectTrigger className="h-8 text-xs rounded-md bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text-2)] truncate">
              <SelectValue placeholder="Cargo/Função" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)] max-h-56">
              <SelectItem value="ALL" className="text-xs">Todos os Cargos</SelectItem>
              {listaCargos.map((c) => (
                <SelectItem key={c} value={c} className="text-xs truncate">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md gap-1"
          >
            <FilterX className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
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
              className="bg-[var(--surface)] rounded-md border border-[var(--border)] overflow-hidden flex flex-col"
            >
              {/* Header do Turno */}
              <div className="px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-2)]">{ti.icon}</span>
                  <span className="text-xs font-medium text-[var(--text)]">{ti.label}</span>
                  <span className="text-[11px] text-[var(--text-3)] font-mono">({ti.horario})</span>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                  {items.length} op.
                </span>
              </div>

              {/* Lista de Operadores */}
              <div className="divide-y divide-[var(--border)] flex-1 max-h-[520px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[var(--text-3)]">
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
                        onClick={() => {
                          if (item.ocorrenciaHoje) {
                            setOccToView(item.ocorrenciaHoje);
                          } else {
                            onOpenOcorrencia(op);
                          }
                        }}
                        className="group px-3 py-2 flex items-center justify-between gap-3 hover:bg-[var(--hover)] transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-6 h-6 rounded text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: opTurmaInfo?.cor || 'var(--accent)' }}
                          >
                            {op.letra}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">
                              {op.nome}
                            </p>
                            <p className="text-[11px] text-[var(--text-3)] font-mono truncate">
                              {op.matricula} · {op.cargo}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusChip
                            statusHoje={item.statusHoje}
                            statusLabel={item.statusLabel}
                            corStatus={item.corStatus}
                          />
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

      {/* Modal de Detalhe e Exclusão da Ocorrência */}
      <OcorrenciaDetalheModal
        open={Boolean(occToView)}
        onOpenChange={(v) => !v && setOccToView(null)}
        occurrence={occToView}
        occurrences={occurrences}
      />
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
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all text-left shadow-2xs",
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
