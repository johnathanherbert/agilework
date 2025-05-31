   "use client";

import { useState } from 'react';
import { NT } from '@/types';
import { NTCard } from './nt-card';

interface NTListProps {
  nts: NT[];
  onEdit: (nt: NT) => void;
  onDelete: (ntId: string) => void;
}

export const NTList = ({ nts, onEdit, onDelete }: NTListProps) => {
  const [expandedNT, setExpandedNT] = useState<string | null>(null);

  const toggleExpand = (ntId: string) => {
    setExpandedNT(expandedNT === ntId ? null : ntId);
  };
  
  return (
    <div className="space-y-5">
      {nts.map((nt) => (
        <NTCard 
          key={nt.id}
          nt={nt}
          isExpanded={expandedNT === nt.id}
          onToggle={() => toggleExpand(nt.id)}
          onEdit={() => onEdit(nt)}
          onDelete={() => onDelete(nt.id)}
        />
      ))}
    </div>
  );
};