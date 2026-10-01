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

interface NTAsidePanelProps {
  nts: NT[];
}

export const NTAsidePanel = ({ nts }: NTAsidePanelProps) => {
  const { paidItems, loading, stats } = useTimelineFirebase();

  const completedCount = paidItems.filter((i: TimelinePaidItem) => i.status === 'Pago').length;
  const avgCycleTime = stats?.averagePaymentTime && stats.averagePaymentTime !== '-'
    ? stats.averagePaymentTime : '—';

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
          <strong>{completedCount}</strong>
        </div>
        <div>
          <label>Tempo médio</label>
          <strong>{avgCycleTime}</strong>
        </div>
        <div>
          <label>Mais rápido</label>
          <strong>—</strong>
        </div>
        <div>
          <label>Mais lento</label>
          <strong>—</strong>
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
            const timeFormatted = item.paid_at instanceof Date
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
