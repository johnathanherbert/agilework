"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/providers/supabase-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { NT, NTFilters as NTFiltersType, NTItem } from '@/types';
import { RealtimePostgresChangesPayload } from '@/types/supabase';
import { PlusCircle, FileSearch, Filter, RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import { NTList } from '@/components/nt-manager/nt-list';
import { NTFilters } from '@/components/nt-manager/nt-filters';
import { AddNTModal } from '@/components/nt-manager/add-nt-modal';
import { AddBulkNTModal } from '@/components/nt-manager/add-bulk-nt-modal';
import { EditNTModal } from '@/components/nt-manager/edit-nt-modal';
import { DeleteConfirmationModal } from '@/components/nt-manager/delete-confirmation-modal';
import { PaidItemsTimeline } from '@/components/nt-manager/paid-items-timeline';
import { RealtimeStatsCard } from '@/components/nt-manager/realtime-stats-card';

export default function NTManager() {
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
  const { user } = useSupabase();
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
  
  // Ref para controlar throttling de atualizações por foco/visibilidade
  const lastFocusUpdateRef = useRef<Date>(new Date());
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Fetch NTs data
  const fetchNTs = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('nts')
      .select(`
        *,
        items:nt_items(*)
      `)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching NTs:', error);
      toast.error('Erro ao carregar as NTs');
      setLoading(false);
      return;
    }
    
    // Filtrar NTs para mostrar apenas dos últimos 2 dias
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const recentNTs = data?.filter(nt => {
      if (!nt.created_at) return false;
      return new Date(nt.created_at) >= twoDaysAgo;
    }) || [];
    
    setNts(recentNTs);
    applyFilters(recentNTs, filters);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    if (user) {
      fetchNTs();
    }
    
    // Subscribe to changes in nts and nt_items tables with more granular event handling
    const ntsChannel = supabase
      .channel('nts_changes')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'nts' },
        (payload: any) => {
          console.log('NT inserted:', payload);
          // Remover toast - será tratado pelo notification provider
          fetchNTs();
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'nts' },
        (payload: any) => {
          console.log('NT updated:', payload);
          // Remover toast - apenas atualizar lista
          fetchNTs();
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'nts' },
        (payload: any) => {
          console.log('NT deleted:', payload);
          // Remover toast - será tratado pelo notification provider
          fetchNTs();
        }
      )
      .subscribe();
      
    const ntItemsChannel = supabase
      .channel('nt_items_changes')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'nt_items' },
        (payload: any) => {
          console.log('Item inserted:', payload);
          // Remover toast - será tratado pelo notification provider
          fetchNTs();
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'nt_items' },
        (payload: any) => {
          console.log('Item updated:', payload);
          // Remover toast - será tratado pelo notification provider para pagamentos
          fetchNTs();
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'nt_items' },
        (payload: any) => {
          console.log('Item deleted:', payload);
          // Remover toast - será tratado pelo notification provider
          fetchNTs();
        }
      )
      .subscribe();    return () => {
      supabase.removeChannel(ntsChannel);
      supabase.removeChannel(ntItemsChannel);
    };
  }, [fetchNTs, user]);

  // Focus/Visibility Change - Atualiza quando o usuário volta à aba/janela
  useEffect(() => {
    const checkForNTsUpdate = () => {
      const now = new Date();
      const timeSinceLastUpdate = now.getTime() - lastFocusUpdateRef.current.getTime();
      
      // Se passou mais de 5 segundos desde a última atualização, atualizar
      if (timeSinceLastUpdate > 5000) {
        console.log('👁️ NTs Page - Usuário voltou à aba/janela, atualizando lista de NTs...');
        fetchNTs();
      }
      
      lastFocusUpdateRef.current = now;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Usuário voltou à aba
        checkForNTsUpdate();
      }
    };

    const handleFocus = () => {
      // Janela ganhou foco
      checkForNTsUpdate();
    };

    // Adicionar listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchNTs]);
  
  // Apply filters function
  const applyFilters = (ntsData: NT[], currentFilters: NTFiltersType) => {
    let filtered = [...ntsData];
    
    // Filtrar NTs concluídas ou não concluídas com base na vista
    if (currentFilters.isCompletedView === true) {
      // Vista de NTs concluídas - mostrar apenas NTs 100% concluídas
      filtered = filtered.filter(nt => {
        // Verificar se a NT tem itens
        if (!nt.items || nt.items.length === 0) return false;
        
        // Verificar se todos os itens estão pagos
        return nt.items.every(item => item.status === 'Pago');
      });
    } else if (currentFilters.isCompletedView === false) {
      // Vista de NTs em andamento - mostrar apenas NTs que não estão 100% concluídas
      filtered = filtered.filter(nt => {
        // NTs sem itens são consideradas não concluídas
        if (!nt.items || nt.items.length === 0) return true;
        
        // Verificar se pelo menos um item não está pago
        return nt.items.some(item => item.status !== 'Pago');
      });
    }
    
    // Search by NT number
    if (currentFilters.search) {
      filtered = filtered.filter(nt => 
        nt.nt_number.toLowerCase().includes(currentFilters.search.toLowerCase())
      );
    }
    
    // Status filter
    if (currentFilters.status && currentFilters.status.length > 0) {
      filtered = filtered.filter(nt => 
        currentFilters.status!.includes(nt.status)
      );
    }
    
    // Date range filter
    if (currentFilters.dateRange && currentFilters.dateRange.from && currentFilters.dateRange.to) {
      filtered = filtered.filter(nt => {
        const createdDate = new Date(nt.created_at);
        const fromDate = new Date(currentFilters.dateRange!.from);
        const toDate = new Date(currentFilters.dateRange!.to);
        
        return createdDate >= fromDate && createdDate <= toDate;
      });
    }
    
    // Shift filter
    if (currentFilters.shift !== null) {
      filtered = filtered.filter(nt => {
        const createdTime = nt.created_time;
        const hour = parseInt(createdTime.split(':')[0], 10);
        
        // Define shift hours
        if (currentFilters.shift === 1) {
          // 1st shift: 06:00-14:00
          return hour >= 6 && hour < 14;
        } else if (currentFilters.shift === 2) {
          // 2nd shift: 14:00-22:00
          return hour >= 14 && hour < 22;
        } else if (currentFilters.shift === 3) {
          // 3rd shift: 22:00-06:00
          return hour >= 22 || hour < 6;
        }
        
        return true;
      });
    }
    
    // Hide old NTs (older than 3 days)
    if (currentFilters.hideOldNts) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      filtered = filtered.filter(nt => {
        const createdDate = new Date(nt.created_at);
        return createdDate >= threeDaysAgo;
      });
    }
    
    // Filter for priority items
    if (currentFilters.priorityOnly) {
      filtered = filtered.filter(nt => 
        nt.items?.some(item => item.priority === true)
      );
    }
    
    // Filter for overdue items
    if (currentFilters.overdueOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(nt => {
        const createdDate = new Date(nt.created_date);
        createdDate.setHours(0, 0, 0, 0);
        
        // Consider items overdue if they are more than 1 day old and still pending payment
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
  };
  
  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<NTFiltersType>) => {
    const updatedFilters = {
      ...filters,
      ...newFilters,
    };
    setFilters(updatedFilters);
    applyFilters(nts, updatedFilters);
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
    fetchNTs();
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
                    placeholder="Buscar NT..."
                    value={filters.search}
                    onChange={handleSearch}
                    className="pl-9"
                  />
                </div>
                
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} 
                  className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {Object.values(filters).some(v => 
                    (Array.isArray(v) && v.length > 0) || 
                    (typeof v === 'boolean' && v === true) || 
                    (v !== null && v !== '')
                  ) && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 ml-1"></span>
                  )}
                </Button>
                
                <Button variant="outline" size="sm" onClick={fetchNTs}
                  className="flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                
                <Button size="sm" onClick={() => setShowAddModal(true)}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Nova NT
                </Button>
              </div>
            </div>
              {/* Filters panel */}
            {showFilters && (
              <Card className="mb-6">
                <CardContent className="pt-6">
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
                  onRefresh={fetchNTs}
                />
              ) : (
                <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <FileSearch className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Nenhuma NT encontrada</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {filters.search ? 
                      `Não encontramos NTs com "${filters.search}" ou com os filtros aplicados.` : 
                      'Não encontramos NTs com os filtros aplicados.'}
                  </p>
                  <Button onClick={() => {
                    setFilters({
                      search: '',
                      status: [],
                      dateRange: null,
                      shift: null,
                      overdueOnly: false,
                      hideOldNts: false,
                      priorityOnly: false
                    });
                    applyFilters(nts, {
                      search: '',
                      status: [],
                      dateRange: null,
                      shift: null,
                      overdueOnly: false,
                      hideOldNts: false,
                      priorityOnly: false
                    });
                  }} variant="outline" size="sm">Limpar filtros</Button>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Timeline sidebar - enhanced dark mode support */}
        {nts.length > 0 && (
          <div className={`
            border-l border-gray-200 dark:border-gray-700/80 
            bg-white/95 dark:bg-gray-900/30 backdrop-blur-md
            transition-all duration-300 flex flex-col
            shadow-lg dark:shadow-gray-900/20
            ${timelineCollapsed ? 'w-16' : 'w-1/5 lg:w-1/5 xl:w-1/5 min-w-[280px]'}
          `}>            {/* Timeline header spacer with enhanced dark mode */}
            <div className="h-16 border-b border-gray-200 dark:border-gray-700/80 flex items-center px-4 bg-gray-50/50 dark:bg-gray-800/50">
              {!timelineCollapsed && (
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Timeline</h2>
              )}
            </div>
            {/* Timeline content with enhanced spacing */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
              {/* Realtime Stats Card */}
              {!timelineCollapsed && (
                <RealtimeStatsCard className="flex-shrink-0" />
              )}
              
              {/* Timeline component */}
              <div className="flex-1 min-h-0">
                <PaidItemsTimeline 
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
        onSuccess={fetchNTs}
      />
      
      <AddBulkNTModal
        open={showBulkAddModal}
        onOpenChange={setShowBulkAddModal}
        onSuccess={fetchNTs}
      />
      
      <EditNTModal 
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSuccess={fetchNTs}
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