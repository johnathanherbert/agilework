"use client";

import { useCallback, useRef } from 'react';

export type SoundType = 'impact' | 'triumph' | 'alert' | 'fanfare' | 'power' | 'classic';

export interface AudioConfig {
  enabled: boolean;
  volume: number; // 0 to 1
  soundType: SoundType;
}

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  enabled: true,
  volume: 1.0, // Volume máximo para máximo impacto
  soundType: 'impact'
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

  return {
    playSound,
    testSound,
    loadAudioConfig,
    saveAudioConfig,
    isSupported: typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)
  };
};

// Helper function to get number of sound layers
const getLayerCount = (soundType: SoundType): number => {
  switch (soundType) {
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
const getSoundDuration = (soundType: SoundType): number => {  switch (soundType) {
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
      return 1.5;
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
  switch (soundType) {    case 'impact':
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
export const SOUND_DESCRIPTIONS = {
  impact: 'Impacto Dramático MÁXIMO - som ultra poderoso e dominante (PADRÃO)',
  triumph: 'Triunfo Épico - fanfarra majestosa de vitória',
  alert: 'Alerta Urgente - som chamativo e imediato',
  fanfare: 'Fanfarra Completa - celebração épica prolongada',
  power: 'Poder Absoluto - som grave e dominante',
  classic: 'Clássico Refinado - elegante e sofisticado'
} as const;