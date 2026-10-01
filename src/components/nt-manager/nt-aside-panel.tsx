"use client";

import { useMemo } from 'react';
import { NT } from '@/types';
import { ChevronRight } from 'lucide-react';
import { useTimelineFirebase, TimelinePaidItem } from '@/hooks/useTimelineFirebase';

function dur(min: number): string {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

function pad(n: number) { return (n < 10 ? '0' : '') + n; }
function hm(d: Date) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

function parseDate(dateStr?: string | null, timeStr?: string | null, timestamp?: any): Date | null {
  if (timestamp) {
    if (timestamp instanceof Date && !isNaN(timestamp.getTime())) return timestamp;
    if (typeof timestamp.toDate === 'function') {
      const d = timestamp.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (!dateStr || typeof dateStr !== 'string') return null;
  if (dateStr.includes('T') || (dateStr.includes('-') && dateStr.length >= 10 && !dateStr.includes('/'))) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  let day = 1, month = 1, year = 1970;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/').map(Number);
    if (parts.length === 3) [day, month, year] = parts;
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3) {
      if (parts[0] > 1000) [year, month, day] = parts;
      else [day, month, year] = parts;
    }
  }
  let hours = 0, minutes = 0;
  if (timeStr && typeof timeStr === 'string') {
    const tParts = timeStr.split(':').map(Number);
    if (!isNaN(tParts[0])) hours = tParts[0];
    if (!isNaN(tParts[1])) minutes = tParts[1];
  }
  const d = new Date(year, month - 1, day, hours, minutes);
  return isNaN(d.getTime()) ? null : d;
}

function parsePaidDate(paymentTime?: string | null, created?: Date | null, updatedAt?: any): Date | null {
  if (paymentTime && typeof paymentTime === 'string') {
    const pt = paymentTime.trim();
    if (pt.includes('T') || (pt.includes('-') && pt.length >= 10)) {
      const d = new Date(pt);
      if (!isNaN(d.getTime())) return d;
    }
    const match = pt.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const base = created ? new Date(created.getTime()) : new Date();
      base.setHours(h, m, 0, 0);
      if (created && base.getTime() < created.getTime()) {
        base.setDate(base.getDate() + 1);
      }
      return base;
    }
  }
  if (updatedAt) {
    return parseDate(null, null, updatedAt);
  }
  return null;
}

interface NTAsidePanelProps {
  nts: NT[];
}

export const NTAsidePanel = ({ nts }: NTAsidePanelProps) => {
  const { paidItems, loading, stats } = useTimelineFirebase();

  // Calcular métricas (Pagos hoje, Tempo médio, Mais rápido, Mais lento)
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isSameDay = (d: Date) =>
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();

    interface ItemTiming {
      id?: string;
      durationMin: number;
      isToday: boolean;
    }

    const timings: ItemTiming[] = [];
    const seenIds = new Set<string>();

    // 1. Processar itens de nts recebidos por props
    if (nts && nts.length > 0) {
      nts.forEach(nt => {
        (nt.items || []).forEach(it => {
          if (it.status === 'Pago' || it.status === 'Pago Parcial') {
            const created = parseDate(it.created_date, it.created_time, it.created_at) ||
                            parseDate(nt.created_date, nt.created_time, nt.created_at);
            const paid = parsePaidDate(it.payment_time, created, it.updated_at);
            const isToday = paid ? isSameDay(paid) : false;

            if (created && paid) {
              const diffMs = paid.getTime() - created.getTime();
              const durationMin = Math.max(0, Math.floor(diffMs / 60000));
              if (it.id) seenIds.add(it.id);
              timings.push({ id: it.id, durationMin, isToday });
            }
          }
        });
      });
    }

    // 2. Processar itens do live feed do Firebase (se não processados ainda)
    if (paidItems && paidItems.length > 0) {
      paidItems.forEach(it => {
        if ((it.status === 'Pago' || it.status === 'Pago Parcial') && (!it.id || !seenIds.has(it.id))) {
          let durationMin: number | null = null;
          if (it.elapsedTime && it.elapsedTime !== '-') {
            const parts = it.elapsedTime.split('h ');
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(h) && !isNaN(m)) {
              durationMin = h * 60 + m;
            }
          }

          const isToday = it.paid_at instanceof Date && !isNaN(it.paid_at.getTime())
            ? isSameDay(it.paid_at)
            : false;

          if (durationMin !== null) {
            if (it.id) seenIds.add(it.id);
            timings.push({ id: it.id, durationMin, isToday });
          }
        }
      });
    }

    // Priorizar itens pagos hoje
    const todayTimings = timings.filter(t => t.isToday);
    const activeTimings = todayTimings.length > 0 ? todayTimings : timings;

    // Contagem de hoje
    const completedCount = todayTimings.length > 0
      ? todayTimings.length
      : (stats?.totalPaidToday || paidItems.filter(i => i.status === 'Pago').length);

    let avgCycleTime = stats?.averagePaymentTime && stats.averagePaymentTime !== '-' && stats.averagePaymentTime !== '—'
      ? stats.averagePaymentTime : '—';
    let fastest = stats?.fastestPayment && stats.fastestPayment !== '-' && stats.fastestPayment !== '—'
      ? stats.fastestPayment : '—';
    let slowest = stats?.slowestPayment && stats.slowestPayment !== '-' && stats.slowestPayment !== '—'
      ? stats.slowestPayment : '—';
    let isSlowCritical = false;

    if (activeTimings.length > 0) {
      const times = activeTimings.map(t => t.durationMin);
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const mn = Math.min(...times);
      const mx = Math.max(...times);

      avgCycleTime = dur(avg);
      fastest = dur(mn);
      slowest = dur(mx);
      isSlowCritical = mx > 60; // Alerta se maior que SLA de 60 min
    }

    return {
      completedCount,
      avgCycleTime,
      fastest,
      slowest,
      isSlowCritical,
    };
  }, [nts, paidItems, stats]);

  return (
    <aside className="nt-aside">
      {/* .as-head */}
      <div className="as-head">
        <h2>Pesagem em tempo real</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live">
            <i />
            ao vivo
          </span>
        </div>
      </div>

      {/* .akpis 2x2 */}
      <div className="akpis">
        <div>
          <label>Pagos hoje</label>
          <strong>{kpis.completedCount}</strong>
        </div>
        <div>
          <label>Tempo médio</label>
          <strong>{kpis.avgCycleTime}</strong>
        </div>
        <div>
          <label>Mais rápido</label>
          <strong>{kpis.fastest}</strong>
        </div>
        <div>
          <label>Mais lento</label>
          <strong style={kpis.isSlowCritical ? { color: 'var(--red)' } : undefined}>
            {kpis.slowest}
          </strong>
        </div>
      </div>

      {/* Feed title */}
      <div className="feed-t">
        <span>Últimas pesagens</span>
        <span>{paidItems.length > 0 ? `últimos ${Math.min(paidItems.length, 40)}` : ''}</span>
      </div>

      {/* .feed */}
      <div className="feed">
        {loading && paidItems.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            Carregando eventos...
          </div>
        ) : paidItems.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            Nenhuma pesagem recente registrada.
          </div>
        ) : (
          paidItems.slice(0, 40).map((item: TimelinePaidItem, idx: number) => {
            const timeFormatted = item.paid_at instanceof Date && !isNaN(item.paid_at.getTime())
              ? hm(item.paid_at)
              : (item.payment_time || '--:--');

            const cleanDesc = (item.description || '').replace(/\*\*/g, '').trim();
            const isControlled = item.description?.includes('**');

            return (
              <div key={item.id || idx} className="ev">
                <time>{timeFormatted}</time>
                <span className="line" />
                <div className="body">
                  <div className="t">
                    <b>{item.code}</b> · {cleanDesc}
                    {isControlled && <span className="flag">Controlado</span>}
                  </div>
                  <div className="m">
                    <span>NT {item.nt_number}</span>
                    <span>{item.quantity} kg</span>
                    {item.elapsedTime && item.elapsedTime !== '-' && (
                      <span>{item.elapsedTime}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
