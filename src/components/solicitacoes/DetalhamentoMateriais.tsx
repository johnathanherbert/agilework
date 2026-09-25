"use client";

import React, { useState } from "react";
import {
  ViewColumnsIcon,
  TableCellsIcon,
  XMarkIcon,
  CheckIcon,
  HashtagIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface DetalhamentoMateriaisProps {
  getFilteredAtivos: () => string[];
  getAtivoStatus: (ativo: string) => string;
  ordens: any[];
  filteredExcipientes: Record<string, any>;
  materiaisNaArea: Record<string, number>;
}

export const DetalhamentoMateriais: React.FC<DetalhamentoMateriaisProps> = ({
  getFilteredAtivos,
  getAtivoStatus,
  ordens,
  filteredExcipientes,
  materiaisNaArea,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAtivo, setSelectedAtivo] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const handleOpenDialog = (ativo: string) => {
    setSelectedAtivo(ativo);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAtivo(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pesado":
        return "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300";
      case "completo":
        return "bg-green-50 dark:bg-green-800/30 text-green-700 dark:text-green-200";
      case "parcial":
        return "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200";
      case "indisponivel":
        return "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200";
      default:
        return "bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pesado":
        return "Pesado";
      case "completo":
        return "Disponível";
      case "parcial":
        return "Parcial";
      default:
        return "Indisponível";
    }
  };

  const getOPList = (ordensList: any[], ativo: string) => {
    if (!Array.isArray(ordensList) || ordensList.length === 0) {
      return "Nenhuma OP";
    }

    const opsDoAtivo = ordensList
      .filter((ordem) => ordem && ordem.nome === ativo && ordem.op)
      .map((ordem) => ordem.op);

    return opsDoAtivo.length > 0 ? opsDoAtivo.join(", ") : "Nenhuma OP";
  };

  const ativosList = getFilteredAtivos();

  return (
    <div className="bg-white dark:bg-gray-800/90 rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Detalhamento por Ativo
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {ativosList.length} produto(s) nas ordens
          </p>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1 rounded ${
              viewMode === "grid"
                ? "bg-white dark:bg-gray-800 text-blue-600 shadow-xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
            title="Grade"
          >
            <ViewColumnsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1 rounded ${
              viewMode === "table"
                ? "bg-white dark:bg-gray-800 text-blue-600 shadow-xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
            title="Tabela"
          >
            <TableCellsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 max-h-[calc(100vh-280px)] overflow-y-auto space-y-2.5">
        {ativosList.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">
            Nenhum ativo adicionado às ordens
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-2.5">
            {ativosList.map((ativo) => {
              const status = getAtivoStatus(ativo);
              const statusClass = getStatusColor(status);
              const statusLabel = getStatusText(status);
              const opList = getOPList(ordens, ativo);

              return (
                <div
                  key={ativo}
                  onClick={() => handleOpenDialog(ativo)}
                  className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200/80 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all hover:shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate flex-1">
                      {ativo}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span>OP: {opList}</span>
                    <span className="text-blue-600 dark:text-blue-400 hover:underline">
                      Ver Excipientes →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
              <thead>
                <tr>
                  <th className="py-2 text-left text-gray-500">Ativo</th>
                  <th className="py-2 text-center text-gray-500">Status</th>
                  <th className="py-2 text-right text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {ativosList.map((ativo) => {
                  const status = getAtivoStatus(ativo);
                  return (
                    <tr key={ativo} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-2 font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                        {ativo}
                      </td>
                      <td className="py-2 text-center">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(
                            status
                          )}`}
                        >
                          {getStatusText(status)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleOpenDialog(ativo)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalhamento dos Excipientes do Ativo */}
      {dialogOpen && selectedAtivo && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider">
                  Detalhamento de Matéria-Prima
                </span>
                <h3 className="text-base font-bold">{selectedAtivo}</h3>
              </div>
              <button
                onClick={handleCloseDialog}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Excipiente
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                        Necessário (kg)
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                        Na Área (kg)
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(filteredExcipientes || {})
                      .filter(
                        ([_, data]) =>
                          data.ordens &&
                          Array.isArray(data.ordens) &&
                          data.ordens.some((ordem: any) => ordem && ordem.nome === selectedAtivo)
                      )
                      .map(([excipient, data]) => {
                        const ordensDoAtivo = data.ordens.filter(
                          (ordem: any) => ordem && ordem.nome === selectedAtivo
                        );
                        const quantidadeNecessaria = ordensDoAtivo.reduce(
                          (sum: number, ordem: any) =>
                            sum + (ordem.pesado ? 0 : ordem.quantidade),
                          0
                        );
                        const quantidadeNaArea = materiaisNaArea[excipient] || 0;
                        const todosPesados = ordensDoAtivo.every(
                          (ordem: any) => ordem.pesado
                        );
                        const status = todosPesados
                          ? "pesado"
                          : quantidadeNaArea >= quantidadeNecessaria
                          ? "completo"
                          : quantidadeNaArea > 0
                          ? "parcial"
                          : "indisponivel";

                        return (
                          <tr key={excipient} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                              {todosPesados ? (
                                <s className="text-gray-400">{excipient}</s>
                              ) : (
                                excipient
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100">
                              {quantidadeNecessaria.toFixed(3)} kg
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 font-medium">
                              {quantidadeNaArea.toFixed(3)} kg
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(
                                  status
                                )}`}
                              >
                                {getStatusText(status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex justify-end">
              <button
                onClick={handleCloseDialog}
                className="px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
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

export default DetalhamentoMateriais;
