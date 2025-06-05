"use client";

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/providers/supabase-provider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AppUpdateCard } from '@/components/settings/app-update-card';
import { Save, User, Bell, Shield, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotifications } from '@/components/providers/notification-provider';

export default function SettingsPage() {  const { user } = useSupabase();
  const router = useRouter();
  const { notificationsEnabled, setNotificationsEnabled, soundEnabled, setSoundEnabled } = useNotifications();
  
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [notifyNewNTs, setNotifyNewNTs] = useState(true);
  const [notifyPayments, setNotifyPayments] = useState(true);
  const [notifyRobotAlerts, setNotifyRobotAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Handle authentication
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);
  // Carrega configurações do usuário
  useEffect(() => {
    if (user?.user_metadata) {
      if (user.user_metadata.name) {
        setName(user.user_metadata.name);
      }
      if (user.user_metadata.notifyNewNTs !== undefined) {
        setNotifyNewNTs(user.user_metadata.notifyNewNTs);
      }
      if (user.user_metadata.notifyPayments !== undefined) {
        setNotifyPayments(user.user_metadata.notifyPayments);
      }
      if (user.user_metadata.notifyRobotAlerts !== undefined) {
        setNotifyRobotAlerts(user.user_metadata.notifyRobotAlerts);
      }
      // Carregar configuração de som das notificações
      if (user.user_metadata.soundEnabled !== undefined) {
        setSoundEnabled(user.user_metadata.soundEnabled);
      }
    }
  }, [user, setSoundEnabled]);
  
  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Carregando...</h2>
        <p className="text-gray-500 mt-2">Aguarde um momento</p>
      </div>
    </div>;
  }
  const saveUserProfile = async () => {
    setSaving(true);
    
    try {
      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          name,
          notifyNewNTs,
          notifyPayments,
          notifyRobotAlerts,
          soundEnabled
        }
      });
      
      if (updateError) throw updateError;
      
      // Atualizar configuração de notificações no contexto
      setNotificationsEnabled(notifyNewNTs);
      setSoundEnabled(soundEnabled);
      
      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };
    return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300">
        <Topbar />
        <main className="flex-1 p-6 overflow-y-auto">
          <h1 className="text-3xl font-bold mb-6">Configurações</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Profile Settings */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Perfil
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      placeholder="seu.email@exemplo.com"
                      value={email}
                      disabled
                    />
                    <p className="text-xs text-gray-500">
                      Este é o seu e-mail de login e não pode ser alterado.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
              {/* Quick Actions */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => supabase.auth.refreshSession()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar Sessão
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      router.push('/login');
                    }}
                  >
                    Sair
                  </Button>
                </CardContent>
              </Card>
              
              {/* App Update Controls */}
              <AppUpdateCard />
            </div>
            
            {/* Notification Settings */}
            <div className="md:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    Notificações
                  </CardTitle>
                </CardHeader>                <CardContent>
                  <div className="space-y-4">                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Novas NTs</h3>
                        <p className="text-sm text-gray-500">Receba notificações quando novas NTs forem criadas</p>
                      </div>
                      <Switch 
                        checked={notifyNewNTs} 
                        onCheckedChange={(checked) => {
                          setNotifyNewNTs(checked);
                          setNotificationsEnabled(checked); // Atualiza contexto global imediatamente
                        }} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Pagamentos</h3>
                        <p className="text-sm text-gray-500">Receba notificações quando itens forem pagos</p>
                      </div>
                      <Switch checked={notifyPayments} onCheckedChange={setNotifyPayments} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Som das Notificações</h3>
                        <p className="text-sm text-gray-500">Tocar som quando uma nova NT for criada</p>
                      </div>
                      <Switch 
                        checked={soundEnabled} 
                        onCheckedChange={setSoundEnabled}
                        disabled={!notifyNewNTs}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Alertas de Robôs</h3>
                        <p className="text-sm text-gray-500">Receba notificações sobre alertas de robôs</p>
                      </div>
                      <Switch checked={notifyRobotAlerts} onCheckedChange={setNotifyRobotAlerts} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button disabled={saving} onClick={saveUserProfile}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
