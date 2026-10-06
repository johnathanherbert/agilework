'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Ouvinte global de leitor de código de barras / coletor Bluetooth (modo HID).
 * Fica ativo em qualquer página da aplicação de forma 100% invisível.
 * Ao identificar um bipe de código de barras, redireciona instantaneamente
 * para a tela de Consulta Rápida (/pesagem?tab=scan) com o código pré-carregado.
 */
export function GlobalBarcodeListener() {
  const router = useRouter();
  const pathname = usePathname();

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const keyIntervalsRef = useRef<number[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pré-construção e pré-carregamento em cache da rota de pesagem
  useEffect(() => {
    try {
      router.prefetch('/pesagem');
    } catch {
      // Falha silenciosa
    }
  }, [router]);

  useEffect(() => {
    const processScannedCode = (rawCode: string) => {
      const clean = rawCode.replace(/[\r\n\t]/g, ' ').trim();
      if (!clean || clean.length < 3) return;

      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('agilework_global_scan_code', clean);
          window.dispatchEvent(new CustomEvent('agilework:barcode_scanned', { detail: clean }));
        }
      } catch {
        // Silencioso
      }

      if (pathname === '/pesagem') {
        // Já está na página de pesagem: o listener interno de pesagem/consulta rápida processará
        // e se não estiver na aba de scan, o evento 'agilework:barcode_scanned' ativa a aba scan
      } else {
        // Redireciona imediatamente para a tela de consulta rápida com o código
        router.push(`/pesagem?tab=scan&code=${encodeURIComponent(clean)}`);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignora teclas modificadoras
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      // Se o componente de consulta rápida já estiver ativo e capturando o scanner,
      // ele mesmo processa para evitar dupla execução
      if (document.body.dataset.scannerActive === 'true') {
        return;
      }

      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Se houve pausa prolongada (> 450ms), reseta o buffer
      if (timeDiff > 450 && bufferRef.current.length > 0) {
        bufferRef.current = '';
        keyIntervalsRef.current = [];
      }

      // Enter finaliza o envio da etiqueta do coletor
      if (e.key === 'Enter') {
        const buffered = bufferRef.current.trim();
        if (buffered.length >= 3) {
          // Calcula velocidade média de digitação (coletores normalmente < 50ms por caractere)
          const avgInterval =
            keyIntervalsRef.current.length > 0
              ? keyIntervalsRef.current.reduce((a, b) => a + b, 0) / keyIntervalsRef.current.length
              : 999;

          const isScannerSpeed = avgInterval < 75 || !isInput;

          if (isScannerSpeed) {
            e.preventDefault();
            e.stopPropagation();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            bufferRef.current = '';
            keyIntervalsRef.current = [];
            processScannedCode(buffered);
            return;
          }
        }
        bufferRef.current = '';
        keyIntervalsRef.current = [];
        return;
      }

      // Escape limpa o buffer
      if (e.key === 'Escape') {
        bufferRef.current = '';
        keyIntervalsRef.current = [];
        return;
      }

      // Captura caractere de entrada
      if (e.key.length === 1) {
        if (timeDiff > 0 && timeDiff < 450) {
          keyIntervalsRef.current.push(timeDiff);
          if (keyIntervalsRef.current.length > 30) {
            keyIntervalsRef.current.shift();
          }
        }

        bufferRef.current += e.key;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Se o coletor não estiver configurado para enviar Enter ao fim do bipe,
        // dispara automaticamente após o fim da rajada rápida (apenas se for rajada rápida de scanner)
        timeoutRef.current = setTimeout(() => {
          const currentBuffer = bufferRef.current.trim();
          if (currentBuffer.length >= 4) {
            const avgInterval =
              keyIntervalsRef.current.length > 0
                ? keyIntervalsRef.current.reduce((a, b) => a + b, 0) / keyIntervalsRef.current.length
                : 999;

            // Se foi uma rajada rápida típica de coletor ou fora de inputs
            if (avgInterval < 65 || (!isInput && currentBuffer.length >= 5)) {
              bufferRef.current = '';
              keyIntervalsRef.current = [];
              processScannedCode(currentBuffer);
            }
          }
        }, 140);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname, router]);

  // Componente 100% invisível
  return null;
}
