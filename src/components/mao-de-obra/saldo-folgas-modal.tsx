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
import { Operator } from '@/types';
import { updateOperatorSaldoFolgas, createLaborOccurrence } from '@/lib/labor-helpers';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { CalendarDays, Plus, Minus, CheckCircle2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaldoFolgasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operator: Operator | null;
  onSuccess?: () => void;
}

type Mode = 'credito' | 'gozo';

export function SaldoFolgasModal({
  open,
  onOpenChange,
  operator,
  onSuccess,
}: SaldoFolgasModalProps) {
  const [mode, setMode] = useState<Mode>('credito');
  const [dias, setDias] = useState<number>(1);
  const [dataGozo, setDataGozo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [observacao, setObservacao] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    setMode('credito');
    setDias(1);
    setDataGozo(new Date().toISOString().split('T')[0]);
    setObservacao('');
  }, [operator, open]);

  if (!operator) return null;

  const currentSaldo = operator.saldoFolgasFlexiveis || 0;
  const turmaInfo = TURMAS_INFO[operator.letra];

  const previewSaldo = mode === 'credito'
    ? currentSaldo + dias
    : currentSaldo - dias;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (dias <= 0) {
      toast.error('Informe ao menos 1 dia.');
      return;
    }

    if (mode === 'gozo' && currentSaldo <= 0) {
      toast.error('Operador não possui saldo disponível para gozo.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'credito') {
        // Apenas incrementa o saldo — sem criar ocorrência
        await updateOperatorSaldoFolgas(
          operator.id,
          dias,
          observacao.trim() || `Crédito de ${dias} dia(s) adicionado manualmente`
        );
        toast.success(`+${dias} dia(s) adicionado(s) ao saldo de ${operator.nome}.`);
      } else {
        // Gozo: cria ocorrência de débito (createLaborOccurrence já desconta o saldo internamente)
        await createLaborOccurrence({
          operadorId: operator.id,
          operadorNome: operator.nome,
          operadorCargo: operator.cargo,
          operadorLetra: operator.letra,
          turno: operator.turno,
          tipo: 'folga_flexivel',
          dataInicio: dataGozo,
          dataFim: dias > 1
            ? (() => {
                const d = new Date(dataGozo + 'T12:00:00Z');
                d.setDate(d.getDate() + dias - 1);
                return d.toISOString().split('T')[0];
              })()
            : dataGozo,
          dias,
          tipoFolgaFlexivel: 'debito',
          motivo: observacao.trim() || `Gozo de folga flexível (${dias} dia(s))`,
        });
        toast.success(`Gozo de ${dias} dia(s) registrado para ${operator.nome}.`);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao atualizar saldo:', error);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 rounded-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-5 border-b border-border bg-gradient-to-r from-sky-600 to-blue-700 text-white rounded-t-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-white">
                <div className="p-2 rounded-xl bg-white/20 border border-white/30">
                  <CalendarDays className="h-4 w-4" />
                </div>
                Saldo de Folgas Flexíveis
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-5">
            {/* Operador + Saldo Atual */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: turmaInfo.cor }}
                >
                  {operator.letra}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm leading-tight">{operator.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{operator.matricula} · T{operator.turno}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Atual</p>
                <p className={cn(
                  "text-lg font-black font-mono leading-none mt-0.5",
                  currentSaldo > 0 ? "text-emerald-600 dark:text-emerald-400"
                  : currentSaldo < 0 ? "text-red-600 dark:text-red-400"
                  : "text-slate-500"
                )}>
                  {currentSaldo > 0 ? `+${currentSaldo}` : currentSaldo}d
                </p>
              </div>
            </div>

            {/* Seletor de Modo */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('credito')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all",
                  mode === 'credito'
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 text-muted-foreground border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:text-emerald-600"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Adicionar Saldo
              </button>
              <button
                type="button"
                onClick={() => setMode('gozo')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all",
                  mode === 'gozo'
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 text-muted-foreground border-slate-200 dark:border-slate-800 hover:border-sky-400 hover:text-sky-600"
                )}
              >
                <TrendingDown className="w-4 h-4" />
                Registrar Folga Flex
              </button>
            </div>

            {/* Descrição do modo */}
            <p className="text-xs text-muted-foreground -mt-2">
              {mode === 'credito'
                ? 'Acrescenta dias ao banco de folgas do operador (ex: trabalhou em folga ou feriado).'
                : 'Registra uma folga gozada numa data específica e desconta do saldo.'}
            </p>

            {/* Data de Gozo (apenas no modo gozo) */}
            {mode === 'gozo' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Data do Gozo
                </Label>
                <Input
                  type="date"
                  value={dataGozo}
                  onChange={(e) => setDataGozo(e.target.value)}
                  className="h-10 rounded-xl font-mono"
                  required
                />
              </div>
            )}

            {/* Quantidade de dias */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Quantidade de Dias
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0"
                  onClick={() => setDias((d) => Math.max(1, d - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={dias}
                  onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 1))}
                  className="h-10 text-center font-mono font-black text-base rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0"
                  onClick={() => setDias((d) => d + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Preview do novo saldo */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              <span className="text-xs font-bold text-muted-foreground">Saldo resultante</span>
              <span className={cn(
                "font-mono font-black text-sm px-2.5 py-1 rounded-lg",
                previewSaldo > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : previewSaldo < 0 ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              )}>
                {previewSaldo > 0 ? `+${previewSaldo}` : previewSaldo}d
              </span>
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <Label htmlFor="obs" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Observação <span className="text-muted-foreground font-normal normal-case">(opcional)</span>
              </Label>
              <Input
                id="obs"
                placeholder={mode === 'credito'
                  ? 'Ex: Trabalhou no plantão do sábado'
                  : 'Ex: Folga solicitada pelo operador'}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="rounded-xl"
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
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || dias <= 0}
              className={cn(
                "gap-2 font-bold rounded-xl text-white",
                mode === 'credito'
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-sky-600 hover:bg-sky-700"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {mode === 'credito' ? 'Adicionar Saldo' : 'Registrar Gozo'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
