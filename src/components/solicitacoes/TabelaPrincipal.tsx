"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { formatNumber } from "@/lib/utils";
import { ExcipienteNTInfo, PendingNTItemDetail } from "@/types/solicitacao";
import { ItemStatus, NTItem } from "@/types";
import { StatusSwitch } from "@/components/ui/status-switch";
import { updateNTItem } from "@/lib/firestore-helpers";
import toast from "react-hot-toast";

const EXCIPIENTES_ESPECIAIS = [
  "LACTOSE (200)",
  "LACTOSE (50/70)",
  "AMIDO DE MILHO PREGELATINIZADO",
  "CELULOSE MIC (TIPO200)",
  "CELULOSE MIC.(TIPO102)",
  "FOSF.CAL.DIB.(COMPDIRETA)",
  "AMIDO",
  "CELULOSE+LACTOSE",
];

interface TabelaPrincipalProps {
  filteredExcipientes: Record<string, any>;
  materiaisNaArea: Record<string, number>;
  faltaSolicitar?: Record<string, string>;
  inputValues: Record<string, string>;
  ntsPendentesPorExcipiente?: Record<string, ExcipienteNTInfo>;
  allPendingNTItems?: PendingNTItemDetail[];
  outsideNeedNTItems?: PendingNTItemDetail[];
  totalPendingNTsCount?: number;
  selectedOrdem?: any;
  onClearSelectedOrdem?: () => void;
  handleMateriaisNaAreaChange: (excipient: string, value: string) => void;
  handleDetailClick?: (ativo: string) => void;
  handleToggleExpandExcipient: (excipient: string) => void;
  expandedExcipient: string | string[] | null;
  allExpanded?: boolean;
  togglePesado: (excipient: string, ordemId: string) => void;
  calcularMovimentacaoTotal?: () => number;
  getOrdensAtendidas?: (excipient: string) => { ordensAtendidas: any[]; ordensNaoAtendidas: any[] };
  handleUpdateSAPValues: (excipient: string, codigo: string) => void;
  handleUpdateAllSAPValues: () => void;
  handleEditOrdem?: (ordem: any) => void;
  onOpenSap?: () => void;
  onOpenPullProduction?: () => void;
  isUpdatingSAP?: boolean;
}

export const TabelaPrincipal: React.FC<TabelaPrincipalProps> = ({
  filteredExcipientes,
  materiaisNaArea,
  inputValues,
  ntsPendentesPorExcipiente = {},
  allPendingNTItems = [],
  outsideNeedNTItems = [],
  totalPendingNTsCount = 0,
  selectedOrdem,
  onClearSelectedOrdem,
  handleMateriaisNaAreaChange,
  handleToggleExpandExcipient,
  expandedExcipient,
  togglePesado,
  handleUpdateSAPValues,
  handleUpdateAllSAPValues,
  onOpenSap,
  onOpenPullProduction,
  isUpdatingSAP = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "need" | "nt" | "ctrl">("all");
  const [hideDone, setHideDone] = useState(false);
  const [sortBy, setSortBy] = useState<"desc" | "need" | "nt" | "falta">("falta");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatingNTItemId, setUpdatingNTItemId] = useState<string | null>(null);
  const [loadingSapItem, setLoadingSapItem] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Modal de Detalhes dos KPIs
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiModalTitle, setKpiModalTitle] = useState("");
  const [kpiModalSubtitle, setKpiModalSubtitle] = useState("");
  const [kpiModalItems, setKpiModalItems] = useState<PendingNTItemDetail[]>([]);
  const [kpiModalSearch, setKpiModalSearch] = useState("");

  const handleOpenKpiModal = (type: "nts" | "items" | "outside") => {
    setKpiModalSearch("");
    if (type === "nts") {
      setKpiModalTitle("Notas de Transferência Pendentes");
      setKpiModalSubtitle("Lista completa de todos os itens em NTs aguardando atendimento no Almoxarifado");
      setKpiModalItems(allPendingNTItems);
    } else if (type === "items") {
      setKpiModalTitle("Todos os Itens Pendentes no Almoxarifado");
      setKpiModalSubtitle("Todos os itens de NTs pendentes com suas respectivas matérias-primas e quantidades");
      setKpiModalItems(allPendingNTItems);
    } else if (type === "outside") {
      setKpiModalTitle("Itens Fora da Necessidade");
      setKpiModalSubtitle("Itens em NTs pendentes que não fazem parte da receita de nenhuma ordem em andamento.");
      setKpiModalItems(outsideNeedNTItems);
    }
    setKpiModalOpen(true);
  };

  // Alterar status do item de NT em tempo real no Firestore
  const handleNTItemStatusChange = async (itemId: string, newStatus: ItemStatus) => {
    try {
      setUpdatingNTItemId(itemId);
      const updateData: Partial<NTItem> = { status: newStatus };

      if (newStatus === "Pago") {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        updateData.payment_time = `${hours}:${minutes}`;
      }

      await updateNTItem(itemId, updateData);

      setKpiModalItems((prev) =>
        prev.map((i) => (i.itemId === itemId ? { ...i, status: newStatus } : i))
      );

      toast.success(`Status da NT atualizado para "${newStatus}"!`);
    } catch (error) {
      console.error("Erro ao atualizar status da NT:", error);
      toast.error("Falha ao atualizar status da NT.");
    } finally {
      setUpdatingNTItemId(null);
    }
  };

  // Itens filtrados dentro do modal de KPI
  const filteredKpiModalItems = useMemo(() => {
    if (!kpiModalSearch.trim()) return kpiModalItems;
    const s = kpiModalSearch.toLowerCase().trim();
    return kpiModalItems.filter(
      (item) =>
        item.ntNumber.toLowerCase().includes(s) ||
        (item.code && item.code.toLowerCase().includes(s)) ||
        (item.description && item.description.toLowerCase().includes(s))
    );
  }, [kpiModalItems, kpiModalSearch]);

  // Cálculos agregados
  const totalGeralNaoPesado = useMemo(() => {
    return Object.values(filteredExcipientes || {}).reduce((total: number, { ordens }: any) => {
      if (!Array.isArray(ordens)) return total;
      return total + ordens.reduce((sum: number, o: any) => sum + (o.pesado ? 0 : o.quantidade), 0);
    }, 0);
  }, [filteredExcipientes]);

  const totalQtdNTPendente = useMemo(() => {
    return Object.keys(filteredExcipientes || {}).reduce((total: number, excipient: string) => {
      const ntInfo = ntsPendentesPorExcipiente[excipient];
      return total + (ntInfo ? ntInfo.total : 0);
    }, 0);
  }, [filteredExcipientes, ntsPendentesPorExcipiente]);

  // Lista filtrada e ordenada
  const sortedExcipientsList = useMemo(() => {
    let list = Object.entries(filteredExcipientes || {});

    // Busca textual
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(([excipient, { codigo }]) => {
        return excipient.toLowerCase().includes(q) || (codigo && String(codigo).includes(q));
      });
    }

    // Ocultar pesados
    if (hideDone) {
      list = list.filter(([, { ordens }]) => {
        return Array.isArray(ordens) && ordens.some((ordem: any) => !ordem.pesado);
      });
    }

    // Segmentos: all | need | nt | ctrl
    if (activeFilter === "need") {
      list = list.filter(([excipient, { ordens }]) => {
        const totalNaoPesado = Array.isArray(ordens)
          ? ordens.reduce((s: number, o: any) => s + (o.pesado ? 0 : o.quantidade), 0)
          : 0;
        const saldo = materiaisNaArea[excipient] || 0;
        const nt = ntsPendentesPorExcipiente[excipient]?.total || 0;
        const falta = totalNaoPesado - saldo - nt;
        return falta > 0;
      });
    } else if (activeFilter === "nt") {
      list = list.filter(([excipient]) => {
        const nt = ntsPendentesPorExcipiente[excipient]?.total || 0;
        return nt > 0;
      });
    } else if (activeFilter === "ctrl") {
      list = list.filter(([excipient]) => {
        return EXCIPIENTES_ESPECIAIS.includes(excipient) || excipient.includes("**");
      });
    }

    // Ordenação
    list.sort((a, b) => {
      const [excipientA, { ordens: ordensA }] = a;
      const [excipientB, { ordens: ordensB }] = b;

      const needA = Array.isArray(ordensA) ? ordensA.reduce((s: number, o: any) => s + (o.pesado ? 0 : o.quantidade), 0) : 0;
      const needB = Array.isArray(ordensB) ? ordensB.reduce((s: number, o: any) => s + (o.pesado ? 0 : o.quantidade), 0) : 0;

      const ntA = ntsPendentesPorExcipiente[excipientA]?.total || 0;
      const ntB = ntsPendentesPorExcipiente[excipientB]?.total || 0;

      const saldoA = materiaisNaArea[excipientA] || 0;
      const saldoB = materiaisNaArea[excipientB] || 0;

      const faltaA = Math.max(0, needA - saldoA - ntA);
      const faltaB = Math.max(0, needB - saldoB - ntB);

      let valA = 0;
      let valB = 0;

      if (sortBy === "desc") {
        const cmp = excipientA.localeCompare(excipientB);
        return sortOrder === "asc" ? cmp : -cmp;
      } else if (sortBy === "need") {
        valA = needA;
        valB = needB;
      } else if (sortBy === "nt") {
        valA = ntA;
        valB = ntB;
      } else if (sortBy === "falta") {
        valA = faltaA;
        valB = faltaB;
      }

      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [
    filteredExcipientes,
    searchTerm,
    hideDone,
    activeFilter,
    sortBy,
    sortOrder,
    materiaisNaArea,
    ntsPendentesPorExcipiente,
  ]);

  const handleSortClick = (field: "desc" | "need" | "nt" | "falta") => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "desc" ? "asc" : "desc");
    }
  };

  const handleSingleSapSync = async (excipient: string, codigo: string) => {
    setLoadingSapItem(excipient);
    try {
      await handleUpdateSAPValues(excipient, codigo);
    } finally {
      setLoadingSapItem(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header do Conteúdo */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">Solicitações</h1>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Necessidade de matéria-prima das ordens ativas × saldo na área × NTs em aberto
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSap && (
            <button
              onClick={onOpenSap}
              className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] font-medium text-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <MagnifyingGlassIcon className="w-3.5 h-3.5" />
              <span>Consulta SAP</span>
            </button>
          )}
          <button
            onClick={handleUpdateAllSAPValues}
            disabled={isUpdatingSAP}
            className={`h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] font-medium text-xs inline-flex items-center gap-1.5 transition-colors ${
              isUpdatingSAP ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${isUpdatingSAP ? "animate-spin" : ""}`} />
            <span>Atualizar saldos</span>
          </button>
          {onOpenPullProduction && (
            <button
              onClick={onOpenPullProduction}
              className="h-8 px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] font-medium text-xs inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <svg className="w-3.5 h-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v11M7 10l5 5 5-5" />
                <path d="M4 20h16" />
              </svg>
              <span>Puxar produção</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Block (4 Blocos) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)] mb-5">
        {/* Bloco 1: Total a pesar */}
        <div className="p-3.5 relative">
          <label className="flex items-center gap-1.5 text-[var(--text-3)] text-xs mb-1.5">
            Total a pesar
          </label>
          <div className="text-xl font-semibold tracking-tight text-[var(--text)] font-mono">
            {formatNumber(totalGeralNaoPesado, 3)} <small className="text-xs font-normal text-[var(--text-3)]">kg</small>
          </div>
          <p className="text-[var(--text-3)] text-xs mt-1">Demanda das ordens não pesadas</p>
        </div>

        {/* Bloco 2: NTs pendentes */}
        <div className="p-3.5 relative">
          <label className="flex items-center gap-1.5 text-[var(--text-3)] text-xs mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--amber)] shrink-0" />
            NTs pendentes
          </label>
          <div className="text-xl font-semibold tracking-tight text-[var(--text)] font-mono">
            {totalPendingNTsCount}
          </div>
          <p className="text-[var(--text-3)] text-xs mt-1">Aguardando no almoxarifado</p>
          <button
            onClick={() => handleOpenKpiModal("nts")}
            className="absolute top-3.5 right-3.5 text-xs text-[var(--text-3)] hover:text-[var(--text)] flex items-center gap-0.5"
          >
            Ver lista <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>

        {/* Bloco 3: Itens pendentes */}
        <div className="p-3.5 relative">
          <label className="flex items-center gap-1.5 text-[var(--text-3)] text-xs mb-1.5">
            Itens pendentes
          </label>
          <div className="text-xl font-semibold tracking-tight text-[var(--text)] font-mono">
            {allPendingNTItems.length}
          </div>
          <p className="text-[var(--text-3)] text-xs mt-1">
            {formatNumber(totalQtdNTPendente, 3)} kg em NTs
          </p>
          <button
            onClick={() => handleOpenKpiModal("items")}
            className="absolute top-3.5 right-3.5 text-xs text-[var(--text-3)] hover:text-[var(--text)] flex items-center gap-0.5"
          >
            Ver itens <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>

        {/* Bloco 4: Fora da necessidade */}
        <div className="p-3.5 relative">
          <label className="flex items-center gap-1.5 text-[var(--text-3)] text-xs mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--red)] shrink-0" />
            Fora da necessidade
          </label>
          <div className="text-xl font-semibold tracking-tight text-[var(--text)] font-mono">
            {outsideNeedNTItems.length}
          </div>
          <p className="text-[var(--text-3)] text-xs mt-1">Itens em NT sem ordem correspondente</p>
          <button
            onClick={() => handleOpenKpiModal("outside")}
            className="absolute top-3.5 right-3.5 text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5 font-medium"
          >
            Auditar <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>
      </section>

      {/* Toolbar / Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        {/* Search */}
        <div className="flex items-center gap-2 h-8 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] flex-1 max-w-[360px] text-[var(--text-3)] focus-within:border-[var(--accent)]">
          <MagnifyingGlassIcon className="w-3.5 h-3.5 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar matéria-prima ou código"
            className="bg-transparent border-0 outline-none text-[var(--text)] text-xs flex-1 min-w-0 placeholder:text-[var(--text-3)]"
          />
          <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1.5 py-0.5 text-[var(--text-3)]">
            /
          </kbd>
        </div>

        {/* Segmented filter buttons */}
        <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
          <button
            onClick={() => setActiveFilter("all")}
            className={`h-7 px-3 text-xs font-medium border-r border-[var(--border-strong)] transition-colors ${
              activeFilter === "all" ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setActiveFilter("need")}
            className={`h-7 px-3 text-xs font-medium border-r border-[var(--border-strong)] transition-colors ${
              activeFilter === "need" ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
            }`}
          >
            A solicitar
          </button>
          <button
            onClick={() => setActiveFilter("nt")}
            className={`h-7 px-3 text-xs font-medium border-r border-[var(--border-strong)] transition-colors ${
              activeFilter === "nt" ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
            }`}
          >
            Com NT pendente
          </button>
          <button
            onClick={() => setActiveFilter("ctrl")}
            className={`h-7 px-3 text-xs font-medium transition-colors ${
              activeFilter === "ctrl" ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
            }`}
          >
            Controlados
          </button>
        </div>

        {/* Switch: Ocultar pesados */}
        <label className="flex items-center gap-2 text-xs text-[var(--text-2)] cursor-pointer select-none ml-1.5">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-[26px] h-[15px] rounded-full bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-[11px] after:h-[11px] after:rounded-full after:bg-[var(--text-2)] peer-checked:after:bg-white peer-checked:after:left-[13px] after:transition-all" />
          <span>Ocultar pesados</span>
        </label>

        {/* Active Order Filter Chip (if an order is selected from the sidebar) */}
        {selectedOrdem && (
          <div className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-[var(--accent-weak)] text-[var(--accent)] text-xs font-medium border border-[var(--accent)]/30">
            <span>Ordem: {selectedOrdem.nome}</span>
            {onClearSelectedOrdem && (
              <button
                onClick={onClearSelectedOrdem}
                className="w-4 h-4 rounded-full hover:bg-[var(--accent)]/20 inline-flex items-center justify-center text-[var(--accent)]"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Batch SAP Sync Button */}
        <button
          onClick={handleUpdateAllSAPValues}
          disabled={isUpdatingSAP}
          className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] font-medium text-xs inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${isUpdatingSAP ? "animate-spin" : ""}`} />
          <span>Sincronizar SAP</span>
        </button>
      </div>

      {/* Tabela Principal de Matérias-Primas */}
      <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[28px_minmax(220px,2.2fr)_1fr_1.1fr_1fr_1.2fr_40px] items-center gap-2 px-3 min-h-[36px] bg-[var(--surface-2)] text-[var(--text-3)] text-xs font-medium border-b border-[var(--border)] select-none">
          <span />
          <span
            onClick={() => handleSortClick("desc")}
            className={`cursor-pointer hover:text-[var(--text)] inline-flex items-center gap-1 ${
              sortBy === "desc" ? "text-[var(--text)] font-semibold" : ""
            }`}
          >
            Matéria-prima
            {sortBy === "desc" && (
              <span className="text-[10px]">{sortOrder === "asc" ? "↑" : "↓"}</span>
            )}
          </span>
          <span
            onClick={() => handleSortClick("need")}
            className={`text-right cursor-pointer hover:text-[var(--text)] inline-flex items-center justify-end gap-1 ${
              sortBy === "need" ? "text-[var(--text)] font-semibold" : ""
            }`}
          >
            Necessário
            {sortBy === "need" && (
              <span className="text-[10px]">{sortOrder === "asc" ? "↑" : "↓"}</span>
            )}
          </span>
          <span className="text-right">Saldo na área</span>
          <span
            onClick={() => handleSortClick("nt")}
            className={`text-right cursor-pointer hover:text-[var(--text)] inline-flex items-center justify-end gap-1 ${
              sortBy === "nt" ? "text-[var(--text)] font-semibold" : ""
            }`}
          >
            Em NT
            {sortBy === "nt" && (
              <span className="text-[10px]">{sortOrder === "asc" ? "↑" : "↓"}</span>
            )}
          </span>
          <span
            onClick={() => handleSortClick("falta")}
            className={`text-right cursor-pointer hover:text-[var(--text)] inline-flex items-center justify-end gap-1 ${
              sortBy === "falta" ? "text-[var(--text)] font-semibold" : ""
            }`}
          >
            Falta solicitar
            {sortBy === "falta" && (
              <span className="text-[10px]">{sortOrder === "asc" ? "↑" : "↓"}</span>
            )}
          </span>
          <span />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[var(--border)]">
          {sortedExcipientsList.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--text-3)]">
              Nenhuma matéria-prima encontrada para os critérios selecionados.
            </div>
          ) : (
            sortedExcipientsList.map(([excipient, { ordens, codigo }]: [string, any]) => {
              const naArea = materiaisNaArea[excipient] || 0;
              const totalNaoPesado = Array.isArray(ordens)
                ? ordens.reduce((acc: number, o: any) => acc + (o.pesado ? 0 : o.quantidade), 0)
                : 0;

              const totalGeralMaterial = Array.isArray(ordens)
                ? ordens.reduce((acc: number, o: any) => acc + o.quantidade, 0)
                : 0;

              const isAllWeighed = totalNaoPesado === 0 && totalGeralMaterial > 0;

              const ntInfo = ntsPendentesPorExcipiente[excipient] || { total: 0, items: [] };
              const qtdNTPendente = ntInfo.total;
              const faltaBruta = totalNaoPesado - naArea;
              const faltaLiquida = Math.max(0, faltaBruta - qtdNTPendente);

              const isExpanded = Array.isArray(expandedExcipient)
                ? expandedExcipient.includes(excipient)
                : expandedExcipient === excipient;

              const isControlled = EXCIPIENTES_ESPECIAIS.includes(excipient) || excipient.includes("**");
              const isLoadingThisSap = loadingSapItem === excipient;

              return (
                <React.Fragment key={excipient}>
                  {/* Linha Principal */}
                  <div
                    onClick={() => handleToggleExpandExcipient(excipient)}
                    className={`group grid grid-cols-[28px_minmax(220px,2.2fr)_1fr_1.1fr_1fr_1.2fr_40px] items-center gap-2 px-3 min-h-[48px] cursor-pointer transition-colors ${
                      isExpanded
                        ? "bg-[var(--hover)]"
                        : "hover:bg-[var(--hover)]"
                    }`}
                  >
                    {/* Chevron */}
                    <div className="text-[var(--text-3)] flex items-center justify-center">
                      <ChevronRightIcon
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          isExpanded ? "rotate-90 text-[var(--text)]" : ""
                        }`}
                      />
                    </div>

                    {/* Matéria-prima */}
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-xs text-[var(--text)] truncate">
                          {excipient}
                        </span>
                        {isControlled && (
                          <span className="text-[10px] font-medium text-[var(--amber)] border border-[var(--border-strong)] rounded px-1 leading-4">
                            Controlado
                          </span>
                        )}
                      </div>
                      {codigo && (
                        <span className="font-mono text-[11px] text-[var(--text-3)]">
                          {codigo}
                        </span>
                      )}
                    </div>

                    {/* Necessário */}
                    <div className="text-right font-mono text-[12.5px] text-[var(--text)] font-medium">
                      {formatNumber(totalNaoPesado, 3)} <span className="text-[10.5px] text-[var(--text-3)] font-sans">kg</span>
                    </div>

                    {/* Saldo na área (Inline Editable Input) */}
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          inputValues[excipient] !== undefined
                            ? inputValues[excipient]
                            : naArea
                            ? formatNumber(naArea, 3)
                            : ""
                        }
                        onChange={(e) => handleMateriaisNaAreaChange(excipient, e.target.value)}
                        placeholder="0,000"
                        className="w-[88px] h-7 px-2 text-right font-mono text-[12.5px] text-[var(--text)] border border-transparent rounded bg-transparent group-hover:border-[var(--border-strong)] group-hover:bg-[var(--bg)] focus:border-[var(--accent)]! focus:bg-[var(--bg)]! outline-none transition-colors"
                      />
                      <span className="text-[11px] text-[var(--text-3)]">kg</span>
                    </div>

                    {/* Em NT */}
                    <div className="flex flex-col items-end justify-center leading-tight">
                      {qtdNTPendente > 0 ? (
                        <>
                          <span className="font-mono text-[12.5px] text-[var(--text)] font-medium">
                            {formatNumber(qtdNTPendente, 3)} <span className="text-[10.5px] text-[var(--text-3)] font-sans">kg</span>
                          </span>
                          <span className="text-[10px] text-[var(--text-3)]">
                            {ntInfo.items.length} {ntInfo.items.length === 1 ? "item" : "itens"}
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--text-3)] text-xs">—</span>
                      )}
                    </div>

                    {/* Falta Solicitar */}
                    <div className="flex items-center justify-end gap-1.5">
                      {isAllWeighed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                          Atendido
                        </span>
                      ) : faltaBruta <= 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                          Atendido
                        </span>
                      ) : qtdNTPendente >= faltaBruta ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                          coberto por NT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--red)] font-mono font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] shrink-0" />
                          Falta {formatNumber(faltaLiquida, 3)} kg
                        </span>
                      )}
                    </div>

                    {/* SAP Button */}
                    <div
                      className="flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleSingleSapSync(excipient, codigo)}
                        disabled={isLoadingThisSap}
                        className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-3)] opacity-0 group-hover:opacity-100 hover:bg-[var(--border)] hover:text-[var(--text)] transition-all"
                        title="Consultar estoque desta matéria-prima no SAP"
                      >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoadingThisSap ? "animate-spin text-[var(--accent)]" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Sub-tabelas Expansíveis (.detail) */}
                  {isExpanded && (
                    <div className="bg-[var(--surface-2)] border-b border-[var(--border)] px-4 py-3 pl-12 space-y-4">
                      {/* Seção 1: Ordens de Produção vinculadas */}
                      <div>
                        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-[var(--border)]">
                          <h4 className="text-xs font-semibold text-[var(--text-2)]">
                            Ordens que usam este material
                          </h4>
                          <span className="text-xs text-[var(--text-3)]">
                            {ordens?.length || 0} ordem(ns) vinculada(s)
                          </span>
                        </div>

                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="text-[var(--text-3)] border-b border-[var(--border)]">
                              <th className="text-left font-medium py-1.5 px-2">OP</th>
                              <th className="text-left font-medium py-1.5 px-2">Produto</th>
                              <th className="text-right font-medium py-1.5 px-2">Qtd. receita</th>
                              <th className="text-center font-medium py-1.5 px-2">Status</th>
                              <th className="text-center font-medium py-1.5 px-2">Pesada</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {ordens?.map((ordem: any) => (
                              <tr
                                key={ordem.id}
                                className={`transition-colors ${
                                  ordem.pesado ? "text-[var(--text-3)]" : "text-[var(--text-2)]"
                                } hover:bg-[var(--hover)]`}
                              >
                                <td className="py-1.5 px-2 font-mono text-[11.5px]">
                                  {ordem.op ? (
                                    <span className="font-semibold text-[var(--text)]">
                                      {ordem.op}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className={`py-1.5 px-2 font-medium ${ordem.pesado ? "line-through text-[var(--text-3)]" : "text-[var(--text)]"}`}>
                                  {ordem.nome}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-[12px] text-[var(--text)]">
                                  {formatNumber(ordem.quantidade, 3)} kg
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${
                                      ordem.pesado
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    }`}
                                  >
                                    {ordem.pesado ? "Pesado" : "Pendente"}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={ordem.pesado}
                                    onChange={() => togglePesado(excipient, ordem.id)}
                                    className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Seção 2: NTs em aberto no almoxarifado */}
                      <div>
                        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-[var(--border)]">
                          <h4 className="text-xs font-semibold text-[var(--text-2)]">
                            NTs em aberto no almoxarifado
                          </h4>
                          <span className="text-xs text-[var(--text-3)]">
                            {qtdNTPendente > 0 ? `Total: ${formatNumber(qtdNTPendente, 3)} kg` : "Nenhuma NT pendente"}
                          </span>
                        </div>

                        {ntInfo.items.length > 0 ? (
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="text-[var(--text-3)] border-b border-[var(--border)]">
                                <th className="text-left font-medium py-1.5 px-2 w-[110px]">NT</th>
                                <th className="text-left font-medium py-1.5 px-2">Material</th>
                                <th className="text-right font-medium py-1.5 px-2 w-[120px]">Qtd. solicitada</th>
                                <th className="text-center font-medium py-1.5 px-2 w-[100px]">Lote</th>
                                <th className="text-center font-medium py-1.5 px-2 w-[130px]">Solicitado em</th>
                                <th className="text-center font-medium py-1.5 px-2 w-[130px]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {ntInfo.items.map((item, idx) => (
                                <tr key={`${item.ntId}_${item.itemId}_${idx}`} className="text-[var(--text-2)] hover:bg-[var(--hover)]">
                                  <td className="py-1.5 px-2 font-mono font-medium">
                                    <Link
                                      href={`/almoxarifado/nts?search=${encodeURIComponent(item.ntNumber)}`}
                                      className="text-[var(--accent)] hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Abrir nota técnica no almoxarifado"
                                    >
                                      {item.ntNumber}
                                    </Link>
                                  </td>
                                  <td className="py-1.5 px-2 text-[var(--text)]">
                                    <div>{item.description}</div>
                                    {item.code && (
                                      <div className="font-mono text-[10px] text-[var(--text-3)]">
                                        Cód: {item.code}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono font-medium text-[var(--text)]">
                                    {formatNumber(item.quantity, 3)} kg
                                  </td>
                                  <td className="py-1.5 px-2 text-center text-[var(--text-3)] font-mono text-[11px]">
                                    {item.batch || "—"}
                                  </td>
                                  <td className="py-1.5 px-2 text-center text-[var(--text-3)] text-[11px]">
                                    {item.createdDate} {item.createdTime ? `às ${item.createdTime}` : ""}
                                  </td>
                                  <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="min-w-[120px] inline-block">
                                      <StatusSwitch
                                        value={(item.status as ItemStatus) || "Ag. Pagamento"}
                                        onValueChange={(newStatus) => handleNTItemStatusChange(item.itemId, newStatus)}
                                        disabled={updatingNTItemId === item.itemId}
                                        size="sm"
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-3 bg-[var(--surface)] rounded border border-[var(--border)] text-center text-[var(--text-3)] text-xs">
                            Nenhuma NT pendente localizada para esta matéria-prima.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center py-2.5 px-1 text-[var(--text-3)] text-xs">
        <span>
          {sortedExcipientsList.length} {sortedExcipientsList.length === 1 ? "matéria-prima listada" : "matérias-primas listadas"}
        </span>
        <span>Falta solicitar = necessário − saldo − NTs em aberto</span>
      </div>

      {/* Modal Interativo de KPIs (NTs Pendentes / Itens / Fora da Necessidade) */}
      {kpiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-[10vh] z-50 p-4">
          <div className="w-[min(920px,92vw)] max-h-[78vh] flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Head */}
            <div className="flex justify-between items-start p-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                  {kpiModalTitle}
                  <span className="text-xs font-normal text-[var(--text-3)]">
                    ({filteredKpiModalItems.length})
                  </span>
                </h2>
                <p className="text-xs text-[var(--text-3)] mt-0.5 max-w-xl">
                  {kpiModalSubtitle}
                </p>
              </div>
              <button
                onClick={() => setKpiModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-auto space-y-3">
              <div className="flex items-center gap-2 h-8 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-[var(--text-3)] focus-within:border-[var(--accent)]">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={kpiModalSearch}
                  onChange={(e) => setKpiModalSearch(e.target.value)}
                  placeholder="Buscar por NT, código ou descrição"
                  className="bg-transparent border-0 outline-none text-[var(--text)] text-xs flex-1 min-w-0 placeholder:text-[var(--text-3)]"
                  autoFocus
                />
              </div>

              <div className="border border-[var(--border)] rounded overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-3)]">
                    <tr>
                      <th className="text-left font-medium py-2 px-2.5 w-[110px]">NT</th>
                      <th className="text-left font-medium py-2 px-2.5 w-[80px]">Código</th>
                      <th className="text-left font-medium py-2 px-2.5">Material</th>
                      <th className="text-right font-medium py-2 px-2.5 w-[120px]">Quantidade</th>
                      <th className="text-center font-medium py-2 px-2.5 w-[130px]">Solicitado em</th>
                      <th className="text-center font-medium py-2 px-2.5 w-[130px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                    {filteredKpiModalItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-xs text-[var(--text-3)]">
                          Nenhum item encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredKpiModalItems.map((item, idx) => (
                        <tr key={`${item.ntId}_${item.itemId}_${idx}`} className="hover:bg-[var(--hover)] text-[var(--text-2)]">
                          <td className="py-2 px-2.5 font-mono font-medium">
                            <Link
                              href={`/almoxarifado/nts?search=${encodeURIComponent(item.ntNumber)}`}
                              className="text-[var(--accent)] hover:underline"
                              target="_blank"
                            >
                              {item.ntNumber}
                            </Link>
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[var(--text-3)]">
                            {item.code || "—"}
                          </td>
                          <td className="py-2 px-2.5 text-[var(--text)] font-medium">
                            <div>{item.description}</div>
                            {item.batch && (
                              <span className="text-[10.5px] text-[var(--text-3)] font-normal font-mono">
                                Lote: {item.batch}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-semibold text-[var(--text)]">
                            {formatNumber(item.quantity, 3)} kg
                          </td>
                          <td className="py-2 px-2.5 text-center text-[var(--text-3)] text-[11px]">
                            {item.createdDate} {item.createdTime ? `às ${item.createdTime}` : ""}
                          </td>
                          <td className="py-2 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="min-w-[120px] inline-block">
                              <StatusSwitch
                                value={(item.status as ItemStatus) || "Ag. Pagamento"}
                                onValueChange={(newStatus) => handleNTItemStatusChange(item.itemId, newStatus)}
                                disabled={updatingNTItemId === item.itemId}
                                size="sm"
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Foot */}
            <div className="flex justify-between items-center p-3 px-4 border-t border-[var(--border)] text-[var(--text-3)] text-xs bg-[var(--surface-2)]">
              <span>{filteredKpiModalItems.length} itens listados</span>
              <button
                onClick={() => setKpiModalOpen(false)}
                className="h-7 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] font-medium text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabelaPrincipal;
