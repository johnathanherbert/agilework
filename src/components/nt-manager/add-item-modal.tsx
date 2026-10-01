import { useState, useEffect } from 'react';
import { createNTItem } from '@/lib/firestore-helpers';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatTime, cn } from '@/lib/utils';
import { NT } from '@/types';
import { Plus, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = '';
    };
  }, []);

  // Limpar dados quando o modal fechar
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      document.body.style.pointerEvents = '';
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
      const itemsRef = collection(db, 'nt_items');
      const q = query(itemsRef, where('nt_id', '==', nt.id));
      const snapshot = await getDocs(q);
      
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
      <DialogContent
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.body.style.pointerEvents = '';
        }}
        className="sm:max-w-[620px] max-h-[88vh] p-0 overflow-hidden flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl text-[var(--text)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        {/* Cabeçalho */}
        <DialogHeader className="px-5 py-4 border-b border-[var(--border)] flex flex-row items-start justify-between bg-[var(--surface)] shrink-0">
          <div>
            <DialogTitle className="text-[15px] font-semibold text-[var(--text)] tracking-tight flex items-center gap-2">
              <span>Adicionar Itens à NT</span>
              <span className="font-mono text-xs text-[var(--text-3)] font-normal">
                (#{nt.nt_number})
              </span>
            </DialogTitle>
            <p className="text-xs text-[var(--text-3)] mt-1">
              Almoxarifado · Pesagem · Importação tabular de insumos do SAP
            </p>
          </div>
        </DialogHeader>

        {/* Conteúdo */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto px-5 py-3 space-y-4">
            {/* Campo Textarea do SAP */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs font-semibold text-[var(--text-2)]">Dados Tabulados</span>
                <span className="text-[11.5px] text-[var(--text-3)]">código, descrição e quantidade</span>
              </div>
              <textarea
                placeholder={"Exemplo:\n011105\tSINVASTATINA (MICRONIZADA)\t30\n010071\tCELULOSE MIC (TIPO200)\t49"}
                value={itemsData}
                onChange={(e) => handleItemsDataChange(e.target.value)}
                className="w-full min-h-[140px] p-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors resize-y leading-relaxed"
                disabled={isSubmitting}
              />
              <span className="text-[11.5px] text-[var(--text-3)] block">
                Cole a tabela do SAP com Ctrl+V. Múltiplas linhas serão convertidas em itens.
              </span>
            </div>

            {/* Prévia dos itens */}
            <div className="pt-1 pb-1">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-[var(--text-2)]">
                  Prévia dos Itens
                </span>
                <span className="text-[11.5px] text-[var(--text-3)] font-mono">
                  {parsedItems.length} {parsedItems.length === 1 ? 'item detectado' : 'itens detectados'}
                </span>
              </div>

              <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
                <div className="flex justify-between items-center px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)] text-[11.5px] text-[var(--text-3)]">
                  <span className="font-semibold text-[var(--text-2)]">Lista de Materiais</span>
                  <span>Status inicial: Aguardando Pagamento</span>
                </div>

                {parsedItems.length > 0 ? (
                  <div className="max-h-[160px] overflow-y-auto divide-y divide-[var(--border)]">
                    {parsedItems.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[30px_75px_1fr_60px] items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--hover)] transition-colors"
                      >
                        <span className="font-mono text-[11px] text-[var(--text-3)]">#{index + 1}</span>
                        <span className="font-mono font-medium text-[var(--text)]">{item.code}</span>
                        <span className="text-[var(--text-2)] truncate" title={item.description}>
                          {item.description}
                        </span>
                        <span className="text-right font-mono font-semibold text-[var(--text)]">
                          {item.quantity} kg
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 px-4 text-center text-xs text-[var(--text-3)]">
                    Nenhum item detectado. Digite ou cole dados acima.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <span className="flex-1 text-[11.5px] text-[var(--text-3)]">
              <kbd className="font-mono text-[10.5px] border border-[var(--border-strong)] rounded px-1.5 py-0.5 text-[var(--text-2)]">Ctrl</kbd>+<kbd className="font-mono text-[10.5px] border border-[var(--border-strong)] rounded px-1.5 py-0.5 text-[var(--text-2)]">Enter</kbd> salva · <kbd className="font-mono text-[10.5px] border border-[var(--border-strong)] rounded px-1.5 py-0.5 text-[var(--text-2)]">Esc</kbd> fecha
            </span>

            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || parsedItems.length === 0}
              className="h-8 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adicionando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar {parsedItems.length > 0 ? `${parsedItems.length} Item(ns)` : 'Itens'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}