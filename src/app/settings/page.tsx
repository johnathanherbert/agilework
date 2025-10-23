"use client";

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AppUpdateCard } from '@/components/settings/app-update-card';
import { SoundConfigurationCard } from '@/components/settings/sound-configuration-card';
import { Save, User, Bell, Shield, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotifications } from '@/components/providers/notification-provider';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '@/lib/firebase';

export default function SettingsPage() {
  const { user, userData, signOut } = useFirebase();
  const router = useRouter();
  const { notificationsEnabled, setNotificationsEnabled, soundEnabled, setSoundEnabled } = useNotifications();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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

  // Carrega dados do usuário do Firebase
  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setEmail(userData.email || '');
      console.log('📝 Configurações carregadas:', userData);
    } else if (user) {
      // Fallback para dados do Auth se userData ainda não carregou
      setName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [user, userData]);
  
  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Carregando...</h2>
        <p className="text-gray-500 mt-2">Aguarde um momento</p>
      </div>
    </div>;
  }
  const saveUserProfile = async () => {
    if (!user || !userData) {
      toast.error('Usuário não autenticado');
      return;
    }

    setSaving(true);
    
    try {
      console.log('💾 Salvando configurações do usuário...');

      // 1. Atualizar displayName no Firebase Auth
      if (name !== user.displayName) {
        await updateProfile(user, {
          displayName: name
        });
        console.log('✅ DisplayName atualizado no Auth');
      }

      // 2. Atualizar documento do usuário no Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: name,
        updated_at: new Date().toISOString(),
      });
      console.log('✅ Documento do usuário atualizado no Firestore');
      
      // 3. Atualizar configuração de notificações no contexto
      setNotificationsEnabled(notifyNewNTs);
      setSoundEnabled(soundEnabled);
      
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao salvar configurações:', error);
      toast.error(error.message || 'Erro ao salvar configurações');
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
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recarregar Página
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={async () => {
                      await signOut();
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
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    Notificações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
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
                        <h3 className="font-medium">Alertas de Robôs</h3>
                        <p className="text-sm text-gray-500">Receba notificações sobre alertas de robôs</p>
                      </div>
                      <Switch checked={notifyRobotAlerts} onCheckedChange={setNotifyRobotAlerts} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sound Configuration */}
            <div>
              <SoundConfigurationCard />
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
