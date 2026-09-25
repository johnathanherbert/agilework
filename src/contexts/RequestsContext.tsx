"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchSolicitacoes, createSolicitacao, updateSolicitacao, deleteSolicitacao } from '@/lib/dashpesagem-api';
import toast from 'react-hot-toast';

const RequestsContext = createContext<any>(null);

export function RequestsProvider({ children }: { children: React.ReactNode }) {
  const [materialRequests, setMaterialRequests] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  // Carrega todas as solicitações do PostgreSQL
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSolicitacoes();
      if (Array.isArray(data)) {
        // Agrupa por nome do excipiente (nome_mp) para compatibilidade perfeita com a interface
        const grouped: Record<string, any[]> = {};
        data.forEach((req: any) => {
          const key = req.nome_mp || req.codigo_mp;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push({
            id: req.id,
            date: req.created_at || req.data_necessidade,
            amount: parseFloat(req.quantidade_solicitada || 0),
            status: req.status || 'pendente',
            notes: req.observacoes || '',
            codigo_mp: req.codigo_mp,
            nome_mp: req.nome_mp,
            unidade: req.unidade || 'kg',
            prioridade: req.prioridade || 'media',
            solicitante: req.solicitante || 'Operador',
            produto_destino: req.produto_destino || '',
            data_necessidade: req.data_necessidade
          });
        });
        setMaterialRequests(grouped);
      }
    } catch (err) {
      console.error('Erro ao carregar solicitações do PostgreSQL:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Adicionar ou editar solicitação
  const handleAddRequest = useCallback(async (excipient: string, request: any, index: number | null = null, extraData: any = {}) => {
    try {
      if (index !== null && materialRequests[excipient]?.[index]) {
        // Editando existente
        const targetReq = materialRequests[excipient][index];
        await updateSolicitacao({
          id: targetReq.id,
          status: request.status,
          observacoes: request.notes,
        });
        toast.success('Solicitação atualizada!');
      } else {
        // Nova solicitação
        const codigo = extraData.codigo || request.codigo_mp || '000000';
        await createSolicitacao({
          codigo_mp: codigo,
          nome_mp: excipient,
          quantidade_solicitada: parseFloat(request.amount || 0),
          unidade: request.unidade || 'kg',
          prioridade: request.prioridade || 'media',
          solicitante: request.solicitante || 'Operador',
          data_necessidade: request.data_necessidade || new Date().toISOString().split('T')[0],
          produto_destino: request.produto_destino || '',
          observacoes: request.notes || ''
        });
        toast.success('Solicitação enviada ao Almoxarifado!');
      }
      await loadRequests();
    } catch (err: any) {
      console.error('Erro ao salvar solicitação:', err);
      toast.error('Erro ao salvar solicitação');
    }
  }, [materialRequests, loadRequests]);

  // Excluir solicitação
  const handleDeleteRequest = useCallback(async (excipient: string, index: number) => {
    try {
      const targetReq = materialRequests[excipient]?.[index];
      if (!targetReq?.id) return;

      await deleteSolicitacao(targetReq.id);
      toast.success('Solicitação excluída');
      await loadRequests();
    } catch (err) {
      console.error('Erro ao excluir solicitação:', err);
      toast.error('Erro ao excluir solicitação');
    }
  }, [materialRequests, loadRequests]);

  // Atualizar status diretamente
  const handleUpdateRequestStatus = useCallback(async (excipient: string, index: number, newStatus: string) => {
    try {
      const targetReq = materialRequests[excipient]?.[index];
      if (!targetReq?.id) return;

      await updateSolicitacao({
        id: targetReq.id,
        status: newStatus
      });
      toast.success(`Status alterado para ${newStatus}`);
      await loadRequests();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      toast.error('Erro ao atualizar status');
    }
  }, [materialRequests, loadRequests]);

  const value = {
    materialRequests,
    setMaterialRequests,
    handleAddRequest,
    handleDeleteRequest,
    handleUpdateRequestStatus,
    loadRequests,
    loading,
  };

  return (
    <RequestsContext.Provider value={value}>
      {children}
    </RequestsContext.Provider>
  );
}

export function useRequests() {
  const context = useContext(RequestsContext);
  if (!context) {
    throw new Error('useRequests must be used within a RequestsProvider');
  }
  return context;
}
