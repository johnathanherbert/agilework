"use client";

import { NT } from '@/types';
import { useState } from 'react';
import { 
  ChevronRight, 
  Copy, 
  Check, 
  Edit, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  Bot
} from 'lucide-react';
import { NTItemRow } from './nt-item-row';
import { AddItemModal } from './add-item-modal';
import { RobotStatusModal } from './robot-status-modal';
import { parseDateTime, getDelayInfo } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface NTCardProps {
  nt: NT;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
  highlightedItems?: string[];
}

export const NTCard = ({
  nt,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onRefresh,
  highlightedItems = []
}: NTCardProps) => {
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showRobotModal, setShowRobotModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Copiar número da NT
  const handleCopyNT = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nt.nt_number);
    setCopied(true);
    toast.success(`NT #${nt.nt_number} copiada!`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Contagens e Métricas da NT
  const items = nt.items || [];
  const totalItems = items.length;
  const paidItems = items.filter(i => i.status === 'Pago').length;
  const pendingItems = items.filter(i => i.status === 'Ag. Pagamento').length;
  const progress = totalItems > 0 ? Math.round((paidItems / totalItems) * 100) : 0;
  const isComplete = totalItems > 0 && paidItems === totalItems;

  // Informações de atraso
  let isDelayed = false;
  let formattedTime = nt.created_time || '';
  try {
    const { creationDate } = parseDateTime(nt.created_date, nt.created_time);
    const delayInfo = getDelayInfo(creationDate);
    isDelayed = delayInfo.isDelayed && !isComplete;
  } catch (e) {}

  return (
    <div className={cn(
      "border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden transition-all duration-150 select-none",
      isExpanded && "border-[var(--border-strong)] shadow-sm"
    )}>
      {/* Linha Principal da NT */}
      <div 
        onClick={onToggle}
        className={cn(
          "grid grid-cols-[28px_1.3fr_1fr_0.7fr_1.3fr_1fr_0.9fr_100px] items-center px-3 py-2.5 min-h-[44px] cursor-pointer hover:bg-[var(--hover)] transition-colors gap-2 text-xs",
          isExpanded && "bg-[var(--hover)]"
        )}
      >
        {/* Chevron */}
        <div className="flex items-center justify-center text-[var(--text-3)]">
          <ChevronRight 
            size={15} 
            className={cn("transition-transform duration-150", isExpanded && "rotate-90 text-[var(--text)]")} 
          />
        </div>

        {/* NT Number & Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-medium text-xs text-[var(--text)] tracking-tight truncate">
            {nt.nt_number}
          </span>
          <button
            type="button"
            onClick={handleCopyNT}
            className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Copiar NT"
          >
            {copied ? <Check size={12} className="text-[var(--green)]" /> : <Copy size={12} />}
          </button>
        </div>

        {/* Rota / Destino */}
        <div className="text-[var(--text-2)] font-medium truncate">
          <span className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[11px]">
            Pesagem
          </span>
        </div>

        {/* Turno */}
        <div className="text-[var(--text-3)] font-mono text-[11px]">
          T1
        </div>

        {/* Progresso de Pesagem */}
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-[100px] h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                isComplete ? "bg-[var(--green)]" : "bg-[var(--accent)]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-[var(--text-2)] tabular-nums">
            {paidItems}/{totalItems} ({progress}%)
          </span>
        </div>

        {/* Horário / Aging */}
        <div className={cn(
          "font-mono text-[11px] truncate flex items-center gap-1",
          isDelayed ? "text-[var(--red)] font-semibold" : "text-[var(--text-3)]"
        )}>
          {isDelayed && <AlertTriangle size={11} className="shrink-0" />}
          <span>{nt.created_date} {formattedTime}</span>
        </div>

        {/* Status Pill */}
        <div>
          <span className={cn(
            "status-pill",
            isComplete ? "done" : isDelayed ? "late" : pendingItems > 0 ? "pending" : "progress"
          )}>
            <i />
            <span>
              {isComplete ? "Concluída" : isDelayed ? "Em Atraso" : "Aguardando"}
            </span>
          </span>
        </div>

        {/* Ações da Linha */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-end gap-1"
        >
          <button
            type="button"
            onClick={() => setShowAddItemModal(true)}
            className="w-6 h-6 rounded-[4px] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Adicionar item"
          >
            <Plus size={13} />
          </button>

          <button
            type="button"
            onClick={() => setShowRobotModal(true)}
            className="w-6 h-6 rounded-[4px] grid place-items-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Status dos robôs"
          >
            <Bot size={13} />
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="w-6 h-6 rounded-[4px] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Editar NT"
          >
            <Edit size={13} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="w-6 h-6 rounded-[4px] grid place-items-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Excluir NT"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Itens da NT (Accordion Detail Expandido) */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-3">
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-3)]">
                    <th className="py-1.5 px-2">Status</th>
                    <th className="py-1.5 px-2">Código</th>
                    <th className="py-1.5 px-2">Descrição do Material</th>
                    <th className="py-1.5 px-2">Lote</th>
                    <th className="py-1.5 px-2 text-right">Qtd</th>
                    <th className="py-1.5 px-2">Horário Pagamento</th>
                    <th className="py-1.5 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((item) => (
                    <NTItemRow
                      key={item.id}
                      item={item}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onToggleStatus={() => {}}
                      onSuccess={onRefresh}
                      isHighlighted={highlightedItems.includes(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[var(--text-3)]">
              Nenhum item adicionado nesta Nota Técnica.
            </div>
          )}
        </div>
      )}

      {/* Modal Adicionar Item */}
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

      {/* Modal Status do Robô */}
      {showRobotModal && (
        <RobotStatusModal
          open={showRobotModal}
          onOpenChange={setShowRobotModal}
          alerts={[]}
        />
      )}
    </div>
  );
};
