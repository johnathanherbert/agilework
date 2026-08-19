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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LaborOccurrence,
  TratativaActionStep,
  TratativaPriority,
  TratativaStatus,
} from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import {
  updateOccurrenceTratativa,
  addTratativaActionStep,
} from '@/lib/labor-helpers';
import {
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Plus,
  Send,
  Building2,
  Stethoscope,
  MessageSquare,
  AlertTriangle,
  FileWarning,
  CheckCircle2,
  CalendarDays,
  Flame,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const TRATATIVA_STATUS_META: Record<
  TratativaStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  pendente: {
    label: 'Pendente',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  },
  em_andamento: {
    label: 'Em Andamento',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />,
  },
  encaminhado_rh: {
    label: 'Encaminhado ao RH',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    icon: <Building2 className="w-3.5 h-3.5 text-purple-500" />,
  },
  encaminhado_medicina: {
    label: 'Encaminhado à Medicina',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    icon: <Stethoscope className="w-3.5 h-3.5 text-rose-500" />,
  },
  concluido: {
    label: 'Concluído / Resolvido',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  },
  arquivado: {
    label: 'Arquivado',
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />,
  },
};

export const TRATATIVA_ACTION_META: Record<
  TratativaActionStep['tipoAcao'],
  { label: string; icon: React.ReactNode; color: string; badgeBg: string }
> = {
  conversa_feedback: {
    label: 'Conversa & Feedback 1-a-1',
    icon: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />,
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-900',
  },
  orientacao_verbal: {
    label: 'Orientação Verbal Formal',
    icon: <FileWarning className="w-3.5 h-3.5 text-amber-500" />,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-900',
  },
  advertencia_escrita: {
    label: 'Advertência Escrita',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-900',
  },
  suspensao: {
    label: 'Suspensão Disciplinar',
    icon: <Flame className="w-3.5 h-3.5 text-rose-600" />,
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:border-rose-900',
  },
  encaminhamento_rh: {
    label: 'Encaminhamento ao RH',
    icon: <Building2 className="w-3.5 h-3.5 text-purple-500" />,
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-900',
  },
  encaminhamento_medicina: {
    label: 'Encaminhamento Médico / SESMT',
    icon: <Stethoscope className="w-3.5 h-3.5 text-rose-500" />,
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:border-rose-900',
  },
  reuniao_alinhamento: {
    label: 'Reunião de Alinhamento',
    icon: <User className="w-3.5 h-3.5 text-emerald-500" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-900',
  },
  outro: {
    label: 'Outra Medida / Registro',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />,
    color: 'text-slate-600 dark:text-slate-400',
    badgeBg: 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800',
  },
};

interface TratativaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: LaborOccurrence | null;
  allOccurrencesForOperator?: LaborOccurrence[];
}

export function TratativaModal({
  open,
  onOpenChange,
  occurrence,
  allOccurrencesForOperator = [],
}: TratativaModalProps) {
  const [obsGeral, setObsGeral] = useState('');
  const [status, setStatus] = useState<TratativaStatus>('pendente');
  const [priority, setPriority] = useState<TratativaPriority>('media');
  const [prazo, setPrazo] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Formulário do novo passo de ação
  const [novoPassoTipo, setNovoPassoTipo] = useState<TratativaActionStep['tipoAcao']>('conversa_feedback');
  const [novoPassoDesc, setNovoPassoDesc] = useState('');
  const [novoPassoPrazo, setNovoPassoPrazo] = useState('');
  const [novoPassoMudarStatus, setNovoPassoMudarStatus] = useState<TratativaStatus>('em_andamento');
  const [savingStep, setSavingStep] = useState(false);

  useEffect(() => {
    if (occurrence) {
      setObsGeral(occurrence.obsSupervisao || '');
      setStatus(occurrence.tratativaStatus || (occurrence.obsSupervisao?.trim() ? 'concluido' : 'pendente'));
      setPriority(occurrence.tratativaPriority || 'media');
      setPrazo(occurrence.prazoTratativa || '');
      setNovoPassoDesc('');
      setNovoPassoPrazo('');
    }
  }, [occurrence]);

  if (!occurrence) return null;

  const turmaInfo = TURMAS_INFO[occurrence.operadorLetra];
  const passos = occurrence.tratativaPassos || [];

  // Outras ocorrências do mesmo operador para histórico cruzado
  const historicoCruzado = allOccurrencesForOperator
    .filter((o) => o.id !== occurrence.id)
    .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await updateOccurrenceTratativa(occurrence.id, {
        obsSupervisao: obsGeral,
        tratativaStatus: status,
        tratativaPriority: priority,
        prazoTratativa: prazo,
      });
      toast.success('Tratativa do supervisor salva com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar tratativa.');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPassoDesc.trim()) {
      toast.error('Informe a descrição da ação tomada.');
      return;
    }

    setSavingStep(true);
    try {
      await addTratativaActionStep(
        occurrence.id,
        {
          tipoAcao: novoPassoTipo,
          descricao: novoPassoDesc,
          prazoRevisao: novoPassoPrazo,
        },
        passos,
        novoPassoMudarStatus
      );

      toast.success('Etapa de tratativa registrada!');
      setNovoPassoDesc('');
      setNovoPassoPrazo('');
      setStatus(novoPassoMudarStatus);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar etapa.');
    } finally {
      setSavingStep(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header com Operador e Destaque */}
        <div className="px-6 py-4 pr-16 border-b border-border bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white flex items-center justify-between shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl text-white font-black text-sm flex items-center justify-center shadow-md shrink-0 border-2 border-white/30"
                style={{ backgroundColor: turmaInfo.cor }}
              >
                {occurrence.operadorLetra}
              </div>
              <div className="text-left">
                <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                  <span>{occurrence.operadorNome}</span>
                  <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                    Turno {occurrence.turno}
                  </span>
                </DialogTitle>
                <p className="text-xs text-white/80 font-medium">
                  {occurrence.operadorCargo} · Ocorrência de{' '}
                  <span className="font-bold underline uppercase">
                    {occurrence.tipo.replace('_', ' ')}
                  </span>{' '}
                  em {new Date(occurrence.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card Resumo do Caso */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Motivo / Queixa</p>
              <p className="text-xs font-semibold text-foreground mt-0.5 line-clamp-2">
                {occurrence.queixas || occurrence.motivo || 'Sem detalhes informados'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Impacto</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {occurrence.dias} {occurrence.dias === 1 ? 'dia' : 'dias'}
                {occurrence.minutosAtraso ? ` (${occurrence.minutosAtraso} min)` : ''} ·{' '}
                <span className={occurrence.impactaAbsenteismo ? 'text-red-500' : 'text-emerald-500'}>
                  {occurrence.impactaAbsenteismo ? 'Impacta absenteísmo' : 'Abonado / Neutro'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Reincidência</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {historicoCruzado.length === 0 ? (
                  <span className="text-emerald-600 font-bold">1º caso no histórico</span>
                ) : (
                  <span className="text-amber-600 font-black">
                    {historicoCruzado.length} outro(s) registro(s)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Seção 1: Configuração do Status da Tratativa */}
          <div className="space-y-3 p-4 rounded-xl border border-violet-200/80 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-violet-950 dark:text-violet-200">
                  Status & Encaminhamento Geral
                </h4>
              </div>
              <Button
                size="sm"
                onClick={handleSaveGeneral}
                disabled={savingGeneral}
                className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1.5"
              >
                {savingGeneral ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Status do Processo</label>
                <Select value={status} onValueChange={(v: TratativaStatus) => setStatus(v)}>
                  <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente de Ação</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="encaminhado_rh">Encaminhado ao RH</SelectItem>
                    <SelectItem value="encaminhado_medicina">Encaminhado à Medicina</SelectItem>
                    <SelectItem value="concluido">Concluído / Resolvido</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Prioridade</label>
                <Select value={priority} onValueChange={(v: TratativaPriority) => setPriority(v)}>
                  <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente 🔥</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Prazo de Resolução</label>
                <Input
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className="h-9 text-xs bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                Parecer / Resumo Geral da Supervisão
              </label>
              <Textarea
                value={obsGeral}
                onChange={(e) => setObsGeral(e.target.value)}
                placeholder="Parecer conclusivo, anotações de alinhamento com a gerência ou contexto permanente..."
                rows={2}
                className="text-xs bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          {/* Seção 2: Adicionar Nova Etapa / Passo de Ação */}
          <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                Registrar Nova Ação / Etapa no Caso
              </h4>
            </div>

            <form onSubmit={handleAddStep} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Tipo de Ação</label>
                  <Select
                    value={novoPassoTipo}
                    onValueChange={(v: any) => {
                      setNovoPassoTipo(v);
                      if (v === 'encaminhamento_rh') setNovoPassoMudarStatus('encaminhado_rh');
                      else if (v === 'encaminhamento_medicina') setNovoPassoMudarStatus('encaminhado_medicina');
                      else if (v === 'advertencia_escrita' || v === 'suspensao') setNovoPassoMudarStatus('em_andamento');
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conversa_feedback">Conversa & Feedback 1-a-1</SelectItem>
                      <SelectItem value="orientacao_verbal">Orientação Verbal Formal</SelectItem>
                      <SelectItem value="advertencia_escrita">Advertência Escrita</SelectItem>
                      <SelectItem value="suspensao">Suspensão Disciplinar</SelectItem>
                      <SelectItem value="encaminhamento_rh">Encaminhamento ao RH</SelectItem>
                      <SelectItem value="encaminhamento_medicina">Encaminhamento SESMT/Médico</SelectItem>
                      <SelectItem value="reuniao_alinhamento">Reunião de Alinhamento</SelectItem>
                      <SelectItem value="outro">Outra Ação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-1">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Mudar Status para</label>
                  <Select value={novoPassoMudarStatus} onValueChange={(v: any) => setNovoPassoMudarStatus(v)}>
                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="encaminhado_rh">Encaminhado ao RH</SelectItem>
                      <SelectItem value="encaminhado_medicina">Encaminhado à Medicina</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-1">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Data / Prazo de Revisão</label>
                  <Input
                    type="date"
                    value={novoPassoPrazo}
                    onChange={(e) => setNovoPassoPrazo(e.target.value)}
                    className="h-9 text-xs bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Descrição detalhada da ação tomada
                </label>
                <Textarea
                  value={novoPassoDesc}
                  onChange={(e) => setNovoPassoDesc(e.target.value)}
                  placeholder="Ex: Realizado alinhamento com o colaborador sobre pontualidade; acordado plano de recuperação..."
                  rows={3}
                  className="text-xs bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={savingStep}
                  size="sm"
                  className="h-9 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Send className="w-3.5 h-3.5" />
                  {savingStep ? 'Adicionando...' : 'Adicionar Etapa ao Histórico'}
                </Button>
              </div>
            </form>
          </div>

          {/* Seção 3: Linha do Tempo das Ações Realizadas */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Linha do Tempo das Tratativas ({passos.length})
            </h4>

            {passos.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma etapa registrada ainda. Use o formulário acima para registrar conversas, advertências ou encaminhamentos.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {passos.map((p, idx) => {
                  const meta = TRATATIVA_ACTION_META[p.tipoAcao] || TRATATIVA_ACTION_META.outro;
                  const dataFmt = new Date(p.data).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={p.id || idx} className="relative group">
                      {/* Ponto indicador na linha do tempo */}
                      <div className="absolute -left-[19px] top-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-primary shadow-xs" />

                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-black',
                              meta.badgeBg,
                              meta.color
                            )}
                          >
                            {meta.icon}
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {dataFmt} · por <span className="font-bold text-foreground">{p.registradoPor}</span>
                          </span>
                        </div>

                        <p className="text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                          {p.descricao}
                        </p>

                        {p.prazoRevisao && (
                          <div className="flex items-center gap-1.5 pt-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            <CalendarDays className="w-3 h-3" />
                            <span>Prazo acordado / Revisão: {new Date(p.prazoRevisao + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção 4: Histórico Geral do Operador */}
          {historicoCruzado.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Outras Ocorrências do Colaborador ({historicoCruzado.length})
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {historicoCruzado.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-foreground uppercase text-[11px]">
                        {h.tipo.replace('_', ' ')}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {new Date(h.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} ({h.dias}d)
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {h.obsSupervisao ? 'Tratada' : 'Sem tratativa'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações com botão Fechar */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-muted-foreground">
            Ações e pareceres registrados pela supervisão.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-bold rounded-xl"
          >
            Fechar Janela
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
