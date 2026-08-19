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
      {/* Cards de Resumo Compactos */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs col-span-3 sm:col-span-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total</p>
          <p className="text-xl font-black text-foreground">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground">
            {stats.ativos} ativos{stats.ferias > 0 ? ` · ${stats.ferias} em férias` : ''}
          </p>
        </div>
        {(['A', 'B', 'C', 'D'] as OperatorTurma[]).map((t) => (
          <div
            key={t}
            className="rounded-xl p-3 shadow-xs border"
            style={{ borderColor: `${TURMAS_INFO[t].cor}40`, backgroundColor: `${TURMAS_INFO[t].cor}0a` }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <div
                className="w-4 h-4 rounded text-white text-[9px] font-black flex items-center justify-center"
                style={{ backgroundColor: TURMAS_INFO[t].cor }}
              >
                {t}
              </div>
              <p className="text-[10px] uppercase font-bold" style={{ color: TURMAS_INFO[t].cor }}>Turma {t}</p>
            </div>
            <p className="text-xl font-black" style={{ color: TURMAS_INFO[t].cor }}>{stats.turmasCount[t]}</p>
          </div>
        ))}
      </div>

      {/* Tabela Principal */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-black text-foreground">
            Operadores de Produção
            <span className="ml-2 text-xs font-bold text-muted-foreground">({filteredOperators.length})</span>
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[170px]"
              />
            </div>

            <Select value={turmaFilter} onValueChange={(v: any) => setTurmaFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[100px]">
                <SelectValue placeholder="Turma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="A">Turma A</SelectItem>
                <SelectItem value="B">Turma B</SelectItem>
                <SelectItem value="C">Turma C</SelectItem>
                <SelectItem value="D">Turma D</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[100px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="ferias">Em Férias</SelectItem>
                <SelectItem value="afastado">Afastados</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>

            {onOpenImportarMassa && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenImportarMassa}
                className="h-8 text-xs gap-1 font-bold rounded-lg border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Importar
              </Button>
            )}

            <Button
              size="sm"
              onClick={onOpenNewOperator}
              className="h-8 text-xs gap-1 font-bold rounded-lg bg-primary hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-2.5">Operador</th>
                <th className="px-4 py-2.5">Turno</th>
                <th className="px-4 py-2.5 text-center">Turma</th>
                <th className="px-4 py-2.5 text-center">Folgas Flex.</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhum operador encontrado.
                  </td>
                </tr>
              ) : (
                filteredOperators.map((op) => {
                  const turmaInfo = TURMAS_INFO[op.letra];
                  const turnoInfo = TURNO_LABELS[op.turno];
                  const initials = op.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'OP';

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Operador */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs"
                            style={{ backgroundColor: turmaInfo.cor }}
                          >
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-foreground leading-tight">{op.nome}</p>
                            <p className="text-muted-foreground font-mono text-[10px]">{op.matricula} · {op.cargo}</p>
                          </div>
                        </div>
                      </td>

                      {/* Turno */}
                      <td className="px-4 py-3">
                        <div className={cn("flex items-center gap-1 font-bold", turnoInfo.color)}>
                          {turnoInfo.icon}
                          <span className="text-[11px]">T{op.turno} · {turnoInfo.label}</span>
                        </div>
                      </td>

                      {/* Turma */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-white text-xs font-black shadow-xs"
                          style={{ backgroundColor: turmaInfo.cor }}
                        >
                          {op.letra}
                        </span>
                      </td>

                      {/* Saldo de Folgas */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenSaldoFolgas(op)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all hover:scale-105 cursor-pointer shadow-xs border",
                            op.saldoFolgasFlexiveis > 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : op.saldoFolgasFlexiveis < 0
                              ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                              : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                          )}
                          title="Ajustar saldo de folgas"
                        >
                          <CalendarDays className="w-3 h-3" />
                          {op.saldoFolgasFlexiveis > 0 ? `+${op.saldoFolgasFlexiveis}` : op.saldoFolgasFlexiveis}d
                        </button>
                      </td>

                      {/* Status Efetivo (Ativo vs Férias Vigentes) */}
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={getEffectiveStatus(op)} />
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenOcorrencia(op)}
                            className="h-7 px-2 text-[11px] font-bold text-primary hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-colors"
                            title="Lançar ocorrência"
                          >
                            + Ocorrência
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditOperator(op)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOperatorToDelete(op)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
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
