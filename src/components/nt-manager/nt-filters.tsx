   "use client";

import { useState } from 'react';
import { NTFilters as NTFiltersType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, FilterX, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NTFiltersProps {
  filters: NTFiltersType;
  onChange: (newFilters: Partial<NTFiltersType>) => void;
}

export const NTFilters = ({ filters, onChange }: NTFiltersProps) => {
  const [dateFrom, setDateFrom] = useState<string>(filters.dateRange?.from || '');
  const [dateTo, setDateTo] = useState<string>(filters.dateRange?.to || '');

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const newValue = field === 'from' ? setDateFrom : setDateTo;
    newValue(value);
    
    const dateRange = {
      from: field === 'from' ? value : dateFrom,
      to: field === 'to' ? value : dateTo
    };
    
    if (dateRange.from || dateRange.to) {
      onChange({ dateRange });
    }
  };
  
  const handleStatusChange = (status: string) => {
    let newStatus = [...(filters.status || [])];
    
    if (newStatus.includes(status)) {
      newStatus = newStatus.filter(s => s !== status);
    } else {
      newStatus.push(status);
    }
    
    onChange({ status: newStatus });
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
      priorityOnly: false
    });
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Status Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="status-pending"
              checked={filters.status?.includes('Ag. Pagamento') || false}
              onCheckedChange={() => handleStatusChange('Ag. Pagamento')}
            />
            <Label 
              htmlFor="status-pending" 
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <XCircle className="h-4 w-4 text-red-500" />
              Aguardando Pagamento
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="status-paid"
              checked={filters.status?.includes('Pago') || false}
              onCheckedChange={() => handleStatusChange('Pago')}
            />
            <Label 
              htmlFor="status-paid" 
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Pago
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="status-partial"
              checked={filters.status?.includes('Pago Parcial') || false}
              onCheckedChange={() => handleStatusChange('Pago Parcial')}
            />
            <Label 
              htmlFor="status-partial" 
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Pago Parcial
            </Label>
          </div>
        </CardContent>
      </Card>
      
      {/* Date and Shift Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Data e Turno</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date-from" className="text-xs text-muted-foreground">De</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                <Input 
                  id="date-from"
                  type="date"
                  className="pl-9"
                  value={dateFrom}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-to" className="text-xs text-muted-foreground">Até</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                <Input 
                  id="date-to"
                  type="date"
                  className="pl-9"
                  value={dateTo}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="shift" className="text-xs text-muted-foreground">Turno</Label>
            <Select
              value={filters.shift?.toString() || 'all'}
              onValueChange={(value) => {
                onChange({ shift: value === 'all' ? null : parseInt(value, 10) });
              }}
            >
              <SelectTrigger>
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecione o turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                <SelectItem value="1">1º Turno (06:00-14:00)</SelectItem>
                <SelectItem value="2">2º Turno (14:00-22:00)</SelectItem>
                <SelectItem value="3">3º Turno (22:00-06:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Options and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Opções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="overdue-only" className="text-sm font-normal cursor-pointer">
              Itens em atraso
            </Label>
            <Switch
              id="overdue-only"
              checked={filters.overdueOnly}
              onCheckedChange={(checked) => onChange({ overdueOnly: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="hide-old-nts" className="text-sm font-normal cursor-pointer">
              Ocultar NTs antigas
            </Label>
            <Switch
              id="hide-old-nts"
              checked={filters.hideOldNts}
              onCheckedChange={(checked) => onChange({ hideOldNts: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="priority-only" className="text-sm font-normal cursor-pointer">
              Itens prioritários
            </Label>
            <Switch
              id="priority-only"
              checked={filters.priorityOnly || false}
              onCheckedChange={(checked) => onChange({ priorityOnly: checked })}
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={resetFilters}
          >
            <FilterX className="h-4 w-4 mr-2" />
            Limpar Filtros
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};