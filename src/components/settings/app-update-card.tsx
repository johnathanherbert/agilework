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
    reloadApp 
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Versão atual:</span>
            <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {currentVersion}
            </span>
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
        </div>

        <div className="flex gap-2">
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
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 border-t pt-3">
          <p>• O sistema verifica automaticamente por atualizações a cada 5 minutos</p>
          <p>• Atualizações também são verificadas quando você volta para a aba</p>
          <p>• Quando uma nova versão estiver disponível, você será notificado</p>
        </div>
      </CardContent>
    </Card>
  );
};
