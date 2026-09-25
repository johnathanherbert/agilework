"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SolicitacaoFormData, ListaTecnicaItem, SaldoMP } from "@/types/solicitacao";
import { Send, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  codigo_mp: z.string().min(1, "Código MP é obrigatório"),
  nome_mp: z.string().min(1, "Nome MP é obrigatório"),
  quantidade_solicitada: z.coerce.number().min(0.01, "Quantidade deve ser maior que zero"),
  unidade: z.string().min(1, "Unidade é obrigatória"),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  solicitante: z.string().min(1, "Solicitante é obrigatório"),
  data_necessidade: z.string().min(1, "Data de necessidade é obrigatória"),
  produto_destino: z.string().optional(),
  observacoes: z.string().optional(),
});

interface SolicitacaoFormProps {
  onSubmit: (data: SolicitacaoFormData) => void;
  listaTecnica: ListaTecnicaItem[];
  saldoMP: SaldoMP[];
  isLoading: boolean;
}

export function SolicitacaoForm({ onSubmit, listaTecnica, saldoMP, isLoading }: SolicitacaoFormProps) {
  const [searchMP, setSearchMP] = useState("");
  const [selectedMP, setSelectedMP] = useState<ListaTecnicaItem | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const form = useForm<SolicitacaoFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo_mp: "",
      nome_mp: "",
      quantidade_solicitada: 0,
      unidade: "kg",
      prioridade: "media",
      solicitante: "",
      data_necessidade: new Date().toISOString().split("T")[0],
      produto_destino: "",
      observacoes: "",
    },
  });

  // Get unique materia_prima entries for autocomplete
  const uniqueMP = useMemo(() => {
    const map = new Map<string, ListaTecnicaItem>();
    listaTecnica.forEach((item) => {
      if (!map.has(item.materia_prima)) {
        map.set(item.materia_prima, item);
      }
    });
    return Array.from(map.values());
  }, [listaTecnica]);

  // Filter suggestions based on search
  const suggestions = useMemo(() => {
    if (!searchMP || searchMP.length < 2) return [];
    const q = searchMP.toLowerCase();
    return uniqueMP
      .filter(
        (item) =>
          item.materia_prima?.toLowerCase().includes(q) ||
          item.descricao_materia_prima?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [searchMP, uniqueMP]);

  // Get saldo for the selected MP
  const saldoInfo = useMemo(() => {
    if (!selectedMP) return null;
    return saldoMP.find(
      (s) => s.mp_codigo === selectedMP.materia_prima
    );
  }, [selectedMP, saldoMP]);

  const handleSelectMP = (item: ListaTecnicaItem) => {
    setSelectedMP(item);
    setSearchMP(item.materia_prima);
    setShowSuggestions(false);
    form.setValue("codigo_mp", item.materia_prima);
    form.setValue("nome_mp", item.descricao_materia_prima || "");
    form.setValue("unidade", item.un_materia_prima?.toLowerCase() || "kg");
  };

  const handleSubmit = (data: SolicitacaoFormData) => {
    onSubmit(data);
    form.reset();
    setSearchMP("");
    setSelectedMP(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Nova Solicitação de Matéria-Prima
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Busca de MP com autocomplete */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Buscar Matéria-Prima (Lista Técnica)</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Digite o código ou nome da MP..."
              value={searchMP}
              onChange={(e) => {
                setSearchMP(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="pl-10"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((item, idx) => (
                  <button
                    key={`${item.materia_prima}-${idx}`}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                    onClick={() => handleSelectMP(item)}
                  >
                    <div>
                      <span className="font-mono font-medium">{item.materia_prima}</span>
                      <span className="mx-2 text-muted-foreground">—</span>
                      <span>{item.descricao_materia_prima}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      {item.un_materia_prima}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {saldoInfo && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                Saldo na Área: {Number(saldoInfo.saldo_total).toFixed(3)} kg
              </Badge>
              <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50 dark:bg-slate-950/30 dark:border-slate-800">
                {saldoInfo.total_lotes} lote(s)
              </Badge>
            </div>
          )}
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo_mp">Código MP</Label>
              <Input
                id="codigo_mp"
                placeholder="Código da MP"
                {...form.register("codigo_mp")}
                readOnly={!!selectedMP}
                className={selectedMP ? "bg-muted" : ""}
              />
              {form.formState.errors.codigo_mp && (
                <p className="text-xs text-destructive">{form.formState.errors.codigo_mp.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_mp">Nome MP</Label>
              <Input
                id="nome_mp"
                placeholder="Nome da matéria-prima"
                {...form.register("nome_mp")}
              />
              {form.formState.errors.nome_mp && (
                <p className="text-xs text-destructive">{form.formState.errors.nome_mp.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade_solicitada">Quantidade</Label>
              <Input
                id="quantidade_solicitada"
                type="number"
                step="0.001"
                placeholder="0.000"
                {...form.register("quantidade_solicitada")}
              />
              {form.formState.errors.quantidade_solicitada && (
                <p className="text-xs text-destructive">{form.formState.errors.quantidade_solicitada.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select
                onValueChange={(v) => form.setValue("unidade", v)}
                defaultValue={form.getValues("unidade")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Quilograma (kg)</SelectItem>
                  <SelectItem value="g">Grama (g)</SelectItem>
                  <SelectItem value="l">Litro (L)</SelectItem>
                  <SelectItem value="un">Unidade (un)</SelectItem>
                  <SelectItem value="cx">Caixa (cx)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                onValueChange={(v) => form.setValue("prioridade", v as any)}
                defaultValue={form.getValues("prioridade")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="solicitante">Solicitante</Label>
              <Input
                id="solicitante"
                placeholder="Nome do solicitante"
                {...form.register("solicitante")}
              />
              {form.formState.errors.solicitante && (
                <p className="text-xs text-destructive">{form.formState.errors.solicitante.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_necessidade">Data de Necessidade</Label>
              <Input
                id="data_necessidade"
                type="date"
                {...form.register("data_necessidade")}
              />
              {form.formState.errors.data_necessidade && (
                <p className="text-xs text-destructive">{form.formState.errors.data_necessidade.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="produto_destino">Produto Destino (Opcional)</Label>
              <Input
                id="produto_destino"
                placeholder="Produto que utilizará a MP"
                {...form.register("produto_destino")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (Opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais sobre a solicitação"
              {...form.register("observacoes")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            <Send className="w-4 h-4 mr-2" />
            Enviar Solicitação
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
