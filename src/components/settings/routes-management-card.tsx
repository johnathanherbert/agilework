"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { getAllWipRecipes } from '@/lib/wip-recipes';
import { ProductionVia } from '@/types';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Upload, 
  Download,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface CustomRouteItem {
  id?: string;
  codigo: string;
  produto: string;
  familia: string;
  via: ProductionVia;
  org?: 'custom' | 'nat';
  created_at?: any;
  created_by?: string;
  updated_at?: any;
}

const PAGE_SIZE = 50;

export function RoutesManagementCard() {
  const { user } = useFirebase();
  const [customRoutes, setCustomRoutes] = useState<CustomRouteItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viaFilter, setViaFilter] = useState<'' | 'SECA' | 'UMIDA'>('');
  const [originFilter, setOriginFilter] = useState<'' | 'nat' | 'custom'>('');
  const [sortField, setSortField] = useState<'codigo' | 'produto' | 'familia'>('codigo');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [currentPage, setCurrentPage] = useState(0);

  // Form State para adicionar nova
  const [newCodigo, setNewCodigo] = useState('');
  const [newProduto, setNewProduto] = useState('');
  const [newFamilia, setNewFamilia] = useState('');
  const [newVia, setNewVia] = useState<ProductionVia>('SECA');
  const [addHelpText, setAddHelpText] = useState('Código de 6 dígitos, com sufixo I opcional. Produtos com ** são marcados como controlados.');
  const [addHelpError, setAddHelpError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edição inline
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);
  const [editProduto, setEditProduto] = useState('');
  const [editFamilia, setEditFamilia] = useState('');
  const [editVia, setEditVia] = useState<ProductionVia>('SECA');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Escuta no Firestore pela coleção custom_routes
  useEffect(() => {
    const q = query(collection(db, 'custom_routes'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CustomRouteItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        org: 'custom',
      } as CustomRouteItem));
      setCustomRoutes(items);
    }, (error) => {
      console.error("Erro ao carregar rotas customizadas:", error);
    });

    return () => unsubscribe();
  }, []);

  // Lista combinada (Static JSON + Custom Firestore)
  const staticRecipes = useMemo(() => getAllWipRecipes(), []);

  const combinedRecipes = useMemo(() => {
    const combined: CustomRouteItem[] = [...customRoutes];
    
    // Adiciona estáticas se o código não foi sobrescrito por customizada
    const customCodes = new Set(customRoutes.map(c => c.codigo.trim().toUpperCase()));
    staticRecipes.forEach(r => {
      const codeUpper = r.codigo.trim().toUpperCase();
      if (!customCodes.has(codeUpper)) {
        combined.push({
          id: `static-${codeUpper}`,
          codigo: codeUpper,
          produto: r.produto.toUpperCase(),
          familia: (r.familia || '').toUpperCase(),
          via: (r.via || 'SECA') as ProductionVia,
          org: 'nat',
        });
      }
    });

    return combined;
  }, [customRoutes, staticRecipes]);

  // Lista de famílias para datalist
  const knownFamilies = useMemo(() => {
    const set = new Set<string>();
    combinedRecipes.forEach(r => {
      if (r.familia) set.add(r.familia);
    });
    return Array.from(set).sort();
  }, [combinedRecipes]);

  // Filtros e ordenação
  const filteredRecipes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return combinedRecipes.filter((r) => {
      const matchVia = !viaFilter || r.via === viaFilter;
      const matchOrg = !originFilter || r.org === originFilter;
      if (!matchVia || !matchOrg) return false;

      if (!q) return true;
      const normCod = r.codigo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normProd = r.produto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normFam = r.familia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      return normCod.includes(q) || normProd.includes(q) || normFam.includes(q);
    }).sort((a, b) => {
      return a[sortField].localeCompare(b[sortField], 'pt') * sortDir;
    });
  }, [combinedRecipes, searchTerm, viaFilter, originFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / PAGE_SIZE));
  const currentPageData = useMemo(() => {
    const page = Math.min(currentPage, totalPages - 1);
    return filteredRecipes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filteredRecipes, currentPage, totalPages]);

  // Toggle ordenação por coluna
  const handleSort = (field: 'codigo' | 'produto' | 'familia') => {
    if (sortField === field) {
      setSortDir(prev => prev === 1 ? -1 : 1);
    } else {
      setSortField(field);
      setSortDir(1);
    }
  };

  // Validação em tempo real do código no formulário de adição
  const handleCodigoChange = (val: string) => {
    const upper = val.trim().toUpperCase();
    setNewCodigo(upper);

    const exists = combinedRecipes.find(c => c.codigo === upper);
    if (exists) {
      setAddHelpError(true);
      setAddHelpText(`Código ${upper} já cadastrado: ${exists.produto.replace(/\*\*/g, '')}`);
    } else if (upper && !/^\d{6}I?$/.test(upper)) {
      setAddHelpError(false);
      setAddHelpText('Formato esperado: 6 dígitos numéricos, com sufixo "I" opcional (ex.: 700999 ou 700999I).');
    } else {
      setAddHelpError(false);
      setAddHelpText('Código de 6 dígitos, com sufixo I opcional. Produtos com ** são marcados como controlados.');
    }
  };

  // Cadastrar nova rota/ordem
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cod = newCodigo.trim().toUpperCase();
    const prod = newProduto.trim().toUpperCase();
    const fam = newFamilia.trim().toUpperCase();

    if (!cod || !prod || !fam) {
      toast.error('Preencha Código, Produto e Família.');
      return;
    }

    if (!/^\d{6}I?$/.test(cod)) {
      toast.error('Código deve ter 6 dígitos (ex.: 700999).');
      return;
    }

    const exists = combinedRecipes.find(c => c.codigo === cod);
    if (exists) {
      toast.error(`Código ${cod} já existe.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'custom_routes'), {
        codigo: cod,
        produto: prod,
        familia: fam,
        via: newVia,
        created_at: serverTimestamp(),
        created_by: user?.uid || '',
      });

      toast.success(`Ordem ${cod} cadastrada com sucesso!`);
      setNewCodigo('');
      setNewProduto('');
      setNewFamilia('');
      setNewVia('SECA');
      setAddHelpError(false);
      setAddHelpText('Código de 6 dígitos, com sufixo I opcional. Produtos com ** são marcados como controlados.');
    } catch (err: any) {
      console.error('Erro ao adicionar ordem:', err);
      toast.error(err.message || 'Erro ao salvar ordem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Iniciar edição inline
  const startEdit = (item: CustomRouteItem) => {
    setEditingCodigo(item.codigo);
    setEditProduto(item.produto);
    setEditFamilia(item.familia);
    setEditVia(item.via);
  };

  // Cancelar edição
  const cancelEdit = () => {
    setEditingCodigo(null);
    setEditProduto('');
    setEditFamilia('');
  };

  // Salvar edição inline
  const commitEdit = async (item: CustomRouteItem) => {
    const prod = editProduto.trim().toUpperCase();
    const fam = editFamilia.trim().toUpperCase();

    if (!prod || !fam) {
      toast.error('Preencha produto e família.');
      return;
    }

    try {
      if (item.id && !item.id.startsWith('static-')) {
        // Atualiza customizada existente
        const docRef = doc(db, 'custom_routes', item.id);
        await updateDoc(docRef, {
          produto: prod,
          familia: fam,
          via: editVia,
          updated_at: serverTimestamp(),
          updated_by: user?.uid || '',
        });
      } else {
        // Se era estática, cria no Firestore para sobrescrever com valores personalizados
        await addDoc(collection(db, 'custom_routes'), {
          codigo: item.codigo,
          produto: prod,
          familia: fam,
          via: editVia,
          created_at: serverTimestamp(),
          created_by: user?.uid || '',
        });
      }

      toast.success(`Ordem ${item.codigo} atualizada!`);
      setEditingCodigo(null);
    } catch (err: any) {
      console.error('Erro ao salvar edição:', err);
      toast.error('Erro ao salvar alterações.');
    }
  };

  // Excluir rota personalizada
  const handleDelete = async (item: CustomRouteItem) => {
    if (!item.id || item.id.startsWith('static-')) {
      toast.error('Ordens nativas do catálogo fixo não podem ser excluídas.');
      return;
    }

    if (!confirm(`Remover ordem ${item.codigo} - ${item.produto}?`)) return;

    try {
      await deleteDoc(doc(db, 'custom_routes', item.id));
      toast.success(`Ordem ${item.codigo} removida.`);
    } catch (err: any) {
      console.error('Erro ao remover rota:', err);
      toast.error('Erro ao excluir rota.');
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    const rows = [
      ['Codigo SA', 'Produto', 'Familia', 'Via', 'Origem'],
      ...filteredRecipes.map(c => [
        c.codigo,
        c.produto,
        c.familia,
        c.via === 'UMIDA' ? 'Umida' : 'Seca',
        c.org === 'custom' ? 'Personalizada' : 'Catalogo'
      ])
    ];

    const csvContent = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ordens_vias_rotas_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${filteredRecipes.length} ordens exportadas.`);
  };

  // Importar CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = String(evt.target?.result || '').replace(/^\ufeff/, '');
        const lines = text.split(/\r?\n/).filter(Boolean);
        let added = 0;
        let ignored = 0;

        for (let i = 0; i < lines.length; i++) {
          const cols = lines[i].split(/;|,/).map(c => c.replace(/^"|"$/g, '').trim());
          if (i === 0 && /c[oó]digo/i.test(cols[0])) continue; // Pula cabeçalho

          const cod = (cols[0] || '').toUpperCase();
          const prod = (cols[1] || '').toUpperCase();
          const fam = (cols[2] || '').toUpperCase();
          const rawVia = (cols[3] || '').toUpperCase();
          const via: ProductionVia = rawVia.includes('UMID') ? 'UMIDA' : 'SECA';

          if (!/^\d{6}I?$/.test(cod) || !prod || !fam) {
            ignored++;
            continue;
          }

          // Se já existe no Firestore, ignora para não duplicar
          const exists = customRoutes.find(c => c.codigo === cod);
          if (!exists) {
            await addDoc(collection(db, 'custom_routes'), {
              codigo: cod,
              produto: prod,
              familia: fam,
              via,
              created_at: serverTimestamp(),
              created_by: user?.uid || '',
            });
            added++;
          } else {
            ignored++;
          }
        }

        toast.success(`Importação concluída: ${added} adicionadas (${ignored} ignoradas/existentes).`);
      } catch (err: any) {
        console.error('Erro ao importar CSV:', err);
        toast.error('Falha ao processar arquivo CSV.');
      }
    };

    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const customCount = customRoutes.length;
  const umidaCount = combinedRecipes.filter(c => c.via === 'UMIDA').length;
  const secaCount = combinedRecipes.length - umidaCount;

  return (
    <div className="space-y-3">
      {/* Cabeçalho da Seção com Botões de Importar/Exportar */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--text)] tracking-tight">Ordens, vias e rotas</h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--amber)] border border-[var(--border-strong)]">
              Admin
            </span>
          </div>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Cadastro usado para autocompletar produto, família e via ao criar ordens no painel de produção.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload size={12} />
            <span>Importar CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={12} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
        {/* Formulário de Adicionar Ordem (Estilo Concept: addf) */}
        <form onSubmit={handleAddSubmit} className="p-3 bg-[var(--surface-2)] border-b border-[var(--border)] space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_150px_130px_auto] gap-2 items-center">
            {/* Código SA */}
            <input
              value={newCodigo}
              onChange={(e) => handleCodigoChange(e.target.value)}
              placeholder="Código SA"
              maxLength={8}
              className={cn(
                "h-[32px] px-2.5 border rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] uppercase placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]",
                addHelpError ? "border-[var(--red)]" : "border-[var(--border-strong)]"
              )}
            />

            {/* Descrição do Produto */}
            <input
              value={newProduto}
              onChange={(e) => setNewProduto(e.target.value.toUpperCase())}
              placeholder="Descrição do produto"
              className="h-[32px] px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] uppercase placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]"
            />

            {/* Família */}
            <input
              value={newFamilia}
              onChange={(e) => setNewFamilia(e.target.value.toUpperCase())}
              list="routes-fam-list"
              placeholder="Família (COP LEG.4)"
              className="h-[32px] px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] uppercase placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]"
            />
            <datalist id="routes-fam-list">
              {knownFamilies.map(fam => (
                <option key={fam} value={fam} />
              ))}
            </datalist>

            {/* Seletor de Via */}
            <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)] h-[32px]">
              <button
                type="button"
                onClick={() => setNewVia('SECA')}
                className={cn(
                  "flex-1 px-2.5 text-xs font-medium transition-colors cursor-pointer border-r border-[var(--border-strong)]",
                  newVia === 'SECA' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                )}
              >
                Seca
              </button>
              <button
                type="button"
                onClick={() => setNewVia('UMIDA')}
                className={cn(
                  "flex-1 px-2.5 text-xs font-medium transition-colors cursor-pointer",
                  newVia === 'UMIDA' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                )}
              >
                Úmida
              </button>
            </div>

            {/* Botão Adicionar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[32px] px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
            >
              <Plus size={13} />
              <span>Adicionar</span>
            </button>
          </div>

          <p className={cn("text-[11px] leading-relaxed", addHelpError ? "text-[var(--red)] font-medium" : "text-[var(--text-3)]")}>
            {addHelpText}
          </p>
        </form>

        {/* Barra de Filtros e Busca (cat-top) */}
        <div className="p-3 border-b border-[var(--border)] flex flex-wrap items-center gap-2">
          {/* Busca */}
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-3)] pointer-events-none" />
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
              placeholder="Código, produto ou família..."
              className="h-8 pl-8 pr-3 w-full border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Filtro de Via */}
          <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)] h-8">
            <button
              type="button"
              onClick={() => { setViaFilter(''); setCurrentPage(0); }}
              className={cn(
                "px-2.5 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer flex items-center gap-1.5",
                viaFilter === '' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Todas</span>
              <span className="font-mono text-[10px] text-[var(--text-3)]">{combinedRecipes.length}</span>
            </button>
            <button
              type="button"
              onClick={() => { setViaFilter('SECA'); setCurrentPage(0); }}
              className={cn(
                "px-2.5 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer flex items-center gap-1.5",
                viaFilter === 'SECA' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Seca</span>
              <span className="font-mono text-[10px] text-[var(--text-3)]">{secaCount}</span>
            </button>
            <button
              type="button"
              onClick={() => { setViaFilter('UMIDA'); setCurrentPage(0); }}
              className={cn(
                "px-2.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5",
                viaFilter === 'UMIDA' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Úmida</span>
              <span className="font-mono text-[10px] text-[var(--text-3)]">{umidaCount}</span>
            </button>
          </div>

          {/* Filtro de Origem */}
          <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)] h-8">
            <button
              type="button"
              onClick={() => { setOriginFilter(''); setCurrentPage(0); }}
              className={cn(
                "px-2.5 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer",
                originFilter === '' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              Todas as origens
            </button>
            <button
              type="button"
              onClick={() => { setOriginFilter('nat'); setCurrentPage(0); }}
              className={cn(
                "px-2.5 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer",
                originFilter === 'nat' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => { setOriginFilter('custom'); setCurrentPage(0); }}
              className={cn(
                "px-2.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5",
                originFilter === 'custom' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Personalizadas</span>
              <span className="font-mono text-[10px] text-[var(--text-3)]">{customCount}</span>
            </button>
          </div>

          <div className="ml-auto text-xs text-[var(--text-3)] hidden md:block">
            {combinedRecipes.length} cadastradas · {customCount} personalizada{customCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* Tabela de Ordens */}
        <div className="max-h-[440px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-3)] border-b border-[var(--border)] z-10 select-none">
              <tr>
                <th
                  onClick={() => handleSort('codigo')}
                  className="py-2 px-3 w-28 cursor-pointer hover:text-[var(--text)]"
                >
                  <span className="flex items-center gap-1">
                    <span>Código SA</span>
                    {sortField === 'codigo' && <span className="text-[10px]">{sortDir === 1 ? '▲' : '▼'}</span>}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('produto')}
                  className="py-2 px-3 cursor-pointer hover:text-[var(--text)]"
                >
                  <span className="flex items-center gap-1">
                    <span>Produto</span>
                    {sortField === 'produto' && <span className="text-[10px]">{sortDir === 1 ? '▲' : '▼'}</span>}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('familia')}
                  className="py-2 px-3 w-32 cursor-pointer hover:text-[var(--text)]"
                >
                  <span className="flex items-center gap-1">
                    <span>Família</span>
                    {sortField === 'familia' && <span className="text-[10px]">{sortDir === 1 ? '▲' : '▼'}</span>}
                  </span>
                </th>
                <th className="py-2 px-3 w-24">Via</th>
                <th className="py-2 px-3 w-28">Origem</th>
                <th className="py-2 px-3 w-20 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-normal">
              {currentPageData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[var(--text-3)]">
                    Nenhuma ordem encontrada{searchTerm ? ` para "${searchTerm}"` : ''}.
                  </td>
                </tr>
              ) : (
                currentPageData.map((c) => {
                  const isEditing = editingCodigo === c.codigo;
                  const isCustom = c.org === 'custom';
                  const isControlled = c.produto.includes('**');
                  const cleanProd = c.produto.replace(/\*\*/g, '');

                  if (isEditing) {
                    return (
                      <tr key={c.codigo} className="bg-[var(--surface-2)]">
                        <td className="py-2 px-3 font-mono font-medium text-[var(--text)]">
                          {c.codigo}
                        </td>
                        <td className="py-1 px-2">
                          <input
                            value={editProduto}
                            onChange={(e) => setEditProduto(e.target.value.toUpperCase())}
                            className="h-7 w-full px-2 border border-[var(--border-strong)] rounded bg-[var(--bg)] text-xs text-[var(--text)] uppercase outline-none focus:border-[var(--accent)]"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            value={editFamilia}
                            onChange={(e) => setEditFamilia(e.target.value.toUpperCase())}
                            list="routes-fam-list"
                            className="h-7 w-full px-2 border border-[var(--border-strong)] rounded bg-[var(--bg)] font-mono text-xs text-[var(--text)] uppercase outline-none focus:border-[var(--accent)]"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <select
                            value={editVia}
                            onChange={(e) => setEditVia(e.target.value as ProductionVia)}
                            className="h-7 px-2 border border-[var(--border-strong)] rounded bg-[var(--bg)] text-xs text-[var(--text)] outline-none"
                          >
                            <option value="SECA">Seca</option>
                            <option value="UMIDA">Úmida</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-xs text-[var(--text-3)] font-mono">
                          Editando
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => commitEdit(c)}
                              className="w-6 h-6 rounded grid place-items-center text-[var(--green)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                              title="Salvar alterações"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="w-6 h-6 rounded grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                              title="Cancelar edição"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={c.codigo} className="hover:bg-[var(--hover)] transition-colors group">
                      {/* Código SA */}
                      <td className="py-2 px-3 font-mono font-medium text-[var(--text)]">
                        {c.codigo}
                      </td>

                      {/* Descrição do Produto */}
                      <td className="py-2 px-3 text-[var(--text)] truncate max-w-[280px]" title={cleanProd}>
                        <span>{cleanProd}</span>
                        {isControlled && (
                          <span className="ml-1.5 text-[10px] font-mono px-1 rounded bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/20">
                            Controlado
                          </span>
                        )}
                      </td>

                      {/* Família */}
                      <td className="py-2 px-3 font-mono text-[var(--text-2)] text-[11.5px] truncate">
                        {c.familia || '—'}
                      </td>

                      {/* Via de Processo */}
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)] font-medium">
                          <i className={cn("w-1.5 h-1.5 rounded-xs inline-block", c.via === 'UMIDA' ? "bg-[var(--accent)]" : "bg-[var(--amber)]")} />
                          <span>{c.via === 'UMIDA' ? 'Úmida' : 'Seca'}</span>
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="py-2 px-3 text-[11px]">
                        {isCustom ? (
                          <span className="text-[var(--violet)] font-medium">Personalizada</span>
                        ) : (
                          <span className="text-[var(--text-3)]">Catálogo</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="w-6 h-6 rounded grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                            title="Editar ordem"
                          >
                            <Edit2 size={12} />
                          </button>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              className="w-6 h-6 rounded grid place-items-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                              title="Remover ordem"
                            >
                              <Trash2 size={12} />
                            </button>
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

        {/* Rodapé da Tabela com Paginação (cat-foot) */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between text-xs text-[var(--text-3)]">
          <span>
            {filteredRecipes.length > 0 ? (
              <>
                {currentPage * PAGE_SIZE + 1}–{Math.min(filteredRecipes.length, (currentPage + 1) * PAGE_SIZE)} de {filteredRecipes.length}
                {filteredRecipes.length !== combinedRecipes.length && ' (filtrado)'}
              </>
            ) : (
              '0 ordens'
            )}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                className="h-6 px-2 rounded border border-[var(--border-strong)] bg-[var(--surface)] text-[11px] font-mono text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <span className="font-mono text-[11px] px-2 text-[var(--text-2)]">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                className="h-6 px-2 rounded border border-[var(--border-strong)] bg-[var(--surface)] text-[11px] font-mono text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-40 cursor-pointer"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
