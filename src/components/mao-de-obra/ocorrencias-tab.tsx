"use client";

import { useMemo, useState } from 'react';
import { OcorrenciaDetalheModal } from './ocorrencia-detalhe-modal';
import { toast } from 'react-hot-toast';
import {
  LaborOccurrence,
  LaborOccurrenceType,
  ProductionTurno,
  Operator,
} from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { deleteLaborOccurrence } from '@/lib/labor-helpers';
import { Button } from '@/components/ui/button';
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
  CalendarDays,
  AlertTriangle,
  Stethoscope,
  Palmtree,
  FileText,
  Trash2,
  Search,
  Plus,
  Zap,
  ShieldCheck,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';

// Metadados visuais por tipo de ocorrência
const OCC_META: Record<LaborOccurrenceType, {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  icon: React.ReactNode;
}> = {
  falta_injustificada: {
    label: 'Falta Injustificada',
    shortLabel: 'Falta Inj.',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900/60',
    dot: 'bg-red-500',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  falta_justificada: {
    label: 'Falta Justificada',
    shortLabel: 'Falta Just.',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900/60',
    dot: 'bg-amber-500',
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  atestado: {
    label: 'Atestado Médico',
    shortLabel: 'Atestado',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-900/60',
    dot: 'bg-rose-500',
    icon: <Stethoscope className="w-3.5 h-3.5" />,
  },
  folga_flexivel: {
    label: 'Folga Flexível',
    shortLabel: 'Folga Flex.',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-900/60',
    dot: 'bg-sky-500',
    icon: <CalendarDays className="w-3.5 h-3.5" />,
  },
  ferias: {
    label: 'Férias',
    shortLabel: 'Férias',
    color: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-900/60',
    dot: 'bg-indigo-500',
    icon: <Palmtree className="w-3.5 h-3.5" />,
  },
  hora_extra: {
    label: 'Hora Extra',
    shortLabel: 'H. Extra',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900/60',
    dot: 'bg-emerald-500',
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  atraso: {
    label: 'Atraso',
    shortLabel: 'Atraso',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-900/60',
    dot: 'bg-orange-500',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

interface OcorrenciasTabProps {
  occurrences: LaborOccurrence[];
  operators: Operator[];
  selectedTurno: ProductionTurno | 'ALL';
  onOpenOcorrencia: () => void;
}

export function OcorrenciasTab({
  occurrences,
  operators,
  selectedTurno,
  onOpenOcorrencia,
}: OcorrenciasTabProps) {
  const { userData } = useFirebase();
  const isSupervisorOrAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin' || userData?.role === 'supervisor';
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LaborOccurrenceType>('ALL');
  const [periodoFilter, setPeriodoFilter] = useState<'mes_atual' | 'todos' | 'ano_2026'>('mes_atual');
  const [occToDelete, setOccToDelete] = useState<LaborOccurrence | null>(null);
  const [occToView, setOccToView] = useState<LaborOccurrence | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredOccurrences = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return occurrences
      .filter((occ) => {
        if (selectedTurno !== 'ALL' && occ.turno !== selectedTurno) return false;
        if (typeFilter !== 'ALL' && occ.tipo !== typeFilter) return false;
        if (periodoFilter === 'mes_atual' && !occ.dataInicio.startsWith(currentMonthStr)) return false;
        if (periodoFilter === 'ano_2026' && !occ.dataInicio.startsWith('2026')) return false;
        if (query) {
          return (
            occ.operadorNome.toLowerCase().includes(query) ||
            (occ.motivo || '').toLowerCase().includes(query) ||
            (occ.queixas || '').toLowerCase().includes(query) ||
            (occ.cid || '').toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
  }, [occurrences, selectedTurno, typeFilter, periodoFilter, searchQuery]);

  // Sumário por tipo (respeitando férias vigentes na data atual)
  const stats = useMemo(() => {
    const all = occurrences.filter((o) => selectedTurno === 'ALL' || o.turno === selectedTurno);
    const todayStr = new Date().toISOString().split('T')[0];

    // Férias ativas no momento (período vigente onde hoje está entre dataInicio e dataFim)
    const feriasAtivas = all.filter(
      (o) => o.tipo === 'ferias' && todayStr >= o.dataInicio && todayStr <= (o.dataFim || o.dataInicio)
    );

    return {
      total: all.length,
      faltasInj: all.filter((o) => o.tipo === 'falta_injustificada').length,
      atestados: all.filter((o) => o.tipo === 'atestado').length,
      folgas: all.filter((o) => o.tipo === 'folga_flexivel').length,
      ferias: feriasAtivas.length,
      atrasos: all.filter((o) => o.tipo === 'atraso').length,
    };
  }, [occurrences, selectedTurno]);

  const handleDeleteConfirm = async () => {
    if (!occToDelete) return;
    setDeleting(true);
    try {
      await deleteLaborOccurrence(occToDelete);
      toast.success('Ocorrência excluída.');
      setOccToDelete(null);
    } catch {
      toast.error('Erro ao excluir ocorrência.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards de Resumo Industrial */}
      <div className="grid grid-cols-2 sm:grid-cols-5 border border-[var(--border)] rounded-md bg-[var(--surface)] divide-x divide-y sm:divide-y-0 divide-[var(--border)] overflow-hidden">
        {[
          { label: 'Faltas Inj.', value: stats.faltasInj, color: 'text-red-400', dot: 'bg-red-500' },
          { label: 'Atestados', value: stats.atestados, color: 'text-rose-400', dot: 'bg-rose-500' },
          { label: 'Folgas Flex.', value: stats.folgas, color: 'text-sky-400', dot: 'bg-sky-500' },
          { label: 'Em Férias (Hoje)', value: stats.ferias, color: 'text-purple-400', dot: 'bg-purple-500' },
          { label: 'Atrasos', value: stats.atrasos, color: 'text-amber-400', dot: 'bg-amber-500' },
        ].map((item) => (
          <div key={item.label} className="p-3.5">
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mb-1">
              <span className={cn("w-1.5 h-1.5 rounded-full", item.dot)} />
              {item.label}
            </label>
            <strong className={cn("text-xl font-semibold tracking-tight font-mono block", item.color)}>
              {item.value}
            </strong>
          </div>
        ))}
      </div>

      {/* Tabela de Ocorrências */}
      <div className="bg-[var(--surface)] rounded-md border border-[var(--border)] overflow-hidden">
        {/* Toolbar */}
        <div className="px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text)]">Histórico de Ocorrências</span>
            <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              {filteredOccurrences.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[var(--text-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar operador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-2.5 text-xs bg-[var(--surface)] border-[var(--border-strong)] rounded-md w-[170px] text-[var(--text)] placeholder:text-[var(--text-3)]"
              />
            </div>

            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-[var(--surface)] border-[var(--border-strong)] rounded-md w-[140px] text-[var(--text-2)]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]">
                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                <SelectItem value="falta_injustificada">Falta Injustificada</SelectItem>
                <SelectItem value="atestado">Atestado Médico</SelectItem>
                <SelectItem value="falta_justificada">Falta Justificada</SelectItem>
                <SelectItem value="folga_flexivel">Folga Flexível</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="atraso">Atraso</SelectItem>
                <SelectItem value="hora_extra">Hora Extra</SelectItem>
              </SelectContent>
            </Select>

            <Select value={periodoFilter} onValueChange={(v: any) => setPeriodoFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-[var(--surface)] border-[var(--border-strong)] rounded-md w-[120px] text-[var(--text-2)]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]">
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="ano_2026">Ano 2026</SelectItem>
                <SelectItem value="todos">Todo Histórico</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={onOpenOcorrencia}
              className="h-8 px-2.5 text-xs gap-1 font-medium rounded-md bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova
            </Button>
          </div>
        </div>

        {/* Cabeçalho da tabela */}
        {filteredOccurrences.length > 0 && (
          <div className="hidden md:grid md:grid-cols-[1fr_140px_130px_70px_80px] px-3.5 py-2 border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-3)]">
            <span>Colaborador</span>
            <span className="text-center">Tipo</span>
            <span className="text-center">Período</span>
            <span className="text-center">Dias</span>
            <span className="text-right">Ações</span>
          </div>
        )}

        {/* Linhas */}
        <div className="divide-y divide-[var(--border)]">
          {filteredOccurrences.length === 0 ? (
            <div className="py-14 text-center text-xs text-[var(--text-3)]">
              Nenhuma ocorrência encontrada para os filtros aplicados.
            </div>
          ) : (
            filteredOccurrences.map((occ) => {
              const meta = OCC_META[occ.tipo] || OCC_META.falta_injustificada;
              const turmaInfo = TURMAS_INFO[occ.operadorLetra];
              const hasObsSupervisao = Boolean(occ.obsSupervisao);

              const dataInicioFmt = new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              const dataFimFmt = occ.dataFim && occ.dataFim !== occ.dataInicio
                ? new Date(occ.dataFim + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                : null;
              const anoInicio = new Date(occ.dataInicio + 'T12:00:00Z').getFullYear();

              return (
                <div
                  key={occ.id}
                  className="group flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--hover)] transition-colors cursor-pointer md:grid md:grid-cols-[1fr_140px_130px_70px_80px] md:gap-0 md:items-center"
                  onClick={() => setOccToView(occ)}
                >
                  {/* Operador */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-6 h-6 rounded text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: turmaInfo?.cor || 'var(--accent)' }}
                    >
                      {occ.operadorLetra}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-medium text-[var(--text)] truncate">{occ.operadorNome}</p>
                        {isSupervisorOrAdmin && hasObsSupervisao && (
                          <span title="Tratativas registradas pela supervisão">
                            <ShieldCheck className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-3)] font-mono truncate">
                        {occ.operadorCargo} · T{occ.turno}
                      </p>
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="hidden sm:flex items-center justify-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]">
                      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                      <span className="truncate">{meta.shortLabel}</span>
                    </span>
                  </div>

                  {/* Período */}
                  <div className="hidden md:flex flex-col items-center">
                    <p className="text-xs font-mono text-[var(--text)] tabular-nums">
                      {dataInicioFmt}
                      {dataFimFmt && (
                        <span className="text-[var(--text-3)]"> → {dataFimFmt}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--text-3)] font-mono">{anoInicio}</p>
                  </div>

                  {/* Dias */}
                  <div className="hidden md:flex justify-center">
                    <span className="font-mono text-xs font-semibold text-[var(--text)] bg-[var(--surface-2)] px-2 py-0.5 rounded border border-[var(--border)]">
                      {occ.dias || 1}d
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setOccToDelete(occ)}
                      className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir ocorrência"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-3)] group-hover:text-[var(--text)] transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de Detalhe */}
      <OcorrenciaDetalheModal
        open={Boolean(occToView)}
        onOpenChange={(open) => !open && setOccToView(null)}
        occurrence={occToView}
        occurrences={occurrences}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={Boolean(occToDelete)} onOpenChange={(open) => !open && !deleting && setOccToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Excluir Ocorrência
            </AlertDialogTitle>
            <AlertDialogDescription>
              Excluir ocorrência de{' '}
              <span className="font-bold text-foreground">{occToDelete?.operadorNome}</span>?
              {' '}Esta ação não pode ser desfeita.
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
