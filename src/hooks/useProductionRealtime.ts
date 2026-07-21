import { useState, useEffect, useCallback } from 'react';
import { subscribeToProductionItems } from '@/lib/production-helpers';
import { ProductionItem } from '@/types';

interface UseProductionRealtimeResult {
  items: ProductionItem[];
  loading: boolean;
  connected: boolean;
  error: string | null;
}

export function useProductionRealtime(): UseProductionRealtimeResult {
  const [items, setItems] = useState<ProductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = useCallback((data: ProductionItem[]) => {
    setItems(data);
    setLoading(false);
    setConnected(true);
    setError(null);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
    setConnected(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToProductionItems(handleUpdate, handleError);
    return () => unsubscribe();
  }, [handleUpdate, handleError]);

  return { items, loading, connected, error };
}
