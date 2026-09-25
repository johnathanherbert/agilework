import React, { useState, useMemo } from 'react';
import { Header } from './Header';
import { Table } from './Table';
import { SolicitacaoModal } from './SolicitacaoModal';
import { STATUS } from './constants';
import { useRequests } from '@/contexts/RequestsContext';

export default function AlmoxarifadoManager() {
  const [showModal, setShowModal] = useState(false);
  const [selectedExcipient, setSelectedExcipient] = useState<string | null>(null);
  
  const { materialRequests, handleUpdateRequestStatus, handleDeleteRequest } = useRequests();

  const handleOpenSolicitacaoModal = (excipient: string) => {
    setSelectedExcipient(excipient);
    setShowModal(true);
  };

  const handleCloseSolicitacaoModal = () => {
    setShowModal(false);
    setSelectedExcipient(null);
  };

  const memoizedGetSolicitacaoSummary = useMemo(() => {
    return (material: string) => {
      if (!materialRequests[material] || materialRequests[material].length === 0) {
        return {
          count: 0,
          total: 0,
          status: null
        };
      }
      
      const requests = materialRequests[material];
      const total = requests.reduce((sum: number, req: any) => sum + parseFloat(req.amount || 0), 0);
      
      const pendingExists = requests.some((req: any) => req.status === STATUS.PENDENTE || req.status === 'pendente');
      const requestedExists = requests.some((req: any) => req.status === STATUS.SOLICITADO || req.status === 'solicitado');
      const separatedExists = requests.some((req: any) => req.status === STATUS.SEPARADO || req.status === 'separado');
      const deliveredExists = requests.some((req: any) => req.status === STATUS.ENTREGUE || req.status === 'entregue' || req.status === 'pago');
      
      let status: string | null = null;
      if (pendingExists) status = STATUS.PENDENTE;
      else if (requestedExists) status = STATUS.SOLICITADO;
      else if (separatedExists) status = STATUS.SEPARADO;
      else if (deliveredExists) status = STATUS.ENTREGUE;
      
      return {
        count: requests.length,
        total,
        status
      };
    };
  }, [materialRequests]);

  return (
    <div className="overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
      <Header materialRequests={materialRequests} />
      <Table 
        materialRequests={materialRequests}
        getSolicitacaoSummary={memoizedGetSolicitacaoSummary}
        onOpenSolicitacaoModal={handleOpenSolicitacaoModal}
      />
      <SolicitacaoModal 
        show={showModal}
        selectedExcipient={selectedExcipient}
        materialRequests={materialRequests}
        onClose={handleCloseSolicitacaoModal}
        onUpdateStatus={handleUpdateRequestStatus}
        onDeleteRequest={handleDeleteRequest}
      />
    </div>
  );
}
