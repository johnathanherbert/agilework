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

type FieldType = 'code' | 'description' | 'quantity' | 'batch' | 'status' | 'priority';

interface EditFieldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  item: NTItem | null;
  fieldToEdit: FieldType;
  fieldLabel: string;
}

/**
 * Dynamic schema generator based on field type
 */
const getFieldSchema = (fieldType: FieldType) => {  
  switch (fieldType) {
    case 'code':
      return z.object({
        value: z.string().min(1, { message: 'Código é obrigatório' }),
      });
    case 'description':
      return z.object({
        value: z.string().min(1, { message: 'Descrição é obrigatória' }),
      });
    case 'quantity':
      return z.object({
        value: z.string().min(1, { message: 'Quantidade é obrigatória' }),
      });
    case 'batch':
      return z.object({
        value: z.string().optional(),
        batchPaste: z.string().optional(), // For pasting multiple batch lines
      });
    case 'status':
      return z.object({
        value: z.enum(['Ag. Pagamento', 'Pago', 'Pago Parcial']),
      });
    case 'priority':
      return z.object({
        value: z.boolean().default(false),
      });
    default:
      return z.object({
        value: z.string(),
      });
  }
};

/**
 * Função para extrair informações de lote de um texto colado
 */
const parseBatchInfo = (text: string, itemCode?: string): string | null => {
  // Se não houver texto ou código do item, não podemos extrair
  if (!text || !itemCode) return null;
  
  // Procura por uma linha que contenha o código do item
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.includes(itemCode)) {
      // Divide pela barra vertical | ou por múltiplos espaços
      const parts = line.split(/\||\s{2,}/);
      
      // Verifica se temos 3 partes (código, descrição, lote)
      if (parts.length >= 3) {
        const batch = parts[2].trim();
        return batch;
      }
    }
  }
  
  return null;
};

export function EditFieldModal({ 
  open, 
  onOpenChange, 
  onSuccess, 
  item, 
  fieldToEdit, 
  fieldLabel 
}: EditFieldModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Generate schema based on field type
  const formSchema = getFieldSchema(fieldToEdit);
  type FormData = z.infer<typeof formSchema>;
  
  // Get initial field value
  const getInitialValue = () => {
    if (!item) return '';
    
    if (fieldToEdit === 'priority') {
      return item.priority;
    }
    
    const value = item[fieldToEdit];
    return value !== null && value !== undefined ? value : '';
  };
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: getInitialValue(),
    },
  });
  
  // Atualizar o formulário quando o modal é aberto ou o campo muda
  useEffect(() => {
    if (open && item) {
      // Reset do formulário com o valor atual do campo selecionado
      form.reset({ 
        value: getInitialValue() 
      });
    }
  }, [open, item, fieldToEdit, form]);

  async function onSubmit(data: FormData) {
    if (!item) return;
    setIsSubmitting(true);
    
    try {
      // Handle special case for payment_time when status is changing to Pago
      let updateData: any = {};
      // If status is changing to Pago, automatically set payment_time
      if (fieldToEdit === 'status' && data.value === 'Pago' && 
          (item.status !== 'Pago' || !item.payment_time)) {
        updateData.payment_time = new Date().toISOString();
      }
      
      // Set the updated field
      updateData[fieldToEdit] = data.value;
      
      // Add updated_at timestamp
      updateData.updated_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('nt_items')
        .update(updateData)
        .eq('id', item.id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Campo atualizado com sucesso!');
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error(`Erro ao atualizar ${fieldLabel}:`, error);
      toast.error(error.message || `Ocorreu um erro ao atualizar ${fieldLabel.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const renderField = () => {
    switch (fieldToEdit) {
      case 'status':
        return (
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fieldLabel}</FormLabel>
                <FormControl>
                  <StatusSwitch
                    value={field.value as ItemStatus}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'priority':
        return (
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                <div className="space-y-0.5">
                  <FormLabel>{fieldLabel}</FormLabel>
                  <FormDescription>
                    Marque para destacar este item
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        );
      
      case 'batch':
        return (
          <>
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{fieldLabel}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`Ex: M4N3457`}
                      disabled={isSubmitting}
                      {...field}
                      value={typeof field.value === 'string' ? field.value : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="batchPaste"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cola o lote no campo para adicionar ao item.</FormLabel>
                </FormItem>
              )}
            />
          </>
        );
      
      default:
        return (
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fieldLabel}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={`Digite ${fieldLabel.toLowerCase()}`}
                    disabled={isSubmitting}
                    {...field}
                    value={typeof field.value === 'string' ? field.value : ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            Editar {fieldLabel}
            {item && ` do Item #${item.item_number}`}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {renderField()}
            
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


