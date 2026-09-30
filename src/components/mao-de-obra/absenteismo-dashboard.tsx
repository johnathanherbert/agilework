"use client";

import { useMemo, useState } from 'react';
import {
  Operator,
  LaborOccurrence,
  ProductionTurno,
} from '@/types';
import {
  calculateAbsenteeismStats,
  getMonthlyAbsenteeismHistory,
  getTurnoAbsenteeismComparison,
} from '@/lib/labor-helpers';
import { isEscaladoParaTrabalhar } from '@/lib/escala-helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  AlertTriangle,
  Stethoscope,
  Clock,
  Users,
  Target,
  BarChart3,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface AbsenteismoDashboardProps {
  operators: Operator[];
  occurrences: LaborOccurrence[];
  selectedTurno: ProductionTurno | 'ALL';
}

const MONTHS_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const COLORS_PIE = ['#EF4444', '#F59E0B', '#EC4899', '#38BDF8', '#6366F1'];

export function AbsenteismoDashboard({
  operators,
  occurrences,
  selectedTurno,
}: AbsenteismoDashboardProps) {
  const currentMonthNum = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [year] = useState<number>(2026);

  const turnoFilter = selectedTurno === 'ALL' ? undefined : selectedTurno;

  // Estatísticas do mês selecionado
  const currentStats = useMemo(() => {
    return calculateAbsenteeismStats(operators, occurrences, year, selectedMonth, turnoFilter);
  }, [operators, occurrences, year, selectedMonth, turnoFilter]);

  // Histórico de 12 meses para os gráficos
  const monthlyHistory = useMemo(() => {
    return getMonthlyAbsenteeismHistory(operators, occurrences, year, turnoFilter);
  }, [operators, occurrences, year, turnoFilter]);

  // Comparativo entre turnos
  const turnoComparison = useMemo(() => {
    return getTurnoAbsenteeismComparison(operators, occurrences, year, selectedMonth);
  }, [operators, occurrences, year, selectedMonth]);

  // Distribuição de ausências para o gráfico Donut (Atestados e Faltas que geram absenteísmo)
  const pieData = useMemo(() => {
    return [
      { name: 'Atestados Médicos', value: currentStats.diasPerdidosAtestados, color: '#F43F5E' },
      { name: 'Faltas Injustificadas', value: currentStats.diasPerdidosFaltasInjustificadas, color: '#EF4444' },
      { name: 'Faltas Justificadas', value: currentStats.diasPerdidosFaltasJustificadas, color: '#F59E0B' },
    ].filter((item) => item.value > 0);
  }, [currentStats]);

  // Ranking de operadores com ausências no mês (respeitando a escala do calendário)
  const operatorsRanking = useMemo(() => {
    const opMap = new Map<string, {
      id: string;
      nome: string;
      cargo: string;
      turno: number;
      letra: string;
      totalDias: number;
      faltas: number;
      atestados: number;
    }>();

    occurrences.forEach((occ) => {
      if (turnoFilter && occ.turno !== turnoFilter) return;
      if (!occ.impactaAbsenteismo) return;

      const start = new Date(occ.dataInicio + 'T12:00:00Z');
      const end = new Date((occ.dataFim || occ.dataInicio) + 'T12:00:00Z');
      const cur = new Date(start);

      while (cur <= end) {
        const curYear = cur.getUTCFullYear();
        const curMonth = cur.getUTCMonth() + 1;

        if (curYear === year && curMonth === selectedMonth) {
          const dateStr = cur.toISOString().split('T')[0];
          // Só contabiliza se o operador estava programado para trabalhar neste dia
          if (isEscaladoParaTrabalhar(occ.operadorLetra, dateStr)) {
            if (!opMap.has(occ.operadorId)) {
              opMap.set(occ.operadorId, {
                id: occ.operadorId,
                nome: occ.operadorNome,
                cargo: occ.operadorCargo,
                turno: occ.turno,
                letra: occ.operadorLetra,
                totalDias: 0,
                faltas: 0,
                atestados: 0,
              });
            }
            const item = opMap.get(occ.operadorId)!;
            item.totalDias += 1;
            if (occ.tipo === 'atestado') {
              item.atestados += 1;
            } else {
              item.faltas += 1;
            }
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    });

    return Array.from(opMap.values()).sort((a, b) => b.totalDias - a.totalDias);
  }, [occurrences, year, selectedMonth, turnoFilter]);

  // Status visual da taxa de absenteísmo
  const getTaxaStatus = (taxa: number) => {
    if (taxa <= 2.5) {
      return {
        label: 'Excelente (Abaixo da Meta)',
        color: 'text-emerald-700 dark:text-emerald-400',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300',
        icon: CheckCircle2,
      };
    }
    if (taxa <= 4.0) {
      return {
        label: 'Atenção (Acima da Meta)',
        color: 'text-amber-700 dark:text-amber-400',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300',
        icon: AlertTriangle,
      };
    }
    return {
      label: 'Crítico (Ação Necessária)',
      color: 'text-red-700 dark:text-red-400',
      badgeBg: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300',
      icon: AlertCircle,
    };
  };

  const taxaStatus = getTaxaStatus(currentStats.taxaAbsenteismo);
  const StatusIcon = taxaStatus.icon;

  return (
    <div className="space-y-4">
      {/* Top Header com Seletor de Mês */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="font-semibold text-sm text-[var(--text)]">Índice de absenteísmo</div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">
            (<code className="font-mono text-[11px] text-[var(--text-2)]">dias perdidos por faltas + atestados</code>) ÷ <code className="font-mono text-[11px] text-[var(--text-2)]">dias-homem programados</code> × 100 · meta &lt; 2.5%
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="select-industrial min-w-[150px]"
          >
            {MONTHS_NAMES.map((nome, idx) => (
              <option key={nome} value={String(idx + 1)}>
                {nome} de {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards de KPIs Principais de Absenteísmo (Summary Concept) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-[var(--border)] rounded-md bg-[var(--surface)] divide-x divide-y sm:divide-y-0 divide-[var(--border)] overflow-hidden">
        {/* KPI 1: Taxa Geral de Absenteísmo */}
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
            <span className={cn("w-1.5 h-1.5 rounded-full", currentStats.taxaAbsenteismo <= 2.5 ? "bg-emerald-500" : currentStats.taxaAbsenteismo <= 4.0 ? "bg-amber-500" : "bg-red-500")} />
            Taxa absenteísmo
          </label>
          <strong className={cn("text-xl font-semibold tracking-tight font-mono block", currentStats.taxaAbsenteismo <= 2.5 ? "text-emerald-400" : currentStats.taxaAbsenteismo <= 4.0 ? "text-amber-400" : "text-red-400")}>
            {currentStats.taxaAbsenteismo}%
            <small className="text-xs font-medium text-[var(--text-3)] ml-1.5">meta &lt; 2.5%</small>
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-1 truncate">
            {taxaStatus.label}
          </p>
        </div>

        {/* KPI 2: Absenteísmo por Atestados Médicos */}
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Por atestado
          </label>
          <strong className="text-xl font-semibold tracking-tight font-mono block text-rose-400">
            {currentStats.taxaAtestados}%
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-1 truncate">
            {currentStats.diasPerdidosAtestados} dia(s) médico(s) ({currentStats.diasPerdidosAtestados * 8}h)
          </p>
        </div>

        {/* KPI 3: Absenteísmo por Faltas */}
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Por falta
          </label>
          <strong className="text-xl font-semibold tracking-tight font-mono block text-red-400">
            {currentStats.taxaFaltas}%
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-1 truncate">
            {currentStats.diasPerdidosFaltasInjustificadas + currentStats.diasPerdidosFaltasJustificadas} dia(s) de falta
          </p>
        </div>

        {/* KPI 4: Horas Homem Perdidas */}
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Horas perdidas
          </label>
          <strong className="text-xl font-semibold tracking-tight font-mono block text-[var(--text)]">
            {currentStats.totalHorasPerdidas}h
            <small className="text-xs font-medium text-[var(--text-3)] ml-1">/ {currentStats.horasHomemProgramadas}h</small>
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-1 truncate">
            {currentStats.totalOperadores} ops · {currentStats.diasHomemProgramados}d prog.
          </p>
        </div>
      </div>

      {/* Gráficos e Distribuição (Conceito Industrial 2:1) */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Card 1: Evolução mensal · 2026 */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-xs font-semibold text-[var(--text)]">Evolução mensal · {year}</h2>
            <div className="flex items-center gap-3 text-xs text-[var(--text-3)]">
              <span className="flex items-center gap-1.5">
                <i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--amber)' }} />
                Atestados
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--red)' }} />
                Faltas
              </span>
            </div>
          </div>

          <div className="p-4">
            {/* Chart Area */}
            {(() => {
              const META_ABS = 2.5;
              const maxVal = Math.max(META_ABS * 1.4, ...monthlyHistory.map((d) => d.taxaAbsenteismo || 0), 1);

              return (
                <div>
                  <div className="relative h-[180px] border-b border-[var(--border)] flex items-end gap-2 px-1">
                    {/* Meta Line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-[var(--red)] opacity-60 pointer-events-none z-10"
                      style={{ bottom: `${(META_ABS / maxVal) * 100}%` }}
                    >
                      <span className="absolute right-0 -top-4 text-[10px] text-[var(--text-3)] font-mono">
                        meta 2,5%
                      </span>
                    </div>

                    {/* Columns */}
                    {monthlyHistory.map((d, idx) => {
                      const isCurrent = idx + 1 === selectedMonth;
                      const hasData = (d.taxaAbsenteismo || 0) > 0;
                      const colHeight = (d.taxaAbsenteismo / maxVal) * 100;
                      const totalLoss = d.taxaAtestados + d.taxaFaltas;
                      const atestFlex = totalLoss > 0 ? d.taxaAtestados / totalLoss : 1;
                      const faltFlex = totalLoss > 0 ? d.taxaFaltas / totalLoss : 0;

                      if (!hasData) {
                        return (
                          <div
                            key={d.mes}
                            className="flex-1 h-full flex flex-col justify-end relative cursor-pointer"
                            onClick={() => setSelectedMonth(idx + 1)}
                            title={`${MONTHS_NAMES[idx]}: 0,0%`}
                          >
                            <div className="w-full max-w-[36px] mx-auto h-[2px] bg-[var(--border)] rounded-xs" />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={d.mes}
                          className={cn(
                            "flex-1 h-full flex flex-col justify-end relative group cursor-pointer",
                            isCurrent && "font-semibold"
                          )}
                          onClick={() => setSelectedMonth(idx + 1)}
                          title={`${MONTHS_NAMES[idx]}: ${d.taxaAbsenteismo.toFixed(1).replace('.', ',')}%`}
                        >
                          {/* Value above column */}
                          <span
                            className={cn(
                              "absolute left-0 right-0 text-center font-mono text-[10.5px] tabular-nums transition-colors",
                              isCurrent ? "text-[var(--text)] font-bold" : "text-[var(--text-3)]"
                            )}
                            style={{ bottom: `calc(${colHeight}% + 4px)` }}
                          >
                            {d.taxaAbsenteismo.toFixed(1).replace('.', ',')}
                          </span>

                          {/* Stack Bar */}
                          <div
                            className="w-full max-w-[36px] mx-auto rounded-t-xs overflow-hidden flex flex-col-reverse"
                            style={{ height: `${Math.min(100, Math.max(4, colHeight))}%` }}
                          >
                            <i
                              style={{
                                flex: atestFlex,
                                backgroundColor: 'var(--amber)',
                                opacity: isCurrent ? 1 : 0.65,
                              }}
                              className="block w-full transition-opacity"
                            />
                            <i
                              style={{
                                flex: faltFlex,
                                backgroundColor: 'var(--red)',
                                opacity: isCurrent ? 1 : 0.65,
                              }}
                              className="block w-full transition-opacity"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Axis labels */}
                  <div className="flex gap-2 mt-1.5 px-1">
                    {monthlyHistory.map((d, idx) => {
                      const isCurrent = idx + 1 === selectedMonth;
                      return (
                        <span
                          key={d.mes}
                          onClick={() => setSelectedMonth(idx + 1)}
                          className={cn(
                            "flex-1 text-center text-[11px] font-mono cursor-pointer transition-colors",
                            isCurrent ? "text-[var(--text)] font-bold" : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                          )}
                        >
                          {d.mes}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Card 2: Distribuição por motivo */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md min-w-0 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-xs font-semibold text-[var(--text)]">Distribuição por motivo</h2>
              <span className="text-xs text-[var(--text-3)]">{MONTHS_NAMES[selectedMonth - 1]}</span>
            </div>

            {(() => {
              const totalDays = currentStats.diasPerdidosAtestados + currentStats.diasPerdidosFaltasInjustificadas + currentStats.diasPerdidosFaltasJustificadas;
              const totalFaltas = currentStats.diasPerdidosFaltasInjustificadas + currentStats.diasPerdidosFaltasJustificadas;
              const atestPct = totalDays > 0 ? (currentStats.diasPerdidosAtestados / totalDays) * 100 : 0;
              const faltPct = totalDays > 0 ? (totalFaltas / totalDays) * 100 : 0;

              if (totalDays === 0) {
                return (
                  <div className="p-8 text-center text-xs text-[var(--text-3)]">
                    Sem ausências no mês selecionado.
                  </div>
                );
              }

              return (
                <div className="p-4 space-y-4">
                  {/* Horizontal Bar */}
                  <div className="h-2 rounded-full overflow-hidden flex bg-[var(--border)]">
                    {atestPct > 0 && (
                      <i style={{ width: `${atestPct}%`, backgroundColor: 'var(--amber)' }} className="block h-full" />
                    )}
                    {faltPct > 0 && (
                      <i style={{ width: `${faltPct}%`, backgroundColor: 'var(--red)' }} className="block h-full" />
                    )}
                  </div>

                  {/* Detalhes de Distribuição */}
                  <div className="divide-y divide-[var(--border)] text-xs">
                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2 text-[var(--text-2)]">
                        <i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--amber)' }} />
                        Atestados médicos
                      </span>
                      <strong className="font-mono font-medium text-[var(--text)]">
                        {currentStats.diasPerdidosAtestados} d · {Math.round(atestPct)}%
                      </strong>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2 text-[var(--text-2)]">
                        <i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--red)' }} />
                        Faltas (justif. / injust.)
                      </span>
                      <strong className="font-mono font-medium text-[var(--text)]">
                        {totalFaltas} d · {Math.round(faltPct)}%
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Comparativo entre Turnos & Ranking de Ausências (Conceito 1:1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 3: Por Turno */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-xs font-semibold text-[var(--text)]">Por turno</h2>
            <span className="text-xs text-[var(--text-3)]">linha tracejada = meta 2,5%</span>
          </div>

          <div className="p-4 divide-y divide-[var(--border)]">
            {(() => {
              const META_ABS = 2.5;
              const tmax = Math.max(META_ABS * 1.4, ...turnoComparison.map((t) => t.taxaAbsenteismo || 0), 1);

              return turnoComparison.map((t) => {
                const p = t.taxaAbsenteismo || 0;
                const isOver = p > META_ABS;

                return (
                  <div key={t.turno} className="grid grid-cols-[80px_1fr_60px] gap-3 items-center py-2.5 first:pt-0 last:pb-0">
                    <span className="font-mono text-xs text-[var(--text-2)]">
                      {t.nome.replace(' (Manhã)', '').replace(' (Tarde)', '').replace(' (Noite)', '')}
                    </span>

                    {/* Track */}
                    <div className="h-1.5 bg-[var(--border)] rounded-full relative overflow-visible">
                      <i
                        className={cn(
                          "absolute left-0 top-0 bottom-0 rounded-full transition-all",
                          isOver ? "bg-[var(--red)]" : "bg-[var(--text-2)]"
                        )}
                        style={{ width: `${Math.min(100, (p / tmax) * 100)}%` }}
                      />
                      {/* Meta marker */}
                      <b
                        className="absolute -top-1 -bottom-1 w-[1.5px] bg-[var(--red)] opacity-75"
                        style={{ left: `${(META_ABS / tmax) * 100}%` }}
                      />
                    </div>

                    <span className={cn("font-mono text-xs text-right tabular-nums", isOver ? "text-[var(--red)] font-semibold" : "text-[var(--text)]")}>
                      {p.toFixed(1).replace('.', ',')}%
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Card 4: Ausências no Mês */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <h2 className="text-xs font-semibold text-[var(--text)]">Ausências no mês</h2>
            <span className="text-xs font-mono text-[var(--text-3)]">
              {operatorsRanking.length} colaborador(es)
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {operatorsRanking.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-3)]">
                Nenhuma ausência registrada neste mês.
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="bg-[var(--surface-2)] text-[var(--text-3)] font-medium border-b border-[var(--border)]">
                  <tr>
                    <th className="text-left px-3.5 py-2 font-medium">Colaborador</th>
                    <th className="text-right px-3 py-2 font-medium font-mono">Atestado</th>
                    <th className="text-right px-3 py-2 font-medium font-mono">Falta</th>
                    <th className="text-right px-3.5 py-2 font-medium font-mono">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {operatorsRanking.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--hover)] transition-colors">
                      <td className="px-3.5 py-2.5">
                        <b className="block font-medium text-[var(--text)]">{item.nome}</b>
                        <span className="text-[11px] text-[var(--text-3)] font-mono">
                          T{item.turno} · Turma {item.letra}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2.5 font-mono text-[var(--text-2)] tabular-nums">
                        {item.atestados > 0 ? `${item.atestados}d` : '—'}
                      </td>
                      <td className={cn("text-right px-3 py-2.5 font-mono tabular-nums", item.faltas > 0 ? "text-[var(--red)] font-semibold" : "text-[var(--text-3)]")}>
                        {item.faltas > 0 ? `${item.faltas}d` : '—'}
                      </td>
                      <td className="text-right px-3.5 py-2.5 font-mono font-semibold text-[var(--text)] tabular-nums">
                        {item.totalDias}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
