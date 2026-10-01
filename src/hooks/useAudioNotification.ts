"use client";

import { useCallback, useRef } from 'react';

export type SoundType = 
  | 'notification' 
  | 'subtle' 
  | 'impact' 
  | 'triumph' 
  | 'alert' 
  | 'fanfare' 
  | 'power' 
  | 'classic'
  | 'chime_rise'
  | 'coin_crystal'
  | 'sync_blip'
  | 'tech_pulse'
  | 'bubble_pop'
  | 'ping_alert';

export type NotificationEventType = 
  | 'nt_created' 
  | 'nt_updated' 
  | 'item_paid' 
  | 'production_updated' 
  | 'chat_message' 
  | 'chat_mention' 
  | 'system_alert';

export const DEFAULT_EVENT_SOUNDS: Record<NotificationEventType, SoundType> = {
  nt_created: 'chime_rise',
  nt_updated: 'sync_blip',
  item_paid: 'coin_crystal',
  production_updated: 'tech_pulse',
  chat_message: 'bubble_pop',
  chat_mention: 'ping_alert',
  system_alert: 'alert',
};

export interface AudioConfig {
  enabled: boolean;
  volume: number; // 0 to 1
  soundType: SoundType;
  eventSounds?: Partial<Record<NotificationEventType, SoundType>>;
}

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  enabled: true,
  volume: 1.0, // Volume máximo para clareza
  soundType: 'chime_rise', // Novo som moderno padrão
  eventSounds: DEFAULT_EVENT_SOUNDS,
};

export const useAudioNotification = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Load audio config from localStorage
  const loadAudioConfig = useCallback((userId?: string): AudioConfig => {
    if (!userId || typeof window === 'undefined') return DEFAULT_AUDIO_CONFIG;
    
    try {
      const saved = localStorage.getItem(`audio_config_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_AUDIO_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load audio config:', error);
    }
    
    return DEFAULT_AUDIO_CONFIG;
  }, []);

  // Save audio config to localStorage
  const saveAudioConfig = useCallback((config: AudioConfig, userId?: string) => {
    if (!userId || typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(`audio_config_${userId}`, JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save audio config:', error);
    }
  }, []);

  // Initialize AudioContext if needed
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('AudioContext not supported:', error);
        return null;
      }
    }
    return audioContextRef.current;
  }, []);
  // Generate different sound types with multiple layers
  const playSound = useCallback((config: AudioConfig) => {
    if (!config.enabled) return;

    const audioContext = getAudioContext();
    if (!audioContext) return;

    try {
      // Criar múltiplos osciladores para som mais rico
      const oscillators: OscillatorNode[] = [];
      const gainNodes: GainNode[] = [];
      const filterNodes: BiquadFilterNode[] = [];

      const now = audioContext.currentTime;
      const duration = getSoundDuration(config.soundType);

      // Número de camadas baseado no tipo de som
      const layers = getLayerCount(config.soundType);

      for (let i = 0; i < layers; i++) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filterNode = audioContext.createBiquadFilter();

        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(audioContext.destination);        // Configure volume para cada camada
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime((config.volume * 0.5) / layers, now + 0.01);

        // Configure som baseado na camada e tipo
        configureAdvancedSoundType(oscillator, filterNode, gainNode, config.soundType, now, duration, i);

        // Fade out
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration - 0.05);

        oscillator.start(now);
        oscillator.stop(now + duration);

        oscillators.push(oscillator);
        gainNodes.push(gainNode);
        filterNodes.push(filterNode);
      }
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }, [getAudioContext]);

  // Test sound function
  const testSound = useCallback((config: AudioConfig) => {
    playSound(config);
  }, [playSound]);

  // Tocar som direto por tipo de evento
  const playEvent = useCallback((eventType: NotificationEventType, config?: AudioConfig) => {
    const activeConfig = config || DEFAULT_AUDIO_CONFIG;
    if (!activeConfig.enabled) return;

    // Obter o som mapeado para este evento ou o default
    const mappedSound = activeConfig.eventSounds?.[eventType] || DEFAULT_EVENT_SOUNDS[eventType] || activeConfig.soundType;
    playSound({
      ...activeConfig,
      soundType: mappedSound,
    });
  }, [playSound]);

  return {
    playSound,
    playEvent,
    testSound,
    loadAudioConfig,
    saveAudioConfig,
    isSupported: typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)
  };
};

// Helper function to get number of sound layers
const getLayerCount = (soundType: SoundType): number => {
  switch (soundType) {
    case 'chime_rise':
      return 3; // 3 notas escalonadas ascendentes
    case 'coin_crystal':
      return 2; // Duas frequências metálicas cristalinas
    case 'sync_blip':
      return 2; // Dois pulsos rápidos e suaves
    case 'tech_pulse':
      return 2; // Pulso com sub-bass e modulação
    case 'bubble_pop':
      return 1; // Pop senoidal puro e rápido
    case 'ping_alert':
      return 2; // Duplo ping harmônico
    case 'notification':
      return 3; // Som moderno com 3 camadas harmônicas
    case 'subtle':
      return 2; // Som discreto e leve com 2 camadas
    case 'impact':
      return 3; // Camada grave, média e aguda
    case 'triumph':
      return 4; // Fanfarra rica em harmônicos
    case 'alert':
      return 2; // Duas frequências alternadas
    case 'fanfare':
      return 5; // Orquestração completa
    case 'power':
      return 3; // Bass, mid e harmônico
    case 'classic':
      return 2; // Melodia e harmonia
    default:
      return 2;
  }
};

// Helper function to get sound duration
const getSoundDuration = (soundType: SoundType): number => {
  switch (soundType) {
    case 'chime_rise':
      return 0.8; // Chime ascendente ágil e agradável
    case 'coin_crystal':
      return 0.65; // Som metálico brilhante de pagamento
    case 'sync_blip':
      return 0.35; // Blip rápido de atualização
    case 'tech_pulse':
      return 0.45; // Pulso industrial de produção
    case 'bubble_pop':
      return 0.22; // Pop orgânico super rápido para chat
    case 'ping_alert':
      return 0.55; // Pingo duplo de atenção/menção
    case 'notification':
      return 1.2; // Som curto e agradável
    case 'subtle':
      return 0.6; // Som muito rápido e discreto
    case 'impact':
      return 2.0; // Som de impacto dramático mais longo e marcante
    case 'triumph':
      return 2.5; // Fanfarra triunfante longa
    case 'alert':
      return 1.0; // Alerta urgente
    case 'fanfare':
      return 3.0; // Fanfarra épica completa
    case 'power':
      return 1.8; // Som poderoso e marcante
    case 'classic':
      return 0.8; // Som clássico melhorado
    default:
      return 1.0;
  }
};

// Advanced sound configuration with multiple layers
const configureAdvancedSoundType = (
  oscillator: OscillatorNode,
  filter: BiquadFilterNode,
  gain: GainNode,
  soundType: SoundType,
  startTime: number,
  duration: number,
  layerIndex: number
) => {
  switch (soundType) {
    case 'chime_rise':
      // Arpejo ascendente harmônico e luminoso: ideal para Nova NT
      if (layerIndex === 0) {
        // Nota base (C5 -> E5 -> G5)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, startTime); // C5
        oscillator.frequency.setValueAtTime(659.25, startTime + 0.12); // E5
        oscillator.frequency.setValueAtTime(783.99, startTime + 0.24); // G5
        oscillator.frequency.exponentialRampToValueAtTime(1046.50, startTime + 0.40); // C6 brilho final
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4500, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.7, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
      } else if (layerIndex === 1) {
        // Harmônico agudo reluzente (oitava superior com leve delay)
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(1046.50, startTime + 0.06); // C6
        oscillator.frequency.setValueAtTime(1318.51, startTime + 0.18); // E6
        oscillator.frequency.setValueAtTime(1567.98, startTime + 0.30); // G6
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, startTime);
        filter.Q.setValueAtTime(2, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
      } else {
        // Fundo quente suave
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(261.63, startTime); // C4
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.1);
      }
      break;

    case 'coin_crystal':
      // Som metálico e cristalino de confirmação/pagamento (registro de caixa/moeda brilhante)
      if (layerIndex === 0) {
        // Ping de alta ressonância (C6 -> G6)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1046.50, startTime); // C6
        oscillator.frequency.setValueAtTime(1567.98, startTime + 0.08); // G6
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(900, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.8, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
      } else {
        // Brilho harmônico metálico de alta frequência
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(2093.00, startTime + 0.08); // C7
        oscillator.frequency.exponentialRampToValueAtTime(3135.96, startTime + 0.18); // G7
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(4000, startTime);
        filter.Q.setValueAtTime(4, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.03);
      }
      break;

    case 'sync_blip':
      // Toque duplo suave de transição/status para NT Atualizada
      if (layerIndex === 0) {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, startTime); // A4
        oscillator.frequency.setValueAtTime(587.33, startTime + 0.12); // D5
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, startTime);
        filter.Q.setValueAtTime(1.2, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.55, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.05, startTime + 0.11);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.135);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.02);
      } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, startTime);
        oscillator.frequency.setValueAtTime(1174.66, startTime + 0.12);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.03);
      }
      break;

    case 'tech_pulse':
      // Pulso industrial/tecnológico moderno para o Painel de Produção
      if (layerIndex === 0) {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(320, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(480, startTime + 0.15);
        oscillator.frequency.exponentialRampToValueAtTime(240, startTime + duration);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, startTime);
        filter.frequency.exponentialRampToValueAtTime(600, startTime + duration);
        filter.Q.setValueAtTime(3, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.65, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.04);
      } else {
        // Sub-bass de impacto tecnológico
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(110, startTime);
        oscillator.frequency.linearRampToValueAtTime(146.83, startTime + 0.1);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
      }
      break;

    case 'bubble_pop':
      // Pop orgânico suave tipo gota d'água para mensagens normais do Chat
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(850, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(380, startTime + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, startTime);
      filter.frequency.exponentialRampToValueAtTime(1200, startTime + duration);
      filter.Q.setValueAtTime(1.5, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.02);
      break;

    case 'ping_alert':
      // Pingo duplo cristalino para menções no Chat (@) e alertas diretos
      if (layerIndex === 0) {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, startTime); // A5
        oscillator.frequency.setValueAtTime(1174.66, startTime + 0.16); // D6
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, startTime);
        filter.Q.setValueAtTime(2, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.65, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.15);
        gain.gain.linearRampToValueAtTime(0.65, startTime + 0.175);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
      } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(1760, startTime + 0.16); // A6
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.03);
      }
      break;

    case 'notification':
      // Som moderno, agradável e profissional tipo "pop" suave
      if (layerIndex === 0) {
        // Camada principal - tom médio-agudo agradável
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, startTime); // A5 - tom claro e agradável
        oscillator.frequency.exponentialRampToValueAtTime(1174.66, startTime + 0.15); // D6
        oscillator.frequency.exponentialRampToValueAtTime(880, startTime + 0.4); // Volta para A5
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3500, startTime);
        filter.frequency.exponentialRampToValueAtTime(2000, startTime + duration);
        filter.Q.setValueAtTime(1, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.6, startTime + 0.02); // Ataque rápido
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
      } else if (layerIndex === 1) {
        // Camada harmônica - adiciona riqueza
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(1318.51, startTime + 0.05); // E6 - delay leve
        oscillator.frequency.exponentialRampToValueAtTime(1760, startTime + 0.2); // A6
        oscillator.frequency.exponentialRampToValueAtTime(1318.51, startTime + 0.5); // Volta E6
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2500, startTime);
        filter.Q.setValueAtTime(2, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.1);
      } else {
        // Camada grave sutil - corpo do som
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, startTime); // A3 - grave suave
        oscillator.frequency.linearRampToValueAtTime(293.66, startTime + 0.2); // D4
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, startTime);
        filter.Q.setValueAtTime(0.5, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.15);
      }
      break;

    case 'subtle':
      // Som muito discreto e agradável - tipo "click" suave
      if (layerIndex === 0) {
        // Camada principal - tom médio suave
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1046.50, startTime); // C6 - tom claro e discreto
        oscillator.frequency.exponentialRampToValueAtTime(1318.51, startTime + 0.08); // E6
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2500, startTime);
        filter.frequency.exponentialRampToValueAtTime(1500, startTime + duration);
        filter.Q.setValueAtTime(0.7, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.01); // Volume baixo
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.02);
      } else {
        // Camada harmônica sutil
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(2093, startTime + 0.02); // C7 - oitava acima
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, startTime);
        filter.Q.setValueAtTime(1.5, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.03);
      }
      break;

    case 'impact':
      if (layerIndex === 0) {
        // Camada grave - impacto bass ultra poderoso
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(41.20, startTime); // E1 - muito grave
        oscillator.frequency.exponentialRampToValueAtTime(82.41, startTime + 0.15); // E2
        oscillator.frequency.exponentialRampToValueAtTime(164.81, startTime + 0.4); // E3
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, startTime);
        filter.Q.setValueAtTime(1, startTime);
        gain.gain.linearRampToValueAtTime(1.0, startTime + 0.03); // Volume máximo para bass
        gain.gain.linearRampToValueAtTime(0.7, startTime + 0.5);
      } else if (layerIndex === 1) {
        // Camada média - corpo do som mais intenso
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, startTime); // A3
        oscillator.frequency.exponentialRampToValueAtTime(440, startTime + 0.2); // A4
        oscillator.frequency.exponentialRampToValueAtTime(880, startTime + 0.5); // A5
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, startTime);
        filter.Q.setValueAtTime(4, startTime);
        gain.gain.linearRampToValueAtTime(0.8, startTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.4);
      } else {
        // Camada aguda - brilho cortante máximo
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(1760, startTime); // A6
        oscillator.frequency.exponentialRampToValueAtTime(3520, startTime + 0.1); // A7
        oscillator.frequency.exponentialRampToValueAtTime(1760, startTime + 0.3); // A6
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1500, startTime);
        filter.Q.setValueAtTime(2, startTime);
        gain.gain.linearRampToValueAtTime(0.6, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.2);
      }
      break;

    case 'triumph':
      // Fanfarra épica com múltiplas vozes
      const baseFreq = [261.63, 329.63, 392.00, 523.25][layerIndex % 4]; // C, E, G, C
      oscillator.type = layerIndex < 2 ? 'square' : 'sawtooth';
      oscillator.frequency.setValueAtTime(baseFreq, startTime);
      oscillator.frequency.linearRampToValueAtTime(baseFreq * 2, startTime + duration * 0.6);
      oscillator.frequency.linearRampToValueAtTime(baseFreq * 1.5, startTime + duration);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500 + layerIndex * 500, startTime);
      filter.Q.setValueAtTime(2 + layerIndex, startTime);
      gain.gain.linearRampToValueAtTime(0.5 / (layerIndex + 1), startTime + 0.2);
      break;

    case 'alert':
      if (layerIndex === 0) {
        // Primeira frequência - urgente e aguda
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1760, startTime); // A6
        oscillator.frequency.linearRampToValueAtTime(2093, startTime + 0.3); // C7
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, startTime);
        gain.gain.exponentialRampToValueAtTime(0.7, startTime + 0.02);
      } else {
        // Segunda frequência - reforço harmônico
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, startTime + 0.1); // A5 - delay
        oscillator.frequency.linearRampToValueAtTime(1318.5, startTime + 0.4); // E6
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, startTime);
        filter.Q.setValueAtTime(4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.15);
      }
      break;

    case 'fanfare':
      // Orquestração épica completa
      const fanfareFreqs = [130.81, 164.81, 196.00, 261.63, 329.63]; // C3, E3, G3, C4, E4
      const freq = fanfareFreqs[layerIndex % 5];
      oscillator.type = layerIndex < 3 ? 'sawtooth' : 'square';
      oscillator.frequency.setValueAtTime(freq, startTime);
      
      // Progressão épica
      oscillator.frequency.linearRampToValueAtTime(freq * 1.25, startTime + duration * 0.2);
      oscillator.frequency.linearRampToValueAtTime(freq * 1.5, startTime + duration * 0.4);
      oscillator.frequency.linearRampToValueAtTime(freq * 2, startTime + duration * 0.7);
      oscillator.frequency.linearRampToValueAtTime(freq * 1.5, startTime + duration);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000 + layerIndex * 600, startTime);
      filter.frequency.linearRampToValueAtTime(4000 + layerIndex * 800, startTime + duration * 0.5);
      gain.gain.linearRampToValueAtTime(0.6 / Math.sqrt(layerIndex + 1), startTime + 0.3);
      break;

    case 'power':
      if (layerIndex === 0) {
        // Sub-bass poderoso
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(41.20, startTime); // E1
        oscillator.frequency.exponentialRampToValueAtTime(82.41, startTime + 0.4); // E2
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, startTime);
        gain.gain.exponentialRampToValueAtTime(0.9, startTime + 0.1);
      } else if (layerIndex === 1) {
        // Frequência média dominante
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(164.81, startTime); // E3
        oscillator.frequency.exponentialRampToValueAtTime(329.63, startTime + 0.5); // E4
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, startTime);
        filter.Q.setValueAtTime(3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.7, startTime + 0.15);
      } else {
        // Harmônico agudo para presença
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(659.25, startTime); // E5
        oscillator.frequency.exponentialRampToValueAtTime(1318.5, startTime + 0.3); // E6
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(800, startTime);
        gain.gain.exponentialRampToValueAtTime(0.4, startTime + 0.1);
      }
      break;

    case 'classic':
      if (layerIndex === 0) {
        // Melodia principal elegante
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, startTime); // A5
        oscillator.frequency.linearRampToValueAtTime(1108.73, startTime + 0.3); // C#6
        oscillator.frequency.linearRampToValueAtTime(1318.5, startTime + 0.6); // E6
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, startTime);
        gain.gain.linearRampToValueAtTime(0.6, startTime + 0.1);
      } else {
        // Harmonia de apoio
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, startTime); // A4
        oscillator.frequency.linearRampToValueAtTime(554.37, startTime + 0.3); // C#5
        oscillator.frequency.linearRampToValueAtTime(659.25, startTime + 0.6); // E5
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.15);
      }
      break;

    default:
      // Fallback configuração básica
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(440, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, startTime + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, startTime);
      break;
  }
};

// Helper function to configure different sound types
const configureSoundType = (
  oscillator: OscillatorNode,
  filter: BiquadFilterNode,
  gain: GainNode,
  soundType: SoundType,
  startTime: number,
  duration: number
) => {
  switch (soundType) {
    case 'impact':
      // Som de impacto dramático - baixo poderoso seguido de harmônico agudo
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(110, startTime); // A2 - grave poderoso
      oscillator.frequency.exponentialRampToValueAtTime(220, startTime + 0.1); // A3
      oscillator.frequency.exponentialRampToValueAtTime(880, startTime + 0.3); // A5 - agudo marcante
      oscillator.frequency.exponentialRampToValueAtTime(440, startTime + duration - 0.2); // Resolve em A4
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000, startTime);
      filter.frequency.exponentialRampToValueAtTime(1500, startTime + duration);
      // Envelope mais agressivo
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.exponentialRampToValueAtTime(0.8, startTime + 0.05); // Ataque rápido e forte
      gain.gain.exponentialRampToValueAtTime(0.4, startTime + 0.3);
      break;

    case 'triumph':
      // Fanfarra triunfante épica
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(523.25, startTime); // C5
      oscillator.frequency.linearRampToValueAtTime(659.25, startTime + 0.4); // E5
      oscillator.frequency.linearRampToValueAtTime(783.99, startTime + 0.8); // G5
      oscillator.frequency.linearRampToValueAtTime(1046.5, startTime + 1.2); // C6
      oscillator.frequency.linearRampToValueAtTime(1318.5, startTime + 1.6); // E6
      oscillator.frequency.linearRampToValueAtTime(1046.5, startTime + 2.0); // C6 resolução
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, startTime);
      filter.Q.setValueAtTime(5, startTime);
      // Envelope majestoso
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.2);
      gain.gain.linearRampToValueAtTime(0.8, startTime + 1.0);
      break;

    case 'alert':
      // Alerta urgente e chamativo
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(1760, startTime); // A6 - agudo chamativo
      oscillator.frequency.linearRampToValueAtTime(880, startTime + 0.2); // A5
      oscillator.frequency.linearRampToValueAtTime(1760, startTime + 0.4); // A6
      oscillator.frequency.linearRampToValueAtTime(1318.5, startTime + 0.6); // E6
      oscillator.frequency.exponentialRampToValueAtTime(2093, startTime + duration); // C7
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, startTime);
      filter.Q.setValueAtTime(3, startTime);
      // Envelope de urgência
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.exponentialRampToValueAtTime(0.7, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.3);
      break;

    case 'fanfare':
      // Fanfarra épica completa com múltiplas seções
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(261.63, startTime); // C4
      oscillator.frequency.linearRampToValueAtTime(329.63, startTime + 0.5); // E4
      oscillator.frequency.linearRampToValueAtTime(392.00, startTime + 1.0); // G4
      oscillator.frequency.linearRampToValueAtTime(523.25, startTime + 1.5); // C5
      oscillator.frequency.linearRampToValueAtTime(659.25, startTime + 2.0); // E5
      oscillator.frequency.linearRampToValueAtTime(783.99, startTime + 2.5); // G5
      oscillator.frequency.linearRampToValueAtTime(1046.5, startTime + 3.0); // C6 - clímax
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, startTime);
      filter.frequency.linearRampToValueAtTime(5000, startTime + 2.0);
      // Envelope épico crescente
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.5);
      gain.gain.linearRampToValueAtTime(0.8, startTime + 2.0);
      gain.gain.linearRampToValueAtTime(0.9, startTime + 2.5);
      break;

    case 'power':
      // Som poderoso e marcante
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(82.41, startTime); // E2 - muito grave
      oscillator.frequency.exponentialRampToValueAtTime(164.81, startTime + 0.3); // E3
      oscillator.frequency.exponentialRampToValueAtTime(659.25, startTime + 0.6); // E5
      oscillator.frequency.exponentialRampToValueAtTime(329.63, startTime + duration - 0.4); // E4 - resolução
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(5000, startTime);
      filter.frequency.exponentialRampToValueAtTime(2000, startTime + duration);
      filter.Q.setValueAtTime(2, startTime);
      // Envelope poderoso
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.exponentialRampToValueAtTime(0.9, startTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.5);
      break;

    case 'classic':
      // Som clássico melhorado - elegante mas marcante
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, startTime); // A5
      oscillator.frequency.linearRampToValueAtTime(1108.73, startTime + 0.2); // C#6
      oscillator.frequency.linearRampToValueAtTime(1318.5, startTime + 0.4); // E6
      oscillator.frequency.exponentialRampToValueAtTime(880, startTime + duration); // A5 resolução
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, startTime);
      filter.frequency.exponentialRampToValueAtTime(1500, startTime + duration);
      // Envelope clássico refinado
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.4);
      break;

    default: // 'impact'
      // Fallback para som de impacto
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(110, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, startTime + 0.3);
      oscillator.frequency.exponentialRampToValueAtTime(440, startTime + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, startTime);
      break;
  }
};

// Sound type descriptions for UI
export const SOUND_DESCRIPTIONS: Record<SoundType, string> = {
  chime_rise: 'Chime Dourado (Nova NT) - arpejo ascendente e luminoso',
  coin_crystal: 'Moeda de Cristal (Pagamento) - chime metálico brilhante de alta ressonância',
  sync_blip: 'Sincronização / Blip (NT Atualizada) - toque duplo ágil e suave',
  tech_pulse: 'Pulso Tecnológico (Produção) - pulso moderno de linha operacional',
  bubble_pop: 'Bolha / Pop (Chat) - gota orgânica suave, perfeita para mensagens rápidas',
  ping_alert: 'Ping Duplo (Menções @) - pingo de alta atenção e prioridade',
  notification: 'Notificação Moderna - som equilibrado e profissional',
  subtle: 'Discreto - notificação leve e rápida para ações secundárias',
  impact: 'Impacto Dramático - som marcante com graves presentes',
  triumph: 'Triunfo Épico - fanfarra triunfal de celebração',
  alert: 'Alerta Urgente - dois tons de atenção imediata',
  fanfare: 'Fanfarra Completa - orquestração estendida',
  power: 'Poder Absoluto - som grave e dominante',
  classic: 'Clássico Refinado - harmonia elegante e sofisticada'
};