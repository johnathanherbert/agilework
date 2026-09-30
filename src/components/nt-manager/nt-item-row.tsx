"use client";

import { useState } from 'react';
import { NTItem, ItemStatus } from '@/types';
import { Edit, Trash2, Snowflake, Flame, CheckCircle2, Clock, AlertCircle, MoreHorizontal, Check } from 'lucide-react';
import { cn, formatItemTime, getMaterialCategory } from '@/lib/utils';
import { EditFieldModal } from './edit-field-modal';
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

  // Alteração de status controlada estritamente via menu contextual
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
        newStatus === 'Pago'
          ? 'Item marcado como Pago!'
          : newStatus === 'Pago Parcial'
          ? 'Item marcado como Pago Parcial'
          : 'Item alterado para Aguardando Pagamento'
      );
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Erro ao atualizar status do item');
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
  const isPartial = item.status === 'Pago Parcial';

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <tr className={cn(
            "hover:bg-[var(--hover)] transition-colors text-xs select-none group",
            isPaid ? "opacity-75" : "",
            isHighlighted && "bg-[var(--accent-weak)]"
          )}>
            {/* Col 1: Código */}
            <td 
              className="py-2 px-2 font-mono font-medium text-[var(--text)] hover:text-[var(--accent)] hover:underline cursor-pointer"
              onClick={() => handleCellClick('code', 'Código')}
              title="Clique para editar código"
            >
              {item.code}
            </td>

            {/* Col 2: Descrição do Material */}
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

            {/* Col 3: Lote */}
            <td 
              className="py-2 px-2 font-mono text-[var(--text-2)] hover:text-[var(--text)] hover:underline cursor-pointer"
              onClick={() => handleCellClick('batch', 'Lote')}
              title="Clique para editar lote"
            >
              {item.batch || '—'}
            </td>

            {/* Col 4: Quantidade */}
            <td 
              className="py-2 px-2 text-right font-mono font-semibold text-[var(--text)] hover:text-[var(--accent)] hover:underline cursor-pointer"
              onClick={() => handleCellClick('quantity', 'Quantidade')}
              title="Clique para editar quantidade"
            >
              {item.quantity}
            </td>

            {/* Col 5: Horário Pagamento / Tempo */}
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

            {/* Col 6: Status Pill com Menu Contextual */}
            <td className="py-2 px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isUpdating}
                    className={cn(
                      "status-pill cursor-pointer transition-all hover:ring-1 hover:ring-[var(--border-strong)]",
                      isPaid ? "done" : isPartial ? "progress" : isDelayed ? "late" : "pending"
                    )}
                    title="Menu contextual: clique para alterar status"
                  >
                    <i />
                    <span>{isPaid ? "Pago" : isPartial ? "Parcial" : isDelayed ? "Atrasado" : "Pendente"}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-[11px] font-semibold text-[var(--text-3)]">
                    Alterar Status do Item
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
                      <i className="w-2 h-2 rounded-full bg-[var(--blue)] inline-block" />
                      <span>Pago Parcial</span>
                    </span>
                    {isPartial && <Check size={13} className="text-[var(--blue)]" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>

            {/* Col 7: Ações */}
            <td className="py-2 px-2 text-right">
              <div className="flex items-center justify-end gap-1">
                {/* Menu Contextual de Opções */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-6 h-6 rounded-[3px] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                      title="Opções do item"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[11px] font-semibold text-[var(--text-3)]">
                      Status do Item
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => handleSetStatus('Pago')}
                      className="text-xs flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <i className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
                        <span>Marcar como Pago</span>
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
                        <i className="w-2 h-2 rounded-full bg-[var(--blue)] inline-block" />
                        <span>Pago Parcial</span>
                      </span>
                      {isPartial && <Check size={13} className="text-[var(--blue)]" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleCellClick('description', 'Descrição')}
                      className="text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Edit size={12} />
                      <span>Editar Material</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteModal(true)}
                      className="text-xs text-[var(--red)] focus:text-[var(--red)] flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Excluir Item</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

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
        </ContextMenuTrigger>

        {/* Menu Contextual ao Clicar com o Botão Direito na Linha */}
        <ContextMenuContent className="w-52">
          <ContextMenuLabel>Status do Item</ContextMenuLabel>
          <ContextMenuItem
            onClick={() => handleSetStatus('Pago')}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
              <span>Marcar como Pago</span>
            </span>
            {isPaid && <Check size={13} className="text-[var(--green)]" />}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleSetStatus('Ag. Pagamento')}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full bg-[var(--amber)] inline-block" />
              <span>Ag. Pagamento</span>
            </span>
            {!isPaid && !isPartial && <Check size={13} className="text-[var(--amber)]" />}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleSetStatus('Pago Parcial')}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full bg-[var(--blue)] inline-block" />
              <span>Pago Parcial</span>
            </span>
            {isPartial && <Check size={13} className="text-[var(--blue)]" />}
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => handleCellClick('description', 'Descrição')}
            className="flex items-center gap-2"
          >
            <Edit size={12} />
            <span>Editar Material / Campos</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => setShowDeleteModal(true)}
            className="text-[var(--red)] focus:text-[var(--red)] flex items-center gap-2"
          >
            <Trash2 size={12} />
            <span>Excluir Item</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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