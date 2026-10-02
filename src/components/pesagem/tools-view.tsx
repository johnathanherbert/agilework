'use client';

import { useState, useMemo, useEffect } from 'react';
import { AgingData, ListaTecnicaItem } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wrench,
  Calculator,
  Search,
  DollarSign,
  Package,
  Plus,
  Trash2,
  Copy,
  Check,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FlaskConical,
  Scale,
  Percent,
  ListTree,
  FileText,
  Boxes,
  ExternalLink,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchListaTecnica } from '@/lib/dashpesagem-api';
import { cn } from '@/lib/utils';

interface ToolsViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
}

interface SimulatedItem {
  id: string;
  material: string;
  descricao: string;
  unidade: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
}

/**
 * Converte qualquer string numérica (formato brasileiro '1.250,50' ou '150,5'
 * ou formato americano/puro '1250.50' ou '150.5') em number float seguro.
 */
function parseFlexibleNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;

  let s = String(input).trim();
  if (!s) return 0;

  // Remove caracteres de moeda ou espaços
  s = s.replace(/[R$\s]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Formato PT-BR: 1.250,50 -> remove todos os pontos, troca vírgula por ponto
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato EN: 1,250.50 -> remove todas as vírgulas
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Apenas vírgula: 150,5 ou 1250,50 -> troca vírgula por ponto
    s = s.replace(',', '.');
  } else if (hasDot) {
    // Apenas ponto: se tiver mais de um ponto (ex: 1.000.000): é separador de milhar
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      s = s.replace(/\./g, '');
    }
    // Se tiver apenas um ponto, mantém como decimal (ex: 150.5 ou 12.345)
  }

  const result = parseFloat(s);
  return isNaN(result) ? 0 : result;
}

/**
 * Formata um número para inserção amigável no input (padrão brasileiro com vírgula)
 */
function formatForInput(val: number): string {
  if (!val || isNaN(val)) return '0';
  if (Number.isInteger(val)) return String(val);
  return String(val).replace('.', ',');
}

export function ToolsView({ agingData, valores }: ToolsViewProps) {
  const [selectedTool, setSelectedTool] = useState<'valorizar-mp' | 'lista-tecnica'>('valorizar-mp');

  // --- Estados da Ferramenta: Valorizar MP ---
  const [materialInput, setMaterialInput] = useState('');
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [simulatedItems, setSimulatedItems] = useState<SimulatedItem[]>([]);
  const [copied, setCopied] = useState(false);

  // --- Estados da Ferramenta: Lista Técnica / Onde é Usado ---
  const [ltSearchInput, setLtSearchInput] = useState('');
  const [ltLoading, setLtLoading] = useState(false);
  const [ltResults, setLtResults] = useState<ListaTecnicaItem[]>([]);
  const [ltMode, setLtMode] = useState<'mp' | 'semi'>('mp');

  // Mapeamento de material para descrições, UMB e estoque estrito no depósito PES
  const materialInfoMap = useMemo(() => {
    const map: Record<
      string,
      {
        descricao: string;
        unidade: string;
        estoquePES: number;
        lotesPES: number;
        estoqueTotalGeral: number;
      }
    > = {};

    agingData.forEach((item) => {
      const mat = item.material.padStart(6, '0');
      if (!map[mat]) {
        map[mat] = {
          descricao: item.texto_breve_material || 'Matéria-Prima',
          unidade: item.unidade_medida || 'KG',
          estoquePES: 0,
          lotesPES: 0,
          estoqueTotalGeral: 0,
        };
      }
      const qty = Number(item.estoque_disponivel || 0);
      map[mat].estoqueTotalGeral += qty;

      const dep = String(item.deposito || '').trim().toUpperCase();
      if (dep === 'PES') {
        map[mat].estoquePES += qty;
        map[mat].lotesPES += 1;
      }
    });
    return map;
  }, [agingData]);

  // Normalização do código digitado no Valorizador
  const normalizedMaterial = useMemo(() => {
    const clean = materialInput.trim().replace(/\D/g, '');
    if (!clean) return '';
    return clean.padStart(6, '0');
  }, [materialInput]);

  // Sugestões de materiais ao digitar no Valorizador
  const suggestions = useMemo(() => {
    const query = materialInput.trim().toLowerCase();
    if (!query || query.length < 2) return [];

    const allMaterials = new Set([
      ...Object.keys(valores),
      ...Object.keys(materialInfoMap),
    ]);

    const matches: { material: string; descricao: string; valor: number; estoquePES: number }[] = [];
    for (const mat of Array.from(allMaterials)) {
      const desc = materialInfoMap[mat]?.descricao || '';
      const estPes = materialInfoMap[mat]?.estoquePES || 0;
      const val = valores[mat] || valores[mat.replace(/^0+/, '')] || 0;
      if (mat.includes(query) || desc.toLowerCase().includes(query)) {
        matches.push({ material: mat, descricao: desc, valor: val, estoquePES: estPes });
        if (matches.length >= 6) break;
      }
    }
    return matches;
  }, [materialInput, valores, materialInfoMap]);

  // Valor unitário cadastrado
  const registeredUnitValue = useMemo(() => {
    if (!normalizedMaterial) return 0;
    const directVal = valores[normalizedMaterial];
    if (directVal !== undefined && directVal !== null) return directVal;
    const strippedVal = valores[normalizedMaterial.replace(/^0+/, '')];
    if (strippedVal !== undefined && strippedVal !== null) return strippedVal;
    return 0;
  }, [normalizedMaterial, valores]);

  // Valor unitário efetivo (permite override manual se não cadastrado)
  const effectiveUnitValue = useMemo(() => {
    if (customPriceInput && customPriceInput.trim()) {
      const parsed = parseFlexibleNumber(customPriceInput);
      if (parsed > 0) return parsed;
    }
    return registeredUnitValue;
  }, [customPriceInput, registeredUnitValue]);

  // Info do material selecionado
  const currentMaterialInfo = useMemo(() => {
    if (!normalizedMaterial) return null;
    return (
      materialInfoMap[normalizedMaterial] ||
      materialInfoMap[normalizedMaterial.replace(/^0+/, '')] || {
        descricao: 'Matéria-Prima',
        unidade: 'KG',
        estoquePES: 0,
        lotesPES: 0,
        estoqueTotalGeral: 0,
      }
    );
  }, [normalizedMaterial, materialInfoMap]);

  // Quantidade numérica com parsing flexível (, e .)
  const parsedQuantity = useMemo(() => {
    if (!quantidadeInput || !quantidadeInput.trim()) return 0;
    return parseFlexibleNumber(quantidadeInput);
  }, [quantidadeInput]);

  // Valor total calculado
  const calculatedTotal = useMemo(() => {
    return parsedQuantity * effectiveUnitValue;
  }, [parsedQuantity, effectiveUnitValue]);

  // Formatação monetária
  const formatCurrency = (val: number) => {
    return (
      'R$ ' +
      Number(val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const formatNumber = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  };

  const handleSelectMaterial = (mat: string) => {
    setMaterialInput(mat);
    setCustomPriceInput('');
    const info = materialInfoMap[mat.padStart(6, '0')] || materialInfoMap[mat.replace(/^0+/, '')];
    if (info && info.estoquePES > 0) {
      setQuantidadeInput(formatForInput(info.estoquePES));
    }
  };

  const handleAddSimulation = () => {
    if (!normalizedMaterial) {
      toast.error('Informe o código do material');
      return;
    }
    if (parsedQuantity <= 0) {
      toast.error('Informe uma quantidade válida maior que zero');
      return;
    }
    if (effectiveUnitValue <= 0) {
      toast.error('Valor unitário precisa ser maior que zero');
      return;
    }

    const newItem: SimulatedItem = {
      id: `${normalizedMaterial}-${Date.now()}`,
      material: normalizedMaterial,
      descricao: currentMaterialInfo?.descricao || 'Matéria-Prima',
      unidade: currentMaterialInfo?.unidade || 'KG',
      valorUnitario: effectiveUnitValue,
      quantidade: parsedQuantity,
      valorTotal: calculatedTotal,
    };

    setSimulatedItems((prev) => [newItem, ...prev]);
    toast.success(`Material ${normalizedMaterial} adicionado à lista!`);
  };

  const handleRemoveSimulation = (id: string) => {
    setSimulatedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearSimulation = () => {
    setSimulatedItems([]);
  };

  const totalSimulatedValue = useMemo(() => {
    return simulatedItems.reduce((acc, item) => acc + item.valorTotal, 0);
  }, [simulatedItems]);

  const totalSimulatedQty = useMemo(() => {
    return simulatedItems.reduce((acc, item) => acc + item.quantidade, 0);
  }, [simulatedItems]);

  const handleCopySummary = () => {
    if (simulatedItems.length === 0) return;
    const lines = [
      '--- RESUMO DE VALORIZAÇÃO DE MATÉRIAS-PRIMAS ---',
      ...simulatedItems.map(
        (i) =>
          `${i.material} - ${i.descricao}: ${formatNumber(i.quantidade)} ${i.unidade} x ${formatCurrency(
            i.valorUnitario
          )} = ${formatCurrency(i.valorTotal)}`
      ),
      '-------------------------------------------------',
      `TOTAL: ${formatNumber(totalSimulatedQty)} itens/kg | VALOR TOTAL: ${formatCurrency(
        totalSimulatedValue
      )}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success('Resumo copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Busca da Lista Técnica ---
  const handleSearchListaTecnica = async (term?: string, mode?: 'mp' | 'semi') => {
    const q = term !== undefined ? term : ltSearchInput;
    const currentMode = mode || ltMode;
    if (!q || q.trim().length === 0) {
      setLtResults([]);
      return;
    }

    setLtLoading(true);
    try {
      let results: ListaTecnicaItem[] = [];
      const cleanDigits = q.trim().replace(/\D/g, '');

      if (currentMode === 'mp') {
        if (cleanDigits) {
          results = await fetchListaTecnica({ materia_prima: cleanDigits });
        }
        if (results.length === 0) {
          results = await fetchListaTecnica({ search: q.trim() });
        }
      } else {
        if (cleanDigits) {
          results = await fetchListaTecnica({ semi_acabado: cleanDigits });
        }
        if (results.length === 0) {
          results = await fetchListaTecnica({ search: q.trim() });
        }
      }
      setLtResults(results);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao pesquisar na lista técnica');
    } finally {
      setLtLoading(false);
    }
  };

  // Ao clicar em Valorizar a partir da lista técnica: carrega o estoque total do depósito PES
  const handleGoToValorizar = (mat: string) => {
    const cleanMat = mat.trim().padStart(6, '0');
    setMaterialInput(cleanMat);
    setCustomPriceInput('');

    const info =
      materialInfoMap[cleanMat] ||
      materialInfoMap[cleanMat.replace(/^0+/, '')];
    const estoquePes = info?.estoquePES || 0;

    setQuantidadeInput(estoquePes > 0 ? formatForInput(estoquePes) : '0');
    setSelectedTool('valorizar-mp');

    if (estoquePes > 0) {
      toast.success(
        `Carregado estoque do depósito PES: ${formatNumber(estoquePes)} ${info?.unidade || 'KG'}`,
        { icon: '💰' }
      );
    } else {
      toast(`Material ${cleanMat} sem saldo atual no depósito PES.`, { icon: 'ℹ️' });
    }
  };

  const handleGoToWhereUsed = (mat: string) => {
    setLtSearchInput(mat);
    setLtMode('mp');
    setSelectedTool('lista-tecnica');
    handleSearchListaTecnica(mat, 'mp');
  };

  return (
    <div className="space-y-6 text-[var(--text)] font-sans">
      {/* Header da Página Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 grid place-items-center text-[var(--accent)] shrink-0">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-[var(--text)] font-mono">
                Central de Ferramentas & Utilidades
              </h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                Utilitários de apoio operacional, valorização de estoque PES, lista técnica (BOM) e simulações
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--accent)] text-xs font-mono">
            {Object.keys(valores).length} Preços Cadastrados
          </span>
          <span className="px-2.5 py-1 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--green)] text-xs font-mono">
            3.805 Fórmulas / Lista Técnica
          </span>
        </div>
      </div>

      {/* Navegação entre ferramentas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Tool 1: Valorizar MP */}
        <button
          type="button"
          onClick={() => setSelectedTool('valorizar-mp')}
          className={cn(
            "p-3.5 rounded-lg border text-left transition-all relative overflow-hidden shadow-2xs cursor-pointer",
            selectedTool === 'valorizar-mp'
              ? "bg-[var(--surface)] border-[var(--accent)] ring-1 ring-[var(--accent)]/40"
              : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--hover)]"
          )}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-md bg-[var(--accent-weak)] text-[var(--accent)] grid place-items-center">
              <Calculator className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-[var(--green)]/15 text-[var(--green)] border border-[var(--green)]/25">
              Ativo
            </span>
          </div>
          <h3 className="text-xs font-bold text-[var(--text)]">Valorizar MP (Estoque PES)</h3>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
            Cálculo de valor unitário e totalização de estoque no depósito PES
          </p>
        </button>

        {/* Tool 2: Lista Técnica / Onde é Usado */}
        <button
          type="button"
          onClick={() => setSelectedTool('lista-tecnica')}
          className={cn(
            "p-3.5 rounded-lg border text-left transition-all relative overflow-hidden shadow-2xs cursor-pointer",
            selectedTool === 'lista-tecnica'
              ? "bg-[var(--surface)] border-[var(--accent)] ring-1 ring-[var(--accent)]/40"
              : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--hover)]"
          )}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-md bg-[var(--accent-weak)] text-[var(--accent)] grid place-items-center">
              <ListTree className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-[var(--accent-weak)] text-[var(--accent)] border border-[var(--accent)]/25">
              Lista Técnica
            </span>
          </div>
          <h3 className="text-xs font-bold text-[var(--text)]">Onde é Usado? (BOM)</h3>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
            Fórmulas, ordens e valorização direta do estoque PES por matéria-prima
          </p>
        </button>

        {/* Tool 3: Em Breve - Simulador de Descarte */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/30 opacity-50 text-left cursor-not-allowed">
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-md bg-[var(--surface)] text-[var(--text-3)] grid place-items-center">
              <Scale className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-3)] border border-[var(--border)]">
              Em breve
            </span>
          </div>
          <h3 className="text-xs font-bold text-[var(--text-2)]">Simulador de Descarte</h3>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
            Cálculo financeiro de perdas, quebras e descartes operacionais
          </p>
        </div>

        {/* Tool 4: Em Breve - Conversor & Densidade */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/30 opacity-50 text-left cursor-not-allowed">
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-md bg-[var(--surface)] text-[var(--text-3)] grid place-items-center">
              <FlaskConical className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-3)] border border-[var(--border)]">
              Em breve
            </span>
          </div>
          <h3 className="text-xs font-bold text-[var(--text-2)]">Conversor de Densidade</h3>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
            Conversão rápida entre Litros, Quilos e Densidade padrão
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CONTEÚDO DA FERRAMENTA 1: VALORIZAR MP */}
      {/* ==================================================================== */}
      {selectedTool === 'valorizar-mp' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda: Formulário de Entrada (5 colunas) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg p-4 shadow-2xs space-y-4">
                <div className="pb-3 border-b border-[var(--border)] flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-[var(--accent-weak)] text-[var(--accent)] grid place-items-center">
                    <Calculator className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text)] font-mono uppercase">
                      Parâmetros da Matéria-Prima
                    </h3>
                    <p className="text-[11px] text-[var(--text-3)]">
                      Informe o código do material e a quantidade desejada
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Campo 1: Código do Material */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text)] flex items-center justify-between">
                      <span>Código do Material (SAP)</span>
                      {normalizedMaterial && (
                        <span className="text-[10.5px] font-mono text-[var(--accent)]">
                          Código formatado: {normalizedMaterial}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Ex: 010013 ou 10013"
                        value={materialInput}
                        onChange={(e) => setMaterialInput(e.target.value)}
                        className="bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] text-[var(--text)] font-mono text-xs placeholder:text-[var(--text-3)] pr-9 rounded-[var(--radius)]"
                      />
                      <Search className="absolute right-3 top-2.5 h-4 w-4 text-[var(--text-3)] pointer-events-none" />
                    </div>

                    {/* Sugestões de Materiais */}
                    {suggestions.length > 0 && (
                      <div className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-1 shadow-lg">
                        <p className="text-[10px] font-semibold text-[var(--text-3)] px-2 py-0.5 font-mono">Sugestões:</p>
                        {suggestions.map((sug) => (
                          <button
                            key={sug.material}
                            type="button"
                            onClick={() => handleSelectMaterial(sug.material)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-[var(--hover)] transition-colors cursor-pointer"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="font-mono font-bold text-[var(--accent)]">{sug.material}</span>
                              <span className="text-[var(--text-2)] text-[11px] truncate block">
                                {sug.descricao || 'Sem descrição'}
                              </span>
                              {sug.estoquePES > 0 && (
                                <span className="text-[var(--green)] text-[10px] font-mono block">
                                  Estoque PES: {formatNumber(sug.estoquePES)} KG
                                </span>
                              )}
                            </div>
                            <span className="text-[var(--green)] font-mono text-[11px] font-bold shrink-0">
                              {formatCurrency(sug.valor)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Informações detalhadas do Material encontrado */}
                  {normalizedMaterial && (
                    <div className="p-3 rounded-lg bg-[var(--surface-2)]/60 border border-[var(--border)] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase font-bold text-[var(--text-3)]">Descrição</p>
                          <p className="text-xs font-semibold text-[var(--text)] leading-tight mt-0.5">
                            {currentMaterialInfo?.descricao || 'Matéria-Prima não detalhada no estoque'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded border",
                            registeredUnitValue > 0
                              ? "bg-[var(--green)]/15 text-[var(--green)] border-[var(--green)]/30"
                              : "bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)]/30"
                          )}
                        >
                          {registeredUnitValue > 0 ? 'Preço Base OK' : 'Sem Preço Base'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border)] text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-[var(--text-3)] block">Unidade:</span>
                          <span className="text-[var(--text)] font-bold">{currentMaterialInfo?.unidade || 'KG'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-3)] block">Estoque Depósito PES:</span>
                          <span className="text-[var(--accent)] font-bold">
                            {formatNumber(currentMaterialInfo?.estoquePES || 0)} {currentMaterialInfo?.unidade || 'KG'}
                          </span>
                          {currentMaterialInfo && currentMaterialInfo.lotesPES > 0 && (
                            <span className="text-[10px] text-[var(--text-3)] block font-sans">
                              ({currentMaterialInfo.lotesPES} {currentMaterialInfo.lotesPES === 1 ? 'lote' : 'lotes'})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Atalho para Lista Técnica */}
                      <button
                        type="button"
                        onClick={() => handleGoToWhereUsed(normalizedMaterial)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--hover)] rounded border border-[var(--border)] transition-colors mt-1 cursor-pointer"
                      >
                        <ListTree className="h-3.5 w-3.5" />
                        <span>Ver Fórmulas / Onde é usado este material</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Campo 2: Quantidade */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--text)]">
                      <span>Quantidade a Valorizar ({currentMaterialInfo?.unidade || 'KG'})</span>
                      {parsedQuantity > 0 && (
                        <span className="text-[11px] text-[var(--green)] font-mono font-bold">
                          = {formatNumber(parsedQuantity)} {currentMaterialInfo?.unidade || 'KG'}
                        </span>
                      )}
                    </div>

                    <Input
                      type="text"
                      placeholder="Ex: 50,00 ou 150.5 ou 1.250,50"
                      value={quantidadeInput}
                      onChange={(e) => setQuantidadeInput(e.target.value)}
                      className="bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] text-[var(--text)] font-mono text-xs placeholder:text-[var(--text-3)] rounded-[var(--radius)]"
                    />

                    {/* Botões rápidos de quantidade */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      {currentMaterialInfo && currentMaterialInfo.estoquePES > 0 && (
                        <button
                          type="button"
                          onClick={() => setQuantidadeInput(formatForInput(currentMaterialInfo.estoquePES))}
                          className="px-2 py-0.5 rounded bg-[var(--green)]/15 border border-[var(--green)]/30 text-[10px] font-mono font-bold text-[var(--green)] hover:bg-[var(--green)]/25 transition-colors cursor-pointer"
                        >
                          Tudo em PES ({formatNumber(currentMaterialInfo.estoquePES)})
                        </button>
                      )}
                      {[1, 5, 10, 50, 100, 500].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setQuantidadeInput(String(qty))}
                          className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                        >
                          +{qty}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campo 3: Ajuste / Override de Preço Unitário (caso não cadastrado) */}
                  {registeredUnitValue === 0 && normalizedMaterial && (
                    <div className="p-3 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[var(--amber)] text-xs font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Preço unitário não encontrado no banco</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-3)]">
                        Insira um valor unitário personalizado para calcular a valorização:
                      </p>
                      <Input
                        type="text"
                        placeholder="Ex: 24,50 ou 24.50"
                        value={customPriceInput}
                        onChange={(e) => setCustomPriceInput(e.target.value)}
                        className="bg-[var(--surface)] border border-[var(--amber)]/40 text-[var(--text)] font-mono text-xs focus:border-[var(--amber)] rounded-[var(--radius)]"
                      />
                    </div>
                  )}

                  {/* Botão de Adicionar à Cesta de Simulação */}
                  <Button
                    type="button"
                    onClick={handleAddSimulation}
                    disabled={!normalizedMaterial || parsedQuantity <= 0 || effectiveUnitValue <= 0}
                    className="w-full bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] font-bold text-xs h-9 gap-2 shadow-xs transition-opacity disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar à Lista de Simulação</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Cards de Resultado & Totalização (7 colunas) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Card Principal de Resultado ao Vivo (Design Black Industrial) */}
              <div className="p-5 rounded-xl bg-[#0e1014] border border-[var(--border-strong)] shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-[var(--accent)]" />
                    Resultado da Valorização (Estoque PES)
                  </span>
                  {normalizedMaterial && (
                    <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)] font-mono text-xs font-bold">
                      MP: {normalizedMaterial}
                    </span>
                  )}
                </div>

                {/* Grande Display do Valor Total */}
                <div className="my-4">
                  <p className="text-xs text-[var(--text-3)] font-medium">Valor Total Calculado:</p>
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono text-[var(--green)] tracking-tight mt-1 flex items-baseline gap-2">
                    <span>{formatCurrency(calculatedTotal)}</span>
                  </div>
                </div>

                {/* Fórmula e Detalhes do Cálculo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--border)] text-xs">
                  <div className="p-3 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--border)] font-mono">
                    <span className="text-[10px] text-[var(--text-3)] block uppercase font-sans">Valor Unitário:</span>
                    <span className="text-base font-bold text-[var(--text)]">
                      {formatCurrency(effectiveUnitValue)}
                    </span>
                    <span className="text-[10px] text-[var(--text-3)] block mt-0.5">
                      por {currentMaterialInfo?.unidade || 'KG'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--border)] font-mono">
                    <span className="text-[10px] text-[var(--text-3)] block uppercase font-sans">Qtd. Selecionada:</span>
                    <span className="text-base font-bold text-[var(--accent)]">
                      {formatNumber(parsedQuantity)}
                    </span>
                    <span className="text-[10px] text-[var(--text-3)] block mt-0.5">
                      {currentMaterialInfo?.unidade || 'KG'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--border)] font-mono">
                    <span className="text-[10px] text-[var(--text-3)] block uppercase font-sans">Total Estoque PES:</span>
                    <span className="text-base font-bold text-[var(--green)]">
                      {formatCurrency((currentMaterialInfo?.estoquePES || 0) * effectiveUnitValue)}
                    </span>
                    <span className="text-[10px] text-[var(--text-3)] block mt-0.5">
                      ({formatNumber(currentMaterialInfo?.estoquePES || 0)} {currentMaterialInfo?.unidade || 'KG'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabela / Lista de Simulação Acumulada */}
              <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg p-4 shadow-2xs space-y-3">
                <div className="pb-3 border-b border-[var(--border)] flex flex-row items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text)] font-mono uppercase flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[var(--accent)]" />
                      <span>Lista de Itens Valorizados</span>
                      {simulatedItems.length > 0 && (
                        <span className="bg-[var(--accent-weak)] text-[var(--accent)] font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border border-[var(--accent)]/30">
                          {simulatedItems.length}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-[var(--text-3)]">
                      Acumule múltiplas matérias-primas para somar o valor total de uma lista ou batelada
                    </p>
                  </div>

                  {simulatedItems.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopySummary}
                        className="h-7 text-xs bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--hover)] gap-1 cursor-pointer"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-[var(--green)]" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>Copiar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleClearSimulation}
                        className="h-7 text-xs text-[var(--red)] hover:bg-[var(--red)]/10 gap-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Limpar</span>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  {simulatedItems.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-3)] space-y-2">
                      <Calculator className="h-8 w-8 mx-auto opacity-40" />
                      <p className="text-xs text-[var(--text-2)] font-medium">Nenhum item adicionado à lista ainda.</p>
                      <p className="text-[11px] text-[var(--text-3)]">
                        Preencha os dados do material à esquerda e clique em "Adicionar à Lista".
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Tabela de Itens */}
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-lg border border-[var(--border)]">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--surface-2)] text-[var(--text-3)] text-left font-mono">
                            <tr className="border-b border-[var(--border)]">
                              <th className="py-2.5 px-3 font-semibold">Material</th>
                              <th className="py-2.5 px-3 font-semibold">Descrição</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Qtd</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Vl. Unit.</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                              <th className="py-2.5 px-3 text-center w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)] font-mono">
                            {simulatedItems.map((item) => (
                              <tr key={item.id} className="hover:bg-[var(--hover)] transition-colors">
                                <td className="py-2 px-3 font-bold text-[var(--accent)]">{item.material}</td>
                                <td className="py-2 px-3 font-sans text-[var(--text-2)] max-w-[180px] truncate">
                                  {item.descricao}
                                </td>
                                <td className="py-2 px-3 text-right text-[var(--text)]">
                                  {formatNumber(item.quantidade)} {item.unidade}
                                </td>
                                <td className="py-2 px-3 text-right text-[var(--text-3)]">
                                  {formatCurrency(item.valorUnitario)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-[var(--green)]">
                                  {formatCurrency(item.valorTotal)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSimulation(item.id)}
                                    className="p-1 rounded hover:bg-[var(--red)]/15 text-[var(--text-3)] hover:text-[var(--red)] transition-colors cursor-pointer"
                                    title="Remover item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Card de Total Geral da Lista */}
                      <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-[var(--text-3)] uppercase font-mono font-bold block">
                            Total Geral da Lista ({simulatedItems.length} {simulatedItems.length === 1 ? 'item' : 'itens'}):
                          </span>
                          <span className="text-xs font-mono text-[var(--text-2)]">
                            Volume: {formatNumber(totalSimulatedQty)} KG
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold font-mono text-[var(--green)]">
                            {formatCurrency(totalSimulatedValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONTEÚDO DA FERRAMENTA 2: LISTA TÉCNICA (ONDE É USADO / BOM) */}
      {/* ==================================================================== */}
      {selectedTool === 'lista-tecnica' && (
        <div className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="pb-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] text-[var(--accent)] grid place-items-center shrink-0">
                  <ListTree className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)] font-mono uppercase">
                    Consulta de Lista Técnica & Valorização de Estoque PES (BOM)
                  </h3>
                  <p className="text-xs text-[var(--text-3)]">
                    Consulte em quais produtos/semi-acabados uma matéria-prima é usada e valorize todo o saldo atual em estoque PES
                  </p>
                </div>
              </div>

              {/* Alternador de Modo de Pesquisa */}
              <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setLtMode('mp');
                    if (ltSearchInput) handleSearchListaTecnica(ltSearchInput, 'mp');
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer",
                    ltMode === 'mp'
                      ? "bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)]/30 font-bold shadow-xs"
                      : "text-[var(--text-3)] hover:text-[var(--text)]"
                  )}
                >
                  Por Matéria-Prima (Onde vai?)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLtMode('semi');
                    if (ltSearchInput) handleSearchListaTecnica(ltSearchInput, 'semi');
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer",
                    ltMode === 'semi'
                      ? "bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)]/30 font-bold shadow-xs"
                      : "text-[var(--text-3)] hover:text-[var(--text)]"
                  )}
                >
                  Por Semi-Acabado (Fórmula)
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Barra de Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder={
                      ltMode === 'mp'
                        ? 'Digite código da MP (ex: 010013) ou nome da matéria-prima...'
                        : 'Digite código do semi-acabado (ex: 700013) ou nome do produto...'
                    }
                    value={ltSearchInput}
                    onChange={(e) => setLtSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchListaTecnica()}
                    className="bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] text-[var(--text)] font-mono text-xs placeholder:text-[var(--text-3)] pr-9 rounded-[var(--radius)]"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-[var(--text-3)] pointer-events-none" />
                </div>
                <Button
                  type="button"
                  onClick={() => handleSearchListaTecnica()}
                  disabled={ltLoading || !ltSearchInput.trim()}
                  className="bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] font-bold text-xs h-9 px-5 gap-1.5 rounded-[var(--radius)] shadow-xs transition-opacity cursor-pointer"
                >
                  {ltLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span>Pesquisar</span>
                </Button>
              </div>

              {/* Sugestões rápidas de pesquisa */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[var(--text-3)] font-mono">
                <span>Sugestões rápidas:</span>
                {['010013', '010071', '010311', '700013', '700024'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setLtSearchInput(code);
                      const mode = code.startsWith('7') ? 'semi' : 'mp';
                      setLtMode(mode);
                      handleSearchListaTecnica(code, mode);
                    }}
                    className="px-2 py-0.5 rounded bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--accent)] font-mono border border-[var(--border)] cursor-pointer"
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Resultados da Pesquisa */}
              {ltLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-2 text-[var(--text-3)]">
                    <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
                    <span className="text-xs">Consultando banco de dados de lista técnica...</span>
                  </div>
                </div>
              ) : ltResults.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-2)]">
                      Encontrados <strong className="text-[var(--accent)]">{ltResults.length}</strong> vínculos de lista técnica:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)] text-[10.5px] font-mono">
                      Centro 600 • Apenas Depósito PES
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--surface-2)] text-[var(--text-2)]">
                        <tr className="border-b border-[var(--border)] text-left font-mono">
                          <th className="py-2.5 px-3 font-semibold">Matéria-Prima</th>
                          <th className="py-2.5 px-3 font-semibold">Descrição MP</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Qtd MP / Lote</th>
                          <th className="py-2.5 px-3 font-semibold">Semi-Acabado (Produto)</th>
                          <th className="py-2.5 px-3 font-semibold">Descrição Semi-Acabado</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Tamanho Lote</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Estoque Dep. PES</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Total R$ (PES)</th>
                          <th className="py-2.5 px-3 text-center font-semibold">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-mono">
                        {ltResults.map((row) => {
                          const matNorm = row.materia_prima.padStart(6, '0');
                          const info = materialInfoMap[matNorm] || materialInfoMap[matNorm.replace(/^0+/, '')];
                          const estoquePes = info?.estoquePES || 0;
                          const unitPrice = valores[matNorm] || valores[matNorm.replace(/^0+/, '')] || 0;
                          const totalPesValue = estoquePes * unitPrice;

                          return (
                            <tr key={row.id || `${row.materia_prima}-${row.semi_acabado}`} className="hover:bg-[var(--hover)] transition-colors">
                              <td className="py-2.5 px-3 font-bold text-[var(--accent)]">
                                {row.materia_prima}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-[var(--text-2)]">
                                {row.descricao_materia_prima}
                              </td>
                              <td className="py-2.5 px-3 text-right text-[var(--text)] font-bold">
                                {formatNumber(row.qtd_materia_prima)} {row.un_materia_prima}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-[var(--amber)]">
                                {row.semi_acabado}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-[var(--text-2)]">
                                {row.descricao_semi_acabado}
                              </td>
                              <td className="py-2.5 px-3 text-right text-[var(--text-3)]">
                                {formatNumber(row.qtd_semi_acabado)} UN
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {estoquePes > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-[var(--green)]/15 text-[var(--green)] font-bold border border-[var(--green)]/30">
                                    {formatNumber(estoquePes)} {info?.unidade || 'KG'}
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-3)]">0 {info?.unidade || 'KG'}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-[var(--green)] font-bold">
                                {totalPesValue > 0 ? formatCurrency(totalPesValue) : estoquePes > 0 ? 'Sem preço' : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleGoToValorizar(row.materia_prima)}
                                  className="h-6 text-[10px] px-2.5 bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] font-bold gap-1 shadow-2xs cursor-pointer rounded"
                                  title={`Valorizar ${formatNumber(estoquePes)} ${info?.unidade || 'KG'} em estoque no depósito PES`}
                                >
                                  <Calculator className="h-3 w-3" />
                                  <span>Valorizar PES</span>
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : ltSearchInput.trim() ? (
                <div className="text-center py-12 text-[var(--text-3)] space-y-2">
                  <ListTree className="h-8 w-8 mx-auto opacity-40" />
                  <p className="text-xs text-[var(--text-2)]">Nenhum registro encontrado na lista técnica para "{ltSearchInput}".</p>
                  <p className="text-[11px] text-[var(--text-3)]">
                    Tente buscar por partes do nome ou código sem zeros à esquerda.
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 text-[var(--text-3)] space-y-2">
                  <ListTree className="h-8 w-8 mx-auto opacity-40" />
                  <p className="text-xs text-[var(--text-2)]">Digite um código ou descrição acima para pesquisar.</p>
                  <p className="text-[11px] text-[var(--text-3)]">
                    A base contém mais de 3.800 relações de fórmulas e consumos de matérias-primas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
