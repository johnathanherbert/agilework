'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { AgingData, RemessaData, ConfiguracaoResiduais, DashboardSnapshot, LoteInvestigacao } from '@/types/aging';
import { isMaterialEspecial } from '@/lib/materiais-especiais';
import {
  fetchAgingData,
  fetchMaterialValores,
  fetchRemessas,
  fetchConfiguracaoResiduais,
  fetchDashboardHistorico,
  fetchLotesInvestigacao,
  triggerSapAutomation,
  checkSapAutomationStatus,
} from '@/lib/dashpesagem-api';

import { AgingTable, EnrichedRow } from '@/components/pesagem/aging-table';
import { AgingFinancial } from '@/components/pesagem/aging-financial';
import { OnepageView } from '@/components/pesagem/onepage-view';
import { RemessasView } from '@/components/pesagem/remessas-view';
import { ConsultaRapidaView } from '@/components/pesagem/consulta-rapida-view';
import { ToolsView } from '@/components/pesagem/tools-view';
import { ResiduaisView } from '@/components/pesagem/residuais-view';
import { ValorUpload } from '@/components/pesagem/valor-upload';
import { RemessaUpload } from '@/components/pesagem/remessa-upload';
import { ConfiguracaoResiduaisComponent } from '@/components/pesagem/configuracao-residuais';
import { ExcelUpload } from '@/components/pesagem/excel-upload';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import ProtectedRoute from '@/components/auth/protected-route';
import { cn } from '@/lib/utils';
import { MoverModal } from '@/components/pesagem/mover-modal';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  FileText,
  AlertTriangle,
  Truck,
  QrCode,
  Wrench,
  Settings as SettingsIcon,
  RefreshCw,
  Upload,
  Clock,
  Calendar,
  X,
  Scale,
  Loader2,
} from 'lucide-react';
import { useFirebase } from '@/components/providers/firebase-provider';

export default function PesagemPage() {
  const [data, setData] = useState<AgingData[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [remessas, setRemessas] = useState<RemessaData[]>([]);
  const [configResiduais, setConfigResiduais] = useState<ConfiguracaoResiduais>({
    limite_verde: 100,
    limite_amarelo: 900,
    limite_maximo: 999,
    materiais_alto_valor: [],
    dias_atencao: 3,
    dias_alerta: 7,
    dias_critico: 15,
  });
  const [lotesInvestigacao, setLotesInvestigacao] = useState<LoteInvestigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navegação e Filtros
  const [activeTab, setActiveTab] = useState<'fin' | 'one' | 'res' | 'rem' | 'scan' | 'tools' | 'settings'>('fin');
  const [selectedDep, setSelectedDep] = useState<string>('all');
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [residuaisActive, setResiduaisActive] = useState<boolean>(false);

  // Relógio e Timestamps
  const [clockTime, setClockTime] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<string | Date | null>(null);
  const lastSyncTimestampRef = useRef<string | null>(null);

  // Modais
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [moverModalOpen, setMoverModalOpen] = useState(false);
  const [moverSelectedItems, setMoverSelectedItems] = useState<EnrichedRow[]>([]);
  const [isAtualizandoDb, setIsAtualizandoDb] = useState(false);

  const { user, userData } = useFirebase();

  // Relógio ao vivo
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
          2,
          '0'
        )}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Carregamento de dados da base
  const loadData = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      setError(null);

      const [agingData, valoresData, remessasData, configData, historico, lotesInv] = await Promise.all([
        fetchAgingData(),
        fetchMaterialValores(),
        fetchRemessas().catch(() => []),
        fetchConfiguracaoResiduais().catch(() => ({
          limite_verde: 100,
          limite_amarelo: 900,
          limite_maximo: 999,
          materiais_alto_valor: [],
          dias_alerta: 7,
          dias_critico: 15,
        })),
        fetchDashboardHistorico(2).catch(() => []),
        fetchLotesInvestigacao().catch(() => []),
      ]);

      setData(agingData);
      setValores(valoresData);
      setRemessas(remessasData);
      setConfigResiduais(configData);
      setLotesInvestigacao(lotesInv);

      const latestTimestamp = agingData[0]?.created_at || historico[0]?.snapshot_at || new Date().toISOString();
      setLastUpdate(latestTimestamp);
      if (agingData[0]?.created_at) {
        lastSyncTimestampRef.current = String(agingData[0].created_at);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de pesagem:', err);
      if (showLoadingSpinner) {
        setError('Erro ao carregar dados. Verifique a conexão com a base PostgreSQL.');
      }
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  const handleAtualizarDb = async () => {
    if (isAtualizandoDb) return;
    setIsAtualizandoDb(true);
    const toastId = toast.loading('Solicitando extração SAP ao Planilha Sync...');

    try {
      const res = await triggerSapAutomation('extrair_relatorio', user?.email || userData?.email || 'AgileWork');
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar extração: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsAtualizandoDb(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading('Planilha Sync executando extração SAP e sincronização...', { id: toastId });

      let attempts = 0;
      const maxAttempts = 60;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsAtualizandoDb(false);
            toast.success('Relatório extraído e estoque atualizado com sucesso!', { id: toastId, icon: '🚀' });
            loadData(false);
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsAtualizandoDb(false);
            toast.error(`Falha na extração: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsAtualizandoDb(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId, icon: '⚠️' });
          }
        } catch {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsAtualizandoDb(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsAtualizandoDb(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/aging/status?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const status = await res.json();
        if (status?.last_updated) {
          const currentTimestamp = String(status.last_updated);
          if (lastSyncTimestampRef.current && lastSyncTimestampRef.current !== currentTimestamp) {
            lastSyncTimestampRef.current = currentTimestamp;
            setLastUpdate(currentTimestamp);
            toast.success(`Estoque atualizado via integração! (${status.total_rows} itens)`, {
              duration: 5000,
              icon: '🔄',
            });
            loadData(false);
          } else if (!lastSyncTimestampRef.current) {
            lastSyncTimestampRef.current = currentTimestamp;
            setLastUpdate(currentTimestamp);
          }
        }
      } catch {
        // Silencioso em polling
      }
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Atalhos de teclado ( '/' para busca, 'Esc' para limpar )
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedSpec || selectedMaterialFilter || searchTerm) {
          setSelectedSpec(null);
          setSelectedMaterialFilter(undefined);
          setSearchTerm('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSpec, selectedMaterialFilter, searchTerm]);

  // Categorização padronizada de depósitos operacionais:
  // - 'PES': PES PESAGEM
  // - '999': 999 AJUSTE e AJU-SAIDA
  // - 'TR-ZONE': 922 TR-ZONE
  // - 'DEP': DEP / DEVOLUCAO
  const getItemDepositoGroup = (item: {
    deposito?: string;
    tipo_deposito?: string;
    posicao_deposito?: string;
  }): string => {
    const tipo = (item.tipo_deposito || '').trim().toUpperCase();
    const pos = (item.posicao_deposito || '').trim().toUpperCase();
    const dep = (item.deposito || '').trim().toUpperCase();

    // 1. TR-ZONE (922 TR-ZONE)
    if (
      tipo === 'TR-ZONE' ||
      tipo === '922' ||
      pos.includes('TR-ZONE') ||
      pos.includes('TRZONE') ||
      pos.includes('TR_ZONE') ||
      dep === '922' ||
      dep === 'TR-ZONE'
    ) {
      return 'TR-ZONE';
    }

    // 2. 999 (AJUSTE e AJU-SAIDA)
    if (
      tipo === '999' ||
      pos.includes('AJUSTE') ||
      pos.includes('AJU-SAIDA') ||
      pos.includes('AJU_SAIDA') ||
      pos.includes('AJU')
    ) {
      return '999';
    }

    // 3. DEP (DEVOLUCAO)
    if (
      tipo === 'DEP' ||
      pos.includes('DEVOL') ||
      (dep === 'DEP' && tipo !== 'PES' && !pos.includes('PESAGEM'))
    ) {
      return 'DEP';
    }

    // 4. PES (PES PESAGEM)
    if (
      tipo === 'PES' ||
      pos.includes('PESAGEM') ||
      pos.includes('PES')
    ) {
      return 'PES';
    }

    if (tipo) return tipo;
    return 'PES';
  };

  // Lista base filtrada por depósito
  const baseData = useMemo(() => {
    if (selectedDep === 'all') return data;
    return data.filter((item) => getItemDepositoGroup(item) === selectedDep);
  }, [data, selectedDep]);

  // Contagem de lotes por depósito
  const depCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.length };
    for (const item of data) {
      const group = getItemDepositoGroup(item);
      counts[group] = (counts[group] || 0) + 1;
    }
    return counts;
  }, [data]);

  const uniqueDeps = useMemo(() => {
    const preferredOrder = ['999', 'DEP', 'PES', 'TR-ZONE'];
    const foundDeps = new Set(data.map((item) => getItemDepositoGroup(item)));
    const sorted: string[] = [];
    for (const p of preferredOrder) {
      if (foundDeps.has(p)) {
        sorted.push(p);
        foundDeps.delete(p);
      }
    }
    Array.from(foundDeps).sort().forEach((d) => sorted.push(d));
    return sorted;
  }, [data]);

  // Cálculo dos 8 KPIs
  const kpis = useMemo(() => {
    const diasAlerta = configResiduais?.dias_alerta ?? 7;
    const diasCritico = configResiduais?.dias_critico ?? 15;

    let totalLotes = baseData.length;
    let totalValor = 0;

    let trzNegativoLotes = 0;

    let normalLotes = 0;
    let normalValor = 0;

    let alertaLotes = 0;
    let alertaValor = 0;

    let criticoLotes = 0;
    let criticoValor = 0;

    let infLotes = 0;
    let infValor = 0;

    let cfaLotes = 0;
    let cfaValor = 0;

    let vence30Lotes = 0;
    let vence30Valor = 0;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em30Dias = new Date(hoje);
    em30Dias.setDate(hoje.getDate() + 30);

    const parseDate = (dateStr?: string): Date | null => {
      if (!dateStr) return null;
      const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    for (const item of baseData) {
      const vu = valores[item.material] || valores[item.material.replace(/^0+/, '')] || 0;
      const qtd = Number(item.estoque_disponivel) || 0;
      const vt = Math.max(0, qtd) * vu;
      const dias = item.dias_aging || 0;

      totalValor += vt;

      if ((item.tipo_deposito === 'TR-ZONE' || item.tipo_deposito === '922') && qtd < 0) {
        trzNegativoLotes++;
      }

      if (dias > diasCritico) {
        criticoLotes++;
        criticoValor += vt;
      } else if (dias >= diasAlerta) {
        alertaLotes++;
        alertaValor += vt;
      } else {
        normalLotes++;
        normalValor += vt;
      }

      const especial = isMaterialEspecial(item.material);
      if (especial === 'inf') {
        infLotes++;
        infValor += vt;
      } else if (especial === 'cfa') {
        cfaLotes++;
        cfaValor += vt;
      }

      const dtVenc = parseDate(item.data_vencimento);
      if (dtVenc && dtVenc >= hoje && dtVenc <= em30Dias) {
        vence30Lotes++;
        vence30Valor += vt;
      }
    }

    return {
      total: { count: totalLotes, valor: totalValor },
      trzNeg: { count: trzNegativoLotes },
      normal: { count: normalLotes, valor: normalValor },
      alerta: { count: alertaLotes, valor: alertaValor },
      critico: { count: criticoLotes, valor: criticoValor },
      inf: { count: infLotes, valor: infValor },
      cfa: { count: cfaLotes, valor: cfaValor },
      vence30: { count: vence30Lotes, valor: vence30Valor },
    };
  }, [baseData, valores, configResiduais]);

  // Contagem de Residuais para badge da aba
  const totalResiduaisCount = useMemo(() => {
    const limiteMaximo = (configResiduais?.limite_maximo ?? 999) / 1000;
    return baseData.filter((item) => {
      const isKg = (item.unidade_medida || 'KG').toUpperCase() === 'KG';
      const qtd = Number(item.estoque_disponivel) || 0;
      return isKg && qtd > 0 && qtd <= limiteMaximo;
    }).length;
  }, [baseData, configResiduais]);

  // Filtragem adicional de dados por KPI especial
  const displayData = useMemo(() => {
    if (!selectedSpec) return baseData;

    const diasAlerta = configResiduais?.dias_alerta ?? 7;
    const diasCritico = configResiduais?.dias_critico ?? 15;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em30Dias = new Date(hoje);
    em30Dias.setDate(hoje.getDate() + 30);

    const parseDate = (dateStr?: string): Date | null => {
      if (!dateStr) return null;
      const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    return baseData.filter((item) => {
      const dias = item.dias_aging || 0;
      const qtd = Number(item.estoque_disponivel) || 0;

      switch (selectedSpec) {
        case 'trz':
          return (item.tipo_deposito === 'TR-ZONE' || item.tipo_deposito === '922') && qtd < 0;
        case 'ok':
          return dias < diasAlerta;
        case 'al':
          return dias >= diasAlerta && dias <= diasCritico;
        case 'cr':
          return dias > diasCritico;
        case 'INF':
          return isMaterialEspecial(item.material) === 'inf';
        case 'CFA':
          return isMaterialEspecial(item.material) === 'cfa';
        case 'v30': {
          const dtVenc = parseDate(item.data_vencimento);
          return !!(dtVenc && dtVenc >= hoje && dtVenc <= em30Dias);
        }
        default:
          return true;
      }
    });
  }, [baseData, selectedSpec, configResiduais]);

  const formatBRLK = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
    if (a >= 1e4) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatLastUpdate = (dt: string | Date | null | undefined) => {
    if (!dt) return 'Não disponível';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return String(dt);
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return String(dt);
    }
  };

  const handleOpenMover = (selectedRows: EnrichedRow[]) => {
    setMoverSelectedItems(selectedRows);
    setMoverModalOpen(true);
  };

  const handleRemoveMoverItem = (index: number) => {
    setMoverSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDevolver = (selectedRows: EnrichedRow[]) => {
    if (selectedRows.length === 0) return;
    if (
      !window.confirm(
        `Devolver ${selectedRows.length} lote(s)? Eles serão transferidos para a posição DEVOLUCAO no depósito DEP.`
      )
    )
      return;

    setData((prev) =>
      prev.map((item) => {
        const isSelected = selectedRows.some(
          (r) => r.lote === item.lote && r.material === item.material
        );
        if (isSelected) {
          return { ...item, posicao_deposito: 'DEVOLUCAO', tipo_deposito: 'DEP', deposito: 'DEP' };
        }
        return item;
      })
    );
    toast.success(`${selectedRows.length} lote(s) direcionados para DEVOLUCAO`);
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />

          <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 min-w-0">
            {/* Topbar de Sub-Navegação e Ações Integradas */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 mb-4 border-b border-[var(--border)]">
              {/* Seletor Segmentado de Abas */}
              <div className="seg flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('fin');
                    setResiduaisActive(false);
                  }}
                  className={activeTab === 'fin' ? 'on' : ''}
                >
                  <TrendingUp size={14} />
                  Financeiro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('one');
                    setResiduaisActive(false);
                  }}
                  className={activeTab === 'one' ? 'on' : ''}
                >
                  <FileText size={14} />
                  Onepage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('res');
                    setResiduaisActive(true);
                  }}
                  className={activeTab === 'res' ? 'on' : ''}
                >
                  <AlertTriangle size={14} />
                  Residuais
                  <span className="n">{totalResiduaisCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('rem');
                    setResiduaisActive(false);
                  }}
                  className={activeTab === 'rem' ? 'on' : ''}
                >
                  <Truck size={14} />
                  Remessas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('scan');
                    setResiduaisActive(false);
                  }}
                  className={activeTab === 'scan' ? 'on' : ''}
                >
                  <QrCode size={14} />
                  Scanner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('tools');
                    setResiduaisActive(false);
                  }}
                  className={activeTab === 'tools' ? 'on' : ''}
                >
                  <Wrench size={14} />
                  Tools
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                    setResiduaisActive(false);
                  }}
                  className={activeTab === 'settings' ? 'on' : ''}
                >
                  <SettingsIcon size={14} />
                  Configurações
                </button>
              </div>

              {/* Status Operacional & Disparadores */}
              <div className="flex items-center gap-3 text-xs flex-wrap justify-end">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20 text-[11px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
                  
                </span>

                <div className="text-right leading-tight hidden xl:block">
                  <span className="text-[11px] text-[var(--text-3)] block">Última sincronização</span>
                  <b className="font-mono text-[var(--text)] text-xs">{formatLastUpdate(lastUpdate)}</b>
                </div>

                <button
                  type="button"
                  onClick={handleAtualizarDb}
                  disabled={isAtualizandoDb}
                  className={cn("btn sm", isAtualizandoDb && "spin")}
                  title="Sincronizar planilha automatizada via SAP"
                >
                  <RefreshCw size={13} className={isAtualizandoDb ? "animate-spin text-[var(--accent)]" : ""} />
                  {isAtualizandoDb ? 'Sincronizando...' : 'Planilha Sync'}
                </button>

                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="btn primary sm"
                >
                  <Upload size={13} />
                  Upload
                </button>
              </div>
            </div>

            {/* Banner de Erro caso ocorra */}
            {error && (
              <div className="p-3 mb-4 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] flex items-center justify-between text-xs font-mono">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="hover:opacity-70">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Faixa Contínua de 8 KPIs Industriais */}
            {(activeTab === 'fin' || activeTab === 'one' || activeTab === 'res') && (
              <div className="kpis">
                {/* KPI 1: Total */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(null)}
                  className={selectedSpec === null ? 'on' : ''}
                >
                  <label>Total lotes</label>
                  <strong>{kpis.total.count.toLocaleString('pt-BR')}</strong>
                  <small>{formatBRLK(kpis.total.valor)}</small>
                </button>

                {/* KPI 2: 922 TR-ZONE < 0 */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(selectedSpec === 'trz' ? null : 'trz')}
                  className={`${selectedSpec === 'trz' ? 'on' : ''} ${kpis.trzNeg.count === 0 ? 'zero' : ''}`}
                >
                  <label>
                    {kpis.trzNeg.count > 0 && <span className="dot" style={{ background: 'var(--red)' }} />}
                    922 TR-ZONE &lt; 0
                  </label>
                  <strong className={kpis.trzNeg.count > 0 ? 'c-cr' : ''}>
                    {kpis.trzNeg.count}
                  </strong>
                  <small className={kpis.trzNeg.count > 0 ? 'c-cr' : ''}>
                    {kpis.trzNeg.count > 0 ? 'saldo negativo' : 'nenhum negativo'}
                  </small>
                </button>

                {/* KPI 3: Normal */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(selectedSpec === 'ok' ? null : 'ok')}
                  className={`${selectedSpec === 'ok' ? 'on' : ''} ${kpis.normal.count === 0 ? 'zero' : ''}`}
                >
                  <label>
                    <span className="dot" style={{ background: 'var(--green)' }} />
                    Normal (&lt; {configResiduais?.dias_alerta ?? 7} d)
                  </label>
                  <strong className="c-ok">{kpis.normal.count}</strong>
                  <small>{formatBRLK(kpis.normal.valor)}</small>
                </button>

                {/* KPI 4: Alerta */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(selectedSpec === 'al' ? null : 'al')}
                  className={`${selectedSpec === 'al' ? 'on' : ''} ${kpis.alerta.count === 0 ? 'zero' : ''}`}
                >
                  <label>
                    <span className="dot" style={{ background: 'var(--amber)' }} />
                    Alerta ({configResiduais?.dias_alerta ?? 7}–{configResiduais?.dias_critico ?? 15} d)
                  </label>
                  <strong className="c-al">{kpis.alerta.count}</strong>
                  <small>{formatBRLK(kpis.alerta.valor)}</small>
                </button>

                {/* KPI 5: Crítico */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(selectedSpec === 'cr' ? null : 'cr')}
                  className={`${selectedSpec === 'cr' ? 'on' : ''} ${kpis.critico.count === 0 ? 'zero' : ''}`}
                >
                  <label>
                    <span className="dot" style={{ background: 'var(--red)' }} />
                    Crítico (&gt; {configResiduais?.dias_critico ?? 15} d)
                  </label>
                  <strong className="c-cr">{kpis.critico.count}</strong>
                  <small>{formatBRLK(kpis.critico.valor)}</small>
                </button>

                {/* KPI 6: INF */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(selectedSpec === 'INF' ? null : 'INF')}
                  className={`${selectedSpec === 'INF' ? 'on' : ''} ${kpis.inf.count === 0 ? 'zero' : ''}`}
                >
                  <label>
                    INF <span className="flag v">INF</span>
                  </label>
                  <strong>{kpis.inf.count}</strong>
                  <small>{formatBRLK(kpis.inf.valor)}</small>
                </button>

                {/* KPI 7: CFA */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(selectedSpec === 'CFA' ? null : 'CFA')}
                  className={`${selectedSpec === 'CFA' ? 'on' : ''} ${kpis.cfa.count === 0 ? 'zero' : ''}`}
                >
                  <label>
                    CFA <span className="flag b">CFA</span>
                  </label>
                  <strong>{kpis.cfa.count}</strong>
                  <small>{formatBRLK(kpis.cfa.valor)}</small>
                </button>

                {/* KPI 8: Vencimento em 30d */}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(selectedSpec === 'v30' ? null : 'v30')}
                  className={`${selectedSpec === 'v30' ? 'on' : ''} ${kpis.vence30.count === 0 ? 'zero' : ''}`}
                >
                  <label>
                    <Calendar size={12} className="text-[var(--text-3)]" />
                    Vence em 30 d
                  </label>
                  <strong className={kpis.vence30.count > 0 ? 'c-al' : ''}>
                    {kpis.vence30.count}
                  </strong>
                  <small>{formatBRLK(kpis.vence30.valor)}</small>
                </button>
              </div>
            )}

            {/* Barra de Filtros de Depósito e Chips Ativos (.filters) */}
            <div className="filters">
              {/* Segmented Control de Depósitos (.seg) */}
              <div className="seg" id="depSeg">
                <button
                  type="button"
                  onClick={() => setSelectedDep('all')}
                  className={selectedDep === 'all' ? 'on' : ''}
                >
                  Todos
                  <span className="n">{depCounts.all || 0}</span>
                </button>
                {uniqueDeps.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDep(d)}
                    className={selectedDep === d ? 'on' : ''}
                  >
                    {d}
                    <span className="n">{depCounts[d] || 0}</span>
                  </button>
                ))}
              </div>

              {/* Chips de Filtros Ativos (.chip) */}
              <span id="chips">
                {selectedDep !== 'all' && (
                  <span className="chip">
                    Depósito: {selectedDep}
                    <button
                      type="button"
                      onClick={() => setSelectedDep('all')}
                      title="Remover"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {selectedSpec && (
                  <span className="chip">
                    Especial: {selectedSpec}
                    <button
                      type="button"
                      onClick={() => setSelectedSpec(null)}
                      title="Remover"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {selectedMaterialFilter && (
                  <span className="chip">
                    Material: {selectedMaterialFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialFilter(undefined)}
                      title="Remover"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {searchTerm && (
                  <span className="chip">
                    Busca: “{searchTerm}”
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      title="Remover"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </span>

              {(selectedSpec || selectedMaterialFilter || searchTerm || selectedDep !== 'all') && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setSelectedSpec(null);
                    setSelectedMaterialFilter(undefined);
                    setSearchTerm('');
                    setSelectedDep('all');
                  }}
                >
                  Limpar tudo
                </button>
              )}
            </div>

      {/* Estados de Carregamento & Erro */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Carregando dados de estoque e pesagem...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-8 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-destructive font-medium text-xs">{error}</p>
            <Button size="sm" variant="outline" onClick={() => loadData(true)} className="mt-2 text-xs">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo das Abas */}
      {!loading && !error && (
        <>
          {/* ABA 1: FINANCEIRO (Dashboard + Tabela) */}
          {activeTab === 'fin' && (
            <div className="space-y-4">
              <AgingFinancial
                data={displayData}
                allData={data}
                valores={valores}
                selectedCriticality={selectedSpec}
                onCriticalityChange={(crit) => setSelectedSpec(crit)}
                selectedMaterial={selectedMaterialFilter}
                onMaterialChange={(mat) => setSelectedMaterialFilter(mat)}
                configResiduais={configResiduais}
              />

              {/* Tabela Integrada */}
              <AgingTable
                data={displayData}
                valores={valores}
                remessas={remessas}
                configResiduais={configResiduais}
                lotesInvestigacao={lotesInvestigacao}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                residuaisActive={residuaisActive}
                onToggleResiduais={() => setResiduaisActive(!residuaisActive)}
                onOpenMoverModal={handleOpenMover}
                onInvestigacaoChange={loadData}
                onDevolver={handleDevolver}
                selectedMaterialFilter={selectedMaterialFilter}
                onClearMaterialFilter={() => setSelectedMaterialFilter(undefined)}
              />
            </div>
          )}

          {/* ABA RESIDUAIS (Instância de Análise Residual & Bloqueio SAP MIGO idêntica ao dashpesagem) */}
          {activeTab === 'res' && (
            <div className="space-y-4">
              <ResiduaisView
                agingData={baseData}
                allData={data}
                valores={valores}
                remessas={remessas}
                configResiduais={configResiduais}
                selectedCriticality={selectedSpec}
                onCriticalityChange={(crit) => setSelectedSpec(crit)}
                onNavigateToRemessas={(material) => {
                  setSelectedMaterialFilter(material);
                  setActiveTab('rem');
                }}
                lotesInvestigacao={lotesInvestigacao}
                onInvestigacaoChange={loadData}
                currentUserEmail={user?.email || userData?.email}
                onAtualizarDb={handleAtualizarDb}
                isAtualizandoDb={isAtualizandoDb}
              />
            </div>
          )}

          {/* ABA 2: ONEPAGE */}
          {activeTab === 'one' && (
            <div className="space-y-4">
              <OnepageView
                agingData={data}
                valores={valores}
                lotesInvestigacao={lotesInvestigacao}
                onInvestigacaoChange={loadData}
                currentUserEmail={user?.email || userData?.email}
                lastUpdate={lastUpdate}
                configResiduais={configResiduais}
                onFilterMaterial={(mat) => {
                  setSelectedMaterialFilter(mat);
                  setActiveTab('fin');
                }}
                onFilterPosicao={(pos) => {
                  setSelectedDep(pos);
                  setActiveTab('fin');
                }}
              />
            </div>
          )}

          {/* ABA 3: REMESSAS */}
          {activeTab === 'rem' && (
            <div className="space-y-4">
              <RemessasView remessas={remessas} materialFilter={selectedMaterialFilter} />
            </div>
          )}

          {/* ABA 4: SCANNER / CONSULTA RÁPIDA */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <ConsultaRapidaView
                agingData={data}
                remessas={remessas}
                currentUserEmail={user?.email || userData?.email}
                isEmbedded={true}
              />
            </div>
          )}

          {/* ABA 5: TOOLS */}
          {activeTab === 'tools' && (
            <div className="space-y-4">
              <ToolsView agingData={data} valores={valores} />
            </div>
          )}

          {/* ABA 6: CONFIGURAÇÕES */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs">
                <div>
                  <h2 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                    Configurações do Módulo de Pesagem
                  </h2>
                  <p className="text-[11px] text-[var(--text-3)] font-mono mt-0.5">
                    Parâmetros operacionais de aging, tolerâncias de pesagem e tabelas de precificação / remessas SAP.
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)]">
                  CONFIG
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ValorUpload onUploadComplete={loadData} />
                <RemessaUpload onUploadComplete={loadData} />
              </div>

              <ConfiguracaoResiduaisComponent onConfigChange={loadData} />
            </div>
          )}
        </>
      )}

      {/* Modal de Upload de Planilha */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-lg bg-[#0e1014] border border-[var(--border-strong)] text-[var(--text)] rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">
              Upload de Planilha de Estoque (MB52 / LX02)
            </DialogTitle>
            <DialogDescription className="text-[11px] text-[var(--text-3)] font-mono">
              Selecione o arquivo exportado do SAP para atualizar os dados analíticos de estoque e aging.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <ExcelUpload
              onUploadComplete={() => {
                loadData();
                setUploadModalOpen(false);
              }}
              onClose={() => setUploadModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Mover SAP */}
      <MoverModal
        open={moverModalOpen}
        onOpenChange={setMoverModalOpen}
        items={moverSelectedItems}
        onRemoveItem={handleRemoveMoverItem}
        onSuccess={() => {
          loadData(false);
          setMoverModalOpen(false);
        }}
        currentUserEmail={user?.email || userData?.email}
      />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
