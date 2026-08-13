"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LaborOccurrence } from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import {
  CalendarDays,
  AlertTriangle,
  Stethoscope,
  Palmtree,
  FileText,
  Zap,
  Clock,
  User,
  Hash,
  Briefcase,
  FileSearch,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

const OCC_META: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}> = {
  falta_injustificada: {
    label: 'Falta Injustificada',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-900/50',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  falta_justificada: {
    label: 'Falta Justificada',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900/50',
    icon: <FileText className="w-4 h-4" />,
  },
  atestado: {
    label: 'Atestado Médico',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-900/50',
    icon: <Stethoscope className="w-4 h-4" />,
  },
  folga_flexivel: {
    label: 'Folga Flexível',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-900/50',
    icon: <CalendarDays className="w-4 h-4" />,
  },
  ferias: {
    label: 'Férias',
    color: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-900/50',
    icon: <Palmtree className="w-4 h-4" />,
  },
  hora_extra: {
    label: 'Hora Extra / Cobertura',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-900/50',
    icon: <Zap className="w-4 h-4" />,
  },
};

function fmt(dateStr: string) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR');
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('pt-BR') +
    ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}

interface OcorrenciaDetalheModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: LaborOccurrence | null;
}

export function OcorrenciaDetalheModal({
  open,
  onOpenChange,
  occurrence,
}: OcorrenciaDetalheModalProps) {
  if (!occurrence) return null;

  const meta = OCC_META[occurrence.tipo] || OCC_META.falta_injustificada;
  const turmaInfo = TURMAS_INFO[occurrence.operadorLetra];
  const isFolga = occurrence.tipo === 'folga_flexivel';
  const isCredito = isFolga && occurrence.tipoFolgaFlexivel === 'concessao';
  const isSingleDay = occurrence.dataInicio === occurrence.dataFim;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header colorido conforme tipo */}
        <div className={cn('p-5 border-b', meta.bg, meta.border)}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs',
                  meta.bg,
                  meta.border,
                  meta.color
                )}
              >
                {meta.icon}
              </div>
              <div>
                <DialogTitle className={cn('text-base font-black', meta.color)}>
                  <span className="flex items-center gap-2">
                    {meta.label}
                    {isFolga && (
                      isCredito ? (
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-bold">Concessão</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs text-red-600 font-bold">Débito (Gozo)</span>
                        </span>
                      )
                    )}
                  </span>
                </DialogTitle>
                <p className={cn('text-xs mt-0.5 font-semibold opacity-75', meta.color)}>
                  Detalhe da Ocorrência
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Operador */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div
              className="w-10 h-10 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: turmaInfo.cor }}
            >
              {occurrence.operadorLetra}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-foreground">{occurrence.operadorNome}</p>
              <p className="text-xs text-muted-foreground">
                {occurrence.operadorCargo} · Turno {occurrence.turno} · Turma {occurrence.operadorLetra}
              </p>
            </div>
          </div>

          {/* Grid de campos */}
          <div className="grid grid-cols-2 gap-3">
            {/* Período */}
            <div className="col-span-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Período</span>
              </div>
              {isSingleDay ? (
                <p className="text-sm font-black text-foreground">{fmt(occurrence.dataInicio)}</p>
              ) : (
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Início</p>
                    <p className="text-xs font-black text-foreground">{fmtShort(occurrence.dataInicio)}</p>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Fim</p>
                    <p className="text-xs font-black text-foreground">{fmtShort(occurrence.dataFim)}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                {occurrence.dias} dia{occurrence.dias > 1 ? 's' : ''} de ocorrência
              </p>
            </div>

            {/* Impacta Absenteísmo */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Absenteísmo</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {occurrence.impactaAbsenteismo ? (
                  <CheckCircle className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
                <span
                  className={cn(
                    'text-xs font-bold',
                    occurrence.impactaAbsenteismo ? 'text-red-600' : 'text-emerald-600'
                  )}
                >
                  {occurrence.impactaAbsenteismo ? 'Impacta' : 'Não impacta'}
                </span>
              </div>
            </div>

            {/* Horas de impacto */}
            {occurrence.horasImpacto != null && (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Horas</span>
                </div>
                <p className="text-sm font-black text-foreground">{occurrence.horasImpacto}h</p>
              </div>
            )}

            {/* CID */}
            {occurrence.cid && (
              <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">CID</span>
                </div>
                <p className="text-sm font-black text-rose-700 dark:text-rose-300 font-mono">{occurrence.cid}</p>
              </div>
            )}
          </div>

          {/* Motivo / Observações — campo completo */}
          {occurrence.motivo ? (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Motivo / Observações
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {occurrence.motivo}
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-muted-foreground italic">Nenhuma observação registrada.</p>
            </div>
          )}

          {/* Metadados */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            {occurrence.created_by_name && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <User className="w-3 h-3 shrink-0" />
                <span>
                  Lançado por{' '}
                  <span className="font-semibold text-foreground">{occurrence.created_by_name}</span>
                </span>
              </div>
            )}
            {occurrence.created_at && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3 shrink-0" />
                <span>{fmtDateTime(occurrence.created_at)}</span>
              </div>
            )}
            {occurrence.updated_at && occurrence.updated_at !== occurrence.created_at && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <FileSearch className="w-3 h-3 shrink-0" />
                <span>Atualizado em {fmtDateTime(occurrence.updated_at)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Briefcase className="w-3 h-3 shrink-0" />
              <span className="font-mono opacity-50 text-[10px]">ID: {occurrence.id}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
