"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import { Loader2, PackagePlus, Trash2, Split, Lock, Copy } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createProductionItem, updateProductionItem, splitProductionItem } from '@/lib/production-helpers';
import { findWipRecipeByCode } from '@/lib/wip-recipes';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';

interface ProductionItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  tipo: ProductionTipo;
  item?: ProductionItem | null;
  defaultTurno: ProductionTurno;
  defaultVia?: ProductionVia;
  onSuccess?: () => void;
  onRequestDelete?: (item: ProductionItem) => void;
}

const formSchema = z.object({
  turno: z.string(),
  codigoReceita: z.string().optional(),
  via: z.enum(['UMIDA', 'SECA']).optional(),
  familia: z.string().optional(),
  produto: z.string().min(1, { message: 'Produto é obrigatório' }),
  prog: z.coerce.number().min(0, { message: 'Deve ser um número válido' }),
  real: z.coerce.number().min(0, { message: 'Deve ser um número válido' }),
});

type FormData = z.infer<typeof formSchema>;

const tipoLabels: Record<ProductionTipo, string> = {
  ordem: 'Ordem de Produção',
  auto: 'Pesagem Automática',
  direta: 'Pesagem Direta',
};

const turnoLabelsFull: Record<ProductionTurno, string> = {
  1: '1º Turno',
  2: '2º Turno',
  3: '3º Turno',
};

const nextTurno = (turno: ProductionTurno): ProductionTurno => ((turno % 3) + 1) as ProductionTurno;

export function ProductionItemModal({
  open,
  onOpenChange,
  mode,
  tipo,
  item,
  defaultTurno,
  defaultVia,
  onSuccess,
  onRequestDelete,
}: ProductionItemModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitQty, setSplitQty] = useState(1);
  const [splitTurno, setSplitTurno] = useState<string>('1');
  const [copyToDireta, setCopyToDireta] = useState(false);
  const [qtdCopiaDireta, setQtdCopiaDireta] = useState(1);
  const [copyToAutomatica, setCopyToAutomatica] = useState(false);
  const [qtdCopiaAutomatica, setQtdCopiaAutomatica] = useState(1);

  const isLocked = mode === 'edit' && !!item?.locked;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      turno: String(defaultTurno),
      codigoReceita: '',
      via: defaultVia || 'SECA',
      familia: '',
      produto: '',
      prog: 1,
      real: 0,
    },
  });

  // Recarrega o formulário sempre que o modal abrir com dados diferentes
  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && item) {
      form.reset({
        turno: String(item.turno),
        codigoReceita: '',
        via: item.via || 'SECA',
        familia: item.familia || '',
        produto: item.produto,
        prog: item.prog,
        real: item.real,
      });
      const remaining = Math.max(item.prog - item.real, 0);
      setSplitQty(remaining > 0 ? remaining : 1);
      setSplitTurno(String(nextTurno(item.turno)));
      setShowSplit(false);
    } else {
      form.reset({
        turno: String(defaultTurno),
        codigoReceita: '',
        via: defaultVia || 'SECA',
        familia: '',
        produto: '',
        prog: 1,
        real: 0,
      });
      setShowSplit(false);
    }
    setCopyToDireta(false);
    setQtdCopiaDireta(1);
    setCopyToAutomatica(false);
    setQtdCopiaAutomatica(1);
  }, [open, mode, item, defaultTurno, defaultVia, form]);

  // Autocompleta via, família e produto a partir do código da receita/ordem (WIP)
  const handleCodigoReceitaBlur = (codigo: string) => {
    const recipe = findWipRecipeByCode(codigo);
    if (!recipe) {
      if (codigo.trim()) {
        toast.error('Código não encontrado no WIP');
      }
      return;
    }

    form.setValue('produto', recipe.produto, { shouldValidate: true });
    if (tipo === 'ordem') {
      form.setValue('familia', recipe.familia, { shouldValidate: true });
      if (recipe.via) {
        form.setValue('via', recipe.via, { shouldValidate: true });
      }
    }
    toast.success('Dados preenchidos a partir do WIP');
  };

  // Divide a ordem: cria uma nova ordem no turno de destino com a quantidade
  // informada e trava o item atual (apenas visual) até o turno de destino
  // arrastar o item de volta para mesclar
  async function handleSplit() {
    if (!item) return;

    const remaining = Math.max(item.prog - item.real, 0);
    if (splitQty < 1 || splitQty > remaining) {
      toast.error(`Informe uma quantidade entre 1 e ${remaining} para dividir`);
      return;
    }

    setIsSplitting(true);
    try {
      const destinoTurno = Number(splitTurno) as ProductionTurno;

      await splitProductionItem(item, { turno: destinoTurno, qty: splitQty });

      toast.success(`Ordem dividida: ${splitQty} unidade(s) movida(s) para o ${turnoLabelsFull[destinoTurno]}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao dividir ordem:', error);
      toast.error(error.message || 'Ocorreu um erro ao dividir a ordem');
    } finally {
      setIsSplitting(false);
    }
  }

  async function onSubmit(data: FormData) {
    if (isLocked) {
      toast.error('Esta ordem está dividida e bloqueada para edição. Arraste o item filho de volta para destravar.');
      return;
    }

    if (tipo === 'ordem') {
      if (copyToDireta && qtdCopiaDireta < 1) {
        toast.error('Informe uma quantidade programada válida para a Pesagem Direta');
        return;
      }
      if (copyToAutomatica && qtdCopiaAutomatica < 1) {
        toast.error('Informe uma quantidade programada válida para a Pesagem Automática');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const turno = Number(data.turno) as ProductionTurno;

      if (mode === 'create') {
        await createProductionItem({
          turno,
          tipo,
          via: tipo === 'ordem' ? data.via : undefined,
          familia: tipo === 'ordem' ? (data.familia || undefined) : undefined,
          produto: data.produto,
          prog: data.prog,
          real: data.real,
        });
        toast.success('Item criado com sucesso!');
      } else if (item) {
        await updateProductionItem(item.id, {
          turno,
          via: tipo === 'ordem' ? data.via : undefined,
          familia: tipo === 'ordem' ? (data.familia || undefined) : undefined,
          produto: data.produto,
          prog: data.prog,
          real: data.real,
        });
        toast.success('Item atualizado com sucesso!');
      }

      // Copia a ordem também para Pesagem Direta e/ou Automática, como registros
      // independentes de acompanhamento (a mesma ordem pode existir nos 3 quadros)
      if (tipo === 'ordem') {
        if (copyToDireta) {
          await createProductionItem({
            turno,
            tipo: 'direta',
            produto: data.produto,
            prog: qtdCopiaDireta,
            real: 0,
          });
        }
        if (copyToAutomatica) {
          await createProductionItem({
            turno,
            tipo: 'auto',
            produto: data.produto,
            prog: qtdCopiaAutomatica,
            real: 0,
          });
        }
        if (copyToDireta || copyToAutomatica) {
          toast.success('Ordem copiada para os quadros selecionados!');
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao salvar item de produção:', error);
      toast.error(error.message || 'Ocorreu um erro ao salvar o item');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] border border-border/80 shadow-lg bg-card p-0 overflow-hidden">
        <DialogHeader className="relative p-8 pb-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
              <PackagePlus className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                {mode === 'create' ? 'Adicionar Item' : 'Editar Item'}
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                {tipoLabels[tipo]}
              </p>
            </div>
          </div>
        </DialogHeader>

        {isLocked && (
          <div className="mx-8 mb-2 flex items-start gap-3 rounded-xl border-2 border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-4">
            <Lock className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
              Esta ordem foi dividida com o {item?.splitChildId ? 'turno de destino' : 'outro turno'} e está bloqueada para edição.
              O programado permanece apenas para acompanhamento visual. Para destravar, arraste o item dividido de volta para o turno/via de origem.
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-8 pb-8">
            {tipo === 'ordem' && (
              <FormField
                control={form.control}
                name="codigoReceita"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      Código da Receita (WIP)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: 700071I"
                        disabled={isSubmitting || isLocked}
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          handleCodigoReceitaBlur(e.target.value);
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Preencha o código do material do WIP para autocompletar via, família e produto.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="turno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">Turno</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || isLocked}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1º Turno</SelectItem>
                        <SelectItem value="2">2º Turno</SelectItem>
                        <SelectItem value="3">3º Turno</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {tipo === 'ordem' && (
                <FormField
                  control={form.control}
                  name="via"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">Via de Processo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || isLocked}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="UMIDA">Úmida</SelectItem>
                          <SelectItem value="SECA">Seca</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {tipo === 'ordem' && (
              <FormField
                control={form.control}
                name="familia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">Família / Máquina</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Preenchido automaticamente pelo código da receita"
                        disabled
                        readOnly
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium bg-muted/50 cursor-not-allowed"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Bloqueado: preencha o código da receita acima para definir a família.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="produto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">Produto</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome do produto"
                      disabled={isSubmitting || isLocked}
                      className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium"
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
                name="prog"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">Qtd Programada</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        disabled={isSubmitting || isLocked}
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="real"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-gray-700 dark:text-gray-300">Qtd Realizada</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        disabled={isSubmitting || isLocked}
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {tipo === 'ordem' && !isLocked && (
              <div className="rounded-xl border-2 border-dashed border-border/80 p-4 space-y-3 bg-muted/20">
                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Copy className="h-4 w-4" />
                  Copiar ordem também para
                </p>
                <p className="text-xs text-muted-foreground -mt-2">
                  A mesma ordem pode existir no quadro normal e também na Pesagem Direta e/ou Automática, cada uma com sua própria quantidade programada.
                </p>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="copyToDireta"
                    checked={copyToDireta}
                    onCheckedChange={(checked) => setCopyToDireta(checked === true)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="copyToDireta" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                      Pesagem Direta
                    </label>
                    {copyToDireta && (
                      <Input
                        type="number"
                        min={1}
                        value={qtdCopiaDireta}
                        disabled={isSubmitting}
                        onChange={(e) => setQtdCopiaDireta(Number(e.target.value) || 0)}
                        placeholder="Qtd programada para Pesagem Direta"
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="copyToAutomatica"
                    checked={copyToAutomatica}
                    onCheckedChange={(checked) => setCopyToAutomatica(checked === true)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="copyToAutomatica" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                      Pesagem Automática
                    </label>
                    {copyToAutomatica && (
                      <Input
                        type="number"
                        min={1}
                        value={qtdCopiaAutomatica}
                        disabled={isSubmitting}
                        onChange={(e) => setQtdCopiaAutomatica(Number(e.target.value) || 0)}
                        placeholder="Qtd programada para Pesagem Automática"
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {mode === 'edit' && tipo === 'ordem' && item && !isLocked && Math.max(item.prog - item.real, 0) > 0 && (
              <div className="rounded-xl border-2 border-dashed border-border/80 p-4 space-y-3 bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowSplit((v) => !v)}
                  disabled={isSubmitting || isSplitting}
                  className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors"
                >
                  <Split className="h-4 w-4" />
                  Dividir ordem entre turnos
                </button>

                {showSplit && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Restam <strong>{Math.max(item.prog - item.real, 0)}</strong> unidade(s) programada(s) e não realizada(s).
                      Informe quantas devem ser transferidas para outro turno.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Qtd a dividir</label>
                        <Input
                          type="number"
                          min={1}
                          max={Math.max(item.prog - item.real, 0)}
                          value={splitQty}
                          disabled={isSplitting}
                          onChange={(e) => setSplitQty(Number(e.target.value) || 0)}
                          className="border-2 border-gray-200 dark:border-gray-700 rounded-xl h-11 font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Turno de destino</label>
                        <Select value={splitTurno} onValueChange={setSplitTurno} disabled={isSplitting}>
                          <SelectTrigger className="h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1º Turno</SelectItem>
                            <SelectItem value="2">2º Turno</SelectItem>
                            <SelectItem value="3">3º Turno</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isSplitting}
                      onClick={handleSplit}
                      className="w-full gap-2"
                    >
                      {isSplitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Split className="h-4 w-4" />
                      Confirmar Divisão
                    </Button>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2 flex items-center sm:justify-between gap-3">
              {mode === 'edit' && item && onRequestDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() => onRequestDelete(item)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              ) : <div />}
              <Button type="submit" disabled={isSubmitting || isLocked} className="gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
