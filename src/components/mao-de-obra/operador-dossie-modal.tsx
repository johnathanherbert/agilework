"use client";

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  LaborOccurrence,
  Operator,
  LaborOccurrenceType,
} from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import {
  TRATATIVA_STATUS_META,
  TRATATIVA_ACTION_META,
  TratativaModal,
} from './tratativa-modal';
import {
  User,
  Calendar,
  AlertTriangle,
  FileText,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle2,
  CalendarDays,
  Flame,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';

interface OperadorDossieModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operator: Operator | null;
  occurrences: LaborOccurrence[];
}

export function OperadorDossieModal({
  open,
  onOpenChange,
  operator,
  occurrences,
}: OperadorDossieModalProps) {
  const { userData } = useFirebase();
  const isSupervisorOrAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin' || userData?.role === 'supervisor';
  const [selectedOccForTratativa, setSelectedOccForTratativa] = useState<LaborOccurrence | null>(null);

  const opOccurrences = useMemo(() => {
    if (!operator) return [];
    return occurrences
      .filter((o) => o.operadorId === operator.id || o.operadorNome.toLowerCase() === operator.nome.toLowerCase())
      .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
  }, [operator, occurrences]);

  // Estatísticas do operador
  const stats = useMemo(() => {
    const faltasInj = opOccurrences.filter((o) => o.tipo === 'falta_injustificada');
    const atestados = opOccurrences.filter((o) => o.tipo === 'atestado');
    const atrasos = opOccurrences.filter((o) => o.tipo === 'atraso');
    const tratadas = opOccurrences.filter((o) => o.tratativaStatus === 'concluido' || Boolean(o.obsSupervisao?.trim()));
    const pendentes = opOccurrences.filter((o) => o.tratativaStatus === 'pendente' || (!o.obsSupervisao?.trim() && o.tratativaStatus !== 'concluido'));

    const diasPerdidos = opOccurrences
      .filter((o) => o.impactaAbsenteismo)
      .reduce((acc, curr) => acc + (curr.dias || 1), 0);

    // Contagem por dia da semana para identificar padrão de ausências (ex: faltas nas segundas e sextas)
    const diasSemanaCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    opOccurrences.forEach((o) => {
      const d = new Date(o.dataInicio + 'T12:00:00Z');
      const day = d.getDay();
      diasSemanaCount[day] = (diasSemanaCount[day] || 0) + 1;
    });

    return {
      total: opOccurrences.length,
      faltasInjCount: faltasInj.length,
      atestadosCount: atestados.length,
      atrasosCount: atrasos.length,
      tratadasCount: tratadas.length,
      pendentesCount: pendentes.length,
      diasPerdidos,
      diasSemanaCount,
    };
  }, [opOccurrences]);

  if (!operator) return null;

  const turmaInfo = TURMAS_INFO[operator.letra] || TURMAS_INFO.A;
  const diasSemanaNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Impressão / Exportação formal do dossiê
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header do Dossiê */}
          <div className="px-6 py-4 border-b border-border bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl text-white font-black text-base flex items-center justify-center shadow-lg border-2 border-white/20 shrink-0"
                style={{ backgroundColor: turmaInfo.cor }}
              >
                {operator.letra}
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                  <span>{operator.nome}</span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold border border-slate-700">
                    Matrícula: {operator.matricula || 'N/A'}
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-400 font-medium">
                  {operator.cargo} · Turno {operator.turno} · Turma {operator.letra} · Saldo Folgas: {operator.saldoFolgasFlexiveis}d
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs font-bold gap-1.5 bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Cards de Métricas do Colaborador */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
                <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 tracking-wider">
                  Faltas Injustificadas
                </span>
                <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">
                  {stats.faltasInjCount}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
                <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                  Atestados Médicos
                </span>
                <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
                  {stats.atestadosCount}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                  Dias Perdidos Totais
                </span>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                  {stats.diasPerdidos}d
                </p>
              </div>

              {isSupervisorOrAdmin ? (
                <div className="p-3.5 rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20">
                  <span className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-400 tracking-wider">
                    Casos Pendentes
                  </span>
                  <p className="text-2xl font-black text-violet-700 dark:text-violet-300 mt-1">
                    {stats.pendentesCount}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Total Registros
                  </span>
                  <p className="text-2xl font-black text-foreground mt-1">
                    {stats.total}
                  </p>
                </div>
              )}
            </div>

            {/* Padrão por Dia da Semana (Heatmap semanal simples) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  Padrão de Ocorrências por Dia da Semana
                </h4>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Ajuda a identificar faltas recorrentes em fins de semana / pontes
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 pt-1">
                {diasSemanaNomes.map((nome, dayIdx) => {
                  const count = stats.diasSemanaCount[dayIdx] || 0;
                  const isHigh = count >= 3;
                  const isMed = count > 0 && count < 3;

                  return (
                    <div
                      key={nome}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all',
                        isHigh
                          ? 'bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-800'
                          : isMed
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      )}
                    >
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{nome}</p>
                      <p
                        className={cn(
                          'text-base font-black mt-0.5',
                          isHigh ? 'text-red-700 dark:text-red-400' : isMed ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'
                        )}
                      >
                        {count}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Linha do Tempo de Ocorrências */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-600" />
                  Histórico de Casos ({opOccurrences.length})
                </h4>
              </div>

              {opOccurrences.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">Nenhuma ocorrência registrada para este colaborador.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  {opOccurrences.map((occ) => {
                    const statusMeta = TRATATIVA_STATUS_META[occ.tratativaStatus || 'pendente'] || TRATATIVA_STATUS_META.pendente;
                    const passos = occ.tratativaPassos || [];

                    return (
                      <div
                        key={occ.id}
                        className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-black text-xs text-foreground uppercase">
                              {occ.tipo.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              em {new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} ({occ.dias}d)
                            </span>
                            {occ.impactaAbsenteismo ? (
                              <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded-full">
                                Absenteísmo
                              </span>
                            ) : null}
                          </div>

                          {isSupervisorOrAdmin && (
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-black',
                                  statusMeta.bg,
                                  statusMeta.text,
                                  statusMeta.border
                                )}
                              >
                                {statusMeta.icon}
                                {statusMeta.label}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedOccForTratativa(occ)}
                                className="h-7 text-xs font-bold gap-1 px-2.5"
                              >
                                Tratar Caso
                                <ChevronRight className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Detalhes do motivo/queixa */}
                        {(occ.queixas || occ.motivo) && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60">
                            <span className="font-bold text-foreground">Relato: </span>
                            {occ.queixas || occ.motivo}
                          </p>
                        )}

                        {/* Tratativa / Ações da Supervisão (Apenas Supervisão e Admin) */}
                        {isSupervisorOrAdmin && occ.obsSupervisao && (
                          <div className="p-3 rounded-lg bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 text-xs">
                            <p className="text-violet-950 dark:text-violet-200 font-medium leading-relaxed">
                              <span className="font-bold text-violet-700 dark:text-violet-400">Tratativa: </span>
                              {occ.obsSupervisao}
                            </p>
                            {occ.obsSupervisaoUpdatedBy && (
                              <p className="text-[10px] text-violet-500 mt-1">
                                Registrado por {occ.obsSupervisaoUpdatedBy}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Resumo dos passos (Apenas Supervisão e Admin) */}
                        {isSupervisorOrAdmin && passos.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Ações tomadas:</span>
                            {passos.map((p, idx) => {
                              const actionMeta = TRATATIVA_ACTION_META[p.tipoAcao] || TRATATIVA_ACTION_META.outro;
                              return (
                                <span
                                  key={p.id || idx}
                                  className={cn(
                                    'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border',
                                    actionMeta.badgeBg,
                                    actionMeta.color
                                  )}
                                >
                                  {actionMeta.icon}
                                  {actionMeta.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Tratativa Individual (Apenas Supervisão e Admin) */}
      {isSupervisorOrAdmin && (
        <TratativaModal
          open={Boolean(selectedOccForTratativa)}
          onOpenChange={(open) => !open && setSelectedOccForTratativa(null)}
          occurrence={selectedOccForTratativa}
          allOccurrencesForOperator={opOccurrences}
        />
      )}
    </>
  );
}
