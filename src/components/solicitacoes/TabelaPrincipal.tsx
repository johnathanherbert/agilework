"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ScaleIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";
import Modal from "./Modal";
import MaterialRequestManager from "./MaterialRequestManager";
import AlmoxarifadoManager from "./AlmoxarifadoManager";
import { useRequests } from "@/contexts/RequestsContext";

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
  faltaSolicitar,
  inputValues,
  handleMateriaisNaAreaChange,
  handleToggleExpandExcipient,
  expandedExcipient,
  allExpanded,
  togglePesado,
  handleUpdateSAPValues,
  handleUpdateAllSAPValues,
  handleEditOrdem,
}) => {
  const [selectedExcipient, setSelectedExcipient] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [faltaSolicitarSort, setFaltaSolicitarSort] = useState<"asc" | "desc">("desc");
  const [showAutomaticOnly, setShowAutomaticOnly] = useState(false);
  const [almoxarifadoOpen, setAlmoxarifadoOpen] = useState(false);
  const [showCompletedItems, setShowCompletedItems] = useState(false);

  // Usar o contexto de requests
  const { materialRequests } = useRequests();

  // Estado para gerenciar solicitações
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);

  const handleOpenRequestsModal = (excipient: string) => {
    setSelectedExcipient(excipient);
    setRequestsModalOpen(true);
  };

  const handleCloseRequestsModal = () => {
    setRequestsModalOpen(false);
    setSelectedExcipient(null);
  };

  const handleToggleAlmoxarifado = () => {
    setAlmoxarifadoOpen(!almoxarifadoOpen);
  };

  const getRequestStatusLabel = (excipient: string) => {
    if (!materialRequests[excipient] || materialRequests[excipient].length === 0) {
      return { label: "Solicitar", total: 0 };
    }
    
    const totalRequested = materialRequests[excipient].reduce(
      (total: number, req: any) => total + parseFloat(req.amount || 0), 
      0
    ).toFixed(2);
    
    const requestCount = materialRequests[excipient].length;
    const hasPending = materialRequests[excipient].some((req: any) => req.status === "pendente");
    const hasRequested = materialRequests[excipient].some((req: any) => req.status === "solicitado");
    const hasPaid = materialRequests[excipient].some((req: any) => req.status === "pago" || req.status === "entregue");
    
    let statusLabel = `${requestCount} solicitações`;
    if ([hasPending, hasRequested, hasPaid].filter(Boolean).length > 1) {
      statusLabel = `${requestCount} solicitações`;
    } else if (hasPending) {
      statusLabel = `${requestCount} pendente${requestCount > 1 ? 's' : ''}`;
    } else if (hasRequested) {
      statusLabel = `${requestCount} solicitado${requestCount > 1 ? 's' : ''}`;
    } else if (hasPaid) {
      statusLabel = `${requestCount} pago${requestCount > 1 ? 's' : ''}`;
    }
    
    return {
      label: statusLabel,
      total: totalRequested
    };
  };

  const getRequestStatusColor = (excipient: string) => {
    if (!materialRequests[excipient] || materialRequests[excipient].length === 0) {
      return "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600/20";
    }
    
    const hasPending = materialRequests[excipient].some((req: any) => req.status === "pendente");
    const hasRequested = materialRequests[excipient].some((req: any) => req.status === "solicitado");
    const hasPaid = materialRequests[excipient].some((req: any) => req.status === "pago" || req.status === "entregue");
    
    if (hasPending) {
      return "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 ring-1 ring-orange-600/20";
    } else if (hasRequested) {
      return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 ring-1 ring-yellow-600/20";
    } else if (hasPaid) {
      return "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 ring-1 ring-green-600/20";
    }
    
    return "bg-gray-100 dark:bg-gray-900/40 text-gray-800 dark:text-gray-300 ring-1 ring-gray-600/20";
  };

  const handleCopyCode = (codigo: string) => {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => {
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50';
      toast.textContent = 'Código copiado!';
      document.body.appendChild(toast);
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 2000);
    });
  };

  // Filtrar excipientes com base no termo de pesquisa
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
    materiaisNaArea,
    faltaSolicitarSort,
  ]);

  const totalGeralNaoPesado = useMemo(() => {
    return Object.values(filteredExcipientes || {}).reduce((total: number, { ordens }: any) => {
      if (!Array.isArray(ordens)) return total;
      return total + ordens.reduce((sum: number, o: any) => sum + (o.pesado ? 0 : o.quantidade), 0);
    }, 0);
  }, [filteredExcipientes]);

  const totalFaltaGeral = useMemo(() => {
    return Object.entries(filteredExcipientes || {}).reduce((total: number, [excipient, { ordens }]: any) => {
      if (!Array.isArray(ordens)) return total;
      const totalNaoPesado = ordens.reduce((sum: number, o: any) => sum + (o.pesado ? 0 : o.quantidade), 0);
      const naArea = materiaisNaArea[excipient] || 0;
      const falta = Math.max(0, totalNaoPesado - naArea);
      return total + falta;
    }, 0);
  }, [filteredExcipientes, materiaisNaArea]);

  const renderTableRow = ([excipient, { total, ordens, codigo }]: [string, any]) => {
    const naArea = materiaisNaArea[excipient] || 0;
    const totalNaoPesado = ordens.reduce((acc: number, ordem: any) => {
      return acc + (ordem.pesado ? 0 : ordem.quantidade);
    }, 0);
    const falta = totalNaoPesado - naArea;
    const requestStatus = getRequestStatusLabel(excipient);
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
            {totalNaoPesado.toFixed(3)} kg
          </td>

          {/* Na Área */}
          <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1">
              <input
                type="number"
                step="0.001"
                value={inputValues[excipient] !== undefined ? inputValues[excipient] : (naArea ? naArea.toString() : "")}
                onChange={(e) => handleMateriaisNaAreaChange(excipient, e.target.value)}
                className="w-20 px-2 py-1 text-right text-xs border rounded-md 
                          bg-white dark:bg-gray-700 
                          text-gray-900 dark:text-gray-100
                          border-gray-300 dark:border-gray-600
                          focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                placeholder="0.000"
              />
              <span className="text-[10px] text-gray-400">kg</span>
            </div>
          </td>

          {/* Falta Solicitar */}
          <td className="px-3 py-2.5 text-right">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                falta > 0
                  ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 ring-1 ring-red-600/20"
                  : "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/40 ring-1 ring-green-600/20"
              }`}
            >
              {falta > 0 ? `${falta.toFixed(3)} kg` : "Atendido"}
            </span>
          </td>

          {/* Solicitações */}
          <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleOpenRequestsModal(excipient)}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRequestStatusColor(
                excipient
              )} hover:scale-105 transition-all shadow-2xs`}
            >
              <PlusCircleIcon className="w-3.5 h-3.5 mr-1" />
              {materialRequests[excipient] && materialRequests[excipient].length > 0 ? (
                <span>
                  {requestStatus.label} ({requestStatus.total} kg)
                </span>
              ) : (
                <span>Solicitar</span>
              )}
            </button>
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

        {/* Linha expandida com ordens */}
        {isExpanded && (
          <tr>
            <td colSpan={6} className="p-0 bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700">
              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-1.5">
                    <ScaleIcon className="w-4 h-4 text-blue-600" />
                    Ordens vinculadas a {excipient}
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
                            {ordem.quantidade.toFixed(3)} kg
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
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {/* Cards de Resumo Superior */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xs">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Total a Pesar
          </span>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            {totalGeralNaoPesado.toFixed(3)} kg
          </p>
        </div>

        <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xs">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Falta Solicitar
          </span>
          <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">
            {totalFaltaGeral.toFixed(3)} kg
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Almoxarifado
            </span>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
              Painel de Entregas
            </p>
          </div>
          <button
            onClick={handleToggleAlmoxarifado}
            className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-100"
          >
            <BuildingStorefrontIcon className="w-4 h-4" />
            {almoxarifadoOpen ? "Fechar" : "Abrir"}
          </button>
        </div>
      </div>

      {/* Painel do Almoxarifado Expandido */}
      {almoxarifadoOpen && (
        <div className="animate-fadeIn">
          <AlmoxarifadoManager />
        </div>
      )}

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

          <div className="flex items-center gap-2">
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
                <th className="px-3 py-2.5 text-center font-semibold">Solicitações</th>
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

      {/* Modal de Solicitações do Material Selecionado */}
      {requestsModalOpen && selectedExcipient && (
        <Modal
          isOpen={requestsModalOpen}
          onClose={handleCloseRequestsModal}
          title={`Gerenciar Solicitações — ${selectedExcipient}`}
          size="2xl"
          variant="default"
          customIcon={<PlusCircleIcon className="w-5 h-5 text-white" />}
        >
          <MaterialRequestManager
            selectedExcipient={selectedExcipient}
            pendingQuantity={
              (filteredExcipientes[selectedExcipient]?.ordens || []).reduce(
                (total: number, ordem: any) => (!ordem.pesado ? total + ordem.quantidade : total),
                0
              ) - (materiaisNaArea[selectedExcipient] || 0)
            }
            currentAmount={materiaisNaArea[selectedExcipient] || 0}
            filteredExcipientes={filteredExcipientes}
          />
        </Modal>
      )}
    </div>
  );
};

export default TabelaPrincipal;
