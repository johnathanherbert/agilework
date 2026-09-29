"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ScaleIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
  DocumentTextIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
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
  faltaSolicitar: Record<string, string>;
  inputValues: Record<string, string>;
  ntsPendentesPorExcipiente?: Record<string, ExcipienteNTInfo>;
  allPendingNTItems?: PendingNTItemDetail[];
  outsideNeedNTItems?: PendingNTItemDetail[];
  totalPendingNTsCount?: number;
  handleMateriaisNaAreaChange: (excipient: string, value: string) => void;
  handleDetailClick: (ativo: string) => void;
  handleToggleExpandExcipient: (excipient: string) => void;
  expandedExcipient: string | string[] | null;
  allExpanded: boolean;
  togglePesado: (excipient: string, ordemId: string) => void;
  calcularMovimentacaoTotal: () => number;
  getOrdensAtendidas: (excipient: string) => { ordensAtendidas: any[]; ordensNaoAtendidas: any[] };
  handleUpdateSAPValues: (excipient: string, codigo: string) => void;
  handleUpdateAllSAPValues: () => void;
  handleEditOrdem: (ordem: any) => void;
}

export const TabelaPrincipal: React.FC<TabelaPrincipalProps> = ({
  filteredExcipientes,
  materiaisNaArea,
  inputValues,
  ntsPendentesPorExcipiente = {},
  allPendingNTItems = [],
  outsideNeedNTItems = [],
  totalPendingNTsCount = 0,

  handleMateriaisNaAreaChange,
  handleToggleExpandExcipient,
  expandedExcipient,
  togglePesado,
  handleUpdateSAPValues,
  handleUpdateAllSAPValues,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [faltaSolicitarSort, setFaltaSolicitarSort] = useState<"asc" | "desc">("desc");
  const [showAutomaticOnly, setShowAutomaticOnly] = useState(false);
  const [showCompletedItems, setShowCompletedItems] = useState(false);
  const [showWithPendingNTsOnly, setShowWithPendingNTsOnly] = useState(false);
  const [updatingNTItemId, setUpdatingNTItemId] = useState<string | null>(null);

  // Estados do Modal de Detalhes dos KPIs
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
      setKpiModalTitle("Itens Solicitados Fora da Necessidade");
      setKpiModalSubtitle("Itens em NTs pendentes que NÃO fazem parte das matérias-primas das ordens em andamento");
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

      // Atualiza localmente a lista do modal se estiver aberto
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
    const search = kpiModalSearch.toLowerCase().trim();
    return kpiModalItems.filter(
      (item) =>
        item.ntNumber.toLowerCase().includes(search) ||
        (item.code && item.code.toLowerCase().includes(search)) ||
        (item.description && item.description.toLowerCase().includes(search))
    );
  }, [kpiModalItems, kpiModalSearch]);


  // Filtrar excipientes com base no termo de pesquisa e filtros adicionais

  const filteredExcipientsList = useMemo(() => {
    let filtered = Object.entries(filteredExcipientes || {}).filter(([excipient]) =>
      excipient.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!showCompletedItems) {
      filtered = filtered.filter(([, { ordens }]) => {
        return Array.isArray(ordens) && ordens.some((ordem: any) => !ordem.pesado);
      });
    }

    if (showAutomaticOnly) {
      filtered = filtered.filter(([excipient]) =>
        EXCIPIENTES_ESPECIAIS.includes(excipient)
      );
    }

    if (showWithPendingNTsOnly) {
      filtered = filtered.filter(([excipient]) => {
        const ntInfo = ntsPendentesPorExcipiente[excipient];
        return ntInfo && ntInfo.total > 0;
      });
    }

    return filtered.sort((a, b) => {
      const [excipientA, { ordens: ordensA }] = a;
      const [excipientB, { ordens: ordensB }] = b;
      const naAreaA = materiaisNaArea[excipientA] || 0;
      const naAreaB = materiaisNaArea[excipientB] || 0;
      const totalNaoPesadoA = ordensA.reduce(
        (sum: number, ordem: any) => sum + (ordem.pesado ? 0 : ordem.quantidade),
        0
      );
      const totalNaoPesadoB = ordensB.reduce(
        (sum: number, ordem: any) => sum + (ordem.pesado ? 0 : ordem.quantidade),
        0
      );
      const faltaSolicitarA = totalNaoPesadoA - naAreaA;
      const faltaSolicitarB = totalNaoPesadoB - naAreaB;
      if (faltaSolicitarSort === "asc") {
        return faltaSolicitarA - faltaSolicitarB;
      } else {
        return faltaSolicitarB - faltaSolicitarA;
      }
    });
  }, [
    filteredExcipientes,
    searchTerm,
    showCompletedItems,
    showAutomaticOnly,
    showWithPendingNTsOnly,
    materiaisNaArea,
    faltaSolicitarSort,
    ntsPendentesPorExcipiente,
  ]);

  const totalGeralNaoPesado = useMemo(() => {
    return Object.values(filteredExcipientes || {}).reduce((total: number, { ordens }: any) => {
      if (!Array.isArray(ordens)) return total;
      return total + ordens.reduce((sum: number, o: any) => sum + (o.pesado ? 0 : o.quantidade), 0);
    }, 0);
  }, [filteredExcipientes]);

  const totalFaltaGeralBruta = useMemo(() => {
    return Object.entries(filteredExcipientes || {}).reduce((total: number, [excipient, { ordens }]: any) => {
      if (!Array.isArray(ordens)) return total;
      const totalNaoPesado = ordens.reduce((sum: number, o: any) => sum + (o.pesado ? 0 : o.quantidade), 0);
      const naArea = materiaisNaArea[excipient] || 0;
      const falta = Math.max(0, totalNaoPesado - naArea);
      return total + falta;
    }, 0);
  }, [filteredExcipientes, materiaisNaArea]);

  const totalQtdNTPendente = useMemo(() => {
    return Object.keys(filteredExcipientes || {}).reduce((total: number, excipient: string) => {
      const ntInfo = ntsPendentesPorExcipiente[excipient];
      return total + (ntInfo ? ntInfo.total : 0);
    }, 0);
  }, [filteredExcipientes, ntsPendentesPorExcipiente]);

  const totalItensNTPendentesCount = useMemo(() => {
    return Object.keys(filteredExcipientes || {}).reduce((count: number, excipient: string) => {
      const ntInfo = ntsPendentesPorExcipiente[excipient];
      return count + (ntInfo?.items ? ntInfo.items.length : 0);
    }, 0);
  }, [filteredExcipientes, ntsPendentesPorExcipiente]);

  const totalFaltaLiquida = useMemo(() => {
    return Object.entries(filteredExcipientes || {}).reduce((total: number, [excipient, { ordens }]: any) => {
      if (!Array.isArray(ordens)) return total;
      const totalNaoPesado = ordens.reduce((sum: number, o: any) => sum + (o.pesado ? 0 : o.quantidade), 0);
      const naArea = materiaisNaArea[excipient] || 0;
      const faltaBruta = Math.max(0, totalNaoPesado - naArea);
      const ntInfo = ntsPendentesPorExcipiente[excipient];
      const emNT = ntInfo ? ntInfo.total : 0;
      const faltaLiquida = Math.max(0, faltaBruta - emNT);
      return total + faltaLiquida;
    }, 0);
  }, [filteredExcipientes, materiaisNaArea, ntsPendentesPorExcipiente]);

  const renderTableRow = ([excipient, { ordens, codigo }]: [string, any]) => {
    const naArea = materiaisNaArea[excipient] || 0;
    const totalNaoPesado = ordens.reduce((acc: number, ordem: any) => {
      return acc + (ordem.pesado ? 0 : ordem.quantidade);
    }, 0);
    
    const ntInfo = ntsPendentesPorExcipiente[excipient] || { total: 0, items: [] };
    const qtdNTPendente = ntInfo.total;
    const faltaBruta = totalNaoPesado - naArea;
    const faltaLiquida = Math.max(0, faltaBruta - qtdNTPendente);

    const isExpanded = Array.isArray(expandedExcipient) 
      ? expandedExcipient.includes(excipient) 
      : expandedExcipient === excipient;

    return (
      <React.Fragment key={excipient}>
        <tr
          onClick={() => handleToggleExpandExcipient(excipient)}
          className="hover:bg-blue-50/40 dark:hover:bg-gray-700/50 cursor-pointer transition-colors border-b border-gray-200 dark:border-gray-700/50 text-xs"
        >
          {/* Excipiente */}
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <ChevronRightIcon
                className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transform transition-transform duration-200 ${
                  isExpanded ? "rotate-90 text-blue-600" : ""
                }`}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {excipient}
                </span>
                {codigo && (
                  <span className="text-[10px] font-mono text-gray-400">
                    Cód: {codigo}
                  </span>
                )}
              </div>
            </div>
          </td>

          {/* Total Necessário */}
          <td className="px-3 py-2.5 text-right font-medium text-gray-800 dark:text-gray-200">
            {formatNumber(totalNaoPesado, 3)} kg
          </td>

          {/* Na Área */}
          <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={inputValues[excipient] !== undefined ? inputValues[excipient] : (naArea ? formatNumber(naArea, 3) : "")}
                onChange={(e) => handleMateriaisNaAreaChange(excipient, e.target.value)}
                className="w-20 px-2 py-1 text-right text-xs border rounded-md 
                          bg-white dark:bg-gray-700 
                          text-gray-900 dark:text-gray-100
                          border-gray-300 dark:border-gray-600
                          focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                placeholder="0,000"
              />
              <span className="text-[10px] text-gray-400">kg</span>
            </div>
          </td>

          {/* Quantidade Solicitada nas NTs Pendentes */}
          <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            {qtdNTPendente > 0 ? (
              <div className="inline-flex flex-col items-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs">
                  <ClockIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  {formatNumber(qtdNTPendente, 3)} kg
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium mt-0.5">
                  {ntInfo.items.length} {ntInfo.items.length === 1 ? "item em NT" : "itens em NT"}
                </span>
              </div>
            ) : (
              <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
            )}
          </td>

          {/* Falta Solicitar */}
          <td className="px-3 py-2.5 text-right">
            {faltaBruta <= 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/40 ring-1 ring-green-600/20">
                Atendido
              </span>
            ) : qtdNTPendente >= faltaBruta ? (
              <div className="flex flex-col items-end">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 ring-1 ring-blue-600/20">
                  <CheckCircleIcon className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                  {formatNumber(faltaBruta, 3)} kg
                </span>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                  Em NT Pendente
                </span>
              </div>
            ) : qtdNTPendente > 0 ? (
              <div className="flex flex-col items-end">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 ring-1 ring-red-600/20">
                  Falta {formatNumber(faltaLiquida, 3)} kg
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  (Total: {formatNumber(faltaBruta, 3)} | NT: {formatNumber(qtdNTPendente, 3)})
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 ring-1 ring-red-600/20">
                {formatNumber(faltaBruta, 3)} kg
              </span>
            )}
          </td>

          {/* Atualizar SAP */}
          <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleUpdateSAPValues(excipient, codigo)}
              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
              title="Buscar saldo no SAP / Dashpesagem"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </td>
        </tr>

        {/* Linha expandida com detalhes de ordens e NTs pendentes */}
        {isExpanded && (
          <tr>
            <td colSpan={6} className="p-0 bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700">
              <div className="p-4 space-y-4">
                {/* Seção 1: Ordens de Produção */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <ScaleIcon className="w-4 h-4 text-blue-600" />
                      Ordens de Produção vinculadas a {excipient}
                    </span>
                    <span className="text-gray-400 font-normal">
                      {ordens.length} ordem(ns)
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xs">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">OP</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Produto / Ativo</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Qtd. Receita</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Status</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Pesado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {ordens.map((ordem: any) => (
                          <tr key={ordem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                              {ordem.op ? (
                                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded text-[11px] font-bold">
                                  {ordem.op}
                                </span>
                              ) : (
                                "N/A"
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                              {ordem.nome}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">
                              {formatNumber(ordem.quantidade, 3)} kg
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ordem.pesado
                                    ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300"
                                    : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300"
                                }`}
                              >
                                {ordem.pesado ? (
                                  <>
                                    <CheckCircleIcon className="w-3 h-3 mr-1" />
                                    Pesado
                                  </>
                                ) : (
                                  "Pendente"
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={ordem.pesado}
                                onChange={() => togglePesado(excipient, ordem.id)}
                                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Seção 2: NTs Pendentes vinculadas */}
                <div className="space-y-2 pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <DocumentTextIcon className="w-4 h-4 text-amber-600" />
                      NTs Pendentes no Almoxarifado para {excipient}
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                      {qtdNTPendente > 0 ? `Total: ${formatNumber(qtdNTPendente, 3)} kg` : "Nenhuma NT pendente"}
                    </span>
                  </div>

                  {ntInfo.items.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-2xs">
                      <table className="min-w-full divide-y divide-amber-200/60 dark:divide-amber-800/40 text-xs">
                        <thead className="bg-amber-100/50 dark:bg-amber-900/30">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Nº da NT</th>
                            <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Descrição / Código</th>
                            <th className="px-3 py-2 text-right font-medium text-amber-900 dark:text-amber-200">Qtd. Solicitada</th>
                            <th className="px-3 py-2 text-center font-medium text-amber-900 dark:text-amber-200">Lote</th>
                            <th className="px-3 py-2 text-center font-medium text-amber-900 dark:text-amber-200">Data / Hora</th>
                            <th className="px-3 py-2 text-center font-medium text-amber-900 dark:text-amber-200">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30 bg-white/60 dark:bg-gray-800/60">
                          {ntInfo.items.map((item, idx) => (
                            <tr key={`${item.ntId}_${item.itemId}_${idx}`} className="hover:bg-amber-100/40 dark:hover:bg-amber-900/20">
                              <td className="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                                <Link
                                  href={`/almoxarifado/nts?search=${encodeURIComponent(item.ntNumber)}`}
                                  className="hover:underline flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Abrir no Almoxarifado"
                                >
                                  {item.ntNumber}
                                </Link>
                              </td>
                              <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                                <div>{item.description}</div>
                                {item.code && (
                                  <div className="text-[10px] font-mono text-gray-400">Cód: {item.code}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-amber-900 dark:text-amber-200">
                                {formatNumber(item.quantity, 3)} kg
                              </td>
                              <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">
                                {item.batch || "—"}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">
                                {item.createdDate} {item.createdTime ? `às ${item.createdTime}` : ""}
                              </td>
                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="min-w-[130px] inline-block">
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
                    </div>
                  ) : (
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-400 text-xs">
                      Nenhuma NT pendente localizada para esta matéria-prima.
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {/* 4 Cards de Resumo Superior (KPIs Operacionais Interativos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total a Pesar */}
        <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-blue-200/80 dark:border-blue-800/50 shadow-xs bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <ScaleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Total a Pesar
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
              Ordens
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
              {formatNumber(totalGeralNaoPesado, 3)} kg
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              Demanda das ordens ativas
            </p>
          </div>
        </div>

        {/* Card 2: NTs Pendentes (Clicável) */}
        <div
          onClick={() => handleOpenKpiModal("nts")}
          className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-amber-200/80 dark:border-amber-700/50 shadow-xs bg-gradient-to-br from-white to-amber-50/40 dark:from-gray-800 dark:to-amber-950/20 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group flex flex-col justify-between"
          title="Clique para visualizar a lista de NTs pendentes"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <DocumentTextIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              NTs Pendentes
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 group-hover:bg-amber-200 transition-colors">
              Ver lista ↗
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300">
              {totalPendingNTsCount} {totalPendingNTsCount === 1 ? "NT aberta" : "NTs abertas"}
            </p>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              Aguardando no almoxarifado
            </p>
          </div>
        </div>

        {/* Card 3: Itens Pendentes (Clicável) */}
        <div
          onClick={() => handleOpenKpiModal("items")}
          className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-indigo-200/80 dark:border-indigo-700/50 shadow-xs bg-gradient-to-br from-white to-indigo-50/40 dark:from-gray-800 dark:to-indigo-950/20 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group flex flex-col justify-between"
          title="Clique para visualizar todos os itens de NTs pendentes"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Itens Pendentes
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 group-hover:bg-indigo-200 transition-colors">
              Ver itens ↗
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300">
              {allPendingNTItems.length} {allPendingNTItems.length === 1 ? "item" : "itens"}
            </p>
            <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
              Total: {formatNumber(totalQtdNTPendente, 3)} kg em NTs
            </p>
          </div>
        </div>

        {/* Card 4: Itens Solicitados Fora da Necessidade (Clicável) */}
        <div
          onClick={() => handleOpenKpiModal("outside")}
          className={`p-3.5 rounded-xl border shadow-xs transition-all cursor-pointer group flex flex-col justify-between ${
            outsideNeedNTItems.length > 0
              ? "bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-800 dark:to-purple-950/30 border-purple-300 dark:border-purple-700 hover:border-purple-400 hover:shadow-md ring-1 ring-purple-400/20"
              : "bg-white dark:bg-gray-800 border-gray-200/80 dark:border-gray-700/50 hover:border-gray-300"
          }`}
          title="Clique para visualizar os itens de NTs que não constam nas ordens ativas"
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-medium flex items-center gap-1.5 ${
              outsideNeedNTItems.length > 0
                ? "text-purple-700 dark:text-purple-300 font-bold"
                : "text-gray-500 dark:text-gray-400"
            }`}>
              {outsideNeedNTItems.length > 0 ? (
                <ExclamationTriangleIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <ClipboardDocumentListIcon className="w-4 h-4 text-gray-400" />
              )}
              Fora da Necessidade
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              outsideNeedNTItems.length > 0
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 group-hover:bg-purple-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}>
              {outsideNeedNTItems.length > 0 ? "Auditar ↗" : "0"}
            </span>
          </div>
          <div className="mt-2">
            <p className={`text-xl font-extrabold ${
              outsideNeedNTItems.length > 0
                ? "text-purple-700 dark:text-purple-300"
                : "text-gray-700 dark:text-gray-300"
            }`}>
              {outsideNeedNTItems.length} {outsideNeedNTItems.length === 1 ? "item avulso" : "itens avulsos"}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {outsideNeedNTItems.length > 0
                ? "Itens sem ordem correspondente"
                : "Nenhum item avulso em aberto"}
            </p>
          </div>
        </div>
      </div>


      {/* Tabela Principal de Matérias-Primas */}
      <div className="bg-white dark:bg-gray-800/90 rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 overflow-hidden">
        {/* Barra de Filtros */}
        <div className="p-3.5 border-b border-gray-200 dark:border-gray-700/50 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar matéria-prima..."
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCompletedItems(!showCompletedItems)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                showCompletedItems
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                  : "bg-white text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
              }`}
              title="Mostrar ou ocultar itens já pesados"
            >
              {showCompletedItems ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
              <span>{showCompletedItems ? "Todos os itens" : "Ocultar pesados"}</span>
            </button>

            <button
              onClick={() => setShowWithPendingNTsOnly(!showWithPendingNTsOnly)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                showWithPendingNTsOnly
                  ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                  : "bg-white text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
              }`}
              title="Filtrar matérias-primas com NTs pendentes"
            >
              <ClockIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>Com NTs Pendentes</span>
            </button>

            <button
              onClick={() => setShowAutomaticOnly(!showAutomaticOnly)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showAutomaticOnly
                  ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                  : "bg-white text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
              }`}
            >
              Especiais
            </button>

            <button
              onClick={handleUpdateAllSAPValues}
              className="px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 flex items-center gap-1"
              title="Atualizar saldo de todas as matérias-primas pelo SAP"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Sincronizar SAP</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Matéria-Prima</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total Necessário</th>
                <th className="px-3 py-2.5 text-right font-semibold">Saldo na Área</th>
                <th className="px-3 py-2.5 text-center font-semibold">NTs Pendentes</th>
                <th
                  onClick={() => setFaltaSolicitarSort(faltaSolicitarSort === "asc" ? "desc" : "asc")}
                  className="px-3 py-2.5 text-right font-semibold cursor-pointer hover:text-blue-600 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Falta Solicitar</span>
                    {faltaSolicitarSort === "asc" ? (
                      <ArrowUpIcon className="w-3 h-3" />
                    ) : (
                      <ArrowDownIcon className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">SAP</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredExcipientsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-xs text-gray-400">
                    Nenhuma matéria-prima encontrada para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filteredExcipientsList.map(renderTableRow)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Interativo de Detalhes dos KPIs (NTs Pendentes / Itens / Fora da Necessidade) */}
      {kpiModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/80 dark:to-gray-800 shrink-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {kpiModalTitle}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                    {filteredKpiModalItems.length} {filteredKpiModalItems.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {kpiModalSubtitle}
                </p>
              </div>
              <button
                onClick={() => setKpiModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Busca Rápida */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30 shrink-0">
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={kpiModalSearch}
                  onChange={(e) => setKpiModalSearch(e.target.value)}
                  placeholder="Buscar por número da NT, código ou descrição..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  autoFocus
                />
              </div>
            </div>

            {/* Tabela de Itens */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredKpiModalItems.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400">
                  Nenhum item encontrado para a busca selecionada.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Nº da NT</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Código</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Descrição do Material</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">Quantidade</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Horário de Solicitação</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white dark:bg-gray-800">
                      {filteredKpiModalItems.map((item, idx) => (
                        <tr key={`${item.ntId}_${item.itemId}_${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-3 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            <Link
                              href={`/almoxarifado/nts?search=${encodeURIComponent(item.ntNumber)}`}
                              className="hover:underline flex items-center gap-1"
                              target="_blank"
                              title="Abrir no Almoxarifado"
                            >
                              {item.ntNumber}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-700 dark:text-gray-300 font-medium">
                            {item.code || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                            <div>{item.description}</div>
                            {item.batch && (
                              <span className="text-[10px] text-gray-400">Lote: {item.batch}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100">
                            {formatNumber(item.quantity, 3)} kg
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 text-[11px]">
                            {item.createdDate} {item.createdTime ? `às ${item.createdTime}` : ""}
                          </td>
                          <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="min-w-[130px] inline-block">
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
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Total de {filteredKpiModalItems.length} {filteredKpiModalItems.length === 1 ? "registro listado" : "registros listados"}
              </span>
              <button
                onClick={() => setKpiModalOpen(false)}
                className="px-4 py-1.5 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
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

