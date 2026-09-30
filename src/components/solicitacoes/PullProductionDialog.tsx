"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ProductionTurno, ProductionItem } from "@/types";
import { useProductionRealtime } from "@/hooks/useProductionRealtime";
import { 
  Factory, 
  ArrowDownToLine, 
  AlertCircle,
  Clock,
  Loader2,
  Check,
  Search,
  Filter
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  const [searchQuery, setSearchQuery] = useState("");

  // Filtra os itens do painel de produção com base no turno e busca
  const filteredItems = useMemo(() => {
    return productionItems.filter((item) => {
      if (selectedTurno !== 'todos' && item.turno !== selectedTurno) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const code = (item.codigoReceita || "").toLowerCase();
        const prod = (item.produto || "").toLowerCase();
        const fam = (item.familia || "").toLowerCase();
        return code.includes(query) || prod.includes(query) || fam.includes(query);
      }
      return true;
    });
  }, [productionItems, selectedTurno, searchQuery]);

  // Contadores por turno
  const turnoCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, todos: productionItems.length };
    productionItems.forEach(item => {
      if (item.turno === 1) counts[1]++;
      else if (item.turno === 2) counts[2]++;
      else if (item.turno === 3) counts[3]++;
    });
    return counts;
  }, [productionItems]);

  // Inicializa a seleção marcando todos os itens visíveis por padrão ao mudar o turno
  useEffect(() => {
    const validIds = new Set(filteredItems.map(i => i.id));
    setSelectedItemIds(validIds);
  }, [selectedTurno]); // apenas quando muda o turno, para não resetar seleções ao digitar na busca

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
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
      return;
    }

    await onImport(selected);
    onClose();
  };

  const turnos: { label: string; value: ProductionTurno | 'todos'; desc: string }[] = [
    { label: 'Turno 1', value: 1, desc: '06h - 14h' },
    { label: 'Turno 2', value: 2, desc: '14h - 22h' },
    { label: 'Turno 3', value: 3, desc: '22h - 06h' },
    { label: 'Todos', value: 'todos', desc: 'Geral' },
  ];

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-[620px] w-full p-0 overflow-hidden bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl flex flex-col max-h-[88vh]">
        {/* Cabeçalho do Modal */}
        <DialogHeader className="px-5 py-4 border-b border-[var(--border)] flex flex-row items-start justify-between bg-[var(--surface)] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]">
                <Factory size={15} />
              </span>
              <DialogTitle className="text-[15px] font-semibold text-[var(--text)] tracking-tight">
                Puxar do Painel de Produção
              </DialogTitle>
            </div>
            <p className="text-xs text-[var(--text-3)] mt-1 ml-[29px]">
              Importe os lotes programados no turno para cálculo e solicitação de pesagem
            </p>
          </div>
        </DialogHeader>

        {/* Corpo do Modal */}
        <div className="overflow-y-auto px-5 py-3 space-y-4 flex-1">
          {/* 1. SELEÇÃO DE TURNO (SEGMENTED) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-semibold text-[var(--text-2)]">
                Turno da Produção
              </label>
              <span className="text-[11.5px] text-[var(--text-3)] font-mono">
                {selectedTurno === 'todos' ? `${turnoCounts.todos} ordens no total` : `${turnoCounts[selectedTurno]} ordens no turno`}
              </span>
            </div>

            <div className="grid grid-cols-4 border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)] divide-x divide-[var(--border-strong)]">
              {turnos.map((t) => {
                const isSelected = selectedTurno === t.value;
                const count = turnoCounts[t.value];
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSelectedTurno(t.value)}
                    className={cn(
                      "py-2 px-2.5 flex flex-col items-center justify-center transition-colors text-xs font-medium",
                      isSelected
                        ? "bg-[var(--hover)] text-[var(--text)] shadow-xs"
                        : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--surface)]"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock size={11} className={isSelected ? "text-[var(--accent)]" : "opacity-50"} />
                      <span>{t.label}</span>
                    </span>
                    <span className="text-[10px] text-[var(--text-3)] font-mono mt-0.5">
                      {count} {count === 1 ? 'ordem' : 'ordens'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. BARRA DE BUSCA E CONTROLES */}
          <div className="space-y-2 pt-1 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-3)] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por produto, código ou família..."
                  className="h-8 w-full pl-8 pr-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors"
                />
              </div>

              {filteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors whitespace-nowrap"
                >
                  {selectedItemIds.size === filteredItems.length
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </button>
              )}
            </div>

            {/* Subtítulo com contagem */}
            <div className="flex items-center justify-between text-xs px-0.5 text-[var(--text-3)]">
              <span>
                {filteredItems.length} {filteredItems.length === 1 ? 'item programado' : 'itens programados'}
              </span>
              <span className="font-mono">
                {selectedItemIds.size} selecionado{selectedItemIds.size !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* 3. LISTA DE ORDENS / ITENS */}
          <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
            <div className="grid grid-cols-[36px_75px_1fr_60px] items-center px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)] text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
              <span>Sel.</span>
              <span>Código</span>
              <span>Produto / Linha</span>
              <span className="text-right">Lotes</span>
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border)]">
              {loadingProd ? (
                <div className="p-8 text-center text-xs text-[var(--text-3)] flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[var(--text-3)]" />
                  <span>Carregando programação do painel de produção...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-3)] flex flex-col items-center gap-2">
                  <AlertCircle size={18} className="text-[var(--text-3)]" />
                  <span>
                    {searchQuery.trim()
                      ? 'Nenhuma ordem encontrada com este filtro de busca.'
                      : 'Nenhuma ordem programada encontrada para este turno.'}
                  </span>
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
                      className={cn(
                        "grid grid-cols-[36px_75px_1fr_60px] items-center px-3 py-2 cursor-pointer transition-colors text-xs select-none",
                        isChecked
                          ? "bg-[var(--accent-weak)]/40 hover:bg-[var(--accent-weak)]/60"
                          : "hover:bg-[var(--hover)]"
                      )}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // tratado no onClick da row
                          className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--accent)] cursor-pointer"
                        />
                      </div>

                      {/* Código */}
                      <div className="font-mono text-xs font-medium text-[var(--text)] flex flex-col">
                        <span>{cleanCode || 'S/N'}</span>
                        {willCleanSuffix && (
                          <span className="text-[10px] text-[var(--amber)] font-mono" title="O sufixo 'I' será ignorado na busca da lista técnica">
                            (I ignorado)
                          </span>
                        )}
                      </div>

                      {/* Produto & Metadados */}
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[var(--text)] truncate">
                            {item.produto}
                          </span>
                          {item.lp && (
                            <span className="text-[10px] font-semibold text-[var(--violet)] border border-[var(--violet)] px-1 rounded-xs leading-tight">
                              LP
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mt-0.5">
                          <span>T{item.turno}</span>
                          {item.via && (
                            <>
                              <span>•</span>
                              <span className={item.via === 'SECA' ? 'text-[var(--amber)]' : 'text-[#22d3ee]'}>
                                {item.via === 'UMIDA' ? 'Via Úmida' : 'Via Seca'}
                              </span>
                            </>
                          )}
                          {item.familia && (
                            <>
                              <span>•</span>
                              <span className="truncate">{item.familia}</span>
                            </>
                          )}
                          {item.tipo && item.tipo !== 'ordem' && (
                            <>
                              <span>•</span>
                              <span className="uppercase text-[10px] font-semibold">{item.tipo}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quantidade Lotes */}
                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-[var(--text)]">
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

        {/* Rodapé do Modal */}
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between shrink-0">
          <div className="text-xs text-[var(--text-3)]">
            <span className="font-medium text-[var(--text-2)]">{selectedItemIds.size}</span> de {filteredItems.length} selecionados
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isLoading || selectedItemIds.size === 0}
              onClick={handleConfirmImport}
              className="h-8 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine size={13} />
                  <span>Importar {selectedItemIds.size > 0 ? `${selectedItemIds.size} ${selectedItemIds.size === 1 ? 'Ordem' : 'Ordens'}` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PullProductionDialog;
