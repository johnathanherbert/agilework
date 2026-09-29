"use client";

import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Operator,
  OperatorTurma,
  ProductionTurno,
  OperatorStatus,
  LaborOccurrence,
  LaborOccurrenceType,
} from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { deleteOperator } from '@/lib/labor-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Plus,
  Search,
  CalendarDays,
  Edit,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TURNO_LABELS: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
  1: { label: '07:20–15:50', color: 'text-amber-600 dark:text-amber-400', icon: <Sun className="w-3 h-3" /> },
  2: { label: '15:50–23:45', color: 'text-orange-600 dark:text-orange-400', icon: <Sunset className="w-3 h-3" /> },
  3: { label: '23:45–07:20', color: 'text-blue-600 dark:text-blue-400', icon: <Moon className="w-3 h-3" /> },
};

interface OperadoresTableProps {
  operators: Operator[];
  occurrences?: LaborOccurrence[];
  selectedTurno: ProductionTurno | 'ALL';
  onOpenNewOperator: () => void;
  onOpenImportarMassa?: () => void;
  onEditOperator: (operator: Operator) => void;
  onOpenOcorrencia: (operator: Operator, type?: LaborOccurrenceType) => void;
  onOpenSaldoFolgas: (operator: Operator) => void;
}

export function OperadoresTable({
  operators,
  occurrences = [],
  selectedTurno,
  onOpenNewOperator,
  onOpenImportarMassa,
  onEditOperator,
  onOpenOcorrencia,
  onOpenSaldoFolgas,
}: OperadoresTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [turmaFilter, setTurmaFilter] = useState<'ALL' | OperatorTurma>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OperatorStatus>('ALL');
  const [operatorToDelete, setOperatorToDelete] = useState<Operator | null>(null);
  const [deleting, setDeleting] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Helper para determinar o status real/efetivo do operador (se data atual > férias, status volta a ser 'ativo')
  const getEffectiveStatus = useMemo(() => {
    return (op: Operator): OperatorStatus => {
      if (op.status === 'inativo') return 'inativo';
      if (op.status === 'afastado') return 'afastado';

      const isCurrentlyOnVacation = occurrences.some(
        (occ) =>
          occ.operadorId === op.id &&
          occ.tipo === 'ferias' &&
          todayStr >= occ.dataInicio &&
          todayStr <= (occ.dataFim || occ.dataInicio)
      );

      if (isCurrentlyOnVacation) return 'ferias';
      return 'ativo';
    };
  }, [occurrences, todayStr]);

  // Estatísticas
  const stats = useMemo(() => {
    const activeOps = operators.filter((op) => selectedTurno === 'ALL' || op.turno === selectedTurno);
    const total = activeOps.length;
    const ativos = activeOps.filter((o) => getEffectiveStatus(o) === 'ativo').length;
    const ferias = activeOps.filter((o) => getEffectiveStatus(o) === 'ferias').length;
    const turmasCount = {
      A: activeOps.filter((o) => o.letra === 'A').length,
      B: activeOps.filter((o) => o.letra === 'B').length,
      C: activeOps.filter((o) => o.letra === 'C').length,
      D: activeOps.filter((o) => o.letra === 'D').length,
    };
    const saldoTotal = activeOps.reduce((acc, o) => acc + (o.saldoFolgasFlexiveis || 0), 0);
    return { total, ativos, ferias, turmasCount, saldoTotal };
  }, [operators, selectedTurno, getEffectiveStatus]);

  // Operadores filtrados
  const filteredOperators = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return operators.filter((op) => {
      const effStatus = getEffectiveStatus(op);
      if (selectedTurno !== 'ALL' && op.turno !== selectedTurno) return false;
      if (turmaFilter !== 'ALL' && op.letra !== turmaFilter) return false;
      if (statusFilter !== 'ALL' && effStatus !== statusFilter) return false;
      if (query) {
        return (
          op.nome.toLowerCase().includes(query) ||
          op.matricula.toLowerCase().includes(query) ||
          op.cargo.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [operators, selectedTurno, turmaFilter, statusFilter, searchQuery, getEffectiveStatus]);

  const handleDeleteConfirm = async () => {
    if (!operatorToDelete) return;
    setDeleting(true);
    try {
      await deleteOperator(operatorToDelete.id);
      toast.success(`${operatorToDelete.nome} excluído.`);
      setOperatorToDelete(null);
    } catch {
      toast.error('Erro ao excluir operador.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumo Industrial */}
      <div className="grid grid-cols-2 sm:grid-cols-6 border border-[var(--border)] rounded-md bg-[var(--surface)] divide-x divide-y sm:divide-y-0 divide-[var(--border)] overflow-hidden">
        <div className="p-3.5 col-span-2">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-3)]" />
            Total Cadastrado
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] font-mono block">
            {stats.total}
          </strong>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
            {stats.ativos} ativos{stats.ferias > 0 ? ` · ${stats.ferias} em férias` : ''}
          </p>
        </div>
        {(['A', 'B', 'C', 'D'] as OperatorTurma[]).map((t) => (
          <div key={t} className="p-3.5">
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TURMAS_INFO[t].cor }} />
              Turma {t}
            </label>
            <strong className="text-xl font-semibold tracking-tight text-[var(--text)] font-mono block">
              {stats.turmasCount[t]}
            </strong>
            <p className="text-[11px] text-[var(--text-3)] mt-0.5">operadores</p>
          </div>
        ))}
      </div>

      {/* Tabela Principal */}
      <div className="bg-[var(--surface)] rounded-md border border-[var(--border)] overflow-hidden">
        {/* Toolbar */}
        <div className="px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text)]">Operadores Cadastrados</span>
            <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              {filteredOperators.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[var(--text-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar nome, matrícula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-2.5 text-xs bg-[var(--surface)] border-[var(--border-strong)] rounded-md w-[190px] text-[var(--text)] placeholder:text-[var(--text-3)]"
              />
            </div>

            <Select value={turmaFilter} onValueChange={(v: any) => setTurmaFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-[var(--surface)] border-[var(--border-strong)] rounded-md w-[105px] text-[var(--text-2)]">
                <SelectValue placeholder="Turma" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]">
                <SelectItem value="ALL">Todas Turmas</SelectItem>
                <SelectItem value="A">Turma A</SelectItem>
                <SelectItem value="B">Turma B</SelectItem>
                <SelectItem value="C">Turma C</SelectItem>
                <SelectItem value="D">Turma D</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-[var(--surface)] border-[var(--border-strong)] rounded-md w-[105px] text-[var(--text-2)]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]">
                <SelectItem value="ALL">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="ferias">Em Férias</SelectItem>
                <SelectItem value="afastado">Afastados</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={onOpenNewOperator}
              className="h-8 px-2.5 text-xs gap-1 font-medium rounded-md bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--surface-2)] text-[var(--text-3)] font-medium text-[11px] border-b border-[var(--border)]">
              <tr>
                <th className="px-3.5 py-2">Operador</th>
                <th className="px-3.5 py-2">Turno</th>
                <th className="px-3.5 py-2 text-center">Turma</th>
                <th className="px-3.5 py-2 text-right">Saldo Folga Flex.</th>
                <th className="px-3.5 py-2 text-center">Status</th>
                <th className="px-3.5 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-[var(--text-3)]">
                    Nenhum operador encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredOperators.map((op) => {
                  const turmaInfo = TURMAS_INFO[op.letra];
                  const turnoInfo = TURNO_LABELS[op.turno];

                  return (
                    <tr key={op.id} className="hover:bg-[var(--hover)] transition-colors group">
                      {/* Operador */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-6 h-6 rounded text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: turmaInfo?.cor || 'var(--accent)' }}
                          >
                            {op.letra}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text)] leading-tight">{op.nome}</p>
                            <p className="text-[var(--text-3)] font-mono text-[11px]">{op.matricula} · {op.cargo}</p>
                          </div>
                        </div>
                      </td>

                      {/* Turno */}
                      <td className="px-3.5 py-2.5">
                        <span className="text-[11px] font-mono text-[var(--text-2)]">
                          T{op.turno} ({turnoInfo?.label})
                        </span>
                      </td>

                      {/* Turma */}
                      <td className="px-3.5 py-2.5 text-center">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded border border-[var(--border-strong)] font-mono text-xs font-semibold"
                          style={{ color: turmaInfo?.cor }}
                        >
                          {op.letra}
                        </span>
                      </td>

                      {/* Saldo de Folgas */}
                      <td className="px-3.5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenSaldoFolgas(op)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-medium transition-colors hover:bg-[var(--hover)] border",
                            op.saldoFolgasFlexiveis > 0
                              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                              : op.saldoFolgasFlexiveis < 0
                              ? "text-red-400 border-red-500/30 bg-red-500/10"
                              : "text-[var(--text-3)] border-[var(--border)] bg-transparent"
                          )}
                          title="Ajustar saldo de folgas"
                        >
                          {op.saldoFolgasFlexiveis > 0 ? `+${op.saldoFolgasFlexiveis}` : op.saldoFolgasFlexiveis}d
                        </button>
                      </td>

                      {/* Status Efetivo */}
                      <td className="px-3.5 py-2.5 text-center">
                        <StatusBadge status={getEffectiveStatus(op)} />
                      </td>

                      {/* Ações */}
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onOpenOcorrencia(op)}
                            className="h-6 px-2 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-weak)] rounded transition-colors"
                            title="Lançar ocorrência"
                          >
                            + Ocorrência
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditOperator(op)}
                            className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOperatorToDelete(op)}
                            className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog
        open={Boolean(operatorToDelete)}
        onOpenChange={(open) => !open && !deleting && setOperatorToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Excluir Operador
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remover{' '}
              <span className="font-bold text-foreground">{operatorToDelete?.nome}</span>{' '}
              ({operatorToDelete?.matricula})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }: { status: OperatorStatus }) {
  const map: Record<OperatorStatus, { label: string; className: string }> = {
    ativo: { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
    ferias: { label: 'Férias', className: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' },
    afastado: { label: 'Afastado', className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
    inativo: { label: 'Inativo', className: 'text-muted-foreground border-border' },
  };
  const s = map[status] || map.inativo;
  return (
    <span className={cn("inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border", s.className)}>
      {s.label}
    </span>
  );
}
