"use client";

import { useState } from 'react';
import { NTFilters as NTFiltersType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, SlidersHorizontal, RotateCcw, Calendar, Clock, Sparkles, FilterX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NTFiltersProps {
  filters: NTFiltersType;
  onChange: (newFilters: Partial<NTFiltersType>) => void;
  counts?: {
    all: number;
    pending: number;
    paid: number;
    delayed: number;
  };
}

export const NTFilters = ({ filters, onChange, counts }: NTFiltersProps) => {
  const [dateFrom, setDateFrom] = useState<string>(filters.dateRange?.from || '');
  const [dateTo, setDateTo] = useState<string>(filters.dateRange?.to || '');

  const activeTab = filters.isCompletedView
    ? 'completed'
    : filters.overdueOnly
    ? 'overdue'
    : filters.status?.includes('Ag. Pagamento')
    ? 'pending'
    : 'all';

  const handleTabChange = (tab: 'all' | 'pending' | 'completed' | 'overdue') => {
    if (tab === 'all') {
      onChange({
        status: [],
        overdueOnly: false,
        isCompletedView: false,
      });
    } else if (tab === 'pending') {
      onChange({
        status: ['Ag. Pagamento'],
        overdueOnly: false,
        isCompletedView: false,
      });
    } else if (tab === 'overdue') {
      onChange({
        overdueOnly: true,
        isCompletedView: false,
      });
    } else if (tab === 'completed') {
      onChange({
        status: ['Pago'],
        overdueOnly: false,
        isCompletedView: true,
      });
    }
  };

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const newValue = field === 'from' ? setDateFrom : setDateTo;
    newValue(value);

    const dateRange = {
      from: field === 'from' ? value : dateFrom,
      to: field === 'to' ? value : dateTo,
    };

    if (dateRange.from || dateRange.to) {
      onChange({ dateRange });
    }
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    onChange({
      search: '',
      status: [],
      dateRange: null,
      shift: null,
      overdueOnly: false,
      hideOldNts: false,
      priorityOnly: false,
      isCompletedView: false,
    });
  };

  const hasAdvancedFilters = Boolean(
    filters.shift ||
    filters.dateRange ||
    filters.priorityOnly ||
    filters.hideOldNts
  );

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 select-none">
      {/* Abas Segmentadas */}
      <div className="flex items-center gap-1 border-b sm:border-b-0 sm:border border-[var(--border)] rounded-[var(--radius)] p-0.5 bg-[var(--surface-2)] overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
            activeTab === 'all'
              ? "bg-[var(--surface)] text-[var(--text)] font-semibold shadow-xs"
              : "text-[var(--text-3)] hover:text-[var(--text)]"
          )}
        >
          <span>Todas</span>
          {counts && <span className="text-[10px] font-mono text-[var(--text-3)]">({counts.all})</span>}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('pending')}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
            activeTab === 'pending'
              ? "bg-[var(--surface)] text-[var(--text)] font-semibold shadow-xs"
              : "text-[var(--text-3)] hover:text-[var(--text)]"
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
          <span>Aguardando</span>
          {counts && <span className="text-[10px] font-mono text-[var(--text-3)]">({counts.pending})</span>}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('overdue')}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
            activeTab === 'overdue'
              ? "bg-[var(--surface)] text-[var(--red)] font-semibold shadow-xs"
              : "text-[var(--text-3)] hover:text-[var(--red)]"
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
          <span>Em atraso</span>
          {counts && counts.delayed > 0 && (
            <span className="text-[10px] font-mono font-bold text-[var(--red)]">({counts.delayed})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('completed')}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
            activeTab === 'completed'
              ? "bg-[var(--surface)] text-[var(--text)] font-semibold shadow-xs"
              : "text-[var(--text-3)] hover:text-[var(--text)]"
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
          <span>Concluídas</span>
          {counts && <span className="text-[10px] font-mono text-[var(--text-3)]">({counts.paid})</span>}
        </button>
      </div>

      {/* Busca & Popover de Filtros Avançados */}
      <div className="flex items-center gap-2">
        {/* Campo de Busca com Atalho */}
        <div className="relative flex-1 sm:w-64 flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-[var(--text-3)] pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar NT, código ou material"
            value={filters.search || ''}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full h-8 pl-8 pr-7 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all font-sans"
          />
          <kbd className="absolute right-2 text-[10px] font-mono text-[var(--text-3)] border border-[var(--border)] bg-[var(--surface-2)] px-1 rounded">
            /
          </kbd>
        </div>

        {/* Popover de Filtros Avançados */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "h-8 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                hasAdvancedFilters
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-weak)]"
                  : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
              )}
              title="Filtros avançados"
            >
              <SlidersHorizontal size={13} />
              <span className="hidden sm:inline">Filtros</span>
              {hasAdvancedFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3.5 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] rounded-[var(--radius)] shadow-xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-xs font-semibold">Filtros Avançados</span>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-[var(--text-3)] hover:text-[var(--text)] flex items-center gap-1 cursor-pointer"
              >
                <FilterX size={11} />
                Limpar
              </button>
            </div>

            {/* Turno */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-2)]">Turno da Fábrica</label>
              <Select
                value={filters.shift?.toString() || 'all'}
                onValueChange={(val) => onChange({ shift: val === 'all' ? null : parseInt(val, 10) })}
              >
                <SelectTrigger className="h-8 text-xs bg-[var(--surface-2)] border-[var(--border)]">
                  <SelectValue placeholder="Todos os turnos" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--surface)] border-[var(--border-strong)] text-xs">
                  <SelectItem value="all">Todos os turnos</SelectItem>
                  <SelectItem value="1">1º Turno (06:00 – 14:00)</SelectItem>
                  <SelectItem value="2">2º Turno (14:00 – 22:00)</SelectItem>
                  <SelectItem value="3">3º Turno (22:00 – 06:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Intervalo de Datas */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-2)]">Data de Criação</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                  className="h-8 px-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-[11px] text-[var(--text)] focus:outline-none"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                  className="h-8 px-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-[11px] text-[var(--text)] focus:outline-none"
                />
              </div>
            </div>

            {/* Opções Booleanas */}
            <div className="space-y-2 pt-1 border-t border-[var(--border)]">
              <label className="flex items-center justify-between text-xs text-[var(--text-2)] cursor-pointer">
                <span>Apenas itens prioritários</span>
                <Switch
                  checked={Boolean(filters.priorityOnly)}
                  onCheckedChange={(val) => onChange({ priorityOnly: val })}
                />
              </label>

              <label className="flex items-center justify-between text-xs text-[var(--text-2)] cursor-pointer">
                <span>Ocultar NTs antigas</span>
                <Switch
                  checked={Boolean(filters.hideOldNts)}
                  onCheckedChange={(val) => onChange({ hideOldNts: val })}
                />
              </label>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};