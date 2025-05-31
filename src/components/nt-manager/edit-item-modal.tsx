   "use client";

import { useState, useEffect } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StatusSwitch } from '@/components/ui/status-switch';
import { NTItem, ItemStatus } from '@/types';

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  item: NTItem | null;
}

const formSchema = z.object({
  code: z
    .string()
    .min(1, { message: 'Código é obrigatório' }),
  description: z
    .string()
    .min(1, { message: 'Descrição é obrigatória' }),
  quantity: z
    .string()
    .min(1, { message: 'Quantidade é obrigatória' }),
  batch: z.string().optional(),
  status: z.enum(['Ag. Pagamento', 'Pago', 'Pago Parcial']),
  payment_time: z.string().optional(),
  priority: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export function EditItemModal({ open, onOpenChange, onSuccess, item }: EditItemModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      description: '',
      quantity: '',
      batch: '',
      status: 'Ag. Pagamento' as ItemStatus,
      payment_time: '',
      priority: false,
    },
  });
  
  // Update form when item changes
  useEffect(() => {
    if (item) {
      form.reset({
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        batch: item.batch || '',
        status: item.status,
        payment_time: item.payment_time || '',
        priority: item.priority,
      });
    }
  }, [item, form]);

  async function onSubmit(data: FormData) {
    if (!item) return;
    setIsSubmitting(true);
    
    try {
      // If status changed to Pago, set payment time
      let payment_time = data.payment_time;
      if (data.status === 'Pago' && (!payment_time || payment_time.trim() === '')) {
        const now = new Date();
        payment_time = now.toLocaleTimeString('pt-BR');
      }
      
      const { error } = await supabase
        .from('nt_items')
        .update({
          code: data.code,
          description: data.description,
          quantity: data.quantity,
          batch: data.batch || null,
          status: data.status,
          payment_time: payment_time || null,
          priority: data.priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Item atualizado com sucesso!');
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar item:', error);
      toast.error(error.message || 'Ocorreu um erro ao atualizar o item');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Editar Item
            {item && ` #${item.item_number}`}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: 123456"
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
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: 2"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Descrição do item"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="batch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lote</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Opcional"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <StatusSwitch
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Pagamento</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Automático quando pago"
                        disabled={isSubmitting || form.getValues('status') === 'Ag. Pagamento'}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Preenchido automaticamente quando o status muda para Pago
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3 mt-auto">
                    <div className="space-y-0.5">
                      <FormLabel>Item Prioritário</FormLabel>
                      <FormDescription>
                        Marque para destacar este item
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}