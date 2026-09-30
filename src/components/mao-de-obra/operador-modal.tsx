"use client";

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Operator, OperatorStatus, OperatorTurma, ProductionTurno } from '@/types';
import { createOperator, updateOperator } from '@/lib/labor-helpers';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { User, Tag, Clock, Calendar, Phone, FileText, CheckCircle2, Loader2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperadorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operator?: Operator | null;
  defaultTurno?: ProductionTurno;
  onSuccess?: () => void;
}

const CARGOS_SUGERIDOS = [
  'Operador de Produção I',
  'Operador de Produção II',
  'Operador de Produção III',
  'Pesador / Operador de Pesagem',
  'Operador de Empilhadeira',
  'Abastecedor de Linha',
  'Preparador de Mistura / Batelada',
  'Inspetor de Qualidade',
  'Líder de Linha / Assistente',
  'Auxiliar de Produção',
];

export function OperadorModal({
  open,
  onOpenChange,
  operator,
  defaultTurno = 1,
  onSuccess,
}: OperadorModalProps) {
  const isEditing = Boolean(operator);

  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cargo, setCargo] = useState('Operador de Produção I');
  const [cargoCustom, setCargoCustom] = useState('');
  const [isCustomCargo, setIsCustomCargo] = useState(false);
  const [letra, setLetra] = useState<OperatorTurma>('A');
  const [turno, setTurno] = useState<ProductionTurno>(defaultTurno);
  const [saldoFolgas, setSaldoFolgas] = useState<number>(0);
  const [status, setStatus] = useState<OperatorStatus>('ativo');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (operator) {
      setNome(operator.nome || '');
      setMatricula(operator.matricula || '');
      if (CARGOS_SUGERIDOS.includes(operator.cargo)) {
        setCargo(operator.cargo);
        setIsCustomCargo(false);
        setCargoCustom('');
      } else {
        setCargo('custom');
        setIsCustomCargo(true);
        setCargoCustom(operator.cargo);
      }
      setLetra(operator.letra || 'A');
      setTurno(operator.turno || 1);
      setSaldoFolgas(operator.saldoFolgasFlexiveis || 0);
      setStatus(operator.status || 'ativo');
      setDataAdmissao(operator.dataAdmissao || '');
      setTelefone(operator.telefone || '');
      setObservacoes(operator.observacoes || '');
    } else {
      setNome('');
      setMatricula('');
      setCargo('Operador de Produção I');
      setIsCustomCargo(false);
      setCargoCustom('');
      setLetra('A');
      setTurno(defaultTurno);
      setSaldoFolgas(0);
      setStatus('ativo');
      setDataAdmissao('');
      setTelefone('');
      setObservacoes('');
    }
  }, [operator, defaultTurno, open]);

  const handleCargoChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomCargo(true);
      setCargo('custom');
    } else {
      setIsCustomCargo(false);
      setCargo(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error('Informe o nome do operador.');
      return;
    }
    if (!matricula.trim()) {
      toast.error('Informe o número de matrícula/crachá.');
      return;
    }

    const finalCargo = isCustomCargo ? (cargoCustom.trim() || 'Operador de Produção') : cargo;

    setSaving(true);
    try {
      if (isEditing && operator) {
        await updateOperator(operator.id, {
          nome: nome.trim(),
          matricula: matricula.trim(),
          cargo: finalCargo,
          letra,
          turno,
          saldoFolgasFlexiveis: Number(saldoFolgas) || 0,
          status,
          dataAdmissao,
          telefone: telefone.trim(),
          observacoes: observacoes.trim(),
        });
        toast.success('Operador atualizado com sucesso!');
      } else {
        await createOperator({
          nome: nome.trim(),
          matricula: matricula.trim(),
          cargo: finalCargo,
          letra,
          turno,
          saldoFolgasFlexiveis: Number(saldoFolgas) || 0,
          status,
          dataAdmissao,
          telefone: telefone.trim(),
          observacoes: observacoes.trim(),
        });
        toast.success('Operador cadastrado com sucesso!');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar operador:', error);
      toast.error('Erro ao salvar operador. Verifique os dados.');
    } finally {
      setSaving(false);
    }
  };

  const turmasList: OperatorTurma[] = ['A', 'B', 'C', 'D'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                {isEditing ? 'Editar operador' : 'Novo operador'}
              </h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {isEditing ? 'Atualize os dados do colaborador na escala.' : 'Cadastre um novo colaborador na escala 2026.'}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
            {/* Nome e Matrícula */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Nome completo *</label>
                <input
                  required
                  placeholder="Ex: Carlos Eduardo Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-8.5 w-full px-3 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Matrícula *</label>
                <input
                  required
                  placeholder="Ex: 75420"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="h-8.5 w-full px-3 text-xs font-mono font-medium bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Cargo */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Cargo / Função *</label>
              <select
                value={cargo}
                onChange={(e) => handleCargoChange(e.target.value)}
                className="h-8.5 w-full px-3 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                {CARGOS_SUGERIDOS.map((c) => (
                  <option key={c} value={c} className="bg-[var(--surface)] text-[var(--text)]">
                    {c}
                  </option>
                ))}
                <option value="custom" className="bg-[var(--surface)] text-[var(--accent)]">
                  + Outro Cargo Personalizado...
                </option>
              </select>

              {isCustomCargo && (
                <div className="mt-2">
                  <input
                    placeholder="Digite o cargo customizado..."
                    value={cargoCustom}
                    onChange={(e) => setCargoCustom(e.target.value)}
                    className="h-8.5 w-full px-3 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Turno e Turma */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Turno */}
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Turno de trabalho *</label>
                <div className="grid grid-cols-3 border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
                  {([1, 2, 3] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTurno(t)}
                      className={cn(
                        "h-8 text-xs font-medium border-r border-[var(--border-strong)] last:border-r-0 transition-colors font-mono",
                        turno === t
                          ? "bg-[var(--hover)] text-[var(--text)] font-semibold shadow-xs"
                          : "text-[var(--text-3)] hover:text-[var(--text)]"
                      )}
                    >
                      T{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Turma */}
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Turma de escala *</label>
                <div className="grid grid-cols-4 border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
                  {turmasList.map((t) => {
                    const info = TURMAS_INFO[t];
                    const isSel = letra === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLetra(t)}
                        className={cn(
                          "h-8 text-xs font-bold border-r border-[var(--border-strong)] last:border-r-0 transition-colors font-mono",
                          isSel
                            ? "bg-[var(--hover)] text-[var(--text)]"
                            : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                        style={isSel && info ? { color: info.cor } : {}}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Saldo de Folgas Flexíveis */}
            <div className="flex items-center justify-between p-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]">
              <div>
                <span className="text-xs font-medium text-[var(--text)] block">Saldo de folgas flexíveis</span>
                <span className="text-[11px] text-[var(--text-3)]">Dias acumulados para gozo flexível</span>
              </div>
              <div className="flex items-center border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] h-7.5 overflow-hidden">
                <button
                  type="button"
                  className="w-7 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                  onClick={() => setSaldoFolgas((prev) => Math.max(-10, prev - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  value={saldoFolgas}
                  onChange={(e) => setSaldoFolgas(Number(e.target.value) || 0)}
                  className="w-12 h-full text-center font-mono text-xs font-bold bg-transparent border-0 outline-none text-[var(--text)]"
                />
                <button
                  type="button"
                  className="w-7 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                  onClick={() => setSaldoFolgas((prev) => prev + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Contato e Observação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Telefone (Opcional)</label>
                <input
                  placeholder="(92) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="h-8.5 w-full px-3 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Data de admissão (Opcional)</label>
                <input
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="h-8.5 w-full px-3 text-xs font-mono bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Observações</label>
              <input
                placeholder="Ex: Treinado em pesagem e empilhadeira"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
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
              disabled={saving}
              className="h-8 px-3.5 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
            >
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar operador'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
