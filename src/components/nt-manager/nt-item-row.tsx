"use client";

import { useState, useEffect } from 'react';
import { NTItem, ItemStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Clock, Check, AlertCircle, AlertTriangle, Calendar } from 'lucide-react';
import { cn, calculateElapsedTime, isDelayed, formatElapsedTime, formatTimestamp, normalizeDate, debugDate, parseDateTime } from '@/lib/utils';
import { EditFieldModal } from './edit-field-modal';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { StatusSwitch } from '@/components/ui/status-switch';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

type FieldType = 'code' | 'description' | 'quantity' | 'batch' | 'status' | 'priority';

interface NTItemRowProps {
  item: NTItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onSuccess?: () => void;
}

export const NTItemRow = ({ item, onEdit, onDelete, onToggleStatus, onSuccess }: NTItemRowProps) => {
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fieldToEdit, setFieldToEdit] = useState<FieldType>('code');
  const [fieldLabel, setFieldLabel] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Função para atualizar o status diretamente
  const handleStatusChange = async (newStatus: ItemStatus) => {
    setIsUpdating(true);
    try {
      // Se estiver atualizando para "Pago", registrar o tempo de pagamento
      const updateData: any = { status: newStatus };
      
      // Se estiver marcando como pago, registrar o horário de pagamento (apenas HH:MM)
      if (newStatus === 'Pago') {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        updateData.payment_time = `${hours}:${minutes}`;
      }
      
      const { error } = await supabase
        .from('nt_items')
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Falha ao atualizar status');
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Função para deletar o item
  const handleDeleteItem = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    if (onSuccess) onSuccess();
  };
  
  // Calcular o tempo decorrido a cada minuto
  useEffect(() => {
    // Calcula o tempo inicialmente
    const calculateTime = () => {
      const time = calculateElapsedTime(item.created_at);
      setElapsedTime(time);
      setCurrentTime(Date.now());
    };

    calculateTime(); // Calcular imediatamente

    // Atualizar a cada minuto
    const interval = setInterval(calculateTime, 60000);
    
    return () => clearInterval(interval);
  }, [item.created_at]);
  
  // Verificar se há atraso (mais de 2 horas) - apenas para itens não pagos
  const delayed = item.status !== 'Pago' && isDelayed(item.created_at);
  
  // Verificar se está próximo do limite (entre 1h30 e 2h)
  const isApproachingDeadline = () => {
    if (item.status === 'Pago') return false;
    
    const oneHour30Min = 90 * 60 * 1000; // 1h30m em milissegundos
    const twoHours = 2 * 60 * 60 * 1000; // 2h em milissegundos
    const elapsed = calculateElapsedTime(item.created_at);
    
    return elapsed >= oneHour30Min && elapsed < twoHours;
  };
  
  const approachingDeadline = isApproachingDeadline();
  
  // Calcular o tempo formatado
  const formattedTime = formatElapsedTime(elapsedTime);
  
  // Calcular o tempo que levou para ser pago
  const getPaymentTime = (): { 
    timeToPayment: number, 
    wasDelayed: boolean, 
    formattedTime: string,
    timeBeforeDeadline?: string,
    timeAfterDeadline?: string,
    minutesBeforeDeadline?: number,
    minutesAfterDeadline?: number
  } => {
    if (item.status === 'Pago') {
      try {
        // Verificar se o item tem horário de pagamento registrado
        if (!item.payment_time) {
          return { timeToPayment: 0, wasDelayed: false, formattedTime: "tempo não registrado" };
        }
        
        // Usar a função parseDateTime para obter os objetos Date
        const { creationDate, paymentDate } = parseDateTime(
          item.created_date,
          item.created_time,
          item.payment_time
        );

        // Se o paymentDate for null (improvável neste ponto), retornar um erro
        if (!paymentDate) {
          console.warn(`Não foi possível processar o horário de pagamento para o item #${item.id}:`, {
            payment_time: item.payment_time
          });
          return { timeToPayment: 0, wasDelayed: false, formattedTime: "horário inválido" };
        }
        
        // Verificar se as datas são válidas
        if (isNaN(creationDate.getTime()) || isNaN(paymentDate.getTime())) {
          console.warn(`Datas inválidas para item #${item.id}:`, {
            created_date: item.created_date,
            created_time: item.created_time,
            payment_time: item.payment_time,
            creationDate: creationDate.toString(),
            paymentDate: paymentDate.toString()
          });
          return { timeToPayment: 0, wasDelayed: false, formattedTime: "horário inválido" };
        }
        
        // Calcular a diferença em milissegundos
        const timeToPayment = paymentDate.getTime() - creationDate.getTime();
        
        // Se o tempo for negativo (possível erro), usar valor absoluto para formatação
        const absoluteTimeToPayment = Math.abs(timeToPayment);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Item #${item.id} - Tempo de pagamento:`, {
            creationDate: creationDate.toISOString(),
            paymentDate: paymentDate.toISOString(),
            timeToPaymentMs: timeToPayment,
            timeToPaymentMinutes: Math.floor(timeToPayment / (1000 * 60)),
            paymentTimeFormat: item.payment_time.includes(':') && !item.payment_time.includes('/') ? 'Formato somente hora' : 'Formato completo'
          });
        }
        
        const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
        const wasDelayed = timeToPayment > twoHoursInMs; // Usar o valor real para determinar atraso
        
        // Calcular o quanto o item foi pago antes ou depois do limite
        let timeBeforeDeadline, timeAfterDeadline;
        let minutesBeforeDeadline, minutesAfterDeadline;
        
        if (wasDelayed) {
          // Tempo depois do limite de 2h
          const timeAfterTwoHours = timeToPayment - twoHoursInMs;
          timeAfterDeadline = formatElapsedTime(timeAfterTwoHours);
          minutesAfterDeadline = Math.floor(timeAfterTwoHours / 60000); // Converter para minutos
        } else {
          // Tempo antes do limite de 2h
          const timeBeforeTwoHours = twoHoursInMs - timeToPayment;
          timeBeforeDeadline = formatElapsedTime(timeBeforeTwoHours);
          minutesBeforeDeadline = Math.floor(timeBeforeTwoHours / 60000); // Converter para minutos
        }
        
        return { 
          timeToPayment: timeToPayment,
          wasDelayed, 
          formattedTime: formatElapsedTime(absoluteTimeToPayment),
          timeBeforeDeadline,
          timeAfterDeadline,
          minutesBeforeDeadline,
          minutesAfterDeadline
        };
      } catch (error) {
        console.error(`Erro ao calcular tempo de pagamento para item #${item.id}:`, error, {
          payment_time: item.payment_time,
          created_date: item.created_date,
          created_time: item.created_time
        });
        return { timeToPayment: 0, wasDelayed: false, formattedTime: "problema no cálculo" };
      }
    }
    
    return { timeToPayment: 0, wasDelayed: false, formattedTime: "" };
  };
  
  const paymentTimeInfo = getPaymentTime();
  
  // Determinar mensagem de status baseada no estado e tempo
  const getStatusMessage = (): string => {
    // Verifica se há dados de criação
    if (!item.created_date || !item.created_time) {
      return "Data de criação indisponível";
    }
    
    // Caso o item esteja pago
    if (item.status === 'Pago') {
      // Se tiver tempo de pagamento, mostra quanto tempo levou
      if (item.payment_time) {
        // Verifica se o cálculo de tempo foi bem-sucedido
        if (paymentTimeInfo.formattedTime === "tempo indisponível" || 
            paymentTimeInfo.formattedTime === "erro de cálculo" ||
            paymentTimeInfo.formattedTime === "horário inválido") {
          return `Pago (horário registrado)`;
        }
        
        // Verifica se foi pago com atraso
        if (paymentTimeInfo.wasDelayed) {
          return `Pago com atraso (${paymentTimeInfo.minutesAfterDeadline}min após 2h)`;
        } else {
          return `${paymentTimeInfo.minutesBeforeDeadline}min (pago a tempo)`;
        }
      }
      return "Pago (horário não registrado)";
    } 
    // Caso seja pagamento parcial
    else if (item.status === 'Pago Parcial') {
      if (delayed) {
        return `Parcialmente pago (Em atraso: ${formattedTime})`;
      } else if (approachingDeadline) {
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        const remaining = twoHoursInMs - elapsedTime;
        return `Parcialmente pago (Limite em ${formatElapsedTime(remaining)})`;
      } else {
        return `Parcialmente pago (${formattedTime})`;
      }
    } 
    // Caso esteja aguardando pagamento
    else {
      if (delayed) {
        return `⚠️ ATENÇÃO: Em atraso há ${formattedTime} (limite de 2h excedido)`;
      } else if (approachingDeadline) {
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        const remaining = twoHoursInMs - elapsedTime;
        return `⏰ URGENTE: Limite em apenas ${formatElapsedTime(remaining)}`;
      } else {
        return `Aguardando: ${formattedTime}`;
      }
    }
  };

  const getStatusIcon = (status: ItemStatus) => {
    switch (status) {
      case 'Ag. Pagamento':
        return <Clock className="h-4 w-4 text-red-500" />;
      case 'Pago':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'Pago Parcial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };
  
  const getStatusClass = (status: ItemStatus) => {
    switch (status) {
      case 'Ag. Pagamento':
        return delayed 
          ? 'text-white bg-red-600 dark:bg-red-700 dark:text-white font-medium' 
          : 'text-white bg-yellow-500 dark:bg-yellow-600 dark:text-white font-medium';
      case 'Pago':
        return 'text-white bg-green-600 dark:bg-green-700 dark:text-white font-medium';
      case 'Pago Parcial':
        return 'text-white bg-blue-500 dark:bg-blue-600 dark:text-white font-medium';
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  // Esta função é chamada quando um campo é clicado para edição
  const handleCellClick = (field: FieldType, label: string) => {
    // Definimos qual campo será editado e seu rótulo
    setFieldToEdit(field);
    setFieldLabel(label);
    // Abrimos o modal depois de definir o campo e rótulo
    setShowEditFieldModal(true);
    
    // Aguarde um momento antes de abrir o modal para garantir que o campo seja definido
    console.log(`Editando campo "${field}" (${label}) com valor:`, item[field]);
  };
  
  return (
    <TooltipProvider>
      <tr className={cn(
        "border-b border-border hover:bg-muted/50 transition-colors duration-200 interactive-element",
        item.priority ? "bg-amber-50/50 dark:bg-amber-900/10 border-l-2 border-amber-400 dark:border-amber-700" : ""
      )}>
        <td className="px-3 py-2.5 text-xs text-muted-foreground font-medium">{item.item_number}</td>
        <td 
          className="px-3 py-2.5 text-xs font-medium cursor-pointer hover:text-primary transition-colors duration-150 hover:underline interactive-element"
          onClick={() => handleCellClick('code', 'Código')}
        >
          {item.code}
        </td>
        <td 
          className="px-3 py-2.5 text-xs cursor-pointer hover:text-primary transition-colors duration-150 group interactive-element"
          onClick={() => handleCellClick('description', 'Descrição')}
        >
          <div className="max-w-[200px] truncate group-hover:underline">
            {item.description}
          </div>
        </td>
        <td 
          className="px-3 py-2.5 text-xs text-center cursor-pointer hover:text-primary transition-colors duration-150 interactive-element"
          onClick={() => handleCellClick('quantity', 'Quantidade')}
        >
          <div className="flex justify-center">
            <span className="bg-muted px-2 py-0.5 rounded-full min-w-[32px] text-center font-medium">
              {item.quantity}
            </span>
          </div>
        </td>
        <td 
          className="px-3 py-2.5 text-xs cursor-pointer hover:text-primary transition-colors duration-150 interactive-element"
          onClick={() => handleCellClick('batch', 'Lote')}
        >
          <span className="block">{item.batch || '-'}</span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="min-w-[120px]">
              <StatusSwitch
                value={item.status}
                onValueChange={handleStatusChange}
                disabled={isUpdating}
                size="sm"
                className="w-full interactive-element"
              />
            </div>
            
            {/* Status indicator with time info */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium whitespace-nowrap border min-w-[60px] justify-center interactive-element",
                  item.status === 'Pago' && paymentTimeInfo.wasDelayed 
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" : 
                  item.status === 'Pago' && !paymentTimeInfo.wasDelayed
                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800" : 
                  delayed 
                    ? "bg-red-100 text-red-800 border-red-300 animate-pulse dark:bg-red-950/50 dark:text-red-200 dark:border-red-700 font-bold" : 
                  approachingDeadline 
                    ? "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-200 dark:border-yellow-700 font-bold" : 
                  "bg-muted text-muted-foreground border-border"
                )}>
                  {delayed && <AlertTriangle className="h-2.5 w-2.5" />}
                  {approachingDeadline && <Clock className="h-2.5 w-2.5" />}
                  {item.status === 'Pago' && paymentTimeInfo.wasDelayed && <AlertTriangle className="h-2.5 w-2.5" />}
                  {item.status === 'Pago' && !paymentTimeInfo.wasDelayed && <Check className="h-2.5 w-2.5" />}
                  <span className="truncate">
                    {item.status === 'Pago'
                      ? (paymentTimeInfo.formattedTime === "horário inválido" || paymentTimeInfo.formattedTime === "problema no cálculo"
                         ? "OK" 
                         : paymentTimeInfo.wasDelayed 
                           ? `+${paymentTimeInfo.minutesAfterDeadline || 0}m` 
                           : `-${paymentTimeInfo.minutesBeforeDeadline || 0}m`)
                      : formattedTime || "..."
                    }
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs bg-background shadow-lg border rounded-lg p-3">
                <div className="space-y-1.5">
                  <p className={cn(
                    "font-medium text-sm",
                    delayed ? "text-destructive" : 
                    approachingDeadline ? "text-yellow-600 dark:text-yellow-400" : ""
                  )}>
                    {getStatusMessage()}
                  </p>
                  
                  {item.status === 'Pago' && (
                    <div className="flex flex-col text-xs mt-2 pt-2 border-t">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 opacity-70" />
                        <span>Criado: {item.created_date} às {item.created_time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Check className="h-3 w-3 opacity-70" />
                        <span>Pago: {item.payment_time 
                          ? (item.payment_time.includes(':') && !item.payment_time.includes('/') && !item.payment_time.includes('T')
                              ? `${item.created_date} às ${item.payment_time}`
                              : (() => {
                                  try {
                                    const { paymentDate } = parseDateTime(item.created_date, item.created_time, item.payment_time);
                                    return paymentDate ? paymentDate.toLocaleString('pt-BR', { 
                                      day: '2-digit', 
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    }) : "Formato desconhecido";
                                  } catch (e) {
                                    return "Formato inválido";
                                  }
                                })()
                            ) 
                          : "Horário não registrado"}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs mt-1">
                        <Clock className="h-3 w-3 opacity-70" />
                        <span>Duração: {paymentTimeInfo.formattedTime !== "tempo indisponível" && 
                          paymentTimeInfo.formattedTime !== "erro de cálculo" && 
                          paymentTimeInfo.formattedTime !== "horário inválido" ? 
                          paymentTimeInfo.formattedTime : 
                          "Não calculável"}</span>
                      </div>
                      
                      {paymentTimeInfo.wasDelayed !== undefined && paymentTimeInfo.formattedTime !== "horário inválido" && paymentTimeInfo.formattedTime !== "problema no cálculo" && (
                        <div className={`flex items-center gap-1.5 text-xs mt-1 ${paymentTimeInfo.wasDelayed ? 'text-destructive' : 'text-green-600'}`}>
                          {paymentTimeInfo.wasDelayed ? (
                            <>
                              <AlertTriangle className="h-3 w-3" />
                              <span>{paymentTimeInfo.minutesAfterDeadline}m após limite</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              <span>{paymentTimeInfo.minutesBeforeDeadline}m antes do limite</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {item.status !== 'Pago' && (
                    <div className="flex items-center gap-1.5 text-xs mt-2 pt-2 border-t">
                      <Calendar className="h-3 w-3 opacity-70" />
                      <span>Criado: {formatTimestamp(item.created_at)}</span>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 interactive-element" 
              onClick={() => handleCellClick('priority', 'Prioridade')}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 rounded-full hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 interactive-element" 
              onClick={handleDeleteItem}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>

      <EditFieldModal
        open={showEditFieldModal}
        onOpenChange={setShowEditFieldModal}
        onSuccess={onSuccess}
        item={item}
        fieldToEdit={fieldToEdit}
        fieldLabel={fieldLabel}
      />
      
      <DeleteConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja excluir o item "${item.description}"? Esta ação é irreversível.`}
        isDeleting={isUpdating}
        entityType="item"
        entityId={item.id}
      />
    </TooltipProvider>
  );
};