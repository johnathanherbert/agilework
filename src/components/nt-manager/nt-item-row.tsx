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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
            {/* 1. Node */}
            <span className="node" />

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

            {/* 7. Actions (.iacts) com status pill contextual e botões rápidos */}
            <div className="iacts" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isUpdating}
                    className={cn(
                      "status-pill cursor-pointer transition-all hover:ring-1 hover:ring-[var(--border-strong)] text-[11px] py-0.5 px-2",
                      isPaid ? "done" : isPartial ? "progress" : isLate ? "late" : "pending"
                    )}
                    title="Clique para alterar status do material"
                  >
                    <i />
                    <span>
                      {isUpdating
                        ? "Salvando..."
                        : isPaid
                        ? "Pago"
                        : isPartial
                        ? "Parcial"
                        : isLate
                        ? "Atrasado"
                        : "Pendente"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[var(--surface)] border-[var(--border-strong)]">
                  <DropdownMenuLabel className="text-[11px] font-semibold text-[var(--text-3)]">
                    Status da Pesagem
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleSetStatus('Pago')}
                    className="text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <i className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
                      <span>Pago</span>
                    </span>
                    {isPaid && <Check size={13} className="text-[var(--green)]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSetStatus('Ag. Pagamento')}
                    className="text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <i className="w-2 h-2 rounded-full bg-[var(--amber)] inline-block" />
                      <span>Ag. Pagamento</span>
                    </span>
                    {!isPaid && !isPartial && <Check size={13} className="text-[var(--amber)]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSetStatus('Pago Parcial')}
                    className="text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <i className="w-2 h-2 rounded-full bg-[var(--blue,var(--violet))] inline-block" />
                      <span>Pago Parcial</span>
                    </span>
                    {isPartial && <Check size={13} className="text-[var(--blue,var(--violet))]" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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

        {/* Right-click Context Menu */}
        <ContextMenuContent className="w-56 bg-[var(--surface)] border-[var(--border-strong)]">
          <ContextMenuLabel className="text-[11px] font-semibold text-[var(--text-3)]">
            Status do Item
          </ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => handleSetStatus('Pago')}
            className="text-xs flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
              <span>Marcar como Pago</span>
            </span>
            {isPaid && <Check size={13} className="text-[var(--green)]" />}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleSetStatus('Ag. Pagamento')}
            className="text-xs flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full bg-[var(--amber)] inline-block" />
              <span>Ag. Pagamento</span>
            </span>
            {!isPaid && !isPartial && <Check size={13} className="text-[var(--amber)]" />}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleSetStatus('Pago Parcial')}
            className="text-xs flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full bg-[var(--blue,var(--violet))] inline-block" />
              <span>Pago Parcial</span>
            </span>
            {isPartial && <Check size={13} className="text-[var(--blue,var(--violet))]" />}
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => setShowEditItemModal(true)}
            className="text-xs flex items-center gap-2 cursor-pointer font-medium text-[var(--text)]"
          >
            <Edit size={13} />
            <span>Editar Material</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => setShowDeleteModal(true)}
            className="text-xs text-[var(--red)] focus:text-[var(--red)] flex items-center gap-2 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Excluir Item</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Modal Completo de Edição do Material */}
      {showEditItemModal && (
        <EditItemModal
          open={showEditItemModal}
          onOpenChange={setShowEditItemModal}
          item={item}
          onSuccess={onSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
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