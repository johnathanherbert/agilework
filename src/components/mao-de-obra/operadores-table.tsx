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
  2: { label: '15:50–23:50', color: 'text-orange-600 dark:text-orange-400', icon: <Sunset className="w-3 h-3" /> },
  3: { label: '23:50–07:20', color: 'text-blue-600 dark:text-blue-400', icon: <Moon className="w-3 h-3" /> },
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
      <div className="grid grid-cols-2 sm:grid-cols-5 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] divide-x divide-y sm:divide-y-0 divide-[var(--border)] overflow-hidden">
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            Total
          </label>
          <strong className="text-xl font-semibold tracking-tight text-[var(--text)] block">
            {stats.total}
          </strong>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {stats.ativos} ativos · {stats.ferias} em férias
          </p>
        </div>
        {(['A', 'B', 'C', 'D'] as OperatorTurma[]).map((t) => (
          <div key={t} className="p-3.5">
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded font-mono text-[10px] font-bold"
                style={{
                  backgroundColor: TURMAS_INFO[t]?.cor ? `${TURMAS_INFO[t].cor}22` : 'var(--accent-weak)',
                  color: TURMAS_INFO[t]?.cor || 'var(--accent)',
                  border: `1px solid ${TURMAS_INFO[t]?.cor ? `${TURMAS_INFO[t].cor}55` : 'var(--border-strong)'}`
                }}
              >
                {t}
              </span>
              Turma {t}
            </label>
            <strong className="text-xl font-semibold tracking-tight text-[var(--text)] block">
              {stats.turmasCount[t]}
            </strong>
            <p className="text-xs text-[var(--text-3)] mt-0.5">operadores</p>
          </div>
        ))}
      </div>

      {/* Tabela Principal */}
      <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text)]">Operadores Cadastrados</span>
            <span className="text-xs font-mono text-[var(--text-3)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              {filteredOperators.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Busca Industrial */}
            <label className="search-industrial w-[220px] cursor-text">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <input
                placeholder="Buscar nome ou matrícula"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>

            {/* Turma Industrial */}
            <select
              value={turmaFilter}
              onChange={(e) => setTurmaFilter(e.target.value as any)}
              className="select-industrial"
            >
              <option value="ALL">Todas as turmas</option>
              <option value="A">Turma A</option>
              <option value="B">Turma B</option>
              <option value="C">Turma C</option>
              <option value="D">Turma D</option>
            </select>

            {/* Status Industrial */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="select-industrial"
            >
              <option value="ALL">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="ferias">Em Férias</option>
              <option value="afastado">Afastados</option>
              <option value="inativo">Inativos</option>
            </select>

            <Button
              size="sm"
              onClick={onOpenNewOperator}
              className="h-8 px-3 text-xs gap-1.5 font-medium rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Operador
            </Button>

            {onOpenImportarMassa && (
              <button
                type="button"
                onClick={onOpenImportarMassa}
                className="h-8 px-2.5 text-xs gap-1.5 font-medium rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors inline-flex items-center cursor-pointer"
                title="Importar operadores em lote"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Importar
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[var(--surface-2)] text-[var(--text-3)] font-medium text-xs border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5">Operador</th>
                <th className="px-4 py-2.5">Turno</th>
                <th className="px-4 py-2.5 text-center">Turma</th>
                <th className="px-4 py-2.5 text-right">Saldo folga flex.</th>
                <th className="px-4 py-2.5 text-center">Situação hoje</th>
                <th className="px-4 py-2.5 text-right w-[160px]"></th>
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
                  const effStatus = getEffectiveStatus(op);

                  return (
                    <tr key={op.id} className="hover:bg-[var(--hover)] transition-colors group">
                      {/* Operador */}
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-[var(--text)] leading-tight">{op.nome}</p>
                          <p className="text-[var(--text-3)] font-mono text-[11px]">{op.matricula} · {op.cargo}</p>
                        </div>
                      </td>

                      {/* Turno */}
                      <td className="px-4 py-2.5">
                        <span className="text-[11.5px] font-mono text-[var(--text)]">
                          T{op.turno}
                        </span>{' '}
                        <span className="text-[11px] font-mono text-[var(--text-3)]">
                          {turnoInfo?.label}
                        </span>
                      </td>

                      {/* Turma */}
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className="inline-grid place-items-center w-5 h-5 rounded-[4px] font-mono text-[11px] font-bold border"
                          style={{
                            backgroundColor: turmaInfo?.cor ? `${turmaInfo.cor}22` : 'var(--surface-2)',
                            color: turmaInfo?.cor || 'var(--text)',
                            borderColor: turmaInfo?.cor ? `${turmaInfo.cor}55` : 'var(--border-strong)',
                          }}
                        >
                          {op.letra}
                        </span>
                      </td>

                      {/* Saldo de Folgas */}
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenSaldoFolgas(op)}
                          className={cn(
                            "font-mono text-xs hover:underline cursor-pointer",
                            (op.saldoFolgasFlexiveis || 0) < 0
                              ? "text-[var(--red)] font-semibold"
                              : (op.saldoFolgasFlexiveis || 0) > 0
                              ? "text-[var(--text)] font-semibold"
                              : "text-[var(--text-3)]"
                          )}
                          title="Ajustar saldo de folgas"
                        >
                          {(op.saldoFolgasFlexiveis || 0) > 0 ? `+${op.saldoFolgasFlexiveis}` : op.saldoFolgasFlexiveis || 0} d
                        </button>
                      </td>

                      {/* Status Efetivo */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)]">
                          <i
                            className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                            style={{
                              backgroundColor:
                                effStatus === 'ativo' ? 'var(--green)' :
                                effStatus === 'ferias' ? 'var(--violet)' :
                                effStatus === 'afastado' ? 'var(--amber)' : 'var(--text-3)',
                            }}
                          />
                          <span>
                            {effStatus === 'ativo' ? 'Presente' : effStatus === 'ferias' ? 'Em férias' : effStatus === 'afastado' ? 'Afastado' : 'Inativo'}
                          </span>
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onOpenOcorrencia(op)}
                            className="h-6 px-2 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors cursor-pointer"
                            title="Lançar ocorrência"
                          >
                            + Ocorrência
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditOperator(op)}
                            className="h-6 w-6 rounded-[var(--radius)] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                            title="Editar operador"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOperatorToDelete(op)}
                            className="h-6 w-6 rounded-[var(--radius)] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                            title="Excluir operador"
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
        <AlertDialogContent className="rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--red)] flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4" />
              Excluir Operador
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[var(--text-3)]">
              Remover <strong className="text-[var(--text)]">{operatorToDelete?.nome}</strong> ({operatorToDelete?.matricula})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-[var(--border)] pt-3 gap-2">
            <AlertDialogCancel disabled={deleting} className="h-8 text-xs rounded-[var(--radius)] border-[var(--border-strong)]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }}
              disabled={deleting}
              className="h-8 text-xs rounded-[var(--radius)] bg-[var(--red)] text-white hover:opacity-90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
