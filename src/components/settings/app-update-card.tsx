"use client";

import { useAppUpdate } from '@/hooks/useAppUpdate';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RefreshCw, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const AppUpdateCard = () => {
  const { 
    updateAvailable, 
    isChecking, 
    lastChecked, 
    currentVersion,
    checkForUpdate, 
    reloadApp,
    resetUpdateState
  } = useAppUpdate();

  const formatLastChecked = (date: Date | null) => {
    if (!date) return 'Nunca';
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Atualizações do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Versão atual:</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-700">
                v{currentVersion}
              </span>
              {process.env.NODE_ENV === 'development' && (
                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                  DEV
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Última verificação:</span>
            <span className="text-sm">
              {formatLastChecked(lastChecked)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {updateAvailable ? (
              <>
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-orange-600 dark:text-orange-400">
                  Nova versão disponível
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  Aplicação atualizada
                </span>
              </>
            )}
          </div>
        </div>        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={checkForUpdate}
            disabled={isChecking}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Verificando...' : 'Verificar Atualizações'}
          </Button>

          {updateAvailable && (
            <Button
              size="sm"
              onClick={reloadApp}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Atualizar Agora
            </Button>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetUpdateState}
              className="flex items-center gap-2 text-orange-600 border-orange-300"
            >
              <AlertCircle className="h-4 w-4" />
              Reset Estado
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 border-t pt-3">
          <p>• O sistema verifica automaticamente por atualizações a cada 10 minutos</p>
          <p>• Atualizações também são verificadas quando você volta para a aba</p>
          <p>• Quando uma nova versão estiver disponível, você será notificado</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-orange-500">• Auto-update desabilitado em desenvolvimento</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
