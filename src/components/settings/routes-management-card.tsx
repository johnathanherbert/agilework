"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useFirebase } from '@/components/providers/firebase-provider';
import { WipRecipe, getAllWipRecipes } from '@/lib/wip-recipes';
import { ProductionVia } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Route, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Droplets, 
  Wind, 
  Layers, 
  Check, 
  FileSpreadsheet,
  RefreshCw,
  Database
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface CustomRouteItem {
  id?: string;
  codigo: string;
  produto: string;
  familia: string;
  via: ProductionVia;
  created_at?: any;
  created_by?: string;
  updated_at?: any;
}

export function RoutesManagementCard() {
  const { userData, user } = useFirebase();
  const [customRoutes, setCustomRoutes] = useState<CustomRouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedViaFilter, setSelectedViaFilter] = useState<string>('TODAS');
  
  // Form State
  const [codigo, setCodigo] = useState('');
  const [produto, setProduto] = useState('');
  const [familia, setFamilia] = useState('');
  const [via, setVia] = useState<ProductionVia>('SECA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Escuta no Firestore pela coleção custom_routes
  useEffect(() => {
    const q = query(collection(db, 'custom_routes'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CustomRouteItem[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as CustomRouteItem));
      setCustomRoutes(items);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar rotas customizadas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Lista combinada (Static JSON + Custom Firestore)
  const staticRecipes = useMemo(() => getAllWipRecipes(), []);

  const combinedRecipes = useMemo(() => {
    const combined = [...customRoutes];
    
    // Adiciona estáticas apenas se o código não estiver sobressrito por customizada
    const customCodes = new Set(customRoutes.map(c => c.codigo.trim().toUpperCase()));
    staticRecipes.forEach(r => {
      if (!customCodes.has(r.codigo.trim().toUpperCase())) {
        combined.push({
          id: `static-${r.codigo}`,
          codigo: r.codigo,
          produto: r.produto,
          familia: r.familia || '',
          via: r.via || 'SECA',
        });
      }
    });

    return combined;
  }, [customRoutes, staticRecipes]);

  // Lista filtrada para busca
  const filteredRecipes = useMemo(() => {
    return combinedRecipes.filter((r) => {
      const matchesSearch = 
        !searchTerm.trim() ||
        r.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.familia.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesVia = 
        selectedViaFilter === 'TODAS' || 
        r.via === selectedViaFilter;

      return matchesSearch && matchesVia;
    });
  }, [combinedRecipes, searchTerm, selectedViaFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || !produto.trim() || !familia.trim()) {
      toast.error('Preencha todos os campos obrigatórios (Código, Produto e Família)');
      return;
    }

    setSaving(true);
    try {
      const formattedCodigo = codigo.trim().toUpperCase();
      const formattedProduto = produto.trim().toUpperCase();
      const formattedFamilia = familia.trim().toUpperCase();

      if (editingId && !editingId.startsWith('static-')) {
        // Atualizar rota customizada existente
        const docRef = doc(db, 'custom_routes', editingId);
        await updateDoc(docRef, {
          codigo: formattedCodigo,
          produto: formattedProduto,
          familia: formattedFamilia,
          via,
          updated_at: serverTimestamp(),
          updated_by: user?.uid || '',
        });
        toast.success('Ordem/Rota atualizada com sucesso!');
      } else {
        // Criar nova rota customizada (ou sobrescrever estática)
        await addDoc(collection(db, 'custom_routes'), {
          codigo: formattedCodigo,
          produto: formattedProduto,
          familia: formattedFamilia,
          via,
          created_at: serverTimestamp(),
          created_by: user?.uid || '',
        });
        toast.success('Nova Ordem/Rota adicionada com sucesso!');
      }

      // Reset form
      setCodigo('');
      setProduto('');
      setFamilia('');
      setVia('SECA');
      setEditingId(null);
    } catch (err: any) {
      console.error('Erro ao salvar ordem/rota:', err);
      toast.error(err.message || 'Erro ao salvar ordem/rota');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: CustomRouteItem) => {
    setEditingId(item.id || null);
    setCodigo(item.codigo);
    setProduto(item.produto);
    setFamilia(item.familia);
    setVia(item.via || 'SECA');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setCodigo('');
    setProduto('');
    setFamilia('');
    setVia('SECA');
  };

  const handleDelete = async (item: CustomRouteItem) => {
    if (!item.id || item.id.startsWith('static-')) {
      toast.error('Rotas nativas do sistema não podem ser excluídas diretamente, mas você pode editar para sobrescrevê-las.');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir a rota "${item.codigo} - ${item.produto}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'custom_routes', item.id));
      toast.success('Rota removida com sucesso!');
    } catch (err: any) {
      console.error('Erro ao deletar rota:', err);
      toast.error('Erro ao deletar rota.');
    }
  };

  return (
    <Card className="border-border/80 shadow-md">
      <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Gerenciamento de Ordens, Vias e Rotas
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] uppercase font-bold">
                  Exclusivo ADM
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Cadastre novas receitas/ordens de produção, definindo códigos SA, vias (Seca/Úmida) e famílias.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1">
              <Database className="h-3.5 w-3.5 mr-1.5 text-primary" />
              {combinedRecipes.length} Cadastradas ({customRoutes.length} Personalizadas)
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Formulário de Cadastro / Edição */}
        <form onSubmit={handleSave} className="rounded-2xl border border-border/80 bg-slate-50/50 dark:bg-slate-900/50 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              {editingId ? (
                <>
                  <Edit2 className="h-4 w-4 text-amber-500" />
                  Editar Ordem / Rota
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-primary" />
                  Cadastrar Nova Ordem / Rota
                </>
              )}
            </h3>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit} className="h-8 text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Cancelar Edição
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
            {/* Código SA */}
            <div className="lg:col-span-3 space-y-1.5">
              <Label htmlFor="route-codigo" className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Código SA *
              </Label>
              <Input
                id="route-codigo"
                placeholder="Ex: 700999"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="h-10 text-xs font-mono font-bold uppercase bg-background"
                required
              />
            </div>

            {/* Nome do Produto */}
            <div className="lg:col-span-4 space-y-1.5">
              <Label htmlFor="route-produto" className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Descrição do Produto *
              </Label>
              <Input
                id="route-produto"
                placeholder="Ex: PARACETAMOL 500MG COMP"
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                className="h-10 text-xs font-bold uppercase bg-background"
                required
              />
            </div>

            {/* Família */}
            <div className="lg:col-span-3 space-y-1.5">
              <Label htmlFor="route-familia" className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Família de Produção *
              </Label>
              <Input
                id="route-familia"
                placeholder="Ex: COP LEG.4 ou PAM 2"
                value={familia}
                onChange={(e) => setFamilia(e.target.value)}
                className="h-10 text-xs font-bold uppercase bg-background"
                required
              />
            </div>

            {/* Via */}
            <div className="lg:col-span-2 space-y-1.5">
              <Label htmlFor="route-via" className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Via de Processo *
              </Label>
              <Select value={via} onValueChange={(val: ProductionVia) => setVia(val)}>
                <SelectTrigger id="route-via" className="h-10 text-xs font-bold bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SECA">
                    <span className="flex items-center gap-1.5">
                      <Wind className="h-3.5 w-3.5 text-cyan-500" />
                      Via Seca
                    </span>
                  </SelectItem>
                  <SelectItem value="UMIDA">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="h-3.5 w-3.5 text-blue-500" />
                      Via Úmida
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={saving} className="min-w-[160px] h-9 text-xs font-bold gap-1.5">
              {saving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {editingId ? 'Salvar Alterações' : 'Adicionar Ordem'}
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Busca e Filtros da Tabela */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por Código, Produto ou Família..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-xs h-10 bg-background"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filtrar Via:</span>
            <Select value={selectedViaFilter} onValueChange={setSelectedViaFilter}>
              <SelectTrigger className="h-10 text-xs font-bold w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as Vias</SelectItem>
                <SelectItem value="SECA">Apenas Via Seca</SelectItem>
                <SelectItem value="UMIDA">Apenas Via Úmida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de Ordens / Rotas */}
        <div className="rounded-xl border border-border/80 overflow-hidden bg-background">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border/80 text-muted-foreground uppercase font-bold tracking-wider text-[11px] z-10">
                <tr>
                  <th className="py-3 px-4">Código SA</th>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Família</th>
                  <th className="py-3 px-4">Via</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {filteredRecipes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                      Nenhuma ordem/rota encontrada com os critérios pesquisados.
                    </td>
                  </tr>
                ) : (
                  filteredRecipes.slice(0, 100).map((r) => {
                    const isCustom = !r.id?.startsWith('static-');
                    const isUmida = r.via === 'UMIDA';

                    return (
                      <tr key={r.id || r.codigo} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                          {r.codigo}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-foreground max-w-[280px] truncate" title={r.produto}>
                          {r.produto}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60">
                            <Layers className="h-3 w-3" />
                            {r.familia || 'N/A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md border ${
                            isUmida 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                              : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                          }`}>
                            {isUmida ? <Droplets className="h-3 w-3" /> : <Wind className="h-3 w-3" />}
                            Via {isUmida ? 'Úmida' : 'Seca'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {isCustom ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                              Personalizada (Firestore)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] font-semibold text-muted-foreground">
                              Nativa (Catálogo)
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Editar rota"
                              onClick={() => handleEdit(r)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {isCustom && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Excluir rota"
                                onClick={() => handleDelete(r)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredRecipes.length > 100 && (
            <div className="p-2.5 text-center text-[11px] font-semibold text-muted-foreground bg-muted/30 border-t border-border/60">
              Exibindo os primeiros 100 resultados de {filteredRecipes.length}. Refine a busca para encontrar itens específicos.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
