"use client";

import { useMemo } from 'react';
import { 
  Factory, 
  TrendingUp, 
  Droplets, 
  Wind, 
  Zap, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  GitBranch,
  Layers,
  Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ProductionItem } from '@/types';

interface KpiDashboardBarProps {
  items: ProductionItem[];
  selectedFamily: string | null;
  onSelectFamily: (family: string | null) => void;
  familiesAvailable: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function KpiDashboardBar({
  items,
  selectedFamily,
  onSelectFamily,
  familiesAvailable,
  searchQuery,
  onSearchChange,
}: KpiDashboardBarProps) {
  // Cálculo de KPIs detalhados
  const stats = useMemo(() => {
    const ordens = items.filter((i) => i.tipo === 'ordem');
    const auto = items.filter((i) => i.tipo === 'auto');
    const direta = items.filter((i) => i.tipo === 'direta');
    const pdpa = [...auto, ...direta];

    const ordensReal = ordens.reduce((acc, curr) => acc + curr.real, 0);
    const ordensProg = ordens.reduce((acc, curr) => acc + curr.prog, 0);
    const ordensPct = ordensProg > 0 ? Math.min(Math.round((ordensReal / ordensProg) * 100), 100) : 0;

    const umida = ordens.filter((i) => i.via === 'UMIDA');
    const seca = ordens.filter((i) => i.via === 'SECA');

    const umidaReal = umida.reduce((acc, curr) => acc + curr.real, 0);
    const umidaProg = umida.reduce((acc, curr) => acc + curr.prog, 0);
    const umidaPct = umidaProg > 0 ? Math.min(Math.round((umidaReal / umidaProg) * 100), 100) : 0;

    const secaReal = seca.reduce((acc, curr) => acc + curr.real, 0);
    const secaProg = seca.reduce((acc, curr) => acc + curr.prog, 0);
    const secaPct = secaProg > 0 ? Math.min(Math.round((secaReal / secaProg) * 100), 100) : 0;

    const pdpaReal = pdpa.reduce((acc, curr) => acc + curr.real, 0);
    const pdpaProg = pdpa.reduce((acc, curr) => acc + curr.prog, 0);
    const pdpaPct = pdpaProg > 0 ? Math.min(Math.round((pdpaReal / pdpaProg) * 100), 100) : 0;

    // Status das ordens
    const concluídas = ordens.filter((i) => i.prog > 0 && i.real >= i.prog).length;
    const emAndamento = ordens.filter((i) => i.real > 0 && i.real < i.prog).length;
    const pendentes = ordens.filter((i) => i.real === 0).length;
    const divididas = ordens.filter((i) => i.locked || i.splitChildId || i.splitParentId).length;

    // Contagem por família
    const familyCounts: Record<string, number> = {};
    ordens.forEach((i) => {
      if (i.familia) {
        familyCounts[i.familia] = (familyCounts[i.familia] || 0) + 1;
      }
    });

    return {
      ordensReal,
      ordensProg,
      ordensPct,
      ordensTotal: ordens.length,
      umidaReal,
      umidaProg,
      umidaPct,
      umidaCount: umida.length,
      secaReal,
      secaProg,
      secaPct,
      secaCount: seca.length,
      pdpaReal,
      pdpaProg,
      pdpaPct,
      pdpaTotal: pdpa.length,
      autoCount: auto.length,
      diretaCount: direta.length,
      concluídas,
      emAndamento,
      pendentes,
      divididas,
      familyCounts,
    };
  }, [items]);

  return (
    <div className="bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-2xl p-3.5 shadow-sm space-y-3 shrink-0">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Progresso Global de Ordens */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-foreground">
                <Factory className="h-4 w-4 text-sky-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider leading-none">
                  Progresso Global
                </p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Ordens de Produção</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-bold text-sky-400 border-sky-400/30 bg-sky-500/10">
              {stats.ordensPct}%
            </Badge>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span className="text-2xl font-black text-white leading-none">{stats.ordensReal}</span>
              <span className="text-xs text-slate-400 font-medium">/ {stats.ordensProg}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {stats.ordensTotal} {stats.ordensTotal === 1 ? 'ordem' : 'ordens'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-700/60 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-400 to-blue-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${stats.ordensPct}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Balanço de Vias (Úmida vs Seca) */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Balanço por Via
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Úmida / Seca</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            {/* Via Úmida - Azul EMS */}
            <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl p-2">
              <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300 mb-1">
                <Droplets className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-wide">Úmida</span>
                <span className="text-[9px] ml-auto font-black px-1 rounded bg-blue-200/60 dark:bg-blue-900/60">{stats.umidaPct}%</span>
              </div>
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="text-base font-black text-blue-800 dark:text-blue-200 leading-none">
                  {stats.umidaReal}
                </span>
                <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-bold">/{stats.umidaProg}</span>
              </div>
            </div>

            {/* Via Seca - Ciano Turquesa */}
            <div className="bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 rounded-xl p-2">
              <div className="flex items-center gap-1 text-cyan-700 dark:text-cyan-300 mb-1">
                <Wind className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <span className="text-[10px] font-black uppercase tracking-wide">Seca</span>
                <span className="text-[9px] ml-auto font-black px-1 rounded bg-cyan-200/60 dark:bg-cyan-900/60">{stats.secaPct}%</span>
              </div>
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="text-base font-black text-cyan-800 dark:text-cyan-200 leading-none">
                  {stats.secaReal}
                </span>
                <span className="text-[10px] text-cyan-600/80 dark:text-cyan-400/80 font-bold">/{stats.secaProg}</span>
              </div>
            </div>
          </div>

          {/* Visual Ratio Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-2 flex overflow-hidden shadow-2xs">
            <div
              className="bg-blue-600 h-full transition-all duration-500"
              style={{ width: `${stats.umidaProg + stats.secaProg > 0 ? (stats.umidaReal / (stats.umidaProg + stats.secaProg)) * 100 : 50}%` }}
              title={`Via Úmida: ${stats.umidaReal}kg`}
            />
            <div
              className="bg-cyan-500 h-full transition-all duration-500"
              style={{ width: `${stats.umidaProg + stats.secaProg > 0 ? (stats.secaReal / (stats.umidaProg + stats.secaProg)) * 100 : 50}%` }}
              title={`Via Seca: ${stats.secaReal}kg`}
            />
          </div>
        </div>

        {/* KPI 3: Pesagem PD & PA (Paleta Heijunka) */}
        <div className="rounded-xl border border-sky-200/80 dark:border-sky-800/60 bg-sky-50/60 dark:bg-sky-950/30 p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sky-900 dark:text-sky-200">
              <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span className="text-[11px] font-black uppercase tracking-wider">Entregas PD & PA</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-black text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60">
              {stats.pdpaPct}% PD/PA
            </Badge>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1 tabular-nums">
              <span className="text-2xl font-black text-sky-900 dark:text-sky-100 leading-none">
                {stats.pdpaReal}
              </span>
              <span className="text-xs text-sky-600/80 dark:text-sky-400/80 font-bold">/ {stats.pdpaProg}</span>
            </div>
            <div className="text-[10px] text-sky-800/80 dark:text-sky-300/80 font-bold text-right">
              <div>Auto: {stats.autoCount}</div>
              <div>Direta: {stats.diretaCount}</div>
            </div>
          </div>

          {/* Progress Bar com Gradiente Heijunka */}
          <div className="w-full bg-sky-200/60 dark:bg-sky-900/50 rounded-full h-2 mt-2 overflow-hidden shadow-2xs">
            <div
              className="bg-gradient-to-r from-sky-400 via-blue-600 to-[#003760] h-full transition-all duration-500 rounded-full"
              style={{ width: `${stats.pdpaPct}%` }}
            />
          </div>
        </div>

        {/* KPI 4: Status das Ordens & Resumo Inteligente */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Status das Ordens
            </span>
            <span className="text-[10px] font-bold text-slate-400">Total: {stats.ordensTotal}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Concluídas</span>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 ml-auto tabular-nums">
                {stats.concluídas}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
              <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Em curso</span>
              <span className="text-xs font-black text-amber-700 dark:text-amber-400 ml-auto tabular-nums">
                {stats.emAndamento}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <AlertCircle className="h-3 w-3 text-slate-500 shrink-0" />
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Pendentes</span>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 ml-auto tabular-nums">
                {stats.pendentes}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50">
              <GitBranch className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300">Divididas</span>
              <span className="text-xs font-black text-primary ml-auto tabular-nums">
                {stats.divididas}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Barra Inteligente de Filtros de Rotas & Busca no Quadro ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-border/50 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar max-w-full">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
            <Layers className="h-3 w-3 text-primary" /> Filtrar por Família:
          </span>
          <button
            type="button"
            onClick={() => onSelectFamily(null)}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all shrink-0 border',
              selectedFamily === null
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
            )}
          >
            Todas ({stats.ordensTotal})
          </button>
          {familiesAvailable.map((fam) => {
            const count = stats.familyCounts[fam] || 0;
            const isSelected = selectedFamily === fam;
            return (
              <button
                key={fam}
                type="button"
                onClick={() => onSelectFamily(isSelected ? null : fam)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold transition-all shrink-0 border flex items-center gap-1',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                )}
              >
                <span>{fam}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-[9px] px-1 rounded-full',
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Busca rápida no quadro */}
        <div className="flex items-center gap-1.5 ml-auto">
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              Limpar busca
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
