"use client";

import { useState, useMemo } from 'react';
import { Search, Plus, Sparkles, Droplets, Wind, Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { searchWipRecipes, getAllWipRecipes, WipRecipe } from '@/lib/wip-recipes';
import { createProductionItem } from '@/lib/production-helpers';
import { ProductionTurno } from '@/types';
import { SHIFT_SCHEDULES } from '@/lib/production-schedule';
import { cn } from '@/lib/utils';

interface RotasQuickAddProps {
  defaultTurno?: ProductionTurno;
  onItemCreated?: () => void;
  triggerButton?: React.ReactNode;
}

export function RotasQuickAdd({ defaultTurno = 1, onItemCreated, triggerButton }: RotasQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTurno, setSelectedTurno] = useState<ProductionTurno>(defaultTurno);
  const [progQty, setProgQty] = useState<number>(1);
  const [addingCode, setAddingCode] = useState<string | null>(null);

  // Lista de resultados filtrados de rotas
  const results = useMemo(() => {
    if (!query || query.trim().length < 2) {
      return getAllWipRecipes().slice(0, 15);
    }
    return searchWipRecipes(query, 25);
  }, [query]);

  const handleQuickAdd = async (recipe: WipRecipe) => {
    setAddingCode(recipe.codigo);
    try {
      await createProductionItem({
        turno: selectedTurno,
        tipo: 'ordem',
        via: recipe.via || 'SECA',
        familia: recipe.familia,
        codigoReceita: recipe.codigo,
        produto: recipe.produto,
        prog: progQty > 0 ? progQty : 1,
        real: 0,
      });

      toast.success(
        `Ordem "${recipe.codigo} - ${recipe.produto}" adicionada ao ${selectedTurno}º Turno!`
      );
      if (onItemCreated) onItemCreated();
    } catch (err: any) {
      console.error('Erro ao adicionar ordem via rotas:', err);
      toast.error('Erro ao adicionar ordem. Tente novamente.');
    } finally {
      setAddingCode(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <button
            type="button"
            className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sparkles size={13} className="text-[var(--accent)]" />
            <span>Pesquisar rotas</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] p-0 overflow-hidden flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl text-[var(--text)]">
        <DialogHeader className="px-5 py-4 border-b border-[var(--border)] flex flex-row items-center justify-between bg-[var(--surface)] shrink-0">
          <div>
            <DialogTitle className="text-[15px] font-semibold tracking-tight text-[var(--text)] flex items-center gap-2">
              <Sparkles size={15} className="text-[var(--accent)]" />
              Pesquisar Rotas / Receitas
            </DialogTitle>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Busque por código, produto ou família para adicionar diretamente ao quadro.
            </p>
          </div>
        </DialogHeader>

        {/* Controles: Busca + Turno + Qtd */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Código (ex: 700236), produto ou máquina..."
              className="h-8 w-full pl-8 pr-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
              <span>Turno:</span>
              <select
                value={String(selectedTurno)}
                onChange={(e) => setSelectedTurno(Number(e.target.value) as ProductionTurno)}
                className="h-8 px-2 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg)] text-xs text-[var(--text-2)] outline-none cursor-pointer"
              >
                {SHIFT_SCHEDULES.map((s) => (
                  <option key={s.n} value={String(s.n)}>
                    {s.l}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
              <span>Qtd:</span>
              <input
                type="number"
                min={1}
                value={progQty}
                onChange={(e) => setProgQty(Math.max(1, Number(e.target.value)))}
                className="h-8 w-14 text-center font-mono text-xs font-semibold rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text)] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 bg-[var(--surface)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-3)] px-1 pb-1">
            <span>
              {query.trim().length >= 2
                ? `${results.length} resultado(s) encontrado(s)`
                : 'Sugestões de receitas'}
            </span>
            <span className="text-[11px]">Clique em + Adicionar para lançar</span>
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-3)] space-y-1 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border)] p-6">
              <p className="font-semibold text-[var(--text-2)]">Nenhuma receita encontrada para "{query}"</p>
              <p className="text-[11px]">Tente buscar pelo código numérico ou parte do nome do produto.</p>
            </div>
          ) : (
            results.map((recipe) => {
              const isAdding = addingCode === recipe.codigo;
              const isUmida = recipe.via === 'UMIDA';

              return (
                <div
                  key={`${recipe.codigo}-${recipe.produto}`}
                  className="bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-[var(--radius)] p-3 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="shrink-0 font-mono font-semibold text-xs px-2 py-0.5 rounded border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text)]">
                        {recipe.codigo}
                      </span>

                      {recipe.familia && (
                        <span className="shrink-0 font-mono text-[11px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] flex items-center gap-1">
                          <Layers size={11} className="text-[var(--text-3)]" />
                          {recipe.familia}
                        </span>
                      )}

                      {recipe.via && (
                        <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] flex items-center gap-1">
                          {isUmida ? <Droplets size={11} className="text-[var(--accent)]" /> : <Wind size={11} className="text-[var(--text-3)]" />}
                          Via {isUmida ? 'Úmida' : 'Seca'}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-medium text-[var(--text)] truncate leading-snug">
                      {recipe.produto}
                    </h4>
                  </div>

                  <button
                    type="button"
                    disabled={isAdding}
                    onClick={() => handleQuickAdd(recipe)}
                    className="h-7 px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isAdding ? (
                      <span className="text-[11px]">Adicionando...</span>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Adicionar ({progQty})</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
