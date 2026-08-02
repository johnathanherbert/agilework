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
        `Ordem "#${recipe.codigo} - ${recipe.produto}" adicionada ao ${selectedTurno}º Turno!`,
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
            className="gap-1.5 text-xs bg-slate-50 dark:bg-card border-primary/30 text-primary hover:bg-primary/10 shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Pesquisar Rotas (SA)
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border bg-slate-50 dark:bg-card shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Inteligência de Rotas (rotas.json)
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Busque por código SA, nome do produto ou família para programar ordens rapidamente no quadro.
          </p>
        </DialogHeader>

        {/* ── Controles superiores: Busca + Configuração do Turno ── */}
        <div className="p-4 border-b border-border bg-white dark:bg-card/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o código (ex: 700236), produto ou família..."
              className="pl-9 text-xs h-9 bg-slate-50 dark:bg-muted/40"
              autoFocus
            />
          </div>

          {/* Seleção do Turno & Qtd */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Turno:</span>
              <Select
                value={String(selectedTurno)}
                onValueChange={(val) => setSelectedTurno(Number(val) as ProductionTurno)}
              >
                <SelectTrigger className="h-9 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1º Turno</SelectItem>
                  <SelectItem value="2">2º Turno</SelectItem>
                  <SelectItem value="3">3º Turno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Qtd:</span>
              <Input
                type="number"
                min={1}
                value={progQty}
                onChange={(e) => setProgQty(Math.max(1, Number(e.target.value)))}
                className="h-9 w-16 text-xs tabular-nums text-center"
              />
            </div>
          </div>
        </div>

        {/* ── Lista de Resultados ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 bg-slate-50/50 dark:bg-card/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1">
            <span>
              {query.trim().length >= 2
                ? `${results.length} resultados encontrados`
                : 'Sugestões de receitas em rotas.json'}
            </span>
            <span className="text-[10px]">Clique em + Programar para lançar no quadro</span>
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-1">
              <p className="font-semibold">Nenhuma receita encontrada para "{query}"</p>
              <p className="text-[11px]">Tente buscar por código numérico ou parte do nome do produto.</p>
            </div>
          ) : (
            results.map((recipe) => {
              const isAdding = addingCode === recipe.codigo;
              const isUmida = recipe.via === 'UMIDA';

              return (
                <div
                  key={`${recipe.codigo}-${recipe.produto}`}
                  className="bg-white dark:bg-card border border-slate-200 dark:border-border/80 hover:border-primary/40 rounded-xl p-3 shadow-xs hover:shadow-sm transition-all duration-150 flex items-center justify-between gap-3 group"
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {recipe.familia && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 shrink-0"
                        >
                          <Layers className="h-2.5 w-2.5 mr-1" />
                          {recipe.familia}
                        </Badge>
                      )}

                      <span className="text-xs font-mono font-extrabold text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                        #{recipe.codigo}
                      </span>

                      {recipe.via && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0 shrink-0 flex items-center gap-1',
                            isUmida
                              ? 'text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30'
                              : 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
                          )}
                        >
                          {isUmida ? <Droplets className="h-2.5 w-2.5" /> : <Wind className="h-2.5 w-2.5" />}
                          Via {isUmida ? 'Úmida' : 'Seca'}
                        </Badge>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-foreground truncate leading-snug">
                      {recipe.produto}
                    </h4>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={isAdding}
                    onClick={() => handleQuickAdd(recipe)}
                    className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-xs"
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
