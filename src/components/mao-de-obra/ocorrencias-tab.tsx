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
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const OCC_META: Record<LaborOccurrenceType, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  falta_injustificada: { label: 'Falta Injustificada', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900/50', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  falta_justificada: { label: 'Falta Justificada', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900/50', icon: <FileText className="w-3.5 h-3.5" /> },
  atestado: { label: 'Atestado Médico', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-900/50', icon: <Stethoscope className="w-3.5 h-3.5" /> },
  folga_flexivel: { label: 'Folga Flexível', color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-900/50', icon: <CalendarDays className="w-3.5 h-3.5" /> },
  ferias: { label: 'Férias', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-900/50', icon: <Palmtree className="w-3.5 h-3.5" /> },
  hora_extra: { label: 'Hora Extra', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900/50', icon: <Zap className="w-3.5 h-3.5" /> },
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
            (occ.cid || '').toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
  }, [occurrences, selectedTurno, typeFilter, periodoFilter, searchQuery]);

  // Sumário dos tipos
  const stats = useMemo(() => {
    const all = occurrences.filter((o) => selectedTurno === 'ALL' || o.turno === selectedTurno);
    return {
      total: all.length,
      faltasInj: all.filter((o) => o.tipo === 'falta_injustificada').length,
      atestados: all.filter((o) => o.tipo === 'atestado').length,
      folgas: all.filter((o) => o.tipo === 'folga_flexivel').length,
      ferias: all.filter((o) => o.tipo === 'ferias').length,
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
      {/* Sumário Compacto */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Faltas Inj.', value: stats.faltasInj, color: 'text-red-600', light: 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' },
          { label: 'Atestados', value: stats.atestados, color: 'text-rose-600', light: 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' },
          { label: 'Folgas Flex.', value: stats.folgas, color: 'text-sky-600', light: 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50' },
          { label: 'Férias', value: stats.ferias, color: 'text-indigo-600', light: 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50' },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-2xl p-4 border shadow-xs", item.light)}>
            <p className={cn("text-[10px] uppercase font-bold tracking-wider", item.color)}>{item.label}</p>
            <p className={cn("text-2xl font-black mt-1", item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela de Ocorrências */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-black text-foreground">
            Histórico de Ocorrências
            <span className="ml-2 text-xs font-bold text-muted-foreground">({filteredOccurrences.length})</span>
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[160px]"
              />
            </div>

            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                <SelectItem value="falta_injustificada">Falta Injustificada</SelectItem>
                <SelectItem value="atestado">Atestado</SelectItem>
                <SelectItem value="falta_justificada">Falta Justificada</SelectItem>
                <SelectItem value="folga_flexivel">Folga Flexível</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="hora_extra">Hora Extra</SelectItem>
              </SelectContent>
            </Select>

            <Select value={periodoFilter} onValueChange={(v: any) => setPeriodoFilter(v)}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg w-[120px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="ano_2026">2026</SelectItem>
                <SelectItem value="todos">Todo Histórico</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={onOpenOcorrencia}
              className="h-8 text-xs gap-1 font-bold rounded-lg bg-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredOccurrences.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Nenhuma ocorrência encontrada.
            </div>
          ) : (
            filteredOccurrences.map((occ) => {
              const meta = OCC_META[occ.tipo] || OCC_META.falta_injustificada;
              const turmaInfo = TURMAS_INFO[occ.operadorLetra];
              const isFolga = occ.tipo === 'folga_flexivel';
              const isCredito = isFolga && occ.tipoFolgaFlexivel === 'concessao';

              return (
                <div
                  key={occ.id}
                  className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  onClick={() => setOccToView(occ)}
                >
                  {/* Tipo */}
                  <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold shrink-0", meta.color, meta.bg, meta.border)}>
                    {meta.icon}
                    <span className="hidden sm:inline">{meta.label}</span>
                    {isFolga && (
                      isCredito
                        ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                        : <TrendingDown className="w-3 h-3 text-red-500" />
                    )}
                  </div>

                  {/* Operador */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: turmaInfo.cor }}
                    >
                      {occ.operadorLetra}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{occ.operadorNome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {occ.operadorCargo} · T{occ.turno}
                        {occ.cid && <span className="ml-1 px-1 bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded font-mono text-[9px]">CID: {occ.cid}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Período */}
                  <div className="text-center shrink-0 hidden sm:block">
                    <p className="text-xs font-bold font-mono text-foreground">
                      {new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                      {occ.dataFim && occ.dataFim !== occ.dataInicio && (
                        <span className="text-muted-foreground"> → {new Date(occ.dataFim + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">{occ.dias}d</p>
                  </div>

                  {/* Motivo */}
                  {occ.motivo && (
                    <p className="text-[11px] text-muted-foreground italic truncate max-w-[140px] hidden md:block">
                      {occ.motivo}
                    </p>
                  )}

                  {/* Excluir */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOccToDelete(occ); }}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de Detalhe da Ocorrência */}
      <OcorrenciaDetalheModal
        open={Boolean(occToView)}
        onOpenChange={(open) => !open && setOccToView(null)}
        occurrence={occToView}
      />

      {/* Dialog de Confirmação de Exclusão */}
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
              {occToDelete?.tipo === 'folga_flexivel' && ' O saldo de folgas será recalculado automaticamente.'}
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
