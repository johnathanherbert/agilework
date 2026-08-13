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

  // Distribuição de ausências para o gráfico Donut
  const pieData = useMemo(() => {
    return [
      { name: 'Atestados Médicos', value: currentStats.diasPerdidosAtestados, color: '#F43F5E' },
      { name: 'Faltas Injustificadas', value: currentStats.diasPerdidosFaltasInjustificadas, color: '#EF4444' },
      { name: 'Faltas Justificadas', value: currentStats.diasPerdidosFaltasJustificadas, color: '#F59E0B' },
      { name: 'Folgas Flexíveis (Gozadas)', value: currentStats.diasFolgasFlexiveis, color: '#0EA5E9' },
    ].filter((item) => item.value > 0);
  }, [currentStats]);

  // Ranking de operadores com ausências no mês
  const operatorsRanking = useMemo(() => {
    const monthStartStr = `${year}-${String(selectedMonth).padStart(2, '0')}-01`;
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const nextYear = selectedMonth === 12 ? year + 1 : year;
    const monthEndStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const monthOccs = occurrences.filter((occ) => {
      if (turnoFilter && occ.turno !== turnoFilter) return false;
      return occ.dataInicio >= monthStartStr && occ.dataInicio < monthEndStr && occ.impactaAbsenteismo;
    });

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

    monthOccs.forEach((occ) => {
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
      item.totalDias += occ.dias;
      if (occ.tipo === 'atestado') {
        item.atestados += occ.dias;
      } else {
        item.faltas += occ.dias;
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
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Medição do Índice de Absenteísmo & Produtividade
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fórmula Industrial: (Dias Perdidos Faltas + Atestados) / Dias Homem Programados × 100
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Mês de Referência:</span>
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="h-9 w-[160px] text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-950">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              {MONTHS_NAMES.map((nome, idx) => (
                <SelectItem key={nome} value={String(idx + 1)}>
                  {nome} de {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de KPIs Principais de Absenteísmo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Taxa Geral de Absenteísmo */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Taxa de Absenteísmo</span>
              <span className="text-[10px] font-bold text-muted-foreground font-mono">Meta: &lt; 2.5%</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={cn("text-3xl font-black font-mono", taxaStatus.color)}>
                {currentStats.taxaAbsenteismo}%
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Badge className={cn("text-[10px] font-bold gap-1", taxaStatus.badgeBg)}>
                <StatusIcon className="w-3 h-3" />
                {taxaStatus.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Absenteísmo por Atestados Médicos */}
        <Card className="rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-xs bg-rose-50/20 dark:bg-rose-950/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400">Impacto por Atestados</span>
              <Stethoscope className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black font-mono text-rose-700 dark:text-rose-300">
                {currentStats.taxaAtestados}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {currentStats.diasPerdidosAtestados} dia(s) médico(s) ({currentStats.diasPerdidosAtestados * 8}h)
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Absenteísmo por Faltas */}
        <Card className="rounded-2xl border border-red-200 dark:border-red-900/40 shadow-xs bg-red-50/20 dark:bg-red-950/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400">Impacto por Faltas</span>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black font-mono text-red-700 dark:text-red-300">
                {currentStats.taxaFaltas}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {currentStats.diasPerdidosFaltasInjustificadas + currentStats.diasPerdidosFaltasJustificadas} dia(s) de faltas
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Horas Homem Perdidas */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Horas Homem Perdidas</span>
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black font-mono text-foreground">
                {currentStats.totalHorasPerdidas}h
              </span>
              <span className="text-xs text-muted-foreground">de {currentStats.horasHomemProgramadas}h</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Base: {currentStats.totalOperadores} operadores • {currentStats.diasHomemProgramados} dias programados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos em Linha e Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 1: Evolução Mensal do Absenteísmo (Jan a Dez 2026) */}
        <Card className="lg:col-span-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-sm text-foreground">Evolução Mensal do Absenteísmo (2026)</h4>
              <p className="text-[11px] text-muted-foreground">Acompanhamento mensal com linha de meta de 2.5%</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold">
              Ano Completo 2026
            </Badge>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Taxa']}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '12px', border: 'none' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="taxaAbsenteismo" name="Absenteísmo Geral (%)" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="taxaAtestados" name="Atestados Médicos (%)" fill="#F43F5E" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="meta" name="Meta (2.5%)" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gráfico 2: Distribuição das Ausências */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-foreground">Distribuição por Motivo</h4>
            <p className="text-[11px] text-muted-foreground">{MONTHS_NAMES[selectedMonth - 1]} de {year}</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center my-auto">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} dia(s)`, 'Ausência']}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '12px', border: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground text-xs py-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                Nenhuma ausência registrada neste mês!
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border/80">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-foreground">{item.value}d</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Comparativo entre Turnos & Ranking de Ausências */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Comparativo de Turnos */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4">
          <h4 className="font-bold text-sm text-foreground mb-1">Comparativo de Absenteísmo por Turno</h4>
          <p className="text-[11px] text-muted-foreground mb-4">{MONTHS_NAMES[selectedMonth - 1]} de {year}</p>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoComparison} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Taxa']}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '12px', border: 'none' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="taxaAbsenteismo" name="Absenteísmo Geral (%)" fill="#6366F1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="taxaAtestados" name="Atestados Médicos (%)" fill="#F43F5E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Ranking de Operadores com Ausências */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-foreground">Acompanhamento de Ausências no Mês</h4>
              <p className="text-[11px] text-muted-foreground">Operadores com ocorrências de faltas e atestados</p>
            </div>
            <Badge variant="secondary" className="text-xs font-bold font-mono">
              {operatorsRanking.length} colaborador(es)
            </Badge>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {operatorsRanking.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs font-medium">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                Parabéns! 100% de presença e sem ocorrências no mês selecionado.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {operatorsRanking.map((item) => (
                  <li key={item.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground">{item.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.cargo} • Turno {item.turno} • Turma {item.letra}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.atestados > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          {item.atestados}d Atestado
                        </span>
                      )}
                      {item.faltas > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300">
                          {item.faltas}d Falta
                        </span>
                      )}
                      <span className="font-mono font-black text-xs text-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        Total: {item.totalDias}d
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
