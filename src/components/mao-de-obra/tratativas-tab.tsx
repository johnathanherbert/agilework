"use client";

import { useMemo, useState } from 'react';
import {
  LaborOccurrence,
  LaborOccurrenceType,
  ProductionTurno,
  Operator,
} from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { OcorrenciaDetalheModal } from './ocorrencia-detalhe-modal';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  Search,
  FileText,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  AlertTriangle,
  Stethoscope,
  CalendarDays,
  Palmtree,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const OCC_META: Record<LaborOccurrenceType, {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  icon: React.ReactNode;
}> = {
  falta_injustificada: {
    label: 'Falta Inj.',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900/60',
    dot: 'bg-red-500',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  falta_justificada: {
    label: 'Falta Just.',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900/60',
    dot: 'bg-amber-500',
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  atestado: {
    label: 'Atestado',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-900/60',
    dot: 'bg-rose-500',
    icon: <Stethoscope className="w-3.5 h-3.5" />,
  },
  folga_flexivel: {
    label: 'Folga Flex.',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-900/60',
    dot: 'bg-sky-500',
    icon: <CalendarDays className="w-3.5 h-3.5" />,
  },
  ferias: {
    label: 'Férias',
    color: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-900/60',
    dot: 'bg-indigo-500',
    icon: <Palmtree className="w-3.5 h-3.5" />,
  },
  hora_extra: {
    label: 'H. Extra',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900/60',
    dot: 'bg-emerald-500',
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  atraso: {
    label: 'Atraso',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-900/60',
    dot: 'bg-orange-500',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

interface TratativasTabProps {
  occurrences: LaborOccurrence[];
  operators: Operator[];
  selectedTurno: ProductionTurno | 'ALL';
}

export function TratativasTab({
  occurrences,
  operators,
  selectedTurno,
}: TratativasTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LaborOccurrenceType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'com_tratativa' | 'sem_tratativa' | 'todos'>('com_tratativa');
  const [occToView, setOccToView] = useState<LaborOccurrence | null>(null);

  // Estatísticas de tratativas
  const stats = useMemo(() => {
    const relevant = occurrences.filter((o) => selectedTurno === 'ALL' || o.turno === selectedTurno);
    const comTratativa = relevant.filter((o) => Boolean(o.obsSupervisao?.trim()));
    const semTratativa = relevant.filter((o) => !o.obsSupervisao?.trim());
    const pct = relevant.length > 0 ? Math.round((comTratativa.length / relevant.length) * 100) : 0;

    return {
      total: relevant.length,
      comTratativa: comTratativa.length,
      semTratativa: semTratativa.length,
      pct,
    };
  }, [occurrences, selectedTurno]);

  const filteredOccurrences = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return occurrences
      .filter((occ) => {
        if (selectedTurno !== 'ALL' && occ.turno !== selectedTurno) return false;
        if (typeFilter !== 'ALL' && occ.tipo !== typeFilter) return false;

        const hasTratativa = Boolean(occ.obsSupervisao?.trim());
        if (statusFilter === 'com_tratativa' && !hasTratativa) return false;
        if (statusFilter === 'sem_tratativa' && hasTratativa) return false;

        if (query) {
          return (
            occ.operadorNome.toLowerCase().includes(query) ||
            (occ.obsSupervisao || '').toLowerCase().includes(query) ||
            (occ.motivo || '').toLowerCase().includes(query) ||
            (occ.queixas || '').toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.obsSupervisaoUpdatedAt || a.dataInicio;
        const dateB = b.obsSupervisaoUpdatedAt || b.dataInicio;
        return dateB.localeCompare(dateA);
      });
  }, [occurrences, selectedTurno, typeFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Cards de Sumário de Tratativas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 border border-violet-200 dark:border-violet-900/40 bg-violet-50/60 dark:bg-violet-950/20 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <p className="text-[10px] uppercase font-bold tracking-wider text-violet-700 dark:text-violet-300">
                Tratadas pela Supervisão
              </p>
            </div>
            <span className="text-xs font-black text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/60 px-2 py-0.5 rounded-full">
              {stats.pct}%
            </span>
          </div>
          <p className="text-3xl font-black tabular-nums text-violet-700 dark:text-violet-300">
            {stats.comTratativa}
          </p>
        </div>

        <div className="rounded-2xl p-4 border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 shadow-xs">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300">
              Pendente de Tratativa
            </p>
          </div>
          <p className="text-3xl font-black tabular-nums text-amber-700 dark:text-amber-300">
            {stats.semTratativa}
          </p>
        </div>

        <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Total de Ocorrências
            </p>
          </div>
          <p className="text-3xl font-black tabular-nums text-foreground">
            {stats.total}
          </p>
        </div>
      </div>

      {/* Tabela de Tratativas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-black text-foreground">
              Análise de Tratativas da Supervisão
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-[10px] font-black text-violet-700 dark:text-violet-300">
                {filteredOccurrences.length}
              </span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por operador ou tratativa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[190px]"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="com_tratativa">Com Tratativa</SelectItem>
                <SelectItem value="sem_tratativa">Sem Tratativa</SelectItem>
                <SelectItem value="todos">Todas Ocorrências</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                <SelectItem value="falta_injustificada">Falta Injustificada</SelectItem>
                <SelectItem value="atestado">Atestado</SelectItem>
                <SelectItem value="falta_justificada">Falta Justificada</SelectItem>
                <SelectItem value="folga_flexivel">Folga Flexível</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="atraso">Atraso</SelectItem>
                <SelectItem value="hora_extra">Hora Extra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de Tratativas */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {filteredOccurrences.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Nenhuma tratativa encontrada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros de busca acima.</p>
            </div>
          ) : (
            filteredOccurrences.map((occ) => {
              const meta = OCC_META[occ.tipo] || OCC_META.falta_injustificada;
              const turmaInfo = TURMAS_INFO[occ.operadorLetra];
              const hasTratativa = Boolean(occ.obsSupervisao?.trim());
              const dataInicioFmt = new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR');

              return (
                <div
                  key={occ.id}
                  onClick={() => setOccToView(occ)}
                  className="group p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Operador + Tipo */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: turmaInfo.cor }}
                      >
                        {occ.operadorLetra}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground truncate">{occ.operadorNome}</p>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0",
                            meta.color, meta.bg, meta.border
                          )}>
                            {meta.icon}
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {occ.operadorCargo} · Turno {occ.turno} · Data: {dataInicioFmt} ({occ.dias} {occ.dias === 1 ? 'dia' : 'dias'})
                        </p>
                      </div>
                    </div>

                    {/* Status badge + Seta */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasTratativa ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-[10px] font-bold border border-violet-200 dark:border-violet-800">
                          <ShieldCheck className="w-3 h-3" />
                          Tratado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="w-3 h-3" />
                          Pendente
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </div>

                  {/* Conteúdo da Tratativa */}
                  {hasTratativa ? (
                    <div className="p-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 text-xs space-y-1">
                      <p className="text-violet-950 dark:text-violet-200 font-medium leading-relaxed line-clamp-2">
                        {occ.obsSupervisao}
                      </p>
                      {occ.obsSupervisaoUpdatedBy && (
                        <p className="text-[10px] text-violet-500 dark:text-violet-400 flex items-center gap-1 pt-1">
                          <User className="w-3 h-3" />
                          <span>Supervisor: <span className="font-bold">{occ.obsSupervisaoUpdatedBy}</span></span>
                          {occ.obsSupervisaoUpdatedAt && (
                            <>
                              <span>·</span>
                              <Clock className="w-3 h-3 ml-1" />
                              <span>{new Date(occ.obsSupervisaoUpdatedAt).toLocaleDateString('pt-BR')}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-muted-foreground italic">
                      Nenhuma tratativa registrada ainda. Clique para adicionar tratativa da supervisão.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de Detalhes para ver/editar tratativa */}
      <OcorrenciaDetalheModal
        open={Boolean(occToView)}
        onOpenChange={(open) => !open && setOccToView(null)}
        occurrence={occToView}
      />
    </div>
  );
}
