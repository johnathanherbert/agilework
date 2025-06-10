"use client";

import { useCallback, useRef } from 'react';

export type SoundType = 'default' | 'chime' | 'bell' | 'pop' | 'success';

export interface AudioConfig {
  enabled: boolean;
  volume: number; // 0 to 1
  soundType: SoundType;
}

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  enabled: true,
  volume: 0.5,
  soundType: 'default'
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

  // Generate different sound types
  const playSound = useCallback((config: AudioConfig) => {
    if (!config.enabled) return;

    const audioContext = getAudioContext();
    if (!audioContext) return;

    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();

      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const now = audioContext.currentTime;
      const duration = getSoundDuration(config.soundType);

      // Configure volume
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(config.volume * 0.3, now + 0.01);

      // Configure sound based on type
      configureSoundType(oscillator, filterNode, gainNode, config.soundType, now, duration);

      // Fade out
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration - 0.05);

      oscillator.start(now);
      oscillator.stop(now + duration);
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

// Helper function to get sound duration
const getSoundDuration = (soundType: SoundType): number => {
  switch (soundType) {
    case 'chime':
      return 1.2;
    case 'bell':
      return 0.8;
    case 'pop':
      return 0.3;
    case 'success':
      return 1.0;
    default:
      return 0.5;
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
    case 'chime':
      // Pleasant chime with multiple frequencies
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, startTime); // C5
      oscillator.frequency.linearRampToValueAtTime(659.25, startTime + 0.3); // E5
      oscillator.frequency.linearRampToValueAtTime(783.99, startTime + 0.6); // G5
      oscillator.frequency.linearRampToValueAtTime(1046.5, startTime + 0.9); // C6
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, startTime);
      break;

    case 'bell':
      // Bell-like sound with harmonics
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, startTime + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, startTime);
      filter.frequency.exponentialRampToValueAtTime(800, startTime + duration);
      break;

    case 'pop':
      // Quick pop sound
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(600, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, startTime + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, startTime);
      break;

    case 'success':
      // Ascending success sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, startTime); // A4
      oscillator.frequency.linearRampToValueAtTime(554.37, startTime + 0.3); // C#5
      oscillator.frequency.linearRampToValueAtTime(659.25, startTime + 0.6); // E5
      oscillator.frequency.linearRampToValueAtTime(880, startTime + 0.9); // A5
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, startTime);
      break;

    default: // 'default'
      // Simple pleasant notification
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, startTime + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, startTime);
      break;
  }
};

// Sound type descriptions for UI
export const SOUND_DESCRIPTIONS = {
  default: 'Som padrão - simples e discreto',
  chime: 'Campainha harmoniosa - som musical agradável',
  bell: 'Sino - som tradicional de sino',
  pop: 'Pop - som rápido e moderno',
  success: 'Sucesso - melodia ascendente de conquista'
} as const;
