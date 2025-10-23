"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotifications } from '@/components/providers/notification-provider';
import { SoundType, SOUND_DESCRIPTIONS } from '@/hooks/useAudioNotification';
import { Volume2, VolumeX, Play, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export const SoundConfigurationCard = () => {
  const { 
    audioConfig, 
    updateAudioConfig,
    testSound, 
    notificationsEnabled 
  } = useNotifications();

  const [isTestingSound, setIsTestingSound] = useState(false);

  const handleVolumeChange = (value: number[]) => {
    updateAudioConfig({ volume: value[0] });
  };

  const handleSoundTypeChange = (soundType: SoundType) => {
    updateAudioConfig({ soundType });
  };

  const handleEnabledChange = (enabled: boolean) => {
    updateAudioConfig({ enabled });
  };  const handleTestSound = async () => {
    if (!audioConfig.enabled) {
      toast.error('Som das notificações está desabilitado');
      return;
    }

    setIsTestingSound(true);
    try {
      testSound();
      const soundName = {
        notification: '🔔 Notificação Moderna',
        subtle: '🤫 Discreto',
        impact: '💥 Impacto Dramático',
        triumph: '🏆 Triunfo Épico',
        alert: '🚨 Alerta Urgente',
        fanfare: '🎺 Fanfarra Completa',
        power: '⚡ Poder Absoluto',
        classic: '👑 Clássico Refinado'
      }[audioConfig.soundType] || audioConfig.soundType;
      
      toast.success(`🎵 Som "${soundName}" reproduzido!`, {
        duration: 4000,
        icon: '🔊'
      });
    } catch (error) {
      toast.error('Erro ao reproduzir som de teste');
      console.error('Error testing sound:', error);
    } finally {
      setTimeout(() => setIsTestingSound(false), 1500); // Mais tempo para sons longos
    }
  };

  const volumePercentage = Math.round(audioConfig.volume * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Configurações de Som
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Som Habilitado */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Som das Notificações</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Reproduzir som quando uma nova NT for criada
            </p>
          </div>
          <Switch 
            checked={audioConfig.enabled} 
            onCheckedChange={handleEnabledChange}
            disabled={!notificationsEnabled}
          />
        </div>

        {/* Controles de Som */}
        {audioConfig.enabled && (
          <>            {/* Tipo de Som */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tipo de Som</Label>
              <Select 
                value={audioConfig.soundType} 
                onValueChange={handleSoundTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de som" />
                </SelectTrigger>                <SelectContent>
                  {Object.entries(SOUND_DESCRIPTIONS).map(([type, description]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex flex-col">                        <span className="font-medium capitalize">
                          {type === 'notification' ? '🔔 Notificação Moderna (PADRÃO)' :
                           type === 'subtle' ? '🤫 Discreto' :
                           type === 'impact' ? '💥 Impacto Dramático MÁXIMO' : 
                           type === 'triumph' ? '🏆 Triunfo Épico' :
                           type === 'alert' ? '🚨 Alerta Urgente' :
                           type === 'fanfare' ? '🎺 Fanfarra Completa' :
                           type === 'power' ? '⚡ Poder Absoluto' :
                           type === 'classic' ? '👑 Clássico Refinado' : type}
                        </span>
                        <span className="text-xs text-gray-500">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Preview do som atual */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="flex items-center justify-between">
                  <div>                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Som Selecionado: {
                        audioConfig.soundType === 'notification' ? '🔔 Notificação Moderna' :
                        audioConfig.soundType === 'subtle' ? '🤫 Discreto' :
                        audioConfig.soundType === 'impact' ? '💥 Impacto Dramático' : 
                        audioConfig.soundType === 'triumph' ? '🏆 Triunfo Épico' :
                        audioConfig.soundType === 'alert' ? '🚨 Alerta Urgente' :
                        audioConfig.soundType === 'fanfare' ? '🎺 Fanfarra Completa' :
                        audioConfig.soundType === 'power' ? '⚡ Poder Absoluto' :
                        audioConfig.soundType === 'classic' ? '👑 Clássico Refinado' : audioConfig.soundType
                      }
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      {SOUND_DESCRIPTIONS[audioConfig.soundType]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestSound}
                    disabled={isTestingSound || !audioConfig.enabled}
                    className="border-blue-300 dark:border-blue-700"
                  >
                    <Play className={`h-3 w-3 mr-1 ${isTestingSound ? 'animate-pulse' : ''}`} />
                    {isTestingSound ? 'Tocando...' : 'Ouvir'}                  </Button>
                </div>
                
                {/* Informações técnicas e intensidade */}
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <div className="text-xs text-blue-500 dark:text-blue-400 mb-2">
                    {audioConfig.soundType === 'notification' && '🔔 3 camadas harmônicas • Duração: 1.2s • Som moderno e agradável'}
                    {audioConfig.soundType === 'subtle' && '🤫 2 camadas suaves • Duração: 0.6s • Ultra discreto e leve'}
                    {audioConfig.soundType === 'impact' && '⚡ 3 camadas sonoras • Duração: 1.5s • Bass poderoso + harmônicos'}
                    {audioConfig.soundType === 'triumph' && '🎼 4 vozes harmônicas • Duração: 2.5s • Progressão épica crescente'}
                    {audioConfig.soundType === 'alert' && '🔥 2 frequências alternadas • Duração: 1.0s • Máxima urgência'}
                    {audioConfig.soundType === 'fanfare' && '🎺 5 instrumentos virtuais • Duração: 3.0s • Orquestração completa'}
                    {audioConfig.soundType === 'power' && '💪 Sub-bass dominante • Duração: 1.8s • Força e presença'}
                    {audioConfig.soundType === 'classic' && '✨ Harmonia refinada • Duração: 0.8s • Elegância sofisticada'}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Intensidade do Som:</span>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map((level) => {
                        const intensity = {
                          notification: 3,
                          subtle: 1,
                          impact: 4,
                          triumph: 5,
                          alert: 3,
                          fanfare: 5,
                          power: 5,
                          classic: 2
                        }[audioConfig.soundType] || 3;
                        
                        return (
                          <div
                            key={level}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              level <= intensity 
                                ? 'bg-blue-500 dark:bg-blue-400' 
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Volume */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Volume</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
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
                  step={0.1}
                  className="flex-1"
                />
                <Volume2 className="h-4 w-4 text-gray-400" />
              </div>
            </div>            {/* Teste de Som Principal */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Teste Completo</Label>
                <Button 
                  onClick={handleTestSound}
                  disabled={isTestingSound || !audioConfig.enabled}
                  variant="outline" 
                  className="w-full h-12"
                >
                  <Play className={`h-5 w-5 mr-2 ${isTestingSound ? 'animate-pulse' : ''}`} />
                  {isTestingSound ? 'Reproduzindo som de teste...' : 'Testar Notificação Completa'}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Simula o som que você ouvirá quando uma nova NT for criada
                </p>
              </div>
            </div>
          </>
        )}

        {/* Aviso quando notificações estão desabilitadas */}
        {!notificationsEnabled && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ As notificações estão desabilitadas. Ative as "Novas NTs" para usar o som.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
