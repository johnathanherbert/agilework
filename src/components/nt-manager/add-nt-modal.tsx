"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formatDate, formatTime } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useNotifications } from '@/components/providers/notification-provider';
import type { BatchOperationType } from '@/components/providers/notification-provider';

interface AddNTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedItem {
  code: string;
  description: string;
  quantity: string;
}

const formSchema = z.object({
  nt_number: z
    .string()
    .min(1, { message: 'Número da NT é obrigatório' }),
  items_data: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function AddNTModal({ open, onOpenChange, onSuccess }: AddNTModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const { startBatchOperation, endBatchOperation } = useNotifications();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nt_number: '',
      items_data: '',
    },
  });

  // Parse tabulated data from SAP
  const parseItemsData = (text: string): ParsedItem[] => {
    if (!text.trim()) return [];

    return text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Split by tabs or multiple spaces
        const parts = line.trim().split(/\t+|\s{2,}/);
        
        if (parts.length >= 3) {
          return {
            code: parts[0].trim(),
            description: parts[1].trim(),
            quantity: parts[2].trim()
          };
        }
        return null;
      })
      .filter((item): item is ParsedItem => item !== null);
  };

  const handleItemsDataChange = (value: string) => {
    const items = parseItemsData(value);
    setParsedItems(items);
    return value;
  };

  async function onSubmit(data: FormData) {
    setIsSubmitting(true);
    
    try {
      const now = new Date();
      const brazilianDate = formatDate(now);
      const brazilianTime = formatTime(now);
      
      // Start batch operation to prevent redundant notifications
      const batchId = `nt-creation-${Date.now()}`;
      // Alteração aqui: usar o startBatchOperation do hook
      startBatchOperation(batchId, 'nt_creation' as BatchOperationType);
      
      // Create the NT
      const { data: ntData, error: ntError } = await supabase
        .from('nts')
        .insert({
          nt_number: data.nt_number,
          created_date: brazilianDate,
          created_time: brazilianTime,
          status: 'Ativa',
        })
        .select();
      
      if (ntError) {
        throw ntError;
      }
      
      // Create items if we have parsed data
      if (parsedItems.length > 0 && ntData && ntData[0]) {
        const ntId = ntData[0].id;
        
        const itemsToInsert = parsedItems.map((item, index) => ({
          nt_id: ntId,
          item_number: index + 1,
          code: item.code,
          description: item.description,
          quantity: item.quantity,
          created_date: brazilianDate,
          created_time: brazilianTime,
          status: 'Ag. Pagamento',
          priority: false,
        }));
        
        const { error: itemsError } = await supabase
          .from('nt_items')
          .insert(itemsToInsert);
          
        if (itemsError) {
          console.error('Erro ao adicionar itens:', itemsError);
          toast.error('NT criada com sucesso, mas houve erro ao adicionar alguns itens');
        } else {
          toast.success(`NT ${data.nt_number} foi criada com ${itemsToInsert.length} item(ns)!`);
        }
      } else {
        toast.success(`NT ${data.nt_number} foi criada com sucesso!`);
      }
      
      // End batch operation
      // Alteração aqui: usar o endBatchOperation do hook
      endBatchOperation(batchId);
      
      form.reset();
      setParsedItems([]);
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao criar NT:', error);
      toast.error(error.message || 'Ocorreu um erro ao criar a NT');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova Nota Técnica com Itens</DialogTitle>
          <p className="text-sm text-gray-500 mt-2">
            Cole os dados dos itens diretamente do SAP. O formato esperado é: código, descrição e quantidade, separados por tabulações. 
            Os lotes podem ser adicionados posteriormente usando a ferramenta de edição.
          </p>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="nt_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da NT</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 606349"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="items_data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dados dos Itens (cole os dados tabulados do SAP)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Exemplo:
011105	SINVASTATINA (MICRONIZADA)	30
010071	CELULOSE MIC (TIPO200)	49"
                      disabled={isSubmitting}
                      className="font-mono min-h-[150px]"
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        const value = handleItemsDataChange(e.target.value);
                        field.onChange(value);
                      }}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                  {parsedItems.length > 0 && (
                    <div className="text-sm text-green-600 dark:text-green-400 mt-2">
                      {parsedItems.length} item(ns) detectado(s)
                    </div>
                  )}
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Criando...' : 'Criar NT'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}