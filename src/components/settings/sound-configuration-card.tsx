"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotifications } from '@/components/providers/notification-provider';
import { SoundType, SOUND_DESCRIPTIONS, NotificationEventType, DEFAULT_EVENT_SOUNDS } from '@/hooks/useAudioNotification';
import { Volume2, VolumeX, Play, Settings, Bell, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_ITEMS: { id: NotificationEventType; label: string; desc: string; icon: string }[] = [
  { id: 'nt_created', label: 'Nova NT Criada', desc: 'Arpejo ascendente e luminoso', icon: '📋' },
  { id: 'item_paid', label: 'Pagamento / Item Pago', desc: 'Chime metálico cristalino', icon: '💰' },
  { id: 'nt_updated', label: 'NT Atualizada / Editada', desc: 'Toque duplo ágil de status', icon: '🔄' },
  { id: 'production_updated', label: 'Quadro de Produção', desc: 'Pulso industrial operacional', icon: '⚙️' },
  { id: 'chat_message', label: 'Mensagens de Chat', desc: 'Pop orgânico de bolha ultra-suave', icon: '💬' },
  { id: 'chat_mention', label: 'Menções Diretas (@)', desc: 'Ping duplo de alta prioridade', icon: '🏷️' },
  { id: 'system_alert', label: 'Avisos e Alertas', desc: 'Tom duplo de atenção imediata', icon: '🚨' },
];

export const SoundConfigurationCard = () => {
  const { 
    audioConfig, 
    updateAudioConfig,
    testSound,
    playNotificationSound,
    notificationsEnabled 
  } = useNotifications();

  const [testingItem, setTestingItem] = useState<string | null>(null);

  const handleVolumeChange = (value: number[]) => {
    updateAudioConfig({ volume: value[0] });
  };

  const handleSoundTypeChange = (soundType: SoundType) => {
    updateAudioConfig({ soundType });
  };

  const handleEnabledChange = (enabled: boolean) => {
    updateAudioConfig({ enabled });
  };

  const handleTestEvent = (eventId: NotificationEventType, label: string) => {
    if (!audioConfig.enabled) {
      toast.error('Som das notificações está desabilitado');
      return;
    }
    setTestingItem(eventId);
    try {
      playNotificationSound(eventId);
      toast.success(`🎵 Som de "${label}" reproduzido!`, {
        icon: '🔊',
        duration: 3000
      });
    } catch (e) {
      toast.error('Erro ao reproduzir som');
    } finally {
      setTimeout(() => setTestingItem(null), 1200);
    }
  };

  const handleTestSound = (soundType?: SoundType) => {
    if (!audioConfig.enabled) {
      toast.error('Som das notificações está desabilitado');
      return;
    }

    const typeToTest = soundType || audioConfig.soundType;
    setTestingItem(typeToTest);
    try {
      testSound(typeToTest);
      toast.success(`🎵 Som reproduzido!`, {
        duration: 3000,
        icon: '🔊'
      });
    } catch (error) {
      toast.error('Erro ao reproduzir som de teste');
      console.error('Error testing sound:', error);
    } finally {
      setTimeout(() => setTestingItem(null), 1200);
    }
  };

  const volumePercentage = Math.round(audioConfig.volume * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="h-5 w-5 mr-2 text-[var(--accent)]" />
          Configurações de Áudio e Notificações Sonoras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Som Habilitado */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Som das Notificações</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Reproduzir assinaturas sonoras exclusivas para eventos do sistema e chat
            </p>
          </div>
          <Switch 
            checked={audioConfig.enabled} 
            onCheckedChange={handleEnabledChange}
            disabled={!notificationsEnabled}
          />
        </div>

        {audioConfig.enabled && (
          <>
            {/* Sons Dedicados por Tipo de Evento */}
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Sons Dedicados por Categoria de Evento
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Cada evento possui um som exclusivo sintetizado para fácil identificação auditiva
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {EVENT_ITEMS.map((item) => {
                  const isCurrentTesting = testingItem === item.id;
                  const soundMapped = audioConfig.eventSounds?.[item.id] || DEFAULT_EVENT_SOUNDS[item.id] || audioConfig.soundType;

                  return (
                    <div 
                      key={item.id}
                      className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between gap-3 transition-colors hover:border-[var(--accent)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{item.icon}</span>
                          <span className="font-semibold text-xs text-[var(--text)] truncate">{item.label}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {item.desc}
                        </p>
                        <span className="inline-block mt-1 font-mono text-[10px] text-[var(--accent)] bg-[var(--accent-weak)] px-1.5 py-0.5 rounded">
                          {soundMapped}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestEvent(item.id, item.label)}
                        disabled={isCurrentTesting || !audioConfig.enabled}
                        className="h-8 px-2.5 shrink-0 border-[var(--border-strong)] hover:border-[var(--accent)]"
                      >
                        <Play className={`h-3 w-3 mr-1 ${isCurrentTesting ? 'animate-pulse text-[var(--accent)]' : ''}`} />
                        {isCurrentTesting ? 'Tocando...' : 'Ouvir'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Som Padrão Fallback */}
            <div className="space-y-3 pt-3 border-t border-[var(--border)]">
              <Label className="text-sm font-medium">Som Padrão de Fallback</Label>
              <Select 
                value={audioConfig.soundType} 
                onValueChange={handleSoundTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de som padrão" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Object.entries(SOUND_DESCRIPTIONS).map(([type, description]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex flex-col py-1">
                        <span className="font-medium text-xs">
                          {type}
                        </span>
                        <span className="text-[11px] text-gray-500">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Volume */}
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Volume das Notificações</Label>
                <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
                  {volumePercentage}%
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <VolumeX className="h-4 w-4 text-gray-400" />
                <Slider
                  value={[audioConfig.volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  min={0}
                  step={0.05}
                  className="flex-1"
                />
                <Volume2 className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </>
        )}

        {/* Aviso quando notificações estão desabilitadas */}
        {!notificationsEnabled && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ As notificações gerais estão desabilitadas.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
