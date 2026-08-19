"use client";

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LaborOccurrence } from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { updateOccurrenceSupervisaoObs } from '@/lib/labor-helpers';
import { OcorrenciaEditModal } from './ocorrencia-edit-modal';
import {
  CalendarDays,
  AlertTriangle,
  Stethoscope,
  Palmtree,
  FileText,
  Zap,
  Clock,
  User,
  Briefcase,
  FileSearch,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Pencil,
  Save,
  X,
  MessageSquareDashed,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';

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
  atraso: {
    label: 'Atraso',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-900/50',
    icon: <Clock className="w-4 h-4" />,
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
  const { userData } = useFirebase();
  const isSupervisorOrAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin' || userData?.role === 'supervisor';
  const [editingObs, setEditingObs] = useState(false);
  const [obsValue, setObsValue] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (occurrence) {
      setObsValue(occurrence.obsSupervisao || '');
    }
    setEditingObs(false);
  }, [occurrence]);

  if (!occurrence) return null;

  const meta = OCC_META[occurrence.tipo] || OCC_META.falta_injustificada;
  const turmaInfo = TURMAS_INFO[occurrence.operadorLetra];
  const isFolga = occurrence.tipo === 'folga_flexivel';
  const isCredito = isFolga && occurrence.tipoFolgaFlexivel === 'concessao';
  const isSingleDay = occurrence.dataInicio === occurrence.dataFim;

  const handleSaveObs = async () => {
    setSavingObs(true);
    try {
      await updateOccurrenceSupervisaoObs(occurrence.id, obsValue);
      toast.success('Observações da supervisão salvas.');
      setEditingObs(false);
    } catch {
      toast.error('Erro ao salvar observações.');
    } finally {
      setSavingObs(false);
    }
  };

  const handleCancelObs = () => {
    setObsValue(occurrence.obsSupervisao || '');
    setEditingObs(false);
  };

  // Queixas: campo novo ou fallback para CID retroativo
  const queixasText = occurrence.queixas || (occurrence.cid ? `CID: ${occurrence.cid}` : '');

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header colorido conforme tipo */}
        <div className={cn('p-5 border-b', meta.bg, meta.border)}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
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

              {/* Botão Editar com espaçamento seguro em relação ao botão de fechar (X) */}
              <div className="mr-8">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 shadow-2xs hover:scale-105',
                    meta.color,
                    'hover:opacity-90 border',
                    meta.border,
                    'bg-white/80 dark:bg-black/40'
                  )}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar
                </button>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
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

            {/* Minutos de atraso */}
            {occurrence.minutosAtraso != null && occurrence.minutosAtraso > 0 && (
              <div className="p-3 rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-wider">Duração do Atraso</span>
                </div>
                <p className="text-sm font-black text-orange-700 dark:text-orange-300">{occurrence.minutosAtraso} min</p>
              </div>
            )}

            {/* Queixas do operador (atestado) */}
            {queixasText && (
              <div className="col-span-2 p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                    Queixas / Motivo do Atestado
                  </span>
                </div>
                <p className="text-sm text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                  {queixasText}
                </p>
              </div>
            )}
          </div>

          {/* Motivo / Observações do lançamento */}
          {occurrence.motivo ? (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Observações do Lançamento
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {occurrence.motivo}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-muted-foreground italic">Nenhuma observação de lançamento registrada.</p>
            </div>
          )}

          {/* ────── OBS DA SUPERVISÃO (Apenas Supervisão e Admin) ────── */}
          {isSupervisorOrAdmin && (
            <div className="rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20 overflow-hidden">
              {/* Cabeçalho da seção */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-violet-200/70 dark:border-violet-900/40">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    Tratativas da Supervisão
                  </span>
                </div>
                {!editingObs && (
                  <button
                    type="button"
                    onClick={() => setEditingObs(true)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors px-2.5 py-1 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/40"
                  >
                    <Pencil className="w-3 h-3" />
                    {obsValue ? 'Editar' : 'Adicionar'}
                  </button>
                )}
              </div>

              {/* Corpo */}
              <div className="p-4">
                {editingObs ? (
                  <div className="space-y-3">
                    <Textarea
                      value={obsValue}
                      onChange={(e) => setObsValue(e.target.value)}
                      placeholder="Registre aqui as tratativas, ações tomadas, conversa com o colaborador, encaminhamentos, prazos e qualquer informação relevante para a supervisão..."
                      rows={5}
                      className="text-sm resize-none border-violet-300 dark:border-violet-800 focus-visible:ring-violet-400 bg-white dark:bg-slate-900"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelObs}
                        disabled={savingObs}
                        className="h-8 text-xs gap-1.5 text-muted-foreground"
                      >
                        <X className="w-3 h-3" />
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveObs}
                        disabled={savingObs}
                        className="h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold"
                      >
                        <Save className="w-3 h-3" />
                        {savingObs ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                ) : obsValue ? (
                  <div>
                    <p className="text-sm text-violet-900 dark:text-violet-200 leading-relaxed whitespace-pre-wrap break-words">
                      {obsValue}
                    </p>
                    {occurrence.obsSupervisaoUpdatedAt && (
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-violet-200/60 dark:border-violet-900/40">
                        <Clock className="w-3 h-3 text-violet-400 shrink-0" />
                        <span className="text-[10px] text-violet-500 dark:text-violet-400">
                          Atualizado em {fmtDateTime(occurrence.obsSupervisaoUpdatedAt)}
                          {occurrence.obsSupervisaoUpdatedBy && (
                            <> · por <span className="font-semibold">{occurrence.obsSupervisaoUpdatedBy}</span></>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <MessageSquareDashed className="w-6 h-6 text-violet-300 dark:text-violet-700" />
                    <p className="text-xs text-violet-500 dark:text-violet-500 italic">
                      Nenhuma tratativa registrada pela supervisão.
                    </p>
                    <p className="text-[10px] text-violet-400 dark:text-violet-600">
                      Clique em "Adicionar" para registrar ações e encaminhamentos.
                    </p>
                  </div>
                )}
              </div>
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

        {/* Rodapé de Ações com botões claros e espaçados */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-bold rounded-xl"
          >
            Fechar
          </Button>

          <Button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="h-8 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Editar Ocorrência
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal de edição */}
    <OcorrenciaEditModal
      open={editModalOpen}
      onOpenChange={setEditModalOpen}
      occurrence={occurrence}
    />
    </>
  );
}
