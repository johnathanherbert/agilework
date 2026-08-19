"use client";

import { LaborOccurrence, Operator, ProductionTurno } from '@/types';
import { TratativasHub } from './tratativas-hub';

interface TratativasTabProps {
  occurrences: LaborOccurrence[];
  operators: Operator[];
  selectedTurno: ProductionTurno | 'ALL';
}

export function TratativasTab({
  occurrences,
  operators,
  selectedTurno,
}: TratativasTabProps) {
  return (
    <TratativasHub
      occurrences={occurrences}
      operators={operators}
      selectedTurno={selectedTurno}
    />
  );
}
