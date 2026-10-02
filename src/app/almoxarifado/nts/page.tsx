"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { NT, NTItem } from '@/types';
import { RefreshCw, Plus, Layers, Search } from 'lucide-react';
import { getNTs, subscribeToNTs, deleteNT } from '@/lib/firestore-helpers';
import { cn, parseDateTime, isItemDelayed } from '@/lib/utils';
import toast from 'react-hot-toast';
import { NTCardExpanded } from '@/components/nt-manager/nt-card-expanded';
import { NTSummary } from '@/components/nt-manager/nt-summary';
import { NTAsidePanel } from '@/components/nt-manager/nt-aside-panel';
import { AddNTModal } from '@/components/nt-manager/add-nt-modal';
import { AddBulkNTModal } from '@/components/nt-manager/add-bulk-nt-modal';
import { EditNTModal } from '@/components/nt-manager/edit-nt-modal';
import { DeleteConfirmationModal } from '@/components/nt-manager/delete-confirmation-modal';

/* ── helpers ────────────────────────────────────────── */
const LATE_MIN = 120; // NT aberta > 2h = em atraso

function dur(min: number): string {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

function pad(n: number) { return (n < 10 ? '0' : '') + n; }
function hm(d: Date) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function dm(d: Date) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }

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

type StKey = 'wait' | 'prog' | 'late' | 'done';
function stOpen(nt: NT): { k: StKey; l: string } {
  const p = paidN(nt);
  if (ageMin(nt) > LATE_MIN) return { k: 'late', l: 'Em atraso' };
  return p > 0 ? { k: 'prog', l: 'Em andamento' } : { k: 'wait', l: 'Aguardando' };
}

function shiftOf(nt: NT): number {
  const d = ntCreatedDate(nt);
  if (!d) return 1;
  const t = d.getHours() * 60 + d.getMinutes();
  const shifts = [
    { n: 3, a: 23 * 60 + 50, b: 7 * 60 + 20 },
    { n: 1, a: 7 * 60 + 20, b: 15 * 60 + 50 },
    { n: 2, a: 15 * 60 + 50, b: 23 * 60 + 50 },
  ];
  for (const s of shifts) {
    if (((t - s.a + 1440) % 1440) < ((s.b - s.a + 1440) % 1440)) return s.n;
  }
  return 1;
}

/* ── Component ──────────────────────────────────────── */
function NTManagerContent() {
  const [nts, setNts] = useState<NT[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ntToDelete, setNtToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedNT, setSelectedNT] = useState<NT | null>(null);
  const [spinning, setSpinning] = useState(false);
  const { user } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State matching the concept
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [fOpen, setFOpen] = useState<'all' | 'wait' | 'prog' | 'late'>('all');
  const [fDone, setFDone] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [q, setQ] = useState('');
  const [sortOpen, setSortOpen] = useState('new');
  const [sortDone, setSortDone] = useState('recent');
  const [hidePaid, setHidePaid] = useState(false);
  const qRef = useRef<HTMLInputElement>(null);

  // Auth
  useEffect(() => { if (!user) router.push('/login'); }, [user, router]);

  // URL check
  useEffect(() => {
    if (searchParams?.get('status') === 'concluida') setTab('done');
  }, [searchParams]);

  // Load NTs
  const fetchNTs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNTs();
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const recent = data.filter((nt: NT) => {
        if (!nt.created_date) return false;
        try {
          const [d, m, y] = nt.created_date.split('/').map(Number);
          return new Date(y, m - 1, d) >= twoDaysAgo;
        } catch { return true; }
      });
      setNts(recent);
    } catch { toast.error('Erro ao carregar as NTs'); }
    finally { setLoading(false); }
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToNTs(
      (data) => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const recent = data.filter((nt: NT) => {
          if (!nt.created_date) return false;
          try {
            const [d, m, y] = nt.created_date.split('/').map(Number);
            return new Date(y, m - 1, d) >= twoDaysAgo;
          } catch { return true; }
        });
        setNts(recent);
        setLoading(false);
      },
      () => toast.error('Erro na atualização em tempo real')
    );
    return () => unsub();
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (/INPUT|SELECT|TEXTAREA/.test(tag || '')) {
        if (e.key === 'Escape') (document.activeElement as HTMLElement)?.blur();
        return;
      }
      if (e.key === '/') { e.preventDefault(); qRef.current?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Derived / filtered list
  const filtered = useMemo(() => {
    let L: NT[];
    if (tab === 'open') {
      L = nts.filter(n => !isDone(n) && (fOpen === 'all' || stOpen(n).k === fOpen));
    } else {
      L = nts.filter(n => isDone(n));
      // period filter for done tab
      if (fDone !== 'all') {
        const t0 = new Date(); t0.setHours(0, 0, 0, 0);
        L = L.filter(n => {
          const cd = ntCreatedDate(n);
          if (!cd) return false;
          if (fDone === 'today') return cd >= t0;
          const days = fDone === '7d' ? 6 : 29;
          return cd >= new Date(t0.getTime() - days * 86400000);
        });
      }
    }
    // search
    if (q) {
      const s = q.toLowerCase();
      L = L.filter(n => {
        if (n.nt_number?.toLowerCase().includes(s)) return true;
        return (n.items || []).some(it =>
          it.code?.toLowerCase().includes(s) || it.description?.toLowerCase().includes(s)
        );
      });
    }
    // sort
    L = [...L];
    if (tab === 'open') {
      if (sortOpen === 'old') L.sort((a, b) => (ntCreatedDate(a)?.getTime() || 0) - (ntCreatedDate(b)?.getTime() || 0));
      else if (sortOpen === 'pend') L.sort((a, b) => ((b.items?.length || 0) - paidN(b)) - ((a.items?.length || 0) - paidN(a)));
      else L.sort((a, b) => (ntCreatedDate(b)?.getTime() || 0) - (ntCreatedDate(a)?.getTime() || 0));
    } else {
      if (sortDone === 'nt') L.sort((a, b) => (b.nt_number || '').localeCompare(a.nt_number || ''));
      else L.sort((a, b) => (ntCreatedDate(b)?.getTime() || 0) - (ntCreatedDate(a)?.getTime() || 0));
    }
    return L;
  }, [nts, tab, fOpen, fDone, q, sortOpen, sortDone]);

  // Counts for summary
  const counts = useMemo(() => {
    const open = nts.filter(n => !isDone(n));
    const late = open.filter(n => stOpen(n).k === 'late');
    let openItems = 0, pend = 0;
    open.forEach(n => { openItems += (n.items?.length || 0); pend += (n.items?.length || 0) - paidN(n); });
    const doneToday = nts.filter(n => {
      if (!isDone(n)) return false;
      const cd = ntCreatedDate(n);
      if (!cd) return false;
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      return cd >= t0;
    }).length;
    let paidToday = 0;
    nts.forEach(n => (n.items || []).forEach(i => {
      if (i.status === 'Pago' && i.payment_time) paidToday++;
    }));
    return { open: open.length, openItems, late: late.length, pend, doneToday, paidToday };
  }, [nts]);

  // Filter counts for segmented buttons
  const filterCounts = useMemo(() => {
    if (tab === 'open') {
      const c: Record<string, number> = { all: 0, wait: 0, prog: 0, late: 0 };
      nts.forEach(n => { if (!isDone(n)) { c.all++; c[stOpen(n).k] = (c[stOpen(n).k] || 0) + 1; } });
      return c;
    }
    return null;
  }, [nts, tab]);

  // Delete handler
  const handleDeleteNTConfirm = async () => {
    if (!ntToDelete) return;
    setIsDeleting(true);
    try {
      await deleteNT(ntToDelete);
      toast.success('Nota Técnica excluída com sucesso');
      setShowDeleteModal(false);
      setNtToDelete(null);
      fetchNTs();
    } catch { toast.error('Erro ao excluir Nota Técnica'); }
    finally { setIsDeleting(false); }
  };

  // Refresh with spin
  const handleRefresh = () => {
    setSpinning(true);
    fetchNTs();
    setTimeout(() => setSpinning(false), 600);
  };

  // Items count in current page
  const itemsCount = filtered.reduce((s, n) => s + (n.items?.length || 0), 0);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col pl-0 md:pl-[52px] min-w-0 h-screen overflow-hidden">
        <Topbar />

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main content area */}
          <main className="flex-1 overflow-auto p-4 sm:p-6 md:px-7 md:py-6 pb-12">
            {/* ── .page-head ── */}
            <div className="page-head">
              <div>
                <h1>{tab === 'done' ? 'Notas técnicas' : 'Notas técnicas'}</h1>
                <p className="subtitle" style={{ fontSize: 13 }}>
                  NTs da pesagem com seus itens · clique em &ldquo;Pagar&rdquo; no item para dar baixa
                </p>
              </div>
              <div className="nt-actions">
                <button
                  type="button"
                  className={cn("btn-nt", spinning && "spin")}
                  onClick={handleRefresh}
                >
                  <RefreshCw size={14} />
                  Atualizar
                </button>
                {/* <button
                  type="button"
                  className="btn-nt"
                  onClick={() => setShowBulkAddModal(true)}
                >
                  <Layers size={14} />
                  Lote em massa
                </button> */}
                <button
                  type="button"
                  className="btn-nt primary"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={14} />
                  Nova NT
                </button>
              </div>
            </div>

            {/* ── .summary (4 KPIs) ── */}
            <NTSummary counts={counts} />

            {/* ── .tabs ── */}
            <div className="tabs">
              <button
                type="button"
                className={cn("tab", tab === 'open' && "on")}
                onClick={() => { setTab('open'); }}
              >
                Abertas <span className="n">{counts.open}</span>
              </button>
              <button
                type="button"
                className={cn("tab", tab === 'done' && "on")}
                onClick={() => { setTab('done'); }}
              >
                Concluídas <span className="n">{nts.filter(n => isDone(n)).length}</span>
              </button>
            </div>

            {/* ── .toolbar ── */}
            <div className="toolbar">
              {/* Segmented filter */}
              <div className="seg">
                {tab === 'open' ? (
                  <>
                    <button type="button" className={cn(fOpen === 'all' && 'on')} onClick={() => setFOpen('all')}>
                      Todas <span className="n">{filterCounts?.all}</span>
                    </button>
                    <button type="button" className={cn(fOpen === 'wait' && 'on')} onClick={() => setFOpen('wait')}>
                      <i style={{ border: '1.5px solid var(--text-3)' }} /> Aguardando <span className="n">{filterCounts?.wait}</span>
                    </button>
                    <button type="button" className={cn(fOpen === 'prog' && 'on')} onClick={() => setFOpen('prog')}>
                      <i style={{ background: 'var(--amber)' }} /> Em andamento <span className="n">{filterCounts?.prog}</span>
                    </button>
                    <button type="button" className={cn(fOpen === 'late' && 'on')} onClick={() => setFOpen('late')}>
                      <i style={{ background: 'var(--red)' }} /> Em atraso <span className="n">{filterCounts?.late}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={cn(fDone === 'today' && 'on')} onClick={() => setFDone('today')}>Hoje</button>
                    <button type="button" className={cn(fDone === '7d' && 'on')} onClick={() => setFDone('7d')}>7 dias</button>
                    <button type="button" className={cn(fDone === '30d' && 'on')} onClick={() => setFDone('30d')}>30 dias</button>
                    <button type="button" className={cn(fDone === 'all' && 'on')} onClick={() => setFDone('all')}>Todas</button>
                  </>
                )}
              </div>

              {/* Search */}
              <label className="search-nt">
                <Search size={14} />
                <input
                  ref={qRef}
                  placeholder="Buscar NT, código ou material"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
                <kbd>/</kbd>
              </label>

              <div className="grow" />

              {/* Hide paid checkbox */}
              {tab === 'open' && (
                <label className="check-nt">
                  <input
                    type="checkbox"
                    checked={hidePaid}
                    onChange={e => setHidePaid(e.target.checked)}
                  />
                  Ocultar itens pagos
                </label>
              )}

              {/* Sort select */}
              <select
                className="select-nt"
                value={tab === 'open' ? sortOpen : sortDone}
                onChange={e => tab === 'open' ? setSortOpen(e.target.value) : setSortDone(e.target.value)}
              >
                {tab === 'open' ? (
                  <>
                    <option value="new">Mais recentes</option>
                    <option value="old">Mais antigas</option>
                    <option value="pend">Mais itens pendentes</option>
                  </>
                ) : (
                  <>
                    <option value="recent">Concluídas recentes</option>
                    <option value="lead">Maior lead time</option>
                    <option value="nt">Número da NT</option>
                  </>
                )}
              </select>
            </div>

            {/* ── .list-top ── */}
            <div className="list-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  {filtered.length > 0
                    ? `${filtered.length} NT${filtered.length > 1 ? 's' : ''} · ${itemsCount} itens nesta página`
                    : ''}
                </span>
              </div>
            </div>

            {/* ── NT List ── */}
            <div>
              {loading && nts.length === 0 ? (
                <div className="empty">Carregando Notas Técnicas...</div>
              ) : filtered.length === 0 ? (
                <div className="empty">
                  {q ? `Nenhuma NT com "${q}".` : tab === 'open' ? 'Nenhuma NT aberta neste filtro.' : 'Nenhuma NT concluída no período.'}
                </div>
              ) : (
                filtered.map(nt => (
                  <NTCardExpanded
                    key={nt.id}
                    nt={nt}
                    hidePaid={hidePaid && tab === 'open'}
                    searchQuery={q}
                    onEdit={() => { setSelectedNT(nt); setShowEditModal(true); }}
                    onDelete={() => { setNtToDelete(nt.id); setShowDeleteModal(true); }}
                    onRefresh={fetchNTs}
                  />
                ))
              )}
            </div>
          </main>

          {/* ── Aside Panel ── */}
          <NTAsidePanel nts={nts} />
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddNTModal open={showAddModal} onOpenChange={setShowAddModal} onSuccess={fetchNTs} />
      )}
      {showBulkAddModal && (
        <AddBulkNTModal open={showBulkAddModal} onOpenChange={setShowBulkAddModal} onSuccess={fetchNTs} />
      )}
      {showEditModal && selectedNT && (
        <EditNTModal
          open={showEditModal}
          onOpenChange={(open) => { setShowEditModal(open); if (!open) setSelectedNT(null); }}
          nt={selectedNT}
          onSuccess={fetchNTs}
        />
      )}
      {showDeleteModal && ntToDelete && (
        <DeleteConfirmationModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          onConfirm={handleDeleteNTConfirm}
          title="Excluir Nota Técnica"
          description={`Tem certeza que deseja excluir esta NT #${ntToDelete}? Esta ação não pode ser desfeita.`}
          isDeleting={isDeleting}
          entityType="nt"
          entityId={ntToDelete}
        />
      )}
    </div>
  );
}

export default function NTManagerPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[var(--bg)] text-xs text-[var(--text-3)]">
        Carregando gerenciador de NTs...
      </div>
    }>
      <NTManagerContent />
    </Suspense>
  );
}