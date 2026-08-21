"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
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
import {
  Operator,
  LaborOccurrence,
  LaborOccurrenceType,
} from '@/types';
import { createLaborOccurrence } from '@/lib/labor-helpers';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import {
  AlertTriangle,
  Stethoscope,
  CalendarDays,
  FileText,
  Palmtree,
  CheckCircle2,
  Loader2,
  Calendar,
  Zap,
  MessageSquare,
  Search,
  ChevronDown,
  X,
  UserCheck,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OcorrenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operators: Operator[];
  selectedOperator?: Operator | null;
  defaultDate?: string;
  defaultType?: LaborOccurrenceType;
  occurrences?: LaborOccurrence[];
  onSuccess?: () => void;
}

const OCCURRENCE_TYPES: {
  id: LaborOccurrenceType;
  label: string;
  descricao: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  activeBg: string;
  activeText: string;
}[] = [
  {
    id: 'falta_injustificada',
    label: 'Falta Injustificada',
    descricao: 'Ausência sem justificativa',
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    activeBg: 'bg-red-600',
    activeText: 'text-white',
  },
  {
    id: 'falta_justificada',
    label: 'Falta Justificada',
    descricao: 'Ausência com declaração',
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    activeBg: 'bg-amber-500',
    activeText: 'text-white',
  },
  {
    id: 'atestado',
    label: 'Atestado Médico',
    descricao: 'Afastamento com documento médico',
    icon: Stethoscope,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    activeBg: 'bg-rose-600',
    activeText: 'text-white',
  },
  {
    id: 'folga_flexivel',
    label: 'Folga Flexível',
    descricao: 'Gozo do banco de folgas',
    icon: CalendarDays,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-800',
    activeBg: 'bg-sky-500',
    activeText: 'text-white',
  },
  {
    id: 'ferias',
    label: 'Férias',
    descricao: 'Período regulamentar de férias',
    icon: Palmtree,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800',
    activeBg: 'bg-indigo-600',
    activeText: 'text-white',
  },
  {
    id: 'atraso',
    label: 'Atraso',
    descricao: 'Chegada após o horário previsto',
    icon: Clock,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-800',
    activeBg: 'bg-orange-500',
    activeText: 'text-white',
  },
  {
    id: 'hora_extra',
    label: 'Hora Extra',
    descricao: 'Trabalho em folga ou feriado',
    icon: Zap,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    activeBg: 'bg-emerald-600',
    activeText: 'text-white',
  },
];

export function OcorrenciaModal({
  open,
  onOpenChange,
  operators,
  selectedOperator,
  defaultDate,
  defaultType = 'falta_injustificada',
  occurrences = [],
  onSuccess,
}: OcorrenciaModalProps) {
  const [operatorId, setOperatorId] = useState<string>('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [tipo, setTipo] = useState<LaborOccurrenceType>(defaultType);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [dias, setDias] = useState<number>(1);
  const [diasFerias, setDiasFerias] = useState<number>(30);
  const [horasImpacto, setHorasImpacto] = useState<number>(8);
  const [minutosAtraso, setMinutosAtraso] = useState<number>(0);
  const [queixas, setQueixas] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    const today = defaultDate || new Date().toISOString().split('T')[0];
    setDataInicio(today);
    setTipo(defaultType);
    setQueixas('');
    setMotivo('');
    setMinutosAtraso(0);
    setOperatorSearch('');
    setDropdownOpen(false);

    if (defaultType === 'ferias') {
      const start = new Date(today + 'T12:00:00Z');
      const end = new Date(start);
      end.setDate(end.getDate() + 29);
      setDataFim(end.toISOString().split('T')[0]);
      setDias(30);
      setDiasFerias(30);
      setHorasImpacto(240);
    } else {
      setDataFim(today);
      setDias(1);
      setDiasFerias(30);
      setHorasImpacto(8);
    }

    if (selectedOperator) {
      setOperatorId(selectedOperator.id);
    } else if (operators.length > 0) {
      setOperatorId(operators[0].id);
    }
  }, [selectedOperator, defaultDate, defaultType, open, operators]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recalcula dias quando dataInicio ou dataFim mudam (se não for férias)
  useEffect(() => {
    if (tipo !== 'ferias' && dataInicio && dataFim) {
      const dt1 = new Date(dataInicio + 'T12:00:00Z');
      const dt2 = new Date(dataFim + 'T12:00:00Z');
      const diffDays = Math.max(1, Math.round((dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      setDias(diffDays);
      setHorasImpacto(diffDays * 8);
    }
  }, [dataInicio, dataFim, tipo]);

  // Muda de tipo de ocorrência
  const handleSelectTipo = (newTipo: LaborOccurrenceType) => {
    setTipo(newTipo);
    if (newTipo === 'ferias') {
      const numDays = diasFerias || 30;
      const start = new Date((dataInicio || new Date().toISOString().split('T')[0]) + 'T12:00:00Z');
      const end = new Date(start);
      end.setDate(end.getDate() + numDays - 1);
      setDataFim(end.toISOString().split('T')[0]);
      setDias(numDays);
      setHorasImpacto(numDays * 8);
    } else if (tipo === 'ferias') {
      setDataFim(dataInicio);
      setDias(1);
      setHorasImpacto(8);
    }
  };

  // Alteração de dias de férias (input simples)
  const handleDiasFeriasChange = (numDays: number) => {
    const validDays = Math.max(1, numDays || 1);
    setDiasFerias(validDays);
    setDias(validDays);
    setHorasImpacto(validDays * 8);
    if (dataInicio) {
      const start = new Date(dataInicio + 'T12:00:00Z');
      const end = new Date(start);
      end.setDate(end.getDate() + validDays - 1);
      setDataFim(end.toISOString().split('T')[0]);
    }
  };

  // Alteração de data de início
  const handleDataInicioChange = (newDateStr: string) => {
    setDataInicio(newDateStr);
    if (tipo === 'ferias') {
      const numDays = diasFerias || 30;
      const start = new Date(newDateStr + 'T12:00:00Z');
      const end = new Date(start);
      end.setDate(end.getDate() + numDays - 1);
      setDataFim(end.toISOString().split('T')[0]);
    }
  };

  // Data de retorno (dia seguinte ao término)
  const dataRetorno = useMemo(() => {
    if (!dataFim) return '';
    const nextDay = new Date(dataFim + 'T12:00:00Z');
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toLocaleDateString('pt-BR');
  }, [dataFim]);

  // Filtra operadores na busca
  const filteredOperators = operators.filter((op) => {
    const q = operatorSearch.toLowerCase();
    if (!q) return true;
    return (
      op.nome.toLowerCase().includes(q) ||
      op.matricula.toLowerCase().includes(q) ||
      op.cargo.toLowerCase().includes(q) ||
      op.letra.toLowerCase().includes(q)
    );
  });

  const activeOp = operators.find((op) => op.id === operatorId) || selectedOperator;
  const activeTipoMeta = OCCURRENCE_TYPES.find((t) => t.id === tipo);

  // Alerta simples: outros colaboradores do mesmo turno de férias no mesmo período
  const conflitosFerias = useMemo(() => {
    if (tipo !== 'ferias' || !activeOp || !dataInicio || !dataFim) return [];
    const myStart = new Date(dataInicio + 'T12:00:00Z');
    const myEnd = new Date(dataFim + 'T12:00:00Z');

    const list: {
      nome: string;
      cargo: string;
      turma: string;
      dataInicio: string;
      dataFim: string;
    }[] = [];

    (occurrences || []).forEach((occ) => {
      if (occ.tipo !== 'ferias') return;
      if (occ.operadorId === activeOp.id) return;
      if (activeOp.turno && occ.turno !== activeOp.turno) return;

      const occStart = new Date(occ.dataInicio + 'T12:00:00Z');
      const occEnd = new Date((occ.dataFim || occ.dataInicio) + 'T12:00:00Z');

      if (myStart <= occEnd && myEnd >= occStart) {
        list.push({
          nome: occ.operadorNome,
          cargo: occ.operadorCargo,
          turma: occ.operadorLetra,
          dataInicio: occ.dataInicio,
          dataFim: occ.dataFim || occ.dataInicio,
        });
      }
    });

    return list;
  }, [tipo, activeOp, dataInicio, dataFim, occurrences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId) { toast.error('Selecione um operador.'); return; }
    if (!dataInicio) { toast.error('Informe a data de início.'); return; }
    if (!activeOp) { toast.error('Operador não encontrado.'); return; }

    setSaving(true);
    try {
      await createLaborOccurrence({
        operadorId: activeOp.id,
        operadorNome: activeOp.nome,
        operadorCargo: activeOp.cargo,
        operadorLetra: activeOp.letra,
        turno: activeOp.turno,
        tipo,
        dataInicio,
        dataFim: dataFim || dataInicio,
        dias,
        horasImpacto,
        minutosAtraso: tipo === 'atraso' ? minutosAtraso : undefined,
        motivo: motivo.trim(),
        queixas: tipo === 'atestado' ? queixas.trim() : undefined,
        tipoFolgaFlexivel: tipo === 'folga_flexivel' ? 'debito' : undefined,
      });
      toast.success('Ocorrência registrada com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar ocorrência.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[92vh]">

          {/* ── Header ── */}
          <div className="shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 pt-6 pb-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <CalendarDays className="h-4 w-4 text-indigo-300" />
                </div>
                Registrar Ocorrência
              </DialogTitle>
            </DialogHeader>

            {/* Operador selecionado */}
            {activeOp && (
              <div className="mt-4 flex items-center gap-3 bg-white/8 rounded-xl px-4 py-3 border border-white/10">
                <div
                  className="w-10 h-10 rounded-xl text-white font-black text-sm flex items-center justify-center shrink-0 shadow-lg"
                  style={{ backgroundColor: TURMAS_INFO[activeOp.letra]?.cor }}
                >
                  {activeOp.letra}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white truncate">{activeOp.nome}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {activeOp.cargo} &middot; Turma {activeOp.letra} &middot; Turno {activeOp.turno}
                  </p>
                </div>
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            )}
          </div>

          {/* ── Corpo ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">

              {/* Seleção de Operador */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {activeOp ? 'Trocar Colaborador' : 'Colaborador *'}
                </Label>

                <div className="relative" ref={dropdownRef}>
                  <div
                    className={cn(
                      "flex items-center gap-2 h-10 px-3 rounded-xl border bg-white dark:bg-slate-950 cursor-text transition-all",
                      dropdownOpen
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                    onClick={() => { setDropdownOpen(true); setTimeout(() => searchRef.current?.focus(), 40); }}
                  >
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder={activeOp ? `Buscar para trocar (atual: ${activeOp.nome})` : "Buscar por nome, matrícula ou cargo..."}
                      value={operatorSearch}
                      onChange={(e) => { setOperatorSearch(e.target.value); setDropdownOpen(true); }}
                      onFocus={() => setDropdownOpen(true)}
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground min-w-0"
                    />
                    {operatorSearch && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setOperatorSearch(''); searchRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0", dropdownOpen && "rotate-180")} />
                  </div>

                  {dropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredOperators.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                              Nenhum resultado para <span className="font-semibold">"{operatorSearch}"</span>
                            </p>
                          </div>
                        ) : (
                          filteredOperators.map((op) => {
                            const turmaInfo = TURMAS_INFO[op.letra];
                            const isSelected = op.id === operatorId;
                            return (
                              <button
                                key={op.id}
                                type="button"
                                onClick={() => { setOperatorId(op.id); setOperatorSearch(''); setDropdownOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                                  isSelected
                                    ? "bg-primary/5 dark:bg-primary/10"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                                )}
                              >
                                <div
                                  className="w-9 h-9 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm"
                                  style={{ backgroundColor: turmaInfo.cor }}
                                >
                                  {op.letra}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={cn("text-sm font-bold truncate", isSelected ? "text-primary" : "text-foreground")}>
                                    {op.nome}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {op.matricula} &middot; {op.cargo} &middot; T{op.turno}
                                  </p>
                                </div>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo de Ocorrência */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tipo de Ocorrência *
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {OCCURRENCE_TYPES.map((item) => {
                    const Icon = item.icon;
                    const selected = tipo === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectTipo(item.id)}
                        className={cn(
                          "relative p-3 rounded-xl border text-left flex items-center gap-3 transition-all duration-150",
                          selected
                            ? cn("border-transparent shadow-md", item.bg, item.border, "ring-2", `ring-offset-1`)
                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-300"
                        )}
                        style={selected ? { '--tw-ring-color': 'currentColor' } as React.CSSProperties : undefined}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          selected ? item.activeBg : "bg-slate-100 dark:bg-slate-800"
                        )}>
                          <Icon className={cn("h-4 w-4", selected ? "text-white" : "text-slate-500 dark:text-slate-400")} />
                        </div>
                        <div className="min-w-0">
                          <p className={cn(
                            "text-xs font-bold leading-tight truncate",
                            selected ? item.color : "text-foreground"
                          )}>{item.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.descricao}</p>
                        </div>
                        {selected && (
                          <span className={cn("absolute top-2 right-2 w-1.5 h-1.5 rounded-full", item.activeBg)} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Período */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Período
                </Label>

                {tipo === 'ferias' ? (
                  /* Layout simplificado para Férias */
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Data Início *</p>
                        <Input
                          id="dataInicio"
                          type="date"
                          required
                          value={dataInicio}
                          onChange={(e) => handleDataInicioChange(e.target.value)}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Dias de Férias</p>
                        <Input
                          type="number"
                          min="1"
                          max="60"
                          value={diasFerias}
                          onChange={(e) => handleDiasFeriasChange(Number(e.target.value))}
                          className="h-10 text-sm font-bold text-center border-indigo-300 dark:border-indigo-800 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Data Término</p>
                        <Input
                          id="dataFim"
                          type="date"
                          required
                          value={dataFim}
                          onChange={(e) => {
                            setDataFim(e.target.value);
                            if (dataInicio && e.target.value) {
                              const dt1 = new Date(dataInicio + 'T12:00:00Z');
                              const dt2 = new Date(e.target.value + 'T12:00:00Z');
                              const diff = Math.max(1, Math.round((dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                              setDiasFerias(diff);
                              setDias(diff);
                              setHorasImpacto(diff * 8);
                            }
                          }}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Data de Retorno simples */}
                    {dataRetorno && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 text-xs">
                        <span className="text-indigo-800 dark:text-indigo-300 font-medium">
                          Data da Volta ao Trabalho:
                        </span>
                        <span className="font-black text-indigo-700 dark:text-indigo-300">
                          {dataRetorno}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Layout padrão para demais ocorrências */
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Início *</p>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="dataInicio"
                          type="date"
                          required
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="pl-9 h-10 text-sm rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Término *</p>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="dataFim"
                          type="date"
                          required
                          min={dataInicio}
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="pl-9 h-10 text-sm rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumo de duração */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 flex-1">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">Duração:</span>
                    <span className="text-sm font-black text-foreground">{dias} {dias === 1 ? 'dia' : 'dias'}</span>
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">Impacto:</span>
                    <span className="text-sm font-black text-foreground">{horasImpacto}h</span>
                  </div>
                </div>
              </div>

              {/* Alerta simples de Férias Coincidentes no Mesmo Turno */}
              {tipo === 'ferias' && conflitosFerias.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    Atenção: colaborador já de férias no Turno {activeOp?.turno} neste período
                  </p>
                  {conflitosFerias.map((c, i) => (
                    <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 pl-5">
                      • <span className="font-semibold">{c.nome}</span> ({c.cargo} · Turma {c.turma}): {new Date(c.dataInicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} a {new Date(c.dataFim + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                    </p>
                  ))}
                </div>
              )}

              {/* Minutos de Atraso */}
              {tipo === 'atraso' && (
                <div className="space-y-1.5 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40">
                  <Label htmlFor="minutosAtraso" className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    Duração do Atraso (minutos) *
                  </Label>
                  <Input
                    id="minutosAtraso"
                    type="number"
                    min="1"
                    max="480"
                    placeholder="Ex: 30"
                    value={minutosAtraso || ''}
                    onChange={(e) => setMinutosAtraso(Number(e.target.value))}
                    className="bg-white dark:bg-slate-950 border-orange-200 dark:border-orange-900/50 focus-visible:ring-orange-400 rounded-xl"
                  />
                </div>
              )}

              {/* Queixas (atestado) */}
              {tipo === 'atestado' && (
                <div className="space-y-1.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                  <Label htmlFor="queixas" className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Queixas / Motivo do Atestado
                  </Label>
                  <Input
                    id="queixas"
                    placeholder="Ex: Dor lombar, gripe, problema gastrointestinal..."
                    value={queixas}
                    onChange={(e) => setQueixas(e.target.value)}
                    className="bg-white dark:bg-slate-950 border-rose-200 dark:border-rose-900/50 focus-visible:ring-rose-400"
                  />
                </div>
              )}

              {/* Motivo / Observações */}
              <div className="space-y-1.5">
                <Label htmlFor="motivo" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Observações / Justificativa
                </Label>
                <Input
                  id="motivo"
                  placeholder={
                    tipo === 'falta_injustificada' ? 'Ex: Operador não compareceu e não comunicou...'
                    : tipo === 'falta_justificada' ? 'Ex: Apresentou declaração de comparecimento médico...'
                    : tipo === 'atestado' ? 'Ex: Atestado de 2 dias emitido pelo Dr. Silva em 12/08...'
                    : tipo === 'folga_flexivel' ? 'Ex: Folga solicitada e aprovada pela supervisão...'
                    : tipo === 'ferias' ? 'Ex: Férias programadas...'
                    : 'Ex: Operador solicitou e trabalhou na folga dupla...'
                  }
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 px-5 py-4 border-t border-border bg-slate-50/80 dark:bg-slate-900/60 flex items-center gap-3">
            {/* Preview do tipo selecionado */}
            {activeTipoMeta && (
              <div className={cn("hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold flex-1 min-w-0", activeTipoMeta.color, activeTipoMeta.bg, activeTipoMeta.border)}>
                <activeTipoMeta.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{activeTipoMeta.label}</span>
              </div>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !operatorId}
              className={cn(
                "gap-2 font-bold rounded-xl px-5 transition-all",
                activeTipoMeta
                  ? cn(activeTipoMeta.activeBg, "hover:opacity-90 text-white border-transparent")
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Registrando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />Confirmar</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
