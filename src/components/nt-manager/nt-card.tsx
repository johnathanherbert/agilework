"use client";

import { NT } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Edit, Trash2, Plus, AlertTriangle, Clock, CheckCircle2, Package, Copy, Check, Snowflake, Flame } from 'lucide-react';
import { NTItemRow } from './nt-item-row';
import { parseDateTime, getDelayInfo, isItemDelayed, getMaterialCategory } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddItemModal } from './add-item-modal';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NTCardProps {
  nt: NT;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
}

export const NTCard = ({ nt, isExpanded, onToggle, onEdit, onDelete, onRefresh }: NTCardProps) => {
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Function to copy NT number to clipboard
  const handleCopyNTNumber = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(nt.nt_number);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Check if NT is delayed
  const isNTDelayed = () => {
    try {
      const { creationDate } = parseDateTime(nt.created_date, nt.created_time);
      const { completionPercentage } = getStatusCounts();
      const delayInfo = getDelayInfo(creationDate);
      return delayInfo.isDelayed && completionPercentage < 100;
    } catch (error) {
      return false;
    }
  };

  // Get NT delay information
  const getNTDelayInfo = () => {
    try {
      const { creationDate } = parseDateTime(nt.created_date, nt.created_time);
      return getDelayInfo(creationDate);
    } catch (error) {
      return {
        isDelayed: false,
        delayTime: 0,
        formattedDelayTime: "",
        totalElapsed: 0,
        formattedTotalElapsed: ""
      };
    }
  };
  
  // Get status counts and check for delays in items
  const getStatusCounts = () => {
    if (!nt.items || nt.items.length === 0) {
      return { 
        pendingCount: 0, 
        paidCount: 0, 
        partialCount: 0, 
        delayedCount: 0,
        completionPercentage: 0,
        total: 0 
      };
    }
    
    const pendingCount = nt.items.filter(item => item.status === 'Ag. Pagamento').length;
    const paidCount = nt.items.filter(item => item.status === 'Pago').length;
    const partialCount = nt.items.filter(item => item.status === 'Pago Parcial').length;
    
    const delayedCount = nt.items.filter(item => {
      if (item.status !== 'Pago') {
        try {
          const [day, month, year] = item.created_date.split('/').map(Number);
          const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
          const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
          if (isNaN(creationDate.getTime())) return false;
          // Usar a nova função que considera a categoria do material
          return isItemDelayed(creationDate, item.code);
        } catch (error) {
          return false;
        }
      }
      return false;
    }).length;
    
    const total = nt.items.length;
    const completionValue = paidCount + (partialCount * 0.5);
    const completionPercentage = total > 0 ? Math.round((completionValue / total) * 100) : 0;
    
    return {
      pendingCount,
      paidCount,
      partialCount,
      delayedCount,
      completionPercentage,
      total,
    };
  };
  
  const { pendingCount, paidCount, partialCount, delayedCount, completionPercentage, total } = getStatusCounts();

  // Get NT status with compact color coding
  const getNTStatus = () => {
    if (total === 0) return { 
      label: "Vazia", 
      variant: "secondary" as const,
      color: "slate" 
    };
    if (completionPercentage === 100) return { 
      label: "Concluída", 
      variant: "default" as const,
      color: "emerald" 
    };
    if (delayedCount > 0) return { 
      label: "Em atraso", 
      variant: "destructive" as const,
      color: "red" 
    };
    if (completionPercentage > 0) return { 
      label: "Em progresso", 
      variant: "default" as const,
      color: "blue" 
    };
    return { 
      label: "Pendente", 
      variant: "outline" as const,
      color: "amber"
    };
  };

  const ntStatus = getNTStatus();
  const ntDelayInfo = getNTDelayInfo();
  const isDelayed = isNTDelayed();

  // Check if NT contains special category items (CFA or INF)
  const getNTCategories = () => {
    if (!nt.items || nt.items.length === 0) {
      return { hasCFA: false, hasINF: false };
    }

    const hasCFA = nt.items.some(item => getMaterialCategory(item.code) === 'CFA');
    const hasINF = nt.items.some(item => getMaterialCategory(item.code) === 'INF');

    return { hasCFA, hasINF };
  };

  const { hasCFA, hasINF } = getNTCategories();

  return (
    <TooltipProvider>      <Card 
        onClick={(e) => {
          // Prevent card click when clicking on buttons, interactive elements or form controls
          if ((e.target as HTMLElement).closest('button') || 
              (e.target as HTMLElement).closest('[role="button"]') ||
              (e.target as HTMLElement).closest('.interactive-element') ||
              (e.target as HTMLElement).closest('input') ||
              (e.target as HTMLElement).closest('select') ||
              (e.target as HTMLElement).closest('textarea') ||
              (e.target as HTMLElement).closest('label') ||
              (e.target as HTMLElement).closest('[role="dialog"]') ||
              (e.target as HTMLElement).closest('.modal') ||
              (e.target as HTMLElement).closest('dialog')) {
            return;
          }
          
          // Prevent toggling when clicking inside expanded content
          if (isExpanded && (e.target as HTMLElement).closest('.expanded-content')) {
            return;
          }
          
          onToggle();
        }}        className={cn(
          "relative overflow-hidden transition-all duration-300 hover:shadow-2xl border cursor-pointer group",
          "border-gray-200/50 dark:border-gray-700/50",
          "bg-gradient-to-br from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/50 dark:to-gray-900",
          "backdrop-blur-sm",
          // Left border color indicator with glow effect
          `border-l-[6px] hover:border-l-[8px]`,          isDelayed 
            ? "border-l-red-500 hover:border-l-red-600 dark:border-l-red-400 dark:hover:border-l-red-300 shadow-red-500/10 hover:shadow-red-500/20" 
            : delayedCount > 0 
              ? "border-l-amber-500 hover:border-l-amber-600 dark:border-l-amber-400 dark:hover:border-l-amber-300 shadow-amber-500/10 hover:shadow-amber-500/20"
              : ntStatus.color === "emerald" 
                ? "border-l-emerald-500 hover:border-l-emerald-600 dark:border-l-emerald-400 dark:hover:border-l-emerald-300 shadow-emerald-500/10 hover:shadow-emerald-500/20"
                : ntStatus.color === "blue"
                  ? "border-l-blue-500 hover:border-l-blue-600 dark:border-l-blue-400 dark:hover:border-l-blue-300 shadow-blue-500/10 hover:shadow-blue-500/20"
                  : ntStatus.color === "red"
                    ? "border-l-red-500 hover:border-l-red-600 dark:border-l-red-400 dark:hover:border-l-red-300 shadow-red-500/10 hover:shadow-red-500/20"
                    : ntStatus.color === "amber"
                      ? "border-l-amber-500 hover:border-l-amber-600 dark:border-l-amber-400 dark:hover:border-l-amber-300 shadow-amber-500/10 hover:shadow-amber-500/20"
                      : "border-l-gray-400 hover:border-l-gray-500 dark:border-l-gray-600 dark:hover:border-l-gray-500",
          // Modern card effects
          "rounded-2xl shadow-lg hover:shadow-2xl dark:shadow-black/20 dark:hover:shadow-black/30",
          "hover:scale-[1.01] hover:-translate-y-0.5",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 before:pointer-events-none"
        )}>
        {/* Subtle top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent opacity-50" />
        
        <CardHeader className="pb-3 pt-4 px-5 space-y-3 relative z-10">
          {/* Main header row */}
          <div className="flex items-center justify-between">
            {/* Left side - NT info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent tracking-tight">
                  NT {nt.nt_number}
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyNTNumber}
                      className="h-7 w-7 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/30 interactive-element transition-all duration-200 hover:scale-110 rounded-lg"
                    >
                      {isCopied ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 animate-in zoom-in duration-200" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-gray-900 dark:bg-gray-800 text-white border-gray-700">
                    <p className="text-xs font-medium">{isCopied ? '✓ Copiado!' : 'Copiar número da NT'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Modern status badge with gradient */}
              <Badge 
                variant={ntStatus.variant}
                className={cn(                  "text-xs px-3 py-1 font-bold shadow-md backdrop-blur-sm border-0 transition-all duration-200 hover:scale-105",
                  ntStatus.color === "emerald" && "bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 text-white shadow-emerald-500/30",
                  ntStatus.color === "blue" && "bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 text-white shadow-blue-500/30",
                  ntStatus.color === "amber" && "bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 text-white shadow-amber-500/30",
                  ntStatus.color === "slate" && "bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700 text-white shadow-gray-500/30",
                  ntStatus.color === "red" && "bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white shadow-red-500/30"
                )}
              >
                {ntStatus.label}
              </Badge>
            </div>

            {/* Right side - Stats and actions */}
            <div className="flex items-center gap-4">
              {/* Modern warning and category indicators */}
              <div className="flex items-center gap-2">
                {isDelayed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative w-7 h-7 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center cursor-pointer interactive-element shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-200 hover:scale-110 group">
                        <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-30" />
                        <AlertTriangle className="h-4 w-4 text-white relative z-10" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-red-600 text-white border-red-500">
                      <p className="text-xs font-bold">⚠️ NT em atraso: {ntDelayInfo.formattedDelayTime}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {delayedCount > 0 && !isDelayed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center cursor-pointer interactive-element shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-200 hover:scale-110">
                        <Clock className="h-4 w-4 text-white" />
                        {delayedCount > 1 && (
                          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-md border border-white dark:border-gray-900">
                            {delayedCount}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-amber-600 text-white border-amber-500">
                      <p className="text-xs font-bold">⏰ {delayedCount} {delayedCount === 1 ? 'item em atraso' : 'itens em atraso'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasCFA && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-cyan-500 dark:from-blue-500 dark:to-cyan-600 rounded-full flex items-center justify-center cursor-pointer interactive-element shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200 hover:scale-110">
                        <Snowflake className="h-4 w-4 text-white" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-blue-600 text-white border-blue-500">
                      <p className="text-xs font-bold">❄️ Contém itens de Câmara Fria</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasINF && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-red-500 dark:from-orange-600 dark:to-red-600 rounded-full flex items-center justify-center cursor-pointer interactive-element shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-200 hover:scale-110">
                        <Flame className="h-4 w-4 text-white" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-orange-600 text-white border-orange-500">
                      <p className="text-xs font-bold">🔥 Contém itens Inflamáveis</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Modern inline stats with icons */}
              {total > 0 && (                <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300 font-bold">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm">
                    <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>{total}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg backdrop-blur-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{completionPercentage}%</span>
                  </div>
                </div>
              )}              {/* Modern action buttons */}
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onEdit} 
                      className="h-8 w-8 p-0 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 interactive-element rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-md group"
                    >
                      <Edit className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-blue-600 text-white border-blue-500">
                    <p className="text-xs font-bold">✏️ Editar NT</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowAddItemModal(true)} 
                      className="h-8 w-8 p-0 hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 interactive-element rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-md group"
                    >
                      <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-green-600 text-white border-green-500">
                    <p className="text-xs font-bold">➕ Adicionar item</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onDelete} 
                      className="h-8 w-8 p-0 hover:bg-gradient-to-br hover:from-red-50 hover:to-pink-50 dark:hover:from-red-900/30 dark:hover:to-pink-900/30 interactive-element rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-md group"
                    >
                      <Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-red-600 text-white border-red-500">
                    <p className="text-xs font-bold">🗑️ Excluir NT</p>
                  </TooltipContent>
                </Tooltip>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onToggle} 
                  className="h-8 w-8 p-0 interactive-element rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:scale-110"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Modern progress bar and details */}
          {total > 0 && (            <div className="space-y-2">
              {/* Gradient progress bar with glow */}
              <div className="relative w-full bg-gray-200 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden shadow-inner">
                <div 
                  className={cn(
                    "h-2 rounded-full transition-all duration-700 ease-out relative",
                    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:animate-shimmer",
                    completionPercentage === 100 
                      ? "bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 dark:from-emerald-400 dark:via-green-400 dark:to-emerald-500 shadow-lg shadow-emerald-500/50" :
                    completionPercentage > 0 
                      ? "bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 dark:from-blue-400 dark:via-indigo-400 dark:to-blue-500 shadow-lg shadow-blue-500/50" : 
                    "bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-500 dark:to-gray-600"
                  )}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              {/* Modern status breakdown */}              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  {paidCount > 0 && (
                    <span className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full shadow-md shadow-emerald-500/50" />
                      {paidCount} pago{paidCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {partialCount > 0 && (
                    <span className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full shadow-md shadow-blue-500/50" />
                      {partialCount} parcial{partialCount !== 1 ? 'is' : ''}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full shadow-md shadow-amber-500/50" />
                      {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="text-gray-600 dark:text-gray-400 font-bold text-xs px-3 py-1 bg-gray-100 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm">
                  {nt.created_date} {nt.created_time?.substring(0, 5)}
                </div>
              </div>
            </div>
          )}
        </CardHeader>        {/* Expanded content */}        
        {isExpanded && (
          <CardContent className="pt-4 px-5 pb-5 expanded-content animate-in slide-in-from-top-2 duration-300">
            {/* Gradient divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mb-5 opacity-50" />
            
            {total === 0 ? (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900/30 dark:via-gray-900/20 dark:to-gray-900/30 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 backdrop-blur-sm">
                <div className="relative inline-block">
                  <Package className="h-14 w-14 mx-auto mb-3 opacity-40 animate-float" />
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-xl opacity-50" />
                </div>
                <p className="text-sm font-bold mb-2 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">Nenhum item nesta NT</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAddItemModal(true)}
                  className="interactive-element mt-3 h-9 px-6 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 border-2 hover:border-green-500 dark:hover:border-green-400 transition-all duration-200 hover:scale-105 hover:shadow-lg font-bold text-sm"
                >
                  <Plus className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                  Adicionar primeiro item
                </Button>
              </div>
            ) : (
              <div className="w-full rounded-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg bg-white dark:bg-gray-900/30">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full table-auto">
                    <thead className="bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800/50 dark:via-gray-900/30 dark:to-gray-800/50 border-b border-gray-200 dark:border-gray-700/60">
                      <tr className="text-xs text-gray-900 dark:text-gray-100">
                        <th className="py-3 px-4 text-left font-bold">#</th>
                        <th className="py-3 px-4 text-left font-bold">Código</th>
                        <th className="py-3 px-4 text-left font-bold">Descrição</th>
                        <th className="py-3 px-4 text-center font-bold">Qtd</th>
                        <th className="py-3 px-4 text-left font-bold">Lote</th>
                        <th className="py-3 px-4 text-center font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                      {nt.items?.map((item) => (
                        <NTItemRow 
                          key={item.id} 
                          item={item} 
                          onEdit={() => console.log('Edit item:', item.id)}
                          onDelete={() => {}}
                          onToggleStatus={() => console.log('Toggle status for item:', item.id)}
                          onSuccess={onRefresh}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        )}{showAddItemModal && (
          <AddItemModal
            open={showAddItemModal}
            onOpenChange={setShowAddItemModal}
            onSuccess={() => {
              onRefresh?.();
            }}
            nt={nt}
          />
        )}
      </Card>
    </TooltipProvider>
  );
};
