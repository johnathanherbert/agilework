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
      <DialogContent className="max-w-[600px] p-0 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text)]">Lançar ocorrência</h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {activeOp
                  ? `Colaborador: ${activeOp.nome} · Turma ${activeOp.letra} · Turno ${activeOp.turno}`
                  : 'Registre faltas, atestados, folgas flexíveis ou férias na escala.'}
              </p>
            </div>
          </div>

          {/* Corpo */}
          <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
            {/* Seleção de Colaborador */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Colaborador *</label>
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex items-center gap-2 h-8.5 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg)] cursor-text transition-colors"
                  onClick={() => { setDropdownOpen(true); setTimeout(() => searchRef.current?.focus(), 40); }}
                >
                  <Search className="w-3.5 h-3.5 text-[var(--text-3)] shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder={activeOp ? `${activeOp.nome} (Matrícula: ${activeOp.matricula})` : "Buscar colaborador..."}
                    value={operatorSearch}
                    onChange={(e) => { setOperatorSearch(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    className="flex-1 text-xs bg-transparent outline-none placeholder:text-[var(--text-3)] text-[var(--text)] min-w-0"
                  />
                  {operatorSearch && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOperatorSearch(''); searchRef.current?.focus(); }}
                      className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown className={cn("w-3.5 h-3.5 text-[var(--text-3)] transition-transform duration-200 shrink-0", dropdownOpen && "rotate-180")} />
                </div>

                {dropdownOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] shadow-2xl overflow-hidden">
                    <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
                      {filteredOperators.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-[var(--text-3)]">
                          Nenhum colaborador encontrado.
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
                                "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer",
                                isSelected ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"
                              )}
                            >
                              <div
                                className="w-6 h-6 rounded font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border"
                                style={{
                                  backgroundColor: turmaInfo ? `${turmaInfo.cor}22` : 'var(--surface-2)',
                                  color: turmaInfo?.cor || 'var(--text)',
                                  borderColor: turmaInfo ? `${turmaInfo.cor}55` : 'var(--border-strong)',
                                }}
                              >
                                {op.letra}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={cn("text-xs font-medium truncate", isSelected ? "text-[var(--text)] font-semibold" : "text-[var(--text-2)]")}>
                                  {op.nome}
                                </p>
                                <p className="text-[11px] text-[var(--text-3)] font-mono truncate">
                                  {op.matricula} · {op.cargo} · T{op.turno}
                                </p>
                              </div>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}
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
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Tipo de ocorrência *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {OCCURRENCE_TYPES.map((item) => {
                  const selected = tipo === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTipo(item.id)}
                      className={cn(
                        "h-8 px-2.5 rounded-[var(--radius)] border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-medium",
                        selected
                          ? "bg-[var(--hover)] border-[var(--border-strong)] text-[var(--text)] font-semibold shadow-xs"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Período */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Período de ausência *</label>
              {tipo === 'ferias' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-[var(--text-3)] block">Início</span>
                    <input
                      type="date"
                      required
                      value={dataInicio}
                      onChange={(e) => handleDataInicioChange(e.target.value)}
                      className="h-8.5 w-full px-2.5 text-xs font-mono bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-[var(--text-3)] block">Dias</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={diasFerias}
                      onChange={(e) => handleDiasFeriasChange(Number(e.target.value))}
                      className="h-8.5 w-full px-2.5 text-xs font-mono font-semibold text-center bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-[var(--text-3)] block">Término</span>
                    <input
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
                      className="h-8.5 w-full px-2.5 text-xs font-mono bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-[var(--text-3)] block">Início</span>
                    <input
                      type="date"
                      required
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="h-8.5 w-full px-2.5 text-xs font-mono bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-[var(--text-3)] block">Término</span>
                    <input
                      type="date"
                      required
                      min={dataInicio}
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="h-8.5 w-full px-2.5 text-xs font-mono bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              )}

              {/* Resumo de dias */}
              <div className="flex items-center justify-between px-3 py-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-xs font-mono text-[var(--text-3)]">
                <span>Duração: <strong className="text-[var(--text)]">{dias} {dias === 1 ? 'dia' : 'dias'}</strong></span>
                <span>Impacto: <strong className="text-[var(--text)]">{horasImpacto}h</strong></span>
              </div>
            </div>

            {/* Atraso minutos */}
            {tipo === 'atraso' && (
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Duração do atraso (minutos) *</label>
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="Ex: 30"
                  value={minutosAtraso || ''}
                  onChange={(e) => setMinutosAtraso(Number(e.target.value))}
                  className="h-8.5 w-full px-3 text-xs font-mono bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            {/* Queixas (atestado) */}
            {tipo === 'atestado' && (
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)]">Queixa médica / CID (Opcional)</label>
                <input
                  placeholder="Ex: Gripe, dor lombar, consulta médica..."
                  value={queixas}
                  onChange={(e) => setQueixas(e.target.value)}
                  className="h-8.5 w-full px-3 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-3)]">Observações / Justificativa</label>
              <textarea
                placeholder="Opcional: detalhes adicionais..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="h-16 w-full p-2.5 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
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
              disabled={saving || !operatorId}
              className="h-8 px-3.5 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
            >
              {saving ? 'Salvando...' : 'Salvar ocorrência'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
