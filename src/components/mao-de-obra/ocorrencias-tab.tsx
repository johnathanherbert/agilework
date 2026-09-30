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
      <div className="grid grid-cols-2 sm:grid-cols-5 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] divide-x divide-y sm:divide-y-0 divide-[var(--border)] overflow-hidden">
        <div className={cn("p-3.5", stats.faltasInj > 0 && "bg-red-500/5")}>
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
            Faltas injustificadas
          </label>
          <strong className={cn("text-xl font-semibold tracking-tight font-mono block", stats.faltasInj > 0 ? "text-[var(--red)]" : "text-[var(--text)]")}>
            {stats.faltasInj}
          </strong>
        </div>
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
            Atestados
          </label>
          <strong className="text-xl font-semibold tracking-tight font-mono block text-[var(--text)]">
            {stats.atestados}
          </strong>
        </div>
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />
            Folgas flexíveis
          </label>
          <strong className="text-xl font-semibold tracking-tight font-mono block text-[var(--text)]">
            {stats.folgas}
          </strong>
        </div>
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--violet)]" />
            Em férias hoje
          </label>
          <strong className="text-xl font-semibold tracking-tight font-mono block text-[var(--text)]">
            {stats.ferias}
          </strong>
        </div>
        <div className="p-3.5">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-3)]" />
            Atrasos
          </label>
          <strong className="text-xl font-semibold tracking-tight font-mono block text-[var(--text)]">
            {stats.atrasos}
          </strong>
        </div>
      </div>

      {/* Tabela de Ocorrências */}
      <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
        {/* Toolbar */}
        <div className="px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text)]">Ocorrências</span>
            <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              {filteredOccurrences.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Busca Industrial */}
            <label className="search-industrial w-[200px] cursor-text">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <input
                placeholder="Buscar colaborador"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>

            {/* Tipo Industrial */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="select-industrial"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="falta_injustificada">Falta Injustificada</option>
              <option value="atestado">Atestado Médico</option>
              <option value="falta_justificada">Falta Justificada</option>
              <option value="folga_flexivel">Folga Flexível</option>
              <option value="ferias">Férias</option>
              <option value="atraso">Atraso</option>
              <option value="hora_extra">Hora Extra</option>
            </select>

            {/* Período Industrial */}
            <select
              value={periodoFilter}
              onChange={(e) => setPeriodoFilter(e.target.value as any)}
              className="select-industrial"
            >
              <option value="mes_atual">Mês atual</option>
              <option value="ano_2026">Ano 2026</option>
              <option value="todos">Todo o período</option>
            </select>

            <Button
              size="sm"
              onClick={onOpenOcorrencia}
              className="h-8 px-2.5 text-xs gap-1 font-medium rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ocorrência
            </Button>
          </div>
        </div>

        {/* Tabela Formatada */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[var(--surface-2)] text-[var(--text-3)] font-medium text-xs border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5">Colaborador</th>
                <th className="px-4 py-2.5 text-center">Turma</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5 text-center">Período</th>
                <th className="px-4 py-2.5 text-right">Dias</th>
                <th className="px-4 py-2.5">Observação</th>
                <th className="px-4 py-2.5 text-right w-[90px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredOccurrences.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs text-[var(--text-3)]">
                    Nenhuma ocorrência encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredOccurrences.map((occ) => {
                  const meta = OCC_META[occ.tipo] || OCC_META.falta_injustificada;
                  const turmaInfo = TURMAS_INFO[occ.operadorLetra];
                  const hasObsSupervisao = Boolean(occ.obsSupervisao);

                  const dataInicioFmt = new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  const dataFimFmt = occ.dataFim && occ.dataFim !== occ.dataInicio
                    ? new Date(occ.dataFim + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : null;

                  return (
                    <tr
                      key={occ.id}
                      onClick={() => setOccToView(occ)}
                      className="hover:bg-[var(--hover)] transition-colors cursor-pointer group"
                    >
                      {/* Colaborador */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-[var(--text)] leading-tight">{occ.operadorNome}</p>
                          {isSupervisorOrAdmin && hasObsSupervisao && (
                            <span title="Tratativa da supervisão registrada">
                              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-3)] font-mono">{occ.operadorCargo} · T{occ.turno}</p>
                      </td>

                      {/* Turma */}
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className="inline-grid place-items-center w-5 h-5 rounded-[4px] font-mono text-[11px] font-bold border"
                          style={{
                            backgroundColor: turmaInfo ? `${turmaInfo.cor}22` : 'var(--surface-2)',
                            color: turmaInfo?.cor || 'var(--text)',
                            borderColor: turmaInfo ? `${turmaInfo.cor}55` : 'var(--border-strong)',
                          }}
                        >
                          {occ.operadorLetra}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)] whitespace-nowrap">
                          <i
                            className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                            style={{
                              backgroundColor:
                                occ.tipo === 'atestado' ? 'var(--amber)' :
                                occ.tipo === 'falta_injustificada' ? 'var(--red)' :
                                occ.tipo === 'falta_justificada' ? 'var(--amber)' :
                                occ.tipo === 'folga_flexivel' ? 'var(--blue)' :
                                occ.tipo === 'ferias' ? 'var(--violet)' : 'var(--text-3)'
                            }}
                          />
                          <span>{meta.shortLabel}</span>
                        </span>
                      </td>

                      {/* Período */}
                      <td className="px-4 py-2.5 text-center font-mono text-xs text-[var(--text)] whitespace-nowrap">
                        {dataInicioFmt}
                        {dataFimFmt && <span className="text-[var(--text-3)]"> → {dataFimFmt}</span>}
                      </td>

                      {/* Dias */}
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-2)]">
                        {occ.dias || 1}
                      </td>

                      {/* Observação */}
                      <td className="px-4 py-2.5 text-[var(--text-3)] text-xs max-w-[240px] truncate">
                        {occ.motivo || occ.queixas || occ.cid || '—'}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setOccToView(occ)}
                            className="h-6 w-6 rounded-[var(--radius)] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                            title="Ver detalhes"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOccToDelete(occ)}
                            className="h-6 w-6 rounded-[var(--radius)] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                            title="Excluir ocorrência"
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
