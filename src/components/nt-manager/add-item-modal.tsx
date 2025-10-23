import { useState } from 'react';
import { createNTItem } from '@/lib/firestore-helpers';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatTime } from '@/lib/utils';
import { NT } from '@/types';

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  nt: NT;
}

interface ParsedItem {
  code: string;
  description: string;
  quantity: string;
}

export function AddItemModal({ open, onOpenChange, onSuccess, nt }: AddItemModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemsData, setItemsData] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);

  // Limpar dados quando o modal fechar
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setItemsData('');
      setParsedItems([]);
    }
    onOpenChange(newOpen);
  };

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
    setItemsData(value);
    const items = parseItemsData(value);
    setParsedItems(items);
  };

  async function handleSubmit() {
    if (parsedItems.length === 0) {
      toast.error('Nenhum item válido para adicionar');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get all items from this NT to find the highest item_number
      // This avoids needing a composite index (nt_id + item_number)
      const itemsRef = collection(db, 'nt_items');
      const q = query(itemsRef, where('nt_id', '==', nt.id));
      const snapshot = await getDocs(q);
      
      // Find the highest item_number
      let nextItemNumber = 1;
      snapshot.forEach((doc) => {
        const itemData = doc.data();
        if (itemData.item_number >= nextItemNumber) {
          nextItemNumber = itemData.item_number + 1;
        }
      });
      
      const now = new Date();
      const brazilianDate = formatDate(now);
      const brazilianTime = formatTime(now);
      
      // Create all items
      const createPromises = parsedItems.map((item, index) =>
        createNTItem(nt.id, {
          item_number: nextItemNumber + index,
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
      
      await Promise.all(createPromises);
      
      toast.success(`${parsedItems.length} ${parsedItems.length === 1 ? 'item adicionado' : 'itens adicionados'} com sucesso!`);
      
      setItemsData('');
      setParsedItems([]);
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao adicionar itens:', error);
      toast.error(error.message || 'Ocorreu um erro ao adicionar os itens');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Adicionar Itens à NT {nt.nt_number}
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-2">
            Cole os dados dos itens diretamente do SAP. O formato esperado é: código, descrição e quantidade, separados por tabulações.
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Dados dos Itens (cole os dados tabulados do SAP)</label>
            <Textarea
              placeholder="Exemplo:
011105	SINVASTATINA (MICRONIZADA)	30"
              value={itemsData}
              onChange={(e) => handleItemsDataChange(e.target.value)}
              className="min-h-[200px]"
              disabled={isSubmitting}
            />
          </div>
          
          {parsedItems.length > 0 && (
            <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-medium mb-2">Itens que serão adicionados ({parsedItems.length}):</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {parsedItems.map((item, index) => (
                  <div key={index} className="text-xs bg-white dark:bg-gray-700 p-2 rounded border">
                    <span className="font-mono text-blue-600 dark:text-blue-400">{item.code}</span> - {item.description} 
                    <span className="text-gray-500 ml-2">(Qtd: {item.quantity})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedItems.length === 0}
          >
            {isSubmitting ? 'Adicionando...' : `Adicionar ${parsedItems.length} Item(ns)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}