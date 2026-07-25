"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, Trophy, Medal, Zap, Layers, Trash2, FlaskConical, Activity, TrendingUp, Star
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import ProtectedRoute from '@/components/auth/protected-route';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { getHeijunkaHistory, clearHeijunkaHistory } from '@/lib/heijunka-helpers';
import { HeijunkaSnapshot } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

type TimeFilter = '7' | '15' | '30' | 'month';

// ── Helper: calcula métricas derivadas por snapshot ──────────────────────────
function enrichSnapshot(s: HeijunkaSnapshot) {
  // manual = ordens puramente manuais (sem referência em PA/PD)
  // Snapshots antigos (sem totalManual) usam totalOrdens como fallback.
  const manual = s.totalManual ?? s.totalOrdens;

  // PD/PA = todos os auto + todos os direta + ordens que TÊM referência em PA/PD
  // ordensComRef = totalOrdens - manual
  const ordensComRef = s.totalOrdens - manual;
  const pdpaCount = s.totalPA + s.totalPD + ordensComRef;

  // Total geral = manual + pdpa (invariante: manual + ordensComRef + PA + PD = totalOrdens + PA + PD)
  const totalAll = manual + pdpaCount;
  const pdpaPercent = totalAll > 0 ? Math.round((pdpaCount / totalAll) * 100) : 0;

  const d = new Date(s.date + 'T00:00:00');
  const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { ...s, manual, pdpaCount, totalAll, pdpaPercent, dayLabel, monthLabel, monthKey };
}

// ── Mock data ─────────────────────────────────────────────────────────────────
function generateMockHistory(): HeijunkaSnapshot[] {
  const familias = ['Massas Frescas', 'Recheios', 'Molhos', 'Pão de Queijo', 'Sobremesas'];
  const history: HeijunkaSnapshot[] = [];

  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const totalOrdens = Math.round(20 + Math.random() * 30);
    const totalPA = Math.round(totalOrdens * (0.25 + Math.random() * 0.35));
    const totalPD = Math.round(totalPA * (0.3 + Math.random() * 0.5));
    // Simula que entre 30–70% das ordens têm referência em PA/PD (são ordensReferenciadas)
    // totalManual = ordens sem referência = totalOrdens - ordensReferenciadas
    const ordensComRef = Math.round(totalOrdens * (0.3 + Math.random() * 0.4));
    const totalManual = totalOrdens - ordensComRef;
    const metaDiaria = 900 + Math.round(Math.random() * 300);
    const totalRealizado = Math.round(metaDiaria * (0.82 + Math.random() * 0.25));
    const totalUmida = Math.round(totalRealizado * (0.55 + Math.random() * 0.1));
    const totalSeca = totalRealizado - totalUmida;

    const familiasMap: Record<string, number> = {};
    let remaining = totalRealizado;
    familias.forEach((f, idx) => {
      if (idx === familias.length - 1) { familiasMap[f] = remaining; return; }
      const val = Math.round(totalRealizado * (0.1 + Math.random() * 0.25));
      familiasMap[f] = Math.min(val, remaining);
      remaining = Math.max(0, remaining - val);
    });

    history.push({
      id: `mock-${i}`,
      date: dateStr,
      metaDiaria,
      totalOrdens,
      totalManual,
      totalUmida,
      totalSeca,
      totalPA,
      totalPD,
      totalRealizado,
      totalProgramado: metaDiaria,
      turnos: {
        '1': { ordens: Math.round(totalOrdens / 3), umida: Math.round(totalUmida / 3), seca: Math.round(totalSeca / 3), pa: Math.round(totalPA / 3), pd: Math.round(totalPD / 3), realizado: Math.round(totalRealizado * 0.3), programado: Math.round(metaDiaria / 3) },
        '2': { ordens: Math.round(totalOrdens / 3), umida: Math.round(totalUmida / 3), seca: Math.round(totalSeca / 3), pa: Math.round(totalPA / 3), pd: Math.round(totalPD / 3), realizado: Math.round(totalRealizado * 0.35), programado: Math.round(metaDiaria / 3) },
        '3': { ordens: totalOrdens - 2 * Math.round(totalOrdens / 3), umida: totalUmida - 2 * Math.round(totalUmida / 3), seca: totalSeca - 2 * Math.round(totalSeca / 3), pa: totalPA - 2 * Math.round(totalPA / 3), pd: totalPD - 2 * Math.round(totalPD / 3), realizado: Math.round(totalRealizado * 0.35), programado: metaDiaria - 2 * Math.round(metaDiaria / 3) },
      },
      familias: familiasMap,
      created_at: date.toISOString(),
    });
  }
  return history;
}

// ── Tooltip diário ─────────────────────────────────────────────────────────────
const DailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white dark:bg-card border border-border rounded-lg shadow-xl p-3 min-w-[170px]">
      <p className="font-bold text-foreground mb-2 pb-1.5 border-b border-border/50 text-sm">{label}</p>
      <div className="space-y-1 text-xs">
        <p className="text-slate-500">Total: <span className="font-bold text-slate-800 dark:text-slate-200">{d?.totalAll}</span></p>
        <p className="text-[#4ade80]">Manual: <span className="font-bold">{d?.manual}</span></p>
        <p className="text-[#16a34a]">PD/PA: <span className="font-bold">{d?.pdpaCount}</span></p>
        <p className="text-[#f97316] font-semibold">% PD/PA: <span className="font-bold">{d?.pdpaPercent}%</span></p>
      </div>
    </div>
  );
};

// ── Tooltip mensal ─────────────────────────────────────────────────────────────
const MonthlyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white dark:bg-card border border-border rounded-lg shadow-xl p-3 min-w-[170px]">
      <p className="font-bold text-foreground mb-2 pb-1.5 border-b border-border/50 text-sm capitalize">{label}</p>
      <div className="space-y-1 text-xs">
        <p className="text-[#0066B3]">Total: <span className="font-bold">{d?.total}</span></p>
        <p className="text-[#fb923c]">Manual: <span className="font-bold">{d?.manual}</span></p>
        <p className="text-[#16a34a]">PD/PA: <span className="font-bold">{d?.pdpa}</span></p>
        <p className="text-[#f97316] font-semibold">% PD/PA: <span className="font-bold">{d?.percent}%</span></p>
      </div>
    </div>
  );
};

export default function HeijunkaPage() {
  const { userData, loading: authLoading } = useFirebase();
  const router = useRouter();

  const [fullHistory, setFullHistory] = useState<HeijunkaSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [useMock, setUseMock] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30');

  const isAdmin = userData?.email === ADMIN_EMAIL;
  const isLeaderOrAdmin = isAdmin || userData?.role === 'leader';

  useEffect(() => {
    if (!authLoading) {
      if (!userData || !isLeaderOrAdmin) {
        toast.error('Acesso negado.');
        router.push('/dashboard');
        return;
      }
      loadData();
    }
  }, [authLoading, userData, isLeaderOrAdmin, router]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getHeijunkaHistory(90);
      setFullHistory(data);
      setUseMock(false);
    } catch (err) {
      toast.error('Erro ao carregar dados do Heijunka');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearHistory() {
    if (!isAdmin) return;
    setClearing(true);
    try {
      const removed = await clearHeijunkaHistory();
      toast.success(`Histórico zerado! ${removed} registro(s) removido(s).`);
      setFullHistory([]);
      setUseMock(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao zerar histórico');
    } finally {
      setClearing(false);
    }
  }

  function loadMockData() {
    setFullHistory(generateMockHistory());
    setUseMock(true);
    toast.success('🧪 Dados mock carregados!');
  }

  // ── Filtragem de período ────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    const now = new Date();
    return fullHistory.filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      if (timeFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      const diff = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= Number(timeFilter);
    });
  }, [fullHistory, timeFilter]);

  if (authLoading || !userData || !isLeaderOrAdmin) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" /></div>;
  }

  // ── Enriquece snapshots ──────────────────────────────────────────────────────
  const enriched = filteredHistory.map(enrichSnapshot);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const sorted = [...enriched].sort((a, b) => b.pdpaPercent - a.pdpaPercent);
  const recordAtual = sorted[0] ?? null;
  const recordAnterior = sorted[1] ?? null;
  const maiorPdPa = [...enriched].sort((a, b) => b.pdpaCount - a.pdpaCount)[0] ?? null;
  const maiorTotal = [...enriched].sort((a, b) => b.totalAll - a.totalAll)[0] ?? null;

  // ── Dados para gráfico diário ────────────────────────────────────────────────
  const dailyChartData = enriched.map(s => ({
    name: s.dayLabel,
    manual: s.manual,
    pdpaCount: s.pdpaCount,
    pdpaPercent: s.pdpaPercent,
    totalAll: s.totalAll,
  }));

  // ── Dados para gráfico mensal ────────────────────────────────────────────────
  const monthlyMap: Record<string, { name: string; total: number; manual: number; pdpa: number; days: number }> = {};
  enriched.forEach(s => {
    if (!monthlyMap[s.monthKey]) monthlyMap[s.monthKey] = { name: s.monthLabel, total: 0, manual: 0, pdpa: 0, days: 0 };
    monthlyMap[s.monthKey].total += s.totalAll;
    monthlyMap[s.monthKey].manual += s.manual;
    monthlyMap[s.monthKey].pdpa += s.pdpaCount;
    monthlyMap[s.monthKey].days += 1;
  });
  const monthlyChartData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, percent: v.total > 0 ? Math.round((v.pdpa / v.total) * 100) : 0 }));

  // ── Tabela de ranking ─────────────────────────────────────────────────────────
  const rankingRows = sorted.slice(0, 10);

  // ── Dados por turno (manual / PA / PD) ───────────────────────────────────────
  const turnoChartData = ['1', '2', '3'].map(t => {
    const manual = filteredHistory.reduce((acc, s) => acc + (s.turnos[t]?.ordens || 0), 0);
    const pa     = filteredHistory.reduce((acc, s) => acc + (s.turnos[t]?.pa    || 0), 0);
    const pd     = filteredHistory.reduce((acc, s) => acc + (s.turnos[t]?.pd    || 0), 0);
    return { name: `T${t}`, manual, pa, pd };
  });

  // ── Mês atual label ──────────────────────────────────────────────────────────
  const currentMonthLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-slate-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-5 pt-5 pb-10">

            {/* ── Cabeçalho ──────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow">
                    <BarChart3 className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black text-foreground tracking-tight">% PD/PA na Pesagem</h1>
                      {useMock && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">MOCK</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">Acompanhamento de eficiência das pesagens automáticas e diretas</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro de período */}
                <div className="flex bg-white dark:bg-slate-800 border border-border rounded-lg p-0.5">
                  {(['7', '15', '30', 'month'] as TimeFilter[]).map(t => (
                    <button key={t} onClick={() => setTimeFilter(t)}
                      className={cn("px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                        timeFilter === t ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      )}>
                      {t === 'month' ? 'Mês Atual' : `${t} dias`}
                    </button>
                  ))}
                </div>

                {/* Utilitários */}
                <button onClick={loadMockData}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                  title="Carregar dados mock">
                  <FlaskConical className="h-3.5 w-3.5" /><span>Mock</span>
                </button>
                {useMock && (
                  <button onClick={loadData}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-amber-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                    <Activity className="h-3.5 w-3.5" /><span>Dados reais</span>
                  </button>
                )}
                {isAdmin && !useMock && (
                  <button onClick={handleClearHistory} disabled={clearing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                    title="[Admin] Zerar histórico">
                    <Trash2 className="h-3.5 w-3.5" /><span>{clearing ? 'Zerando...' : 'Zerar'}</span>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">Carregando...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-white dark:bg-card border rounded-xl">
                <Activity className="h-8 w-8 opacity-20" />
                <p className="text-sm">Nenhum histórico encontrado para este período.</p>
                <button onClick={loadMockData}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors">
                  <FlaskConical className="h-3.5 w-3.5" />Carregar dados de exemplo
                </button>
              </div>
            ) : (
              <div className="space-y-5">

                {/* ── KPIs ──────────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                  {/* Recorde Atual */}
                  <div className="bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <Trophy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Recorde Atual</span>
                    </div>
                    <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                      {recordAtual?.pdpaPercent ?? '--'}%
                    </p>
                    {recordAtual && (
                      <p className="text-[11px] text-slate-400 mt-2">
                        {recordAtual.dayLabel} · {recordAtual.pdpaCount} ordens PD/PA
                      </p>
                    )}
                  </div>

                  {/* Recorde Anterior */}
                  <div className="bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                        <Medal className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Recorde Anterior</span>
                    </div>
                    <p className="text-4xl font-black text-sky-600 dark:text-sky-400 leading-none">
                      {recordAnterior?.pdpaPercent ?? '--'}%
                    </p>
                    {recordAnterior && (
                      <p className="text-[11px] text-slate-400 mt-2">
                        {recordAnterior.dayLabel} · {recordAnterior.pdpaCount} ordens PD/PA
                      </p>
                    )}
                  </div>

                  {/* Maior Volume PD/PA */}
                  <div className="bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Zap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Maior Volume PD/PA</span>
                    </div>
                    <p className="text-4xl font-black text-violet-600 dark:text-violet-400 leading-none">
                      {maiorPdPa?.pdpaCount ?? '--'}
                    </p>
                    {maiorPdPa && (
                      <p className="text-[11px] text-slate-400 mt-2">
                        {maiorPdPa.dayLabel} · referência de quantidade
                      </p>
                    )}
                  </div>

                  {/* Maior Volume Total de Ordens */}
                  <div className="bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Layers className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Maior Volume Total</span>
                    </div>
                    <p className="text-4xl font-black text-amber-600 dark:text-amber-400 leading-none">
                      {maiorTotal?.totalAll ?? '--'}
                    </p>
                    {maiorTotal && (
                      <p className="text-[11px] text-slate-400 mt-2">
                        {maiorTotal.dayLabel} · referência de quantidade
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Gráficos principais ──────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">

                  {/* Gráfico Diário (4/9) */}
                  <div className="lg:col-span-4 bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Pesagem Diária — Ordens Manuais e Automáticas</h3>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{currentMonthLabel}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#4ade80]" /> Manual</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#16a34a]" /> PD/PA</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 bg-[#f97316] rounded" /> % PD/PA</span>
                      </div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dailyChartData} margin={{ top: 20, right: 40, left: -20, bottom: 0 }} barGap={0}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={8} interval={dailyChartData.length > 20 ? 2 : 0} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#f97316' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                          <RechartsTooltip content={<DailyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                          <Bar yAxisId="left" dataKey="manual" name="Manual" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} maxBarSize={30} />
                          <Bar yAxisId="left" dataKey="pdpaCount" name="PD/PA" stackId="a" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={30}
                            label={{ position: 'top', fontSize: 9, fill: '#16a34a', formatter: (v: number) => v > 0 ? v : '' }}
                          />
                          <Line yAxisId="right" type="monotone" dataKey="pdpaPercent" name="% PD/PA" stroke="#f97316" strokeWidth={2}
                            dot={{ r: 2.5, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 4 }}
                            label={{ position: 'top', fontSize: 9, fill: '#f97316', formatter: (v: number) => `${v}%` }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Mini-gráfico de Entrega por Turno (2/9) */}
                  <div className="lg:col-span-2 bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl p-4 shadow-sm flex flex-col">
                    <div className="mb-3">
                      <h3 className="text-xs font-bold text-foreground">Entregas por Turno</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Manual · PA · PD</p>
                    </div>
                    <div className="flex-1 min-h-0" style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={turnoChartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} width={24} />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }}
                            formatter={(v: number, name: string) => [v, name === 'manual' ? 'Manual' : name === 'pa' ? 'P. Automática' : 'P. Direta']}
                          />
                          <Bar dataKey="manual" name="manual" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]}
                            label={{ position: 'insideLeft', fontSize: 10, fill: '#fff', formatter: (v: number) => v > 0 ? v : '' }} />
                          <Bar dataKey="pa" name="pa" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]}
                            label={{ position: 'insideLeft', fontSize: 10, fill: '#fff', formatter: (v: number) => v > 0 ? v : '' }} />
                          <Bar dataKey="pd" name="pd" stackId="a" fill="#0066B3" radius={[0, 4, 4, 0]}
                            label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v: number, _: any, idx: number) => {
                              const row = turnoChartData[idx];
                              const tot = row ? row.manual + row.pa + row.pd : 0;
                              return tot > 0 ? tot : '';
                            }}} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legenda */}
                    <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#4ade80]" />Manual</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#16a34a]" />PA</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#0066B3]" />PD</span>
                    </div>
                  </div>

                  {/* Gráfico Mensal (3/9) */}
                  <div className="lg:col-span-3 bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl p-5 shadow-sm">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-foreground">Ordens Manuais e Automáticas</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Visão mensal acumulada</p>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyChartData} margin={{ top: 20, right: 40, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={8} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#f97316' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                          <RechartsTooltip content={<MonthlyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                          <Bar yAxisId="left" dataKey="total" name="Total" fill="#0066B3" radius={[3, 3, 0, 0]} maxBarSize={30} />
                          <Bar yAxisId="left" dataKey="manual" name="Manual" fill="#fb923c" radius={[3, 3, 0, 0]} maxBarSize={30} />
                          <Bar yAxisId="left" dataKey="pdpa" name="PD/PA" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={30} />
                          <Line yAxisId="right" type="monotone" dataKey="percent" name="% PD/PA" stroke="#f97316" strokeWidth={2.5}
                            dot={{ r: 3.5, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }}
                            label={{ position: 'top', fontSize: 10, fill: '#f97316', formatter: (v: number) => `${v}%` }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* ── Tabela de Ranking ─────────────────────────────────────── */}
                <div className="bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-border/50 flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-foreground">Pódio de desempenho por % PD/PA</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Rank</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Mês</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">PD/PA</th>
                          <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">% PD/PA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-border/30">
                        {rankingRows.map((row, idx) => {
                          const d = new Date(row.date + 'T00:00:00');
                          const mesLabel = d.toLocaleString('pt-BR', { month: 'long' });
                          const isTop = idx === 0;
                          return (
                            <tr key={row.id} className={cn(
                              "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30",
                              isTop && "bg-emerald-50 dark:bg-emerald-950/20"
                            )}>
                              <td className="px-5 py-3">
                                <span className={cn(
                                  "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black",
                                  idx === 0 ? "bg-amber-400 text-white" :
                                  idx === 1 ? "bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200" :
                                  idx === 2 ? "bg-amber-700 text-white" :
                                  "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                )}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{row.dayLabel}</td>
                              <td className="px-4 py-3 text-slate-500 dark:text-muted-foreground capitalize">{mesLabel}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200">{row.totalAll}</td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{row.pdpaCount}</td>
                              <td className="px-5 py-3 text-right">
                                <span className={cn(
                                  "inline-block px-2.5 py-0.5 rounded-full text-xs font-black",
                                  row.pdpaPercent >= 60 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                                  row.pdpaPercent >= 40 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                )}>
                                  {row.pdpaPercent}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
