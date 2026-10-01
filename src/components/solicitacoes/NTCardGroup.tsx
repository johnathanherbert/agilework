"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink } from "lucide-react";
import { formatNumber, cn, parseDateTime, isItemDelayed } from "@/lib/utils";
import { ItemStatus } from "@/types";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface NTItemRowData {
  ntId: string;
  itemId: string;
  ntNumber: string;
  code?: string;
  description: string;
  quantity: number | string;
  batch?: string | null;
  status: string;
  createdDate?: string;
  createdTime?: string;
  paymentTime?: string | null;
}

interface NTCardGroupProps {
  ntNumber: string;
  items: NTItemRowData[];
  onStatusChange: (itemId: string, newStatus: ItemStatus) => Promise<void>;
  isUpdatingItemId?: string | null;
}

export const NTCardGroup: React.FC<NTCardGroupProps> = ({
  ntNumber,
  items,
  onStatusChange,
  isUpdatingItemId,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyNT = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ntNumber);
    setCopied(true);
    toast.success(`NT #${ntNumber} copiada!`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Métricas do grupo desta NT
  const totalItems = items.length;
  const paidCount = items.filter((i) => i.status === "Pago").length;
  const progressPercent = totalItems > 0 ? Math.round((paidCount / totalItems) * 100) : 0;
  const isAllPaid = totalItems > 0 && paidCount === totalItems;

  // Cálculo de atraso no nível da NT
  const firstItem = items[0];
  const createdDateStr = firstItem?.createdDate || "";
  const createdTimeStr = firstItem?.createdTime || "";

  let isDelayed = false;
  if (!isAllPaid && createdDateStr) {
    try {
      const { creationDate } = parseDateTime(createdDateStr, createdTimeStr);
      if (creationDate && !isNaN(creationDate.getTime())) {
        isDelayed = isItemDelayed(creationDate, firstItem.code || "");
      }
    } catch (e) {}
  }

  const isRealNT = Boolean(ntNumber && ntNumber !== "Sem NT");

  return (
    <article
      className={cn(
        "ntb-card select-none",
        isDelayed && "is-delayed",
        !isDelayed && !isAllPaid && paidCount > 0 && "is-progress",
        isAllPaid && "is-complete opacity-90"
      )}
    >
      {/* Cabeçalho do Card da NT (estilo .ntb-h) */}
      <header className="px-3.5 py-2.5 bg-[var(--surface-2)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {isRealNT ? (
            <Link
              href={`/almoxarifado/nts?search=${encodeURIComponent(ntNumber)}`}
              onClick={(e) => e.stopPropagation()}
              target="_blank"
              className="font-mono font-bold text-[13px] tracking-tight text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Abrir no Notas Técnicas"
            >
              <span>{ntNumber}</span>
              <ExternalLink size={12} className="opacity-70 shrink-0" />
            </Link>
          ) : (
            <span className="font-mono font-bold text-[13px] tracking-tight text-[var(--text-3)]">
              {ntNumber}
            </span>
          )}

          {isRealNT && (
            <button
              type="button"
              onClick={handleCopyNT}
              className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              title="Copiar número da NT"
            >
              {copied ? <Check size={12} className="text-[var(--green)]" /> : <Copy size={12} />}
            </button>
          )}
        </div>

        {/* Metadados: Data/Hora de Criação */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)]">
          {createdDateStr && (
            <span>
              Criada em <b className="font-mono text-[var(--text-2)]">{createdDateStr}</b>
              {createdTimeStr && ` às ${createdTimeStr}`}
            </span>
          )}

          {/* Barra de Progresso Compacta */}
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  isAllPaid ? "bg-[var(--green)]" : "bg-[var(--accent)]"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] text-[var(--text-2)] tabular-nums">
              {paidCount}/{totalItems}
            </span>
          </div>

          {/* Status Geral da NT */}
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] font-mono text-[10.5px] font-medium border",
                isAllPaid
                  ? "bg-[var(--green)]/10 text-[var(--green)] border-[var(--green)]/30"
                  : isDelayed
                  ? "bg-[var(--red)]/10 text-[var(--red)] border-[var(--red)]/30"
                  : paidCount > 0
                  ? "bg-[var(--amber)]/10 text-[var(--amber)] border-[var(--amber)]/30"
                  : "bg-[var(--surface)] text-[var(--text-3)] border-[var(--border)]"
              )}
            >
              <i
                className={cn(
                  "w-1.5 h-1.5 rounded-full inline-block",
                  isAllPaid
                    ? "bg-[var(--green)]"
                    : isDelayed
                    ? "bg-[var(--red)]"
                    : paidCount > 0
                    ? "bg-[var(--amber)]"
                    : "bg-[var(--text-3)]"
                )}
              />
              {isAllPaid
                ? "Concluída"
                : isDelayed
                ? "Em atraso"
                : paidCount > 0
                ? "Em andamento"
                : "Aguardando"}
            </span>
          </div>
        </div>
      </header>

      {/* Linha do tempo dos itens (.ntb-timeline / .it) */}
      <div className="ntb-timeline p-2 space-y-1 bg-[var(--surface)]">
        {items.map((item, idx) => {
          const isPaid = item.status === "Pago";
          const isPartial = item.status === "Pago Parcial";
          const isPending = !isPaid && !isPartial;
          const isUpdating = isUpdatingItemId === item.itemId;

          // Verificar atraso específico do item
          let itemDelayed = false;
          if (!isPaid && item.createdDate) {
            try {
              const { creationDate } = parseDateTime(item.createdDate, item.createdTime || "");
              if (creationDate && !isNaN(creationDate.getTime())) {
                itemDelayed = isItemDelayed(creationDate, item.code || "");
              }
            } catch (e) {}
          }

          const isControlled = item.description?.includes("**") || item.code === "011833" || item.code === "011543";
          const cleanDesc = (item.description || "").replace(/\*\*/g, "").trim();

          return (
            <ContextMenu key={`${item.itemId}_${idx}`}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    "grid grid-cols-[22px_68px_minmax(180px,1fr)_88px_96px_100px] items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius)] transition-colors text-xs hover:bg-[var(--hover)] group",
                    isPaid && "opacity-75"
                  )}
                >
                  {/* Ponto / Nó de status (Timeline Node) */}
                  <div className="flex justify-center items-center">
                    <span
                      className={cn(
                        "nt-node",
                        isPaid ? "paid" : isPartial ? "partial" : itemDelayed ? "delayed" : ""
                      )}
                    />
                  </div>

                  {/* Código do Material */}
                  <div className="font-mono text-xs font-semibold text-[var(--text)]">
                    {item.code || "—"}
                  </div>

                  {/* Descrição com tag de Controlado */}
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate font-medium text-[var(--text)]" title={cleanDesc}>
                        {cleanDesc}
                      </span>
                      {isControlled && (
                        <span className="px-1 py-0.2 rounded text-[10px] font-semibold text-[var(--amber)] border border-[var(--amber)]/40 bg-[var(--amber)]/10 shrink-0">
                          Controlado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lote */}
                  <div className="font-mono text-[11px] text-[var(--text-3)] truncate">
                    {item.batch ? `L: ${item.batch}` : "—"}
                  </div>

                  {/* Quantidade */}
                  <div className="text-right font-mono font-bold text-xs text-[var(--text)]">
                    {typeof item.quantity === "number"
                      ? formatNumber(item.quantity, 3)
                      : item.quantity}{" "}
                    <small className="text-[10px] font-normal text-[var(--text-3)]">kg</small>
                  </div>

                  {/* Pílula de Status com Menu Contextual Dropdown */}
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={isUpdating}
                          className={cn(
                            "status-pill cursor-pointer transition-all hover:ring-1 hover:ring-[var(--border-strong)]",
                            isPaid ? "done" : isPartial ? "progress" : itemDelayed ? "late" : "pending"
                          )}
                          title="Clique para alterar status"
                        >
                          <i />
                          <span>
                            {isUpdating
                              ? "Salvando..."
                              : isPaid
                              ? "Pago"
                              : isPartial
                              ? "Parcial"
                              : itemDelayed
                              ? "Atrasado"
                              : "Pendente"}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-[11px] font-semibold text-[var(--text-3)]">
                          Alterar Status
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onStatusChange(item.itemId, "Pago")}
                          className="text-xs flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <i className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
                            <span>Pago</span>
                          </span>
                          {isPaid && <Check size={13} className="text-[var(--green)]" />}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => onStatusChange(item.itemId, "Ag. Pagamento")}
                          className="text-xs flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <i className="w-2 h-2 rounded-full bg-[var(--amber)] inline-block" />
                            <span>Ag. Pagamento</span>
                          </span>
                          {isPending && <Check size={13} className="text-[var(--amber)]" />}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => onStatusChange(item.itemId, "Pago Parcial")}
                          className="text-xs flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <i className="w-2 h-2 rounded-full bg-[var(--blue-500)] inline-block" />
                            <span>Pago Parcial</span>
                          </span>
                          {isPartial && <Check size={13} className="text-[var(--blue-500)]" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </ContextMenuTrigger>

              {/* Menu Contextual ao clicar com botão direito */}
              <ContextMenuContent className="w-48">
                <ContextMenuLabel className="text-[11px] font-semibold text-[var(--text-3)]">
                  Status de Pesagem
                </ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => onStatusChange(item.itemId, "Pago")}
                  className="text-xs flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <i className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
                    <span>Pago</span>
                  </span>
                  {isPaid && <Check size={13} className="text-[var(--green)]" />}
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => onStatusChange(item.itemId, "Ag. Pagamento")}
                  className="text-xs flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <i className="w-2 h-2 rounded-full bg-[var(--amber)] inline-block" />
                    <span>Ag. Pagamento</span>
                  </span>
                  {isPending && <Check size={13} className="text-[var(--amber)]" />}
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => onStatusChange(item.itemId, "Pago Parcial")}
                  className="text-xs flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <i className="w-2 h-2 rounded-full bg-[var(--blue-500)] inline-block" />
                    <span>Pago Parcial</span>
                  </span>
                  {isPartial && <Check size={13} className="text-[var(--blue-500)]" />}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    </article>
  );
};

export default NTCardGroup;
