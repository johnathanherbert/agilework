"use client";

import React, { useState, useCallback } from "react";
import { fetchSapMaterialStock } from "@/lib/dashpesagem-api";
import { 
  MagnifyingGlassIcon, 
  XMarkIcon,
  ArrowPathIcon,
  ChartBarIcon,
  TableCellsIcon,
  DocumentDuplicateIcon,
  CheckIcon
} from "@heroicons/react/24/outline";

export default function Sap({ open, onClose, user }: { open: boolean; onClose: () => void; user?: any }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [materialData, setMaterialData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setError(null);
    setMaterialData(null);

    try {
      const data = await fetchSapMaterialStock(searchTerm.trim());

      if (data && data.length > 0) {
        const groupedData = data.reduce((acc: any, item: any) => {
          if (!acc.codigo_materia_prima) {
            acc.codigo_materia_prima = item.material;
            acc.descricao = item.texto_breve_material;
            acc.unidade_medida = item.unidade_medida || 'KG';
            acc.saldo_total = 0;
            acc.lotes = [];
            acc.tipo_estoque = item.tipo_estoque;
            acc.estatisticas = {
              media_por_lote: 0,
              menor_lote: Infinity,
              maior_lote: -Infinity,
              total_lotes: 0
            };
          }

          const quantidade = parseFloat(item.estoque_disponivel) || 0;
          acc.saldo_total += quantidade;
          acc.estatisticas.total_lotes++;
          acc.estatisticas.menor_lote = Math.min(acc.estatisticas.menor_lote, quantidade);
          acc.estatisticas.maior_lote = Math.max(acc.estatisticas.maior_lote, quantidade);

          acc.lotes.push({
            lote: item.lote,
            quantidade: quantidade,
            deposito: item.deposito,
            posicao: item.posicao_deposito,
            tipo_estoque: item.tipo_estoque,
            data_validade: item.data_vencimento
          });

          return acc;
        }, {});

        groupedData.estatisticas.media_por_lote = 
          groupedData.saldo_total / (groupedData.estatisticas.total_lotes || 1);

        setMaterialData(groupedData);
      } else {
        setError("Nenhum material encontrado com o código fornecido no estoque.");
      }
    } catch (err) {
      console.error("Erro na busca:", err);
      setError("Ocorreu um erro durante a busca no banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const copyToClipboard = useCallback(async () => {
    if (!materialData) return;

    const formatData = () => {
      const header = `${materialData.codigo_materia_prima} - ${materialData.descricao}\n`;
      const summary = `Saldo Total: ${materialData.saldo_total.toFixed(3)} ${materialData.unidade_medida}\n`;
      const lotes = materialData.lotes
        .map((lote: any) => 
          `${lote.lote}\t${lote.quantidade.toFixed(3)}\t${lote.posicao || lote.deposito || '-'}\t${lote.data_validade ? new Date(lote.data_validade).toLocaleDateString() : '-'}`
        )
        .join('\n');
      return `${header}${summary}\nLotes:\n${lotes}`;
    };

    try {
      await navigator.clipboard.writeText(formatData());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar dados:', err);
    }
  }, [materialData]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <MagnifyingGlassIcon className="w-5 h-5" />
            <h2 className="text-lg font-bold">
              Consulta de Estoque SAP
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite o código do material (Ex: 0100234 ou 100234)"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium shadow-sm"
            >
              {loading ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  Buscar
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {materialData && (
            <div className="space-y-6 animate-fadeIn">
              {/* Material Info Card */}
              <div className="bg-blue-50/60 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/40">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded">
                      {materialData.codigo_materia_prima}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                      {materialData.descricao}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="p-2 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors flex items-center gap-1.5 text-xs font-medium"
                      title="Copiar dados"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-4 h-4 text-green-500" />
                          <span className="text-green-500">Copiado</span>
                        </>
                      ) : (
                        <>
                          <DocumentDuplicateIcon className="w-4 h-4" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-800/30">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Saldo Total</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {materialData.saldo_total.toFixed(3)} {materialData.unidade_medida}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total de Lotes</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      {materialData.estatisticas.total_lotes}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Menor Lote</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      {materialData.estatisticas.menor_lote.toFixed(3)} {materialData.unidade_medida}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Maior Lote</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      {materialData.estatisticas.maior_lote.toFixed(3)} {materialData.unidade_medida}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabela de Lotes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center justify-between">
                  <span>Lotes Disponíveis</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                    {materialData.lotes.length} lote(s) listado(s)
                  </span>
                </h4>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/80">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Lote
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Quantidade
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Posição / Depósito
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Validade
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                      {materialData.lotes.map((lote: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2.5 font-mono font-medium text-gray-900 dark:text-gray-100">
                            {lote.lote}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100">
                            {lote.quantidade.toFixed(3)} {materialData.unidade_medida}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {lote.posicao || lote.deposito || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400 text-xs">
                            {lote.data_validade ? new Date(lote.data_validade).toLocaleDateString('pt-BR') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
