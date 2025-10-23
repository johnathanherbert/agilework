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
import { FileText, Sparkles, Loader2 } from 'lucide-react';

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
      <DialogContent className="sm:max-w-[650px] border-0 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-0 overflow-hidden">
        {/* Gradient header bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <DialogHeader className="relative p-8 pb-6 space-y-4">
          {/* Icon container with gradient */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-xl opacity-30 animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <FileText className="w-7 h-7 text-white drop-shadow-lg" />
              </div>
            </div>
            
            <div>
              <DialogTitle className="text-2xl font-black bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
                Nova Nota Técnica
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  Criação rápida com itens
                </span>
              </div>
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
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                      <Input
                        placeholder="Ex: 606349"
                        disabled={isSubmitting}
                        className="relative border-2 border-gray-200 dark:border-gray-700 rounded-xl h-12 text-base font-medium focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 bg-white dark:bg-gray-800"
                        {...field}
                      />
                    </div>
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
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                      <Textarea
                        placeholder="Exemplo:
011105	SINVASTATINA (MICRONIZADA)	30
010071	CELULOSE MIC (TIPO200)	49"
                        disabled={isSubmitting}
                        className="relative font-mono text-sm min-h-[180px] border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 bg-white dark:bg-gray-800 resize-none"
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                          const value = handleItemsDataChange(e.target.value);
                          field.onChange(value);
                        }}
                        value={field.value}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs font-semibold" />
                  {parsedItems.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
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
                className="relative overflow-hidden rounded-xl h-12 px-8 font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 group"
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                
                {/* Content */}
                <span className="relative flex items-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Criando NT...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
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