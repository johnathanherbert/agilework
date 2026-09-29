"use client";

import { useState } from 'react';
import { NTItem, ItemStatus } from '@/types';
import { Edit, Trash2, Snowflake, Flame } from 'lucide-react';
import { cn, formatItemTime, getMaterialCategory } from '@/lib/utils';
import { EditFieldModal } from './edit-field-modal';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { updateNTItem, deleteNTItem } from '@/lib/firestore-helpers';
import toast from 'react-hot-toast';

type FieldType = 'code' | 'description' | 'quantity' | 'batch' | 'status' | 'priority';

interface NTItemRowProps {
  item: NTItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onSuccess?: () => void;
  isHighlighted?: boolean;
}

export const NTItemRow = ({ 
  item, 
  onSuccess, 
  isHighlighted = false 
}: NTItemRowProps) => {
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fieldToEdit, setFieldToEdit] = useState<FieldType>('code');
  const [fieldLabel, setFieldLabel] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Alternar status entre 'Ag. Pagamento' e 'Pago'
  const handleToggleStatus = async () => {
    setIsUpdating(true);
    const newStatus: ItemStatus = item.status === 'Pago' ? 'Ag. Pagamento' : 'Pago';
    try {
      const updateData: Partial<NTItem> = { status: newStatus };
      if (newStatus === 'Pago') {
        const now = new Date();
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        updateData.payment_time = `${h}:${m}`;
      } else {
        updateData.payment_time = '';
      }

      await updateNTItem(item.id, updateData);
      toast.success(newStatus === 'Pago' ? 'Item marcado como Pago!' : 'Item pendente de pesagem');
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCellClick = (field: FieldType, label: string) => {
    setFieldToEdit(field);
    setFieldLabel(label);
    setShowEditFieldModal(true);
  };

  const handleDeleteItem = async () => {
    setIsDeleting(true);
    try {
      await deleteNTItem(item.id);
      toast.success('Item excluído com sucesso');
      setShowDeleteModal(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error('Erro ao excluir item');
    } finally {
      setIsDeleting(false);
    }
  };

  const itemTimeInfo = formatItemTime(
    item.created_date,
    item.created_time,
    item.code,
    item.status,
    item.payment_time
  );

  const isDelayed = itemTimeInfo.isDelayed && item.status !== 'Pago';
  const materialCategory = getMaterialCategory(item.code);
  const isPaid = item.status === 'Pago';

  return (
    <>
      <tr className={cn(
        "hover:bg-[var(--hover)] transition-colors text-xs select-none",
        isPaid ? "opacity-75" : "",
        isHighlighted && "bg-[var(--accent-weak)]"
      )}>
        {/* Col 1: Status Checkbox / Pill */}
        <td className="py-2 px-2">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={isUpdating}
            className={cn(
              "status-pill cursor-pointer transition-transform hover:scale-105",
              isPaid ? "done" : isDelayed ? "late" : "pending"
            )}
            title="Clique para alternar status (Pago / Pendente)"
          >
            <i />
            <span>{isPaid ? "Pago" : isDelayed ? "Atrasado" : "Pendente"}</span>
          </button>
        </td>

        {/* Col 2: Código */}
        <td 
          className="py-2 px-2 font-mono font-medium text-[var(--text)] hover:text-[var(--accent)] hover:underline cursor-pointer"
          onClick={() => handleCellClick('code', 'Código')}
          title="Clique para editar código"
        >
          {item.code}
        </td>

        {/* Col 3: Descrição do Material */}
        <td 
          className="py-2 px-2 text-[var(--text-2)] hover:text-[var(--text)] hover:underline cursor-pointer max-w-[260px] truncate"
          onClick={() => handleCellClick('description', 'Descrição')}
          title={item.description}
        >
          <div className="flex items-center gap-1.5 truncate">
            {materialCategory === 'CFA' && (
              <Snowflake size={12} className="text-[var(--blue)] shrink-0" />
            )}
            {materialCategory === 'INF' && (
              <Flame size={12} className="text-[var(--amber)] shrink-0" />
            )}
            <span className="truncate">{item.description}</span>
          </div>
        </td>

        {/* Col 4: Lote */}
        <td 
          className="py-2 px-2 font-mono text-[var(--text-2)] hover:text-[var(--text)] hover:underline cursor-pointer"
          onClick={() => handleCellClick('batch', 'Lote')}
          title="Clique para editar lote"
        >
          {item.batch || '—'}
        </td>

        {/* Col 5: Quantidade */}
        <td 
          className="py-2 px-2 text-right font-mono font-semibold text-[var(--text)] hover:text-[var(--accent)] hover:underline cursor-pointer"
          onClick={() => handleCellClick('quantity', 'Quantidade')}
          title="Clique para editar quantidade"
        >
          {item.quantity}
        </td>

        {/* Col 6: Horário Pagamento / Tempo */}
        <td className="py-2 px-2 font-mono text-[11px] text-[var(--text-3)]">
          {item.payment_time ? (
            <span className="text-[var(--green)] font-medium">
              ✓ {item.payment_time}
            </span>
          ) : (
            <span className={cn(isDelayed && "text-[var(--red)] font-semibold")}>
              {itemTimeInfo.displayText}
            </span>
          )}
        </td>

        {/* Col 7: Ações */}
        <td className="py-2 px-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => handleCellClick('description', 'Descrição')}
              className="w-5 h-5 rounded-[3px] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              title="Editar item"
            >
              <Edit size={12} />
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="w-5 h-5 rounded-[3px] grid place-items-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              title="Excluir item"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>

      {/* Modal de Edição Rápida de Campo */}
      {showEditFieldModal && (
        <EditFieldModal
          open={showEditFieldModal}
          onOpenChange={setShowEditFieldModal}
          item={item}
          fieldToEdit={fieldToEdit}
          fieldLabel={fieldLabel}
          onSuccess={onSuccess}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          onConfirm={handleDeleteItem}
          title="Excluir item de NT"
          description={`Tem certeza que deseja excluir o item ${item.code} - ${item.description}?`}
          isDeleting={isDeleting}
          entityType="item"
          entityId={item.id}
        />
      )}
    </>
  );
};