"use client";

import { useState, useEffect, useCallback } from 'react';
import { Solicitacao, SolicitacaoFormData, ListaTecnicaItem, SaldoMP } from '@/types/solicitacao';
import {
  fetchSolicitacoes,
  createSolicitacao as apiCreateSolicitacao,
  updateSolicitacao as apiUpdateSolicitacao,
  deleteSolicitacao as apiDeleteSolicitacao,
  fetchListaTecnica,
  fetchSaldoMP,
} from '@/lib/dashpesagem-api';
import toast from 'react-hot-toast';

export function useSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [listaTecnica, setListaTecnica] = useState<ListaTecnicaItem[]>([]);
  const [saldoMP, setSaldoMP] = useState<SaldoMP[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [solicitacoesData, listaTecnicaData, saldoData] = await Promise.all([
        fetchSolicitacoes().catch(() => []),
        fetchListaTecnica().catch(() => []),
        fetchSaldoMP().catch(() => []),
      ]);
      setSolicitacoes(solicitacoesData);
      setListaTecnica(listaTecnicaData);
      setSaldoMP(saldoData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createSolicitacao = useCallback(async (data: SolicitacaoFormData) => {
    try {
      await apiCreateSolicitacao(data);
      toast.success('Solicitação criada com sucesso!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao criar solicitação');
    }
  }, [loadData]);

  const updateSolicitacaoStatus = useCallback(async (id: string, status: string) => {
    try {
      await apiUpdateSolicitacao({ id, status });
      toast.success('Status atualizado com sucesso!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  }, [loadData]);

  const deleteSolicitacaoFn = useCallback(async (id: string) => {
    try {
      await apiDeleteSolicitacao(id);
      toast.success('Solicitação excluída com sucesso!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao excluir solicitação');
    }
  }, [loadData]);

  return {
    solicitacoes,
    listaTecnica,
    saldoMP,
    isLoading,
    createSolicitacao,
    updateSolicitacaoStatus,
    deleteSolicitacao: deleteSolicitacaoFn,
    refreshData: loadData,
  };
}
