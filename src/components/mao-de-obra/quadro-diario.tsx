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
  2: { label: 'Turno 2', horario: '15:50 – 23:50', icon: <Sunset className="w-4 h-4" />, color: 'text-orange-600 dark:text-orange-400' },
  3: { label: 'Turno 3', horario: '23:50 – 07:20', icon: <Moon className="w-4 h-4" />, color: 'text-blue-600 dark:text-blue-400' },
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
  const [hideOffSchedule, setHideOffSchedule] = useState(false);
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
    hideOffSchedule ||
    (selectedTurno === 'ALL' && turnoViewFilter !== 'ALL')
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setTurmaFilter('ALL');
    setCargoFilter('ALL');
    setTurnoViewFilter('ALL');
    setHideOffSchedule(false);
  };

  // Dados da escala do dia selecionado
  const escalaDia = useMemo(() => getEscalaForDate(selectedDate), [selectedDate]);
  const turmaDoDia = escalaDia ? escalaDia.turma_escalada : 'A';
  const turmaFolgaInfo = TURMAS_INFO[turmaDoDia];

  // Ordem de prioridade industrial: ausências no topo, presentes, depois fora de escala
  const ORDER = [
    'falta_injustificada',
    'falta_justificada',
    'atestado',
    'presente',
    'folga_flexivel',
    'ferias',
    'afastado',
    'folga_escala',
    'inativo',
  ];

  // Filtrar operadores com todos os critérios selecionados
  const operadoresPorTurno = useMemo(() => {
    const result: Record<number, DailyOperatorStatus[]> = {};
    const query = searchQuery.trim().toLowerCase();

    turnosParaExibir.forEach((t) => {
      const ops = operators.filter((op) => op.turno === t);
      const summary = getDailyPresenceSummary(selectedDate, ops, occurrences);

      const filtered = summary.operadoresStatus.filter((item) => {
        const op = item.operator;

        // Ocultar folga de escala se marcado
        if (hideOffSchedule && item.statusHoje === 'folga_escala') {
          return false;
        }

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

      // Ordenação prioritária
      filtered.sort((a, b) => {
        const idxA = ORDER.indexOf(a.statusHoje);
        const idxB = ORDER.indexOf(b.statusHoje);
        if (idxA !== idxB) return idxA - idxB;
        return a.operator.nome.localeCompare(b.operator.nome);
      });

      result[t] = filtered;
    });

    return result;
  }, [operators, occurrences, selectedDate, turnosParaExibir, searchQuery, turmaFilter, cargoFilter, statusFilter, hideOffSchedule]);

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
      {/* Barra de data e info do dia (daynav) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Navegação de Data */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleShiftDay(-1)}
              className="h-7 w-7 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] flex items-center justify-center transition-colors cursor-pointer"
              title="Dia anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleShiftDay(1)}
              className="h-7 w-7 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] flex items-center justify-center transition-colors cursor-pointer"
              title="Próximo dia"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative flex items-center cursor-pointer ml-1">
            <span className="font-semibold text-sm text-[var(--text)]">
              {(() => {
                const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const parts = selectedDate.split('-');
                const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                const isToday = selectedDate === new Date().toISOString().split('T')[0];
                return `${diasSemana[dt.getDay()]}, ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}${isToday ? ' · hoje' : ''}`;
              })()}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer pointer-events-auto"
            />
          </div>
        </div>

        {/* Info do Ciclo / Feriado */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-3)] font-mono">
          {escalaDia?.e_feriado && (
            <span className="text-amber-400 font-medium">
              Feriado: {escalaDia.feriado_nome} ·{' '}
            </span>
          )}
          <span>
            Turma de folga{' '}
            <span
              className="inline-grid place-items-center w-5 h-5 rounded-[4px] border font-bold text-[11px] align-middle mx-1"
              style={{
                backgroundColor: turmaFolgaInfo ? `${turmaFolgaInfo.cor}22` : 'var(--surface-2)',
                color: turmaFolgaInfo?.cor || 'var(--text)',
                borderColor: turmaFolgaInfo ? `${turmaFolgaInfo.cor}55` : 'var(--border-strong)',
              }}
            >
              {turmaDoDia}
            </span>
            {escalaDia?.dia_ciclo_28 ? ` · dia ${escalaDia.dia_ciclo_28}/28 do ciclo` : ''}
          </span>
        </div>
      </div>

      {/* Grid de Métricas de Resumo Diário */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden divide-x divide-y sm:divide-y-0 divide-[var(--border)]">
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            Efetivo
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] block">
            {totaisDia.total}
          </strong>
          <p className="text-xs text-[var(--text-3)] mt-0.5">quadro cadastrado</p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
            Presentes
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] block">
            {totaisDia.presentes}
          </strong>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            de {totaisDia.total - totaisDia.folgaEscala - totaisDia.ferias - totaisDia.folgasFlexiveis} escalados
          </p>
        </div>

        <div className={cn("p-3.5", (totaisDia.faltas + totaisDia.atestados) > 0 && "bg-red-500/5")}>
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
            Faltas e atestados
          </label>
          <strong className={cn("text-xl font-semibold tracking-tight block", (totaisDia.faltas + totaisDia.atestados) > 0 ? "text-[var(--red)]" : "text-[var(--text)]")}>
            {totaisDia.faltas + totaisDia.atestados}
          </strong>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {totaisDia.faltas} faltas · {totaisDia.atestados} atestados
          </p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />
            Folga flexível
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] block">
            {totaisDia.folgasFlexiveis}
          </strong>
          <p className="text-xs text-[var(--text-3)] mt-0.5">folgas alinhadas</p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--violet)]" />
            Férias
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] block">
            {totaisDia.ferias}
          </strong>
          <p className="text-xs text-[var(--text-3)] mt-0.5">em gozo</p>
        </div>

        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full border border-[var(--text-3)] bg-transparent" />
            Folga de escala
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] block">
            {totaisDia.folgaEscala}
          </strong>
          <p className="text-xs text-[var(--text-3)] mt-0.5">turma {turmaDoDia}</p>
        </div>
      </div>

      {/* Barra de Filtros Industrial */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca Industrial */}
        <label className="search-industrial w-[260px] cursor-text">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            placeholder="Buscar operador ou cargo"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[var(--text-3)] hover:text-[var(--text)] ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </label>

        {/* Filtro de Status Industrial */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select-industrial"
        >
          <option value="ALL">Todos os status</option>
          <option value="presente">Presentes</option>
          <option value="atestado">Atestados</option>
          <option value="falta_injustificada">Faltas injustificadas</option>
          <option value="falta_justificada">Faltas justificadas</option>
          <option value="folga_flexivel">Folga flexível</option>
          <option value="ferias">Férias</option>
          <option value="folga_escala">Folga de escala</option>
          <option value="ausentes">Todas ausências</option>
        </select>

        {/* Filtro de Turma Industrial */}
        <select
          value={turmaFilter}
          onChange={(e) => setTurmaFilter(e.target.value as any)}
          className="select-industrial"
        >
          <option value="ALL">Todas as turmas</option>
          <option value="A">Turma A</option>
          <option value="B">Turma B</option>
          <option value="C">Turma C</option>
          <option value="D">Turma D</option>
        </select>

        {/* Filtro de Cargo Industrial */}
        <select
          value={cargoFilter}
          onChange={(e) => setCargoFilter(e.target.value)}
          className="select-industrial max-w-[200px]"
        >
          <option value="ALL">Todos os cargos</option>
          {listaCargos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Checkbox Ocultar folga de escala */}
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-2)] cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={hideOffSchedule}
            onChange={(e) => setHideOffSchedule(e.target.checked)}
            className="rounded-[3px] border-[var(--border-strong)] bg-[var(--surface)] text-[var(--accent)] accent-[var(--accent)] w-3.5 h-3.5 cursor-pointer"
          />
          <span>Ocultar folga de escala</span>
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="h-8 px-2.5 text-xs text-[var(--red)] hover:bg-red-500/10 rounded-[var(--radius)] inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <FilterX className="w-3.5 h-3.5" />
            Limpar
          </button>
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
          const allItems = operadoresPorTurno[turno] || [];
          const escalados = allItems.filter(x => !['folga_escala', 'ferias', 'folga_flexivel'].includes(x.statusHoje)).length;
          const presentes = allItems.filter(x => x.statusHoje === 'presente').length;
          const covPct = escalados > 0 ? (presentes / escalados) * 100 : 0;

          let lastWasOff = false;

          return (
            <div
              key={turno}
              className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden flex flex-col min-w-0"
            >
              {/* Header do Turno com Barra de Cobertura */}
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-[var(--text)]">{ti.label}</h2>
                  <span className="text-[11px] text-[var(--text-3)] font-mono">{ti.horario}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-3)]" title="Presentes / escalados">
                  <div className="w-14 h-1 bg-[var(--border-strong)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--text-2)] transition-all" style={{ width: `${covPct}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-[var(--text-2)]">{presentes}/{escalados}</span>
                </div>
              </div>

              {/* Lista de Operadores */}
              <div className="divide-y divide-[var(--border)] flex-1 max-h-[520px] overflow-y-auto">
                {allItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[var(--text-3)]">
                    Nenhum operador neste turno
                  </div>
                ) : (
                  allItems.map((item) => {
                    const op = item.operator;
                    const opTurmaInfo = TURMAS_INFO[op.letra];
                    const isOff = ['folga_escala', 'ferias', 'folga_flexivel'].includes(item.statusHoje);
                    const showSeparator = isOff && !lastWasOff;
                    lastWasOff = isOff;

                    return (
                      <div key={op.id}>
                        {showSeparator && (
                          <div className="px-4 py-1.5 text-[11px] font-medium text-[var(--text-3)] bg-[var(--surface-2)] border-b border-[var(--border)]">
                            Fora da escala hoje
                          </div>
                        )}
                        <div
                          onClick={() => {
                            if (item.ocorrenciaHoje) {
                              setOccToView(item.ocorrenciaHoje);
                            } else {
                              onOpenOcorrencia(op);
                            }
                          }}
                          className={cn(
                            "px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--hover)] transition-colors cursor-pointer select-none",
                            isOff && "opacity-60"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="inline-grid place-items-center w-5 h-5 rounded-[4px] font-mono text-[11px] font-bold shrink-0 border"
                              style={{
                                backgroundColor: opTurmaInfo?.cor ? `${opTurmaInfo.cor}22` : 'var(--surface-2)',
                                color: opTurmaInfo?.cor || 'var(--text)',
                                borderColor: opTurmaInfo?.cor ? `${opTurmaInfo.cor}55` : 'var(--border-strong)'
                              }}
                            >
                              {op.letra}
                            </span>
                            <div className="min-w-0">
                              <p className={cn("text-xs truncate", isOff ? "text-[var(--text-3)] font-normal" : "text-[var(--text)] font-semibold")}>
                                {op.nome}
                              </p>
                              <p className="text-[11px] text-[var(--text-3)] font-mono truncate">
                                {op.matricula} · {op.cargo} · Turma {op.letra}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
                              {item.statusHoje === 'folga_escala' ? (
                                <i className="w-1.5 h-1.5 rounded-full border border-[var(--text-3)] bg-transparent inline-block shrink-0" />
                              ) : (
                                <i
                                  className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                                  style={{
                                    backgroundColor:
                                      item.statusHoje === 'presente' ? 'var(--green)' :
                                      item.statusHoje === 'atestado' ? 'var(--amber)' :
                                      item.statusHoje === 'falta_injustificada' ? 'var(--red)' :
                                      item.statusHoje === 'falta_justificada' ? 'var(--amber)' :
                                      item.statusHoje === 'folga_flexivel' ? 'var(--blue)' :
                                      item.statusHoje === 'ferias' ? 'var(--violet)' : 'var(--text-3)'
                                  }}
                                />
                              )}
                              <span className={cn(isOff ? "text-[var(--text-3)]" : "text-[var(--text-2)] font-medium")}>
                                {item.statusLabel}
                              </span>
                            </span>
                          </div>
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
