import { useEffect } from 'react';
import { getNTCleanupConfig, cleanOldCompletedNTs } from '@/lib/firestore-helpers';

export function useAutoNTCleanup() {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkAndRunCleanup = async () => {
      try {
        const config = await getNTCleanupConfig();
        if (!config.enabled) return;

        // Verificar se já rodou nas últimas 12 horas
        if (config.lastRun) {
          const lastRunDate = new Date(config.lastRun);
          const now = new Date();
          const hoursSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastRun < 12) {
            console.log('ℹ️ Limpeza de NTs já executada recentemente (há menos de 12 horas).');
            return;
          }
        }

        console.log('🤖 Executando rotina automática de limpeza para NTs concluídas (> 30 dias)...');
        await cleanOldCompletedNTs(config.retentionDays || 30);
      } catch (err) {
        console.warn('⚠️ Erro na rotina de limpeza automática de NTs:', err);
      }
    };

    // Executa 10 segundos após a inicialização do app
    timeoutId = setTimeout(() => {
      checkAndRunCleanup();
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, []);
}
