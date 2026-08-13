"use client";

import { useEffect, useState } from 'react';
import { Operator, LaborOccurrence } from '@/types';
import { subscribeToOperators, subscribeToLaborOccurrences } from '@/lib/labor-helpers';

export function useLaborRealtime() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [occurrences, setOccurrences] = useState<LaborOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let opsLoaded = false;
    let occsLoaded = false;

    const checkFinished = () => {
      if (opsLoaded && occsLoaded) {
        setLoading(false);
        setConnected(true);
      }
    };

    const unsubOps = subscribeToOperators(
      (newOps) => {
        setOperators(newOps);
        opsLoaded = true;
        checkFinished();
      },
      (error) => {
        console.error('Erro ao subscrever operadores:', error);
        opsLoaded = true;
        checkFinished();
      }
    );

    const unsubOccs = subscribeToLaborOccurrences(
      (newOccs) => {
        setOccurrences(newOccs);
        occsLoaded = true;
        checkFinished();
      },
      (error) => {
        console.error('Erro ao subscrever ocorrências:', error);
        occsLoaded = true;
        checkFinished();
      }
    );

    return () => {
      unsubOps();
      unsubOccs();
    };
  }, []);

  return {
    operators,
    occurrences,
    loading,
    connected,
  };
}
