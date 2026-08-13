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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-5 border-b border-border bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-t-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-white">
                <div className="p-2 rounded-xl bg-white/20 border border-white/30">
                  <User className="h-5 w-5" />
                </div>
                {isEditing ? 'Editar Operador de Produção' : 'Novo Operador de Produção'}
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-blue-100 mt-1">
              Cadastre e gerencie as informações do colaborador, turma de revezamento e saldo de folgas.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Nome e Matrícula */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="nome" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Nome Completo *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    required
                    placeholder="Ex: Carlos Eduardo Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-9 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="matricula" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Matrícula / ID *
                </Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="matricula"
                    required
                    placeholder="Ex: 75420"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    className="pl-9 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Cargo e Função */}
            <div className="space-y-1.5">
              <Label htmlFor="cargo" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Cargo / Função na Linha *
              </Label>
              <Select value={cargo} onValueChange={handleCargoChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o cargo..." />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS_SUGERIDOS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="font-semibold text-primary">
                    + Outro Cargo Personalizado...
                  </SelectItem>
                </SelectContent>
              </Select>

              {isCustomCargo && (
                <div className="mt-2">
                  <Input
                    placeholder="Digite o cargo customizado..."
                    value={cargoCustom}
                    onChange={(e) => setCargoCustom(e.target.value)}
                    className="font-medium"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Turma / Letra da Escala (A, B, C, D) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Turma / Letra da Escala 2026 *
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {turmasList.map((t) => {
                  const info = TURMAS_INFO[t];
                  const selected = letra === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLetra(t)}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer",
                        selected
                          ? "ring-2 ring-offset-2 ring-primary shadow-md border-transparent text-white"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                      )}
                      style={{
                        backgroundColor: selected ? info.cor : undefined,
                      }}
                    >
                      <span className={cn("text-base font-black", selected ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                        Turma {t}
                      </span>
                      <span
                        className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          selected ? "bg-white" : ""
                        )}
                        style={{ backgroundColor: !selected ? info.cor : undefined }}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                A letra vincula os dias de plantão e folgas automáticas segundo a rotação do escala.json.
              </p>
            </div>

            {/* Turno e Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="turno" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Turno de Trabalho *
                </Label>
                <Select value={String(turno)} onValueChange={(v) => setTurno(Number(v) as ProductionTurno)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Turno 1 (Manhã)</SelectItem>
                    <SelectItem value="2">Turno 2 (Tarde)</SelectItem>
                    <SelectItem value="3">Turno 3 (Noite)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Status Operacional *
                </Label>
                <Select value={status} onValueChange={(v) => setStatus(v as OperatorStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo (Em Operação)</SelectItem>
                    <SelectItem value="ferias">Em Férias</SelectItem>
                    <SelectItem value="afastado">Afastado (INSS/Médico)</SelectItem>
                    <SelectItem value="inativo">Inativo / Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Saldo de Folgas Flexíveis */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="saldoFolgas" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                    Saldo de Folgas Flexíveis (Dias)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Banco de folgas acumuladas por horas/plantões extras.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setSaldoFolgas((prev) => Math.max(-10, prev - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="saldoFolgas"
                    type="number"
                    value={saldoFolgas}
                    onChange={(e) => setSaldoFolgas(Number(e.target.value) || 0)}
                    className="w-16 h-8 text-center font-mono font-bold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setSaldoFolgas((prev) => prev + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Data de Admissão e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataAdmissao" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Data de Admissão (Opcional)
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dataAdmissao"
                    type="date"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Telefone / Contato (Opcional)
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telefone"
                    placeholder="(92) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="observacoes" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Observações / Habilidades
              </Label>
              <Input
                id="observacoes"
                placeholder="Ex: Treinado em pesagem de matéria-prima e NR-11 (Empilhadeira)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
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
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isEditing ? 'Atualizar Operador' : 'Cadastrar Operador'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
