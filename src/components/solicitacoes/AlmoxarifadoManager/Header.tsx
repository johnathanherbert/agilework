import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export const Header = ({ materialRequests = {} }: { materialRequests?: Record<string, any[]> }) => {
  const requestCount = Object.keys(materialRequests).filter(k => materialRequests[k]?.length > 0).length;
  const totalItems = Object.values(materialRequests).reduce(
    (sum, requests) => sum + (requests?.length || 0), 0
  );
  
  return (
    <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 flex items-center justify-center">
          <ArrowPathIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            Status de Solicitações
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Almoxarifado
          </p>
        </div>
      </div>
      
      {requestCount > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 text-xs font-medium rounded-full">
            {requestCount} {requestCount === 1 ? 'material' : 'materiais'}
          </span>
          <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
            {totalItems} {totalItems === 1 ? 'solicitação' : 'solicitações'}
          </span>
        </div>
      )}
    </div>
  );
};

export default Header;
