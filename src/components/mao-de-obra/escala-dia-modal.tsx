"use client";

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Operator,
  LaborOccurrence,
  ProductionTurno,
  LaborOccurrenceType,
  OperatorTurma,
} from '@/types';
import { getEscalaForDate, TURMAS_INFO } from '@/lib/escala-helpers';
import { getDailyPresenceSummary } from '@/lib/labor-helpers';
import {
  Calendar,
  Clock,
  Users,
  Palmtree,
  AlertTriangle,
  Stethoscope,
  CalendarDays,
  Flame,
  Plus,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  XCircle,
  FileText,
  Zap,
  Briefcase,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EscalaDiaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string | null;
  operators: Operator[];
  occurrences: LaborOccurrence[];
  selectedTurno: ProductionTurno | 'ALL';
  onOpenOcorrencia?: (operator?: Operator, type?: LaborOccurrenceType, date?: string) => void;
  onNavigateToQuadro?: (dateStr: string) => void;
}

export function EscalaDiaModal({
  open,
  onOpenChange,
  dateStr,
  operators,
  occurrences,
  selectedTurno,
  onOpenOcorrencia,
  onNavigateToQuadro,
}: EscalaDiaModalProps) {
  const [modalTab, setModalTab] = useState<'ausencias' | 'escalados' | 'folga_escala'>('ausencias');
  const [selectedTurnoFilter, setSelectedTurnoFilter] = useState<'ALL' | ProductionTurno>('ALL');

  const escalaDia = useMemo(() => {
    if (!dateStr) return null;
    return getEscalaForDate(dateStr);
  }, [dateStr]);

  const filteredOperators = useMemo(() => {
    return operators.filter((op) => {
      if (selectedTurno !== 'ALL' && op.turno !== selectedTurno) return false;
      if (selectedTurnoFilter !== 'ALL' && op.turno !== selectedTurnoFilter) return false;
      return true;
    });
  }, [operators, selectedTurno, selectedTurnoFilter]);

  const summary = useMemo(() => {
    if (!dateStr) return null;
    return getDailyPresenceSummary(dateStr, filteredOperators, occurrences);
  }, [dateStr, filteredOperators, occurrences]);

  // Lista de ocorrências ativas na data selecionada
  const activeOccurrencesOnDate = useMemo(() => {
    if (!dateStr) return [];
    return occurrences.filter((occ) => {
      const matchDate = dateStr >= occ.dataInicio && dateStr <= (occ.dataFim || occ.dataInicio);
      if (!matchDate) return false;
      const op = operators.find((o) => o.id === occ.operadorId);
      if (selectedTurno !== 'ALL' && op && op.turno !== selectedTurno) return false;
      if (selectedTurnoFilter !== 'ALL' && op && op.turno !== selectedTurnoFilter) return false;
      return true;
    });
  }, [dateStr, occurrences, operators, selectedTurno, selectedTurnoFilter]);

  if (!dateStr || !escalaDia || !summary) return null;

  const turmaFolga = escalaDia.turma_escalada;
  const turmaFolgaInfo = TURMAS_INFO[turmaFolga];
  const turmasTrabalhando: OperatorTurma[] = (['A', 'B', 'C', 'D'] as OperatorTurma[]).filter(
    (t) => t !== turmaFolga
  );

  // Formatação de data
  const dateObj = new Date(dateStr + 'T12:00:00Z');
  const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
  const formattedFullDate = dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const feriasList = summary.operadoresStatus.filter((item) => item.statusHoje === 'ferias');
  const folgaFlexivelList = summary.operadoresStatus.filter((item) => item.statusHoje === 'folga_flexivel');
  const ausentesList = summary.operadoresStatus.filter(
    (item) => item.statusHoje !== 'presente' && item.statusHoje !== 'folga_escala' && item.statusHoje !== 'inativo'
  );

  const escaladosList = summary.operadoresStatus.filter((item) => item.escaladoNaEscala);
  const folgaEscalaList = summary.operadoresStatus.filter((item) => item.statusHoje === 'folga_escala');

  const taxaCobertura = summary.escalados > 0
    ? Math.round((summary.presentes / summary.escalados) * 100)
    : 100;

  const getOccurrenceBadge = (type: LaborOccurrenceType) => {
    switch (type) {
      case 'ferias':
        return {
          label: 'Férias',
          icon: Palmtree,
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
        };
      case 'falta_injustificada':
        return {
          label: 'Falta Injustificada',
          icon: AlertTriangle,
          className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
        };
      case 'falta_justificada':
        return {
          label: 'Falta Justificada',
          icon: FileText,
          className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        };
      case 'atestado':
        return {
          label: 'Atestado Médico',
          icon: Stethoscope,
          className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        };
      case 'folga_flexivel':
        return {
          label: 'Folga Flexível',
          icon: CalendarDays,
          className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
        };
      case 'hora_extra':
        return {
          label: 'Plantão / Cobertura',
          icon: Zap,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        };
      default:
        return {
          label: 'Ausente',
          icon: Clock,
          className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header com Informações da Data */}
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-slate-900 dark:to-slate-900/60 rounded-t-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-foreground capitalize">
                  {dayOfWeek}
                </span>
                {escalaDia.e_feriado && (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1 shadow-xs animate-pulse">
                    <Flame className="w-3.5 h-3.5" />
                    {escalaDia.feriado_nome} ({escalaDia.feriado_tipo})
                  </Badge>
                )}
              </div>
              <p className="text-sm font-semibold text-muted-foreground mt-0.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {formattedFullDate}
                <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                  Ciclo {escalaDia.dia_ciclo_28}/28
                </span>
              </p>
            </div>

            {/* Turma de Folga & Turmas em Trabalho */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Folga da Escala
                </p>
                <p className="text-xs font-black" style={{ color: turmaFolgaInfo.cor }}>
                  Turma {turmaFolga}
                </p>
              </div>
              <div
                className="w-9 h-9 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-xs"
                style={{ backgroundColor: turmaFolgaInfo.cor }}
              >
                {turmaFolga}
              </div>
            </div>
          </div>

          {/* Turmas que Trabalham Hoje */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="font-bold text-muted-foreground">Turmas em Trabalho:</span>
            <div className="flex items-center gap-1.5">
              {turmasTrabalhando.map((t) => {
                const info = TURMAS_INFO[t];
                return (
                  <Badge
                    key={t}
                    variant="outline"
                    className="font-bold text-[11px] px-2 py-0.5 gap-1 shadow-2xs"
                    style={{ borderColor: `${info.cor}60`, color: info.cor, backgroundColor: `${info.cor}10` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info.cor }} />
                    Turma {t}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resumo de Indicadores Rápidos */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold">Escalados</span>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-black text-foreground mt-1">{summary.escalados}</p>
              <p className="text-[10px] text-muted-foreground">p/ trabalhar</p>
            </div>

            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                <span className="text-xs font-bold">Presentes</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">
                {summary.presentes}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                {taxaCobertura}% cobertura
              </p>
            </div>

            <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-2xs">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300">
                <span className="text-xs font-bold">Em Férias</span>
                <Palmtree className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-black text-indigo-800 dark:text-indigo-200 mt-1">
                {feriasList.length}
              </p>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                regulamentar
              </p>
            </div>

            <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20 shadow-2xs">
              <div className="flex items-center justify-between text-sky-700 dark:text-sky-300">
                <span className="text-xs font-bold">Folga Flex.</span>
                <CalendarDays className="w-4 h-4 text-sky-500" />
              </div>
              <p className="text-2xl font-black text-sky-800 dark:text-sky-200 mt-1">
                {folgaFlexivelList.length}
              </p>
              <p className="text-[10px] text-sky-600 dark:text-sky-400">
                gozo no dia
              </p>
            </div>

            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                <span className="text-xs font-bold">Ausências</span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-black text-rose-800 dark:text-rose-200 mt-1">
                {summary.ausentes - summary.ferias}
              </p>
              <p className="text-[10px] text-rose-600 dark:text-rose-400">
                faltas/atestados
              </p>
            </div>
          </div>

          {/* Seletor de Turno + Abas Internas */}
          <Tabs value={modalTab} onValueChange={(v: any) => setModalTab(v)}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                  <TabsTrigger
                    value="ausencias"
                    className="text-xs font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    Férias & Ausências ({ausentesList.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="escalados"
                    className="text-xs font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    Escalados ({escaladosList.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="folga_escala"
                    className="text-xs font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-purple-500" />
                    Folga de Escala ({folgaEscalaList.length})
                  </TabsTrigger>
                </TabsList>

                {/* Seletor Rápido de Turno dentro do Modal (se Admin ou ALL) */}
                {selectedTurno === 'ALL' && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 text-[11px] font-bold">
                    <span className="text-muted-foreground px-1">Turno:</span>
                    {(['ALL', 1, 2, 3] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTurnoFilter(t)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors",
                          selectedTurnoFilter === t
                            ? "bg-primary text-white"
                            : "text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800"
                        )}
                      >
                        {t === 'ALL' ? 'Todos' : `T${t}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão de Lançar Ocorrência nesta Data */}
              {onOpenOcorrencia && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenOcorrencia(undefined, undefined, dateStr)}
                  className="h-8 gap-1.5 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-primary/50 text-primary"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Lançar Ocorrência nesta Data
                </Button>
              )}
            </div>

            {/* Conteúdo: Ausências */}
            <TabsContent value="ausencias" className="pt-3 space-y-2">
              {ausentesList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold text-foreground">100% de Presença Prevista!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nenhum colaborador com férias, falta ou atestado registrado para esta data.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {ausentesList.map((item) => {
                    const op = item.operator;
                    const occ = item.ocorrenciaHoje;
                    const badge = occ ? getOccurrenceBadge(occ.tipo) : getOccurrenceBadge('falta_injustificada');
                    const BadgeIcon = badge.icon;
                    const turmaInfo = TURMAS_INFO[op.letra];

                    return (
                      <div
                        key={op.id}
                        className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-start justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-8 h-8 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 mt-0.5"
                            style={{ backgroundColor: turmaInfo.cor }}
                          >
                            {op.letra}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground">{op.nome}</span>
                              <span className="text-xs font-mono text-muted-foreground">({op.matricula})</span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] font-bold px-2 py-0.5 gap-1", badge.className)}
                              >
                                <BadgeIcon className="w-3 h-3" />
                                {badge.label}
                              </Badge>
                            </div>

                            <p className="text-xs text-muted-foreground mt-0.5">
                              {op.cargo} • Turno {op.turno}
                            </p>

                            {occ && (
                              <div className="mt-1.5 text-xs bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 text-muted-foreground space-y-0.5">
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="font-semibold text-foreground">Período:</span>
                                  <span>
                                    {occ.dataInicio.split('-').reverse().join('/')} até{' '}
                                    {occ.dataFim.split('-').reverse().join('/')} ({occ.dias} dia{occ.dias > 1 ? 's' : ''})
                                  </span>
                                </div>
                                {occ.motivo && (
                                  <div className="text-[11px]">
                                    <span className="font-semibold text-foreground">Motivo:</span> {occ.motivo}
                                  </div>
                                )}
                                {occ.cid && (
                                  <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                                    <span className="font-semibold text-foreground">CID:</span> {occ.cid}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {onOpenOcorrencia && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenOcorrencia(op, occ?.tipo || 'falta_injustificada', dateStr)}
                            className="h-8 text-xs font-semibold shrink-0"
                          >
                            Editar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Conteúdo: Escalados */}
            <TabsContent value="escalados" className="pt-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                {escaladosList.map((item) => {
                  const op = item.operator;
                  const isPresente = item.statusHoje === 'presente';
                  const turmaInfo = TURMAS_INFO[op.letra];

                  return (
                    <div
                      key={op.id}
                      className={cn(
                        "p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all",
                        isPresente
                          ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
                          : "bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs"
                          style={{ backgroundColor: turmaInfo.cor }}
                        >
                          {op.letra}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{op.nome}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {op.cargo} • T{op.turno}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isPresente ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Presente
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold">
                            Ausente
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Conteúdo: Folga de Escala */}
            <TabsContent value="folga_escala" className="pt-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                {folgaEscalaList.map((item) => {
                  const op = item.operator;
                  return (
                    <div
                      key={op.id}
                      className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs"
                          style={{ backgroundColor: turmaFolgaInfo.cor }}
                        >
                          {op.letra}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{op.nome}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {op.cargo} • Turno {op.turno}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">
                        Folga Programada
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          {onNavigateToQuadro && (
            <Button
              variant="default"
              onClick={() => {
                onOpenChange(false);
                onNavigateToQuadro(dateStr);
              }}
              className="gap-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Briefcase className="w-4 h-4" />
              Abrir no Quadro Diário
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold rounded-xl"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
