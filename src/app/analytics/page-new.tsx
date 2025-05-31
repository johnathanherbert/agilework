"use client";

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/providers/supabase-provider';
import ProtectedRoute from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { RefreshCw, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface DailyStats {
  date: string;
  paid: number;
  created: number;
}

interface StatusDistribution {
  name: string;
  value: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyStats[]>([]);
  const [statusData, setStatusData] = useState<StatusDistribution[]>([]);
  const [averageProcessingTime, setAverageProcessingTime] = useState<string>('N/A');
  const [totalProcessed, setTotalProcessed] = useState<number>(0);
  
  const { user } = useSupabase();
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];
  
  const fetchAnalyticsData = async () => {
    setLoading(true);
    
    try {
      // Get daily stats for the last 14 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 13); // 14 days including today
      
      const dailyStats: DailyStats[] = [];
      
      // Generate date range
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        
        // Query for items created on this day
        const { data: createdItems, error: createdError } = await supabase
          .from('nt_items')
          .select('id')
          .eq('created_date', dateString);
          
        if (createdError) throw createdError;
        
        // Query for items paid on this day
        const { data: paidItems, error: paidError } = await supabase
          .from('nt_items')
          .select('id')
          .eq('status', 'Pago')
          .eq('payment_time', dateString);
          
        if (paidError) throw paidError;
        
        dailyStats.push({
          date: dateString,
          created: createdItems?.length || 0,
          paid: paidItems?.length || 0,
        });
      }
      
      setDailyData(dailyStats);
      
      // Get status distribution
      const { data: pendingItems, error: pendingError } = await supabase
        .from('nt_items')
        .select('id')
        .eq('status', 'Ag. Pagamento');
        
      if (pendingError) throw pendingError;
      
      const { data: paidItems, error: paidError } = await supabase
        .from('nt_items')
        .select('id')
        .eq('status', 'Pago');
        
      if (paidError) throw paidError;
      
      const { data: partialItems, error: partialError } = await supabase
        .from('nt_items')
        .select('id')
        .eq('status', 'Pago Parcial');
        
      if (partialError) throw partialError;
      
      setStatusData([
        { name: 'Pendente', value: pendingItems?.length || 0 },
        { name: 'Pago', value: paidItems?.length || 0 },
        { name: 'Parcial', value: partialItems?.length || 0 },
      ]);
      
      // Calculate average processing time for completed payments
      const { data: processedItems, error: processedError } = await supabase
        .from('nt_items')
        .select('created_date, payment_time')
        .eq('status', 'Pago');
        
      if (processedError) throw processedError;
      
      if (processedItems && processedItems.length > 0) {
        // Calculate the average time between creation and payment
        let totalHours = 0;
        
        processedItems.forEach(item => {
          if (item.created_date && item.payment_time) {
            const createdDate = new Date(item.created_date);
            const paidDate = new Date(item.payment_time);
            const diffTime = Math.abs(paidDate.getTime() - createdDate.getTime());
            const diffHours = diffTime / (1000 * 60 * 60);
            totalHours += diffHours;
          }
        });
        
        const average = totalHours / processedItems.length;
        setAverageProcessingTime(`${average.toFixed(1)} horas`);
        setTotalProcessed(processedItems.length);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('Erro ao carregar dados analíticos');
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold">Análises</h1>
                <p className="text-gray-500 dark:text-gray-400">
                  Estatísticas e tendências do sistema
                </p>
              </div>
              
              <Button variant="outline" onClick={fetchAnalyticsData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Carregando...' : 'Atualizar dados'}
              </Button>
            </div>
            
            {/* Key metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Tempo Médio de Processamento
                    </p>
                    <p className="text-3xl font-bold mt-2">{averageProcessingTime}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Itens Processados Total
                    </p>
                    <p className="text-3xl font-bold mt-2">{totalProcessed}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Taxa de Pagamento
                    </p>
                    <p className="text-3xl font-bold mt-2">
                      {statusData.length > 0 
                        ? `${Math.round((statusData[1].value / (statusData[0].value + statusData[1].value + statusData[2].value)) * 100)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Itens Criados (14 dias)
                    </p>
                    <p className="text-3xl font-bold mt-2">
                      {dailyData.reduce((sum, day) => sum + day.created, 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Itens por Dia (Últimos 14 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {loading ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">Carregando dados...</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={dailyData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }} 
                            tickFormatter={formatDate}
                            angle={-45}
                            textAnchor="end"
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: any) => [`${value} itens`, '']}
                            labelFormatter={(label: string) => formatDate(label)}
                          />
                          <Legend />
                          <Area 
                            type="monotone" 
                            dataKey="created" 
                            stroke="#8884d8" 
                            fill="#8884d8" 
                            name="Criados"
                            stackId="1"
                            fillOpacity={0.3}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="paid" 
                            stroke="#82ca9d" 
                            fill="#82ca9d" 
                            name="Pagos"
                            stackId="2"
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    Distribuição de Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {loading ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">Carregando dados...</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }: { name: string, percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip formatter={(value: any) => [`${value} itens`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
