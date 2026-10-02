"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import ProtectedRoute from '@/components/auth/protected-route';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { 
  getHeijunkaHistory, 
  clearHeijunkaHistory, 
  deleteHeijunkaDay, 
  updateHeijunkaSnapshot 
} from '@/lib/heijunka-helpers';
import { HeijunkaSnapshot, HeijunkaTurnoStats } from '@/types';
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
import { Image as ImageIcon } from 'lucide-react';

// ── Tipagens Internas ────────────────────────────────────────────────────────
interface TurnoData {
  man: number;
  pa: number;
  pd: number;
}

interface DayData {
  id?: string;
  date: Date;
  dateStr: string;
  partial: boolean;
  t: TurnoData[]; // [1º turno, 2º turno, 3º turno]
  rawSnapshot?: HeijunkaSnapshot;
  // Valores enriquecidos do snapshot top-level (mesma lógica do enrichSnapshot antigo)
  // Usados para KPIs e cálculos de % — evita dupla contagem dos turnos
  enrichedTotalAll?: number;
  enrichedPdpaCount?: number;
}

type PeriodOption = '7' | '15' | '30' | 'mes' | 'all';
type RankingMode = 'best' | 'worst';

const META = 50; // Meta padrão de 50% de PD/PA
const VOL_BAIXO = 0.6; // Menos de 60% da média é considerado volume baixo
const TURNOS_NOMES = ['1º turno', '2º turno', '3º turno'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_EXTENSO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_L = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// ── Helpers de Formatação e Cálculos ─────────────────────────────────────────
// Carregador assíncrono para html2canvas
function loadHtml2Canvas(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if ((window as any).html2canvas) return Promise.resolve((window as any).html2canvas);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="html2canvas"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).html2canvas));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve((window as any).html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function keyFromDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + n);
  return next;
}

function formatDM(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function formatNumber(n: number) {
  return n.toLocaleString('pt-BR');
}

function pct(a: number, b: number) {
  return b > 0 ? (a / b) * 100 : 0;
}

function p0(v: number) {
  return `${Math.round(v)}%`;
}

function isOk(v: number) {
  return Math.round(v) >= META;
}

function pp1(v: number) {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1).replace('.', ',')} pp`;
}

function dayTotal(d: DayData) {
  // Usa o valor enriquecido do snapshot top-level (mesma lógica do enrichSnapshot antigo)
  // para evitar dupla contagem nos turnos. Fallback para soma dos turnos quando não disponível.
  if (d.enrichedTotalAll !== undefined) return d.enrichedTotalAll;
  return d.t.reduce((acc, x) => acc + x.man + x.pa + x.pd, 0);
}

function dayPdPa(d: DayData) {
  // Usa o valor enriquecido do snapshot top-level (mesma lógica do enrichSnapshot antigo)
  if (d.enrichedPdpaCount !== undefined) return d.enrichedPdpaCount;
  return d.t.reduce((acc, x) => acc + x.pa + x.pd, 0);
}

function dayPct(d: DayData) {
  return pct(dayPdPa(d), dayTotal(d));
}

function aggDays(list: DayData[]) {
  const o = { total: 0, pdpa: 0, man: 0, pa: 0, pd: 0, n: list.length, pct: 0 };
  list.forEach((d) => {
    // Usa os valores enriquecidos top-level para totais corretos
    const dTotal = dayTotal(d);
    const dPdpa = dayPdPa(d);
    o.total += dTotal;
    o.pdpa += dPdpa;
    o.man += dTotal - dPdpa;
    // PA e PD individuais para breakdown por turno (usados no detalhe)
    d.t.forEach((x) => {
      o.pa += x.pa;
      o.pd += x.pd;
    });
  });
  o.pct = pct(o.pdpa, o.total);
  return o;
}

function getCompleteDays(list: DayData[]) {
  return list.filter((d) => !d.partial && dayTotal(d) > 0);
}

// ── Converter HeijunkaSnapshot Real em DayData ──────────────────────────────
function snapshotToDayData(s: HeijunkaSnapshot): DayData {
  let d: Date;
  if (s.date && typeof s.date === 'string' && s.date.includes('-')) {
    const [y, m, day] = s.date.split('-').map(Number);
    d = new Date(y, m - 1, day, 0, 0, 0, 0);
  } else {
    d = new Date(s.date);
    d.setHours(0, 0, 0, 0);
  }
  const isToday = keyFromDate(d) === keyFromDate(new Date());

  const t1 = s.turnos?.['1'];
  const t2 = s.turnos?.['2'];
  const t3 = s.turnos?.['3'];

  const t1Data: TurnoData = {
    man: t1?.volManual ?? (t1?.ordens ? Math.max(0, t1.ordens - ((t1.volPA || t1.pa || 0) + (t1.volPD || t1.pd || 0))) : 0),
    pa: t1?.volPA ?? t1?.pa ?? 0,
    pd: t1?.volPD ?? t1?.pd ?? 0,
  };

  const t2Data: TurnoData = {
    man: t2?.volManual ?? (t2?.ordens ? Math.max(0, t2.ordens - ((t2.volPA || t2.pa || 0) + (t2.volPD || t2.pd || 0))) : 0),
    pa: t2?.volPA ?? t2?.pa ?? 0,
    pd: t2?.volPD ?? t2?.pd ?? 0,
  };

  const t3Data: TurnoData = {
    man: t3?.volManual ?? (t3?.ordens ? Math.max(0, t3.ordens - ((t3.volPA || t3.pa || 0) + (t3.volPD || t3.pd || 0))) : 0),
    pa: t3?.volPA ?? t3?.pa ?? 0,
    pd: t3?.volPD ?? t3?.pd ?? 0,
  };

  // Se não houver distribuição nos turnos, usa os totais do snapshot de nível superior
  const sumTurnos = t1Data.man + t1Data.pa + t1Data.pd + t2Data.man + t2Data.pa + t2Data.pd + t3Data.man + t3Data.pa + t3Data.pd;

  let turnosArray = [t1Data, t2Data, t3Data];

  if (sumTurnos === 0) {
    const totalPa = s.volPA ?? 0;
    const totalPd = s.volPD ?? 0;
    const totalPdpa = totalPa + totalPd;
    const totalAll = s.totalRealizado > 0 ? s.totalRealizado : (s.volManual ?? 0) + totalPdpa;
    const totalMan = s.volManual ?? Math.max(0, totalAll - totalPdpa);

    // Distribui uniformemente pelos turnos para permitir visualização
    const p1 = Math.floor(totalPa / 3);
    const p2 = Math.floor(totalPa / 3);
    const p3 = totalPa - p1 - p2;

    const d1 = Math.floor(totalPd / 3);
    const d2 = Math.floor(totalPd / 3);
    const d3 = totalPd - d1 - d2;

    const m1 = Math.floor(totalMan / 3);
    const m2 = Math.floor(totalMan / 3);
    const m3 = totalMan - m1 - m2;

    turnosArray = [
      { man: m1, pa: p1, pd: d1 },
      { man: m2, pa: p2, pd: d2 },
      { man: m3, pa: p3, pd: d3 },
    ];
  }

  // ── Valores enriquecidos top-level (mesma lógica do antigo enrichSnapshot) ──
  // Estes valores são a fonte de verdade para KPIs, gráficos e ranking.
  // O campo turnosStats.realizado inclui ordens + auto + direta (dupla contagem),
  // por isso NÃO usamos a soma dos turnos para o total — usamos os campos top-level.
  const paVol = s.volPA ?? 0;
  const pdVol = s.volPD ?? 0;
  const enrichedPdpaCount = paVol + pdVol;
  const enrichedTotalAll = s.totalRealizado > 0
    ? s.totalRealizado
    : (s.volManual ?? 0) + enrichedPdpaCount;

  return {
    id: s.id,
    date: d,
    dateStr: s.date,
    partial: isToday,
    rawSnapshot: s,
    t: turnosArray,
    enrichedTotalAll,
    enrichedPdpaCount,
  };
}

export default function HeijunkaPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useFirebase();

  const [history, setHistory] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodOption>('all');
  const [rankingMode, setRankingMode] = useState<RankingMode>('best');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  // Estados de confirmação e exclusão
  const [dayToDelete, setDayToDelete] = useState<DayData | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingDay, setDeletingDay] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Tooltip do gráfico SVG
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; day: DayData; ma?: number | null } | null>(null);

  // Relógio
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = userData?.email === ADMIN_EMAIL;
  const isLeaderOrAdmin = isAdmin || userData?.role === 'leader' || userData?.role === 'supervisor';

  // Carregar dados reais do Firestore
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHeijunkaHistory(90);
      if (data && data.length > 0) {
        const converted = data.map(snapshotToDayData);
        setHistory(converted);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico Heijunka:', err);
      toast.error('Erro ao carregar histórico de dados.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!userData || !isLeaderOrAdmin) {
        toast.error('Acesso restrito.');
        router.push('/dashboard');
        return;
      }
      loadData();
    }
  }, [authLoading, userData, isLeaderOrAdmin, router, loadData]);

  // ── Dias do Período Ativo ──────────────────────────────────────────────────
  const periodDays = useMemo(() => {
    if (!history.length) return [];
    if (period === 'all') return history;

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'mes') {
      // Início do mês atual (dia 1 às 00:00:00) até o final do dia de hoje (ou fim do mês)
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return history.filter((d) => d.date >= start && d.date <= end);
    }

    const len = Number(period);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (len - 1), 0, 0, 0, 0);
    return history.filter((d) => d.date >= start && d.date <= end);
  }, [history, period]);

  // Período anterior para comparação delta
  const prevPeriodDays = useMemo(() => {
    if (period === 'all') return [];
    const curComplete = getCompleteDays(periodDays);
    if (!curComplete.length) return [];
    const now = new Date();
    let start: Date;
    let end: Date;

    if (period === 'mes') {
      // Mês anterior completo
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else {
      end = new Date(curComplete[0].date);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - (curComplete.length - 1));
      start.setHours(0, 0, 0, 0);
    }

    return history.filter((d) => d.date >= start && d.date <= end);
  }, [history, periodDays, period]);

  const periodLabel = useMemo(() => {
    if (period === 'all') return 'todo o histórico';
    if (period === 'mes') return MESES[new Date().getMonth()].toLowerCase();
    return `últimos ${period} dias`;
  }, [period]);

  // Média móvel de 7 dias para um dia
  const getMA7 = useCallback(
    (targetDay: DayData) => {
      const idx = history.indexOf(targetDay);
      if (idx === -1) return null;
      const windowDays = getCompleteDays(history.slice(Math.max(0, idx - 6), idx + 1));
      return windowDays.length >= 3 ? aggDays(windowDays).pct : null;
    },
    [history]
  );

  // Recordes operacionais
  const recordStats = useMemo(() => {
    const complete = getCompleteDays(history);
    if (!complete.length) return null;

    const byPct = complete.slice().sort((a, b) => dayPct(b) - dayPct(a) || dayTotal(b) - dayTotal(a));
    const byPd = complete.slice().sort((a, b) => dayPdPa(b) - dayPdPa(a) || dayPct(b) - dayPct(a));
    const byTot = complete.slice().sort((a, b) => dayTotal(b) - dayTotal(a));
    const avgTot = aggDays(complete).total / complete.length;

    // "Recorde Anterior" = primeiro dia cuja % arredondada é diferente do melhor
    const bestRounded = Math.round(dayPct(byPct[0]));
    const secondDay = byPct.find((d) => Math.round(dayPct(d)) < bestRounded) || byPct[1] || byPct[0];

    return {
      best: byPct[0],
      second: secondDay,
      maxPd: byPd[0],
      maxTot: byTot[0],
      avgTot,
    };
  }, [history]);

  // Sequência abaixo da meta
  const streakBelowMeta = useMemo(() => {
    const complete = getCompleteDays(periodDays);
    let count = 0;
    for (let i = complete.length - 1; i >= 0; i--) {
      if (!isOk(dayPct(complete[i]))) count++;
      else break;
    }
    return count;
  }, [periodDays]);

  // Garantir dia selecionado inicial
  useEffect(() => {
    if (!periodDays.length) return;
    const exists = periodDays.some((d) => keyFromDate(d.date) === selectedKey);
    if (!exists) {
      const complete = getCompleteDays(periodDays);
      const chosen = complete.length ? complete[complete.length - 1] : periodDays[periodDays.length - 1];
      setSelectedKey(keyFromDate(chosen.date));
    }
  }, [periodDays, selectedKey]);

  // Dia ativo selecionado no painel lateral
  const activeSelectedDay = useMemo(() => {
    return history.find((d) => keyFromDate(d.date) === selectedKey) || null;
  }, [history, selectedKey]);

  // ── Atualização em Tempo Real de Valores do Dia Selecionado ───────────────
  const handleUpdateDayValue = async (turnoIdx: number, field: 'man' | 'pa' | 'pd', valStr: string) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    if (!activeSelectedDay) return;

    const newHistory = history.map((d) => {
      if (keyFromDate(d.date) === selectedKey) {
        const newT = d.t.map((t, i) => (i === turnoIdx ? { ...t, [field]: val } : t));
        return { ...d, t: newT };
      }
      return d;
    });

    setHistory(newHistory);

    // Persiste atualização no Firestore
    if (activeSelectedDay.id) {
      try {
        const tKey = String(turnoIdx + 1);
        const updatedTurnos = {
          ...(activeSelectedDay.rawSnapshot?.turnos || {}),
          [tKey]: {
            ordens: activeSelectedDay.t[turnoIdx].man + activeSelectedDay.t[turnoIdx].pa + activeSelectedDay.t[turnoIdx].pd,
            volManual: field === 'man' ? val : activeSelectedDay.t[turnoIdx].man,
            volPA: field === 'pa' ? val : activeSelectedDay.t[turnoIdx].pa,
            volPD: field === 'pd' ? val : activeSelectedDay.t[turnoIdx].pd,
            pa: field === 'pa' ? val : activeSelectedDay.t[turnoIdx].pa,
            pd: field === 'pd' ? val : activeSelectedDay.t[turnoIdx].pd,
          }
        };
        await updateHeijunkaSnapshot(activeSelectedDay.id, { turnos: updatedTurnos as any });
      } catch (err) {
        console.error('Erro ao salvar atualização no Firestore:', err);
      }
    }
  };

  // Navegação de dias no detalhe (< e >)
  const handleNavDay = (direction: 'prev' | 'next') => {
    if (!periodDays.length) return;
    const currentIdx = periodDays.findIndex((d) => keyFromDate(d.date) === selectedKey);
    if (currentIdx === -1) return;

    if (direction === 'prev' && currentIdx > 0) {
      setSelectedKey(keyFromDate(periodDays[currentIdx - 1].date));
    } else if (direction === 'next' && currentIdx < periodDays.length - 1) {
      setSelectedKey(keyFromDate(periodDays[currentIdx + 1].date));
    }
  };

  // Atalhos de teclado (Escape para sair de captura, Setas para navegar no detalhe)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'Escape' && isCaptureMode) {
        setIsCaptureMode(false);
        document.body.classList.remove('capture');
      }

      if (!isInput) {
        if (e.key === 'ArrowLeft') handleNavDay('prev');
        if (e.key === 'ArrowRight') handleNavDay('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCaptureMode, selectedKey, periodDays]);

  // Modo Captura
  const toggleCaptureMode = () => {
    if (!isCaptureMode) {
      setIsCaptureMode(true);
      document.body.classList.add('capture');
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
      toast('Modo Captura ativado. Pressione ESC para sair.', { icon: '🔍' });
    } else {
      setIsCaptureMode(false);
      document.body.classList.remove('capture');
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
    }
  };

  // Geração de Imagem PNG (Screenshot de alta qualidade)
  const handleGenerateImage = async () => {
    const reportEl = document.getElementById('report-panel');
    if (!reportEl) return;

    const toastId = toast.loading('Gerando imagem do painel...');
    const wasCapture = document.body.classList.contains('capture');

    try {
      const html2canvas = await loadHtml2Canvas();
      document.body.classList.add('capture');

      await new Promise((r) => setTimeout(r, 100));
      const bg = getComputedStyle(document.body).backgroundColor || '#0e1013';

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        backgroundColor: bg,
        ignoreElements: (element: Element) => element.classList.contains('no-print'),
      });

      if (!wasCapture) {
        document.body.classList.remove('capture');
      }

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          toast.error('Erro ao gerar imagem.', { id: toastId });
          return;
        }

        try {
          // Tenta copiar direto para a área de transferência
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Imagem copiada! Cole direto no WhatsApp (Ctrl+V)', { id: toastId, icon: '🖼️' });
        } catch {
          // Fallback: download da imagem
          const a = document.createElement('a');
          const fileName = `painel_heijunka_${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}_${pad(nowDate.getHours())}${pad(nowDate.getMinutes())}.png`;
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast.success('Imagem baixada com sucesso!', { id: toastId });
        }
      }, 'image/png');
    } catch (err) {
      if (!wasCapture) document.body.classList.remove('capture');
      toast.error('Não foi possível gerar a imagem. Use o Modo Captura e Win+Shift+S.', { id: toastId });
    }
  };

  // Exportação para WhatsApp
  const handleExportWhatsApp = async () => {
    const curComplete = getCompleteDays(periodDays);
    const curAgg = aggDays(curComplete);
    const prevAgg = aggDays(getCompleteDays(prevPeriodDays));
    const hitDays = curComplete.filter((d) => isOk(dayPct(d))).length;
    const t = nowDate;

    const L: string[] = [];
    L.push('*Heijunka · % PD/PA na pesagem*');
    L.push(
      periodLabel.charAt(0).toUpperCase() +
        periodLabel.slice(1) +
        (curComplete.length ? ` (${formatDM(curComplete[0].date)} a ${formatDM(curComplete[curComplete.length - 1].date)})` : '') +
        ` · atualizado às ${pad(t.getHours())}:${pad(t.getMinutes())}`
    );
    L.push('');
    L.push(`*% PD/PA:* ${p0(curAgg.pct)} (${formatNumber(curAgg.pdpa)} de ${formatNumber(curAgg.total)} ordens) · meta ${META}%`);
    if (prevAgg.total) {
      const dlt = curAgg.pct - prevAgg.pct;
      L.push(`${dlt >= 0 ? '▲ ' : '▼ '}${pp1(dlt)} vs período anterior (${p0(prevAgg.pct)})`);
    }
    L.push(`*Dias na meta:* ${hitDays} de ${curComplete.length}`);

    const turnosArr = [0, 1, 2].map((k) => {
      const tAgg = aggDays(curComplete.map((d) => ({ ...d, t: [d.t[k]], enrichedTotalAll: undefined, enrichedPdpaCount: undefined })));
      return `${TURNOS_NOMES[k].replace(' turno', '')} ${p0(tAgg.pct)}`;
    });
    L.push(`*Por turno:* ${turnosArr.join(' · ')}`);

    if (recordStats) {
      L.push(`*Recorde:* ${p0(dayPct(recordStats.best))} em ${formatDM(recordStats.best.date)} (${dayPdPa(recordStats.best)}/${dayTotal(recordStats.best)})`);
    }

    const todayDay = periodDays.find((d) => d.partial);
    if (todayDay && dayTotal(todayDay) > 0) {
      L.push(`*Hoje (parcial):* ${p0(dayPct(todayDay))} (${dayPdPa(todayDay)}/${dayTotal(todayDay)})`);
    }

    const msg = L.join('\n');
    try {
      await navigator.clipboard.writeText(msg);
      toast.success('Resumo copiado para a área de transferência!', { icon: '📋' });
    } catch {
      toast.error('Erro ao copiar.');
    }
  };

  // Zerar Histórico (Admin)
  const handleClearHistory = async () => {
    if (!isAdmin) return;
    try {
      const count = await clearHeijunkaHistory();
      toast.success(`Histórico zerado (${count} registros removidos).`);
      setHistory([]);
      setIsClearingAll(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao zerar histórico.');
    }
  };

  // Excluir Dia Específico
  const handleDeleteDay = async () => {
    if (!isAdmin || !dayToDelete) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar.');
      return;
    }

    setDeletingDay(true);
    try {
      if (dayToDelete.dateStr) {
        await deleteHeijunkaDay(dayToDelete.dateStr);
      }
      setHistory((prev) => prev.filter((d) => keyFromDate(d.date) !== keyFromDate(dayToDelete.date)));
      toast.success(`Dia ${formatDM(dayToDelete.date)} removido.`);
      setDayToDelete(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover dia.');
    } finally {
      setDeletingDay(false);
    }
  };

  // ── Métricas Consolidadas ─────────────────────────────────────────────────
  const completeDays = useMemo(() => getCompleteDays(periodDays), [periodDays]);
  const currentAgg = useMemo(() => aggDays(completeDays), [completeDays]);
  const prevAgg = useMemo(() => aggDays(getCompleteDays(prevPeriodDays)), [prevPeriodDays]);
  const deltaVsPrev = currentAgg.pct - prevAgg.pct;
  const daysHitMeta = completeDays.filter((d) => isOk(dayPct(d))).length;

  // ── Pontos de Atenção (Algoritmo do Conceito) ─────────────────────────────
  const operationalInsights = useMemo(() => {
    const list: { color: string; weight: number; title: string; desc: string; dayKey?: string }[] = [];
    if (!completeDays.length) return list;

    // 1. Tendência: 7 dias vs 7 dias anteriores
    const allComplete = getCompleteDays(history);
    const lastIdx = allComplete.indexOf(completeDays[completeDays.length - 1]);
    if (lastIdx >= 13) {
      const r7 = aggDays(allComplete.slice(lastIdx - 6, lastIdx + 1));
      const p7 = aggDays(allComplete.slice(lastIdx - 13, lastIdx - 6));
      const dlt = r7.pct - p7.pct;
      list.push({
        color: dlt >= 0 ? 'var(--green)' : 'var(--red)',
        weight: 2,
        title: `Últimos 7 dias ${dlt >= 0 ? 'em alta' : 'em queda'}: ${p0(r7.pct)}`,
        desc: `${pp1(dlt)} em relação aos 7 dias anteriores (${p0(p7.pct)})`,
      });
    }

    // 2. Sequência abaixo da meta
    if (streakBelowMeta >= 2) {
      const firstBelow = completeDays[completeDays.length - streakBelowMeta];
      const lastDay = completeDays[completeDays.length - 1];
      list.push({
        color: 'var(--red)',
        weight: 3,
        title: `${streakBelowMeta} dias seguidos abaixo da meta`,
        desc: `Desde ${formatDM(firstBelow.date)} · último: ${p0(dayPct(lastDay))} em ${formatDM(lastDay.date)}`,
        dayKey: keyFromDate(lastDay.date),
      });
    }

    // 3. Pior dia do período
    const worstDay = completeDays.slice().sort((a, b) => dayPct(a) - dayPct(b))[0];
    if (worstDay) {
      list.push({
        color: 'var(--amber)',
        weight: 1,
        title: `Pior dia: ${formatDM(worstDay.date)} com ${p0(dayPct(worstDay))}`,
        desc: `${dayPdPa(worstDay)} PD/PA de ${dayTotal(worstDay)} ordens · ${pp1(dayPct(worstDay) - currentAgg.pct)} vs média`,
        dayKey: keyFromDate(worstDay.date),
      });
    }

    // 4. Turno com menor participação
    const turnosStats = [0, 1, 2]
      .map((k) => {
        const o = aggDays(completeDays.map((d) => ({ ...d, t: [d.t[k]], enrichedTotalAll: undefined, enrichedPdpaCount: undefined })));
        return { k, ...o };
      })
      .filter((o) => o.total > 0)
      .sort((a, b) => a.pct - b.pct);

    if (turnosStats.length > 1 && turnosStats[turnosStats.length - 1].pct - turnosStats[0].pct >= 3) {
      const lowest = turnosStats[0];
      const highest = turnosStats[turnosStats.length - 1];
      list.push({
        color: 'var(--text-3)',
        weight: 1,
        title: `${TURNOS_NOMES[lowest.k]} com a menor % PD/PA (${p0(lowest.pct)})`,
        desc: `${pp1(lowest.pct - highest.pct)} em relação ao ${TURNOS_NOMES[highest.k]} (${p0(highest.pct)})`,
      });
    }

    // 5. Dia da semana recorrente
    if (completeDays.length >= 14) {
      const weekdays = [0, 1, 2, 3, 4, 5, 6]
        .map((k) => {
          const matching = completeDays.filter((d) => d.date.getDay() === k);
          return { k, count: matching.length, a: aggDays(matching) };
        })
        .filter((w) => w.count >= 2)
        .sort((a, b) => a.a.pct - b.a.pct);

      if (weekdays.length > 2 && currentAgg.pct - weekdays[0].a.pct >= 4) {
        const worstWd = weekdays[0];
        const bestWd = weekdays[weekdays.length - 1];
        list.push({
          color: 'var(--text-3)',
          weight: 1,
          title: `Nos ${DIAS_L[worstWd.k]} a % cai para ${p0(worstWd.a.pct)}`,
          desc: `Média do período: ${p0(currentAgg.pct)} · melhor dia: ${DIAS_L[bestWd.k]} (${p0(bestWd.a.pct)})`,
        });
      }
    }

    // 6. Recorde em dia de volume baixo
    if (recordStats && dayTotal(recordStats.best) < recordStats.avgTot * VOL_BAIXO) {
      list.push({
        color: 'var(--text-3)',
        weight: 0,
        title: `Recorde de ${p0(dayPct(recordStats.best))} em dia de volume baixo`,
        desc: `${formatDM(recordStats.best.date)}: ${dayTotal(recordStats.best)} ordens (média ${Math.round(recordStats.avgTot)}). Com volume normal, o melhor foi ${p0(dayPct(recordStats.second))} em ${formatDM(recordStats.second.date)}.`,
        dayKey: keyFromDate(recordStats.best.date),
      });
    }

    return list.sort((a, b) => b.weight - a.weight);
  }, [completeDays, history, streakBelowMeta, currentAgg, recordStats]);

  // ── Dados por Turno ───────────────────────────────────────────────────────
  const turnosBreakdown = useMemo(() => {
    const list = [0, 1, 2].map((i) => {
      const o = { man: 0, pa: 0, pd: 0, total: 0, pct: 0, label: TURNOS_NOMES[i] };
      completeDays.forEach((d) => {
        o.man += d.t[i].man;
        o.pa += d.t[i].pa;
        o.pd += d.t[i].pd;
      });
      o.total = o.man + o.pa + o.pd;
      o.pct = pct(o.pa + o.pd, o.total);
      return o;
    });

    const all = {
      man: list.reduce((a, b) => a + b.man, 0),
      pa: list.reduce((a, b) => a + b.pa, 0),
      pd: list.reduce((a, b) => a + b.pd, 0),
      total: list.reduce((a, b) => a + b.total, 0),
      pct: 0,
      label: 'Todos',
    };
    all.pct = pct(all.pa + all.pd, all.total);

    const bestTurno = list.slice().sort((a, b) => b.pct - a.pct)[0];
    return { list, all, bestTurno };
  }, [completeDays]);

  // ── Mês a Mês ─────────────────────────────────────────────────────────────
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, DayData[]> = {};
    const order: string[] = [];

    getCompleteDays(history).forEach((d) => {
      const mKey = `${d.date.getFullYear()}-${d.date.getMonth()}`;
      if (!map[mKey]) {
        map[mKey] = [];
        order.push(mKey);
      }
      map[mKey].push(d);
    });

    return order.slice(-4).map((mKey, idx, arr) => {
      const dList = map[mKey];
      const agg = aggDays(dList);
      const mIdx = Number(mKey.split('-')[1]);
      const prevAggM = idx > 0 ? aggDays(map[arr[idx - 1]]) : null;
      const lastDayInMonth = dList[dList.length - 1];
      const isCurrentMonth = mIdx === new Date().getMonth();

      return {
        monthName: MESES[mIdx],
        isCurrentMonth,
        lastDayStr: formatDM(lastDayInMonth.date),
        total: agg.total,
        pdpa: agg.pdpa,
        pct: agg.pct,
        delta: prevAggM ? agg.pct - prevAggM.pct : null,
      };
    });
  }, [history]);

  // ── Ranking ───────────────────────────────────────────────────────────────
  const rankingList = useMemo(() => {
    const avgTotal = completeDays.length ? currentAgg.total / completeDays.length : 0;
    const sorted = completeDays.slice().sort((a, b) => {
      if (rankingMode === 'best') {
        return dayPct(b) - dayPct(a) || dayTotal(b) - dayTotal(a);
      }
      return dayPct(a) - dayPct(b) || dayTotal(b) - dayTotal(a);
    });

    return sorted.slice(0, 10).map((d) => ({
      day: d,
      pct: dayPct(d),
      total: dayTotal(d),
      pdpa: dayPdPa(d),
      manual: dayTotal(d) - dayPdPa(d),
      isLowVolume: dayTotal(d) < avgTotal * VOL_BAIXO,
    }));
  }, [completeDays, currentAgg, rankingMode]);

  // ── Gráfico Diário SVG Customizado de Alta Fidelidade ─────────────────────
  const renderSvgChart = () => {
    const days = periodDays;
    if (!days.length) return <div className="p-8 text-center text-xs text-[var(--text-3)]">Sem dados para exibir.</div>;

    const W = 680;
    const H = 270;
    const pl = 34;
    const pr = 40;
    const pt = 14;
    const pb = 26;
    const pw = W - pl - pr;
    const ph = H - pt - pb;

    const maxVal = Math.max(...days.map(dayTotal), 10);
    const step = maxVal <= 40 ? 10 : maxVal <= 100 ? 20 : maxVal <= 300 ? 50 : 100;
    const maxT = Math.max(step, Math.ceil(maxVal / step) * step);

    const n = days.length;
    const gw = pw / n;
    const bw = Math.max(4, Math.min(22, gw * 0.62));

    const getY = (v: number) => pt + ph - (v / maxT) * ph;
    const getYPct = (p: number) => pt + ph - (p / 100) * ph;
    const getCX = (i: number) => pl + i * gw + gw / 2;

    // Linha de média móvel 7 dias
    const maPoints: string[] = [];
    days.forEach((d, i) => {
      const v = getMA7(d);
      if (v != null && !d.partial) {
        maPoints.push(`${getCX(i)},${getYPct(v)}`);
      }
    });

    // Pontos de % PD/PA
    const pctPoints: [number, number, DayData][] = [];
    days.forEach((d, i) => {
      if (!d.partial && dayTotal(d) > 0) {
        pctPoints.push([getCX(i), getYPct(dayPct(d)), d]);
      }
    });

    const stepLabels = Math.ceil(n / 12);

    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto overflow-visible select-none"
      >
        {/* Linhas de Grade e Eixos */}
        {[0, 1, 2, 3, 4].map((g) => {
          const gy = pt + (ph * g) / 4;
          return (
            <g key={g}>
              <line
                x1={pl}
                x2={W - pr}
                y1={gy}
                y2={gy}
                className="stroke-[var(--border)]"
                strokeWidth={1}
                strokeDasharray={g < 4 ? '2 4' : undefined}
              />
              <text x={pl - 6} y={gy + 3.5} textAnchor="end" className="font-mono text-[10px] fill-[var(--text-3)]">
                {(maxT * (4 - g)) / 4}
              </text>
              <text x={W - pr + 6} y={gy + 3.5} className="font-mono text-[10px] fill-[var(--text-3)]">
                {100 - g * 25}%
              </text>
            </g>
          );
        })}

        {/* Highlight de Dia Selecionado */}
        {days.map((d, i) => {
          if (keyFromDate(d.date) === selectedKey) {
            return (
              <rect
                key={`sel-${i}`}
                x={pl + i * gw}
                y={pt}
                width={gw}
                height={ph}
                className="fill-[var(--accent-weak)] transition-all"
              />
            );
          }
          return null;
        })}

        {/* Barras Empilhadas (PD/PA + Manual) */}
        {days.map((d, i) => {
          const t = dayTotal(d);
          const p = dayPdPa(d);
          const x = getCX(i) - bw / 2;
          const isPart = d.partial;
          const showVolLabel = t > 0 && n <= 35;

          return (
            <g key={`bar-${i}`} className={cn(isPart && "opacity-50")}>
              {/* Barra PD/PA (Azul Accent) */}
              <rect
                x={x}
                y={getY(p)}
                width={bw}
                height={Math.max(0, getY(0) - getY(p))}
                className="fill-[var(--accent)] transition-all"
                rx={1}
              />
              {/* Barra Manual (Cinza Bar) */}
              <rect
                x={x}
                y={getY(t)}
                width={bw}
                height={Math.max(0, getY(p) - getY(t))}
                className="fill-[var(--bar)] transition-all"
                rx={1}
              />
              {/* Contorno se for dia em andamento */}
              {isPart && (
                <rect
                  x={x}
                  y={getY(t)}
                  width={bw}
                  height={Math.max(0, getY(0) - getY(t))}
                  fill="none"
                  className="stroke-[var(--text-3)]"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              )}
              {/* Volume no topo da barra */}
              {showVolLabel && (
                <text
                  x={getCX(i)}
                  y={getY(t) - 4}
                  textAnchor="middle"
                  className="font-mono text-[8px] fill-[var(--text-3)]"
                >
                  {t}
                </text>
              )}
            </g>
          );
        })}

        {/* Linha de Meta 50% (Vermelha) */}
        <line
          x1={pl}
          x2={W - pr}
          y1={getYPct(META)}
          y2={getYPct(META)}
          className="stroke-[var(--red)] opacity-70"
          strokeWidth={1.2}
        />

        {/* Linha de Média Móvel 7 Dias (Tracejada) */}
        {maPoints.length > 1 && (
          <polyline
            points={maPoints.join(' ')}
            fill="none"
            className="stroke-[var(--text-2)]"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}

        {/* Linha Contínua % PD/PA (Âmbar) */}
        {pctPoints.length > 1 && (
          <polyline
            points={pctPoints.map((p) => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            className="stroke-[var(--amber)]"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        )}

        {/* Pontos Clicáveis na Linha */}
        {pctPoints.map((p, idx) => {
          const below = !isOk(dayPct(p[2]));
          const showLabel = n <= 16;
          return (
            <g key={`pt-${idx}`}>
              <circle
                cx={p[0]}
                cy={p[1]}
                r={3.2}
                className={cn(below ? "fill-[var(--surface)] stroke-[var(--amber)]" : "fill-[var(--amber)] stroke-[var(--amber)]")}
                strokeWidth={1.5}
              />
              {showLabel && (
                <text
                  x={p[0]}
                  y={p[1] - 7}
                  textAnchor="middle"
                  className="font-mono text-[9px] font-bold fill-[var(--text-2)]"
                >
                  {Math.round(dayPct(p[2]))}
                </text>
              )}
            </g>
          );
        })}

        {/* Eixo X com Rótulos de Datas */}
        {days.map((d, i) => {
          if (i % stepLabels === 0 || i === n - 1) {
            const isSel = keyFromDate(d.date) === selectedKey;
            return (
              <text
                key={`lbl-${i}`}
                x={getCX(i)}
                y={H - 8}
                textAnchor="middle"
                className={cn("font-mono text-[10px] transition-colors", isSel ? "fill-[var(--text)] font-bold" : "fill-[var(--text-3)]")}
              >
                {formatDM(d.date)}
              </text>
            );
          }
          return null;
        })}

        {/* Áreas de Hit Invisíveis para Tooltip e Seleção de Clique */}
        {days.map((d, i) => (
          <rect
            key={`hit-${i}`}
            x={pl + i * gw}
            y={pt}
            width={gw}
            height={ph + pb}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => setSelectedKey(keyFromDate(d.date))}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltipData({
                x: rect.left + rect.width / 2,
                y: rect.top - 10,
                day: d,
                ma: getMA7(d),
              });
            }}
            onMouseLeave={() => setTooltipData(null)}
          />
        ))}
      </svg>
    );
  };

  if (authLoading || !userData || !isLeaderOrAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        {/* App Sidebar Rail (52px) */}
        <div className="app-sidebar">
          <Sidebar />
        </div>

        {/* Conteúdo Principal com Topbar */}
        <div className="flex-1 flex flex-col pl-0 md:pl-[52px] min-w-0 h-screen overflow-hidden">
          <div className="app-topbar">
            <Topbar />
          </div>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 main-content-area select-none" id="main-scroll">
            {/* ── Cabeçalho da Página (.page-head) ─────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-1 no-print">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                    % PD/PA na pesagem
                  </h1>
                </div>
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  Participação de PD/PA nas ordens entregues · clique em um dia no gráfico ou no ranking para ver e editar o detalhe
                </p>
              </div>

              {/* Toolbar de Ações e Período */}
              <div className="flex items-center gap-2 flex-wrap actions-panel">
                {/* Segmented de Período */}
                <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-2xs text-xs">
                  <button
                    type="button"
                    onClick={() => setPeriod('all')}
                    className={cn(
                      "h-8 px-3 font-medium transition-colors border-r border-[var(--border-strong)] cursor-pointer",
                      period === 'all' ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('7')}
                    className={cn(
                      "h-8 px-3 font-medium transition-colors border-r border-[var(--border-strong)] cursor-pointer",
                      period === '7' ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('15')}
                    className={cn(
                      "h-8 px-3 font-medium transition-colors border-r border-[var(--border-strong)] cursor-pointer",
                      period === '15' ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    15 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('30')}
                    className={cn(
                      "h-8 px-3 font-medium transition-colors border-r border-[var(--border-strong)] cursor-pointer",
                      period === '30' ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('mes')}
                    className={cn(
                      "h-8 px-3 font-medium transition-colors cursor-pointer",
                      period === 'mes' ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    Mês atual
                  </button>
                </div>

                {/* Segmented de Compartilhamento */}
                <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-2xs text-xs">
                  {/* <button
                    type="button"
                    onClick={handleExportWhatsApp}
                    className="h-8 px-2.5 font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] border-r border-[var(--border-strong)] flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copia resumo em texto para colar no WhatsApp"
                  >
                    <svg className="w-3.5 h-3.5 text-[#25D366] stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
                    </svg>
                    <span>WhatsApp</span>
                  </button> */}

                  <button
                    type="button"
                    onClick={handleGenerateImage}
                    className="h-8 px-2.5 font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] border-r border-[var(--border-strong)] flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Gera uma imagem do painel para copiar ou baixar"
                  >
                    <ImageIcon size={13} />
                    <span>Imagem</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleCaptureMode}
                    className={cn(
                      "h-8 px-2.5 font-medium border-r border-[var(--border-strong)] flex items-center gap-1.5 transition-colors cursor-pointer",
                      isCaptureMode ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
                    )}
                    title="Tela limpa para print (Esc para sair)"
                  >
                    <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
                    </svg>
                    <span>Captura</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-8 px-2.5 font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Imprimir ou salvar em PDF"
                  >
                    <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                      <path d="M6 9V3h12v6" />
                      <rect x="3" y="9" width="18" height="8" rx="1" />
                      <path d="M6 14h12v7H6z" />
                    </svg>
                    <span>PDF</span>
                  </button>
                </div>

                {/* Botão Zerar (Admin) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsClearingAll(true)}
                    className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--red)] hover:border-[var(--red)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Zerar dados de histórico"
                  >
                    <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                    <span>Zerar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Container Relatório Capturável */}
            <div id="report-panel" className="space-y-4">
              {/* ── Carimbo de Captura / Impressão (.print-head) ───────────────────── */}
              <div className="hidden print:flex flex-col border-b-2 border-[var(--text)] pb-2 mb-3">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-base font-bold">Heijunka · % PD/PA na pesagem</h1>
                    <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                      Período: {periodLabel}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-[var(--text-3)] font-mono leading-relaxed">
                    Emitido em {formatDM(nowDate)} às {pad(nowDate.getHours())}:{pad(nowDate.getMinutes())}
                  </div>
                </div>
              </div>

            {/* ── 1. Indicadores Chave / KPIs (.kpis) ───────────────────────────── */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
              {recordStats ? (
                <>
                  {/* KPI 1: Recorde Atual */}
                  <div
                    onClick={() => setSelectedKey(keyFromDate(recordStats.best.date))}
                    className="p-4 md:p-4.5 border-b sm:border-b-0 sm:border-r border-[var(--border)] min-w-0 flex flex-col justify-between cursor-pointer hover:bg-[var(--hover)] transition-colors group"
                    title="Clique para ver detalhes do recorde atual"
                  >
                    <div>
                      <div className="flex justify-between items-center text-xs text-[var(--text-3)] mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--accent)]">Recorde Atual</span>
                        <span className="text-[11px] font-mono">{formatDM(recordStats.best.date)}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <strong className="text-3xl font-semibold font-mono tracking-tight leading-none text-[var(--accent)]">
                          {p0(dayPct(recordStats.best))}
                        </strong>
                        <span className="text-xs text-[var(--text-3)] font-mono">
                          {dayPdPa(recordStats.best)} vol. PD/PA
                        </span>
                      </div>
                      {/* Barra visual de progresso */}
                      <div className="h-1.5 w-full bg-[var(--track)] rounded-full relative overflow-visible mb-2.5">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(dayPct(recordStats.best), 100)}%` }}
                        />
                        <b
                          className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text-2)] rounded-full"
                          style={{ left: `calc(${META}% - 1px)` }}
                          title={`Meta ${META}%`}
                        />
                      </div>
                    </div>
                    <div className="text-[11.5px] text-[var(--text-3)] leading-relaxed pt-1 border-t border-[var(--border)]/60 flex items-center justify-between">
                      <span>Total de ordens: <b className="font-mono text-[var(--text-2)]">{dayTotal(recordStats.best)}</b></span>
                      {dayTotal(recordStats.best) < recordStats.avgTot * VOL_BAIXO && (
                        <span className="text-[10px] font-semibold text-[var(--amber)] border border-[var(--border-strong)] rounded px-1">
                          vol. baixo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* KPI 2: Recorde Anterior */}
                  <div
                    onClick={() => setSelectedKey(keyFromDate(recordStats.second.date))}
                    className="p-4 md:p-4.5 border-b sm:border-b-0 sm:border-r border-[var(--border)] min-w-0 flex flex-col justify-between cursor-pointer hover:bg-[var(--hover)] transition-colors group"
                    title="Clique para ver detalhes do recorde anterior"
                  >
                    <div>
                      <div className="flex justify-between items-center text-xs text-[var(--text-3)] mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-2)]">Recorde Anterior</span>
                        <span className="text-[11px] font-mono">{formatDM(recordStats.second.date)}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <strong className="text-3xl font-semibold font-mono tracking-tight leading-none text-[var(--text)]">
                          {p0(dayPct(recordStats.second))}
                        </strong>
                        <span className="text-xs text-[var(--text-3)] font-mono">
                          {dayPdPa(recordStats.second)} vol. PD/PA
                        </span>
                      </div>
                      {/* Barra visual de progresso */}
                      <div className="h-1.5 w-full bg-[var(--track)] rounded-full relative overflow-visible mb-2.5">
                        <div
                          className="h-full bg-[var(--accent-2)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(dayPct(recordStats.second), 100)}%` }}
                        />
                        <b
                          className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text-2)] rounded-full"
                          style={{ left: `calc(${META}% - 1px)` }}
                          title={`Meta ${META}%`}
                        />
                      </div>
                    </div>
                    <div className="text-[11.5px] text-[var(--text-3)] leading-relaxed pt-1 border-t border-[var(--border)]/60 flex items-center justify-between">
                      <span>Total de ordens: <b className="font-mono text-[var(--text-2)]">{dayTotal(recordStats.second)}</b></span>
                      <span className="font-mono text-[11px] text-[var(--text-3)]">2º melhor marca</span>
                    </div>
                  </div>

                  {/* KPI 3: Maior Volume PD/PA */}
                  <div
                    onClick={() => setSelectedKey(keyFromDate(recordStats.maxPd.date))}
                    className="p-4 md:p-4.5 border-b sm:border-b-0 sm:border-r border-[var(--border)] min-w-0 flex flex-col justify-between cursor-pointer hover:bg-[var(--hover)] transition-colors group"
                    title="Clique para ver detalhes do maior volume PD/PA"
                  >
                    <div>
                      <div className="flex justify-between items-center text-xs text-[var(--text-3)] mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-2)]">Maior Vol. PD/PA</span>
                        <span className="text-[11px] font-mono">{formatDM(recordStats.maxPd.date)}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <strong className="text-3xl font-semibold font-mono tracking-tight leading-none text-[var(--text)]">
                          {dayPdPa(recordStats.maxPd)}
                        </strong>
                        <span className="text-xs text-[var(--text-3)] font-mono">
                          {p0(dayPct(recordStats.maxPd))} no dia
                        </span>
                      </div>
                      {/* Barra visual de progresso */}
                      <div className="h-1.5 w-full bg-[var(--track)] rounded-full relative overflow-visible mb-2.5">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(dayPct(recordStats.maxPd), 100)}%` }}
                        />
                        <b
                          className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text-2)] rounded-full"
                          style={{ left: `calc(${META}% - 1px)` }}
                          title={`Meta ${META}%`}
                        />
                      </div>
                    </div>
                    <div className="text-[11.5px] text-[var(--text-3)] leading-relaxed pt-1 border-t border-[var(--border)]/60 flex items-center justify-between">
                      <span>Total: <b className="font-mono text-[var(--text-2)]">{dayTotal(recordStats.maxPd)} ordens</b></span>
                      <span className="text-[11px] text-[var(--text-3)]">pico de produção</span>
                    </div>
                  </div>

                  {/* KPI 4: Maior Volume Total */}
                  <div
                    onClick={() => setSelectedKey(keyFromDate(recordStats.maxTot.date))}
                    className="p-4 md:p-4.5 min-w-0 flex flex-col justify-between cursor-pointer hover:bg-[var(--hover)] transition-colors group"
                    title="Clique para ver detalhes do maior volume total"
                  >
                    <div>
                      <div className="flex justify-between items-center text-xs text-[var(--text-3)] mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-2)]">Maior Vol. Total</span>
                        <span className="text-[11px] font-mono">{formatDM(recordStats.maxTot.date)}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <strong className="text-3xl font-semibold font-mono tracking-tight leading-none text-[var(--text)]">
                          {dayTotal(recordStats.maxTot)}
                        </strong>
                        <span className="text-xs text-[var(--text-3)] font-mono">
                          {dayPdPa(recordStats.maxTot)} PD/PA ({p0(dayPct(recordStats.maxTot))})
                        </span>
                      </div>
                      {/* Barra visual de progresso */}
                      <div className="h-1.5 w-full bg-[var(--track)] rounded-full relative overflow-visible mb-2.5">
                        <div
                          className="h-full bg-[var(--accent-2)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(dayPct(recordStats.maxTot), 100)}%` }}
                        />
                        <b
                          className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text-2)] rounded-full"
                          style={{ left: `calc(${META}% - 1px)` }}
                          title={`Meta ${META}%`}
                        />
                      </div>
                    </div>
                    <div className="text-[11.5px] text-[var(--text-3)] leading-relaxed pt-1 border-t border-[var(--border)]/60 flex items-center justify-between">
                      <span>Manual: <b className="font-mono text-[var(--text-2)]">{dayTotal(recordStats.maxTot) - dayPdPa(recordStats.maxTot)}</b></span>
                      <span className="text-[11px] text-[var(--text-3)]">capacidade máxima</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-xs text-[var(--text-3)] col-span-4 text-center">
                  Sem histórico suficiente
                </div>
              )}
            </section>

            {/* ── 2. Grid Principal: Gráfico Diário + Detalhe do Dia ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] gap-4">
              {/* Card do Gráfico Diário */}
              <section className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs flex flex-col">
                <div className="flex items-center justify-between gap-2.5 px-4 py-3 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-[13px] font-semibold text-[var(--text)]">
                      Pesagem diária · manuais e PD/PA
                    </h2>
                    <div className="text-xs text-[var(--text-3)] mt-0.5">
                      {periodDays.length ? `${formatDM(periodDays[0].date)} a ${formatDM(periodDays[periodDays.length - 1].date)} · barras = ordens entregues no dia` : ''}
                    </div>
                  </div>

                  {/* Legenda do Gráfico */}
                  <div className="flex items-center gap-3 text-[11.5px] text-[var(--text-3)] flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <i className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent)] inline-block" />
                      <span>PD/PA</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="w-2.5 h-2.5 rounded-[2px] bg-[var(--bar)] inline-block" />
                      <span>Manual</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="w-3.5 h-[2px] rounded-[1px] bg-[var(--amber)] inline-block" />
                      <span>% PD/PA</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="w-3.5 h-0 border-t-[1.5px] border-dashed border-[var(--text-2)] inline-block" />
                      <span>Média 7d</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="w-3.5 h-[2px] bg-[var(--red)] opacity-70 inline-block" />
                      <span>Meta</span>
                    </span>
                  </div>
                </div>

                {/* Renderização do SVG */}
                <div className="p-3 pt-2 relative">
                  {renderSvgChart()}
                </div>
              </section>

              {/* Card do Detalhe e Edição do Dia (.card#detail) */}
              <section className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs flex flex-col justify-between">
                {activeSelectedDay ? (
                  <>
                    {/* Header do Detalhe */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                      <div>
                        <h2 className="text-[13px] font-semibold text-[var(--text)]">
                          {DIAS_EXTENSO[activeSelectedDay.date.getDay()]}, {formatDM(activeSelectedDay.date)}
                          {activeSelectedDay.partial && (
                            <span className="text-[var(--text-3)] font-normal text-xs ml-1.5">
                              · em andamento
                            </span>
                          )}
                        </h2>
                        <div className="text-xs text-[var(--text-3)] mt-0.5">
                          Detalhe do dia · valores editáveis
                        </div>
                      </div>

                      {/* Botões de Navegação Dia Anterior / Próximo */}
                      <div className="flex items-center gap-1 no-print">
                        <button
                          type="button"
                          onClick={() => handleNavDay('prev')}
                          disabled={periodDays.indexOf(activeSelectedDay) <= 0}
                          className="w-6.5 h-6.5 rounded-[4px] border border-[var(--border-strong)] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-35 disabled:cursor-default transition-colors cursor-pointer"
                          title="Dia anterior (←)"
                        >
                          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                            <path d="m15 6-6 6 6 6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavDay('next')}
                          disabled={periodDays.indexOf(activeSelectedDay) >= periodDays.length - 1}
                          className="w-6.5 h-6.5 rounded-[4px] border border-[var(--border-strong)] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-35 disabled:cursor-default transition-colors cursor-pointer"
                          title="Próximo dia (→)"
                        >
                          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* KPI do Dia Selecionado */}
                    <div className="p-4 border-b border-[var(--border)]">
                      <div className="flex items-baseline gap-2 mb-2">
                        <strong className={cn("text-3xl font-semibold font-mono tracking-tight", isOk(dayPct(activeSelectedDay)) ? "text-[var(--text)]" : "text-[var(--red)]")}>
                          {dayTotal(activeSelectedDay) ? p0(dayPct(activeSelectedDay)) : '—'}
                        </strong>
                        <span className="text-xs text-[var(--text-3)] font-mono">
                          {dayPdPa(activeSelectedDay)} PD/PA de {dayTotal(activeSelectedDay)} ordens
                        </span>
                      </div>

                      <div className="h-1.5 w-full bg-[var(--track)] rounded-full relative overflow-visible mb-2">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(dayPct(activeSelectedDay), 100)}%` }}
                        />
                        <b
                          className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text-2)] rounded-full"
                          style={{ left: `calc(${META}% - 1px)` }}
                        />
                      </div>

                      <div className="text-xs text-[var(--text-3)] leading-relaxed">
                        {activeSelectedDay.partial ? (
                          'Dia em andamento — não entra nas médias e recordes'
                        ) : dayTotal(activeSelectedDay) > 0 ? (
                          <>
                            <b className={cn("font-medium", dayPct(activeSelectedDay) - currentAgg.pct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                              {pp1(dayPct(activeSelectedDay) - currentAgg.pct)}
                            </b>{' '}
                            vs média do período ({p0(currentAgg.pct)}) · {isOk(dayPct(activeSelectedDay)) ? 'na meta' : 'abaixo da meta'}
                          </>
                        ) : (
                          'Sem entregas registradas'
                        )}
                      </div>
                    </div>

                    {/* Tabela de Edição por Turno */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-[var(--surface-2)] text-[var(--text-3)] border-b border-[var(--border)]">
                            <th className="text-left font-medium py-2 px-3.5">Turno</th>
                            <th className="text-right font-medium py-2 px-2">Manual</th>
                            <th className="text-right font-medium py-2 px-2">PA</th>
                            <th className="text-right font-medium py-2 px-2">PD</th>
                            <th className="text-right font-medium py-2 px-2">Total</th>
                            <th className="text-right font-medium py-2 px-3.5">% PD/PA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {activeSelectedDay.t.map((row, idx) => {
                            const rowTotal = row.man + row.pa + row.pd;
                            const rowPct = pct(row.pa + row.pd, rowTotal);

                            return (
                              <tr key={idx} className="hover:bg-[var(--hover)] transition-colors">
                                <td className="py-1.5 px-3.5 font-medium text-[var(--text)] whitespace-nowrap">
                                  {TURNOS_NOMES[idx]}
                                </td>
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.man}
                                    onChange={(e) => handleUpdateDayValue(idx, 'man', e.target.value)}
                                    className="w-12 h-6 text-right px-1.5 rounded border border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent)] bg-transparent font-mono text-[12.5px] text-[var(--text)] outline-none"
                                  />
                                </td>
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.pa}
                                    onChange={(e) => handleUpdateDayValue(idx, 'pa', e.target.value)}
                                    className="w-12 h-6 text-right px-1.5 rounded border border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent)] bg-transparent font-mono text-[12.5px] text-[var(--text)] outline-none"
                                  />
                                </td>
                                <td className="py-1 px-1.5 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.pd}
                                    onChange={(e) => handleUpdateDayValue(idx, 'pd', e.target.value)}
                                    className="w-12 h-6 text-right px-1.5 rounded border border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent)] bg-transparent font-mono text-[12.5px] text-[var(--text)] outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono font-semibold text-[var(--text)]">
                                  {rowTotal}
                                </td>
                                <td className={cn("py-1.5 px-3.5 text-right font-mono font-semibold", isOk(rowPct) ? "text-[var(--text)]" : "text-[var(--red)]")}>
                                  {rowTotal > 0 ? p0(rowPct) : '—'}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Linha Totalizador do Dia */}
                          <tr className="bg-[var(--surface-2)] font-semibold text-[var(--text)]">
                            <td className="py-2 px-3.5">Dia</td>
                            <td className="py-2 px-2 text-right font-mono font-medium">
                              {activeSelectedDay.t.reduce((a, b) => a + b.man, 0)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-medium">
                              {activeSelectedDay.t.reduce((a, b) => a + b.pa, 0)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-medium">
                              {activeSelectedDay.t.reduce((a, b) => a + b.pd, 0)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold">
                              {dayTotal(activeSelectedDay)}
                            </td>
                            <td className={cn("py-2 px-3.5 text-right font-mono font-bold", isOk(dayPct(activeSelectedDay)) ? "text-[var(--text)]" : "text-[var(--red)]")}>
                              {dayTotal(activeSelectedDay) > 0 ? p0(dayPct(activeSelectedDay)) : '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Rodapé Informativo */}
                    <div className="px-4 py-2.5 text-xs text-[var(--text-3)] border-t border-[var(--border)] flex items-center justify-between">
                      <span>Alterações recalculam o painel na hora.</span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setDayToDelete(activeSelectedDay);
                            setDeleteConfirmText('');
                          }}
                          className="text-[var(--text-3)] hover:text-[var(--red)] transition-colors cursor-pointer text-[11px]"
                          title="Excluir dia inteiro"
                        >
                          Excluir dia
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--text-3)]">
                    Selecione um dia no gráfico para ver detalhes.
                  </div>
                )}
              </section>
            </div>

            {/* ── 3. Grid Inferior de 3 Colunas ─────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Por Turno */}
              <section className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                  <h2 className="text-[13px] font-semibold text-[var(--text)]">Por turno</h2>
                  <div className="flex items-center gap-2.5 text-[11px] text-[var(--text-3)]">
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-xs bg-[var(--accent)]" />PA</span>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-xs bg-[var(--accent-2)]" />PD</span>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-xs bg-[var(--bar)]" />Manual</span>
                  </div>
                </div>

                <div className="p-4 space-y-3.5">
                  {turnosBreakdown.list.concat([turnosBreakdown.all]).map((o, idx) => {
                    const isAll = idx === 3;
                    const w = (v: number) => (o.total > 0 ? (v / o.total) * 100 : 0);

                    return (
                      <div key={idx} className={cn("space-y-1.5", isAll && "pt-2 border-t border-[var(--border-strong)]")}>
                        <div className="flex justify-between items-baseline text-xs">
                          <b className="font-semibold text-[var(--text)]">{o.label}</b>
                          <span className={cn("font-mono font-semibold", isOk(o.pct) ? "text-[var(--text)]" : "text-[var(--red)]")}>
                            {o.total > 0 ? p0(o.pct) : '—'}
                            {o === turnosBreakdown.bestTurno && o.total > 0 && (
                              <span className="text-[10.5px] text-[var(--text-3)] font-normal ml-1.5">melhor</span>
                            )}
                          </span>
                        </div>

                        {/* Barra Empilhada */}
                        <div className="h-3 rounded-[3px] bg-[var(--track)] flex overflow-hidden relative">
                          <div style={{ width: `${w(o.pa)}%` }} className="bg-[var(--accent)] h-full transition-all" />
                          <div style={{ width: `${w(o.pd)}%` }} className="bg-[var(--accent-2)] h-full transition-all" />
                          <div style={{ width: `${w(o.man)}%` }} className="bg-[var(--bar)] h-full transition-all" />
                          <b
                            className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text)]"
                            style={{ left: `calc(${META}% - 1px)` }}
                            title="Meta"
                          />
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)] font-mono">
                          <span>PA {formatNumber(o.pa)}</span>
                          <span>PD {formatNumber(o.pd)}</span>
                          <span>Manual {formatNumber(o.man)}</span>
                          <span className="ml-auto font-medium text-[var(--text-2)]">{formatNumber(o.total)} ordens</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Card 2: Mês a Mês */}
              <section className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                  <h2 className="text-[13px] font-semibold text-[var(--text)]">Mês a mês</h2>
                  <span className="text-xs text-[var(--text-3)]">dias completos</span>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--surface-2)] text-[var(--text-3)] border-b border-[var(--border)]">
                        <th className="text-left font-medium py-2 px-3.5">Mês</th>
                        <th className="text-right font-medium py-2 px-2">Ordens</th>
                        <th className="text-right font-medium py-2 px-2">PD/PA</th>
                        <th className="text-right font-medium py-2 px-3.5">% PD/PA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {monthlyBreakdown.map((m, idx) => (
                        <tr key={idx} className="hover:bg-[var(--hover)] transition-colors">
                          <td className="py-2.5 px-3.5 font-medium text-[var(--text)]">
                            {m.monthName}
                            {m.isCurrentMonth && (
                              <span className="text-[11px] text-[var(--text-3)] font-normal ml-1">
                                até {m.lastDayStr}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-[var(--text-2)]">{formatNumber(m.total)}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-[var(--text-2)]">{formatNumber(m.pdpa)}</td>
                          <td className="py-2.5 px-3.5 text-right font-mono">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-[var(--track)] rounded-full relative overflow-visible">
                                <div
                                  className="h-full bg-[var(--accent)] rounded-full"
                                  style={{ width: `${Math.min(m.pct, 100)}%` }}
                                />
                                <b
                                  className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text-2)]"
                                  style={{ left: `calc(${META}% - 1px)` }}
                                />
                              </div>
                              <span className={cn("font-semibold", isOk(m.pct) ? "text-[var(--text)]" : "text-[var(--red)]")}>
                                {p0(m.pct)}
                              </span>
                            </div>
                            {m.delta !== null && (
                              <div className={cn("text-[10.5px] mt-0.5", m.delta >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                                {pp1(m.delta)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Card 3: Pontos de Atenção (Insights Operacionais Automáticos) */}
              <section className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                  <h2 className="text-[13px] font-semibold text-[var(--text)]">Pontos de atenção</h2>
                  <span className="text-xs text-[var(--text-3)]">automático</span>
                </div>

                <div className="divide-y divide-[var(--border)] overflow-y-auto flex-1">
                  {operationalInsights.length > 0 ? (
                    operationalInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        onClick={() => insight.dayKey && setSelectedKey(insight.dayKey)}
                        className={cn(
                          "grid grid-cols-[8px_1fr] gap-2.5 p-3.5 transition-colors",
                          insight.dayKey && "cursor-pointer hover:bg-[var(--hover)]"
                        )}
                      >
                        <i
                          style={{ backgroundColor: insight.color }}
                          className="w-2 h-2 rounded-full mt-1 shrink-0"
                        />
                        <div>
                          <b className="font-semibold text-xs text-[var(--text)] block leading-tight">
                            {insight.title}
                          </b>
                          <p className="text-[11.5px] text-[var(--text-3)] mt-1 leading-relaxed">
                            {insight.desc}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-[var(--text-3)]">
                      Nenhum desvio detectado no período.
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── 4. Ranking / Pódio de Desempenho por % PD/PA (.card.rk) ────── */}
            <section className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h2 className="text-[13px] font-semibold text-[var(--text)]">
                  Pódio de Desempenho por % PD/PA
                </h2>

                {/* Segmented Melhores / Piores */}
                <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden text-xs no-print">
                  <button
                    type="button"
                    onClick={() => setRankingMode('best')}
                    className={cn(
                      "h-7 px-3 font-medium transition-colors border-r border-[var(--border-strong)] cursor-pointer",
                      rankingMode === 'best' ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    Melhores
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingMode('worst')}
                    className={cn(
                      "h-7 px-3 font-medium transition-colors cursor-pointer",
                      rankingMode === 'worst' ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    Piores
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-2)] text-[var(--text-3)] border-b border-[var(--border)]">
                      <th className="w-14 text-center font-medium py-2 px-3">#</th>
                      <th className="text-left font-medium py-2 px-3">Dia</th>
                      <th className="text-right font-medium py-2 px-2">Ordens</th>
                      <th className="text-right font-medium py-2 px-2">PD/PA</th>
                      <th className="text-right font-medium py-2 px-2">Manual</th>
                      <th className="text-right font-medium py-2 px-3">% PD/PA</th>
                      <th className="text-right font-medium py-2 px-4 w-48">vs meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rankingList.map(({ day, pct: rowPct, total, pdpa: rowPdpa, manual, isLowVolume }, idx) => {
                      const isSel = keyFromDate(day.date) === selectedKey;

                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedKey(keyFromDate(day.date))}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSel ? "bg-[var(--accent-weak)] text-[var(--text)] font-semibold" : "hover:bg-[var(--hover)]"
                          )}
                        >
                          <td className="text-center py-2.5 px-3">
                            <span
                              className={cn(
                                "w-5 h-5 rounded-full inline-grid place-items-center font-mono text-[10.5px] border border-[var(--border-strong)]",
                                idx === 0 ? "border-[var(--text)] text-[var(--text)] font-bold bg-[var(--surface-2)]" : "text-[var(--text-3)]"
                              )}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[var(--text)]">
                            {DIAS[day.date.getDay()]}, {formatDM(day.date)}
                            {isLowVolume && (
                              <span className="ml-1.5 text-[10px] font-semibold text-[var(--amber)] border border-[var(--border-strong)] rounded px-1">
                                volume baixo
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-[var(--text-2)]">{total}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-[var(--text-2)]">{rowPdpa}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-[var(--text-2)]">{manual}</td>
                          <td className={cn("py-2.5 px-3 text-right font-mono font-semibold", isOk(rowPct) ? "text-[var(--text)]" : "text-[var(--red)]")}>
                            {p0(rowPct)}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className={cn("font-mono text-[11px]", isOk(rowPct) ? "text-[var(--green)]" : "text-[var(--red)]")}>
                                {pp1(rowPct - META)}
                              </span>
                              <div className="w-24 h-1.5 bg-[var(--track)] rounded-full relative overflow-visible">
                                <div
                                  className="h-full bg-[var(--accent)] rounded-full"
                                  style={{ width: `${Math.min(rowPct, 100)}%` }}
                                />
                                <b
                                  className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--text-2)]"
                                  style={{ left: `calc(${META}% - 1px)` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
      </div>

      {/* Tooltip Flutuante do Gráfico Diário */}
      {tooltipData && (
        <div
          style={{ left: `${tooltipData.x}px`, top: `${tooltipData.y}px` }}
          className="fixed z-50 -translate-x-1/2 -translate-y-full mb-2 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[6px] p-2.5 shadow-xl text-xs min-w-[170px] pointer-events-none animate-fade-in"
        >
          <b className="block font-semibold text-[var(--text)] mb-1">
            {DIAS[tooltipData.day.date.getDay()]}, {formatDM(tooltipData.day.date)}
            {tooltipData.day.partial && <span className="text-[var(--text-3)] font-normal ml-1">· parcial</span>}
          </b>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11.5px]">
            <dt className="text-[var(--text-3)]">Ordens:</dt>
            <dd className="font-mono text-right text-[var(--text)]">{dayTotal(tooltipData.day)}</dd>
            <dt className="text-[var(--text-3)]">PD/PA:</dt>
            <dd className="font-mono text-right text-[var(--text)]">{dayPdPa(tooltipData.day)}</dd>
            <dt className="text-[var(--text-3)]">Manual:</dt>
            <dd className="font-mono text-right text-[var(--text)]">{dayTotal(tooltipData.day) - dayPdPa(tooltipData.day)}</dd>
            <dt className="text-[var(--text-3)]">% PD/PA:</dt>
            <dd className="font-mono text-right font-semibold text-[var(--accent)]">
              {dayTotal(tooltipData.day) > 0 ? p0(dayPct(tooltipData.day)) : '—'}
            </dd>
            {tooltipData.ma != null && !tooltipData.day.partial && (
              <>
                <dt className="text-[var(--text-3)]">Média 7d:</dt>
                <dd className="font-mono text-right text-[var(--text-2)]">{p0(tooltipData.ma)}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Diálogo de Confirmação para Zerar Todo o Histórico */}
      <AlertDialog open={isClearingAll} onOpenChange={setIsClearingAll}>
        <AlertDialogContent className="border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold text-[var(--red)]">
              Zerar Histórico do Heijunka?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[var(--text-3)]">
              Esta ação excluirá todos os snapshots históricos de nivelamento Heijunka. Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs font-medium">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="h-8 text-xs font-semibold bg-[var(--red)] text-white hover:bg-[var(--red)]/90"
            >
              Confirmar e Zerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmação para Excluir Dia Específico */}
      <AlertDialog
        open={dayToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingDay) {
            setDayToDelete(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <AlertDialogContent className="border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold text-[var(--red)]">
              Excluir Dia de Produção?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[var(--text-3)]">
              Esta ação removerá todos os registros do dia{' '}
              <b className="text-[var(--text)]">{dayToDelete ? formatDM(dayToDelete.date) : ''}</b>.
              Digite <span className="font-mono font-bold text-[var(--text)]">EXCLUIR</span> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="font-mono uppercase text-xs"
            disabled={deletingDay}
          />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDay} className="h-8 text-xs font-medium">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteDay();
              }}
              disabled={deletingDay || deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'}
              className="h-8 text-xs font-semibold bg-[var(--red)] text-white hover:bg-[var(--red)]/90"
            >
              {deletingDay ? 'Excluindo...' : 'Excluir Dia'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
