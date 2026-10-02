'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AgingData, RemessaData, ConfiguracaoResiduais, LoteInvestigacao } from '@/types/aging';
import { copyToClipboard, cn } from '@/lib/utils';
import { isMaterialEspecial } from '@/lib/materiais-especiais';
import { addLoteInvestigacao, removeLoteInvestigacao, triggerSapAutomation, checkSapAutomationStatus } from '@/lib/dashpesagem-api';
import { generateDevolverZwm296Vbs, DevolverVolumeItem } from './residuais-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  Columns,
  Lock,
  Copy,
  ArrowRightLeft,
  AlertTriangle,
  X,
  RefreshCw,
  Loader2,
  Undo2,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface ColumnDef {
  k: string;
  l: string;
  s?: boolean; // sortable
  f: 'txt' | 'sel' | 'num'; // filter type
  on: boolean; // default visible
  r?: boolean; // align right
}

const DEFAULT_COLS: ColumnDef[] = [
  { k: 'material', l: 'Material', s: true, f: 'txt', on: true },
  { k: 'texto_breve_material', l: 'Descrição', s: true, f: 'txt', on: true },
  { k: 'lote', l: 'Lote', s: true, f: 'txt', on: true },
  { k: 'centro', l: 'Centro', s: true, f: 'sel', on: false },
  { k: 'deposito', l: 'Depósito', s: true, f: 'sel', on: false },
  { k: 'tipo_deposito', l: 'Tipo dep.', s: true, f: 'sel', on: true },
  { k: 'posicao_deposito', l: 'Posição', s: true, f: 'sel', on: true },
  { k: 'estoque_disponivel', l: 'Quantidade', s: true, f: 'num', on: true, r: true },
  { k: 'unidade_medida', l: 'UMB', s: true, f: 'sel', on: false },
  { k: 'valor_unitario', l: 'Val. unit.', s: true, f: 'num', on: true, r: true },
  { k: 'valor_total', l: 'Val. total', s: true, f: 'num', on: true, r: true },
  { k: 'dias_aging', l: 'Aging', s: true, f: 'num', on: true, r: true },
  { k: 'status_aging', l: 'Status', s: true, f: 'sel', on: true },
  { k: 'ultimo_movimento', l: 'Últ. mov.', s: true, f: 'txt', on: true },
  { k: 'tipo_estoque', l: 'Tipo est.', s: true, f: 'sel', on: true },
  { k: 'remessas', l: 'Remessas', s: true, f: 'num', on: true, r: true },
];

export interface EnrichedRow extends AgingData {
  id_row: string;
  valor_unitario: number;
  valor_total: number;
  remessas: number;
  status_crit: 'ok' | 'al' | 'cr';
  status_label: string;
  is_res: boolean;
  res_nivel: 'v' | 'a' | 'r' | null;
  is_inf: boolean;
  is_cfa: boolean;
  is_controlado: boolean;
  is_investigacao: boolean;
  is_blocked?: boolean;
}

interface AgingTableProps {
  data: AgingData[];
  valores?: Record<string, number>;
  remessas?: RemessaData[];
  configResiduais?: ConfiguracaoResiduais;
  lotesInvestigacao?: LoteInvestigacao[];
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  residuaisActive?: boolean;
  onToggleResiduais?: () => void;
  onOpenMoverModal?: (selectedRows: EnrichedRow[]) => void;
  onInvestigacaoChange?: () => void;
  onDevolver?: (selectedRows: EnrichedRow[]) => void;
  selectedMaterialFilter?: string;
  onClearMaterialFilter?: () => void;
  currentUserEmail?: string;
  onAtualizarDb?: () => void;
}

export function AgingTable({
  data,
  valores = {},
  remessas = [],
  configResiduais,
  lotesInvestigacao = [],
  searchTerm = '',
  onSearchChange,
  residuaisActive = false,
  onToggleResiduais,
  onOpenMoverModal,
  onInvestigacaoChange,
  onDevolver,
  selectedMaterialFilter,
  onClearMaterialFilter,
  currentUserEmail,
  onAtualizarDb,
}: AgingTableProps) {
  const [cols, setCols] = useState<ColumnDef[]>(DEFAULT_COLS);
  const [colsPopOpen, setColsPopOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});
  const [sortField, setSortField] = useState<string>('material');
  const [sortDir, setSortDir] = useState<number>(1); // 1 asc, -1 desc
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [blockedMap, setBlockedMap] = useState<Record<string, boolean>>({});
  const [resNivelFilter, setResNivelFilter] = useState<'all' | 'v' | 'a' | 'r'>('all');
  const [isMoverSRunning, setIsMoverSRunning] = useState(false);
  const lastSelectedRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Estados do Modal de Devolução Fracionada (/nzwm296)
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [devolverMaterial, setDevolverMaterial] = useState('');
  const [devolverDescricao, setDevolverDescricao] = useState('');
  const [devolverLote, setDevolverLote] = useState('');
  const [devolverUnidade, setDevolverUnidade] = useState('KG');
  const [devolverSaldoTotal, setDevolverSaldoTotal] = useState(0);
  const [devolverVolumes, setDevolverVolumes] = useState<DevolverVolumeItem[]>([
    { id: '1', quantidade: '', volume: '1' },
  ]);
  const [isDevolverRunning, setIsDevolverRunning] = useState(false);

  // Atalho '/' para focar a busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeFiltersCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) =>
      typeof v === 'object' && v !== null ? (v.min || v.max) : Boolean(v)
    ).length;
  }, [columnFilters]);

  const diasAlerta = configResiduais?.dias_alerta ?? 7;
  const diasCritico = configResiduais?.dias_critico ?? 15;
  const limiteVerde = (configResiduais?.limite_verde ?? 100) / 1000; // converter g para kg
  const limiteAmarelo = (configResiduais?.limite_amarelo ?? 900) / 1000;
  const limiteMaximo = (configResiduais?.limite_maximo ?? 999) / 1000;

  // Carregar colunas salvas do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dp_cols_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCols((prev) =>
          prev.map((col) => (parsed[col.k] !== undefined ? { ...col, on: !!parsed[col.k] } : col))
        );
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleToggleCol = (key: string) => {
    setCols((prev) => {
      const updated = prev.map((c) => (c.k === key ? { ...c, on: !c.on } : c));
      try {
        const storeMap: Record<string, boolean> = {};
        updated.forEach((c) => {
          storeMap[c.k] = c.on;
        });
        localStorage.setItem('dp_cols_config', JSON.stringify(storeMap));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  // Mapa de remessas e investigações
  const remessasCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of remessas) {
      map[r.material] = (map[r.material] || 0) + 1;
    }
    return map;
  }, [remessas]);

  const lotesInvSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of lotesInvestigacao) {
      if (item.lote) set.add(item.lote.trim().toUpperCase());
    }
    return set;
  }, [lotesInvestigacao]);

  // Enriquecer dados
  const enrichedData = useMemo<EnrichedRow[]>(() => {
    return data.map((item, idx) => {
      const id_row = `${item.material}-${item.lote}-${item.posicao_deposito || idx}`;
      const vu = valores[item.material] || valores[item.material.replace(/^0+/, '')] || 0;
      const qtd = Number(item.estoque_disponivel) || 0;
      const vt = Math.max(0, qtd) * vu;
      const dias = item.dias_aging || 0;

      let status_crit: 'ok' | 'al' | 'cr' = 'ok';
      let status_label = 'Normal';
      if (dias > diasCritico) {
        status_crit = 'cr';
        status_label = 'Crítico';
      } else if (dias >= diasAlerta) {
        status_crit = 'al';
        status_label = 'Alerta';
      }

      // Regra de Residual: somente UMB=KG, 0 < qtd <= limiteMaximo
      const isKg = (item.unidade_medida || 'KG').toUpperCase() === 'KG';
      const is_res = isKg && qtd > 0 && qtd <= limiteMaximo;
      let res_nivel: 'v' | 'a' | 'r' | null = null;
      if (is_res) {
        if (qtd <= limiteVerde) res_nivel = 'v';
        else if (qtd <= limiteAmarelo) res_nivel = 'a';
        else res_nivel = 'r';
      }

      const especial = isMaterialEspecial(item.material);
      const is_inf = especial === 'inf';
      const is_cfa = especial === 'cfa';
      const is_controlado = (item.texto_breve_material || '').includes('**');
      const is_investigacao = lotesInvSet.has((item.lote || '').trim().toUpperCase());

      return {
        ...item,
        id_row,
        valor_unitario: vu,
        valor_total: vt,
        remessas: remessasCountMap[item.material] || 0,
        status_crit,
        status_label,
        is_res,
        res_nivel,
        is_inf,
        is_cfa,
        is_controlado,
        is_investigacao,
      };
    });
  }, [data, valores, remessasCountMap, lotesInvSet, diasAlerta, diasCritico, limiteVerde, limiteAmarelo, limiteMaximo]);

  // Filtragem e Ordenação
  const filteredAndSorted = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();

    return enrichedData
      .filter((row) => {
        // Filtro de material específico vindo do Top 10
        if (selectedMaterialFilter && row.material !== selectedMaterialFilter) {
          return false;
        }

        // Filtro de Residuais
        if (residuaisActive) {
          if (!row.is_res) return false;
          if (resNivelFilter !== 'all' && row.res_nivel !== resNivelFilter) return false;
        }

        // Busca global
        if (q) {
          const match =
            row.material.toLowerCase().includes(q) ||
            (row.texto_breve_material || '').toLowerCase().includes(q) ||
            row.lote.toLowerCase().includes(q) ||
            (row.posicao_deposito || '').toLowerCase().includes(q);
          if (!match) return false;
        }

        // Filtros por coluna
        for (const [key, filterVal] of Object.entries(columnFilters)) {
          if (filterVal === undefined || filterVal === null || filterVal === '') continue;

          if (typeof filterVal === 'object') {
            // Range min/max
            const val = Number((row as any)[key]) || 0;
            if (filterVal.min !== undefined && filterVal.min !== '' && val < Number(filterVal.min)) return false;
            if (filterVal.max !== undefined && filterVal.max !== '' && val > Number(filterVal.max)) return false;
          } else {
            const raw = String((row as any)[key] || '').toLowerCase();
            const search = String(filterVal).toLowerCase();
            if (!raw.includes(search)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA = (a as any)[sortField];
        let valB = (b as any)[sortField];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * sortDir;
        }

        return String(valA || '').localeCompare(String(valB || ''), 'pt-BR') * sortDir;
      });
  }, [enrichedData, searchTerm, selectedMaterialFilter, residuaisActive, resNivelFilter, columnFilters, sortField, sortDir]);

  // Contagem e Estatísticas de Residuais
  const residualStats = useMemo(() => {
    let countTotal = 0;
    let countV = 0;
    let countA = 0;
    let countR = 0;
    let valorTotal = 0;

    for (const item of enrichedData) {
      if (item.is_res) {
        countTotal++;
        valorTotal += item.valor_total;
        if (item.res_nivel === 'v') countV++;
        else if (item.res_nivel === 'a') countA++;
        else if (item.res_nivel === 'r') countR++;
      }
    }

    return { countTotal, countV, countA, countR, valorTotal };
  }, [enrichedData]);

  // Itens Selecionados
  const selectedRowsList = useMemo(() => {
    return filteredAndSorted.filter((r) => selectedIds[r.id_row]);
  }, [filteredAndSorted, selectedIds]);

  const selectedTotalValue = useMemo(() => {
    return selectedRowsList.reduce((acc, r) => acc + r.valor_total, 0);
  }, [selectedRowsList]);

  // Handlers de Ordenação
  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) {
      setSortDir((prev) => -prev);
    } else {
      setSortField(fieldKey);
      setSortDir(1);
    }
  };

  // Seleção com Shift+Click
  const handleRowCheckbox = (row: EnrichedRow, index: number, event: React.MouseEvent) => {
    const isChecked = !selectedIds[row.id_row];

    if (event.shiftKey && lastSelectedRef.current !== null) {
      const start = Math.min(lastSelectedRef.current, index);
      const end = Math.max(lastSelectedRef.current, index);
      const nextMap = { ...selectedIds };

      for (let i = start; i <= end; i++) {
        const item = filteredAndSorted[i];
        if (item) {
          nextMap[item.id_row] = true;
        }
      }
      setSelectedIds(nextMap);
    } else {
      setSelectedIds((prev) => {
        const next = { ...prev };
        if (isChecked) next[row.id_row] = true;
        else delete next[row.id_row];
        return next;
      });
    }

    lastSelectedRef.current = index;
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds({});
      return;
    }
    const nextMap: Record<string, boolean> = {};
    for (const r of filteredAndSorted) {
      nextMap[r.id_row] = true;
    }
    setSelectedIds(nextMap);
  };

  // Ações em Massa
  const handleCopyTSV = async () => {
    if (selectedRowsList.length === 0) return;
    const headers = ['Material', 'Descrição', 'Lote', 'Centro', 'Depósito', 'Tipo dep.', 'Posição', 'Quantidade', 'UMB', 'Val. unit.', 'Val. total', 'Aging', 'Status'];
    const rows = selectedRowsList.map((l) => [
      l.material,
      l.texto_breve_material,
      l.lote,
      l.centro || '600',
      l.deposito || 'PES',
      l.tipo_deposito || 'PES',
      l.posicao_deposito || '',
      l.estoque_disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
      l.unidade_medida || 'KG',
      l.valor_unitario.toFixed(2).replace('.', ','),
      l.valor_total.toFixed(2).replace('.', ','),
      l.dias_aging,
      l.status_label,
    ].join('\t'));

    const text = [headers.join('\t'), ...rows].join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${selectedRowsList.length} linhas copiadas (cole no Excel)`);
  };

  const handleCopyMIGO = async () => {
    if (selectedRowsList.length === 0) return;
    const lines = selectedRowsList.map((d) => {
      // Sequência exata: codigo[2tabs]qtd[2tabs]umr[2tabs]Y84[1tab]centro[3tabs]pes[2tabs]pes[1tab]9000
      return [
        d.material,           // codigo
        '',                   // tab vazio
        d.estoque_disponivel.toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
          useGrouping: false  // Remove separador de milhares
        }),                   // qtd (quantidade com vírgula decimal)
        '',                   // tab vazio
        d.unidade_medida || 'KG', // umr (KG, G, etc)
        '',                   // tab vazio
        '',                   // tab vazio (Y84 já preenchido aqui)
        d.centro || '600',    // centro
        '',                   // tab vazio
        '',                   // tab vazio
        d.deposito || 'PES',  // pes
        '',                   // tab vazio
        d.deposito || 'PES',  // pes
        '9000',               // 9000
      ].join('\t');
    });

    const text = lines.join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success('Itens copiados no formato MIGO');
  };

  const handleCopyLotes = async () => {
    if (selectedRowsList.length === 0) return;
    const text = selectedRowsList.map((l) => l.lote).join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${selectedRowsList.length} lotes copiados`);
  };

  const handleToggleBlock = () => {
    if (selectedRowsList.length === 0) return;
    const anyUnblocked = selectedRowsList.some((l) => !blockedMap[l.lote]);
    setBlockedMap((prev) => {
      const next = { ...prev };
      selectedRowsList.forEach((l) => {
        next[l.lote] = anyUnblocked;
      });
      return next;
    });
    toast.success(
      `${selectedRowsList.length} lote(s) ${anyUnblocked ? 'bloqueados' : 'desbloqueados'}`
    );
  };

  const handleToggleInvestigacao = async () => {
    if (selectedRowsList.length === 0) return;
    const anyNotInInv = selectedRowsList.some((l) => !l.is_investigacao);
    const toastId = toast.loading(
      anyNotInInv ? 'Marcando em investigação...' : 'Removendo da investigação...'
    );

    try {
      for (const item of selectedRowsList) {
        if (anyNotInInv) {
          await addLoteInvestigacao({
            lote: item.lote,
            material: item.material,
            motivo: 'Marcado em lote na tabela de aging',
          });
        } else {
          await removeLoteInvestigacao(item.lote);
        }
      }
      toast.success(
        `${selectedRowsList.length} lote(s) ${anyNotInInv ? 'marcados em investigação' : 'removidos da investigação'}`,
        { id: toastId }
      );
      onInvestigacaoChange?.();
    } catch {
      toast.error('Erro ao atualizar investigação', { id: toastId });
    }
  };

  const totalDevolvendo = useMemo(() => {
    return devolverVolumes.reduce((acc, v) => {
      const parsed = parseFloat(v.quantidade.replace(',', '.')) || 0;
      return acc + parsed;
    }, 0);
  }, [devolverVolumes]);

  const saldoRestante = useMemo(() => {
    return Number((devolverSaldoTotal - totalDevolvendo).toFixed(3));
  }, [devolverSaldoTotal, totalDevolvendo]);

  const isOverSaldo = totalDevolvendo > devolverSaldoTotal + 0.0001;
  const isZeroRestante = Math.abs(saldoRestante) <= 0.0001 && totalDevolvendo > 0;

  const handleOpenDevolver = () => {
    if (selectedRowsList.length !== 1) {
      toast.error('Selecione exatamente 1 item para devolução');
      return;
    }
    const item = selectedRowsList[0];
    const rawEstoque = item.estoque_disponivel;
    const numEstoque =
      typeof rawEstoque === 'number'
        ? rawEstoque
        : parseFloat(String(rawEstoque).replace(',', '.')) || 0;
    const quantidadeFormatada = numEstoque.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });
    setDevolverMaterial(item.material);
    setDevolverDescricao(item.texto_breve_material || '');
    setDevolverLote(item.lote);
    setDevolverUnidade(item.unidade_medida?.toUpperCase() || 'KG');
    setDevolverSaldoTotal(numEstoque);
    setDevolverVolumes([
      { id: '1', quantidade: quantidadeFormatada, volume: '1' },
    ]);
    setDevolverOpen(true);
  };

  const handleAddVolume = () => {
    setDevolverVolumes((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        quantidade: '',
        volume: String(prev.length + 1),
      },
    ]);
  };

  const handleRemoveVolume = (idx: number) => {
    if (devolverVolumes.length <= 1) return;
    setDevolverVolumes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateVolume = (
    idx: number,
    field: keyof DevolverVolumeItem,
    val: string
  ) => {
    setDevolverVolumes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleFillRestante = () => {
    if (saldoRestante <= 0.0001) return;
    setDevolverVolumes((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      const curQtd = parseFloat(last.quantidade.replace(',', '.')) || 0;
      const newQtd = (curQtd + saldoRestante).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
        useGrouping: false,
      });
      next[next.length - 1] = { ...last, quantidade: newQtd };
      return next;
    });
  };

  const handleConfirmDevolver = async () => {
    if (devolverVolumes.length === 0) return;
    setIsDevolverRunning(true);
    const toastId = toast.loading('Enviando devolução ao SAP GUI via Planilha Sync...');

    try {
      const vbs = generateDevolverZwm296Vbs(devolverMaterial, devolverLote, devolverVolumes);
      const res = await triggerSapAutomation(
        'devolver_zwm296',
        currentUserEmail || 'Web Pesagem',
        vbs
      );

      if (res.job?.id) {
        const start = Date.now();
        const maxWaitMs = 60000;
        while (Date.now() - start < maxWaitMs) {
          const job = await checkSapAutomationStatus(res.job.id);
          if (job?.status === 'completed') break;
          if (job?.status === 'failed') throw new Error(job.result_message || 'Erro na execução do script SAP');
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      toast.dismiss(toastId);
      toast.success('Devolução processada com sucesso no SAP!');
      setDevolverOpen(false);
      setSelectedIds({});
      onAtualizarDb?.();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Erro ao executar devolução: ${err.message || 'Falha no SAP'}`);
    } finally {
      setIsDevolverRunning(false);
    }
  };

  const handleDevolver = () => {
    handleOpenDevolver();
  };

  const handleMoverS = async () => {
    if (isMoverSRunning) return;
    setIsMoverSRunning(true);
    const toastId = toast.loading('Enviando solicitação movermigo (saldo tipo S) para o Planilha Sync...');

    try {
      const res = await triggerSapAutomation('movermigo', 'Web Pesagem');
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar automação: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsMoverSRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading('Aguardando execução do script movermigo no SAP GUI...', { id: toastId });

      let attempts = 0;
      const maxAttempts = 30;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsMoverSRunning(false);
            toast.success('Script movermigo (saldo S) executado com sucesso no SAP!', { id: toastId });
            onInvestigacaoChange?.();
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsMoverSRunning(false);
            toast.error(`Execução no SAP falhou: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsMoverSRunning(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId });
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsMoverSRunning(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsMoverSRunning(false);
    }
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const highlightText = (text: string | number | undefined) => {
    const s = String(text ?? '');
    const q = (searchTerm || '').trim();
    if (!q) return s;

    const idx = s.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return s;

    return (
      <>
        {s.slice(0, idx)}
        <mark className="bg-primary/20 text-primary font-semibold px-0.5 rounded-xs">
          {s.slice(idx, idx + q.length)}
        </mark>
        {s.slice(idx + q.length)}
      </>
    );
  };

  const getUniqueColOptions = (colKey: string) => {
    const set = new Set<string>();
    enrichedData.forEach((row) => {
      const val = (row as any)[colKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        set.add(String(val).trim());
      }
    });
    return Array.from(set).sort();
  };

  const isAllSelected = filteredAndSorted.length > 0 && selectedRowsList.length === filteredAndSorted.length;
  const isIndeterminate = selectedRowsList.length > 0 && selectedRowsList.length < filteredAndSorted.length;

  const totalFilteredValue = useMemo(() => {
    return filteredAndSorted.reduce((acc, r) => acc + r.valor_total, 0);
  }, [filteredAndSorted]);

  return (
    <section id="tbl" className="space-y-2">
      {/* Barra de Ferramentas Superior (.tb-top) */}
      <div className="tb-top">
        {/* Botão 1: Analisar resíduos */}
        <button
          type="button"
          className={cn("btn", residuaisActive && "on")}
          onClick={onToggleResiduais}
          title="Alternar filtro e análise de lotes residuais"
        >
          <AlertTriangle size={14} className={residuaisActive ? "text-[var(--amber)]" : ""} />
          <span>Analisar resíduos</span>
        </button>

        {/* Botão 2: Busca Global (.search) com atalho / */}
        <label className="search">
          <Search size={14} className="text-[var(--text-3)] shrink-0" />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Busca global: material, descrição, lote"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onSearchChange?.('');
                searchInputRef.current?.focus();
              }}
              className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors p-0.5"
              title="Limpar busca (Esc)"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>

        {/* Botão 3: Filtros por coluna */}
        <button
          type="button"
          className={cn("btn", showFilters && "on")}
          onClick={() => setShowFilters(!showFilters)}
          title="Exibir filtros avançados por coluna"
        >
          <Filter size={14} />
          <span>Filtros por coluna</span>
          {activeFiltersCount > 0 && (
            <span className="mono font-semibold text-[var(--accent)] ml-1">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Botão Mover (S) */}
        <button
          type="button"
          className="btn"
          onClick={handleMoverS}
          disabled={isMoverSRunning}
          title="Mover/Ajuste em massa de saldo bloqueado (S) para 999/AJUSTE via SAP"
        >
          {isMoverSRunning ? (
            <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
          ) : (
            <RefreshCw size={14} />
          )}
          <span>Mover (S)</span>
        </button>

        {/* Botão 4: Popover de Colunas (.colpop) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={cn("btn", colsPopOpen && "on")}
            onClick={() => setColsPopOpen(!colsPopOpen)}
            title="Configurar colunas visíveis da tabela"
          >
            <Columns size={14} />
            <span>Colunas</span>
          </button>

          {colsPopOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setColsPopOpen(false)} />
              <div className="colpop" style={{ left: 0, top: 'calc(100% + 4px)' }}>
                <div className="px-3 py-1.5 border-b border-[var(--border)] text-[11px] font-semibold text-[var(--text-3)]">
                  COLUNAS VISÍVEIS
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {cols.map((col) => (
                    <label key={col.k}>
                      <input
                        type="checkbox"
                        checked={col.on}
                        disabled={col.k === 'material'}
                        onChange={() => handleToggleCol(col.k)}
                      />
                      <span>{col.l}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-1.5 pb-1 px-3 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCols(DEFAULT_COLS);
                      try {
                        localStorage.removeItem('dp_cols_config');
                      } catch {}
                    }}
                    className="text-[var(--accent)] hover:underline font-medium"
                  >
                    Restaurar padrão
                  </button>
                  <span className="text-[var(--text-3)] font-mono">
                    {cols.filter((c) => c.on).length}/{cols.length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grow" />

        {/* Contador */}
        <span className="count">
          <b>{filteredAndSorted.length.toLocaleString('pt-BR')}</b> de{' '}
          <span className="mono">{data.length.toLocaleString('pt-BR')}</span> lotes ·{' '}
          <b>{formatBRL(totalFilteredValue)}</b>
        </span>
      </div>

      {/* Barra de Residuais (.res) */}
      {residuaisActive && (
        <div className="res">
          <span className="font-semibold text-[var(--text)]">Resíduos PES:</span>
          <button
            type="button"
            onClick={() => setResNivelFilter('all')}
            className={resNivelFilter === 'all' ? 'on' : ''}
          >
            Total <b>{residualStats.countTotal}</b>
          </button>
          <button
            type="button"
            onClick={() => setResNivelFilter('v')}
            className={resNivelFilter === 'v' ? 'on' : ''}
          >
            <span className="dot" style={{ background: 'var(--green)' }} />
            Verdes <b>{residualStats.countV}</b>
          </button>
          <button
            type="button"
            onClick={() => setResNivelFilter('a')}
            className={resNivelFilter === 'a' ? 'on' : ''}
          >
            <span className="dot" style={{ background: 'var(--amber)' }} />
            Amarelos <b>{residualStats.countA}</b>
          </button>
          <button
            type="button"
            onClick={() => setResNivelFilter('r')}
            className={resNivelFilter === 'r' ? 'on' : ''}
          >
            <span className="dot" style={{ background: 'var(--red)' }} />
            Vermelhos <b>{residualStats.countR}</b>
          </button>
          <span className="text-[var(--text-3)] font-mono">
            Valor: <b className="text-[var(--text)]">{formatBRL(residualStats.valorTotal)}</b>
          </span>
          <span className="rule text-[var(--text-3)] hidden lg:inline">
            Regra: 0 &lt; qtd ≤ {limiteMaximo.toFixed(1)} kg · verde ≤ {limiteVerde.toFixed(1)} · amarelo ≤ {limiteAmarelo.toFixed(1)} · vermelho acima
          </span>
        </div>
      )}

      {/* Barra de Ações em Massa (.bulk) */}
      {selectedRowsList.length > 0 && (
        <div className="bulk">
          <span className="sel">
            <b>{selectedRowsList.length}</b> selecionado{selectedRowsList.length > 1 ? 's' : ''} · <b>{formatBRL(selectedTotalValue)}</b>
          </span>
          <div className="vsep" />
          <button type="button" className="btn sm" onClick={handleCopyTSV}>
            <Copy size={13} />
            Copiar selecionados
          </button>
          <button type="button" className="btn sm" onClick={handleCopyMIGO}>
            MIGO
          </button>
          <button type="button" className="btn sm" onClick={handleCopyLotes}>
            Lote
          </button>
          <div className="vsep" />
          <button
            type="button"
            className="btn sm"
            onClick={() => onOpenMoverModal?.(selectedRowsList)}
          >
            <ArrowRightLeft size={13} />
            Mover…
          </button>
          <button type="button" className="btn sm" onClick={handleToggleBlock}>
            Bloquear / desbloquear
          </button>
          <button type="button" className="btn sm" onClick={handleToggleInvestigacao}>
            Investigação
          </button>
          <button type="button" className="btn sm warn" onClick={handleDevolver}>
            Devolver
          </button>
          <span className="grow" style={{ flex: 1 }} />
          <button
            type="button"
            className="btn sm"
            onClick={() => setSelectedIds({})}
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Tabela de Alta Densidade (.tw e table.t) */}
      <div className="tw" id="tw">
        <table className="t" id="t">
          <thead id="thead">
            <tr>
              <th className="ck">
                <input
                  type="checkbox"
                  id="ckAll"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  title="Selecionar todos os filtrados"
                />
              </th>
              {cols
                .filter((c) => c.on)
                .map((col) => (
                  <th
                    key={col.k}
                    onClick={() => col.s && handleSort(col.k)}
                    className={cn("s", col.r && "r", sortField === col.k && "on")}
                  >
                    {col.l}
                    {col.s && sortField === col.k && (
                      <span className="ar">{sortDir > 0 ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
            </tr>

            {/* Linha de Filtros por Coluna (tr.f) */}
            {showFilters && (
              <tr className="f">
                <th className="ck" />
                {cols
                  .filter((c) => c.on)
                  .map((col) => (
                    <th key={col.k}>
                      {col.f === 'txt' && (
                        <input
                          value={columnFilters[col.k] || ''}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, [col.k]: e.target.value }))
                          }
                          placeholder="Filtrar..."
                        />
                      )}
                      {col.f === 'sel' && (
                        <select
                          value={columnFilters[col.k] || ''}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, [col.k]: e.target.value }))
                          }
                        >
                          <option value="">Todos</option>
                          {getUniqueColOptions(col.k).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                      {col.f === 'num' && (
                        <div className="mm">
                          <input
                            type="number"
                            value={columnFilters[col.k]?.min ?? ''}
                            onChange={(e) =>
                              setColumnFilters((prev) => ({
                                ...prev,
                                [col.k]: { ...prev[col.k], min: e.target.value },
                              }))
                            }
                            placeholder="Mín"
                          />
                          <input
                            type="number"
                            value={columnFilters[col.k]?.max ?? ''}
                            onChange={(e) =>
                              setColumnFilters((prev) => ({
                                ...prev,
                                [col.k]: { ...prev[col.k], max: e.target.value },
                              }))
                            }
                            placeholder="Máx"
                          />
                        </div>
                      )}
                    </th>
                  ))}
              </tr>
            )}
          </thead>

          <tbody id="tbody">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.filter((c) => c.on).length + 1}
                  className="empty"
                >
                  Nenhum lote encontrado com os filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row, index) => {
                const isSelected = !!selectedIds[row.id_row];
                const resLevel = row.res_nivel;
                const rowClass = resLevel === 'v' ? 'rv' : resLevel === 'a' ? 'ra' : resLevel === 'r' ? 'rr' : '';

                return (
                  <tr
                    key={row.id_row}
                    className={cn(rowClass, isSelected && "sel")}
                  >
                    {/* Checkbox */}
                    <td className="ck">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => handleRowCheckbox(row, index, e)}
                        onChange={() => {}}
                      />
                    </td>

                    {/* Colunas dinâmicas */}
                    {cols.filter((c) => c.on).map((col) => {
                      switch (col.k) {
                        case 'material':
                          return (
                            <td key={col.k} className="mat">
                              {highlightText(row.material)}
                            </td>
                          );

                        case 'texto_breve_material':
                          return (
                            <td key={col.k} className="ds" title={row.texto_breve_material}>
                              {highlightText(row.texto_breve_material?.replace(/\*\*/g, ''))}
                              {row.is_controlado && (
                                <span className="flag">Controlado</span>
                              )}
                            </td>
                          );

                        case 'lote': {
                          const isBlocked = blockedMap[row.lote] ?? row.is_blocked;
                          return (
                            <td key={col.k} className="lt">
                              <span>{highlightText(row.lote)}</span>
                              {isBlocked && (
                                <Lock className="lock inline-block w-3 h-3 text-[var(--amber)] ml-1 align-text-bottom" />
                              )}
                              {row.is_inf && <span className="flag v">INF</span>}
                              {row.is_cfa && <span className="flag b">CFA</span>}
                              {row.is_investigacao && <span className="flag">Investig.</span>}
                            </td>
                          );
                        }

                        case 'estoque_disponivel':
                          return (
                            <td
                              key={col.k}
                              className={cn(
                                "num",
                                row.estoque_disponivel < 0 && "neg",
                                row.estoque_disponivel === 0 && "zero"
                              )}
                            >
                              {row.estoque_disponivel.toLocaleString('pt-BR', {
                                minimumFractionDigits: 3,
                                maximumFractionDigits: 3,
                              })}
                            </td>
                          );

                        case 'valor_unitario':
                          return (
                            <td key={col.k} className="num text-[var(--text-3)]">
                              {row.valor_unitario > 0 ? formatBRL(row.valor_unitario) : '—'}
                            </td>
                          );

                        case 'valor_total':
                          return (
                            <td key={col.k} className="num font-medium text-[var(--text)]">
                              {row.valor_total > 0 ? formatBRL(row.valor_total) : <span className="zero">—</span>}
                            </td>
                          );

                        case 'dias_aging':
                          return (
                            <td
                              key={col.k}
                              className={cn(
                                "num font-semibold",
                                row.status_crit === 'cr' && "c-cr",
                                row.status_crit === 'al' && "c-al",
                                row.status_crit === 'ok' && "c-ok"
                              )}
                            >
                              {row.dias_aging} d
                            </td>
                          );

                        case 'status_aging':
                          return (
                            <td key={col.k} className="st">
                              <span
                                className="dot"
                                style={{
                                  background:
                                    row.status_crit === 'cr'
                                      ? 'var(--red)'
                                      : row.status_crit === 'al'
                                      ? 'var(--amber)'
                                      : 'var(--green)',
                                }}
                              />
                              <span>{row.status_label}</span>
                            </td>
                          );

                        case 'ultimo_movimento':
                          return (
                            <td key={col.k} className="font-mono text-xs text-[var(--text-3)]">
                              {row.ultimo_movimento || '—'}
                            </td>
                          );

                        case 'remessas':
                          return (
                            <td key={col.k} className="num">
                              {row.remessas > 0 ? (
                                <span className="rem">{row.remessas}</span>
                              ) : (
                                <span className="zero">—</span>
                              )}
                            </td>
                          );

                        case 'tipo_deposito':
                        case 'posicao_deposito':
                          return (
                            <td
                              key={col.k}
                              className={cn(
                                row.tipo_deposito === 'TR-ZONE' && row.estoque_disponivel < 0 && "c-cr font-bold"
                              )}
                            >
                              {(row as any)[col.k] || '—'}
                            </td>
                          );

                        default:
                          return (
                            <td key={col.k}>
                              {(row as any)[col.k] != null ? String((row as any)[col.k]) : '—'}
                            </td>
                          );
                      }
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog Devolução Fracionada (/nzwm296) */}
      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-3xl lg:max-w-4xl bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-4 sm:p-6 max-h-[90dvh] flex flex-col rounded-xl shadow-2xl">
          <DialogHeader className="shrink-0 pb-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="flex items-center gap-2 text-[var(--text)] text-base font-bold uppercase tracking-wider">
                <Undo2 className="h-5 w-5 text-[var(--amber)]" />
                <span>Devolução Fracionada no SAP (/nzwm296)</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] font-mono text-xs px-2 py-0.5 rounded">
                  Material: <strong className="text-[var(--accent)] ml-1">{devolverMaterial}</strong>
                </span>
                <span className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] font-mono text-xs px-2 py-0.5 rounded">
                  Lote: <strong className="text-[var(--amber)] ml-1">{devolverLote}</strong>
                </span>
              </div>
            </div>
            {devolverDescricao && (
              <p className="text-xs text-[var(--text-3)] truncate max-w-2xl mt-1">{devolverDescricao}</p>
            )}
            <DialogDescription className="text-[var(--text-3)] text-xs font-mono mt-0.5">
              Configure múltiplos volumes para devolução na transação <code>/nzwm296</code>. O saldo restante é calculado automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Cards de Saldo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 shrink-0">
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-strong)] flex flex-col justify-between">
              <span className="text-[10.5px] font-mono font-semibold text-[var(--text-3)] uppercase tracking-wider">Saldo em Estoque</span>
              <div className="mt-1">
                <span className="text-xl font-bold font-mono text-[var(--text)]">
                  {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs text-[var(--text-3)] ml-1.5 font-semibold font-mono">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] text-[var(--text-3)] font-mono mt-1">Total disponível no lote selecionado</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-strong)] flex flex-col justify-between">
              <span className="text-[10.5px] font-mono font-semibold text-[var(--text-3)] uppercase tracking-wider">Total a Devolver</span>
              <div className="mt-1">
                <span className={cn(
                  "text-xl font-bold font-mono",
                  isOverSaldo ? "text-[var(--red)]" : isZeroRestante ? "text-[var(--green)]" : "text-[var(--text)]"
                )}>
                  {totalDevolvendo.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs text-[var(--text-3)] ml-1.5 font-semibold font-mono">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] text-[var(--text-3)] font-mono mt-1">
                Soma de {devolverVolumes.length} volume(s)
              </span>
            </div>

            <div
              onClick={saldoRestante > 0.0001 ? handleFillRestante : undefined}
              className={cn(
                "p-3.5 rounded-lg border flex flex-col justify-between transition-all duration-200",
                isZeroRestante
                  ? "bg-[var(--green)]/10 border-[var(--green)]/40 text-[var(--green)]"
                  : isOverSaldo
                  ? "bg-[var(--red)]/10 border-[var(--red)]/40 text-[var(--red)]"
                  : "bg-[var(--amber)]/10 hover:bg-[var(--amber)]/20 border-[var(--amber)]/40 text-[var(--amber)] cursor-pointer shadow-xs group"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-mono font-semibold uppercase tracking-wider">
                  {isZeroRestante ? 'Devolução Completa' : isOverSaldo ? 'Saldo Excedido' : 'Saldo Restante'}
                </span>
                {isZeroRestante ? (
                  <CheckCircle2 size={15} className="text-[var(--green)]" />
                ) : isOverSaldo ? (
                  <AlertCircle size={15} className="text-[var(--red)]" />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--amber)]/20 border border-[var(--amber)]/40 text-[var(--amber)] font-bold group-hover:bg-[var(--amber)] group-hover:text-[#0e1014] transition-colors">
                    Auto-preencher ↵
                  </span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-xl font-bold font-mono">
                  {isOverSaldo ? '+' : ''}
                  {Math.abs(saldoRestante).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs ml-1.5 font-semibold font-mono">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] font-mono mt-1 opacity-90 truncate">
                {isZeroRestante ? "100% do saldo distribuído" : isOverSaldo ? "Reduza a quantidade" : "👉 Clique para auto-preencher"}
              </span>
            </div>
          </div>

          {/* Tabela de Volumes */}
          <div className="flex-1 overflow-y-auto border border-[var(--border-strong)] rounded-lg bg-[var(--surface-2)]/60 my-1">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-[var(--surface-2)] sticky top-0 z-10 border-b border-[var(--border-strong)] text-[11px] text-[var(--text-3)] uppercase">
                <tr>
                  <th className="w-12 px-3 py-2 text-center font-bold">#</th>
                  <th className="w-28 px-3 py-2 font-bold">Material</th>
                  <th className="w-28 px-3 py-2 font-bold">Lote</th>
                  <th className="px-3 py-2 font-bold">Qtd a Devolver (MENGE)</th>
                  <th className="w-28 px-3 py-2 text-center font-bold">Qtd Vol</th>
                  <th className="w-20 px-3 py-2 text-center font-bold">Pallet</th>
                  <th className="w-14 px-3 py-2 text-center font-bold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {devolverVolumes.map((volItem, idx) => (
                  <tr key={volItem.id} className="hover:bg-[var(--hover)] transition-colors">
                    <td className="text-center font-bold text-[var(--text-3)] px-3 py-2">
                      {idx + 1}
                    </td>
                    <td className="text-[var(--accent)] font-semibold px-3 py-2">
                      {devolverMaterial}
                    </td>
                    <td className="text-[var(--amber)] font-semibold px-3 py-2">
                      {devolverLote}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={volItem.quantidade}
                          onChange={(e) => handleUpdateVolume(idx, 'quantidade', e.target.value)}
                          placeholder="Ex: 4,985"
                          className="font-mono font-bold text-xs bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] focus:border-[var(--accent)] h-8 rounded-[var(--radius)] px-2.5 outline-none flex-1 placeholder:text-[var(--text-3)]"
                        />
                        <span className="text-xs text-[var(--text-3)] font-semibold">{devolverUnidade}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={volItem.volume}
                        onChange={(e) => handleUpdateVolume(idx, 'volume', e.target.value)}
                        placeholder="1"
                        className="font-mono text-center text-xs bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] focus:border-[var(--accent)] h-8 rounded-[var(--radius)] w-20 mx-auto block outline-none placeholder:text-[var(--text-3)]"
                      />
                    </td>
                    <td className="text-center font-mono text-xs text-[var(--text-3)] px-3 py-2">
                      1
                    </td>
                    <td className="text-center px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveVolume(idx)}
                        disabled={devolverVolumes.length <= 1}
                        className="h-7 w-7 rounded-[var(--radius)] bg-[var(--surface)] hover:bg-[var(--red)]/20 text-[var(--text-3)] hover:text-[var(--red)] border border-[var(--border)] disabled:opacity-20 grid place-items-center mx-auto transition-colors cursor-pointer"
                        title="Remover volume"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddVolume}
                className="px-3 py-1.5 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-bold text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={13} className="text-[var(--accent)]" />
                <span>+ Adicionar Volume</span>
              </button>

              {saldoRestante > 0.0001 && (
                <button
                  type="button"
                  onClick={handleFillRestante}
                  className="px-3 py-1.5 rounded-[var(--radius)] bg-[var(--amber)]/10 hover:bg-[var(--amber)]/20 border border-[var(--amber)]/40 text-[var(--amber)] font-bold text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>Preencher Restante ({saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {devolverUnidade})</span>
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="mt-3 pt-3 border-t border-[var(--border)] gap-2 sm:gap-0 shrink-0">
            <button
              type="button"
              onClick={() => setDevolverOpen(false)}
              className="px-4 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-semibold text-xs transition-colors cursor-pointer mr-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDevolver}
              disabled={totalDevolvendo <= 0 || isOverSaldo || isDevolverRunning}
              className="px-5 py-2 rounded-[var(--radius)] bg-[var(--amber)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[#0e1014] font-bold text-xs shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
            >
              {isDevolverRunning ? (
                <>
                  <Loader2 size={14} className="animate-spin text-[#0e1014]" />
                  <span>Executando no SAP...</span>
                </>
              ) : (
                <>
                  <Undo2 size={14} />
                  <span>Executar Devolução SAP ({devolverVolumes.length} Volumes)</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
