import React from 'react';
import { STATUS } from './constants';
import { 
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  XMarkIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

export const SolicitacaoStatus = ({ 
  materialRequests,
  selectedExcipient,
  onUpdateStatus,
  onDeleteRequest
}: {
  materialRequests: Record<string, any[]>;
  selectedExcipient: string;
  onUpdateStatus: (excipient: string, index: number, newStatus: string) => void;
  onDeleteRequest: (excipient: string, index: number) => void;
}) => {
  const requests = materialRequests[selectedExcipient] || [];
  
  if (requests.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 mb-3">
          <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Nenhuma solicitação encontrada
        </h3>
      </div>
    );
  }

  const totalRequested = requests.reduce(
    (total: number, req: any) => total + parseFloat(req.amount || 0), 0
  ).toFixed(3);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case STATUS.PENDENTE:
      case 'pendente':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 ring-1 ring-orange-600/20">
            <ClockIcon className="w-3 h-3 mr-1" />
            Pendente
          </span>
        );
      case STATUS.SOLICITADO:
      case 'solicitado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 ring-1 ring-yellow-600/20">
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            Solicitado
          </span>
        );
      case STATUS.SEPARADO:
      case 'separado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 ring-1 ring-blue-600/20">
            <ArchiveBoxIcon className="w-3 h-3 mr-1" />
            Separado
          </span>
        );
      case STATUS.ENTREGUE:
      case 'entregue':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 ring-1 ring-green-600/20">
            <TruckIcon className="w-3 h-3 mr-1" />
            Entregue
          </span>
        );
      case 'pago':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 ring-1 ring-green-600/20">
            <BanknotesIcon className="w-3 h-3 mr-1" />
            Pago
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/40 text-gray-800 dark:text-gray-300 ring-1 ring-gray-600/20">
            {status}
          </span>
        );
    }
  };

  const statusOptions = [STATUS.PENDENTE, STATUS.SOLICITADO, STATUS.SEPARADO, STATUS.ENTREGUE, 'pago'];

  return (
    <div className="space-y-4">
      <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 
                    rounded-lg border border-purple-100 dark:border-purple-800/30 flex justify-between items-center">
        <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300">
          {selectedExcipient}
        </h3>
        <span className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
          Total: {totalRequested} kg
        </span>
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {requests.map((request: any, index: number) => (
          <div 
            key={request.id || index}
            className="bg-white dark:bg-gray-800 p-3"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="space-x-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {parseFloat(request.amount).toFixed(3)} kg
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(request.date).toLocaleDateString('pt-BR')}
                </span>
              </div>
              
              <div className="flex items-center">
                {renderStatusBadge(request.status)}
                
                <button
                  onClick={() => onDeleteRequest(selectedExcipient, index)}
                  className="ml-2 p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                  title="Excluir solicitação"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {request.notes && (
              <div className="text-xs text-gray-600 dark:text-gray-400 italic mb-2">
                "{request.notes}"
              </div>
            )}
            
            <div className="mt-2 flex flex-wrap gap-2">
              {statusOptions.map(status => (
                request.status !== status && (
                  <button
                    key={status}
                    onClick={() => onUpdateStatus(selectedExcipient, index, status)}
                    className={`
                      p-1 flex items-center text-xs font-medium rounded-md transition-colors
                      ${status === STATUS.PENDENTE ? 'bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/20' : ''}
                      ${status === STATUS.SOLICITADO ? 'bg-yellow-50 dark:bg-yellow-900/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/20' : ''}
                      ${status === STATUS.SEPARADO ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20' : ''}
                      ${status === STATUS.ENTREGUE ? 'bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20' : ''}
                      ${status === 'pago' ? 'bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20' : ''}
                    `}
                  >
                    {status === STATUS.PENDENTE && <ClockIcon className="w-3 h-3 mr-1" />}
                    {status === STATUS.SOLICITADO && <CheckCircleIcon className="w-3 h-3 mr-1" />}
                    {status === STATUS.SEPARADO && <ArchiveBoxIcon className="w-3 h-3 mr-1" />}
                    {status === STATUS.ENTREGUE && <TruckIcon className="w-3 h-3 mr-1" />}
                    {status === 'pago' && <BanknotesIcon className="w-3 h-3 mr-1" />}
                    <span className="capitalize">{status === 'pago' ? 'Pago' : status}</span>
                  </button>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SolicitacaoStatus;
