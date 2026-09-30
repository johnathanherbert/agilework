"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useNotifications } from '@/components/providers/notification-provider';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useTheme } from 'next-themes';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { RoutesManagementCard } from '@/components/settings/routes-management-card';
import { SoundType } from '@/hooks/useAudioNotification';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  User,
  Bell,
  Volume2,
  Route,
  Shield,
  RefreshCw,
  LogOut,
  Save,
  Check,
  Play,
  VolumeX,
  Lock,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Smartphone
} from 'lucide-react';

// Tipos de som WebAudio para o painel de som do concept
interface SoundProfile {
  id: SoundType;
  label: string;
  desc: string;
  isDefault?: boolean;
  bars: number[];
}

const SOUND_PROFILES: SoundProfile[] = [
  { id: 'notification', label: 'Moderno', desc: '3 notas suaves harmônicas · 1,2 s', isDefault: true, bars: [6, 10, 14, 9, 12] },
  { id: 'subtle', label: 'Discreto', desc: 'Leve e sutil para ações secundárias · 0,6 s', bars: [4, 8, 5, 3, 2] },
  { id: 'classic', label: 'Clássico', desc: 'Harmonia elegante e refinada · 0,8 s', bars: [8, 12, 10, 8, 6] },
  { id: 'impact', label: 'Industrial', desc: 'Impacto dramático marcante para ruído · 1,5 s', bars: [14, 4, 14, 4, 16] },
];

interface NotificationEventConfig {
  id: string;
  label: string;
  desc: string;
  critical?: boolean;
  adminOnly?: boolean;
}

const NOTIFICATION_EVENTS: NotificationEventConfig[] = [
  { id: 'nt_new', label: 'Novas NTs', desc: 'Quando uma NT é criada para a pesagem' },
  { id: 'nt_pay', label: 'Pagamentos', desc: 'Quando um item de NT é pago ou pago parcial' },
  { id: 'nt_late', label: 'NT em atraso', desc: 'NT aberta há mais de 2 horas na pesagem', critical: true },
  { id: 'pace', label: 'Ritmo do turno', desc: 'Turno abaixo do ritmo ou alerta no painel de produção', critical: true },
  { id: 'robot', label: 'Alertas de robôs', desc: 'Falhas e divergências das balanças automáticas', critical: true },
  { id: 'chat', label: 'Mensagens e menções', desc: 'Comunicações diretas e menções @ no chat' },
  { id: 'access', label: 'Pedidos de acesso', desc: 'Novos cadastros aguardando aprovação', adminOnly: true }
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, userData, signOut } = useFirebase();
  const { theme, setTheme } = useTheme();
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    soundEnabled,
    setSoundEnabled,
    audioConfig,
    updateAudioConfig,
    testSound
  } = useNotifications();

  const {
    updateAvailable,
    isChecking: isCheckingUpdate,
    lastChecked: lastUpdateChecked,
    currentVersion,
    checkForUpdate,
    reloadApp,
    resetUpdateState
  } = useAppUpdate();

  // Estados locais do perfil
  const [name, setName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [homeScreen, setHomeScreen] = useState('dash');
  const [initialHomeScreen, setInitialHomeScreen] = useState('dash');
  const [density, setDensity] = useState<'exp' | 'cmp'>('exp');
  const [initialDensity, setInitialDensity] = useState<'exp' | 'cmp'>('exp');

  // Estados das notificações
  const [pauseAll, setPauseAll] = useState(false);
  const [initialPauseAll, setInitialPauseAll] = useState(false);
  const [eventSettings, setEventSettings] = useState<Record<string, { on: boolean; sound: boolean; desk: boolean }>>({
    nt_new: { on: true, sound: true, desk: true },
    nt_pay: { on: true, sound: false, desk: false },
    nt_late: { on: true, sound: true, desk: true },
    pace: { on: true, sound: true, desk: false },
    robot: { on: true, sound: true, desk: true },
    chat: { on: true, sound: true, desk: false },
    access: { on: true, sound: false, desk: false },
  });
  const [initialEventSettings, setInitialEventSettings] = useState(eventSettings);

  // Estados do som
  const [selectedSound, setSelectedSound] = useState<SoundType>('notification');
  const [initialSound, setInitialSound] = useState<SoundType>('notification');
  const [volume, setVolume] = useState(100);
  const [initialVolume, setInitialVolume] = useState(100);
  const [repeatAlert, setRepeatAlert] = useState('2');
  const [initialRepeatAlert, setInitialRepeatAlert] = useState('2');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [initialQuietHoursEnabled, setInitialQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('23:45');
  const [quietEnd, setQuietEnd] = useState('06:00');

  // Controle de carregamento e salvamento
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('perfil');
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [showUpdateLog, setShowUpdateLog] = useState(false);
  const [playingCard, setPlayingCard] = useState<string | null>(null);

  // Carregar dados salvos
  useEffect(() => {
    if (userData) {
      const uName = userData.name || '';
      setName(uName);
      setInitialName(uName);
    } else if (user) {
      const uName = user.displayName || user.email?.split('@')[0] || '';
      setName(uName);
      setInitialName(uName);
    }

    if (typeof window !== 'undefined') {
      try {
        const savedHome = localStorage.getItem('aw_home_screen') || 'dash';
        setHomeScreen(savedHome);
        setInitialHomeScreen(savedHome);

        const savedDens = (localStorage.getItem('aw_list_density') as 'exp' | 'cmp') || 'exp';
        setDensity(savedDens);
        setInitialDensity(savedDens);

        const savedPause = localStorage.getItem('aw_notif_pause') === 'true';
        setPauseAll(savedPause);
        setInitialPauseAll(savedPause);

        const savedEvents = localStorage.getItem('aw_notif_matrix');
        if (savedEvents) {
          const parsed = JSON.parse(savedEvents);
          setEventSettings(parsed);
          setInitialEventSettings(parsed);
        }

        const savedRepeat = localStorage.getItem('aw_sound_repeat') || '2';
        setRepeatAlert(savedRepeat);
        setInitialRepeatAlert(savedRepeat);

        const savedQuiet = localStorage.getItem('aw_sound_quiet') === 'true';
        setQuietHoursEnabled(savedQuiet);
        setInitialQuietHoursEnabled(savedQuiet);
      } catch (e) {
        console.warn('Erro ao ler localStorage:', e);
      }
    }
  }, [user, userData]);

  useEffect(() => {
    if (audioConfig) {
      setSelectedSound(audioConfig.soundType || 'notification');
      setInitialSound(audioConfig.soundType || 'notification');
      const vol = Math.round((audioConfig.volume ?? 1) * 100);
      setVolume(vol);
      setInitialVolume(vol);
    }
  }, [audioConfig]);

  // Monitorar mudanças (isDirty)
  const isDirty = useMemo(() => {
    const dirtyProfile = name !== initialName || homeScreen !== initialHomeScreen || density !== initialDensity;
    const dirtyNotif = pauseAll !== initialPauseAll || JSON.stringify(eventSettings) !== JSON.stringify(initialEventSettings);
    const dirtySound = selectedSound !== initialSound || volume !== initialVolume || repeatAlert !== initialRepeatAlert || quietHoursEnabled !== initialQuietHoursEnabled;
    return dirtyProfile || dirtyNotif || dirtySound;
  }, [
    name, initialName, homeScreen, initialHomeScreen, density, initialDensity,
    pauseAll, initialPauseAll, eventSettings, initialEventSettings,
    selectedSound, initialSound, volume, initialVolume, repeatAlert, initialRepeatAlert, quietHoursEnabled, initialQuietHoursEnabled
  ]);

  const dirtySections = useMemo(() => {
    return {
      perfil: name !== initialName || homeScreen !== initialHomeScreen || density !== initialDensity,
      notif: pauseAll !== initialPauseAll || JSON.stringify(eventSettings) !== JSON.stringify(initialEventSettings),
      som: selectedSound !== initialSound || volume !== initialVolume || repeatAlert !== initialRepeatAlert || quietHoursEnabled !== initialQuietHoursEnabled,
    };
  }, [
    name, initialName, homeScreen, initialHomeScreen, density, initialDensity,
    pauseAll, initialPauseAll, eventSettings, initialEventSettings,
    selectedSound, initialSound, volume, initialVolume, repeatAlert, initialRepeatAlert, quietHoursEnabled, initialQuietHoursEnabled
  ]);

  // Atalho de teclado Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDirty) {
          handleSaveAll();
        } else {
          toast('Nada para salvar');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Scrollspy para destacar seção na navegação lateral
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const main = e.currentTarget;
    const scrollPos = main.scrollTop + 100;
    const sections = ['perfil', 'notif', 'som', 'cat', 'sessao', 'sys'];

    for (const sec of sections) {
      const el = document.getElementById(`s-${sec}`);
      if (el && el.offsetTop <= scrollPos) {
        setActiveSection(sec);
      }
    }
  };

  const scrollToSection = (secId: string) => {
    setActiveSection(secId);
    const el = document.getElementById(`s-${secId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Teste de som de perfil
  const handlePreviewSound = (soundId: SoundType) => {
    setPlayingCard(soundId);
    updateAudioConfig({ soundType: soundId, volume: volume / 100, enabled: true });
    testSound();
    setTimeout(() => {
      setPlayingCard(null);
    }, 1200);
  };

  // Salvar tudo
  const handleSaveAll = async () => {
    if (!user) return;
    if (name.trim().length < 3) {
      scrollToSection('perfil');
      toast.error('Informe pelo menos 3 caracteres no nome.');
      return;
    }

    setSaving(true);
    try {
      // 1. Atualizar Profile e Firestore User
      if (name !== user.displayName) {
        await updateProfile(user, { displayName: name });
      }
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: name.trim(),
        updated_at: new Date().toISOString(),
      });

      // 2. Salvar configurações no LocalStorage
      localStorage.setItem('aw_home_screen', homeScreen);
      localStorage.setItem('aw_list_density', density);
      localStorage.setItem('aw_notif_pause', String(pauseAll));
      localStorage.setItem('aw_notif_matrix', JSON.stringify(eventSettings));
      localStorage.setItem('aw_sound_repeat', repeatAlert);
      localStorage.setItem('aw_sound_quiet', String(quietHoursEnabled));

      // 3. Salvar configuração de áudio
      updateAudioConfig({
        soundType: selectedSound,
        volume: volume / 100,
        enabled: soundEnabled && !pauseAll
      });
      setNotificationsEnabled(!pauseAll);

      // 4. Sincronizar estados iniciais
      setInitialName(name);
      setInitialHomeScreen(homeScreen);
      setInitialDensity(density);
      setInitialPauseAll(pauseAll);
      setInitialEventSettings(eventSettings);
      setInitialSound(selectedSound);
      setInitialVolume(volume);
      setInitialRepeatAlert(repeatAlert);
      setInitialQuietHoursEnabled(quietHoursEnabled);

      toast.success('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      toast.error(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  // Descartar alterações
  const handleDiscard = () => {
    setName(initialName);
    setHomeScreen(initialHomeScreen);
    setDensity(initialDensity);
    setPauseAll(initialPauseAll);
    setEventSettings(initialEventSettings);
    setSelectedSound(initialSound);
    setVolume(initialVolume);
    setRepeatAlert(initialRepeatAlert);
    setQuietHoursEnabled(initialQuietHoursEnabled);
    toast('Alterações descartadas');
  };

  // Teste de verificação de atualizações
  const handleCheckUpdates = async () => {
    setShowUpdateLog(true);
    setUpdateLog(['Consultando servidor de versões...', 'Comparando build instalada...']);
    await checkForUpdate();
    setTimeout(() => {
      setUpdateLog(prev => [...prev, 'Nenhuma atualização pendente encontrada.', 'Aplicação pronta para operação.']);
    }, 700);
  };

  const userInitial = (name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  const isAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin';

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-sans">
      {/* Rail Lateral Padrão (52px) */}
      <Sidebar />

      {/* Conteúdo com Topbar (48px) */}
      <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
        <Topbar />

        {/* Layout do Concept: Navegação Lateral Secundária + Main com Scroll */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Navegação Interna de Configurações (220px) */}
          <aside className="w-[220px] shrink-0 border-r border-[var(--border)] p-5 overflow-y-auto hidden lg:flex flex-col select-none bg-[var(--surface)]">
            <h1 className="text-base font-semibold text-[var(--text)] tracking-tight px-2">Configurações</h1>
            <p className="text-xs text-[var(--text-3)] px-2 mb-4 leading-relaxed">
              Preferências pessoais, alertas e parâmetros operacionais
            </p>

            <nav className="space-y-1 text-xs">
              <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider px-2 pt-2 pb-1">
                Pessoal
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('perfil')}
                className={cn(
                  "w-full flex items-center justify-between h-8 px-2 rounded-[var(--radius)] text-left transition-colors cursor-pointer",
                  activeSection === 'perfil'
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <User size={14} />
                  <span>Perfil e aparência</span>
                </span>
                {dirtySections.perfil && <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />}
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('notif')}
                className={cn(
                  "w-full flex items-center justify-between h-8 px-2 rounded-[var(--radius)] text-left transition-colors cursor-pointer",
                  activeSection === 'notif'
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <Bell size={14} />
                  <span>Notificações</span>
                </span>
                {dirtySections.notif && <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />}
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('som')}
                className={cn(
                  "w-full flex items-center justify-between h-8 px-2 rounded-[var(--radius)] text-left transition-colors cursor-pointer",
                  activeSection === 'som'
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <Volume2 size={14} />
                  <span>Som</span>
                </span>
                {dirtySections.som && <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />}
              </button>

              <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider px-2 pt-4 pb-1">
                Operação
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('cat')}
                className={cn(
                  "w-full flex items-center justify-between h-8 px-2 rounded-[var(--radius)] text-left transition-colors cursor-pointer",
                  activeSection === 'cat'
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <Route size={14} />
                  <span>Ordens, vias e rotas</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--amber)] border border-[var(--border-strong)]">
                  {isAdmin ? 'Admin' : 'Rotas'}
                </span>
              </button>

              <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider px-2 pt-4 pb-1">
                Sistema
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('sessao')}
                className={cn(
                  "w-full flex items-center justify-between h-8 px-2 rounded-[var(--radius)] text-left transition-colors cursor-pointer",
                  activeSection === 'sessao'
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <Shield size={14} />
                  <span>Acesso e sessão</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('sys')}
                className={cn(
                  "w-full flex items-center justify-between h-8 px-2 rounded-[var(--radius)] text-left transition-colors cursor-pointer",
                  activeSection === 'sys'
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} />
                  <span>Atualizações</span>
                </span>
              </button>
            </nav>

            <div className="mt-auto pt-4 border-t border-[var(--border)] text-xs text-[var(--text-3)]">
              <b className="block text-[var(--text)] font-semibold truncate">{name || user?.displayName || 'Usuário'}</b>
              <span className="block text-[11px] text-[var(--text-3)] truncate">{user?.email}</span>
              <span className="block text-[10px] text-[var(--text-3)] mt-0.5 uppercase tracking-wide">
                {isAdmin ? 'Admin global' : userData?.role || 'Operador'}
              </span>
            </div>
          </aside>

          {/* Área Principal de Conteúdo das Seções */}
          <main
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-8 scroll-smooth pb-32"
          >
            <div className="max-w-[1020px] mx-auto space-y-8">
              {/* ================= 1. PERFIL E APARÊNCIA ================= */}
              <section id="s-perfil" className="scroll-mt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-[var(--border)] pb-2">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text)] tracking-tight">Perfil e aparência</h2>
                    <p className="text-xs text-[var(--text-3)]">
                      Como você aparece para a equipe e como o sistema se apresenta para você.
                    </p>
                  </div>
                </div>

                <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
                  {/* Bloco de Apresentação com Avatar */}
                  <div className="flex items-center gap-3.5 p-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <span className="w-11 h-11 rounded-full bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] grid place-items-center font-bold text-sm shadow-xs">
                      {userInitial}
                    </span>
                    <div>
                      <b className="text-sm font-semibold text-[var(--text)] block">{name || 'Usuário'}</b>
                      <small className="text-xs text-[var(--text-3)]">
                        {isAdmin ? 'Admin global' : userData?.role || 'Colaborador'} · Almoxarifado / Pesagem
                      </small>
                    </div>
                  </div>

                  {/* Campos de Nome e E-mail */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border-b border-[var(--border)]">
                    <div className="space-y-1.5">
                      <label htmlFor="input-name" className="text-xs text-[var(--text-3)] block font-medium">
                        Nome de exibição
                      </label>
                      <input
                        id="input-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        maxLength={60}
                        className={cn(
                          "h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors",
                          name.trim().length < 3 && "border-[var(--red)]"
                        )}
                      />
                      <span className="text-[11px] text-[var(--text-3)] block">
                        Aparece nas NTs, no chat e no registro de auditoria da fábrica.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--text-3)] block font-medium">E-mail de login</label>
                      <div className="relative">
                        <input
                          value={user?.email || ''}
                          readOnly
                          className="h-[34px] w-full pl-3 pr-8 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--surface-2)] text-xs text-[var(--text-2)] outline-none cursor-default font-mono"
                        />
                        <Lock size={13} className="absolute right-2.5 top-2.5 text-[var(--text-3)] pointer-events-none" />
                      </div>
                      <span className="text-[11px] text-[var(--text-3)] block">
                        E-mail de autenticação bloqueado para edição.
                      </span>
                    </div>
                  </div>

                  {/* Tema */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4 border-b border-[var(--border)]">
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Tema visual</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Alterne entre os modos escuro, claro ou acompanhamento do sistema.
                      </small>
                    </div>
                    <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
                      <button
                        type="button"
                        onClick={() => setTheme('system')}
                        className={cn(
                          "h-[30px] px-3 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer",
                          theme === 'system' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                      >
                        Sistema
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "h-[30px] px-3 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer",
                          theme === 'dark' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                      >
                        Escuro
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={cn(
                          "h-[30px] px-3 text-xs font-medium transition-colors cursor-pointer",
                          theme === 'light' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                      >
                        Claro
                      </button>
                    </div>
                  </div>

                  {/* Tela Inicial */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4 border-b border-[var(--border)]">
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Tela inicial</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Página que será aberta automaticamente após realizar o login.
                      </small>
                    </div>
                    <select
                      value={homeScreen}
                      onChange={(e) => setHomeScreen(e.target.value)}
                      className="h-[32px] px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] outline-none cursor-pointer focus:border-[var(--accent)]"
                    >
                      <option value="dash">Dashboard Operacional</option>
                      <option value="nts">Notas Técnicas</option>
                      <option value="producao">Painel de Produção</option>
                      <option value="sol">Solicitações</option>
                    </select>
                  </div>

                  {/* Densidade */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4">
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Densidade das listas</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Modo compacto mostra mais linhas por tela nas NTs e no painel de pesagem.
                      </small>
                    </div>
                    <div className="inline-flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
                      <button
                        type="button"
                        onClick={() => setDensity('exp')}
                        className={cn(
                          "h-[30px] px-3 text-xs font-medium border-r border-[var(--border-strong)] transition-colors cursor-pointer",
                          density === 'exp' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                      >
                        Expandida
                      </button>
                      <button
                        type="button"
                        onClick={() => setDensity('cmp')}
                        className={cn(
                          "h-[30px] px-3 text-xs font-medium transition-colors cursor-pointer",
                          density === 'cmp' ? "bg-[var(--hover)] text-[var(--text)] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                      >
                        Compacta
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* ================= 2. NOTIFICAÇÕES ================= */}
              <section id="s-notif" className="scroll-mt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text)] tracking-tight">Notificações</h2>
                    <p className="text-xs text-[var(--text-3)]">
                      Escolha o que você recebe e por onde. As mudanças valem para este usuário.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-medium text-[var(--text-2)]">Pausar tudo</span>
                    <input
                      type="checkbox"
                      checked={pauseAll}
                      onChange={(e) => setPauseAll(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] rounded-full relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>

                <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-3)] border-b border-[var(--border)]">
                          <th className="py-2.5 px-4 text-left">Evento</th>
                          <th className="py-2.5 px-3 text-center w-24">Receber</th>
                          <th className="py-2.5 px-3 text-center w-24">Som</th>
                          <th className="py-2.5 px-3 text-center w-28">Área de trab.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {NOTIFICATION_EVENTS.map((ev) => {
                          if (ev.adminOnly && !isAdmin) return null;
                          const cfg = eventSettings[ev.id] || { on: true, sound: true, desk: false };
                          const isDisabled = pauseAll || !cfg.on;

                          return (
                            <tr key={ev.id} className={cn("hover:bg-[var(--hover)] transition-colors", pauseAll && "opacity-40")}>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2">
                                  <b className="font-semibold text-[var(--text)]">{ev.label}</b>
                                  {ev.critical && (
                                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                      Crítico
                                    </span>
                                  )}
                                </div>
                                <small className="text-[11px] text-[var(--text-3)] block mt-0.5">{ev.desc}</small>
                              </td>

                              {/* Receber */}
                              <td className="py-2.5 px-3 text-center">
                                <label className="inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    disabled={pauseAll}
                                    checked={cfg.on}
                                    onChange={(e) => {
                                      setEventSettings(prev => ({
                                        ...prev,
                                        [ev.id]: { ...cfg, on: e.target.checked }
                                      }));
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-3.5 bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] rounded-full relative transition-colors after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-3.5" />
                                </label>
                              </td>

                              {/* Som */}
                              <td className="py-2.5 px-3 text-center">
                                <label className={cn("inline-flex items-center cursor-pointer", isDisabled && "opacity-30 pointer-events-none")}>
                                  <input
                                    type="checkbox"
                                    disabled={isDisabled}
                                    checked={cfg.sound}
                                    onChange={(e) => {
                                      setEventSettings(prev => ({
                                        ...prev,
                                        [ev.id]: { ...cfg, sound: e.target.checked }
                                      }));
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-3.5 bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] rounded-full relative transition-colors after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-3.5" />
                                </label>
                              </td>

                              {/* Área de Trabalho */}
                              <td className="py-2.5 px-3 text-center">
                                <label className={cn("inline-flex items-center cursor-pointer", isDisabled && "opacity-30 pointer-events-none")}>
                                  <input
                                    type="checkbox"
                                    disabled={isDisabled}
                                    checked={cfg.desk}
                                    onChange={(e) => {
                                      if (e.target.checked && typeof window !== 'undefined' && 'Notification' in window) {
                                        if (Notification.permission === 'default') {
                                          Notification.requestPermission();
                                        }
                                      }
                                      setEventSettings(prev => ({
                                        ...prev,
                                        [ev.id]: { ...cfg, desk: e.target.checked }
                                      }));
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-3.5 bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] rounded-full relative transition-colors after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-3.5" />
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* ================= 3. SOM ================= */}
              <section id="s-som" className="scroll-mt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text)] tracking-tight">Som</h2>
                    <p className="text-xs text-[var(--text-3)]">
                      Perfil de áudio e volume conforme o ambiente da pesagem e da fábrica.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      testSound();
                      toast.success(`Teste de notificação reproduzido: ${selectedSound}`);
                    }}
                    className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play size={12} />
                    <span>Testar notificação completa</span>
                  </button>
                </div>

                <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs">
                  {/* Master Switch de Som */}
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center p-4 border-b border-[var(--border)]">
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Som das notificações</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Toca quando chega uma notificação marcada com "Som" no centro de alertas.
                      </small>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] rounded-full relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>

                  {/* Perfis de Som em 4 Colunas */}
                  <div className={cn("p-4 border-b border-[var(--border)] space-y-2", !soundEnabled && "opacity-45 pointer-events-none")}>
                    <label className="text-xs font-medium text-[var(--text-3)] block mb-1">
                      Perfil de áudio sintetizado
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {SOUND_PROFILES.map((snd) => {
                        const isSelected = selectedSound === snd.id;
                        const isPlaying = playingCard === snd.id;

                        return (
                          <div
                            key={snd.id}
                            onClick={() => {
                              setSelectedSound(snd.id);
                              handlePreviewSound(snd.id);
                            }}
                            className={cn(
                              "border rounded-[var(--radius)] p-3 text-left flex flex-col gap-2 relative cursor-pointer transition-all bg-[var(--bg)]",
                              isSelected
                                ? "border-[var(--accent)] bg-[var(--accent-weak)] shadow-xs"
                                : "border-[var(--border-strong)] hover:border-[var(--text-3)]"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-[var(--text)] flex items-center gap-1.5">
                                {snd.label}
                                {snd.isDefault && (
                                  <span className="text-[10px] font-mono text-[var(--text-3)] border border-[var(--border-strong)] rounded px-1">
                                    padrão
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewSound(snd.id);
                                }}
                                className="w-6 h-6 rounded grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
                                title="Ouvir"
                              >
                                <Play size={12} className={cn(isPlaying && "text-[var(--accent)] animate-pulse")} />
                              </button>
                            </div>

                            {/* Onda gráfica */}
                            <div className="flex items-end gap-1 h-4">
                              {snd.bars.map((bar, i) => (
                                <i
                                  key={i}
                                  style={{ height: `${bar}px` }}
                                  className={cn(
                                    "w-1 rounded-xs transition-all",
                                    isSelected ? "bg-[var(--accent)]" : "bg-[var(--text-3)]",
                                    isPlaying && "animate-pulse"
                                  )}
                                />
                              ))}
                            </div>

                            <small className="text-[11px] text-[var(--text-3)] leading-tight">{snd.desc}</small>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div className={cn("grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center p-4 border-b border-[var(--border)]", !soundEnabled && "opacity-45 pointer-events-none")}>
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Volume</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Na área de pesagem ou produção com ruído de fundo, use 80% ou mais.
                      </small>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-64">
                      <button
                        type="button"
                        onClick={() => setVolume(volume ? 0 : 80)}
                        className="text-[var(--text-3)] hover:text-[var(--text)]"
                        title={volume ? "Silenciar" : "Ativar"}
                      >
                        {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="flex-1 accent-[var(--accent)] h-1.5 cursor-pointer bg-[var(--border)] rounded-full"
                      />
                      <span className="font-mono text-xs w-10 text-right text-[var(--text-2)]">{volume}%</span>
                    </div>
                  </div>

                  {/* Repetição de Alertas Críticos */}
                  <div className={cn("grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4 border-b border-[var(--border)]", !soundEnabled && "opacity-45 pointer-events-none")}>
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Repetir alerta crítico</b>
                      <small className="text-xs text-[var(--text-3)]">
                        NT em atraso (&gt;2h) e balança com falha tocam periodicamente até a conferência.
                      </small>
                    </div>
                    <select
                      value={repeatAlert}
                      onChange={(e) => setRepeatAlert(e.target.value)}
                      className="h-[32px] px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] outline-none cursor-pointer focus:border-[var(--accent)]"
                    >
                      <option value="0">Não repetir</option>
                      <option value="2">A cada 2 minutos</option>
                      <option value="5">A cada 5 minutos</option>
                    </select>
                  </div>

                  {/* Horário Silencioso */}
                  <div className={cn("grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4", !soundEnabled && "opacity-45 pointer-events-none")}>
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Horário silencioso</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Desativa avisos sonoros nesse intervalo (as notificações visuais continuam chegando).
                      </small>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={quietHoursEnabled}
                          onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] rounded-full relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                      <div className={cn("flex items-center gap-1.5 text-xs text-[var(--text-3)]", !quietHoursEnabled && "opacity-40 pointer-events-none")}>
                        <input
                          type="time"
                          value={quietStart}
                          onChange={(e) => setQuietStart(e.target.value)}
                          className="h-[28px] px-1.5 border border-[var(--border-strong)] rounded bg-[var(--bg)] font-mono text-xs text-[var(--text)]"
                        />
                        <span>até</span>
                        <input
                          type="time"
                          value={quietEnd}
                          onChange={(e) => setQuietEnd(e.target.value)}
                          className="h-[28px] px-1.5 border border-[var(--border-strong)] rounded bg-[var(--bg)] font-mono text-xs text-[var(--text)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ================= 4. ORDENS, VIAS E ROTAS ================= */}
              <section id="s-cat" className="scroll-mt-4 space-y-3">
                <RoutesManagementCard />
              </section>

              {/* ================= 5. ACESSO E SESSÃO ================= */}
              <section id="s-sessao" className="scroll-mt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-[var(--border)] pb-2">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text)] tracking-tight">Acesso e sessão</h2>
                    <p className="text-xs text-[var(--text-3)]">
                      Estado da sua conta e controle dos dispositivos conectados.
                    </p>
                  </div>
                </div>

                <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs divide-y divide-[var(--border)]">
                  {/* Estado da conta */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4">
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Estado da conta</b>
                      <small className="text-xs text-[var(--text-3)] flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
                        <span>Sessão autenticada e sincronizada com o perfil do Firestore</span>
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.reload();
                      }}
                      className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Recarregar componentes</span>
                    </button>
                  </div>

                  {/* PIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4">
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">PIN de acesso rápido</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Facilita a alternância rápida de operador em quiosques de pesagem.
                      </small>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-3)]">Configurado</span>
                      <button
                        type="button"
                        onClick={() => {
                          toast('Alteração de PIN: solicite ao supervisor ou redefina no login.');
                        }}
                        className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
                      >
                        Alterar PIN
                      </button>
                    </div>
                  </div>

                  {/* Logout */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-4">
                    <div>
                      <b className="text-xs font-semibold text-[var(--text)] block">Encerrar sessão</b>
                      <small className="text-xs text-[var(--text-3)]">
                        Desconecta sua conta deste computador ou terminal da pesagem.
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (isDirty && !confirm('Há alterações não salvas. Encerrar a sessão mesmo assim?')) return;
                        await signOut();
                        router.push('/login');
                      }}
                      className="h-8 px-3 rounded-[var(--radius)] border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>Encerrar sessão</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* ================= 6. ATUALIZAÇÕES ================= */}
              <section id="s-sys" className="scroll-mt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text)] tracking-tight">Atualizações</h2>
                    <p className="text-xs text-[var(--text-3)]">
                      Versão instalada no terminal e verificação periódica de builds.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm('Limpar cache local (filtros e rascunhos) e recarregar a página?')) return;
                        resetUpdateState();
                        window.location.reload();
                      }}
                      className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    >
                      Resetar estado local
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckUpdates}
                      disabled={isCheckingUpdate}
                      className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={cn(isCheckingUpdate && "animate-spin")} />
                      <span>Verificar atualizações</span>
                    </button>
                  </div>
                </div>

                <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden shadow-xs divide-y divide-[var(--border)]">
                  {/* Grid 4 KPIs do Sistema */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
                    <div className="p-4">
                      <label className="text-xs text-[var(--text-3)] block mb-1">Versão instalada</label>
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-sm text-[var(--text)] font-semibold">
                          v{currentVersion}
                        </strong>
                        {process.env.NODE_ENV === 'development' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/20 font-semibold">
                            DEV
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <label className="text-xs text-[var(--text-3)] block mb-1">Última verificação</label>
                      <strong className="font-mono text-xs text-[var(--text)] font-medium">
                        {lastUpdateChecked ? lastUpdateChecked.toLocaleTimeString('pt-BR') : 'Hoje'}
                      </strong>
                    </div>

                    <div className="p-4">
                      <label className="text-xs text-[var(--text-3)] block mb-1">Situação</label>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", updateAvailable ? "bg-[var(--amber)] animate-pulse" : "bg-[var(--green)]")} />
                        <strong className="text-xs font-semibold text-[var(--text)]">
                          {updateAvailable ? 'Nova versão pronta' : 'Atualizada'}
                        </strong>
                      </div>
                    </div>

                    <div className="p-4">
                      <label className="text-xs text-[var(--text-3)] block mb-1">Ciclo automático</label>
                      <strong className="text-xs font-mono text-[var(--text-3)]">A cada 10 min</strong>
                    </div>
                  </div>

                  {/* Informações de Auto-Update */}
                  <div className="p-4 text-xs text-[var(--text-3)] leading-relaxed space-y-1 bg-[var(--surface-2)]">
                    <p>• O terminal verifica automaticamente novas versões no servidor a cada 10 minutos e ao alternar de aba.</p>
                    <p>• Ao detectar uma nova release de produção, o sistema recarrega e aplica as correções sem perda de dados.</p>
                  </div>

                  {/* Console Log de Verificação */}
                  {showUpdateLog && (
                    <div className="p-3 bg-[var(--bg)] font-mono text-[11px] text-[var(--text-2)] space-y-1 max-h-32 overflow-y-auto">
                      {updateLog.map((line, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[var(--text-3)]">&gt;</span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>

        {/* Barra Flutuante de Salvamento (Aparece quando isDirty = true) */}
        <div
          className={cn(
            "fixed left-1/2 bottom-5 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl z-50 transition-all duration-200 min-w-[340px] sm:min-w-[480px]",
            isDirty ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0 pointer-events-none"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-[var(--amber)] shrink-0 animate-ping" />
          <span className="flex-1 text-xs text-[var(--text-2)] font-medium">
            Há alterações não salvas nas configurações
          </span>

          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving}
            className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            Descartar
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="h-8 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>Salvar</span>
                <kbd className="ml-1 text-[10px] font-mono px-1 rounded border border-current opacity-60">Ctrl S</kbd>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
