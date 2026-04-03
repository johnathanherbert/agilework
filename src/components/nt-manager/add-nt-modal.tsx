"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createNT, createNTItem } from '@/lib/firestore-helpers';
import { toast } from 'react-hot-toast';
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
import { FileText, Loader2 } from 'lucide-react';

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
      
      // Create the NT first
      const ntId = await createNT(data.nt_number);
      
      // Start batch operation to prevent redundant notifications
      const batchId = startBatchOperation('nt_creation', ntId, parsedItems.length);
      
      // Create items if we have parsed data
      if (parsedItems.length > 0) {
        const itemPromises = parsedItems.map((item, index) => 
          createNTItem(ntId, {
            item_number: index + 1,
            code: item.code,
            description: item.description,
            quantity: item.quantity,
            batch: null,
            created_date: brazilianDate,
            created_time: brazilianTime,
            payment_time: null,
            status: 'Ag. Pagamento',
            priority: false,
          })
        );
        
        try {
          await Promise.all(itemPromises);
        } catch (itemsError) {
          console.error('Erro ao adicionar itens:', itemsError);
        }
      }
      
      // End batch operation
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
      <DialogContent className="sm:max-w-[650px] border border-border/80 shadow-lg bg-card p-0 overflow-hidden">
        <DialogHeader className="relative p-8 pb-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
              <FileText className="w-7 h-7 text-primary-foreground" />
            </div>
            
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                Nova Nota Técnica
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Criação rápida com itens
              </p>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium pl-[72px]">
            Cole os dados dos itens diretamente do SAP. O formato esperado é: <span className="font-bold text-gray-900 dark:text-gray-100">código, descrição e quantidade</span>, separados por tabulações. Os lotes podem ser adicionados posteriormente.
          </p>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-8 pb-8">
            <FormField
              control={form.control}
              name="nt_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    Número da NT
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 606349"
                      disabled={isSubmitting}
                      className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-12 text-base font-medium focus:border-primary dark:focus:border-primary transition-all duration-200 bg-white dark:bg-gray-800"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="items_data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    Dados dos Itens
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Exemplo:
011105	SINVASTATINA (MICRONIZADA)	30
010071	CELULOSE MIC (TIPO200)	49"
                      disabled={isSubmitting}
                      className="font-mono text-sm min-h-[180px] border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:focus:border-primary transition-all duration-200 bg-white dark:bg-gray-800 resize-none"
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        const value = handleItemsDataChange(e.target.value);
                        field.onChange(value);
                      }}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold" />
                  {parsedItems.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-300/30 dark:border-green-700/30">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-bold text-green-700 dark:text-green-400">
                        {parsedItems.length} item(ns) detectado(s) e pronto(s) para criação
                      </span>
                    </div>
                  )}
                </FormItem>
              )}
            />
            
            <DialogFooter className="gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-xl h-12 font-bold border-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="rounded-xl h-12 px-8 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all duration-200 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Criando NT...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Criar NT
                    </>
                  )}
                </span>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}