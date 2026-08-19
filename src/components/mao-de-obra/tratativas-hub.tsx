"use client";

import React, { useState, useMemo } from 'react';
import {
  LaborOccurrence,
  Operator,
  ProductionTurno,
  TratativaStatus,
  TratativaPriority,
} from '@/types';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import {
  TRATATIVA_STATUS_META,
  TRATATIVA_ACTION_META,
  TratativaModal,
} from './tratativa-modal';
import { OperadorDossieModal } from './operador-dossie-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  Search,
  Clock,
  User,
  AlertCircle,
  AlertTriangle,
  FileText,
  Stethoscope,
  Building2,
  CheckCircle2,
  Calendar,
  Flame,
  Filter,
  FileSpreadsheet,
  Layers,
  List,
  Sparkles,
  ChevronRight,
  TrendingUp,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateOccurrenceTratativa } from '@/lib/labor-helpers';
import { toast } from 'react-hot-toast';

const PIPELINE_COLUMNS: { id: TratativaStatus; title: string; color: string; border: string; bg: string }[] = [
  {
    id: 'pendente',
    title: 'Pendente de Ação',
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-900/60',
    bg: 'bg-amber-50/40 dark:bg-amber-950/20',
  },
  {
    id: 'em_andamento',
    title: 'Em Andamento',
    color: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-900/60',
    bg: 'bg-blue-50/40 dark:bg-blue-950/20',
  },
  {
    id: 'encaminhado_rh',
    title: 'Encaminhado ao RH',
    color: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-900/60',
    bg: 'bg-purple-50/40 dark:bg-purple-950/20',
  },
  {
    id: 'encaminhado_medicina',
    title: 'SESMT / Medicina',
    color: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-900/60',
    bg: 'bg-rose-50/40 dark:bg-rose-950/20',
  },
  {
    id: 'concluido',
    title: 'Concluído / Resolvido',
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-900/60',
    bg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
  },
];

/**
 * Calcula há quantos dias uma ocorrência está no estágio atual ou parada
 */
function getDaysInCurrentStage(occ: LaborOccurrence): number {
  const now = new Date();
  const rawDate = occ.obsSupervisaoUpdatedAt || occ.updated_at || occ.created_at || occ.dataInicio;

  if (!rawDate) return 0;

  if (typeof rawDate === 'object' && rawDate !== null) {
    if ('toDate' in rawDate && typeof (rawDate as any).toDate === 'function') {
      const d = (rawDate as any).toDate();
      return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
    }
    if ('seconds' in rawDate) {
      const d = new Date((rawDate as any).seconds * 1000);
      return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  if (typeof rawDate === 'string') {
    const parsed = new Date(rawDate.includes('T') ? rawDate : `${rawDate}T12:00:00Z`);
    if (!isNaN(parsed.getTime())) {
      return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  return 0;
}

interface TratativasHubProps {
  occurrences: LaborOccurrence[];
  operators: Operator[];
  selectedTurno: ProductionTurno | 'ALL';
}

export function TratativasHub({
  occurrences,
  operators,
  selectedTurno,
}: TratativasHubProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'reincidentes'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TratativaPriority | 'paradas'>('ALL');
  const [selectedOccForTratativa, setSelectedOccForTratativa] = useState<LaborOccurrence | null>(null);
  const [selectedOperatorForDossie, setSelectedOperatorForDossie] = useState<Operator | null>(null);

  // Estados para Drag and Drop
  const [draggedOccId, setDraggedOccId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TratativaStatus | null>(null);

  // Mapeamento rápido de operadores
  const operatorMap = useMemo(() => {
    const map = new Map<string, Operator>();
    operators.forEach((op) => map.set(op.id, op));
    return map;
  }, [operators]);

  // Contagem de reincidências por operador
  const operatorOccurrencesMap = useMemo(() => {
    const map = new Map<string, LaborOccurrence[]>();
    occurrences.forEach((occ) => {
      const list = map.get(occ.operadorId) || [];
      list.push(occ);
      map.set(occ.operadorId, list);
    });
    return map;
  }, [occurrences]);

  // Ocorrências filtradas
  const filteredOccurrences = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return occurrences.filter((occ) => {
      if (selectedTurno !== 'ALL' && occ.turno !== selectedTurno) return false;

      const status = occ.tratativaStatus || (occ.obsSupervisao?.trim() ? 'concluido' : 'pendente');
      const diasParado = getDaysInCurrentStage(occ);
      const isParada = status !== 'concluido' && diasParado >= 3;

      if (priorityFilter === 'paradas') {
        if (!isParada) return false;
      } else if (priorityFilter !== 'ALL' && (occ.tratativaPriority || 'media') !== priorityFilter) {
        return false;
      }

      if (q) {
        return (
          occ.operadorNome.toLowerCase().includes(q) ||
          (occ.obsSupervisao || '').toLowerCase().includes(q) ||
          (occ.motivo || '').toLowerCase().includes(q) ||
          (occ.queixas || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [occurrences, selectedTurno, priorityFilter, searchQuery]);

  // Operadores reincidentes
  const reincidentesList = useMemo(() => {
    const list: {
      operator: Operator;
      occurrences: LaborOccurrence[];
      faltasCount: number;
      atestadosCount: number;
      pendentesCount: number;
      diasPerdidos: number;
    }[] = [];

    operators.forEach((op) => {
      if (selectedTurno !== 'ALL' && op.turno !== selectedTurno) return;
      const opOccs = operatorOccurrencesMap.get(op.id) || [];
      if (opOccs.length > 0) {
        const faltasCount = opOccs.filter((o) => o.tipo === 'falta_injustificada').length;
        const atestadosCount = opOccs.filter((o) => o.tipo === 'atestado').length;
        const pendentesCount = opOccs.filter(
          (o) => (o.tratativaStatus || (o.obsSupervisao?.trim() ? 'concluido' : 'pendente')) === 'pendente'
        ).length;
        const diasPerdidos = opOccs
          .filter((o) => o.impactaAbsenteismo)
          .reduce((acc, curr) => acc + (curr.dias || 1), 0);

        list.push({
          operator: op,
          occurrences: opOccs,
          faltasCount,
          atestadosCount,
          pendentesCount,
          diasPerdidos,
        });
      }
    });

    return list.sort((a, b) => b.occurrences.length - a.occurrences.length);
  }, [operators, operatorOccurrencesMap, selectedTurno]);

  // Estatísticas do painel e verificação de tratativas paradas fora de 'concluido'
  const stats = useMemo(() => {
    const relevant = occurrences.filter((o) => selectedTurno === 'ALL' || o.turno === selectedTurno);
    const pendentes = relevant.filter(
      (o) => (o.tratativaStatus || (o.obsSupervisao?.trim() ? 'concluido' : 'pendente')) === 'pendente'
    );
    const emAndamento = relevant.filter((o) => o.tratativaStatus === 'em_andamento');
    const encaminhados = relevant.filter(
      (o) => o.tratativaStatus === 'encaminhado_rh' || o.tratativaStatus === 'encaminhado_medicina'
    );
    const concluidos = relevant.filter(
      (o) => (o.tratativaStatus || (o.obsSupervisao?.trim() ? 'concluido' : 'pendente')) === 'concluido'
    );

    // Tratativas paradas por muito tempo (>= 3 dias) em QUALQUER etapa que NÃO seja 'concluido'
    const paradasAtrasadas = relevant.filter((o) => {
      const status = o.tratativaStatus || (o.obsSupervisao?.trim() ? 'concluido' : 'pendente');
      if (status === 'concluido') return false;
      const diasParado = getDaysInCurrentStage(o);
      return diasParado >= 3;
    });

    return {
      total: relevant.length,
      pendentes: pendentes.length,
      emAndamento: emAndamento.length,
      encaminhados: encaminhados.length,
      concluidos: concluidos.length,
      paradasAtrasadas: paradasAtrasadas.length,
    };
  }, [occurrences, selectedTurno]);

  // Mover status via Drag and Drop
  const handleDropOnColumn = async (e: React.DragEvent, targetStatus: TratativaStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggedOccId(null);

    const occId = e.dataTransfer.getData('text/plain');
    if (!occId) return;

    const occ = occurrences.find((o) => o.id === occId);
    if (!occ) return;

    const currentStatus = occ.tratativaStatus || (occ.obsSupervisao?.trim() ? 'concluido' : 'pendente');
    if (currentStatus === targetStatus) return;

    try {
      await updateOccurrenceTratativa(occId, {
        tratativaStatus: targetStatus,
      });
      toast.success(`Tratativa movida para: ${TRATATIVA_STATUS_META[targetStatus].label}`);
    } catch (err) {
      console.error('Erro ao mover tratativa via drag-and-drop:', err);
      toast.error('Erro ao atualizar status da tratativa.');
    }
  };

  // Ação rápida para mover status no Kanban
  const handleQuickMove = async (e: React.MouseEvent, occ: LaborOccurrence, nextStatus: TratativaStatus) => {
    e.stopPropagation();
    try {
      await updateOccurrenceTratativa(occ.id, {
        tratativaStatus: nextStatus,
      });
      toast.success(`Caso movido para: ${TRATATIVA_STATUS_META[nextStatus].label}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status.');
    }
  };

  // Exportar relatório em CSV
  const handleExportCSV = () => {
    const headers = [
      'Operador',
      'Matrícula',
      'Cargo',
      'Turma',
      'Turno',
      'Tipo de Ocorrência',
      'Data Início',
      'Dias',
      'Impacta Absenteísmo',
      'Status Tratativa',
      'Prioridade',
      'Parecer Supervisão',
      'Última Atualização',
    ];

    const rows = filteredOccurrences.map((occ) => {
      const op = operatorMap.get(occ.operadorId);
      return [
        `"${occ.operadorNome}"`,
        `"${op?.matricula || ''}"`,
        `"${occ.operadorCargo}"`,
        `"${occ.operadorLetra}"`,
        `"${occ.turno}"`,
        `"${occ.tipo}"`,
        `"${occ.dataInicio}"`,
        `"${occ.dias}"`,
        `"${occ.impactaAbsenteismo ? 'Sim' : 'Não'}"`,
        `"${TRATATIVA_STATUS_META[occ.tratativaStatus || 'pendente']?.label || 'Pendente'}"`,
        `"${occ.tratativaPriority || 'media'}"`,
        `"${(occ.obsSupervisao || '').replace(/"/g, '""')}"`,
        `"${occ.obsSupervisaoUpdatedAt || occ.created_at}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tratativas_supervisao_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório CSV baixado com sucesso!');
  };

  return (
    <div className="space-y-4">
      {/* Alerta Superior: Exibido APENAS quando há tratativas paradas por muito tempo fora de 'concluido' */}
      {stats.paradasAtrasadas > 0 && (
        <div className="p-3.5 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-950 dark:text-amber-200">
                Atenção: {stats.paradasAtrasadas} tratativa(s) parada(s) há 3 dias ou mais sem conclusão
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300 font-medium">
                Existem casos abertos aguardando avanço de etapa ou encaminhamento para manter o fluxo em dia.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            {priorityFilter === 'paradas' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPriorityFilter('ALL')}
                className="h-7 text-[11px] font-bold bg-white dark:bg-slate-900 border-amber-300 text-amber-900 dark:text-amber-200"
              >
                Limpar Filtro
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setViewMode('kanban');
                  setPriorityFilter('paradas');
                }}
                className="h-7 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-2xs"
              >
                Filtrar Casos Parados
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Métricas e Sumário Superior */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 shadow-2xs">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 tracking-wider">
              Pendentes
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-800 dark:text-amber-200 tabular-nums">
            {stats.pendentes}
          </p>
        </div>

        <div className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 tracking-wider">
              Em Andamento
            </span>
            <Flame className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-xl font-black text-blue-800 dark:text-blue-200 tabular-nums">
            {stats.emAndamento}
          </p>
        </div>

        <div className="p-3 rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 shadow-2xs">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 tracking-wider">
              RH / Medicina
            </span>
            <Building2 className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-xl font-black text-purple-800 dark:text-purple-200 tabular-nums">
            {stats.encaminhados}
          </p>
        </div>

        <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">
              Concluídos
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-800 dark:text-emerald-200 tabular-nums">
            {stats.concluidos}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Reincidentes
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-black text-foreground tabular-nums">
            {reincidentesList.filter((r) => r.occurrences.length > 1).length}
          </p>
        </div>
      </div>

      {/* Toolbar de Controle & Abas de Visão */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Toggle de Modos de Visão */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl shrink-0">
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              viewMode === 'kanban'
                ? 'bg-white dark:bg-slate-900 text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Pipeline (Kanban)
          </button>

          <button
            onClick={() => setViewMode('reincidentes')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              viewMode === 'reincidentes'
                ? 'bg-white dark:bg-slate-900 text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <User className="w-3.5 h-3.5" />
            Por Operador ({reincidentesList.length})
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="w-3.5 h-3.5" />
            Lista Detalhada
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar colaborador ou tratativa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50 dark:bg-slate-950 rounded-xl w-full sm:w-[190px]"
            />
          </div>

          <Select value={priorityFilter} onValueChange={(v: any) => setPriorityFilter(v)}>
            <SelectTrigger className="h-8 text-xs bg-slate-50 dark:bg-slate-950 rounded-xl w-[130px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas Prioridades</SelectItem>
              <SelectItem value="paradas">Paradas &gt; 3d ⚠️</SelectItem>
              <SelectItem value="urgente">Urgente 🔥</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-bold gap-1.5 rounded-xl border-slate-200 dark:border-slate-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* VISÃO 1: PIPELINE KANBAN COM DRAG & DROP E CARDS ULTRA COMPACTOS */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto pb-4 items-start">
          {PIPELINE_COLUMNS.map((col) => {
            const columnOccs = filteredOccurrences.filter((occ) => {
              const st = occ.tratativaStatus || (occ.obsSupervisao?.trim() ? 'concluido' : 'pendente');
              return st === col.id;
            });

            const isCurrentDragOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverColumn !== col.id) {
                    setDragOverColumn(col.id);
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dragOverColumn === col.id) {
                      setDragOverColumn(null);
                    }
                  }
                }}
                onDrop={(e) => handleDropOnColumn(e, col.id)}
                className={cn(
                  'flex flex-col rounded-2xl border p-2.5 min-w-[240px] max-h-[calc(100vh-270px)] min-h-[320px] transition-all duration-150',
                  col.border,
                  col.bg,
                  isCurrentDragOver && 'ring-2 ring-primary ring-offset-2 bg-primary/5 dark:bg-primary/10 border-primary scale-[1.008]'
                )}
              >
                {/* Header da Coluna */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <h4 className={cn('text-[11px] font-black uppercase tracking-wider', col.color)}>
                    {col.title}
                  </h4>
                  <span
                    className={cn(
                      'text-[10px] font-black px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border shadow-2xs',
                      col.color,
                      col.border
                    )}
                  >
                    {columnOccs.length}
                  </span>
                </div>

                {/* Lista de Cards Compactos */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
                  {columnOccs.length === 0 ? (
                    <div className={cn(
                      'p-4 rounded-xl border border-dashed text-center transition-colors',
                      isCurrentDragOver ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-slate-200 dark:border-slate-800 text-muted-foreground'
                    )}>
                      <p className="text-[10px] italic">
                        {isCurrentDragOver ? 'Solte o card aqui' : 'Nenhum caso'}
                      </p>
                    </div>
                  ) : (
                    columnOccs.map((occ) => {
                      const op = operatorMap.get(occ.operadorId);
                      const turmaInfo = TURMAS_INFO[occ.operadorLetra] || TURMAS_INFO.A;
                      const passos = occ.tratativaPassos || [];
                      const isUrgent = occ.tratativaPriority === 'urgente';
                      const isAlta = occ.tratativaPriority === 'alta';
                      const diasParado = getDaysInCurrentStage(occ);
                      const isStuck = col.id !== 'concluido' && diasParado >= 3;
                      const isDragging = draggedOccId === occ.id;

                      return (
                        <div
                          key={occ.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', occ.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedOccId(occ.id);
                          }}
                          onDragEnd={() => {
                            setDraggedOccId(null);
                            setDragOverColumn(null);
                          }}
                          onClick={() => setSelectedOccForTratativa(occ)}
                          className={cn(
                            'p-2.5 rounded-xl border bg-white dark:bg-slate-900 shadow-2xs hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer space-y-1.5 group select-none relative',
                            isUrgent
                              ? 'border-red-300 dark:border-red-900/80 bg-red-50/20 dark:bg-red-950/10'
                              : 'border-slate-200/90 dark:border-slate-800',
                            isDragging && 'opacity-30 border-dashed scale-95 ring-2 ring-primary'
                          )}
                        >
                          {/* Topo do Card Compacto */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className="w-5 h-5 rounded-md text-white font-black text-[9px] flex items-center justify-center shrink-0 shadow-2xs"
                                style={{ backgroundColor: turmaInfo.cor }}
                                title={`Turma ${occ.operadorLetra}`}
                              >
                                {occ.operadorLetra}
                              </div>
                              <p className="text-[11px] font-bold text-foreground truncate max-w-[130px]" title={occ.operadorNome}>
                                {occ.operadorNome}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isUrgent && (
                                <span className="text-[9px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-1 py-0.2 rounded border border-red-200 dark:border-red-800">
                                  🔥 URG
                                </span>
                              )}
                              {isAlta && !isUrgent && (
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                                  ALTA
                                </span>
                              )}
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                            </div>
                          </div>

                          {/* Tipo de Ocorrência & Data / Dias Parados */}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                            <span className="font-semibold text-[9px] uppercase bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded leading-none">
                              {occ.tipo.replace('_', ' ')}
                            </span>
                            <div className="flex items-center gap-1">
                              {isStuck && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-1 py-0.2 rounded"
                                  title={`Parado há ${diasParado} dias nesta etapa`}
                                >
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  {diasParado}d
                                </span>
                              )}
                              <span className="tabular-nums">
                                {new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ({occ.dias}d)
                              </span>
                            </div>
                          </div>

                          {/* Resumo da Tratativa ou Relato em 1 linha compacta */}
                          {occ.obsSupervisao ? (
                            <p className="text-[10px] text-violet-950 dark:text-violet-200 font-medium truncate bg-violet-50/70 dark:bg-violet-950/30 px-1.5 py-0.5 rounded border border-violet-100 dark:border-violet-900/30">
                              {occ.obsSupervisao}
                            </p>
                          ) : (occ.queixas || occ.motivo) ? (
                            <p className="text-[10px] text-muted-foreground truncate italic bg-slate-50/80 dark:bg-slate-950/50 px-1.5 py-0.5 rounded">
                              "{occ.queixas || occ.motivo}"
                            </p>
                          ) : null}

                          {/* Rodapé com Passos & Ações Rápidas */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[9px]">
                            <span className="text-muted-foreground font-semibold">
                              {passos.length} ação(ões)
                            </span>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {col.id === 'pendente' && (
                                <button
                                  onClick={(e) => handleQuickMove(e, occ, 'em_andamento')}
                                  className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/80"
                                >
                                  Iniciar →
                                </button>
                              )}
                              {col.id === 'em_andamento' && (
                                <button
                                  onClick={(e) => handleQuickMove(e, occ, 'concluido')}
                                  className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/80"
                                >
                                  Concluir ✓
                                </button>
                              )}
                              {col.id !== 'concluido' && col.id !== 'pendente' && col.id !== 'em_andamento' && (
                                <button
                                  onClick={(e) => handleQuickMove(e, occ, 'concluido')}
                                  className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/80"
                                >
                                  Concluir ✓
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISÃO 2: PAINEL CONSOLIDADO POR OPERADOR */}
      {viewMode === 'reincidentes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reincidentesList.map((item) => {
            const turmaInfo = TURMAS_INFO[item.operator.letra] || TURMAS_INFO.A;
            const isCritical = item.occurrences.length >= 3 || item.pendentesCount > 0;

            return (
              <div
                key={item.operator.id}
                onClick={() => setSelectedOperatorForDossie(item.operator)}
                className={cn(
                  'p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-2xs hover:shadow-sm transition-all cursor-pointer space-y-3 group',
                  isCritical ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200 dark:border-slate-800'
                )}
              >
                {/* Header do Card do Operador */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0"
                      style={{ backgroundColor: turmaInfo.cor }}
                    >
                      {item.operator.letra}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                        {item.operator.nome}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.operator.cargo} · Turno {item.operator.turno}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                </div>

                {/* Métricas rápidas */}
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-center">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Total</span>
                    <p className="text-xs font-black text-foreground">{item.occurrences.length}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-red-500">Faltas</span>
                    <p className="text-xs font-black text-red-600">{item.faltasCount}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-amber-500">Pendentes</span>
                    <p className="text-xs font-black text-amber-600">{item.pendentesCount}</p>
                  </div>
                </div>

                {/* Lista rápida das últimas 2 ocorrências */}
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-muted-foreground">Últimas Ocorrências:</p>
                  {item.occurrences.slice(0, 2).map((occ) => (
                    <div
                      key={occ.id}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-[10px] uppercase">
                        {occ.tipo.replace('_', ' ')}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Botão Ver Dossiê */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[11px] font-bold gap-1.5 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                >
                  <User className="w-3.5 h-3.5" />
                  Abrir Dossiê do Colaborador
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* VISÃO 3: LISTA DETALHADA */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredOccurrences.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-xs font-semibold text-muted-foreground">Nenhuma tratativa encontrada com os filtros selecionados.</p>
              </div>
            ) : (
              filteredOccurrences.map((occ) => {
                const statusMeta = TRATATIVA_STATUS_META[occ.tratativaStatus || 'pendente'] || TRATATIVA_STATUS_META.pendente;
                const turmaInfo = TURMAS_INFO[occ.operadorLetra] || TURMAS_INFO.A;

                return (
                  <div
                    key={occ.id}
                    onClick={() => setSelectedOccForTratativa(occ)}
                    className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs"
                          style={{ backgroundColor: turmaInfo.cor }}
                        >
                          {occ.operadorLetra}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-foreground truncate">{occ.operadorNome}</p>
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              · {occ.operadorCargo} · Turno {occ.turno}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Ocorrência de <span className="font-bold uppercase text-foreground">{occ.tipo.replace('_', ' ')}</span> em{' '}
                            {new Date(occ.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} ({occ.dias}d)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold',
                            statusMeta.bg,
                            statusMeta.text,
                            statusMeta.border
                          )}
                        >
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                      </div>
                    </div>

                    {occ.obsSupervisao ? (
                      <p className="text-[11px] text-violet-950 dark:text-violet-200 font-medium bg-violet-50/50 dark:bg-violet-950/20 p-2 rounded-xl border border-violet-100 dark:border-violet-900/30 line-clamp-2">
                        <span className="font-bold text-violet-700 dark:text-violet-400">Tratativa: </span>
                        {occ.obsSupervisao}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg">
                        Sem parecer da supervisão registrado. Clique para adicionar ações.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modais de Ação */}
      <TratativaModal
        open={Boolean(selectedOccForTratativa)}
        onOpenChange={(open) => !open && setSelectedOccForTratativa(null)}
        occurrence={selectedOccForTratativa}
        allOccurrencesForOperator={
          selectedOccForTratativa ? operatorOccurrencesMap.get(selectedOccForTratativa.operadorId) || [] : []
        }
      />

      <OperadorDossieModal
        open={Boolean(selectedOperatorForDossie)}
        onOpenChange={(open) => !open && setSelectedOperatorForDossie(null)}
        operator={selectedOperatorForDossie}
        occurrences={occurrences}
      />
    </div>
  );
}

