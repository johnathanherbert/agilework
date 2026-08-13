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
import {
  Operator,
  LaborOccurrenceType,
  ProductionTurno,
} from '@/types';
import { createLaborOccurrence } from '@/lib/labor-helpers';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import {
  AlertTriangle,
  Stethoscope,
  CalendarDays,
  Clock,
  FileText,
  Palmtree,
  Sparkles,
  CheckCircle2,
  Loader2,
  Calendar,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OcorrenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operators: Operator[];
  selectedOperator?: Operator | null;
  defaultDate?: string;
  defaultType?: LaborOccurrenceType;
  onSuccess?: () => void;
}

const OCCURRENCE_TYPES: {
  id: LaborOccurrenceType;
  label: string;
  descricao: string;
  icon: React.ElementType;
  badgeClass: string;
}[] = [
  {
    id: 'falta_injustificada',
    label: 'Falta Injustificada',
    descricao: 'Ausência sem justificativa legal (impacta absenteísmo)',
    icon: AlertTriangle,
    badgeClass: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400',
  },
  {
    id: 'falta_justificada',
    label: 'Falta Justificada',
    descricao: 'Ausência justificada por declaração ou força maior',
    icon: FileText,
    badgeClass: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400',
  },
  {
    id: 'atestado',
    label: 'Atestado Médico',
    descricao: 'Afastamento médico com CID (impacta absenteísmo)',
    icon: Stethoscope,
    badgeClass: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400',
  },
  {
    id: 'folga_flexivel',
    label: 'Folga Flexível',
    descricao: 'Gozo ou concessão de folga do banco de folgas flexíveis',
    icon: CalendarDays,
    badgeClass: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400',
  },
  {
    id: 'ferias',
    label: 'Férias',
    descricao: 'Período regulamentar de férias (10, 15, 20 ou 30 dias)',
    icon: Palmtree,
    badgeClass: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400',
  },
  {
    id: 'hora_extra',
    label: 'Hora Extra',
    descricao: 'Operador comparece no trabalho no dia de folga dupla ou feriados',
    icon: Zap,
    badgeClass: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
];

export function OcorrenciaModal({
  open,
  onOpenChange,
  operators,
  selectedOperator,
  defaultDate,
  defaultType = 'falta_injustificada',
  onSuccess,
}: OcorrenciaModalProps) {
  const [operatorId, setOperatorId] = useState<string>('');
  const [tipo, setTipo] = useState<LaborOccurrenceType>(defaultType);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [dias, setDias] = useState<number>(1);
  const [horasImpacto, setHorasImpacto] = useState<number>(8);
  const [cid, setCid] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [tipoFolgaFlexivel, setTipoFolgaFlexivel] = useState<'debito' | 'concessao'>('debito');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const today = defaultDate || new Date().toISOString().split('T')[0];
    setDataInicio(today);
    setDataFim(today);
    setDias(1);
    setHorasImpacto(8);
    setTipo(defaultType);
    setCid('');
    setMotivo('');
    setTipoFolgaFlexivel('debito');

    if (selectedOperator) {
      setOperatorId(selectedOperator.id);
    } else if (operators.length > 0) {
      setOperatorId(operators[0].id);
    }
  }, [selectedOperator, defaultDate, defaultType, open, operators]);

  // Recalcula dias ao mudar datas
  useEffect(() => {
    if (dataInicio && dataFim) {
      const dt1 = new Date(dataInicio + 'T12:00:00Z');
      const dt2 = new Date(dataFim + 'T12:00:00Z');
      const diffTime = dt2.getTime() - dt1.getTime();
      const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
      setDias(diffDays);
      setHorasImpacto(diffDays * 8);
    }
  }, [dataInicio, dataFim]);

  const activeOp = operators.find((op) => op.id === operatorId) || selectedOperator;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!operatorId) {
      toast.error('Selecione um operador.');
      return;
    }
    if (!dataInicio) {
      toast.error('Informe a data de início.');
      return;
    }

    if (!activeOp) {
      toast.error('Operador não encontrado.');
      return;
    }

    setSaving(true);
    try {
      await createLaborOccurrence({
        operadorId: activeOp.id,
        operadorNome: activeOp.nome,
        operadorCargo: activeOp.cargo,
        operadorLetra: activeOp.letra,
        turno: activeOp.turno,
        tipo,
        dataInicio,
        dataFim: dataFim || dataInicio,
        dias,
        horasImpacto,
        motivo: motivo.trim(),
        cid: tipo === 'atestado' ? cid.trim().toUpperCase() : undefined,
        tipoFolgaFlexivel: tipo === 'folga_flexivel' ? tipoFolgaFlexivel : undefined,
      });

      toast.success(`Ocorrência (${tipo.replace('_', ' ')}) registrada com sucesso!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao registrar ocorrência:', error);
      toast.error('Erro ao registrar ocorrência.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-5 border-b border-border bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-t-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-white">
                <div className="p-2 rounded-xl bg-white/10 border border-white/20">
                  <CalendarDays className="h-5 w-5 text-indigo-400" />
                </div>
                Registrar Ocorrência de Mão de Obra
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-slate-300 mt-1">
              Lance faltas, atestados com CID, folgas flexíveis e férias para controle de absenteísmo e saldo.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Seleção do Operador */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Colaborador / Operador *
              </Label>
              <Select value={operatorId} onValueChange={setOperatorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o operador..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {operators.map((op) => {
                    const turmaInfo = TURMAS_INFO[op.letra];
                    return (
                      <SelectItem key={op.id} value={op.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: turmaInfo.cor }}
                          />
                          <span className="font-bold text-foreground">{op.nome}</span>
                          <span className="text-xs text-muted-foreground font-mono">({op.matricula})</span>
                          <span className="text-xs text-muted-foreground">— {op.cargo} (T{op.turno})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {activeOp && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: TURMAS_INFO[activeOp.letra]?.cor }}
                  />
                  <span className="font-bold">Turma {activeOp.letra}</span>
                  <span className="text-muted-foreground">• Turno {activeOp.turno}</span>
                  <span className="text-muted-foreground">• Saldo de Folgas:</span>
                  <span
                    className={cn(
                      "font-mono font-bold px-1.5 py-0.5 rounded",
                      activeOp.saldoFolgasFlexiveis > 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : activeOp.saldoFolgasFlexiveis < 0
                        ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {activeOp.saldoFolgasFlexiveis > 0 ? `+${activeOp.saldoFolgasFlexiveis}` : activeOp.saldoFolgasFlexiveis} dias
                  </span>
                </div>
              )}
            </div>

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
                      <div
                        className={cn(
                          "p-2 rounded-lg shrink-0",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        )}
                      >
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

            {/* Opção Específica para Folga Flexível (Débito vs Concessão) */}
            {tipo === 'folga_flexivel' && (
              <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 space-y-2">
                <Label className="text-xs font-bold uppercase text-sky-900 dark:text-sky-300">
                  Ação no Saldo de Folgas Flexíveis
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoFolgaFlexivel('debito')}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                      tipoFolgaFlexivel === 'debito'
                        ? "bg-white dark:bg-slate-900 border-sky-500 ring-2 ring-sky-500/50 shadow-xs"
                        : "bg-white/60 dark:bg-slate-900/60 border-sky-200 dark:border-sky-800/60 opacity-80"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      tipoFolgaFlexivel === 'debito' ? "border-sky-600 bg-sky-600" : "border-slate-400"
                    )}>
                      {tipoFolgaFlexivel === 'debito' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-foreground block leading-tight">Gozo de Folga (Débito)</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Desconta -{dias} dia(s) do saldo</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoFolgaFlexivel('concessao')}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                      tipoFolgaFlexivel === 'concessao'
                        ? "bg-white dark:bg-slate-900 border-sky-500 ring-2 ring-sky-500/50 shadow-xs"
                        : "bg-white/60 dark:bg-slate-900/60 border-sky-200 dark:border-sky-800/60 opacity-80"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      tipoFolgaFlexivel === 'concessao' ? "border-sky-600 bg-sky-600" : "border-slate-400"
                    )}>
                      {tipoFolgaFlexivel === 'concessao' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-foreground block leading-tight">Trabalhou em Folga (Crédito)</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Adiciona +{dias} dia(s) ao saldo</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Período (Data Início e Fim) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataInicio" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Data de Início *
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dataInicio"
                    type="date"
                    required
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dataFim" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Data de Término *
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dataFim"
                    type="date"
                    required
                    min={dataInicio}
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Dias e Horas */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Duração Total</span>
                <p className="text-base font-black text-foreground">{dias} {dias === 1 ? 'dia' : 'dias'}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Impacto em Horas</span>
                <p className="text-base font-black text-foreground">{horasImpacto} horas (8h/dia)</p>
              </div>
            </div>

            {/* Campo Específico de CID para Atestado Médico */}
            {tipo === 'atestado' && (
              <div className="space-y-1.5">
                <Label htmlFor="cid" className="text-xs font-bold uppercase text-rose-700 dark:text-rose-400">
                  Código CID (Classificação Internacional de Doenças)
                </Label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-500" />
                  <Input
                    id="cid"
                    placeholder="Ex: J06.9 (Infecção vias aéreas), M54.5 (Dor lombar)"
                    value={cid}
                    onChange={(e) => setCid(e.target.value)}
                    className="pl-9 font-mono uppercase"
                  />
                </div>
              </div>
            )}

            {/* Motivo / Justificativa */}
            <div className="space-y-1.5">
              <Label htmlFor="motivo" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Motivo / Justificativa / Observações
              </Label>
              <Input
                id="motivo"
                placeholder="Ex: Apresentou atestado médico de 2 dias emitido pelo Dr. Silva"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Ocorrência
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
