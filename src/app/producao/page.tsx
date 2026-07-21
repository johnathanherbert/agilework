"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Factory, Wifi, WifiOff } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import ProtectedRoute from '@/components/auth/protected-route';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { useProductionRealtime } from '@/hooks/useProductionRealtime';
import { moveProductionItem, mergeSplitProductionItem } from '@/lib/production-helpers';
import { TurnoColumn } from '@/components/producao/turno-column';
import { ProductionItemModal } from '@/components/producao/production-item-modal';
import { ProductionDeleteDialog } from '@/components/producao/production-delete-dialog';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';
import { cn } from '@/lib/utils';

const TURNOS: ProductionTurno[] = [3, 1, 2];

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  tipo: ProductionTipo;
  item?: ProductionItem | null;
  defaultTurno: ProductionTurno;
  defaultVia?: ProductionVia;
}

export default function ProducaoPage() {
  const { userData, loading: authLoading } = useFirebase();
  const router = useRouter();
  const { items, loading, connected } = useProductionRealtime();

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
    tipo: 'ordem',
    defaultTurno: 1,
  });
  const [itemToDelete, setItemToDelete] = useState<ProductionItem | null>(null);

  const isLeaderOrAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'leader';

  // Guarda de acesso: somente líderes e o admin global podem ver esta página
  useEffect(() => {
    if (!authLoading) {
      if (!userData || !isLeaderOrAdmin) {
        toast.error('Acesso negado. Apenas líderes e administradores podem ver esta página.');
        router.push('/dashboard');
      }
    }
  }, [authLoading, userData, isLeaderOrAdmin, router]);

  const itemsByTurno = useMemo(() => {
    const map: Record<ProductionTurno, ProductionItem[]> = { 1: [], 2: [], 3: [] };
    items.forEach((item) => {
      if (map[item.turno]) map[item.turno].push(item);
    });
    return map;
  }, [items]);

  const openCreateModal = (turno: ProductionTurno, tipo: ProductionTipo, via?: ProductionVia) => {
    setModal({ open: true, mode: 'create', tipo, defaultTurno: turno, defaultVia: via, item: null });
  };

  const openEditModal = (item: ProductionItem) => {
    setModal({ open: true, mode: 'edit', tipo: item.tipo, defaultTurno: item.turno, defaultVia: item.via, item });
  };

  const handleMove = async (itemId: string, destination: { turno: ProductionTurno; via?: ProductionVia }) => {
    try {
      const draggedItem = items.find((i) => i.id === itemId);

      // Se o item arrastado é o "filho" de uma ordem dividida e está sendo solto
      // de volta no turno/via de origem do "pai", mescla ao invés de mover
      if (draggedItem?.splitParentId) {
        const parentItem = items.find((i) => i.id === draggedItem.splitParentId);
        if (parentItem && parentItem.turno === destination.turno && parentItem.via === destination.via) {
          await mergeSplitProductionItem(parentItem.id, draggedItem.id);
          toast.success('Ordem mesclada de volta ao turno de origem!');
          return;
        }
      }

      await moveProductionItem(itemId, destination);
    } catch (error: any) {
      console.error('Erro ao mover item:', error);
      toast.error(error.message || 'Erro ao mover o item');
    }
  };

  if (authLoading || !userData || !isLeaderOrAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300">
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-md">
                  <Factory className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Painel de Produção</h1>
                  <p className="text-sm text-muted-foreground font-medium">Pesagem por Turno e Família</p>
                </div>
              </div>

              <div
                className={cn(
                  'flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border',
                  connected
                    ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40'
                    : 'text-muted-foreground bg-muted border-border'
                )}
              >
                {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {connected ? 'Tempo real ativo' : 'Conectando...'}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {TURNOS.map((t) => (
                  <div key={t} className="h-[420px] rounded-xl bg-card border border-border/80 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {TURNOS.map((turno) => (
                  <TurnoColumn
                    key={turno}
                    turno={turno}
                    items={itemsByTurno[turno]}
                    onItemClick={openEditModal}
                    onCreateClick={(tipo, via) => openCreateModal(turno, tipo, via)}
                    onMove={handleMove}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <ProductionItemModal
        open={modal.open}
        onOpenChange={(open) => setModal((m) => ({ ...m, open }))}
        mode={modal.mode}
        tipo={modal.tipo}
        item={modal.item}
        defaultTurno={modal.defaultTurno}
        defaultVia={modal.defaultVia}
        onRequestDelete={(item) => {
          setModal((m) => ({ ...m, open: false }));
          setItemToDelete(item);
        }}
      />

      <ProductionDeleteDialog
        item={itemToDelete}
        onOpenChange={(open) => {
          if (!open) setItemToDelete(null);
        }}
      />
    </ProtectedRoute>
  );
}
