import React from 'react';
import { 
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  TruckIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { STATUS } from './constants';

export const Table = ({ 
  materialRequests, 
  getSolicitacaoSummary,
  onOpenSolicitacaoModal
}: {
  materialRequests: Record<string, any[]>;
  getSolicitacaoSummary: (material: string) => { count: number; total: number; status: string | null };
  onOpenSolicitacaoModal: (material: string) => void;
}) => {
  const renderStatusBadge = (status: string | null, count: number) => {
    switch (status) {
      case STATUS.PENDENTE:
      case 'pendente':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300">
            <ClockIcon className="w-3 h-3 mr-1" />
            {count} {count === 1 ? 'pendente' : 'pendentes'}
          </span>
        );
      case STATUS.SOLICITADO:
      case 'solicitado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300">
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            {count} {count === 1 ? 'solicitado' : 'solicitados'}
          </span>
        );
      case STATUS.SEPARADO:
      case 'separado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
            <ArchiveBoxIcon className="w-3 h-3 mr-1" />
            {count} {count === 1 ? 'separado' : 'separados'}
          </span>
        );
      case STATUS.ENTREGUE:
      case 'entregue':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
            <TruckIcon className="w-3 h-3 mr-1" />
            {count} {count === 1 ? 'entregue' : 'entregues'}
          </span>
        );
      case 'pago':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
            <BanknotesIcon className="w-3 h-3 mr-1" />
            {count} {count === 1 ? 'pago' : 'pagos'}
          </span>
        );
      default:
        return null;
    }
  };

  const materiaisComSolicitacoes = Object.keys(materialRequests)
    .filter(material => materialRequests[material]?.length > 0);

  if (materiaisComSolicitacoes.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
          <ArrowPathIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nenhuma solicitação ativa no Almoxarifado
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Material
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Quantidade
            </th>
            <th scope="col" className="w-10 px-1 py-2"></th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-700">
          {materiaisComSolicitacoes.map(material => {
            const summary = getSolicitacaoSummary(material);
            
            return (
              <tr key={material} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                  {material}
                </td>
                <td className="px-3 py-2">
                  {renderStatusBadge(summary.status, summary.count)}
                </td>
                <td className="px-3 py-2 text-right text-sm">
                  <span className="inline-block min-w-[60px] font-medium text-gray-800 dark:text-gray-200">
                    {summary.total.toFixed(3)} kg
                  </span>
                </td>
                <td className="px-1 py-2 text-center">
                  <button
                    onClick={() => onOpenSolicitacaoModal(material)}
                    className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 
                             rounded transition-all duration-200"
                    title="Atualizar status"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
