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
      <DialogContent className="max-w-[460px] p-0 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text)]">Banco de folgas flexíveis</h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {operator.nome} · Turma {operator.letra} · Turno {operator.turno}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
            {/* Saldo Atual */}
            <div className="flex items-center justify-between p-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded font-mono text-[11px] font-bold flex items-center justify-center border"
                  style={{
                    backgroundColor: turmaInfo ? `${turmaInfo.cor}22` : 'var(--surface-2)',
                    color: turmaInfo?.cor || 'var(--text)',
                    borderColor: turmaInfo ? `${turmaInfo.cor}55` : 'var(--border-strong)',
                  }}
                >
                  {operator.letra}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text)]">{operator.nome}</p>
                  <p className="text-[11px] text-[var(--text-3)] font-mono">{operator.matricula}</p>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] uppercase text-[var(--text-3)] block">Saldo atual</span>
                <span className={cn(
                  "text-sm font-bold",
                  currentSaldo > 0 ? "text-emerald-400" : currentSaldo < 0 ? "text-red-400" : "text-[var(--text-3)]"
                )}>
                  {currentSaldo > 0 ? `+${currentSaldo}` : currentSaldo}d
                </span>
              </div>
            </div>

            {/* Segmented Mode */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Ação *</label>
              <div className="grid grid-cols-2 border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
                <button
                  type="button"
                  onClick={() => setMode('credito')}
                  className={cn(
                    "h-8 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer",
                    mode === 'credito'
                      ? "bg-[var(--hover)] text-[var(--text)] font-semibold shadow-xs"
                      : "text-[var(--text-3)] hover:text-[var(--text)]"
                  )}
                >
                  + Adicionar crédito
                </button>
                <button
                  type="button"
                  onClick={() => setMode('gozo')}
                  className={cn(
                    "h-8 text-xs font-medium transition-colors cursor-pointer",
                    mode === 'gozo'
                      ? "bg-[var(--hover)] text-[var(--text)] font-semibold shadow-xs"
                      : "text-[var(--text-3)] hover:text-[var(--text)]"
                  )}
                >
                  - Registrar gozo
                </button>
              </div>
            </div>

            {/* Data do Gozo (apenas no modo gozo) */}
            {mode === 'gozo' && (
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Data da folga (Gozo) *</label>
                <input
                  type="date"
                  value={dataGozo}
                  onChange={(e) => setDataGozo(e.target.value)}
                  className="h-8.5 w-full px-3 text-xs font-mono bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
            )}

            {/* Quantidade de Dias com Stepper */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Quantidade de dias *</label>
              <div className="flex items-center border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] h-8.5 overflow-hidden">
                <button
                  type="button"
                  className="w-9 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                  onClick={() => setDias((d) => Math.max(1, d - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={dias}
                  onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 1))}
                  className="flex-1 h-full text-center font-mono text-xs font-bold bg-transparent border-0 outline-none text-[var(--text)]"
                />
                <button
                  type="button"
                  className="w-9 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                  onClick={() => setDias((d) => d + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Preview do Saldo Resultante */}
            <div className="flex items-center justify-between px-3 py-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-xs font-mono">
              <span className="text-[var(--text-3)]">Saldo resultante:</span>
              <strong className={cn(
                previewSaldo > 0 ? "text-emerald-400" : previewSaldo < 0 ? "text-red-400" : "text-[var(--text)]"
              )}>
                {previewSaldo > 0 ? `+${previewSaldo}` : previewSaldo}d
              </strong>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Observação (Opcional)</label>
              <input
                placeholder={mode === 'credito' ? 'Ex: Trabalhou no plantão de sábado' : 'Ex: Gozo programado'}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="h-8.5 w-full px-3 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface-2)]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || dias <= 0}
              className="h-8 px-3.5 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
            >
              {saving ? 'Salvando...' : mode === 'credito' ? 'Salvar crédito' : 'Registrar gozo'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
