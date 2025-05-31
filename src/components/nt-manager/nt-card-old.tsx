"use client";

import { NT } from '@/types';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit, Trash2, PlusCircle, AlertTriangle, Clock, Check, Package, CheckCircle2 } from 'lucide-react';
import { NTItemRow } from './nt-item-row';
import { normalizeDate, calculateElapsedTime, parseDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useState, useEffect } from 'react';
import { AddItemModal } from './add-item-modal';

interface NTCardProps {
  nt: NT;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const NTCard = ({ nt, isExpanded, onToggle, onEdit, onDelete }: NTCardProps) => {
  // Estado para controlar o modal de adicionar item
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  
  // Get status counts and check for delays
  const getStatusCounts = () => {
    if (!nt.items || nt.items.length === 0) {
      return { 
        pendingCount: 0, 
        paidCount: 0, 
        paidOnTimeCount: 0,
        paidWithDelayCount: 0,
        partialCount: 0, 
        delayedCount: 0,
        completionPercentage: 0,
        total: 0 
      };
    }
    
    const pendingCount = nt.items.filter(item => item.status === 'Ag. Pagamento').length;
    const paidCount = nt.items.filter(item => item.status === 'Pago').length;
    const partialCount = nt.items.filter(item => item.status === 'Pago Parcial').length;
    
    // Calcular quantos itens estão em atraso (apenas itens não pagos)
    const delayedCount = nt.items.filter(item => {
      // Verifica se o item está em atraso (mais de 2 horas) e NÃO está pago
      // Apenas itens com status diferente de "Pago" são considerados em atraso
      if (item.status !== 'Pago') {
        const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
        
        try {
          // Converter a data/hora de criação para um objeto Date
          const [day, month, year] = item.created_date.split('/').map(Number);
          const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
          
          // Criar a data de criação - mês em JavaScript é 0-indexed (janeiro = 0)
          const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
          
          // Se a data é inválida, não considerar como atrasado
          if (isNaN(creationDate.getTime())) return false;
          
          const elapsed = Date.now() - creationDate.getTime();
          return elapsed > twoHoursInMs;
        } catch (error) {
          console.warn('Erro ao calcular atraso para item não pago:', item.id, error);
          return false;
        }
      }
      // Itens já pagos nunca são considerados como "em atraso", mesmo que tenham sido pagos após o prazo
      return false;
    }).length;
    
    // Calcular quantos itens foram pagos com atraso
    const paidWithDelayCount = nt.items.filter(item => {
      if (item.status === 'Pago' && item.payment_time) {
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        
        try {
          // Usar a função parseDateTime para obter os objetos Date
          const { creationDate, paymentDate } = parseDateTime(
            item.created_date,
            item.created_time,
            item.payment_time
          );
          
          // Se o paymentDate for null ou qualquer data for inválida, não considerar como pago com atraso
          if (!paymentDate || isNaN(creationDate.getTime()) || isNaN(paymentDate.getTime())) return false;
          
          const timeToPayment = paymentDate.getTime() - creationDate.getTime();
          return timeToPayment > twoHoursInMs;
        } catch (error) {
          console.warn('Erro ao calcular atraso para item pago:', item.id, error);
          return false;
        }
      }
      return false;
    }).length;

    // Itens pagos no prazo (sem atraso)
    const paidOnTimeCount = paidCount - paidWithDelayCount;
    
    // Calcular a porcentagem de conclusão (100% se todos pagos, 0% se nenhum pago, parcial se alguns pagos)
    const total = nt.items.length;
    const completionValue = paidCount + (partialCount * 0.5); // Cada item parcial conta como metade
    const completionPercentage = total > 0 ? Math.round((completionValue / total) * 100) : 0;
    
    return {
      pendingCount,
      paidCount,
      paidOnTimeCount,
      paidWithDelayCount,
      partialCount,
      delayedCount,
      completionPercentage,
      total: nt.items.length,
    };
  };
  
  const { pendingCount, paidCount, paidOnTimeCount, paidWithDelayCount, partialCount, delayedCount, completionPercentage, total } = getStatusCounts();

  // Determinar o status atual da NT com cores mais evidentes
  const getNTStatus = () => {
    if (total === 0) return { 
      label: "Vazia", 
      variant: "secondary",
      icon: null,
      color: "gray" 
    };
    if (completionPercentage === 100) return { 
      label: "Concluída", 
      variant: "success",
      icon: CheckCircle2,
      color: "green" 
    };
    if (delayedCount > 0) return { 
      label: "Em atraso", 
      variant: "destructive",
      icon: AlertTriangle,
      color: "red" 
    };
    if (completionPercentage > 0) return { 
      label: "Em progresso", 
      variant: "warning",
      icon: Clock,
      color: "blue" 
    };
    return { 
      label: "Pendente", 
      variant: "outline",
      icon: Clock,
      color: "yellow" 
    };
  };

  const ntStatus = getNTStatus();

  // Determinar cores da borda baseado no status da NT (inspirado no componente de referência)
  const getBorderColor = () => {
    if (delayedCount > 0) return "border-l-4 border-l-orange-500 dark:border-l-orange-400";
    if (ntStatus.color === 'green') return "border-l-4 border-l-green-500 dark:border-l-green-600";
    if (ntStatus.color === 'blue') return "border-l-4 border-l-blue-500 dark:border-l-blue-600";
    if (ntStatus.color === 'yellow') return "border-l-4 border-l-yellow-500 dark:border-l-yellow-600";
    return "border-l-4 border-l-red-500 dark:border-l-red-600";
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-shadow duration-200 hover:shadow-md ${getBorderColor()}`}>
      {/* Ícone de atraso no canto superior direito */}
      {delayedCount > 0 && (
        <div className="absolute top-3 right-3 z-30">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative cursor-help">
                  {/* Ícone principal */}
                  <div className="relative w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-sm">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  {/* Badge de contador */}
                  <div className="absolute -top-1 -right-1 bg-orange-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {delayedCount}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <div className="text-xs">
                  <p className="font-bold text-orange-600 dark:text-orange-400">
                    {delayedCount} {delayedCount === 1 ? 'item em atraso' : 'itens em atraso'}
                  </p>
                  <p className="text-orange-500 dark:text-orange-400">
                    Prazo excedido em mais de 2 horas
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {/* Header com design limpo */}
      <div 
        className={`relative p-4 flex items-center justify-between cursor-pointer transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800 ${
          delayedCount > 0 
            ? "bg-orange-50/50 dark:bg-orange-950/20" 
            : ""
        }`}
        onClick={onToggle}
      >        
        <div className="relative flex items-center gap-3 flex-1 z-10">
          {/* Ícone NT simplificado */}
          <div className="relative h-12 w-12 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative w-full h-full">
                    {/* Background simples */}
                    <div className={`absolute inset-0 rounded-lg ${
                      ntStatus.color === 'green' ? 'bg-green-100 dark:bg-green-900/30'
                      : ntStatus.color === 'red' ? 'bg-red-100 dark:bg-red-900/30'
                      : ntStatus.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30'
                      : ntStatus.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30'
                      : 'bg-gray-100 dark:bg-gray-900/30'
                    } border border-gray-200 dark:border-gray-700`}></div>
                    
                    {/* Progress ring simples */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 48 48">
                      {/* Background ring */}
                      <circle 
                        cx="24" cy="24" r="20" 
                        fill="none" 
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      
                      {/* Progress ring */}
                      {total > 0 && (
                        <circle 
                          cx="24" cy="24" r="20" 
                          fill="none" 
                          stroke="currentColor"
                          strokeWidth="3" 
                          strokeLinecap="round"
                          strokeDasharray={125.6}
                          strokeDashoffset={125.6 - (125.6 * completionPercentage) / 100}
                          className={`${
                            ntStatus.color === 'green' ? 'text-green-500 dark:text-green-400'
                            : ntStatus.color === 'red' ? 'text-red-500 dark:text-red-400'
                            : ntStatus.color === 'blue' ? 'text-blue-500 dark:text-blue-400'
                            : ntStatus.color === 'yellow' ? 'text-yellow-500 dark:text-yellow-400'
                            : 'text-gray-500 dark:text-gray-400'
                          } transition-all duration-300`}
                        />
                      )}
                    </svg>
                    
                    {/* Texto NT */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-lg font-bold ${
                        ntStatus.color === 'green' ? 'text-green-700 dark:text-green-300'
                        : ntStatus.color === 'red' ? 'text-red-700 dark:text-red-300'
                        : ntStatus.color === 'blue' ? 'text-blue-700 dark:text-blue-300'
                        : ntStatus.color === 'yellow' ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        NT
                      </span>
                    </div>
                    
                    {/* Badge de progresso */}
                    {total > 0 && (
                      <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full px-1.5 py-0.5 text-[9px] font-semibold border border-gray-200 dark:border-gray-600">
                        <span className={`${
                          ntStatus.color === 'green' ? 'text-green-600 dark:text-green-400'
                          : ntStatus.color === 'red' ? 'text-red-600 dark:text-red-400'
                          : ntStatus.color === 'blue' ? 'text-blue-600 dark:text-blue-400'
                          : ntStatus.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {completionPercentage}%
                        </span>
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-xs space-y-1">
                    <p className="font-medium">{completionPercentage}% concluído</p>
                    {total > 0 && (
                      <p className="text-gray-600 dark:text-gray-400">{paidCount}/{total} itens pagos</p>
                    )}
                    {delayedCount > 0 && (
                      <p className="text-orange-600 dark:text-orange-400 font-medium">
                        {delayedCount} {delayedCount === 1 ? 'item em atraso' : 'itens em atraso'}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header da NT */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Número da NT */}
                <div className={`px-3 py-1 rounded-md font-semibold text-base ${
                  delayedCount > 0 
                    ? "bg-orange-500 text-white" 
                    : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                }`}>
                  {nt.nt_number}
                </div>
                
                {/* Badge de status */}
                <Badge 
                  variant={ntStatus.variant as any} 
                  className="px-3 py-1 text-xs font-semibold"
                >
                  {ntStatus.icon && <ntStatus.icon className="h-3 w-3 mr-1" />}
                  {ntStatus.label}
                </Badge>
              </div>
              
              {/* Data */}
              <div className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md text-xs text-gray-600 dark:text-gray-400">
                {nt.created_date}
              </div>
            </div>
            
            {/* Contadores de status */}
            {total > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <TooltipProvider>
                  {/* Total de itens */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-700">
                        <Package className="h-3 w-3" />
                        <span className="font-medium">{total}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs font-medium">{total} {total === 1 ? 'item' : 'itens'} na NT</p>
                    </TooltipContent>
                  </Tooltip>
                
                  {/* Itens pendentes */}
                  {pendingCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2.5 py-1 rounded-full border border-yellow-200 dark:border-yellow-700">
                          <Clock className="h-3 w-3" /> 
                          <span className="font-medium">{pendingCount}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs font-medium">{pendingCount} {pendingCount === 1 ? 'item pendente' : 'itens pendentes'}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {/* Itens pagos */}
                  {paidCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-700">
                          <Check className="h-3 w-3" /> 
                          <span className="font-medium">{paidCount}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs font-medium">{paidCount} {paidCount === 1 ? 'item pago' : 'itens pagos'}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {/* Itens em atraso */}
                  {delayedCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2.5 py-1 rounded-full border-2 border-orange-300 dark:border-orange-600">
                          <AlertTriangle className="h-3 w-3" /> 
                          <span className="font-bold">{delayedCount}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400">{delayedCount} {delayedCount === 1 ? 'item em atraso' : 'itens em atraso'}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
         
        {/* Action buttons */}
        <div className="relative flex items-center gap-1 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }} 
            className="h-8 w-8 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="ghost" 
            size="icon" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }} 
            className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {isExpanded ? 
              <ChevronUp className="h-4 w-4" /> : 
              <ChevronDown className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>
      
      {/* Expanded content with items */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Items header */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <Package className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
              Itens ({total})
            </h4>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                setShowAddItemModal(true);
              }}
              className="h-7 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <PlusCircle className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </div>
          
          {/* Items table */}
          {nt.items && nt.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs">
                  <tr>
                    <th className="px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400">Nº</th>
                    <th className="px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400">Código</th>
                    <th className="px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400">Descrição</th>
                    <th className="px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400 text-center">Qtd</th>
                    <th className="px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400">Lote</th>
                    <th className="px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {nt.items.map((item) => (
                    <NTItemRow 
                      key={item.id}
                      item={item}
                      onEdit={() => console.log('Edit item:', item.id)}
                      onDelete={() => console.log('Delete item:', item.id)}
                      onToggleStatus={() => console.log('Toggle status for item:', item.id)}
                      onSuccess={onEdit} // Pass the NT refresh callback
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-xs bg-gray-50 dark:bg-gray-800/50 m-2 rounded-lg">
              <Package className="h-6 w-6 mx-auto text-gray-400 mb-1" />
              <p>Nenhum item adicionado a esta NT.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddItemModal(true);
                }}
                className="mt-2 text-xs h-7 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <PlusCircle className="h-3 w-3 mr-1" />
                Adicionar Item
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Add Item Modal */}
      <AddItemModal
        open={showAddItemModal}
        onOpenChange={setShowAddItemModal}
        onSuccess={onEdit}
        nt={nt}
      />
    </div>
  );
};