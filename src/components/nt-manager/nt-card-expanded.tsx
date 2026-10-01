"use client";

import { NT, NTItem } from '@/types';
import { useState } from 'react';
import { Copy, Check, Plus, Edit, Trash2 } from 'lucide-react';
import { NTItemRow } from './nt-item-row';
import { AddItemModal } from './add-item-modal';
import { parseDateTime, isItemDelayed, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const LATE_MIN = 120;

function dur(min: number): string {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

function pad(n: number) { return (n < 10 ? '0' : '') + n; }
function hm(d: Date) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

function ntCreatedDate(nt: NT): Date | null {
  try {
    const [day, month, year] = nt.created_date.split('/').map(Number);
    const timeParts = nt.created_time?.split(':').map(Number) || [0, 0];
    return new Date(year, month - 1, day, timeParts[0] || 0, timeParts[1] || 0);
  } catch { return null; }
}

function ageMin(nt: NT): number {
  const d = ntCreatedDate(nt);
  return d ? Math.max(0, (Date.now() - d.getTime()) / 60000) : 0;
}

function paidN(nt: NT): number {
  return (nt.items || []).filter(i => i.status === 'Pago').length;
}

function isDone(nt: NT): boolean {
  const items = nt.items || [];
  return items.length > 0 && items.every(i => i.status === 'Pago');
}

function shiftOf(nt: NT): number {
  const d = ntCreatedDate(nt);
  if (!d) return 1;
  const t = d.getHours() * 60 + d.getMinutes();
  const shifts = [
    { n: 3, a: 23 * 60 + 45, b: 7 * 60 + 20 },
    { n: 1, a: 7 * 60 + 20, b: 15 * 60 + 50 },
    { n: 2, a: 15 * 60 + 50, b: 23 * 60 + 45 },
  ];
  for (const s of shifts) {
    if (((t - s.a + 1440) % 1440) < ((s.b - s.a + 1440) % 1440)) return s.n;
  }
  return 1;
}

interface NTCardExpandedProps {
  nt: NT;
  hidePaid?: boolean;
  searchQuery?: string;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
}

export const NTCardExpanded = ({
  nt,
  hidePaid = false,
  searchQuery = '',
  onEdit,
  onDelete,
  onRefresh,
}: NTCardExpandedProps) => {
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaid, setShowPaid] = useState(false);

  const items = nt.items || [];
  const totalItems = items.length;
  const paid = paidN(nt);
  const progress = totalItems > 0 ? Math.round((paid / totalItems) * 100) : 0;
  const done = isDone(nt);
  const st = done ? { k: 'done' as const, l: 'Concluída' } : (() => {
    const p = paid;
    if (ageMin(nt) > LATE_MIN) return { k: 'late' as const, l: 'Em atraso' };
    return p > 0 ? { k: 'prog' as const, l: 'Em andamento' } : { k: 'wait' as const, l: 'Aguardando' };
  })();

  const created = ntCreatedDate(nt);

  // Build info text like concept
  const info = done
    ? `Pesagem · T${shiftOf(nt)} · criada ${nt.created_date}${nt.created_time ? ` às ${nt.created_time}` : ''}`
    : `Pesagem · T${shiftOf(nt)} · criada ${nt.created_date}${nt.created_time ? ` às ${nt.created_time}` : ''}`;

  const ageText = !done ? dur(ageMin(nt)) : '';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nt.nt_number);
    setCopied(true);
    toast.success(`NT ${nt.nt_number} copiada`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter items for display
  const shouldHidePaid = !done && hidePaid && !showPaid;
  const visibleItems = shouldHidePaid ? items.filter(i => i.status !== 'Pago') : items;
  const hiddenCount = shouldHidePaid ? items.filter(i => i.status === 'Pago').length : 0;

  return (
    <article
      className={cn(
        "ntb",
        st.k === 'late' && "late",
        st.k === 'prog' && "is-prog",
      )}
      id={`nt-${nt.nt_number}`}
    >
      {/* ── Header .ntb-h ── */}
      <header className="ntb-h">
        {/* 1. NT ID */}
        <div className="nid">
          <span className="num">{nt.nt_number}</span>
          <button type="button" className="copy" onClick={handleCopy} title="Copiar número">
            {copied ? <Check size={13} className="text-[var(--green)]" /> : <Copy size={13} />}
          </button>
          {(nt.items || []).some(i => i.priority) && (
            <span className="flag">Urgente</span>
          )}
        </div>

        {/* 2. Info */}
        <div className="ninfo">
          {info}
          {!done && ageText && (
            <>
              {' · '}
              <span className={st.k === 'late' ? 'late' : ''}>há {ageText}</span>
            </>
          )}
        </div>

        {/* 3. Progress bar */}
        <div className="prog">
          <div className="bar">
            <span className={progress === 100 ? 'full' : ''} style={{ width: `${progress}%` }} />
          </div>
          <span className="mono">{paid}/{totalItems} itens</span>
        </div>

        {/* 4. Status or lead time */}
        {done ? (
          <span className="lead">—</span>
        ) : (
          <span className={`st ${st.k}`}>
            <i />
            {st.l}
          </span>
        )}

        {/* 5. Actions (.nacts) */}
        <div className="nacts" onClick={e => e.stopPropagation()}>
          {!done && (
            <>
              <button type="button" onClick={() => setShowAddItemModal(true)} title="Adicionar item">
                <Plus size={14} />
              </button>
              <button type="button" onClick={onEdit} title="Editar">
                <Edit size={14} />
              </button>
              <button type="button" className="del" onClick={onDelete} title="Excluir NT">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Items Timeline .items ── */}
      <div className="items-timeline">
        {visibleItems.map((item) => (
          <NTItemRow
            key={item.id}
            item={item}
            nt={nt}
            onSuccess={onRefresh}
            searchQuery={searchQuery}
          />
        ))}
        {hiddenCount > 0 && (
          <div className="hidden-paid">
            {hiddenCount} {hiddenCount > 1 ? 'itens pagos ocultos' : 'item pago oculto'} ·{' '}
            <button type="button" onClick={() => setShowPaid(true)}>mostrar</button>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          open={showAddItemModal}
          onOpenChange={setShowAddItemModal}
          nt={nt}
          onSuccess={() => {
            setShowAddItemModal(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </article>
  );
};
