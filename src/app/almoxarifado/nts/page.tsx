"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { NT, NTFilters as NTFiltersType } from '@/types';
import { Plus, Layers, RefreshCw } from 'lucide-react';
import { getNTs, subscribeToNTs, deleteNT } from '@/lib/firestore-helpers';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { NTList } from '@/components/nt-manager/nt-list';
import { NTStats } from '@/components/nt-manager/nt-stats';
import { NTFilters } from '@/components/nt-manager/nt-filters';
import { AddNTModal } from '@/components/nt-manager/add-nt-modal';
import { AddBulkNTModal } from '@/components/nt-manager/add-bulk-nt-modal';
import { EditNTModal } from '@/components/nt-manager/edit-nt-modal';
import { DeleteConfirmationModal } from '@/components/nt-manager/delete-confirmation-modal';
import { PaidItemsTimelineFirebase } from '@/components/nt-manager/paid-items-timeline-firebase';

function NTManagerContent() {
  const [nts, setNts] = useState<NT[]>([]);
  const [filteredNts, setFilteredNts] = useState<NT[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ntToDelete, setNtToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedNT, setSelectedNT] = useState<NT | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [autoExpandedNTs, setAutoExpandedNTs] = useState<string[]>([]);
  const [highlightedItems, setHighlightedItems] = useState<string[]>([]);
  const { user } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filtros
  const [filters, setFilters] = useState<NTFiltersType>({
    search: '',
    status: [],
    dateRange: null,
    shift: null,
    overdueOnly: false,
    hideOldNts: false,
    priorityOnly: false,
    isCompletedView: false,
  });

  // Autenticação
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Checar se a URL veio com status=concluida
  useEffect(() => {
    const statusParam = searchParams?.get('status');
    if (statusParam === 'concluida') {
      setFilters(prev => ({ ...prev, isCompletedView: true }));
    }
  }, [searchParams]);

  // Carregar NTs
  const fetchNTs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNTs();
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const recentNTs = data.filter((nt: NT) => {
        if (!nt.created_date) return false;
        try {
          const [day, month, year] = nt.created_date.split('/').map(Number);
          const ntDate = new Date(year, month - 1, day);
          return ntDate >= twoDaysAgo;
        } catch (e) {
          return true;
        }
      });
      setNts(recentNTs);
      return recentNTs;
    } catch (error) {
      toast.error('Erro ao carregar as NTs');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Inscrição em tempo real Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNTs(
      (ntsData) => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const recentNTs = ntsData.filter((nt: NT) => {
          if (!nt.created_date) return false;
          try {
            const [day, month, year] = nt.created_date.split('/').map(Number);
            const ntDate = new Date(year, month - 1, day);
            return ntDate >= twoDaysAgo;
          } catch (e) {
            return true;
          }
        });

        setNts(recentNTs);
        setLoading(false);
      },
      () => {
        toast.error('Erro na atualização em tempo real');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...nts];
    const searchTerm = filters.search?.toLowerCase().trim();

    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      filtered = filtered.filter(nt => {
        try {
          const [day, month, year] = nt.created_date.split('/').map(Number);
          const createdDate = new Date(year, month - 1, day);
          const fromDate = new Date(filters.dateRange!.from);
          const toDate = new Date(filters.dateRange!.to);
          return createdDate >= fromDate && createdDate <= toDate;
        } catch (e) {
          return true;
        }
      });
    }

    if (filters.shift !== null) {
      filtered = filtered.filter(nt => {
        const createdTime = nt.created_time || '';
        const hour = parseInt(createdTime.split(':')[0], 10);
        if (filters.shift === 1) return hour >= 6 && hour < 14;
        if (filters.shift === 2) return hour >= 14 && hour < 22;
        if (filters.shift === 3) return hour >= 22 || hour < 6;
        return true;
      });
    }

    if (filters.isCompletedView) {
      filtered = filtered.filter(nt => {
        if (!nt.items || nt.items.length === 0) return false;
        return nt.items.every(item => item.status === 'Pago');
      });
    } else if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(nt => {
        if (!nt.items || nt.items.length === 0) return false;
        return nt.items.some(item => filters.status.includes(item.status));
      });
    }

    if (filters.overdueOnly) {
      const twoHoursInMs = 2 * 60 * 60 * 1000;
      filtered = filtered.filter(nt => {
        if (!nt.items) return false;
        return nt.items.some(item => {
          if (item.status === 'Pago') return false;
          try {
            const [year, month, day] = item.created_date.split('-').map(Number);
            const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
            const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
            return Date.now() - creationDate.getTime() > twoHoursInMs;
          } catch (e) {
            return false;
          }
        });
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(nt => {
        const matchesNT = nt.nt_number?.toLowerCase().includes(searchTerm);
        const matchesItems = nt.items?.some(item =>
          item.code?.toLowerCase().includes(searchTerm) ||
          item.description?.toLowerCase().includes(searchTerm) ||
          item.batch?.toLowerCase().includes(searchTerm)
        );

        return matchesNT || matchesItems;
      });
    }

    setFilteredNts(filtered);
  }, [nts, filters]);

  // Deletar NT confirmada
  const handleDeleteNTConfirm = async () => {
    if (!ntToDelete) return;
    setIsDeleting(true);
    try {
      await deleteNT(ntToDelete);
      toast.success('Nota Técnica excluída com sucesso');
      setShowDeleteModal(false);
      setNtToDelete(null);
      fetchNTs();
    } catch (err) {
      toast.error('Erro ao excluir Nota Técnica');
    } finally {
      setIsDeleting(false);
    }
  };

  // Contagens para os filtros
  const counts = {
    all: nts.length,
    pending: nts.filter(n => n.items?.some(i => i.status === 'Ag. Pagamento')).length,
    paid: nts.filter(n => n.items && n.items.length > 0 && n.items.every(i => i.status === 'Pago')).length,
    delayed: nts.filter(n => {
      const twoHoursInMs = 2 * 60 * 60 * 1000;
      return n.items?.some(item => {
        if (item.status === 'Pago') return false;
        try {
          const [year, month, day] = item.created_date.split('-').map(Number);
          const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
          const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
          return Date.now() - creationDate.getTime() > twoHoursInMs;
        } catch (e) {
          return false;
        }
      });
    }).length,
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* App Rail 52px */}
      <Sidebar />

      {/* Conteúdo Principal com Topbar 48px */}
      <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
        <Topbar />

        {/* Layout de 2 colunas: Lista Principal + Inspector Lateral */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Coluna Central: Lista de NTs */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {/* Header da Página com Ações Rápidas */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1 select-none">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                  {filters.isCompletedView ? "Notas Técnicas Concluídas" : "Notas Técnicas"}
                </h1>
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  {filters.isCompletedView
                    ? "Histórico e auditoria de NTs 100% finalizadas"
                    : "Acompanhamento das NTs abertas para pesagem"}
                </p>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchNTs()}
                  className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} className={cn(loading && "animate-spin")} />
                  <span>Atualizar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBulkAddModal(true)}
                  className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers size={13} />
                  <span>Lote em Massa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="h-8 px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  <span>Nova NT</span>
                </button>
              </div>
            </div>

            {/* Sumário de KPIs em 4 blocos */}
            <NTStats nts={nts} />

            {/* Barra de Filtros com Abas Segmentadas */}
            <NTFilters
              filters={filters}
              onChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
              counts={counts}
            />

            {/* Cabeçalho da Tabela */}
            <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
              <div className="grid grid-cols-[28px_1.3fr_1fr_0.7fr_1.3fr_1fr_0.9fr_100px] items-center px-3 py-2 bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-3)] border-b border-[var(--border)] gap-2 select-none">
                <div></div>
                <div>NT / Identificador</div>
                <div>Destino</div>
                <div>Turno</div>
                <div>Progresso</div>
                <div>Criada em</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>

              {/* Lista / Tabela de NTs */}
              {loading && nts.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-3)]">
                  Carregando Notas Técnicas...
                </div>
              ) : filteredNts.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-3)] space-y-1">
                  <p className="font-semibold text-[var(--text-2)]">Nenhuma NT encontrada</p>
                  <p>Tente ajustar os filtros ou a busca acima.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  <NTList
                    nts={filteredNts}
                    onEdit={(nt) => {
                      setSelectedNT(nt);
                      setShowEditModal(true);
                    }}
                    onDelete={(ntId) => {
                      setNtToDelete(ntId);
                      setShowDeleteModal(true);
                    }}
                    onRefresh={fetchNTs}
                    autoExpandedNTs={autoExpandedNTs}
                    highlightedItems={highlightedItems}
                  />
                </div>
              )}
            </div>
          </main>

          {/* Coluna Direita: Inspector em Tempo Real */}
          <PaidItemsTimelineFirebase
            collapsed={timelineCollapsed}
            onToggleCollapse={() => setTimelineCollapsed(!timelineCollapsed)}
          />
        </div>
      </div>

      {/* Modais */}
      {showAddModal && (
        <AddNTModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          onSuccess={fetchNTs}
        />
      )}

      {showBulkAddModal && (
        <AddBulkNTModal
          open={showBulkAddModal}
          onOpenChange={setShowBulkAddModal}
          onSuccess={fetchNTs}
        />
      )}

      {showEditModal && selectedNT && (
        <EditNTModal
          open={showEditModal}
          onOpenChange={(open) => {
            setShowEditModal(open);
            if (!open) setSelectedNT(null);
          }}
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