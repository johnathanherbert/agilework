"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { NT, NTFilters as NTFiltersType, NTItem } from '@/types';
import { PlusCircle, FileSearch, Filter, RefreshCw, Search } from 'lucide-react';
import { getNTs, subscribeToNTs } from '@/lib/firestore-helpers';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import { NTList } from '@/components/nt-manager/nt-list';
import { NTFilters } from '@/components/nt-manager/nt-filters';
import { AddNTModal } from '@/components/nt-manager/add-nt-modal';
import { AddBulkNTModal } from '@/components/nt-manager/add-bulk-nt-modal';
import { EditNTModal } from '@/components/nt-manager/edit-nt-modal';
import { DeleteConfirmationModal } from '@/components/nt-manager/delete-confirmation-modal';
import { PaidItemsTimelineFirebase } from '@/components/nt-manager/paid-items-timeline-firebase';

function NTManagerContent() {
  const [nts, setNts] = useState<NT[]>([]);
  const [filteredNts, setFilteredNts] = useState<NT[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ntToDelete, setNtToDelete] = useState<string | null>(null);
  const [selectedNT, setSelectedNT] = useState<NT | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [autoExpandedNTs, setAutoExpandedNTs] = useState<string[]>([]);
  const [highlightedItems, setHighlightedItems] = useState<string[]>([]);
  const { user } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
    // Default filters
  const [filters, setFilters] = useState<NTFiltersType>({
    search: '',
    status: [],
    dateRange: null,
    shift: null,
    overdueOnly: false,
    hideOldNts: false,
    priorityOnly: false,
    isCompletedView: false
  });
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Fetch NTs data
  const fetchNTs = useCallback(async () => {
    setLoading(true);
    
    try {
      const data = await getNTs();
      
      // Filtrar NTs para mostrar apenas dos últimos 2 dias
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const recentNTs = data.filter((nt: NT) => {
        if (!nt.created_date) return false;
        // Parse created_date format "DD/MM/YYYY"
        const [day, month, year] = nt.created_date.split('/').map(Number);
        const ntDate = new Date(year, month - 1, day);
        return ntDate >= twoDaysAgo;
      });
      
      return recentNTs;
    } catch (error) {
      console.error('Error fetching NTs:', error);
      toast.error('Erro ao carregar as NTs');
      return [];
    } finally {
      setLoading(false);
    }
  }, []); // Sem dependências - função pura

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to real-time changes in Firestore
    const unsubscribe = subscribeToNTs(
      (ntsData) => {
        console.log('Real-time update received:', ntsData.length, 'NTs');
        
        // Filtrar NTs para mostrar apenas dos últimos 2 dias
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        
        const recentNTs = ntsData.filter((nt: NT) => {
          if (!nt.created_date) return false;
          const [day, month, year] = nt.created_date.split('/').map(Number);
          const ntDate = new Date(year, month - 1, day);
          return ntDate >= twoDaysAgo;
        });
        
        setNts(recentNTs);
        setLoading(false);
      },
      (error) => {
        console.error('Error in real-time subscription:', error);
        toast.error('Erro na atualização em tempo real');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]); // Apenas user como dependência
  
  // Aplicar filtros sempre que filters ou nts mudarem
  useEffect(() => {
    let filtered = [...nts];
    const searchTerm = filters.search?.toLowerCase().trim();
    let ntsWithMatchingItems: Array<{nt: NT, matchedItemIds: string[], createdDateTime: number}> = [];
    let shouldAutoExpand = false;
    
    // Date range filter (aplicar ANTES da busca)
    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      filtered = filtered.filter(nt => {
        const [day, month, year] = nt.created_date.split('/').map(Number);
        const createdDate = new Date(year, month - 1, day);
        const fromDate = new Date(filters.dateRange!.from);
        const toDate = new Date(filters.dateRange!.to);
        return createdDate >= fromDate && createdDate <= toDate;
      });
    }
    
    // Shift filter (aplicado em TODAS as NTs, incluindo concluídas)
    if (filters.shift !== null) {
      filtered = filtered.filter(nt => {
        const createdTime = nt.created_time;
        const hour = parseInt(createdTime.split(':')[0], 10);
        
        if (filters.shift === 1) return hour >= 6 && hour < 14;
        if (filters.shift === 2) return hour >= 14 && hour < 22;
        if (filters.shift === 3) return hour >= 22 || hour < 6;
        return true;
      });
    }
    
    // Filtrar NTs concluídas ou não concluídas com base na vista
    // (aplicado DEPOIS do filtro de turno para garantir que funcione)
    if (filters.isCompletedView === true) {
      filtered = filtered.filter(nt => {
        if (!nt.items || nt.items.length === 0) return false;
        return nt.items.every(item => item.status === 'Pago');
      });
    } else if (filters.isCompletedView === false) {
      filtered = filtered.filter(nt => {
        if (!nt.items || nt.items.length === 0) return true;
        return nt.items.some(item => item.status !== 'Pago');
      });
    }
    
    // Status filter (aplicado apenas se houver status selecionados)
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(nt => 
        filters.status!.includes(nt.status)
      );
    }
    
    // Hide old NTs (older than 3 days)
    if (filters.hideOldNts) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      filtered = filtered.filter(nt => {
        const [day, month, year] = nt.created_date.split('/').map(Number);
        const ntDate = new Date(year, month - 1, day);
        return ntDate >= threeDaysAgo;
      });
    }
    
    // Filter for priority items
    if (filters.priorityOnly) {
      filtered = filtered.filter(nt => 
        nt.items && nt.items.some(item => item.priority === true)
      );
    }
    
    // Filter for overdue items
    if (filters.overdueOnly) {
      filtered = filtered.filter(nt => {
        if (!nt.items || nt.items.length === 0) return false;
        return nt.items.some(item => {
          if (item.status === 'Pago') return false;
          const [day, month, year] = nt.created_date.split('/').map(Number);
          const [hour, minute] = nt.created_time.split(':').map(Number);
          const createdDate = new Date(year, month - 1, day, hour, minute);
          const now = new Date();
          const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
          return diffHours > 2;
        });
      });
    }
    
    // Search by NT number OR material name/code (aplicar POR ÚLTIMO)
    if (searchTerm) {
      // First, filter by NT number
      const ntsByNumber = filtered.filter(nt => 
        nt.nt_number.toLowerCase().includes(searchTerm)
      );
      
      // Then search within items for matching code or description
      const ntsWithItems = filtered.map(nt => {
        if (!nt.items || nt.items.length === 0) return null;
        
        const matchedItemIds = nt.items
          .filter(item => 
            item.description?.toLowerCase().includes(searchTerm) ||
            item.code?.toLowerCase().includes(searchTerm)
          )
          .map(item => item.id);
        
        if (matchedItemIds.length > 0) {
          // Create datetime for sorting (oldest first)
          const [day, month, year] = nt.created_date.split('/').map(Number);
          const [hour, minute] = nt.created_time.split(':').map(Number);
          const createdDateTime = new Date(year, month - 1, day, hour, minute).getTime();
          
          return { nt, matchedItemIds, createdDateTime };
        }
        return null;
      }).filter(Boolean) as Array<{nt: NT, matchedItemIds: string[], createdDateTime: number}>;
      
      // If we found items matching the search, use those NTs
      if (ntsWithItems.length > 0) {
        // Sort by creation date/time (oldest first)
        ntsWithMatchingItems = ntsWithItems.sort((a, b) => a.createdDateTime - b.createdDateTime);
        filtered = ntsWithMatchingItems.map(item => item.nt);
        shouldAutoExpand = true;
      } else if (ntsByNumber.length > 0) {
        // If no items match but NT number matches, use those
        filtered = ntsByNumber;
        setAutoExpandedNTs([]);
        setHighlightedItems([]);
      } else {
        // No matches found
        filtered = [];
        setAutoExpandedNTs([]);
        setHighlightedItems([]);
      }
    } else {
      // Clear auto-expansion when search is cleared
      setAutoExpandedNTs([]);
      setHighlightedItems([]);
    }
    
    // Status filter
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(nt => 
        filters.status!.includes(nt.status)
      );
    }
    
    // Date range filter
    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      filtered = filtered.filter(nt => {
        const [day, month, year] = nt.created_date.split('/').map(Number);
        const createdDate = new Date(year, month - 1, day);
        const fromDate = new Date(filters.dateRange!.from);
        const toDate = new Date(filters.dateRange!.to);
        return createdDate >= fromDate && createdDate <= toDate;
      });
    }
    
    // Shift filter
    if (filters.shift !== null) {
      filtered = filtered.filter(nt => {
        const createdTime = nt.created_time;
        const hour = parseInt(createdTime.split(':')[0], 10);
        
        if (filters.shift === 1) return hour >= 6 && hour < 14;
        if (filters.shift === 2) return hour >= 14 && hour < 22;
        if (filters.shift === 3) return hour >= 22 || hour < 6;
        return true;
      });
    }
    
    // Hide old NTs (older than 3 days)
    if (filters.hideOldNts) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      filtered = filtered.filter(nt => {
        const [day, month, year] = nt.created_date.split('/').map(Number);
        const createdDate = new Date(year, month - 1, day);
        return createdDate >= threeDaysAgo;
      });
    }
    
    // Filter for priority items
    if (filters.priorityOnly) {
      filtered = filtered.filter(nt => 
        nt.items?.some(item => item.priority === true)
      );
    }
    
    // Filter for overdue items
    if (filters.overdueOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(nt => {
        const createdDate = new Date(nt.created_date);
        createdDate.setHours(0, 0, 0, 0);
        
        const isOverdue = nt.items?.some(item => {
          const itemDate = new Date(item.created_date);
          itemDate.setHours(0, 0, 0, 0);
          const daysSinceCreation = Math.floor((today.getTime() - itemDate.getTime()) / (1000 * 3600 * 24));
          return daysSinceCreation > 1 && item.status === 'Ag. Pagamento';
        });
        
        return isOverdue;
      });
    }
    
    setFilteredNts(filtered);
    
    // Apply auto-expand and highlight AFTER setting filtered NTs
    if (shouldAutoExpand && ntsWithMatchingItems.length > 0) {
      const firstNTId = ntsWithMatchingItems[0].nt.id;
      const allMatchedItemIds = ntsWithMatchingItems.flatMap(item => item.matchedItemIds);
      
      // Auto-expand after a small delay to ensure rendering
      setTimeout(() => {
        setAutoExpandedNTs([firstNTId]);
        setHighlightedItems(allMatchedItemIds);
        
        // Remove highlight after 1 second
        setTimeout(() => {
          setHighlightedItems([]);
        }, 1000);
      }, 100);
    }
  }, [filters, nts]);
  
  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<NTFiltersType>) => {
    const updatedFilters = {
      ...filters,
      ...newFilters,
    };
    setFilters(updatedFilters);
    // O useEffect vai aplicar os filtros automaticamente
  };
  
  // Handle search input change
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange({ search: e.target.value });
  };
  
  // Handle NT edit
  const handleEditNT = (nt: NT) => {
    setSelectedNT(nt);
    setShowEditModal(true);
  };
  
  // Handle NT delete
  const handleDeleteNT = (ntId: string) => {
    setNtToDelete(ntId);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteNT = () => {
    setShowDeleteModal(false);
    setNtToDelete(null);
    // Não precisa chamar fetchNTs - o real-time listener atualiza automaticamente
  };
  
  // Função para refresh manual (apenas força re-render, dados já estão atualizados pelo real-time)
  const handleRefresh = () => {
    // O real-time listener já mantém os dados atualizados
    // Esta função existe apenas para feedback visual
    toast.success('Dados atualizados!');
  };
    // Processar parâmetros de URL
  useEffect(() => {
    const statusParam = searchParams?.get('status');
    
    // Resetar os filtros primeiro
    setFilters(prevFilters => ({
      ...prevFilters,
      isCompletedView: false,
      hideOldNts: true // valor padrão
    }));

    // Então aplicar os filtros específicos baseados no parâmetro status
    if (statusParam === 'concluida') {
      setFilters(prevFilters => ({
        ...prevFilters,
        isCompletedView: true,
        hideOldNts: false // Não esconder NTs antigas na vista de concluídas
      }));
    } else if (statusParam === 'todas') {
      setFilters(prevFilters => ({
        ...prevFilters,
        hideOldNts: false // Não esconder NTs antigas no histórico
      }));
    }
  }, [searchParams]);
  
  // NT skeleton loader component
  const NTSkeleton = () => (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-pulse transition-all">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl h-10 w-10 bg-gray-200 dark:bg-gray-700"></div>
          <div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-full mb-2"></div>
            <div className="h-2 w-48 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-1.5 w-40 bg-gray-200 dark:bg-gray-700 rounded-full mt-2"></div>
            <div className="flex gap-1 mt-2">
              <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
      </div>
    </div>
  );
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex ml-[64px] transition-all duration-300">
        {/* Main content area - responsive width */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${
          nts.length === 0 || timelineCollapsed ? 'w-full' : 'w-4/5 lg:w-4/5 xl:w-4/5'
        }`}>
          <Topbar />
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 flex items-center">
                  {filters.isCompletedView 
                    ? "NTs Concluídas" 
                    : "Gerenciamento de NTs"}
                  <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {filteredNts.length} {filteredNts.length === 1 ? 'NT' : 'NTs'}
                  </span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {filters.isCompletedView
                    ? "Histórico de Notas Técnicas 100% concluídas"
                    : "Visualize e gerencie suas Notas Técnicas ativas"}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none md:min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                  <Input
                    placeholder="Buscar NT, código ou material..."
                    value={filters.search}
                    onChange={handleSearch}
                    className="pl-9"
                  />
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowFilters(!showFilters)} 
                  className="relative flex items-center gap-2 border-gray-300 dark:border-gray-600"
                >
                  <Filter className="h-4 w-4" />
                  Filtros
                  {Object.values(filters).some(v => 
                    (Array.isArray(v) && v.length > 0) || 
                    (typeof v === 'boolean' && v === true) || 
                    (v !== null && v !== '')
                  ) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-gray-900"></span>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh}
                  className="flex items-center gap-2 border-gray-300 dark:border-gray-600"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                
                <Button 
                  size="sm" 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold border-0"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Nova NT</span>
                </Button>
              </div>
            </div>
              {/* Filters panel */}
            {showFilters && (
              <Card className="mb-6 relative overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
                <CardContent className="pt-6 pb-6 relative z-10">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      Filtros Avançados
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                      Refine sua busca por status, data, turno e outras opções
                    </p>
                  </div>
                  <NTFilters 
                    filters={filters} 
                    onChange={handleFilterChange} 
                  />
                </CardContent>
              </Card>
            )}
            
            {/* NT List */}
            <div className="space-y-5">
              {loading ? (
                // Skeleton loaders while loading
                <div className="space-y-5">
                  <NTSkeleton />
                  <NTSkeleton />
                  <NTSkeleton />
                </div>
              ) : filteredNts.length > 0 ? (
                <NTList
                  nts={filteredNts}
                  onEdit={handleEditNT}
                  onDelete={handleDeleteNT}
                  onRefresh={handleRefresh}
                  autoExpandedNTs={autoExpandedNTs}
                  highlightedItems={highlightedItems}
                />
              ) : (
                <div className="relative p-12 text-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="relative z-10">
                    <div className="relative inline-block mb-4">
                      <FileSearch className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500" />
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                      Nenhuma NT encontrada
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto font-medium">
                      {filters.search ? 
                        `Não encontramos NTs com "${filters.search}" ou com os filtros aplicados.` : 
                        'Não encontramos NTs com os filtros aplicados.'}
                    </p>
                    
                    <Button 
                      onClick={() => {
                        setFilters({
                          search: '',
                          status: [],
                          dateRange: null,
                          shift: null,
                          overdueOnly: false,
                          hideOldNts: false,
                          priorityOnly: false
                        });
                      }} 
                      variant="outline" 
                      size="sm"
                      className="border-gray-300 dark:border-gray-600 font-bold"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Limpar filtros
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Timeline sidebar - enhanced dark mode support */}
        {nts.length > 0 && (
          <div className={`
            border-l border-gray-200 dark:border-gray-700/80 
            bg-white dark:bg-gray-900/40
            transition-all duration-300 flex flex-col
            shadow-lg dark:shadow-gray-900/20
            ${timelineCollapsed ? 'w-16' : 'w-1/5 lg:w-1/5 xl:w-1/5 min-w-[280px]'}
          `}>            {/* Timeline header spacer with enhanced dark mode */}
            <div className="h-16 border-b border-[#003d6b]/20 flex items-center justify-center px-4 bg-[#003d6b] relative overflow-hidden">
              {!timelineCollapsed && (
                <h2 className="text-sm font-bold text-white tracking-wide">Timeline Ativa</h2>
              )}
            </div>
            {/* Timeline content with enhanced spacing */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              {/* Timeline component */}
              <div className="flex-1 min-h-0">
                <PaidItemsTimelineFirebase 
                  isCollapsed={timelineCollapsed}
                  onToggleCollapse={() => setTimelineCollapsed(!timelineCollapsed)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddNTModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal} 
        onSuccess={handleRefresh}
      />
      
      <AddBulkNTModal
        open={showBulkAddModal}
        onOpenChange={setShowBulkAddModal}
        onSuccess={handleRefresh}
      />
      
      <EditNTModal 
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSuccess={handleRefresh}
        nt={selectedNT}
      />
      
      <DeleteConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleConfirmDeleteNT}
        title="Confirmar exclusão da NT"
        description="Tem certeza que deseja excluir esta NT? Esta ação é irreversível e excluirá todos os itens relacionados."
        isDeleting={false}
        entityType="nt"
        entityId={ntToDelete || ''}
      />
    </div>
  );
}

export default function NTManager() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    }>
      <NTManagerContent />
    </Suspense>
  );
}