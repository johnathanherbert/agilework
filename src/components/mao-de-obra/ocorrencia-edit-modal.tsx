"use client";

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LaborOccurrence, LaborOccurrenceType } from '@/types';
import { updateLaborOccurrence, deleteLaborOccurrence } from '@/lib/labor-helpers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  Stethoscope,
  CalendarDays,
  FileText,
  Palmtree,
  Loader2,
  Calendar,
  Zap,
  MessageSquare,
  Pencil,
  Clock,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const OCCURRENCE_TYPES: {
  id: LaborOccurrenceType;
  label: string;
  descricao: string;
  icon: React.ElementType;
}[] = [
  { id: 'falta_injustificada', label: 'Falta Injustificada', descricao: 'Ausência sem justificativa (impacta absenteísmo)', icon: AlertTriangle },
  { id: 'falta_justificada', label: 'Falta Justificada', descricao: 'Ausência com declaração ou força maior', icon: FileText },
  { id: 'atestado', label: 'Atestado Médico', descricao: 'Afastamento médico com documento (impacta absenteísmo)', icon: Stethoscope },
  { id: 'folga_flexivel', label: 'Folga Flexível', descricao: 'Gozo de folga do banco de folgas flexíveis', icon: CalendarDays },
  { id: 'ferias', label: 'Férias', descricao: 'Período regulamentar de férias', icon: Palmtree },
  { id: 'atraso', label: 'Atraso', descricao: 'Chegada após o horário previsto', icon: Clock },
  { id: 'hora_extra', label: 'Hora Extra', descricao: 'Comparecimento no dia de folga dupla ou feriado', icon: Zap },
];

interface OcorrenciaEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: LaborOccurrence | null;
  onSuccess?: () => void;
}

export function OcorrenciaEditModal({
  open,
  onOpenChange,
  occurrence,
  onSuccess,
}: OcorrenciaEditModalProps) {
  const [tipo, setTipo] = useState<LaborOccurrenceType>('falta_injustificada');
  const [tipoFolgaFlexivel, setTipoFolgaFlexivel] = useState<'concessao' | 'debito'>('debito');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dias, setDias] = useState(1);
  const [horasImpacto, setHorasImpacto] = useState(8);
  const [minutosAtraso, setMinutosAtraso] = useState(0);
  const [queixas, setQueixas] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!occurrence) return;
    setTipo(occurrence.tipo);
    setTipoFolgaFlexivel(occurrence.tipoFolgaFlexivel || 'debito');
    setDataInicio(occurrence.dataInicio);
    setDataFim(occurrence.dataFim || occurrence.dataInicio);
    setDias(occurrence.dias);
    setHorasImpacto(occurrence.horasImpacto ?? occurrence.dias * 8);
    setMinutosAtraso(occurrence.minutosAtraso ?? 0);
    setQueixas(occurrence.queixas || '');
    setMotivo(occurrence.motivo || '');
  }, [occurrence, open]);

  useEffect(() => {
    if (dataInicio && dataFim) {
      const dt1 = new Date(dataInicio + 'T12:00:00Z');
      const dt2 = new Date(dataFim + 'T12:00:00Z');
      const diffDays = Math.max(1, Math.round((dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      setDias(diffDays);
      setHorasImpacto(diffDays * 8);
    }
  }, [dataInicio, dataFim]);

  if (!occurrence) return null;

  const handleDelete = async () => {
    if (!occurrence) return;
    setDeleting(true);
    try {
      await deleteLaborOccurrence(occurrence);
      toast.success(
        occurrence.tipo === 'folga_flexivel'
          ? 'Folga flexível removida com sucesso. Saldo restabelecido.'
          : 'Ocorrência excluída com sucesso.'
      );
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir ocorrência.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataInicio) { toast.error('Informe a data de início.'); return; }
    setSaving(true);
    try {
      await updateLaborOccurrence(
        occurrence.id,
        {
          tipo,
          dataInicio,
          dataFim: dataFim || dataInicio,
          dias,
          horasImpacto,
          minutosAtraso: tipo === 'atraso' ? minutosAtraso : 0,
          motivo: motivo.trim(),
          queixas: tipo === 'atestado' ? queixas.trim() : '',
          tipoFolgaFlexivel: tipo === 'folga_flexivel' ? tipoFolgaFlexivel : undefined,
        },
        occurrence
      );
      toast.success('Ocorrência atualizada!');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar ocorrência.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-5 border-b border-border bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-t-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-white">
                <div className="p-2 rounded-xl bg-white/10 border border-white/20">
                  <Pencil className="h-5 w-5 text-indigo-400" />
                </div>
                Editar Ocorrência
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-slate-300 mt-1">
              <span className="font-bold text-white">{occurrence.operadorNome}</span>
              {' '}· {occurrence.operadorCargo} · Turno {occurrence.turno}
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Tipo de Ocorrência */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Tipo de Ocorrência *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OCCURRENCE_TYPES.map((item) => {
                  const Icon = item.icon;
                  const selected = tipo === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTipo(item.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer",
                        selected
                          ? "ring-2 ring-primary border-primary bg-primary/5 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        selected ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground leading-tight">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.descricao}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipo de Folga Flexível */}
            {tipo === 'folga_flexivel' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-sky-700 dark:text-sky-400">
                  Tipo de Movimentação
                </Label>
                <Select value={tipoFolgaFlexivel} onValueChange={(v: any) => setTipoFolgaFlexivel(v)}>
                  <SelectTrigger className="border-sky-200 dark:border-sky-900/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debito">Débito (Gozo de Folga)</SelectItem>
                    <SelectItem value="concessao">Concessão (Crédito de Folga)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Período */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dataInicio" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Data de Início *
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-dataInicio"
                    type="date"
                    required
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-dataFim" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Data de Término
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-dataFim"
                    type="date"
                    min={dataInicio}
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Duração calculada */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Duração Total</span>
                <p className="text-base font-black text-foreground">{dias} {dias === 1 ? 'dia' : 'dias'}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Impacto em Horas</span>
                <p className="text-base font-black text-foreground">{horasImpacto}h (8h/dia)</p>
              </div>
            </div>

            {/* Queixas (atestado) */}
            {tipo === 'atestado' && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-queixas" className="text-xs font-bold uppercase text-rose-700 dark:text-rose-400">
                  <span className="flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Queixas / Motivo do Atestado
                  </span>
                </Label>
                <Input
                  id="edit-queixas"
                  placeholder="Ex: Dor lombar, gripe, problema gastrointestinal..."
                  value={queixas}
                  onChange={(e) => setQueixas(e.target.value)}
                  className="border-rose-200 dark:border-rose-900/50 focus-visible:ring-rose-400"
                />
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-motivo" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Observações / Justificativa
                </span>
              </Label>
              <Input
                id="edit-motivo"
                placeholder={
                  tipo === 'falta_injustificada' ? 'Ex: Operador não compareceu e não comunicou...'
                  : tipo === 'falta_justificada' ? 'Ex: Apresentou declaração de comparecimento médico...'
                  : tipo === 'atestado' ? 'Ex: Atestado de 2 dias emitido pelo Dr. Silva...'
                  : tipo === 'folga_flexivel' ? 'Ex: Folga solicitada e aprovada pela supervisão...'
                  : tipo === 'ferias' ? 'Ex: Férias aprovadas em reunião de escala...'
                  : 'Ex: Operador trabalhou na folga dupla...'
                }
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2 rounded-b-2xl">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving || deleting}
              className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5 rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {occurrence.tipo === 'folga_flexivel' ? 'Remover Folga' : 'Excluir'}
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting} className="rounded-xl">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || deleting}
                className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                ) : (
                  <><Pencil className="h-4 w-4" />Salvar Alterações</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Modal de confirmação de exclusão */}
    <AlertDialog open={deleteConfirmOpen} onOpenChange={(v) => !deleting && setDeleteConfirmOpen(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {occurrence.tipo === 'folga_flexivel' ? 'Remover Folga Flexível' : 'Excluir Ocorrência'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-1">
            <span>
              Tem certeza que deseja {occurrence.tipo === 'folga_flexivel' ? 'remover a folga flexível de' : 'excluir esta ocorrência de'}{' '}
              <strong className="text-foreground">{occurrence.operadorNome}</strong>?
            </span>
            {occurrence.tipo === 'folga_flexivel' && (
              <span className="block text-xs text-muted-foreground pt-1">
                ℹ️ Ao remover esta folga ({occurrence.dias} dia{occurrence.dias > 1 ? 's' : ''}), o saldo de folgas flexíveis do operador será automaticamente restabelecido.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} className="rounded-xl">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
          >
            {deleting ? 'Excluindo...' : occurrence.tipo === 'folga_flexivel' ? 'Sim, remover folga' : 'Sim, excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
