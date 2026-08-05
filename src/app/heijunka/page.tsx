"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, Trophy, Medal, Zap, Layers, Trash2, FlaskConical, Activity, TrendingUp, Star, Calendar, Hand, Sparkles, Clock
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import ProtectedRoute from '@/components/auth/protected-route';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { getHeijunkaHistory, clearHeijunkaHistory } from '@/lib/heijunka-helpers';
import { deleteHeijunkaDay } from '@/lib/heijunka-helpers';
import { HeijunkaDetailsModal } from '@/components/producao/heijunka-details-modal';
import { HeijunkaSnapshot } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

type TimeFilter = '7' | '15' | '30' | 'month';

// ── Helper: calcula métricas derivadas por snapshot ──────────────────────────
function enrichSnapshot(s: HeijunkaSnapshot) {
  const paVol = s.volPA ?? 0;
  const pdVol = s.volPD ?? 0;
  const pdpaCount = paVol + pdVol; // Volume total PD/PA

  const totalAll = s.totalRealizado > 0 ? s.totalRealizado : (s.volManual ?? 0) + pdpaCount;
  const manual = s.volManual ?? Math.max(0, totalAll - pdpaCount);

  const pdpaPercent = totalAll > 0 ? Math.min(100, Math.round((pdpaCount / totalAll) * 100)) : 0;

  const d = new Date(s.date + 'T00:00:00');
  const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  
  return { ...s, manual, pdpaCount, totalAll, pdpaPercent, dayLabel, monthLabel, monthKey };
}

// ── Tooltip diário moderno ─────────────────────────────────────────────────────
const DailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 min-w-[210px] space-y-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{label}</span>
        </div>
        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          {d?.pdpaPercent}% PD/PA
        </span>
      </div>

      <div className="space-y-1.5 text-xs font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" /> Total Realizado:
          </span>
          <span className="font-mono font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {d?.totalAll} OPs
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
            <Hand className="w-3.5 h-3.5" /> Vol. Manual:
          </span>
          <span className="font-mono font-black text-sky-700 dark:text-sky-300 tabular-nums">
            {d?.manual} OPs
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Vol. PD/PA:
          </span>
          <span className="font-mono font-black text-blue-700 dark:text-blue-300 tabular-nums">
            {d?.pdpaCount} OPs
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 text-center flex items-center justify-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-500" />
        <span>Clique para ver/editar detalhes</span>
      </div>
    </div>
  );
};

// ── Tooltip mensal moderno ─────────────────────────────────────────────────────
const MonthlyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 min-w-[210px] space-y-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100 capitalize">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{label}</span>
        </div>
        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          {d?.percent}% PD/PA
        </span>
      </div>

      <div className="space-y-1.5 text-xs font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" /> Total do Mês:
          </span>
          <span className="font-mono font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {d?.total} OPs
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
            <Hand className="w-3.5 h-3.5" /> Vol. Manual:
          </span>
          <span className="font-mono font-black text-sky-700 dark:text-sky-300 tabular-nums">
            {d?.manual} OPs
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Vol. PD/PA:
          </span>
          <span className="font-mono font-black text-blue-700 dark:text-blue-300 tabular-nums">
            {d?.pdpa} OPs
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Tooltip por turno moderno ─────────────────────────────────────────────────
const TurnoTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const totalTurno = (d?.manual || 0) + (d?.pa || 0) + (d?.pd || 0);

  return (
    <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 min-w-[200px] space-y-2 backdrop-blur-md">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
          Turno {d?.name?.replace('T', '')}º
        </span>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          Total: {totalTurno} OPs
        </span>
      </div>

      <div className="space-y-1 text-xs font-semibold">
        <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
          <span>Manual:</span>
          <span className="font-mono font-black tabular-nums">{d?.manual} OPs</span>
        </div>
        <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
          <span>P. Automática:</span>
          <span className="font-mono font-black tabular-nums">{d?.pa} OPs</span>
        </div>
        <div className="flex items-center justify-between text-[#003760] dark:text-blue-200">
          <span>P. Direta:</span>
          <span className="font-mono font-black tabular-nums">{d?.pd} OPs</span>
        </div>
      </div>
    </div>
  );
};

// ── Mock data ─────────────────────────────────────────────────────────────────
function generateMockHistory(): HeijunkaSnapshot[] {
  const familias = ['Massas Frescas', 'Recheios', 'Molhos', 'Pão de Queijo', 'Sobremesas'];
  const history: HeijunkaSnapshot[] = [];

  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const metaDiaria = 2500 + Math.round(Math.random() * 1000);
    const totalRealizado = Math.round(metaDiaria * (0.82 + Math.random() * 0.25));
    
    // Distribuição dos volumes sem duplicação
    const volPA = Math.round(totalRealizado * (0.25 + Math.random() * 0.2));
    const volPD = Math.round(totalRealizado * (0.2 + Math.random() * 0.15));
    const volPDPA = volPA + volPD;
    const volManual = Math.max(0, totalRealizado - volPDPA);

    const totalUmida = Math.round(totalRealizado * (0.55 + Math.random() * 0.1));
    const totalSeca = totalRealizado - totalUmida;

    const totalOrdens = 120 + Math.round(Math.random() * 80);
    const totalPA = Math.round(totalOrdens * 0.25);
    const totalPD = Math.round(totalOrdens * 0.25);

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
      totalManual: totalOrdens,
      totalUmida,
      totalSeca,
      totalPA,
      totalPD,
      volManual,
      volPA,
      volPD,
      volOrdensComRef: 0,
      totalRealizado,
      totalProgramado: metaDiaria,
      turnos: {
        '1': { ordens: Math.round(totalOrdens / 3), umida: Math.round(totalUmida / 3), seca: Math.round(totalSeca / 3), pa: Math.round(totalPA / 3), pd: Math.round(totalPD / 3), realizado: Math.round(totalRealizado * 0.3), programado: Math.round(metaDiaria / 3), volPA: Math.round(volPA * 0.3), volPD: Math.round(volPD * 0.3), volManual: Math.round(volManual * 0.3) },
        '2': { ordens: Math.round(totalOrdens / 3), umida: Math.round(totalUmida / 3), seca: Math.round(totalSeca / 3), pa: Math.round(totalPA / 3), pd: Math.round(totalPD / 3), realizado: Math.round(totalRealizado * 0.35), programado: Math.round(metaDiaria / 3), volPA: Math.round(volPA * 0.35), volPD: Math.round(volPD * 0.35), volManual: Math.round(volManual * 0.35) },
        '3': { ordens: totalOrdens - 2 * Math.round(totalOrdens / 3), umida: totalUmida - 2 * Math.round(totalUmida / 3), seca: totalSeca - 2 * Math.round(totalSeca / 3), pa: totalPA - 2 * Math.round(totalPA / 3), pd: totalPD - 2 * Math.round(totalPD / 3), realizado: Math.round(totalRealizado * 0.35), programado: metaDiaria - 2 * Math.round(metaDiaria / 3), volPA: volPA - Math.round(volPA * 0.3) - Math.round(volPA * 0.35), volPD: volPD - Math.round(volPD * 0.3) - Math.round(volPD * 0.35), volManual: volManual - Math.round(volManual * 0.3) - Math.round(volManual * 0.35) },
      },
      familias: familiasMap,
      created_at: date.toISOString(),
    });
  }
  return history;
}



export default function HeijunkaPage() {
  const { userData, loading: authLoading } = useFirebase();
  const router = useRouter();

  const [fullHistory, setFullHistory] = useState<HeijunkaSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [useMock, setUseMock] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30');
  const [selectedSnapshot, setSelectedSnapshot] = useState<HeijunkaSnapshot | null>(null);
  const [dayToDelete, setDayToDelete] = useState<HeijunkaSnapshot | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingDay, setDeletingDay] = useState(false);

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

  async function handleDeleteDay() {
    if (!isAdmin || !dayToDelete || useMock) return;

    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar.');
      return;
    }

    setDeletingDay(true);
    try {
      const removed = await deleteHeijunkaDay(dayToDelete.date);

      if (removed === 0) {
        toast('Nenhum registro encontrado para esta data.', { icon: 'ℹ️' });
      } else {
        toast.success(`Dia ${dayToDelete.date} removido com sucesso (${removed} registro(s)).`);
      }

      setDayToDelete(null);
      setDeleteConfirmText('');
      setSelectedSnapshot(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover o dia de produção');
    } finally {
      setDeletingDay(false);
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

  // ── KPI Cards ───────────────────────────────────────────────────────────────
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
    rawSnapshot: s,
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

  // ── Dados por turno (volume manual / PA / PD) ───────────────────────────
  const turnoChartData = ['1', '2', '3'].map(t => {
    const manual = filteredHistory.reduce((acc, s) => acc + (s.turnos[t]?.volManual ?? s.turnos[t]?.ordens ?? 0), 0);
    const pa     = filteredHistory.reduce((acc, s) => acc + (s.turnos[t]?.volPA ?? s.turnos[t]?.pa ?? 0), 0);
    const pd     = filteredHistory.reduce((acc, s) => acc + (s.turnos[t]?.volPD ?? s.turnos[t]?.pd ?? 0), 0);
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

            {/* ── Cabeçalho Moderno Glassmorphic ──────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xs mb-5">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#003760] to-[#00477a] flex items-center justify-center shadow-md text-white border border-white/10 shrink-0">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">% PD/PA na Pesagem</h1>
                      {useMock && (
                        <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Dados Mock
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      Clique no gráfico ou nas linhas da tabela para visualizar e gerenciar os detalhes das entregas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filtro de período */}
                <div className="flex bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-1 shadow-2xs">
                  {(['7', '15', '30', 'month'] as TimeFilter[]).map(t => (
                    <button key={t} onClick={() => setTimeFilter(t)}
                      className={cn("px-3 py-1 text-xs font-bold rounded-lg transition-all",
                        timeFilter === t 
                          ? "bg-white dark:bg-slate-900 text-primary shadow-2xs" 
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                      )}>
                      {t === 'month' ? 'Mês Atual' : `${t} dias`}
                    </button>
                  ))}
                </div>

                {/* Utilitários */}
                <button onClick={loadMockData}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl border border-slate-200 dark:border-slate-800 transition-all"
                  title="Carregar dados mock de teste">
                  <FlaskConical className="h-3.5 w-3.5 text-amber-500" /><span>Mock</span>
                </button>
                {useMock && (
                  <button onClick={loadData}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl transition-all">
                    <Activity className="h-3.5 w-3.5 text-amber-600" /><span>Dados Reais</span>
                  </button>
                )}
                {isAdmin && !useMock && (
                  <button onClick={handleClearHistory} disabled={clearing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all disabled:opacity-50"
                    title="[Admin] Zerar histórico">
                    <Trash2 className="h-3.5 w-3.5" /><span>{clearing ? 'Zerando...' : 'Zerar'}</span>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground font-mono text-xs">
                Carregando histórico do Heijunka...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <Activity className="h-8 w-8 opacity-30 text-primary" />
                <p className="text-sm font-semibold">Nenhum histórico encontrado para este período.</p>
                <button onClick={loadMockData}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-800 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 rounded-xl transition-all">
                  <FlaskConical className="h-4 w-4 text-amber-600" />Carregar dados de exemplo
                </button>
              </div>
            ) : (
              <div className="space-y-5">

                {/* ── KPIs Modernos ──────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">

                  {/* Recorde Atual - Verde Emerald */}
                  <div
                    onClick={() => recordAtual && setSelectedSnapshot(recordAtual)}
                    className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-400/80 cursor-pointer transition-all backdrop-blur-md group"
                    title="Clique para ver detalhes do recorde atual"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Recorde Atual</span>
                      </div>
                      <Star className="h-3.5 w-3.5 text-emerald-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-4xl font-mono font-black text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">
                      {recordAtual?.pdpaPercent ?? '--'}%
                    </p>
                    {recordAtual && (
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
                        <span>{recordAtual.dayLabel}</span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-300">{recordAtual.pdpaCount} vol. PD/PA</span>
                      </p>
                    )}
                  </div>

                  {/* Recorde Anterior - Azul Azure */}
                  <div
                    onClick={() => recordAnterior && setSelectedSnapshot(recordAnterior)}
                    className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-blue-400/80 cursor-pointer transition-all backdrop-blur-md group"
                    title="Clique para ver detalhes do recorde anterior"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                          <Medal className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Recorde Anterior</span>
                      </div>
                    </div>
                    <p className="text-4xl font-mono font-black text-blue-600 dark:text-blue-400 leading-none tabular-nums">
                      {recordAnterior?.pdpaPercent ?? '--'}%
                    </p>
                    {recordAnterior && (
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
                        <span>{recordAnterior.dayLabel}</span>
                        <span className="font-mono text-blue-700 dark:text-blue-300">{recordAnterior.pdpaCount} vol. PD/PA</span>
                      </p>
                    )}
                  </div>

                  {/* Maior Volume PD/PA - Violeta */}
                  <div
                    onClick={() => maiorPdPa && setSelectedSnapshot(maiorPdPa)}
                    className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-violet-400/80 cursor-pointer transition-all backdrop-blur-md group"
                    title="Clique para ver detalhes do maior volume PD/PA"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0">
                          <Zap className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Maior Vol. PD/PA</span>
                      </div>
                    </div>
                    <p className="text-4xl font-mono font-black text-violet-600 dark:text-violet-400 leading-none tabular-nums">
                      {maiorPdPa?.pdpaCount ?? '--'}
                    </p>
                    {maiorPdPa && (
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
                        <span>{maiorPdPa.dayLabel}</span>
                        <span className="text-slate-400">referência máxima</span>
                      </p>
                    )}
                  </div>

                  {/* Maior Volume Total de Ordens - Amarelo Amber */}
                  <div
                    onClick={() => maiorTotal && setSelectedSnapshot(maiorTotal)}
                    className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-amber-400/80 cursor-pointer transition-all backdrop-blur-md group"
                    title="Clique para ver detalhes do maior volume total"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                          <Layers className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Maior Vol. Total</span>
                      </div>
                    </div>
                    <p className="text-4xl font-mono font-black text-amber-600 dark:text-amber-400 leading-none tabular-nums">
                      {maiorTotal?.totalAll ?? '--'}
                    </p>
                    {maiorTotal && (
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
                        <span>{maiorTotal.dayLabel}</span>
                        <span className="text-slate-400">referência total</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Gráficos principais ──────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">

                  {/* Gráfico Diário (4/9) */}
                  <div className="lg:col-span-4 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          Pesagem Diária — Ordens Manuais e Automáticas
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            Clique na barra para detalhes
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 capitalize mt-0.5 font-medium">{currentMonthLabel}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-sky-400" /> Manual</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#0284c7]" /> PD/PA</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 bg-amber-500 rounded" /> % PD/PA</span>
                      </div>
                    </div>
                    <div className="h-[300px] w-full cursor-pointer">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={dailyChartData}
                          margin={{ top: 20, right: 40, left: -20, bottom: 0 }}
                          barGap={0}
                          onClick={(e) => {
                            if (e && e.activePayload && e.activePayload.length) {
                              const raw = e.activePayload[0].payload.rawSnapshot;
                              if (raw) setSelectedSnapshot(raw);
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={8} interval={dailyChartData.length > 20 ? 2 : 0} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#f59e0b' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                          <RechartsTooltip content={<DailyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                          <Bar yAxisId="left" dataKey="manual" name="Manual" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]} maxBarSize={30} />
                          <Bar yAxisId="left" dataKey="pdpaCount" name="PD/PA" stackId="a" fill="#0284c7" radius={[3, 3, 0, 0]} maxBarSize={30}
                            label={{ position: 'top', fontSize: 9, fill: '#0284c7', formatter: (v: number) => v > 0 ? v : '' }}
                          />
                          <Line yAxisId="right" type="monotone" dataKey="pdpaPercent" name="% PD/PA" stroke="#f59e0b" strokeWidth={2.5}
                            dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5 }}
                            label={{ position: 'top', fontSize: 9, fill: '#f59e0b', formatter: (v: number) => `${v}%` }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Mini-gráfico de Entrega por Turno (2/9) */}
                  <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col backdrop-blur-md">
                    <div className="mb-3">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Entregas por Turno</h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Manual · PA · PD</p>
                    </div>
                    <div className="flex-1 min-h-0" style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={turnoChartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} width={24} />
                          <RechartsTooltip content={<TurnoTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                          <Bar dataKey="manual" name="manual" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]}
                            label={{ position: 'insideLeft', fontSize: 10, fill: '#fff', formatter: (v: number) => v > 0 ? v : '' }} />
                          <Bar dataKey="pa" name="pa" stackId="a" fill="#0284c7" radius={[0, 0, 0, 0]}
                            label={{ position: 'insideLeft', fontSize: 10, fill: '#fff', formatter: (v: number) => v > 0 ? v : '' }} />
                          <Bar dataKey="pd" name="pd" stackId="a" fill="#003760" radius={[0, 4, 4, 0]}
                            label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v: number, _: any, idx: number) => {
                              const row = turnoChartData[idx];
                              const tot = row ? row.manual + row.pa + row.pd : 0;
                              return tot > 0 ? tot : '';
                            }}} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legenda */}
                    <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-slate-500 font-semibold">
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-400" />Manual</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#0284c7]" />PA</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#003760]" />PD</span>
                    </div>
                  </div>

                  {/* Gráfico Mensal (3/9) */}
                  <div className="lg:col-span-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs backdrop-blur-md">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Ordens Manuais e Automáticas</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Visão mensal acumulada</p>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyChartData} margin={{ top: 20, right: 40, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={8} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#f59e0b' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                          <RechartsTooltip content={<MonthlyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                          <Bar yAxisId="left" dataKey="total" name="Total" fill="#003760" radius={[3, 3, 0, 0]} maxBarSize={30} />
                          <Bar yAxisId="left" dataKey="manual" name="Manual" fill="#38bdf8" radius={[3, 3, 0, 0]} maxBarSize={30} />
                          <Bar yAxisId="left" dataKey="pdpa" name="PD/PA" fill="#0284c7" radius={[3, 3, 0, 0]} maxBarSize={30} />
                          <Line yAxisId="right" type="monotone" dataKey="percent" name="% PD/PA" stroke="#f59e0b" strokeWidth={2.5}
                            dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5 }}
                            label={{ position: 'top', fontSize: 10, fill: '#f59e0b', formatter: (v: number) => `${v}%` }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* ── Tabela de Ranking ─────────────────────────────────────── */}
                <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden backdrop-blur-md">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pódio de Desempenho por % PD/PA</h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">Clique na linha para ver/editar os detalhes</span>
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
                            <tr
                              key={row.id}
                              onClick={() => setSelectedSnapshot(row)}
                              className={cn(
                                "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer",
                                isTop && "bg-emerald-50 dark:bg-emerald-950/20"
                              )}
                              title="Clique para ver ou editar entregas deste dia"
                            >
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

      <HeijunkaDetailsModal
        open={selectedSnapshot !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSnapshot(null);
        }}
        snapshot={selectedSnapshot}
        isAdmin={isAdmin}
        onDeleteDay={
          isAdmin
            ? (snapshot) => {
                setSelectedSnapshot(null);
                setDayToDelete(snapshot);
                setDeleteConfirmText('');
              }
            : undefined
        }
        onSuccess={(updated) => {
          if (updated) {
            setFullHistory((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            );
          }
          loadData();
        }}
      />

      <AlertDialog
        open={dayToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingDay) {
            setDayToDelete(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Excluir Dia Inteiro de Produção
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá todos os registros de Heijunka do dia{' '}
              <span className="font-semibold text-foreground">{dayToDelete?.date}</span>.
              Não é possível desfazer.
              <br />
              Digite <span className="font-mono font-bold">EXCLUIR</span> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="font-mono uppercase"
            disabled={deletingDay}
          />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDay}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteDay();
              }}
              disabled={deletingDay || deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDay ? 'Excluindo...' : 'Excluir Dia'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
