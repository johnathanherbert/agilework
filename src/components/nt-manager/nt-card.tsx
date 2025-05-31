"use client";

import { NT } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Edit, Trash2, Plus, AlertTriangle, Clock, CheckCircle2, Package } from 'lucide-react';
import { NTItemRow } from './nt-item-row';
import { parseDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddItemModal } from './add-item-modal';
import { useState } from 'react';

interface NTCardProps {
  nt: NT;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const NTCard = ({ nt, isExpanded, onToggle, onEdit, onDelete }: NTCardProps) => {
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  
  // Get status counts and check for delays
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
    
    // Calculate delayed items (only unpaid items)
    const delayedCount = nt.items.filter(item => {
      if (item.status !== 'Pago') {
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        
        try {
          const [day, month, year] = item.created_date.split('/').map(Number);
          const [hours, minutes, seconds] = item.created_time.split(':').map(Number);
          
          const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
          
          if (isNaN(creationDate.getTime())) return false;
          
          const elapsed = Date.now() - creationDate.getTime();
          return elapsed > twoHoursInMs;
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

  // Get NT status
  const getNTStatus = () => {
    if (total === 0) return { 
      label: "Vazia", 
      variant: "secondary" as const,
      color: "gray" 
    };
    if (completionPercentage === 100) return { 
      label: "Concluída", 
      variant: "default" as const,
      color: "green" 
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
      color: "yellow" 
    };
  };

  const ntStatus = getNTStatus();

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      delayedCount > 0 ? 'border-l-4 border-l-orange-500' : ''
    }`}>
      <CardHeader className="pb-3">
        {/* Delayed items warning */}
        {delayedCount > 0 && (
          <div className="absolute top-3 right-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div className="absolute -top-1 -right-1 bg-orange-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {delayedCount}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-medium">
                    {delayedCount} {delayedCount === 1 ? 'item em atraso' : 'itens em atraso'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex items-center space-x-3">
            {/* NT Number */}
            <div className={`px-3 py-1.5 rounded-lg font-semibold text-lg ${
              delayedCount > 0 
                ? "bg-orange-100 text-orange-900 border border-orange-200" 
                : "bg-primary/10 text-primary border border-primary/20"
            }`}>
              {nt.nt_number}
            </div>
            
            {/* Status Badge */}
            <Badge variant={ntStatus.variant} className="capitalize">
              {ntStatus.label}
            </Badge>
            
            {/* Progress indicator */}
            {total > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      ntStatus.color === 'green' ? 'bg-green-500' :
                      ntStatus.color === 'blue' ? 'bg-blue-500' :
                      ntStatus.color === 'red' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {completionPercentage}%
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Item counts */}
            {total > 0 && (
              <div className="flex items-center space-x-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1 text-xs bg-muted px-2 py-1 rounded-full">
                        <Package className="h-3 w-3" />
                        <span>{total}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{total} itens no total</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {paidCount > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{paidCount}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{paidCount} itens pagos</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {pendingCount > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                          <Clock className="h-3 w-3" />
                          <span>{pendingCount}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{pendingCount} itens pendentes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {delayedCount > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full border border-orange-300">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="font-bold">{delayedCount}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-bold">{delayedCount} itens em atraso</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center space-x-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
              >
                {isExpanded ? 
                  <ChevronUp className="h-4 w-4" /> : 
                  <ChevronDown className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Date and basic info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
          <span>Criada em {nt.created_date}</span>
          {nt.created_time && (
            <span>às {nt.created_time}</span>
          )}
        </div>
      </CardHeader>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t border-border pt-4">
            {/* Items header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center">
                <Package className="h-4 w-4 mr-2" />
                Itens ({total})
              </h4>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddItemModal(true);
                }}
                className="h-8"
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </div>
              {/* Items table */}
            {nt.items && nt.items.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden bg-background">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left w-12">Nº</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left w-20">Código</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left min-w-[200px]">Descrição</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-center w-16">Qtd</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left w-20">Lote</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left w-32">Status</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-center w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nt.items.map((item) => (
                        <NTItemRow 
                          key={item.id}
                          item={item}
                          onEdit={() => console.log('Edit item:', item.id)}
                          onDelete={() => console.log('Delete item:', item.id)}
                          onToggleStatus={() => console.log('Toggle status for item:', item.id)}
                          onSuccess={onEdit}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">Nenhum item adicionado a esta NT</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddItemModal(true);
                  }}
                  className="mt-3"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar primeiro item
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
      
      {/* Add Item Modal */}
      <AddItemModal
        open={showAddItemModal}
        onOpenChange={setShowAddItemModal}
        onSuccess={onEdit}
        nt={nt}
      />
    </Card>
  );
};
