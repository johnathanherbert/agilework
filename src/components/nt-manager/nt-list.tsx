   "use client";

import { useState, useEffect } from 'react';
import { NT } from '@/types';
import { NTCard } from './nt-card';

interface NTListProps {
  nts: NT[];
  onEdit: (nt: NT) => void;
  onDelete: (ntId: string) => void;
  onRefresh?: () => void;
  autoExpandedNTs?: string[];
  highlightedItems?: string[];
}

export const NTList = ({ nts, onEdit, onDelete, onRefresh, autoExpandedNTs = [], highlightedItems = [] }: NTListProps) => {
  const [expandedNT, setExpandedNT] = useState<string | null>(null);

  // Auto-expand NTs when autoExpandedNTs changes
  useEffect(() => {
    if (autoExpandedNTs.length > 0) {
      setExpandedNT(autoExpandedNTs[0]);
    }
  }, [autoExpandedNTs]);

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
          onRefresh={onRefresh}
          highlightedItems={highlightedItems}
        />
      ))}
    </div>
  );
};