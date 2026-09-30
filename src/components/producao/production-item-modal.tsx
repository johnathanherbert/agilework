"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Trash2, Split, Lock, Check, Search, Plus, Minus, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createProductionItem,
  updateProductionItem,
  splitProductionItem,
} from '@/lib/production-helpers';
import {
  getAllWipRecipes,
  searchWipRecipes,
  getWipFamilies,
  WipRecipe,
} from '@/lib/wip-recipes';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import {
  SHIFT_SCHEDULES,
  getShiftPhase,
  getShiftStats,
  getShiftDefinition,
  getItemStatus,
  formatDuration,
} from '@/lib/production-schedule';
import { cn } from '@/lib/utils';

interface ProductionItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  tipo: ProductionTipo;
  item?: ProductionItem | null;
  defaultTurno: ProductionTurno;
  defaultVia?: ProductionVia;
  allItems?: ProductionItem[];
  onSuccess?: () => void;
  onRequestDelete?: (item: ProductionItem) => void;
}

const tipoLabels: Record<ProductionTipo, string> = {
  ordem: 'Ordem de Produção',
  auto: 'Pesagem Automática',
  direta: 'Pesagem Direta',
};

function normalizeStr(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function ProductionItemModal({
  open,
  onOpenChange,
  mode,
  tipo,
  item,
  defaultTurno,
  defaultVia = 'UMIDA',
  allItems = [],
  onSuccess,
  onRequestDelete,
}: ProductionItemModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos do formulário
  const [turno, setTurno] = useState<ProductionTurno>(defaultTurno);
  const [via, setVia] = useState<ProductionVia>(defaultVia);
  const [codigo, setCodigo] = useState('');
  const [produto, setProduto] = useState('');
  const [familia, setFamilia] = useState('');
  const [prog, setProg] = useState(1);
  const [real, setReal] = useState(0);
  const [lp, setLp] = useState(false);

  // Opções de cópia
  const [copyToDireta, setCopyToDireta] = useState(false);
  const [dirQty, setDirQty] = useState(1);
  const [dirQtyEdited, setDirQtyEdited] = useState(false);

  const [copyToAuto, setCopyToAuto] = useState(false);
  const [autoQty, setAutoQty] = useState(1);
  const [autoQtyEdited, setAutoQtyEdited] = useState(false);

  const [copyToOrdem, setCopyToOrdem] = useState(true);

  // Sugestões de autocompletar
  const [suggestions, setSuggestions] = useState<WipRecipe[]>([]);
  const [sugIndex, setSugIndex] = useState(-1);
  const [showSug, setShowSug] = useState(false);
  const [foundRecipe, setFoundRecipe] = useState<WipRecipe | null>(null);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  // Divisão de ordem
  const [showSplit, setShowSplit] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitQty, setSplitQty] = useState(1);
  const [splitTurno, setSplitTurno] = useState<ProductionTurno>(1);

  // Erros de validação
  const [errors, setErrors] = useState<{ codigo?: boolean; produto?: boolean; real?: boolean }>({});

  const isLocked = mode === 'edit' && !!item?.locked;
  const inputRef = useRef<HTMLInputElement>(null);
  const sugBoxRef = useRef<HTMLDivElement>(null);

  // Lista de máquinas/famílias conhecidas para o datalist
  const knownFamilies = useMemo(() => {
    const list = getWipFamilies();
    const fromItems = allItems.map((i) => i.familia).filter((f): f is string => Boolean(f && f.trim()));
    return Array.from(new Set([...list, ...fromItems])).sort();
  }, [allItems]);

  // Data atual de referência para fases dos turnos
  const now = useMemo(() => new Date(), [open]);

  // Inicialização do formulário
  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && item) {
      setTurno(item.turno);
      setVia(item.via || defaultVia);
      setCodigo(item.codigoReceita || '');
      setProduto(item.produto);
      setFamilia(item.familia || '');
      setProg(item.prog);
      setReal(item.real);
      setLp(!!item.lp);

      const remaining = Math.max(item.prog - item.real, 0);
      setSplitQty(remaining > 0 ? remaining : 1);
      const nextT = (item.turno === 3 ? 1 : item.turno === 1 ? 2 : 3) as ProductionTurno;
      setSplitTurno(nextT);
      setShowSplit(false);

      if (item.codigoReceita) {
        const recipes = getAllWipRecipes();
        const found = recipes.find(
          (r) => normalizeStr(r.codigo) === normalizeStr(item.codigoReceita || '')
        );
        setFoundRecipe(found || null);
        setIsAutoFilled(!!found);
      } else {
        setFoundRecipe(null);
        setIsAutoFilled(false);
      }
    } else {
      setTurno(defaultTurno);
      setVia(defaultVia);
      setCodigo('');
      setProduto('');
      setFamilia('');
      setProg(1);
      setReal(0);
      setLp(false);
      setFoundRecipe(null);
      setIsAutoFilled(false);
      setShowSplit(false);
    }

    setCopyToDireta(false);
    setDirQty(1);
    setDirQtyEdited(false);
    setCopyToAuto(false);
    setAutoQty(1);
    setAutoQtyEdited(false);
    setCopyToOrdem(true);
    setErrors({});
    setShowSug(false);
    setSugIndex(-1);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  }, [open, mode, item, defaultTurno, defaultVia]);

  // Sincroniza quantidades das cópias de PD/PA enquanto o usuário não tiver editado manualmente
  const handleProgChange = (val: number) => {
    const p = Math.max(1, isNaN(val) ? 1 : val);
    setProg(p);
    if (!dirQtyEdited) setDirQty(p);
    if (!autoQtyEdited) setAutoQty(p);
  };

  // Busca e sugestão instantânea
  const handleCodigoInput = (val: string) => {
    setCodigo(val);
    setErrors((prev) => ({ ...prev, codigo: false }));
    const trimmed = val.trim();

    if (!trimmed) {
      setFoundRecipe(null);
      setIsAutoFilled(false);
      setSuggestions([]);
      setShowSug(false);
      return;
    }

    const all = getAllWipRecipes();
    const exact = all.find(
      (r) =>
        normalizeStr(r.codigo) === normalizeStr(trimmed) ||
        normalizeStr(r.codigo) === normalizeStr(trimmed + 'I') ||
        (trimmed.endsWith('I') && normalizeStr(r.codigo) === normalizeStr(trimmed.slice(0, -1)))
    );

    if (exact && normalizeStr(exact.codigo) === normalizeStr(trimmed)) {
      handleSelectRecipe(exact);
      return;
    }

    const matches = searchWipRecipes(trimmed, 8);
    setSuggestions(matches);
    setSugIndex(matches.length > 0 ? 0 : -1);
    setShowSug(true);

    if (foundRecipe && normalizeStr(foundRecipe.codigo) !== normalizeStr(trimmed)) {
      setFoundRecipe(null);
      setIsAutoFilled(false);
    }
  };

  const handleSelectRecipe = (recipe: WipRecipe) => {
    setCodigo(recipe.codigo);
    setProduto(recipe.produto);
    if (recipe.familia) setFamilia(recipe.familia);
    if (recipe.via) setVia(recipe.via);

    setFoundRecipe(recipe);
    setIsAutoFilled(true);
    setShowSug(false);
    setSuggestions([]);
    setErrors((prev) => ({ ...prev, codigo: false, produto: false }));
  };

  const handleCodigoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSug || !suggestions.length) {
      if (e.key === 'ArrowDown' && codigo.trim()) {
        setShowSug(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSugIndex((prev) => Math.min(suggestions.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSugIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sugIndex >= 0 && suggestions[sugIndex]) {
        handleSelectRecipe(suggestions[sugIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSug(false);
    }
  };

  // Status de turno e impacto no quadro
  const currentShiftDef = getShiftDefinition(turno);
  const currentPhase = getShiftPhase(turno, now);
  const shiftStatsBefore = getShiftStats(turno, allItems);

  // Impacto do salvamento
  const pdpaCountBefore = shiftStatsBefore.pdpaTotal[1];
  const pdpaAdd = (copyToDireta ? dirQty : 0) + (copyToAuto ? autoQty : 0);

  // Alertas inteligentes no contexto do turno
  const warnings = useMemo(() => {
    const list: Array<{ color: string; text: string; action?: { label: string; onClick: () => void } }> = [];

    if (currentPhase.k === 'done') {
      const nextShiftNum = (turno === 3 ? 1 : turno === 1 ? 2 : 3) as ProductionTurno;
      const nextShiftDef = getShiftDefinition(nextShiftNum);
      const nextPhase = getShiftPhase(nextShiftNum, now);

      list.push({
        color: 'var(--amber)',
        text: `O ${currentShiftDef.l} já foi encerrado. A ordem entrará como histórico.`,
        action:
          nextPhase.k !== 'done'
            ? {
                label: `Mover para o ${nextShiftDef.l}`,
                onClick: () => setTurno(nextShiftNum),
              }
            : undefined,
      });
    }

    // Alerta de duplicidade no mesmo turno
    if (codigo.trim()) {
      const dup = allItems.find(
        (o) => o.turno === turno && o.tipo === 'ordem' && o.codigoReceita === codigo.trim().toUpperCase() && o.id !== item?.id
      );
      if (dup) {
        list.push({
          color: 'var(--amber)',
          text: `Este produto já está no ${currentShiftDef.l} (${dup.real}/${dup.prog}). Salvar criará uma segunda linha.`,
        });
      }
    }

    // Sem máquina definida
    if (!familia.trim()) {
      list.push({
        color: 'var(--amber)',
        text: 'Sem máquina definida — a ordem aparecerá como "Sem máq." e gerará ponto de atenção.',
      });
    }

    // Conflito de via com o cadastro
    if (foundRecipe && foundRecipe.via && foundRecipe.via !== via) {
      const cadVia = foundRecipe.via;
      list.push({
        color: 'var(--amber)',
        text: `No cadastro este produto é de via ${cadVia === 'UMIDA' ? 'úmida' : 'seca'}.`,
        action: {
          label: `Usar ${cadVia === 'UMIDA' ? 'úmida' : 'seca'}`,
          onClick: () => setVia(cadVia),
        },
      });
    }

    // Turno próximo do fim
    if (currentPhase.k === 'now' && currentPhase.leftMinutes && currentPhase.leftMinutes < 90 && real < prog) {
      list.push({
        color: 'var(--text-3)',
        text: `Faltam ${formatDuration(currentPhase.leftMinutes)} para o encerramento do turno.`,
      });
    }

    return list;
  }, [turno, currentShiftDef, currentPhase, codigo, allItems, item, familia, foundRecipe, via, real, prog, now]);

  // Divisão de ordem
  async function handleSplit() {
    if (!item) return;
    const remaining = Math.max(item.prog - item.real, 0);
    if (splitQty < 1 || splitQty > remaining) {
      toast.error(`Informe uma quantidade entre 1 e ${remaining} para transferir`);
      return;
    }

    setIsSplitting(true);
    try {
      await splitProductionItem(item, { turno: splitTurno, qty: splitQty });
      toast.success(`Ordem dividida: ${splitQty} unidade(s) transferida(s) para o ${splitTurno}º Turno!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao dividir a ordem');
    } finally {
      setIsSplitting(false);
    }
  }

  // Validação e Salvamento
  const validateForm = () => {
    const newErrors: { codigo?: boolean; produto?: boolean; real?: boolean } = {};
    if (!codigo.trim()) newErrors.codigo = true;
    if (!produto.trim()) newErrors.produto = true;
    if (real > prog) newErrors.real = true;

    setErrors(newErrors);
    if (newErrors.codigo || newErrors.produto) {
      toast.error('Preencha o código do material e o produto.');
      return false;
    }
    return true;
  };

  const handleSave = async (addAnother = false) => {
    if (isLocked) {
      toast.error('Esta ordem está dividida e bloqueada para edição.');
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const cleanReal = Math.min(Math.max(0, real), prog);
      const cleanProd = produto.trim().toUpperCase();
      const cleanCod = codigo.trim().toUpperCase();
      const cleanFam = familia.trim().toUpperCase() || undefined;

      if (mode === 'create') {
        await createProductionItem({
          turno,
          tipo,
          via: tipo === 'ordem' ? via : undefined,
          familia: tipo === 'ordem' ? cleanFam : undefined,
          lp: tipo === 'ordem' ? lp : undefined,
          codigoReceita: cleanCod || undefined,
          produto: cleanProd,
          prog,
          real: cleanReal,
        });
        toast.success(`Ordem adicionada ao ${currentShiftDef.l}!`);
      } else if (item) {
        await updateProductionItem(item.id, {
          turno,
          via: tipo === 'ordem' ? via : undefined,
          familia: tipo === 'ordem' ? cleanFam : undefined,
          lp: tipo === 'ordem' ? lp : undefined,
          codigoReceita: cleanCod || undefined,
          produto: cleanProd,
          prog,
          real: cleanReal,
        });
        toast.success('Ordem atualizada com sucesso!');
      }

      // Cópias adicionais para PD e PA
      if (tipo === 'ordem') {
        if (copyToDireta) {
          await createProductionItem({
            turno,
            tipo: 'direta',
            produto: cleanProd,
            prog: dirQty,
            real: 0,
          });
        }
        if (copyToAuto) {
          await createProductionItem({
            turno,
            tipo: 'auto',
            produto: cleanProd,
            prog: autoQty,
            real: 0,
          });
        }
      } else if (copyToOrdem && mode === 'create') {
        await createProductionItem({
          turno,
          tipo: 'ordem',
          via: via || defaultVia,
          familia: cleanFam,
          produto: cleanProd,
          prog,
          real: 0,
        });
      }

      if (addAnother) {
        setCodigo('');
        setProduto('');
        setFamilia('');
        setProg(1);
        setReal(0);
        setLp(false);
        setFoundRecipe(null);
        setIsAutoFilled(false);
        setCopyToDireta(false);
        setCopyToAuto(false);
        setErrors({});
        inputRef.current?.focus();
      } else {
        onOpenChange(false);
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar ordem de produção');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Progress Bar e status da ordem na prévia
  const statusInfo = useMemo(() => {
    const p = Math.max(1, prog);
    const r = Math.min(Math.max(0, real), p);
    const pct = Math.round((r / p) * 100);
    const isDone = r >= p;
    const isProgress = r > 0 && !isDone;

    return {
      pct,
      isDone,
      isProgress,
      label: isDone ? 'Entra como concluída.' : isProgress ? 'Entra como em andamento.' : 'Entra como pendente.',
    };
  }, [prog, real]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[620px] max-h-[88vh] p-0 overflow-hidden flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl text-[var(--text)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSave(e.shiftKey);
          }
        }}
      >
        {/* Cabeçalho do Modal */}
        <DialogHeader className="px-5 py-4 border-b border-[var(--border)] flex flex-row items-start justify-between bg-[var(--surface)] shrink-0">
          <div>
            <DialogTitle className="text-[15px] font-semibold text-[var(--text)] tracking-tight">
              {mode === 'create' ? 'Adicionar ordem' : 'Editar ordem'}
            </DialogTitle>
            <p className="text-xs text-[var(--text-3)] mt-1">
              Painel de produção · {currentShiftDef.l} · via {via === 'UMIDA' ? 'úmida' : 'seca'}
            </p>
          </div>
        </DialogHeader>

        {/* Corpo do Modal */}
        <div className="overflow-y-auto px-5 py-2 space-y-4">
          {isLocked && (
            <div className="p-3 rounded-[var(--radius)] border border-[var(--amber)]/50 bg-[var(--amber)]/10 flex items-start gap-2.5 text-xs text-[var(--text-2)]">
              <Lock size={14} className="text-[var(--amber)] shrink-0 mt-0.5" />
              <p>
                Esta ordem foi dividida com outro turno e está bloqueada para edição direta. Arraste o item filho de volta para o turno de origem para destravar.
              </p>
            </div>
          )}

          {/* 1. SEÇÃO MATERIAL */}
          <div className="pt-2 pb-3 border-b border-[var(--border)]">
            <div className="flex justify-between items-baseline mb-2.5">
              <span className="text-xs font-semibold text-[var(--text-2)]">Material</span>
              <span className="text-[11.5px] text-[var(--text-3)]">o código preenche produto, máquina e via</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Código SAP / Material com combobox de busca */}
              <div className="sm:col-span-2 space-y-1.5 relative">
                <label className="text-xs text-[var(--text-3)] block font-medium">Código SAP</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--text-3)] pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={codigo}
                    onChange={(e) => handleCodigoInput(e.target.value)}
                    onKeyDown={handleCodigoKeyDown}
                    placeholder="Código ou nome do produto (ex.: 700071I, rosuva…)"
                    disabled={isSubmitting || isLocked}
                    className={cn(
                      "h-[34px] w-full pl-8 pr-20 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors",
                      errors.codigo && "border-[var(--red)]"
                    )}
                  />
                  {foundRecipe && (
                    <span className="absolute right-2.5 top-2 text-[11.5px] text-[var(--green)] font-medium flex items-center gap-1">
                      <Check size={12} strokeWidth={3} /> Cadastro
                    </span>
                  )}
                  {!foundRecipe && codigo.trim() && (
                    <span className="absolute right-2.5 top-2 text-[11.5px] text-[var(--text-3)] font-mono">
                      Novo
                    </span>
                  )}
                </div>

                {/* Dropdown de Sugestões */}
                {showSug && suggestions.length > 0 && (
                  <div
                    ref={sugBoxRef}
                    className="absolute left-0 right-0 top-[60px] z-50 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--radius)] shadow-2xl max-h-56 overflow-y-auto py-1 animate-fade-in"
                  >
                    {suggestions.map((sug, i) => (
                      <div
                        key={sug.codigo}
                        onClick={() => handleSelectRecipe(sug)}
                        className={cn(
                          "grid grid-cols-[70px_1fr_auto] gap-2.5 items-center px-3 py-1.5 cursor-pointer text-xs transition-colors",
                          i === sugIndex ? "bg-[var(--hover)] text-[var(--text)] font-medium" : "text-[var(--text-2)] hover:bg-[var(--hover)]"
                        )}
                      >
                        <span className="font-mono text-xs font-semibold text-[var(--accent)]">{sug.codigo}</span>
                        <b className="truncate font-normal text-[var(--text)]">{sug.produto}</b>
                        <small className="text-[11px] text-[var(--text-3)] whitespace-nowrap">
                          {sug.familia || 'Sem máq.'} · {sug.via === 'UMIDA' ? 'úmida' : 'seca'}
                        </small>
                      </div>
                    ))}
                  </div>
                )}

                <span
                  className={cn(
                    "text-[11.5px] block leading-tight",
                    foundRecipe
                      ? "text-[var(--green)] font-medium"
                      : errors.codigo
                      ? "text-[var(--red)]"
                      : "text-[var(--text-3)]"
                  )}
                >
                  {foundRecipe
                    ? `Encontrado: ${foundRecipe.produto}`
                    : 'Digite o código ou parte do nome para autocompletar.'}
                </span>
              </div>

              {/* Produto */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs text-[var(--text-3)] block font-medium">Produto</label>
                <input
                  type="text"
                  value={produto}
                  onChange={(e) => {
                    setProduto(e.target.value);
                    setErrors((prev) => ({ ...prev, produto: false }));
                    setIsAutoFilled(false);
                  }}
                  placeholder="Nome do produto"
                  disabled={isSubmitting || isLocked}
                  className={cn(
                    "h-[34px] w-full px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors",
                    isAutoFilled ? "bg-[var(--surface-2)] border-[var(--border-strong)]" : "bg-[var(--bg)]",
                    errors.produto && "border-[var(--red)]"
                  )}
                />
              </div>

              {/* Família / Máquina */}
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-3)] block font-medium">Família / máquina</label>
                <input
                  type="text"
                  list="modal-familias-list"
                  value={familia}
                  onChange={(e) => {
                    setFamilia(e.target.value);
                    setIsAutoFilled(false);
                  }}
                  placeholder="Ex.: COP LEG.2"
                  disabled={isSubmitting || isLocked}
                  className="h-[34px] w-full px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors"
                />
                <datalist id="modal-familias-list">
                  {knownFamilies.map((fam) => (
                    <option key={fam} value={fam} />
                  ))}
                </datalist>
              </div>

              {/* Via de Processo (Segmentado Úmida / Seca) */}
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-3)] block font-medium">Via de processo</label>
                <div className="grid grid-cols-2 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] overflow-hidden h-[34px]">
                  <button
                    type="button"
                    onClick={() => setVia('UMIDA')}
                    disabled={isSubmitting || isLocked}
                    className={cn(
                      "text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer",
                      via === 'UMIDA' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    Úmida
                  </button>
                  <button
                    type="button"
                    onClick={() => setVia('SECA')}
                    disabled={isSubmitting || isLocked}
                    className={cn(
                      "text-xs font-medium transition-colors cursor-pointer",
                      via === 'SECA' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    Seca
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. SEÇÃO PROGRAMAÇÃO */}
          <div className="pb-3 border-b border-[var(--border)]">
            <div className="flex justify-between items-baseline mb-2.5">
              <span className="text-xs font-semibold text-[var(--text-2)]">Programação</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Seletor Segmentado de Turnos */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs text-[var(--text-3)] block font-medium">Turno</label>
                <div className="grid grid-cols-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] overflow-hidden">
                  {SHIFT_SCHEDULES.map((s) => {
                    const ph = getShiftPhase(s.n, now);
                    const isSelected = turno === s.n;
                    return (
                      <button
                        key={s.n}
                        type="button"
                        onClick={() => setTurno(s.n)}
                        disabled={isSubmitting || isLocked}
                        className={cn(
                          "py-1.5 px-2 text-xs font-medium border-r last:border-r-0 border-[var(--border-strong)] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer",
                          isSelected ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                      >
                        <span>{s.l}</span>
                        <small className="text-[10.5px] font-normal text-[var(--text-3)] flex items-center gap-1">
                          <i
                            className={cn(
                              "w-1.5 h-1.5 rounded-full inline-block",
                              ph.k === 'now' && "bg-[var(--accent)] animate-pulse",
                              ph.k === 'done' && "bg-[var(--text-3)]",
                              ph.k === 'next' && "border border-[var(--text-3)] bg-transparent"
                            )}
                          />
                          {ph.l}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stepper Qtd. Programada */}
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-3)] block font-medium">Qtd. programada</label>
                <div className="flex items-center border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] h-[34px] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleProgChange(prog - 1)}
                    disabled={isSubmitting || isLocked || prog <= 1}
                    className="w-8 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer disabled:opacity-30"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={prog}
                    onChange={(e) => handleProgChange(parseInt(e.target.value, 10))}
                    disabled={isSubmitting || isLocked}
                    className="flex-1 min-w-0 text-center font-mono text-xs font-semibold bg-transparent border-0 outline-none text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleProgChange(prog + 1)}
                    disabled={isSubmitting || isLocked}
                    className="w-8 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Stepper Qtd. Realizada */}
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-3)] block font-medium">Qtd. realizada</label>
                <div
                  className={cn(
                    "flex items-center border rounded-[var(--radius)] bg-[var(--bg)] h-[34px] overflow-hidden",
                    errors.real || real > prog ? "border-[var(--red)]" : "border-[var(--border-strong)]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setReal(Math.max(0, real - 1))}
                    disabled={isSubmitting || isLocked || real <= 0}
                    className="w-8 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer disabled:opacity-30"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={real}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setReal(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    disabled={isSubmitting || isLocked}
                    className="flex-1 min-w-0 text-center font-mono text-xs font-semibold bg-transparent border-0 outline-none text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={() => setReal(real + 1)}
                    disabled={isSubmitting || isLocked}
                    className="w-8 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Barra de Progresso e Contexto */}
              <div className="sm:col-span-2 pt-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 bg-[var(--track)] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        statusInfo.isDone ? "bg-[var(--green)]" : "bg-[var(--text-2)]"
                      )}
                      style={{ width: `${Math.min(statusInfo.pct, 100)}%` }}
                    />
                  </div>
                  <small className="font-mono text-[11px] text-[var(--text-3)] shrink-0">
                    {real}/{prog} ({statusInfo.pct}%)
                  </small>
                </div>
                <span
                  className={cn(
                    "text-[11.5px] block mt-1",
                    real > prog ? "text-[var(--red)]" : "text-[var(--text-3)]"
                  )}
                >
                  {real > prog
                    ? `A realizada não pode passar da programada — será salva como ${prog}.`
                    : statusInfo.label}
                </span>
              </div>
            </div>
          </div>

          {/* 3. SEÇÃO OPÇÕES */}
          <div className="pb-3 border-b border-[var(--border)] space-y-2.5">
            <span className="text-xs font-semibold text-[var(--text-2)] block">Opções</span>

            {/* Lote Piloto */}
            {tipo === 'ordem' && (
              <div className="flex items-center justify-between py-2 border-b border-[var(--border)]/60">
                <div>
                  <b className="text-xs font-medium text-[var(--text)] flex items-center gap-2">
                    Lote piloto <span className="text-[10px] font-bold text-[var(--violet)] border border-[var(--violet)] rounded px-1 leading-tight">LP</span>
                  </b>
                  <small className="text-[11.5px] text-[var(--text-3)] block">
                    Marca a ordem com a etiqueta LP no quadro de produção.
                  </small>
                </div>
                <label className="inline-flex cursor-pointer relative">
                  <input
                    type="checkbox"
                    checked={lp}
                    onChange={(e) => setLp(e.target.checked)}
                    disabled={isSubmitting || isLocked}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[var(--border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-2)] peer-checked:after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--violet)]" />
                </label>
              </div>
            )}

            {/* Copiar para PD/PA Direta */}
            {tipo === 'ordem' && (
              <div className="flex items-center justify-between py-2 border-b border-[var(--border)]/60">
                <div className="pr-3">
                  <b className="text-xs font-medium text-[var(--text)] block">Copiar para PD/PA direta</b>
                  <small className="text-[11.5px] text-[var(--text-3)] block">
                    Cria a mesma ordem na pesagem direta com quantidade própria.
                  </small>
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex items-center border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] h-7 w-24 overflow-hidden transition-opacity",
                      !copyToDireta && "opacity-30 pointer-events-none"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDirQtyEdited(true);
                        setDirQty(Math.max(1, dirQty - 1));
                      }}
                      className="w-6 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)]"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={dirQty}
                      onChange={(e) => {
                        setDirQtyEdited(true);
                        setDirQty(Math.max(1, parseInt(e.target.value, 10) || 1));
                      }}
                      className="w-full text-center font-mono text-xs bg-transparent border-0 outline-none text-[var(--text)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDirQtyEdited(true);
                        setDirQty(dirQty + 1);
                      }}
                      className="w-6 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)]"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  <label className="inline-flex cursor-pointer relative">
                    <input
                      type="checkbox"
                      checked={copyToDireta}
                      onChange={(e) => setCopyToDireta(e.target.checked)}
                      disabled={isSubmitting || isLocked}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[var(--border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-2)] peer-checked:after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent)]" />
                  </label>
                </div>
              </div>
            )}

            {/* Copiar para PD/PA Automática */}
            {tipo === 'ordem' && (
              <div className="flex items-center justify-between py-2">
                <div className="pr-3">
                  <b className="text-xs font-medium text-[var(--text)] block">Copiar para PD/PA automática</b>
                  <small className="text-[11.5px] text-[var(--text-3)] block">
                    Cria a mesma ordem na pesagem automática com quantidade própria.
                  </small>
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex items-center border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] h-7 w-24 overflow-hidden transition-opacity",
                      !copyToAuto && "opacity-30 pointer-events-none"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAutoQtyEdited(true);
                        setAutoQty(Math.max(1, autoQty - 1));
                      }}
                      className="w-6 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)]"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={autoQty}
                      onChange={(e) => {
                        setAutoQtyEdited(true);
                        setAutoQty(Math.max(1, parseInt(e.target.value, 10) || 1));
                      }}
                      className="w-full text-center font-mono text-xs bg-transparent border-0 outline-none text-[var(--text)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAutoQtyEdited(true);
                        setAutoQty(autoQty + 1);
                      }}
                      className="w-6 h-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)]"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  <label className="inline-flex cursor-pointer relative">
                    <input
                      type="checkbox"
                      checked={copyToAuto}
                      onChange={(e) => setCopyToAuto(e.target.checked)}
                      disabled={isSubmitting || isLocked}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[var(--border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-2)] peer-checked:after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent)]" />
                  </label>
                </div>
              </div>
            )}

            {/* Criação como Ordem de Produção no caso de PD/PA */}
            {tipo !== 'ordem' && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <b className="text-xs font-medium text-[var(--text)] block">Criar também como Ordem no quadro</b>
                  <small className="text-[11.5px] text-[var(--text-3)] block">
                    Cria o registro principal na via {via === 'UMIDA' ? 'úmida' : 'seca'} para acompanhamento global.
                  </small>
                </div>
                <label className="inline-flex cursor-pointer relative">
                  <input
                    type="checkbox"
                    checked={copyToOrdem}
                    onChange={(e) => setCopyToOrdem(e.target.checked)}
                    disabled={isSubmitting || isLocked}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[var(--border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-2)] peer-checked:after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent)]" />
                </label>
              </div>
            )}
          </div>

          {/* 4. SEÇÃO PRÉVIA NO QUADRO & IMPACTO */}
          <div className="pb-2 space-y-2.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-semibold text-[var(--text-2)]">Prévia no quadro</span>
              <span className="text-[11.5px] text-[var(--text-3)]">· {currentShiftDef.l}</span>
            </div>

            <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
              <div className="flex justify-between items-center px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)] text-[11.5px] text-[var(--text-3)]">
                <b className="font-semibold text-[var(--text-2)]">{via === 'UMIDA' ? 'ÚMIDA' : 'SECA'}</b>
                <span>como a linha vai aparecer</span>
              </div>

              {/* Mini linha da tabela */}
              <table className="w-full border-collapse table-fixed text-left text-xs">
                <colgroup>
                  <col style={{ width: '22px' }} />
                  <col style={{ width: '92px' }} />
                  <col />
                  <col style={{ width: '56px' }} />
                </colgroup>
                <tbody>
                  <tr className="bg-[var(--surface)]">
                    <td className="py-2 pl-3 pr-0 align-middle">
                      <i
                        className={cn(
                          "w-2 h-2 rounded-full block",
                          statusInfo.isDone
                            ? "bg-[var(--green)]"
                            : statusInfo.isProgress
                            ? "bg-[var(--amber)]"
                            : "border border-[var(--text-3)] bg-transparent"
                        )}
                      />
                    </td>
                    <td className="py-2 px-2 align-middle">
                      <div className={cn("font-mono text-xs truncate", familia ? "text-[var(--text-2)]" : "text-[var(--amber)]")}>
                        {familia || 'Sem máq.'}
                      </div>
                    </td>
                    <td className="py-2 px-2 align-middle min-w-0">
                      <div className="text-xs font-medium text-[var(--text)] truncate">
                        {lp && (
                          <span className="inline-block text-[10px] font-bold text-[var(--violet)] border border-[var(--violet)] rounded px-1 mr-1.5 leading-tight">
                            LP
                          </span>
                        )}
                        {produto || 'Produto não informado'}
                      </div>
                    </td>
                    <td className="py-2 pr-3 pl-1 align-middle text-right whitespace-nowrap">
                      <span className="font-mono text-xs text-[var(--text)]">
                        {Math.min(real, prog)}<small className="text-[var(--text-3)]">/{prog}</small>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Painel de Impacto no Turno */}
              <div className="grid grid-cols-3 border-t border-[var(--border)] text-center divide-x divide-[var(--border)] bg-[var(--surface-2)]/50">
                <div className="p-2 text-[11px] text-[var(--text-3)]">
                  Ordens no {currentShiftDef.short}
                  <b className="block font-mono text-xs font-medium text-[var(--text)] mt-0.5">
                    {shiftStatsBefore.prog} <em className="not-italic text-[var(--text-3)]">→</em> {shiftStatsBefore.prog + prog}
                  </b>
                </div>
                <div className="p-2 text-[11px] text-[var(--text-3)]">
                  Lotes
                  <b className="block font-mono text-xs font-medium text-[var(--text)] mt-0.5">
                    {shiftStatsBefore.lots} <em className="not-italic text-[var(--text-3)]">→</em> {shiftStatsBefore.lots + 1}
                  </b>
                </div>
                <div className="p-2 text-[11px] text-[var(--text-3)]">
                  PD/PA
                  <b className="block font-mono text-xs font-medium text-[var(--text)] mt-0.5">
                    {pdpaCountBefore} {pdpaAdd > 0 && <em className="not-italic text-[var(--text-3)]">→ {pdpaCountBefore + pdpaAdd}</em>}
                  </b>
                </div>
              </div>
            </div>

            {/* Avisos Contextuais */}
            {warnings.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-xs text-[var(--text-2)] leading-tight">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <i className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: w.color }} />
                      <span>{w.text}</span>
                    </div>
                    {w.action && (
                      <button
                        type="button"
                        onClick={w.action.onClick}
                        className="text-[11.5px] text-[var(--accent)] hover:underline shrink-0 font-medium cursor-pointer"
                      >
                        {w.action.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. DIVISÃO DE ORDEM (QUANDO EDITANDO COM SALDO) */}
          {mode === 'edit' && tipo === 'ordem' && item && !isLocked && Math.max(item.prog - item.real, 0) > 0 && (
            <div className="pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowSplit((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
              >
                <Split size={13} />
                <span>Dividir ordem com outro turno...</span>
              </button>

              {showSplit && (
                <div className="mt-2 p-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)]/50 space-y-2 animate-fade-in text-xs">
                  <p className="text-[11.5px] text-[var(--text-3)]">
                    Saldo disponível: <b>{Math.max(item.prog - item.real, 0)}</b> unidade(s). Informe quantidade e turno destino:
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] text-[var(--text-3)] block mb-1">Qtd a transferir</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(item.prog - item.real, 0)}
                        value={splitQty}
                        disabled={isSplitting}
                        onChange={(e) => setSplitQty(parseInt(e.target.value, 10) || 1)}
                        className="h-8 w-full px-2 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[var(--text-3)] block mb-1">Turno de destino</label>
                      <select
                        value={splitTurno}
                        onChange={(e) => setSplitTurno(Number(e.target.value) as ProductionTurno)}
                        disabled={isSplitting}
                        className="h-8 w-full px-2 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text-2)] outline-none"
                      >
                        {SHIFT_SCHEDULES.map((s) => (
                          <option key={s.n} value={s.n}>
                            {s.l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSplitting}
                    onClick={handleSplit}
                    className="w-full h-7 mt-1 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isSplitting ? <Loader2 size={12} className="animate-spin" /> : <Split size={12} />}
                    <span>Confirmar divisão</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between gap-2 bg-[var(--surface-2)] shrink-0">
          <span className="text-[11px] text-[var(--text-3)] hidden sm:inline">
            <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1 text-[var(--text-2)]">Ctrl</kbd>+<kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1 text-[var(--text-2)]">Enter</kbd> salva · <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1 text-[var(--text-2)]">Esc</kbd> fecha
          </span>

          <div className="flex items-center gap-2 ml-auto">
            {mode === 'edit' && item && onRequestDelete && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onRequestDelete(item)}
                className="h-8 px-3 rounded-[var(--radius)] text-xs font-medium text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors flex items-center gap-1.5 cursor-pointer mr-auto sm:mr-0"
              >
                <Trash2 size={13} />
                <span>Excluir</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {mode === 'create' && (
              <button
                type="button"
                disabled={isSubmitting || isLocked}
                onClick={() => handleSave(true)}
                className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
              >
                Salvar e adicionar outra
              </button>
            )}

            <button
              type="button"
              disabled={isSubmitting || isLocked}
              onClick={() => handleSave(false)}
              className="h-8 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40"
            >
              {isSubmitting && <Loader2 size={12} className="animate-spin" />}
              <span>{mode === 'create' ? 'Salvar' : 'Salvar alterações'}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
