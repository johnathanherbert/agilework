"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { NT, NTItem } from '@/types';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { formatDate, formatTime } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useNotifications } from '@/components/providers/notification-provider';

interface AddBulkNTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const formSchema = z.object({
  nt_number: z
    .string()
    .min(1, { message: 'Número da NT é obrigatório' }),
  sap_data: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ParsedItem {
  code: string;
  description: string;
  quantity: string;
  batch?: string;
}

export function AddBulkNTModal({ open, onOpenChange, onSuccess }: AddBulkNTModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const { startBatchOperation, endBatchOperation } = useNotifications();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nt_number: '606349', // Número predefinido conforme solicitado
      sap_data: '',
    },
  });

  const watchSapData = form.watch('sap_data');

  useEffect(() => {
    if (watchSapData) {
      // Parse the SAP data (tab or space separated)
      const items: ParsedItem[] = [];
      const lines = watchSapData.trim().split('\n');
      
      for (const line of lines) {
        // Find the first space/tab after the code
        const parts = line.trim().split(/\s+/);
        
        if (parts.length >= 3) {
          const code = parts[0];
          const quantity = parts[parts.length - 1];
          // Join middle parts as description
          const description = parts.slice(1, parts.length - 1).join(' ');
          
          items.push({
            code,
            description,
            quantity,
          });
        }
      }
      
      setParsedItems(items);
    } else {
      setParsedItems([]);
    }
  }, [watchSapData]);
  async function onSubmit(data: FormData) {
    if (parsedItems.length === 0) {
      toast.error('Nenhum item válido para importação');
      return;
    }
    
    setIsSubmitting(true);
    
    try {      // First create the NT
      const now = new Date();
      const brazilianDate = formatDate(now);
      const brazilianTime = formatTime(now);
      
      const { data: ntData, error: ntError } = await supabase.from('nts').insert({
        nt_number: data.nt_number,
        created_date: brazilianDate,
        created_time: brazilianTime,
        status: 'Ativa',
      }).select();
      
      if (ntError) {
        throw ntError;
      }
      
      if (!ntData || ntData.length === 0) {
        throw new Error('Erro ao criar NT');
      }
      
      const nt = ntData[0];
      
      // Start batch operation to prevent redundant notifications
      const batchId = startBatchOperation('nt_creation', nt.id, parsedItems.length);
      
      // Then add all items
      const items = parsedItems.map((item, index) => ({
        nt_id: nt.id,
        item_number: index + 1,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        batch: item.batch || null,
        created_date: brazilianDate,
        created_time: brazilianTime,
        status: 'Ag. Pagamento',
        priority: false,
      }));
      
      const { error: itemsError } = await supabase.from('nt_items').insert(items);
      
      if (itemsError) {
        throw itemsError;
      }
      
      toast.success(`NT ${data.nt_number} foi criada com ${items.length} itens!`);
      
      // End batch operation
      endBatchOperation(batchId);
      
      form.reset({
        nt_number: '606349',
        sap_data: '',
      });
      setParsedItems([]);
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao criar NT com itens:', error);
      toast.error(error.message || 'Ocorreu um erro ao criar a NT');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova NT com Dados do SAP</DialogTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cole os dados tabulados diretamente do SAP
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
              name="sap_data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dados do SAP</FormLabel>
                  <FormDescription>
                    Cole os dados tabulados do SAP aqui (código, descrição, quantidade)
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="Exemplo:
011105	SINVASTATINA (MICRONIZADA)	30
010071	CELULOSE MIC (TIPO200)	49"
                      className="h-40 font-mono"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {parsedItems.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Itens Detectados: {parsedItems.length}</h3>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Código</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descrição</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {parsedItems.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                          <td className="px-4 py-2 text-sm">{item.code}</td>
                          <td className="px-4 py-2 text-sm">{item.description}</td>
                          <td className="px-4 py-2 text-sm">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || parsedItems.length === 0}
                className="ml-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  `Criar NT com ${parsedItems.length} Itens`
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
