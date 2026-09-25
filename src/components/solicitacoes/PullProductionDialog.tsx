"use client";

import React, { useState, useMemo } from "react";
import { ProductionTurno, ProductionItem } from "@/types";
import { useProductionRealtime } from "@/hooks/useProductionRealtime";
import { 
  Factory, 
  Layers, 
  CheckCircle2, 
  ArrowDownToLine, 
  X,
  AlertCircle,
  Clock
} from "lucide-react";

interface PullProductionDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (selectedItems: { codigoReceita: string; produto: string; prog: number; op?: string }[]) => Promise<void>;
  isLoading?: boolean;
}

export const PullProductionDialog: React.FC<PullProductionDialogProps> = ({
  open,
  onClose,
  onImport,
  isLoading = false,
}) => {
  const { items: productionItems, loading: loadingProd } = useProductionRealtime();
  const [selectedTurno, setSelectedTurno] = useState<ProductionTurno | 'todos'>(1);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Filtra os itens do painel de produção com base no turno
  const filteredItems = useMemo(() => {
    return productionItems.filter((item) => {
      if (selectedTurno !== 'todos' && item.turno !== selectedTurno) return false;
      return true;
    });
  }, [productionItems, selectedTurno]);

  // Inicializa a seleção marcando todos os itens visíveis por padrão ao mudar o turno
  React.useEffect(() => {
    const validIds = new Set(filteredItems.map(i => i.id));
    setSelectedItemIds(validIds);
  }, [filteredItems]);

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmImport = async () => {
    const selected = filteredItems
      .filter(item => selectedItemIds.has(item.id))
      .map(item => {
        // Limpa o código da receita: remove 'I' no final e espaços
        let cleanCode = (item.codigoReceita || item.produto || '').trim();
        if (cleanCode.toUpperCase().endsWith('I')) {
          cleanCode = cleanCode.slice(0, -1).trim();
        }
        return {
          codigoReceita: cleanCode,
          produto: item.produto,
          prog: item.prog || 1,
          op: undefined,
        };
      });

    if (selected.length === 0) {
      alert("Selecione pelo menos um item para puxar.");
      return;
    }

    await onImport(selected);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Puxar do Painel de Produção</h2>
              <p className="text-xs text-blue-100">
                Importe os lotes programados no turno para cálculo de pesagem e solicitação
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Seletor de Turno */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Selecione o Turno da Produção:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Turno 1', value: 1 },
                { label: 'Turno 2', value: 2 },
                { label: 'Turno 3', value: 3 },
                { label: 'Todos os Turnos', value: 'todos' },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSelectedTurno(t.value as any)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    selectedTurno === t.value
                      ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 opacity-70" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Itens do Turno */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Itens Programados ({filteredItems.length})
              </span>
              {filteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  {selectedItemIds.size === filteredItems.length
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 max-h-[320px] overflow-y-auto">
              {loadingProd ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Carregando programação do painel de produção...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-gray-400" />
                  <span>Nenhum item programado encontrado para este turno.</span>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isChecked = selectedItemIds.has(item.id);
                  const cleanCode = (item.codigoReceita || item.produto || '').trim();
                  const willCleanSuffix = cleanCode.toUpperCase().endsWith('I');

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-blue-50/50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {item.produto}
                            </span>
                            {item.tipo && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {item.tipo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className="font-mono">
                              Cód: {cleanCode || 'S/N'}
                              {willCleanSuffix && (
                                <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold" title="O 'I' final será ignorado para busca na Lista Técnica">
                                  (I ignorado)
                                </span>
                              )}
                            </span>
                            <span>•</span>
                            <span>Turno {item.turno}</span>
                            {item.via && (
                              <>
                                <span>•</span>
                                <span>Via {item.via}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right pl-3">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {item.prog} {item.prog === 1 ? 'lote' : 'lotes'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedItemIds.size} de {filteredItems.length} selecionados
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isLoading || selectedItemIds.size === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>{isLoading ? 'Puxando...' : `Importar ${selectedItemIds.size} Ordens`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PullProductionDialog;
