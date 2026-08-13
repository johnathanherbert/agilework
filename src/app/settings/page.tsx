"use client";

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AppUpdateCard } from '@/components/settings/app-update-card';
import { SoundConfigurationCard } from '@/components/settings/sound-configuration-card';
import { RoutesManagementCard } from '@/components/settings/routes-management-card';
import { Save, User, Bell, Shield, RefreshCw, LogOut, Sparkles, Mail, Volume2 } from 'lucide-react';
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

  const userInitial = (name || userData?.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

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
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="mb-5 rounded-2xl border border-border/80 bg-gradient-to-br from-[#003d6b] via-[#0b4f80] to-[#0e5f98] text-white shadow-lg p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-xl font-black">
                  {userInitial}
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/85 mb-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Painel Pessoal
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Configurações</h1>
                  <p className="text-sm text-white/85 mt-1">
                    Ajuste perfil, notificações e comportamento da plataforma.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="bg-white/15 border border-white/25 text-white hover:bg-white/25"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Tela
                </Button>
                <Button
                  variant="destructive"
                  className="bg-red-600/90 hover:bg-red-600 text-white"
                  onClick={async () => {
                    await signOut();
                    router.push('/login');
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
            <div className="xl:col-span-8 space-y-4 sm:space-y-6">
              {/* Gerenciamento de Ordens, Vias e Rotas (Visível apenas para Administradores) */}
              {(userData?.email === ADMIN_EMAIL || userData?.role === 'admin') && (
                <RoutesManagementCard />
              )}

              <Card className="border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" />
                    Perfil da Conta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs uppercase tracking-wide text-muted-foreground">Nome</Label>
                      <Input
                        id="name"
                        placeholder="Seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          placeholder="seu.email@exemplo.com"
                          value={email}
                          disabled
                          className="h-10 pl-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        E-mail de login bloqueado para edição.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="h-5 w-5 text-primary" />
                    Centro de Notificações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-border/70 p-3.5">
                    <div>
                      <h3 className="font-semibold">Novas NTs</h3>
                      <p className="text-sm text-muted-foreground">Alertar quando novas NTs forem criadas.</p>
                    </div>
                    <Switch
                      checked={notifyNewNTs}
                      onCheckedChange={(checked) => {
                        setNotifyNewNTs(checked);
                        setNotificationsEnabled(checked);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/70 p-3.5">
                    <div>
                      <h3 className="font-semibold">Pagamentos</h3>
                      <p className="text-sm text-muted-foreground">Alertar quando itens forem pagos.</p>
                    </div>
                    <Switch checked={notifyPayments} onCheckedChange={setNotifyPayments} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/70 p-3.5">
                    <div>
                      <h3 className="font-semibold">Alertas de Robôs</h3>
                      <p className="text-sm text-muted-foreground">Receber alertas operacionais dos robôs.</p>
                    </div>
                    <Switch checked={notifyRobotAlerts} onCheckedChange={setNotifyRobotAlerts} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-4 space-y-4 sm:space-y-6">
              <Card className="border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-primary" />
                    Acesso e Sessão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-xl border border-border/70 p-3.5 bg-muted/30">
                    <p className="font-semibold text-foreground">Estado da Conta</p>
                    <p className="text-muted-foreground mt-1">Sessão autenticada e sincronizada com perfil do Firestore.</p>
                  </div>
                  <Button variant="outline" className="w-full justify-start" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recarregar Componentes
                  </Button>
                </CardContent>
              </Card>

              <AppUpdateCard />

              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-900/20 p-4">
                <div className="flex items-start gap-2.5">
                  <Volume2 className="h-4 w-4 text-blue-700 dark:text-blue-300 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Som de Notificações</p>
                    <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1">
                      Configure perfis de áudio e volume conforme seu ambiente de trabalho.
                    </p>
                  </div>
                </div>
              </div>

              <SoundConfigurationCard />
            </div>
          </div>

          <div className="sticky bottom-3 mt-5 z-10">
            <div className="rounded-xl border border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 shadow-sm flex items-center justify-end">
              <Button size="lg" disabled={saving} onClick={saveUserProfile} className="min-w-[220px]">
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
          </div>
        </main>
      </div>
    </div>
  );
}
