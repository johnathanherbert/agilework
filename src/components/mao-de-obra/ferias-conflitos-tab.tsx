"use client";

import { useMemo, useState } from 'react';
import {
  Operator,
  LaborOccurrence,
  ProductionTurno,
  VacationConflict,
} from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { detectVacationConflicts } from '@/lib/labor-helpers';
import { Card, CardContent } from '@/components/ui/card';
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
  Palmtree,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Plus,
  Search,
  Users,
  Clock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeriasConflitosTabProps {
  operators: Operator[];
  occurrences: LaborOccurrence[];
  selectedTurno: ProductionTurno | 'ALL';
  onOpenNovaFerias: (operator?: Operator) => void;
}

const MONTHS_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function FeriasConflitosTab({
  operators,
  occurrences,
  selectedTurno,
  onOpenNovaFerias,
}: FeriasConflitosTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');

  // Filtra operadores pelo turno
  const filteredOperators = useMemo(() => {
    return operators.filter((op) => {
      if (selectedTurno !== 'ALL' && op.turno !== selectedTurno) return false;
      return op.status !== 'inativo';
    });
  }, [operators, selectedTurno]);

  // Todas as ocorrências de férias do turno
  const vacationOccurrences = useMemo(() => {
    return occurrences.filter((occ) => {
      if (occ.tipo !== 'ferias') return false;
      if (selectedTurno !== 'ALL' && occ.turno !== selectedTurno) return false;
      return true;
    });
  }, [occurrences, selectedTurno]);

  // Detecção de Conflitos
  const conflicts: VacationConflict[] = useMemo(() => {
    return detectVacationConflicts(filteredOperators, vacationOccurrences);
  }, [filteredOperators, vacationOccurrences]);

  // Programação de férias filtrada por busca e mês
  const filteredVacations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return vacationOccurrences.filter((vac) => {
      if (query) {
        const matchName = vac.operadorNome.toLowerCase().includes(query);
        const matchCargo = vac.operadorCargo.toLowerCase().includes(query);
        if (!matchName && !matchCargo) return false;
      }

      if (selectedMonth !== 'ALL') {
        const monthStr = `2026-${String(selectedMonth).padStart(2, '0')}`;
        if (!vac.dataInicio.startsWith(monthStr) && !vac.dataFim.startsWith(monthStr)) {
          return false;
        }
      }

      return true;
    });
  }, [vacationOccurrences, searchQuery, selectedMonth]);

  // Status da férias (Em andamento / Agendada / Concluída)
  const getVacationStatus = (start: string, end: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (today >= start && today <= end) {
      return { label: 'Em Andamento', class: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    }
    if (today < start) {
      return { label: 'Programada / Futura', class: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    }
    return { label: 'Concluída', class: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-300' };
  };

  return (
    <div className="space-y-4">
      {/* Alerta de Detecção de Conflitos de Férias */}
      {conflicts.length > 0 ? (
        <Card className="rounded-2xl border-2 border-red-300 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-red-900 dark:text-red-300">
                  Atenção: {conflicts.length} Conflito(s) de Férias Detectado(s)!
                </h3>
                <p className="text-xs text-red-800/90 dark:text-red-300/80 mt-1 max-w-2xl">
                  O sistema identificou sobreposição de períodos de férias entre operadores com o mesmo cargo ou mesma turma, o que pode gerar desfalques operacionais na linha.
                </p>
              </div>
            </div>

            <Badge variant="destructive" className="font-bold text-xs uppercase px-3 py-1 shrink-0">
              Risco Operacional
            </Badge>
          </div>

          <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-2.5">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-red-200 dark:border-red-900/50 shadow-2xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "text-[10px] font-black uppercase",
                        conflict.severidade === 'alta'
                          ? "bg-red-600 text-white"
                          : "bg-amber-600 text-white"
                      )}
                    >
                      {conflict.severidade === 'alta' ? 'Severidade Alta' : 'Severidade Média'}
                    </Badge>
                    <span className="font-bold text-sm text-foreground">{conflict.titulo}</span>
                  </div>

                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    Período Conflitante: {new Date(conflict.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} até{' '}
                    {new Date(conflict.dataFim + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300">{conflict.descricao}</p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Operadores Envolvidos:</span>
                  {conflict.operadores.map((op) => {
                    const tInfo = TURMAS_INFO[op.letra];
                    return (
                      <span
                        key={op.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-foreground border border-slate-200 dark:border-slate-700"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tInfo.cor }}
                        />
                        {op.nome} ({op.cargo} - Turma {op.letra})
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                Nenhum Conflito de Férias Detectado
              </h4>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-400/80">
                A escala de férias está equilibrada sem sobreposição de cargos críticos no turno selecionado.
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/30">
            Escala OK
          </Badge>
        </Card>
      )}

      {/* Programação Anual de Férias */}
      <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="font-bold text-foreground text-base">Programação Anual de Férias 2026</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Planejamento e acompanhamento de férias dos operadores de produção.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Busca */}
            <div className="relative min-w-[180px]">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por operador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-white dark:bg-slate-950 rounded-lg"
              />
            </div>

            {/* Filtro de Mês */}
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(v === 'ALL' ? 'ALL' : Number(v))}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[130px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="ALL">Ano Inteiro (2026)</SelectItem>
                {MONTHS_NAMES.map((nome, idx) => (
                  <SelectItem key={nome} value={String(idx + 1)}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Botão Programar Férias */}
            <Button
              size="sm"
              onClick={() => onOpenNovaFerias()}
              className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Programar Férias
            </Button>
          </div>
        </div>

        {/* Tabela de Férias */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/70 dark:bg-slate-900/80 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3 text-center">Turma</th>
                <th className="px-4 py-3 text-center">Turno</th>
                <th className="px-4 py-3">Período de Férias</th>
                <th className="px-4 py-3 text-center">Duração</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredVacations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    Nenhuma programação de férias encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredVacations.map((vac) => {
                  const turmaInfo = TURMAS_INFO[vac.operadorLetra];
                  const statusObj = getVacationStatus(vac.dataInicio, vac.dataFim);

                  return (
                    <tr key={vac.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                      {/* Operador */}
                      <td className="px-4 py-3 font-bold text-foreground">
                        {vac.operadorNome}
                      </td>

                      {/* Cargo */}
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {vac.operadorCargo}
                      </td>

                      {/* Turma */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-white font-black text-xs shadow-2xs"
                          style={{ backgroundColor: turmaInfo.cor }}
                        >
                          {vac.operadorLetra}
                        </span>
                      </td>

                      {/* Turno */}
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="font-mono text-[11px] font-bold">
                          T{vac.turno}
                        </Badge>
                      </td>

                      {/* Período */}
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {new Date(vac.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} até{' '}
                        {new Date(vac.dataFim + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                      </td>

                      {/* Duração */}
                      <td className="px-4 py-3 text-center font-mono font-bold">
                        {vac.dias} dias
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <Badge className={cn("text-[10px] font-bold", statusObj.class)}>
                          {statusObj.label}
                        </Badge>
                      </td>

                      {/* Observações */}
                      <td className="px-4 py-3 text-muted-foreground text-[11px]">
                        {vac.motivo || 'Férias regulares'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
