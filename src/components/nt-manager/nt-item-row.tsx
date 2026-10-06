import { useState } from 'react';
import { NT, NTItem, ItemStatus } from '@/types';
import { Edit, Trash2, Check } from 'lucide-react';
import { cn, formatNumber, parseDateTime, isItemDelayed } from '@/lib/utils';
import { EditItemModal } from './edit-item-modal';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { updateNTItem, deleteNTItem } from '@/lib/firestore-helpers';
import toast from 'react-hot-toast';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

const LATE_MIN = 120;

interface NTItemRowProps {
  item: NTItem;
  nt: NT;
  onSuccess?: () => void;
  searchQuery?: string;
}

export const NTItemRow = ({
  item,
  nt,
  onSuccess,
  searchQuery = '',
}: NTItemRowProps) => {
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPaid = item.status === 'Pago';
  const isPartial = item.status === 'Pago Parcial';

  // Calculate delay based on NT creation
  let isLate = false;
  try {
    const { creationDate } = parseDateTime(
      item.created_date || nt.created_date,
      item.created_time || nt.created_time
    );
    if (creationDate && !isNaN(creationDate.getTime()) && !isPaid) {
      isLate = isItemDelayed(creationDate, item.code);
    }
  } catch {}

  // Description cleanup
  const isControlled = item.description?.includes('**') || item.code === '011833' || item.code === '011543';
  const cleanDescription = (item.description || '').replace(/\*\*/g, '').trim();

  // Quantity
  const parsedQty = typeof item.quantity === 'number'
    ? formatNumber(item.quantity, 3)
    : item.quantity;

  // Time display like concept
  let whenHtml: React.ReactNode;
  if (isPaid && item.payment_time) {
    whenHtml = (
      <>pago <b>{item.payment_time}</b></>
    );
  } else {
    whenHtml = (
      <span className={isLate ? 'late' : ''}>
        {isLate ? 'pendente · NT atrasada' : 'pendente'}
      </span>
    );
  }

  // Status change handler (KEPT from original - contextual menu)
  const handleSetStatus = async (newStatus: ItemStatus) => {
    if (item.status === newStatus) return;
    setIsUpdating(true);
    try {
      const updateData: Partial<NTItem> = { status: newStatus };
      if (newStatus === 'Pago') {
        const now = new Date();
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        updateData.payment_time = `${h}:${m}`;
      } else if (newStatus === 'Ag. Pagamento') {
        updateData.payment_time = '';
      }
      await updateNTItem(item.id, updateData);
      toast.success(
        newStatus === 'Pago' ? 'Item marcado como Pago!' :
        newStatus === 'Pago Parcial' ? 'Item marcado como Pago Parcial' :
        'Item alterado para Aguardando Pagamento'
      );
      if (onSuccess) onSuccess();
    } catch {
      toast.error('Erro ao atualizar status do item');
    } finally {
      setIsUpdating(false);
    }
  };


  const handleDeleteItem = async () => {
    setIsDeleting(true);
    try {
      await deleteNTItem(item.id);
      toast.success('Item excluído com sucesso');
      setShowDeleteModal(false);
      if (onSuccess) onSuccess();
    } catch {
      toast.error('Erro ao excluir item');
    } finally {
      setIsDeleting(false);
    }
  };

  // Dim if searching and item doesn't match
  const isDim = searchQuery && !item.code?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !item.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !nt.nt_number?.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "it",
              isPaid && "paid",
              isLate && !isPaid && "latei",
              isDim && "dim",
            )}
          >
            {/* 1. Node (Bolinha de status: cinza/vermelha marca como pago, verde estorna) */}
            <button
              type="button"
              className="node"
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation();
                handleSetStatus(isPaid ? 'Ag. Pagamento' : 'Pago');
              }}
              title={isPaid ? "Clique na bolinha para estornar pagamento" : "Clique na bolinha para marcar como pago"}
              aria-label={isPaid ? "Estornar pagamento" : "Marcar como pago"}
            />

            {/* 2. Code (.cod) */}
            <span
              className="cod hover:text-[var(--accent)] hover:underline cursor-pointer"
              onClick={() => setShowEditItemModal(true)}
              title="Clique para editar material"
            >
              {item.code || '—'}
            </span>

            {/* 3. Description (.desc) */}
            <span
              className="desc cursor-pointer hover:text-[var(--text)]"
              onClick={() => setShowEditItemModal(true)}
              title={cleanDescription}
            >
              {cleanDescription}
              {isControlled && <span className="flag">Controlado</span>}
            </span>

            {/* 4. Batch (.lote) */}
            <span
              className="lote hover:text-[var(--text)] cursor-pointer"
              onClick={() => setShowEditItemModal(true)}
              title="Lote"
            >
              {item.batch ? `L: ${item.batch}` : '—'}
            </span>

            {/* 5. Quantity (.qtd) */}
            <span
              className="qtd hover:text-[var(--accent)] cursor-pointer"
              onClick={() => setShowEditItemModal(true)}
              title="Quantidade"
            >
              {parsedQty}<small>kg</small>
            </span>

            {/* 6. When (.when) */}
            <span className="when">{whenHtml}</span>

            {/* 7. Actions (.iacts) botões rápidos de editar e excluir */}
            <div className="iacts" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowEditItemModal(true)}
                title="Editar todos os dados do material"
              >
                <Edit size={14} />
              </button>
              <button
                type="button"
                className="del"
                onClick={() => setShowDeleteModal(true)}
                title="Remover item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </ContextMenuTrigger>

        {/* Right-click Context Menu - Novo Design System */}
        <ContextMenuContent className="w-60 p-1 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-[0_16px_40px_rgba(0,0,0,0.35)] rounded-[8px] overflow-hidden animate-fade-in">
          {/* Header do Item no Context Menu */}
          <div className="px-2.5 py-2 border-b border-[var(--border)] mb-1 bg-[var(--surface-2)]/60 rounded-t-[7px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold text-[var(--text)] truncate">
                {item.code}
              </span>
              <span className="text-[10px] text-[var(--text-3)] font-mono">
                {parsedQty} kg
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-2)] truncate mt-0.5" title={cleanDescription}>
              {cleanDescription}
            </p>
          </div>

          <ContextMenuLabel className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--text-3)] font-mono">
            Alterar Status
          </ContextMenuLabel>

          <div className="space-y-0.5">
            <ContextMenuItem
              onClick={() => handleSetStatus('Pago')}
              className={cn(
                "text-xs py-1.5 px-2 rounded-[5px] flex items-center justify-between cursor-pointer transition-colors",
                isPaid ? "bg-[var(--accent-weak)] text-[var(--text)] font-semibold" : "text-[var(--text)] hover:bg-[var(--hover)]"
              )}
            >
              <span className="flex items-center gap-2">
                <i className="w-2 h-2 rounded-full bg-[var(--green)] inline-block shrink-0 shadow-xs" />
                <span>Marcar como Pago</span>
              </span>
              {isPaid && <Check size={13} className="text-[var(--green)] stroke-[2.5]" />}
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => handleSetStatus('Ag. Pagamento')}
              className={cn(
                "text-xs py-1.5 px-2 rounded-[5px] flex items-center justify-between cursor-pointer transition-colors",
                (!isPaid && !isPartial) ? "bg-[var(--accent-weak)] text-[var(--text)] font-semibold" : "text-[var(--text)] hover:bg-[var(--hover)]"
              )}
            >
              <span className="flex items-center gap-2">
                <i className="w-2 h-2 rounded-full bg-[var(--amber)] inline-block shrink-0 shadow-xs" />
                <span>Ag. Pagamento</span>
              </span>
              {!isPaid && !isPartial && <Check size={13} className="text-[var(--amber)] stroke-[2.5]" />}
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => handleSetStatus('Pago Parcial')}
              className={cn(
                "text-xs py-1.5 px-2 rounded-[5px] flex items-center justify-between cursor-pointer transition-colors",
                isPartial ? "bg-[var(--accent-weak)] text-[var(--text)] font-semibold" : "text-[var(--text)] hover:bg-[var(--hover)]"
              )}
            >
              <span className="flex items-center gap-2">
                <i className="w-2 h-2 rounded-full bg-[var(--blue,var(--accent))] inline-block shrink-0 shadow-xs" />
                <span>Pago Parcial</span>
              </span>
              {isPartial && <Check size={13} className="text-[var(--blue,var(--accent))] stroke-[2.5]" />}
            </ContextMenuItem>
          </div>

          <ContextMenuSeparator className="my-1 bg-[var(--border)]" />

          <div className="space-y-0.5">
            <ContextMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => {
                  setShowEditItemModal(true);
                }, 60);
              }}
              className="text-xs py-1.5 px-2 rounded-[5px] flex items-center gap-2 cursor-pointer font-medium text-[var(--text)] hover:bg-[var(--hover)] transition-colors group"
            >
              <Edit size={13} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
              <span>Editar Material</span>
            </ContextMenuItem>

            <ContextMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => {
                  setShowDeleteModal(true);
                }, 60);
              }}
              className="text-xs py-1.5 px-2 rounded-[5px] text-[var(--red)] hover:bg-[var(--red)]/10 focus:bg-[var(--red)]/10 flex items-center gap-2 cursor-pointer font-medium transition-colors group"
            >
              <Trash2 size={13} className="transition-transform group-hover:scale-110" />
              <span>Excluir Item</span>
            </ContextMenuItem>
          </div>
        </ContextMenuContent>
      </ContextMenu>

      {/* Modal Completo de Edição do Material */}
      {showEditItemModal && (
        <EditItemModal
          open={showEditItemModal}
          onOpenChange={(open) => {
            setShowEditItemModal(open);
            if (!open) {
              document.body.style.pointerEvents = '';
            }
          }}
          item={item}
          onSuccess={onSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          open={showDeleteModal}
          onOpenChange={(open) => {
            setShowDeleteModal(open);
            if (!open) {
              document.body.style.pointerEvents = '';
            }
          }}
          onConfirm={handleDeleteItem}
          title="Excluir item de NT"
          description={`Tem certeza que deseja excluir o item ${item.code} - ${cleanDescription}?`}
          isDeleting={isDeleting}
          entityType="item"
          entityId={item.id}
        />
      )}
    </>
  );
};