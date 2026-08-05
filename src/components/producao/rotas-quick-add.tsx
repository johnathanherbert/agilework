"use client";

import { useState, useMemo } from 'react';
import { Search, Plus, Sparkles, Droplets, Wind, Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchWipRecipes, getAllWipRecipes, WipRecipe } from '@/lib/wip-recipes';
import { createProductionItem } from '@/lib/production-helpers';
import { ProductionTurno, ProductionVia } from '@/types';
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
  const badgeBase = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold leading-none';

  // Lista de resultados filtrados de rotas.json
  const results = useMemo(() => {
    if (!query || query.trim().length < 2) {
      // Exibe os primeiros 20 itens como sugestão inicial
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
        `Ordem "${recipe.codigo} - ${recipe.produto}" adicionada ao ${selectedTurno}º Turno!`,
        { icon: '✨' }
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs rounded-xl"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Pesquisar Rotas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md">
        <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#002e52] to-[#00477a] flex items-center justify-center text-white shadow-sm shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Pesquisa Inteligente de Rotas
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Busque por código SA, nome do produto ou família para programar no quadro de produção.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Controles superiores: Busca + Turno + Qtd ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o código (ex: 700236), produto ou família..."
              className="pl-10 text-xs h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xs font-medium"
              autoFocus
            />
          </div>

          {/* Seleção do Turno & Qtd */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Turno:</span>
              <Select
                value={String(selectedTurno)}
                onValueChange={(val) => setSelectedTurno(Number(val) as ProductionTurno)}
              >
                <SelectTrigger className="h-10 text-xs w-28 font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1">1º Turno</SelectItem>
                  <SelectItem value="2">2º Turno</SelectItem>
                  <SelectItem value="3">3º Turno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Qtd:</span>
              <Input
                type="number"
                min={1}
                value={progQty}
                onChange={(e) => setProgQty(Math.max(1, Number(e.target.value)))}
                className="h-10 w-16 text-xs font-mono font-extrabold text-center rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* ── Lista de Resultados ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0 bg-slate-50/40 dark:bg-slate-950/20">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1 pb-1">
            <span>
              {query.trim().length >= 2
                ? `${results.length} resultados encontrados`
                : 'Sugestões de receitas'}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Clique em + Programar para lançar</span>
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6">
              <p className="font-bold text-slate-700 dark:text-slate-300">Nenhuma receita encontrada para "{query}"</p>
              <p className="text-[11px]">Tente buscar pelo código numérico ou parte do nome do produto.</p>
            </div>
          ) : (
            results.map((recipe) => {
              const isAdding = addingCode === recipe.codigo;
              const isUmida = recipe.via === 'UMIDA';

              return (
                <div
                  key={`${recipe.codigo}-${recipe.produto}`}
                  className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-primary/50 rounded-2xl p-3.5 shadow-2xs hover:shadow-md transition-all duration-150 flex items-center justify-between gap-3 group backdrop-blur-md"
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="shrink-0 font-mono font-black text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {recipe.codigo}
                      </span>

                      {recipe.familia && (
                        <span className="shrink-0 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Layers className="h-3 w-3 text-slate-400" />
                          {recipe.familia}
                        </span>
                      )}

                      {recipe.via && (
                        <span className="shrink-0 font-bold text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          {isUmida ? <Droplets className="h-3 w-3 text-blue-500" /> : <Wind className="h-3 w-3 text-cyan-500" />}
                          Via {isUmida ? 'Úmida' : 'Seca'}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-snug">
                      {recipe.produto}
                    </h4>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={isAdding}
                    onClick={() => handleQuickAdd(recipe)}
                    className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-2xs rounded-xl h-9 px-3.5"
                  >
                    {isAdding ? (
                      <span className="text-[10px]">Adicionando...</span>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Programar ({progQty})
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
