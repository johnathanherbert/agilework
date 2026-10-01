"use client";

import { NT } from '@/types';
import { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, 
  Copy, 
  Check, 
  Edit, 
  Trash2, 
  Plus
} from 'lucide-react';
import { NTItemRow } from './nt-item-row';
import { AddItemModal } from './add-item-modal';
import { parseDateTime, isItemDelayed, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

function dur(min: number): string {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

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

  // Cálculo de aging e atraso da NT
  let isDelayed = false;
  let ageText = '';
  if (!isComplete && nt.created_date) {
    try {
      const { creationDate } = parseDateTime(nt.created_date, nt.created_time || '');
      if (creationDate && !isNaN(creationDate.getTime())) {
        const diffMinutes = Math.max(0, Math.floor((Date.now() - creationDate.getTime()) / 60000));
        ageText = dur(diffMinutes);
        // NT com mais de 120 minutos (2 horas) aberta é atrasada
        isDelayed = isItemDelayed(creationDate, items[0]?.code || '');
      }
    } catch (e) {}
  }

  return (
    <article
      className={cn(
        "ntb-card group select-none",
        isDelayed && "is-delayed",
        !isDelayed && !isComplete && paidItems > 0 && "is-progress",
        isComplete && "is-complete opacity-90"
      )}
    >
      {/* Cabeçalho da NT (.ntb-h) */}
      <header
        onClick={onToggle}
        className={cn(
          "grid grid-cols-[minmax(160px,auto)_minmax(0,1fr)_140px_110px_110px] items-center gap-3 px-3.5 py-2.5 bg-[var(--surface-2)] border-b border-[var(--border)] cursor-pointer text-xs transition-colors hover:bg-[var(--hover)]",
          isExpanded && "bg-[var(--hover)]"
        )}
      >
        {/* 1. Identificador: Chevron + NT # + Copy */}
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight 
            size={14} 
            className={cn(
              "text-[var(--text-3)] transition-transform duration-150 shrink-0", 
              isExpanded && "rotate-90 text-[var(--text)]"
            )} 
          />
          <span className="font-mono font-bold text-sm tracking-tight text-[var(--text)] truncate">
            NT #{nt.nt_number}
          </span>
          <button
            type="button"
            onClick={handleCopyNT}
            className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer shrink-0"
            title="Copiar número da NT"
          >
            {copied ? <Check size={12} className="text-[var(--green)]" /> : <Copy size={12} />}
          </button>
        </div>

        {/* 2. Informações Contextuais: Rota · Turno · Criada em · Aging */}
        <div className="text-xs text-[var(--text-3)] truncate flex items-center gap-1">
          <span>Pesagem</span>
          <span>·</span>
          <span className="font-mono text-[var(--text-2)]">T1</span>
          <span>·</span>
          <span>
            criada <b className="font-mono font-medium text-[var(--text-2)]">{nt.created_date}</b>
            {nt.created_time ? ` às ${nt.created_time}` : ''}
          </span>
          {ageText && !isComplete && (
            <>
              <span>·</span>
              <span className={cn(isDelayed ? "text-[var(--red)] font-semibold" : "text-[var(--text-3)]")}>
                há {ageText}
              </span>
            </>
          )}
        </div>

        {/* 3. Barra de Progresso Compacta */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                isComplete ? "bg-[var(--green)]" : "bg-[var(--accent)]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-[var(--text-2)] tabular-nums shrink-0">
            {paidItems}/{totalItems} itens
          </span>
        </div>

        {/* 4. Status Geral da NT */}
        <div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] font-mono text-[11px] font-medium border",
              isComplete
                ? "bg-[var(--green)]/10 text-[var(--green)] border-[var(--green)]/30"
                : isDelayed
                ? "bg-[var(--red)]/10 text-[var(--red)] border-[var(--red)]/30"
                : paidItems > 0
                ? "bg-[var(--amber)]/10 text-[var(--amber)] border-[var(--amber)]/30"
                : "bg-[var(--surface)] text-[var(--text-3)] border-[var(--border)]"
            )}
          >
            <i
              className={cn(
                "w-1.5 h-1.5 rounded-full inline-block",
                isComplete
                  ? "bg-[var(--green)]"
                  : isDelayed
                  ? "bg-[var(--red)]"
                  : paidItems > 0
                  ? "bg-[var(--amber)]"
                  : "bg-[var(--text-3)]"
              )}
            />
            {isComplete
              ? "Concluída"
              : isDelayed
              ? "Em atraso"
              : paidItems > 0
              ? "Em andamento"
              : "Aguardando"}
          </span>
        </div>

        {/* 5. Ações Rápidas (.nacts) */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="nacts"
        >
          <button
            type="button"
            onClick={() => setShowAddItemModal(true)}
            title="Adicionar item à NT"
          >
            <Plus size={14} />
          </button>

          <button
            type="button"
            onClick={onEdit}
            title="Editar NT"
          >
            <Edit size={14} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="del"
            title="Excluir NT"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {/* Linha do Tempo dos Itens (.items) */}
      {isExpanded && (
        <div className="items-timeline p-2.5 space-y-1">
          {items.length > 0 ? (
            items.map((item) => (
              <NTItemRow
                key={item.id}
                item={item}
                nt={nt}
                onSuccess={onRefresh}
              />
            ))
          ) : (
            <div className="py-6 text-center text-xs text-[var(--text-3)]">
              Nenhum item cadastrado nesta Nota Técnica.
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
    </article>
  );
};

export default NTCard;
