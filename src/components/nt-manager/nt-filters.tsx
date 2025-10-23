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
      <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-lg bg-gradient-to-br from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/50 dark:to-gray-900 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-600 to-transparent opacity-50" />
        
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/50" />
            Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 dark:hover:from-red-900/20 dark:hover:to-pink-900/20 transition-all duration-200 group cursor-pointer">
            <Checkbox
              id="status-pending"
              checked={filters.status?.includes('Ag. Pagamento') || false}
              onCheckedChange={() => handleStatusChange('Ag. Pagamento')}
              className="border-gray-400 dark:border-gray-500 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-red-500 data-[state=checked]:to-red-600"
            />
            <Label 
              htmlFor="status-pending" 
              className="text-sm font-medium cursor-pointer flex items-center gap-2 flex-1"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200">
                <XCircle className="h-4 w-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-gray-300 font-semibold">Aguardando Pagamento</span>
            </Label>
          </div>
          
          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/20 dark:hover:to-emerald-900/20 transition-all duration-200 group cursor-pointer">
            <Checkbox
              id="status-paid"
              checked={filters.status?.includes('Pago') || false}
              onCheckedChange={() => handleStatusChange('Pago')}
              className="border-gray-400 dark:border-gray-500 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-600"
            />
            <Label 
              htmlFor="status-paid" 
              className="text-sm font-medium cursor-pointer flex items-center gap-2 flex-1"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-gray-300 font-semibold">Pago</span>
            </Label>
          </div>
          
          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/20 dark:hover:to-orange-900/20 transition-all duration-200 group cursor-pointer">
            <Checkbox
              id="status-partial"
              checked={filters.status?.includes('Pago Parcial') || false}
              onCheckedChange={() => handleStatusChange('Pago Parcial')}
              className="border-gray-400 dark:border-gray-500 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-600"
            />
            <Label 
              htmlFor="status-partial" 
              className="text-sm font-medium cursor-pointer flex items-center gap-2 flex-1"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-gray-300 font-semibold">Pago Parcial</span>
            </Label>
          </div>
        </CardContent>
      </Card>
      
      {/* Date and Shift Filters */}
      <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-lg bg-gradient-to-br from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/50 dark:to-gray-900 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-300 dark:via-purple-600 to-transparent opacity-50" />
        
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 shadow-md shadow-purple-500/50" />
            Data e Turno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date-from" className="text-xs font-bold text-gray-700 dark:text-gray-300">De</Label>
              <div className="relative group">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 text-blue-600 dark:text-blue-400 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-200" />
                <Input 
                  id="date-from"
                  type="date"
                  className="pl-9 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-medium"
                  value={dateFrom}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-to" className="text-xs font-bold text-gray-700 dark:text-gray-300">Até</Label>
              <div className="relative group">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 text-blue-600 dark:text-blue-400 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-200" />
                <Input 
                  id="date-to"
                  type="date"
                  className="pl-9 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-medium"
                  value={dateTo}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="shift" className="text-xs font-bold text-gray-700 dark:text-gray-300">Turno</Label>
            <Select
              value={filters.shift?.toString() || 'all'}
              onValueChange={(value) => {
                onChange({ shift: value === 'all' ? null : parseInt(value, 10) });
              }}
            >
              <SelectTrigger className="border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-200 font-medium hover:shadow-md">
                <Clock className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
                <SelectValue placeholder="Selecione o turno" />
              </SelectTrigger>
              <SelectContent className="border-gray-300 dark:border-gray-600">
                <SelectItem value="all" className="font-medium">Todos os turnos</SelectItem>
                <SelectItem value="1" className="font-medium">1º Turno (06:00-14:00)</SelectItem>
                <SelectItem value="2" className="font-medium">2º Turno (14:00-22:00)</SelectItem>
                <SelectItem value="3" className="font-medium">3º Turno (22:00-06:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Options and Actions */}
      <Card className="relative overflow-hidden border-gray-200/50 dark:border-gray-700/50 shadow-lg bg-gradient-to-br from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/50 dark:to-gray-900 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-300 dark:via-green-600 to-transparent opacity-50" />
        
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-md shadow-green-500/50" />
            Opções
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/20 dark:hover:to-orange-900/20 transition-all duration-200 border border-transparent hover:border-amber-200 dark:hover:border-amber-800 group">
            <Label htmlFor="overdue-only" className="text-sm font-semibold cursor-pointer text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              Itens em atraso
            </Label>
            <Switch
              id="overdue-only"
              checked={filters.overdueOnly}
              onCheckedChange={(checked) => onChange({ overdueOnly: checked })}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-600"
            />
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-all duration-200 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 group">
            <Label htmlFor="hide-old-nts" className="text-sm font-semibold cursor-pointer text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              Ocultar NTs antigas
            </Label>
            <Switch
              id="hide-old-nts"
              checked={filters.hideOldNts}
              onCheckedChange={(checked) => onChange({ hideOldNts: checked })}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-indigo-600"
            />
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all duration-200 border border-transparent hover:border-purple-200 dark:hover:border-purple-800 group">
            <Label htmlFor="priority-only" className="text-sm font-semibold cursor-pointer text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              Itens prioritários
            </Label>
            <Switch
              id="priority-only"
              checked={filters.priorityOnly || false}
              onCheckedChange={(checked) => onChange({ priorityOnly: checked })}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-600"
            />
          </div>
          
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full relative overflow-hidden hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 dark:hover:from-red-900/30 dark:hover:to-pink-900/30 transition-all duration-200 hover:scale-105 hover:shadow-lg border-2 border-gray-300 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500 font-bold group"
              onClick={resetFilters}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <FilterX className="h-4 w-4 mr-2 relative z-10 text-red-600 dark:text-red-400 group-hover:rotate-180 transition-transform duration-300" />
              <span className="relative z-10">Limpar Filtros</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};