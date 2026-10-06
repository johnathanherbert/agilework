'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { AgingData, RemessaData } from '@/types/aging';
import { fetchAgingData, fetchRemessas, fetchMaterialValores, triggerSapAutomation, checkSapAutomationStatus } from '@/lib/dashpesagem-api';
import { parseBarcode, ParsedBarcode } from '@/lib/barcode-parser';
import {
  generateDevolverZwm296Vbs,
  DevolverVolumeItem,
  generateBloquearMigoVbs,
  generateDesbloquearMigoVbs,
  generateMoverLt10Vbs,
  BloquearItemParam,
  MoverItemParam,
  PREDEFINED_MOVER_ROUTES,
  MacroActionType,
  MacroActionItem,
  AVAILABLE_MACROS,
} from '@/components/pesagem/residuais-view';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, copyToClipboard } from '@/lib/utils';
import {
  QrCode,
  Camera,
  CameraOff,
  Search,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  ZoomOut,
  Loader2,
  Undo2,
  Lock,
  Plus,
  Trash2,
  X,
  Play,
  Copy,
  Keyboard,
  ArrowRightLeft,
  Check,
  History,
} from 'lucide-react';

/* ============================================================================
 * Helpers
 * ========================================================================== */

// Um único AudioContext para todas as leituras (o navegador limita a quantidade de contextos abertos)
let audioCtx: AudioContext | null = null;
function playScanFeedback(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioCtx) audioCtx = new AudioCtx();
      const ctx = audioCtx!;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      if (success) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(1900, t + 0.07);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
        osc.start(t);
        osc.stop(t + 0.08);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.13);
      }
    }
  } catch {
    // Autoplay pode ser bloqueado até a primeira interação
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(success ? [60] : [100, 50, 100]);
    }
  } catch {
    // Silencioso se não suportado
  }
}

const up = (v: unknown) => String(v ?? '').trim().toUpperCase();
const normMat = (v: unknown) => String(v ?? '').trim().replace(/^0+/, '');
const num = (v: unknown) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};
const fmtQ = (n: number, max = 3) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: max });
const fmtInput = (n: number) =>
  n > 0 ? n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false }) : '';
const parseQtd = (val: string): number => {
  if (!val) return 0;
  let s = String(val).trim().replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}
function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

type PosKind = 'pes' | 'aju' | 'trz' | 'dev' | 'none';
const POS_META: Record<PosKind, { label: string; color: string }> = {
  pes: { label: 'PES · PESAGEM', color: 'var(--green)' },
  aju: { label: '999 · AJUSTE', color: 'var(--violet, #9b87d6)' },
  trz: { label: '922 · TR-ZONE', color: 'var(--red)' },
  dev: { label: 'DEP · DEVOLUÇÃO', color: 'var(--amber)' },
  none: { label: 'Sem posição', color: 'var(--text-3)' },
};
function posKind(item?: AgingData | null): PosKind {
  if (!item) return 'none';
  const tipo = up(item.tipo_deposito);
  const pos = up(item.posicao_deposito);
  const dep = up(item.deposito);
  if (tipo === 'TR-ZONE' || tipo === '922' || pos.includes('TR-ZONE') || pos.includes('TRZONE') || dep === '922') return 'trz';
  if (tipo === 'DEP' || pos.includes('DEVOL') || (dep === 'DEP' && tipo !== 'PES')) return 'dev';
  if (tipo === '999' || pos.includes('AJU')) return 'aju';
  return 'pes';
}
const POS_ORDER: Record<PosKind, number> = { pes: 0, aju: 1, dev: 2, trz: 3, none: 4 };

type AgingInfo = { k: 'ok' | 'al' | 'cr' | 'none'; label: string; color: string };
function agingInfo(days?: number | string | null): AgingInfo {
  if (days === undefined || days === null || days === '' || isNaN(Number(days))) {
    return { k: 'none', label: '—', color: 'var(--text-3)' };
  }
  const d = Number(days);
  if (d >= 15) return { k: 'cr', label: 'Crítico', color: 'var(--red)' };
  if (d >= 7) return { k: 'al', label: 'Alerta', color: 'var(--amber)' };
  return { k: 'ok', label: 'Normal', color: 'var(--green)' };
}

const Dot = ({ color, className }: { color: string; className?: string }) => (
  <span className={cn('inline-block w-[7px] h-[7px] rounded-full shrink-0', className)} style={{ background: color }} />
);

type StepRun = { s: 'run' | 'ok' | 'fail' | 'skip'; msg?: string };
type ScanHist = { key: string; lote: string; material: string; at: number };
type Alert = { tone: 'red' | 'amber' | 'info'; text: string; action?: { label: string; onClick: () => void } };

/* ============================================================================
 * Componente
 * ========================================================================== */

interface ConsultaRapidaViewProps {
  agingData?: AgingData[];
  remessas?: RemessaData[];
  valores?: Record<string, number>;
  currentUserEmail?: string;
  onNavigateToTab?: (tab: string) => void;
  isEmbedded?: boolean;
}

export function ConsultaRapidaView({
  agingData: initialAging,
  remessas: initialRemessas,
  valores: initialValores,
  currentUserEmail,
  onNavigateToTab,
  isEmbedded = false,
}: ConsultaRapidaViewProps) {
  const [agingList, setAgingList] = useState<AgingData[]>(initialAging || []);
  const [remessasList, setRemessasList] = useState<RemessaData[]>(initialRemessas || []);
  const [valoresList, setValoresList] = useState<Record<string, number>>(initialValores || {});
  const [loadingData, setLoadingData] = useState<boolean>(!initialAging || initialAging.length === 0);

  // Devolver
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [devolverMaterial, setDevolverMaterial] = useState('');
  const [devolverDescricao, setDevolverDescricao] = useState('');
  const [devolverLote, setDevolverLote] = useState('');
  const [devolverUnidade, setDevolverUnidade] = useState('KG');
  const [devolverSaldoTotal, setDevolverSaldoTotal] = useState(0);
  const [devolverVolumes, setDevolverVolumes] = useState<DevolverVolumeItem[]>([{ id: '1', quantidade: '', volume: '1' }]);
  const [isDevolverRunning, setIsDevolverRunning] = useState(false);

  // Pipeline SAP
  const [bloquearMigoOpen, setBloquearMigoOpen] = useState(false);
  const [bloquearSelectedItems, setBloquearSelectedItems] = useState<BloquearItemParam[]>([]);
  const [macroPipeline, setMacroPipeline] = useState<MacroActionItem[]>([{ id: 'step-1', actionType: 'bloquear_migo' }]);
  const [isBloquearMigoRunning, setIsBloquearMigoRunning] = useState(false);
  const [runState, setRunState] = useState<Record<string, StepRun>>({});

  // Leitura
  const [scannerActive, setScannerActive] = useState(false);
  const [showCameraDrawer, setShowCameraDrawer] = useState(false);
  const [isManualTyping, setIsManualTyping] = useState(false);
  const [lastScanSuccess, setLastScanSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState<ParsedBarcode | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [history, setHistory] = useState<ScanHist[]>([]);
  const [showAllLots, setShowAllLots] = useState(false);
  const [secTab, setSecTab] = useState<'lotes' | 'remessas'>('lotes');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const scannerContainerId = 'mobile-barcode-reader-view';
  const html5QrCodeRef = useRef<any>(null);

  // Buffer do coletor Bluetooth (HID)
  const barcodeBufferRef = useRef('');
  const bufferStartRef = useRef(0);
  const lastKeyTimeRef = useRef(0);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${label} copiado`, { id: `copy-${text}`, duration: 1600 });
  };

  /* ---------------- dados ---------------- */
  useEffect(() => {
    if (initialAging && initialAging.length > 0) {
      setAgingList(initialAging);
      setLoadingData(false);
    }
  }, [initialAging]);

  useEffect(() => {
    if (initialRemessas && initialRemessas.length > 0) setRemessasList(initialRemessas);
  }, [initialRemessas]);

  useEffect(() => {
    if (initialValores && Object.keys(initialValores).length > 0) {
      setValoresList(initialValores);
    }
  }, [initialValores]);

  // force=true recarrega mesmo quando os dados vieram por props (ex.: depois de executar no SAP)
  const loadStockData = async (force = false) => {
    if (!force && initialAging && initialAging.length > 0) {
      if (!initialValores || Object.keys(initialValores).length === 0) {
        fetchMaterialValores().then((v) => { if (v && Object.keys(v).length) setValoresList(v); }).catch(() => {});
      }
      return;
    }
    setLoadingData(true);
    try {
      const [aging, remessas, vals] = await Promise.all([
        fetchAgingData().catch(() => [] as AgingData[]),
        fetchRemessas().catch(() => [] as RemessaData[]),
        fetchMaterialValores().catch(() => ({} as Record<string, number>)),
      ]);
      if (aging.length) setAgingList(aging);
      if (remessas.length) setRemessasList(remessas);
      if (vals && Object.keys(vals).length) setValoresList(vals);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadStockData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isManualTyping && inputRef.current) inputRef.current.focus();
  }, [isManualTyping]);

  /* ---------------- leitura ---------------- */
  const handleBarcodeScanned = (rawText: string) => {
    if (!rawText || rawText.trim() === '') return;
    const cleanRaw = rawText.replace(/[\r\n\t]/g, ' ').trim();
    if (!cleanRaw) return;

    playScanFeedback(true);
    setLastScanSuccess(true);
    setTimeout(() => setLastScanSuccess(false), 900);
    setShowAllLots(false);
    setSecTab('lotes');

    if (!isManualTyping && inputRef.current) inputRef.current.blur();

    try {
      const parsed = parseBarcode(cleanRaw);

      if (!parsed.lote && parsed.material) {
        const single = up(parsed.material);
        const byLote = agingList.find((i) => up(i.lote) === single);
        if (byLote) {
          setScannedResult({ material: byLote.material, lote: byLote.lote, quantidade: null, raw: cleanRaw });
          setManualInput(cleanRaw);
          return;
        }
        const byMat = agingList.find((i) => normMat(i.material) === normMat(single));
        if (byMat) {
          setScannedResult({ material: byMat.material, lote: '', quantidade: null, raw: cleanRaw });
          setManualInput(cleanRaw);
          return;
        }
      }
      setScannedResult(parsed);
      setManualInput(cleanRaw);
    } catch {
      setScannedResult({ raw: cleanRaw, material: cleanRaw, lote: '', quantidade: null });
      setManualInput(cleanRaw);
    }
  };

  const handleClear = () => {
    setScannedResult(null);
    setManualInput('');
    barcodeBufferRef.current = '';
    if (isManualTyping && inputRef.current) inputRef.current.focus();
  };

  // Refs para o listener global não usar versões antigas das funções/estados
  const scanRef = useRef(handleBarcodeScanned);
  const clearRef = useRef(handleClear);
  const manualRef = useRef(isManualTyping);
  const blockedRef = useRef(false);
  scanRef.current = handleBarcodeScanned;
  clearRef.current = handleClear;
  manualRef.current = isManualTyping;
  blockedRef.current = devolverOpen || bloquearMigoOpen;

  useEffect(() => {
    if (typeof document !== 'undefined') document.body.dataset.scannerActive = 'true';

    const flush = () => {
      const txt = barcodeBufferRef.current.trim();
      barcodeBufferRef.current = '';
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      return txt;
    };

    const onKey = (e: KeyboardEvent) => {
      if (blockedRef.current) return; // modal aberto: não intercepta
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const ae = document.activeElement as HTMLElement | null;
      const inScanInput = ae === inputRef.current;
      if (ae && !inScanInput && (['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) || ae.isContentEditable)) return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 450) barcodeBufferRef.current = '';
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const txt = flush() || (inScanInput ? (inputRef.current?.value || '').trim() : '');
        if (txt) {
          e.preventDefault();
          e.stopPropagation();
          scanRef.current(txt);
        }
        return;
      }
      if (e.key === 'Escape') {
        clearRef.current();
        return;
      }
      if (e.key.length === 1) {
        // Digitação manual no campo: deixa o usuário digitar e confirmar com Enter
        if (inScanInput && manualRef.current) return;
        e.stopPropagation(); // impede atalhos globais (ex.: "m") de capturar o bipe
        if (!barcodeBufferRef.current) bufferStartRef.current = now;
        barcodeBufferRef.current += e.key;
        if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
        // Coletor sem Enter no fim: dispara após a rajada, só se a velocidade for de leitor (< 60 ms por caractere)
        bufferTimeoutRef.current = setTimeout(() => {
          const len = barcodeBufferRef.current.length;
          const perChar = (Date.now() - bufferStartRef.current) / Math.max(len, 1);
          if (len >= 4 && perChar < 60) {
            const txt = flush();
            if (txt) scanRef.current(txt);
          }
        }, 150);
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      if (typeof document !== 'undefined') delete document.body.dataset.scannerActive;
    };
  }, []);

  // Histórico das últimas leituras
  useEffect(() => {
    if (!scannedResult) return;
    const lote = (scannedResult.lote || '').trim();
    const material = (scannedResult.material || '').trim();
    const key = lote || material || scannedResult.raw;
    setHistory((prev) => [{ key, lote, material, at: Date.now() }, ...prev.filter((h) => h.key !== key)].slice(0, 8));
  }, [scannedResult]);

  /* ---------------- câmera ---------------- */
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);

  const BARCODE_FORMATS = async () => {
    const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
    return {
      Html5Qrcode,
      formats: [F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8, F.ITF, F.QR_CODE],
    };
  };

  const startScanner = async () => {
    setCameraError(null);
    setScannerActive(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const { Html5Qrcode, formats } = await BARCODE_FORMATS();
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) await html5QrCodeRef.current.stop();
          await html5QrCodeRef.current.clear();
        } catch {
          /* ignora */
        }
      }
      const instance = new Html5Qrcode(scannerContainerId, { formatsToSupport: formats, verbose: false });
      html5QrCodeRef.current = instance;
      await instance.start(
        { facingMode: 'environment' },
        {
          fps: 25,
          qrbox: (w: number, h: number) => ({
            width: Math.max(Math.floor(w * 0.9), 240),
            height: Math.max(Math.min(Math.floor(h * 0.5), 180), 100),
          }),
          aspectRatio: 1.777778,
          disableFlip: false,
        },
        (decoded: string) => {
          handleBarcodeScanned(decoded);
          stopScanner();
        },
        () => {}
      );
      try {
        const caps: any = instance.getRunningTrackCapabilities();
        if (caps?.torch) setHasTorch(true);
        if (caps?.zoom) setMaxZoom(caps.zoom.max || 1);
      } catch {
        /* ignora */
      }
    } catch (err) {
      console.error('Erro ao iniciar câmera:', err);
      setCameraError('Não foi possível acessar a câmera. Verifique a permissão e se a página está em HTTPS.');
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current?.isScanning) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      }
    } catch (err) {
      console.error('Erro ao parar câmera:', err);
    } finally {
      setScannerActive(false);
      setTorchOn(false);
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const next = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      toast.error('Não foi possível alternar a lanterna');
    }
  };

  const handleZoomChange = async (z: number) => {
    if (!html5QrCodeRef.current) return;
    try {
      await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ zoom: z }] });
      setZoomLevel(z);
    } catch {
      /* silencioso */
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);
    const toastId = toast.loading('Lendo etiqueta da foto…');
    try {
      const { Html5Qrcode, formats } = await BARCODE_FORMATS();
      let tmp = document.getElementById('barcode-file-reader-hidden-view');
      if (!tmp) {
        tmp = document.createElement('div');
        tmp.id = 'barcode-file-reader-hidden-view';
        tmp.style.display = 'none';
        document.body.appendChild(tmp);
      }
      const fileScanner = new Html5Qrcode('barcode-file-reader-hidden-view', { formatsToSupport: formats, verbose: false });
      try {
        const decoded = await fileScanner.scanFile(file, true);
        toast.dismiss(toastId);
        handleBarcodeScanned(decoded);
      } catch {
        toast.error('Nenhum código legível na foto. Aproxime da etiqueta e tente de novo.', { id: toastId });
        playScanFeedback(false);
      } finally {
        await fileScanner.clear();
      }
    } catch {
      toast.error('Falha ao processar a imagem', { id: toastId });
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ============================================================================
   * Derivados: foco no lote lido
   * ========================================================================== */
  const loteCode = (scannedResult?.lote || '').trim();
  const loteUp = up(loteCode);

  const loteRows = useMemo(
    () => (loteUp ? agingList.filter((i) => up(i.lote) === loteUp) : []),
    [agingList, loteUp]
  );
  const loteEncontrado = !loteCode || loteRows.length > 0;

  // Prioriza a linha do lote que está na PESAGEM
  const activeLoteItem = useMemo(
    () => loteRows.find((r) => posKind(r) === 'pes') || loteRows[0] || null,
    [loteRows]
  );
  const otherPositionsOfLote = useMemo(() => loteRows.filter((r) => r !== activeLoteItem), [loteRows, activeLoteItem]);

  const materialCode = activeLoteItem?.material || scannedResult?.material || '';
  const matKey = normMat(materialCode);

  const allMaterialItems = useMemo(
    () => (matKey ? agingList.filter((i) => normMat(i.material) === matKey) : []),
    [agingList, matKey]
  );

  // Nada encontrado pelo código: busca aproximada pelo texto lido
  const rawMatches = useMemo(() => {
    if (!scannedResult || allMaterialItems.length || loteRows.length) return [];
    const raw = up(scannedResult.raw);
    if (raw.length < 3) return [];
    return agingList
      .filter((i) => up(i.lote).includes(raw) || String(i.material).includes(raw) || up(i.texto_breve_material).includes(raw))
      .slice(0, 30);
  }, [scannedResult, allMaterialItems.length, loteRows.length, agingList]);

  const materialDescription =
    activeLoteItem?.texto_breve_material || allMaterialItems[0]?.texto_breve_material || '';
  const unidadeMedida = activeLoteItem?.unidade_medida || allMaterialItems[0]?.unidade_medida || 'KG';

  const saldoLote = num(activeLoteItem?.estoque_disponivel);

  const valorUnitario = useMemo(() => {
    if (!materialCode) return 0;
    const clean = normMat(materialCode);
    return valoresList[materialCode] || valoresList[clean] || 0;
  }, [valoresList, materialCode]);

  const valorMonetarioLote = useMemo(() => {
    if (valorUnitario <= 0 || saldoLote <= 0) return 0;
    return saldoLote * valorUnitario;
  }, [saldoLote, valorUnitario]);

  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const activePos = posKind(activeLoteItem);
  const aging = agingInfo(activeLoteItem?.dias_aging);
  const vencDate = parseDate(activeLoteItem?.data_vencimento as string | undefined);
  const vencDias = daysUntil(vencDate);

  // Demais lotes do material (exclui o lote lido): PESAGEM primeiro, depois vencimento mais próximo
  const otherLots = useMemo(() => {
    return allMaterialItems
      .filter((i) => !loteUp || up(i.lote) !== loteUp)
      .slice()
      .sort((a, b) => {
        const p = POS_ORDER[posKind(a)] - POS_ORDER[posKind(b)];
        if (p) return p;
        const da = parseDate(a.data_vencimento as string | undefined)?.getTime() ?? Infinity;
        const db = parseDate(b.data_vencimento as string | undefined)?.getTime() ?? Infinity;
        if (da !== db) return da - db;
        return num(b.dias_aging) - num(a.dias_aging);
      });
  }, [allMaterialItems, loteUp]);

  const totalMaterial = useMemo(() => allMaterialItems.reduce((s, i) => s + num(i.estoque_disponivel), 0), [allMaterialItems]);
  const valorMonetarioTotalMaterial = useMemo(() => {
    if (valorUnitario <= 0 || totalMaterial <= 0) return 0;
    return totalMaterial * valorUnitario;
  }, [totalMaterial, valorUnitario]);
  const totalPes = useMemo(
    () => allMaterialItems.filter((i) => posKind(i) === 'pes').reduce((s, i) => s + num(i.estoque_disponivel), 0),
    [allMaterialItems]
  );
  const lotesPes = useMemo(() => allMaterialItems.filter((i) => posKind(i) === 'pes').length, [allMaterialItems]);

  // FEFO: outro lote na PESAGEM vence antes do lote lido
  const earlierPesLot = useMemo(() => {
    if (!vencDate || activePos !== 'pes') return null;
    return (
      otherLots.find((i) => {
        if (posKind(i) !== 'pes' || num(i.estoque_disponivel) <= 0) return false;
        const d = parseDate(i.data_vencimento as string | undefined);
        return !!d && d.getTime() < vencDate.getTime();
      }) || null
    );
  }, [otherLots, vencDate, activePos]);

  const materialRemessas = useMemo(() => {
    if (!matKey) return [];
    return remessasList.filter((r) => normMat(r.material) === matKey);
  }, [remessasList, matKey]);
  const remessasQtd = useMemo(() => materialRemessas.reduce((s, r) => s + num(r.quantidade), 0), [materialRemessas]);

  /* ============================================================================
   * Devolver
   * ========================================================================== */
  const somaVolumes = useMemo(
    () =>
      Math.round(
        devolverVolumes.reduce((acc, v) => {
          const vol = parseQtd(v.volume);
          return acc + parseQtd(v.quantidade) * (vol > 0 ? vol : 1);
        }, 0) * 1000
      ) / 1000,
    [devolverVolumes]
  );
  const totalVolumesCount = useMemo(
    () => devolverVolumes.reduce((acc, v) => acc + (parseQtd(v.volume) > 0 ? parseQtd(v.volume) : 1), 0),
    [devolverVolumes]
  );
  const saldoRestante = Math.max(0, Math.round((devolverSaldoTotal - somaVolumes) * 1000) / 1000);
  const isOverSaldo = somaVolumes > devolverSaldoTotal + 0.0001;
  const hasInvalidVolume = devolverVolumes.some((v) => parseQtd(v.quantidade) <= 0);

  const handleOpenDevolver = (mat: string, lot: string, desc: string, unidade: string, saldoTotal: number, qtd?: number) => {
    setDevolverMaterial(mat);
    setDevolverLote(lot);
    setDevolverDescricao(desc);
    setDevolverUnidade(unidade || 'KG');
    setDevolverSaldoTotal(saldoTotal);
    setDevolverVolumes([{ id: String(Date.now()), quantidade: fmtInput(qtd ?? saldoTotal), volume: '1' }]);
    setDevolverOpen(true);
  };

  const handleAddVolume = () =>
    setDevolverVolumes((p) => [...p, { id: String(Date.now() + Math.random()), quantidade: '', volume: '1' }]);
  const handleRemoveVolume = (idx: number) => setDevolverVolumes((p) => p.filter((_, i) => i !== idx));
  const handleUpdateVolume = (idx: number, field: 'quantidade' | 'volume', value: string) =>
    setDevolverVolumes((p) => {
      const c = [...p];
      c[idx] = { ...c[idx], [field]: value };
      return c;
    });
  const handleFillRestante = () => {
    if (saldoRestante <= 0.0001) return;
    const restante = fmtInput(saldoRestante);
    setDevolverVolumes((p) => {
      const last = p.length - 1;
      if (last >= 0 && parseQtd(p[last].quantidade) === 0) {
        const c = [...p];
        c[last] = { ...c[last], quantidade: restante };
        return c;
      }
      return [...p, { id: String(Date.now()), quantidade: restante, volume: '1' }];
    });
  };

  const handleConfirmDevolver = async () => {
    if (!devolverMaterial || !devolverLote || devolverVolumes.length === 0) return;
    if (hasInvalidVolume) {
      toast.error('Preencha uma quantidade válida em todos os volumes.');
      return;
    }
    if (isOverSaldo) {
      toast.error('A soma dos volumes ultrapassa o saldo do lote.');
      return;
    }
    setDevolverOpen(false);
    setIsDevolverRunning(true);
    const toastId = toast.loading(`Enviando devolução de ${devolverLote} (${devolverVolumes.length} volume(s))…`);
    const vbsCode = generateDevolverZwm296Vbs(devolverMaterial, devolverLote, devolverVolumes);
    const res = await executeSapJobAndWait('devolver', currentUserEmail || 'Mobile / Consulta', vbsCode, 80);
    setIsDevolverRunning(false);
    if (res.success) {
      toast.success(`Devolução do lote ${devolverLote} executada no SAP`, { id: toastId });
      loadStockData(true);
    } else {
      toast.error(`Devolução falhou: ${res.message || 'erro no SAP'}`, { id: toastId, duration: 8000 });
    }
  };

  /* ============================================================================
   * Pipeline SAP
   * ========================================================================== */
  const makeSteps = (types: MacroActionType[]): MacroActionItem[] =>
    types.map((actionType, i) => ({
      id: `${actionType}-${Date.now()}-${i}`,
      actionType,
      routeId: actionType === 'mover_lt10' ? 'pes_pesagem' : undefined,
    }));

  const openPipeline = (item: AgingData | null, steps: MacroActionType[], qty?: number) => {
    const mat = item?.material || materialCode;
    const lot = item?.lote || loteCode;
    if (!mat || !lot) return;
    setBloquearSelectedItems([
      {
        material: mat,
        lote: lot,
        quantidade: fmtInput(qty ?? num(item?.estoque_disponivel)),
        unidade: item?.unidade_medida || unidadeMedida || 'KG',
        descricao: item?.texto_breve_material || materialDescription,
      },
    ]);
    setMacroPipeline(makeSteps(steps));
    setRunState({});
    setBloquearMigoOpen(true);
  };

  const handleToggleMigoMode = (mode: 'bloquear' | 'desbloquear') => {
    const target: MacroActionType = mode === 'bloquear' ? 'bloquear_migo' : 'desbloquear_migo';
    setMacroPipeline((prev) => {
      const hasMigo = prev.some((m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo');
      if (!hasMigo) return [{ id: `step-${Date.now()}`, actionType: target }, ...prev];
      return prev.map((m) =>
        m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo' ? { ...m, actionType: target } : m
      );
    });
  };
  const updateItem = (field: keyof BloquearItemParam, value: string) =>
    setBloquearSelectedItems((prev) => {
      if (!prev.length) return prev;
      const c = [...prev];
      c[0] = { ...c[0], [field]: value };
      return c;
    });
  const addStep = (t: MacroActionType) =>
    setMacroPipeline((prev) => {
      const step: MacroActionItem = {
        id: `${t}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actionType: t,
        routeId: t === 'mover_lt10' ? 'pes_pesagem' : undefined,
      };
      // "Atualizar DB" fica sempre por último
      const dbIdx = prev.findIndex((s) => s.actionType === 'atualizar_db');
      if (t !== 'atualizar_db' && dbIdx === prev.length - 1 && dbIdx >= 0) {
        const c = [...prev];
        c.splice(dbIdx, 0, step);
        return c;
      }
      return [...prev, step];
    });
  const removeStep = (i: number) => setMacroPipeline((p) => p.filter((_, idx) => idx !== i));
  const moveStep = (from: number, to: number) =>
    setMacroPipeline((p) => {
      if (to < 0 || to >= p.length) return p;
      const c = [...p];
      const [m] = c.splice(from, 1);
      c.splice(to, 0, m);
      return c;
    });
  const setStepRoute = (id: string, routeId: string) =>
    setMacroPipeline((p) => p.map((s) => (s.id === id ? { ...s, routeId } : s)));

  const PRESETS: { label: string; steps: MacroActionType[] }[] = [
    { label: 'Mover p/ PESAGEM', steps: ['mover_lt10', 'atualizar_db'] },
    { label: 'Completo', steps: ['bloquear_migo', 'mover_lt10', 'atualizar_db'] },
    { label: 'Só bloquear', steps: ['bloquear_migo'] },
    { label: 'Desbloquear + DB', steps: ['desbloquear_migo', 'atualizar_db'] },
  ];
  const pipelineKey = macroPipeline.map((s) => s.actionType + (s.routeId || '')).join(',');
  const presetKey = (steps: MacroActionType[]) =>
    steps.map((t) => t + (t === 'mover_lt10' ? 'pes_pesagem' : '')).join(',');

  const executeSapJobAndWait = (
    action: string,
    user: string,
    vbsCode?: string,
    maxSeconds = 60
  ): Promise<{ success: boolean; message?: string }> =>
    new Promise(async (resolve) => {
      try {
        const res = await triggerSapAutomation(action, user, vbsCode);
        if (!res.success || !res.job) return resolve({ success: false, message: res.error || 'Erro ao criar solicitação' });
        const jobId = res.job.id;
        let attempts = 0;
        const maxAttempts = Math.ceil(maxSeconds / 2);
        const interval = setInterval(async () => {
          attempts++;
          try {
            const st = await checkSapAutomationStatus(jobId);
            if (st?.status === 'completed') {
              clearInterval(interval);
              resolve({ success: true, message: st.result_message });
            } else if (st?.status === 'failed') {
              clearInterval(interval);
              resolve({ success: false, message: st.result_message || 'Falha na execução no SAP' });
            } else if (attempts >= maxAttempts) {
              clearInterval(interval);
              resolve({ success: false, message: 'Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.' });
            }
          } catch (e: any) {
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              resolve({ success: false, message: e?.message || 'Erro de comunicação' });
            }
          }
        }, 2000);
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Erro inesperado' });
      }
    });

  const runStep = async (step: MacroActionItem, user: string, n: number) => {
    const items = bloquearSelectedItems;
    switch (step.actionType) {
      case 'bloquear_migo':
        return executeSapJobAndWait('bloquear_migo', user, generateBloquearMigoVbs(items), Math.max(60, n * 25));
      case 'desbloquear_migo':
        return executeSapJobAndWait('desbloquear_migo', user, generateDesbloquearMigoVbs(items), Math.max(60, n * 25));
      case 'mover_lt10': {
        const route =
          PREDEFINED_MOVER_ROUTES.find((r) => r.id === (step.routeId || 'pes_pesagem')) || PREDEFINED_MOVER_ROUTES[0];
        const moverItems: MoverItemParam[] = items.map((it) => ({
          material: it.material,
          lote: it.lote,
          quantidade: it.quantidade,
          unidade: it.unidade,
          depositoOrigem: it.depositoOrigem || 'PES',
          descricao: it.descricao,
        }));
        return executeSapJobAndWait(
          'mover_lt10',
          user,
          generateMoverLt10Vbs(moverItems, { tipo: route.tipo, posicao: route.posicao }),
          Math.max(60, n * 25)
        );
      }
      case 'mover_ajuste':
        return executeSapJobAndWait('movermigo', user, undefined, 60);
      case 'atualizar_db':
        return executeSapJobAndWait('atualizar_db', user, undefined, 180);
      case 'devolver':
        return executeSapJobAndWait(
          'devolver',
          user,
          generateDevolverZwm296Vbs(
            items[0]?.material || '',
            items[0]?.lote || '',
            items.map((it, idx) => ({ quantidade: it.quantidade, volume: String(idx + 1) }))
          ),
          90
        );
      default:
        return { success: true };
    }
  };

  const handleExecutePipeline = async () => {
    if (!macroPipeline.length) {
      toast.error('Adicione ao menos uma ação ao pipeline.');
      return;
    }
    const it = bloquearSelectedItems[0];
    if (!it || !it.material.trim() || !it.lote.trim() || parseQtd(it.quantidade) <= 0) {
      toast.error('Informe material, lote e uma quantidade válida.');
      return;
    }
    setIsBloquearMigoRunning(true);
    setRunState({});
    const user = currentUserEmail || 'Mobile / Consulta';
    const steps = [...macroPipeline];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setRunState((p) => ({ ...p, [step.id]: { s: 'run' } }));
      const res = await runStep(step, user, bloquearSelectedItems.length);
      if (!res.success) {
        setRunState((p) => {
          const nx: Record<string, StepRun> = { ...p, [step.id]: { s: 'fail', msg: res.message } };
          steps.slice(i + 1).forEach((s) => (nx[s.id] = { s: 'skip', msg: 'Não executada' }));
          return nx;
        });
        setIsBloquearMigoRunning(false);
        playScanFeedback(false);
        toast.error(`Etapa ${i + 1} falhou: ${res.message || 'erro no SAP'}`, { duration: 8000 });
        return;
      }
      setRunState((p) => ({ ...p, [step.id]: { s: 'ok', msg: res.message } }));
    }

    setIsBloquearMigoRunning(false);
    toast.success('Pipeline concluído no SAP');
    loadStockData(true);
    setTimeout(() => setBloquearMigoOpen(false), 900);
  };

  /* ============================================================================
   * Ações e alertas do lote lido
   * ========================================================================== */
  const selectLot = (item: AgingData) => {
    setScannedResult({ material: item.material, lote: item.lote, quantidade: null, raw: String(item.lote) });
    setManualInput(String(item.lote));
    setShowAllLots(false);
    requestAnimationFrame(() => heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const reopenHistory = (h: ScanHist) => {
    setScannedResult({ material: h.material, lote: h.lote, quantidade: null, raw: h.key });
    setManualInput(h.key);
  };

  const openDevolverLido = () =>
    handleOpenDevolver(
      materialCode,
      loteCode,
      materialDescription,
      unidadeMedida,
      saldoLote,
      saldoLote
    );

  const alerts: Alert[] = [];
  if (scannedResult && loteCode && !loteEncontrado) {
    alerts.push({ tone: 'red', text: `Lote ${loteCode} não está na base de estoque atual.` });
  }
  if (activeLoteItem) {
    if (activePos !== 'pes') {
      alerts.push({
        tone: 'amber',
        text: `Lote fora da PESAGEM: está em ${POS_META[activePos].label}.`,
        action: { label: 'Mover p/ PESAGEM', onClick: () => openPipeline(activeLoteItem, ['mover_lt10', 'atualizar_db']) },
      });
    }
    if (saldoLote < 0) alerts.push({ tone: 'red', text: `Saldo negativo no SAP: ${fmtQ(saldoLote)} ${unidadeMedida}.` });
    if (vencDias !== null && vencDias < 0) alerts.push({ tone: 'red', text: `Lote vencido há ${-vencDias} dia(s).` });
    else if (vencDias !== null && vencDias <= 30) alerts.push({ tone: 'amber', text: `Vence em ${vencDias} dia(s).` });
    if (aging.k === 'cr') alerts.push({ tone: 'red', text: `Aging crítico: ${activeLoteItem.dias_aging} dias na posição.` });
    if (earlierPesLot) {
      alerts.push({
        tone: 'amber',
        text: `FEFO: o lote ${earlierPesLot.lote} vence antes (${earlierPesLot.data_vencimento}) e está na PESAGEM.`,
        action: { label: 'Ver lote', onClick: () => selectLot(earlierPesLot) },
      });
    }
  }
  if (materialRemessas.length) {
    const cobre = totalPes >= remessasQtd;
    alerts.push({
      tone: cobre ? 'info' : 'amber',
      text: `${materialRemessas.length} remessa(s) aberta(s) pedem ${fmtQ(remessasQtd)} ${unidadeMedida} · PESAGEM tem ${fmtQ(totalPes)} ${unidadeMedida}${cobre ? '' : ' (não cobre)'}.`,
      action: { label: 'Ver remessas', onClick: () => setSecTab('remessas') },
    });
  }
  const toneColor = { red: 'var(--red)', amber: 'var(--amber)', info: 'var(--text-3)' } as const;

  const primaryIsMove = !!activeLoteItem && activePos !== 'pes';

  /* ============================================================================
   * UI
   * ========================================================================== */
  const iconBtn =
    'h-9 min-w-9 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors';
  const actBtn =
    'h-11 lg:h-9 px-3 rounded-[var(--radius)] border inline-flex items-center justify-center gap-1.5 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const renderLotRow = (item: AgingData, key: string) => {
    const pk = posKind(item);
    const ag = agingInfo(item.dias_aging);
    const venc = parseDate(item.data_vencimento as string | undefined);
    const fefo =
      vencDate && pk === 'pes' && venc && venc.getTime() < vencDate.getTime() && num(item.estoque_disponivel) > 0;
    return (
      <button
        key={key}
        type="button"
        onClick={() => selectLot(item)}
        className="w-full grid grid-cols-[10px_minmax(0,1fr)_auto_14px] gap-x-2.5 items-center px-1 py-2.5 border-b border-[var(--border)] text-left hover:bg-[var(--surface-2)] active:bg-[var(--hover)]"
      >
        <Dot color={POS_META[pk].color} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-medium text-[var(--text)]">{item.lote}</span>
            {fefo && (
              <span className="text-[10.5px] font-medium text-[var(--amber)] border border-[var(--border-strong)] rounded px-1 leading-4">
                vence antes
              </span>
            )}
          </span>
          <span className="block text-[11.5px] text-[var(--text-3)] truncate">
            {POS_META[pk].label}
            {item.posicao_deposito && pk !== 'pes' ? ` · ${item.posicao_deposito}` : ''} ·{' '}
            <span style={{ color: ag.color }}>{item.dias_aging ?? '—'} d</span>
            {item.data_vencimento ? ` · venc. ${item.data_vencimento}` : ''}
          </span>
        </span>
        <span className="font-mono text-[13px] text-right text-[var(--text)] whitespace-nowrap">
          {fmtQ(num(item.estoque_disponivel))}
          <span className="text-[11px] text-[var(--text-3)] ml-1">{item.unidade_medida || 'KG'}</span>
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[var(--text-3)]" />
      </button>
    );
  };

  const visibleLots = showAllLots ? otherLots : otherLots.slice(0, loteCode ? 6 : 12);

  return (
    <div className={cn('text-[var(--text)] w-full', !isEmbedded && 'max-w-6xl mx-auto px-3')}>
      {/* ================= BARRA DE LEITURA ================= */}
      <div className="sticky top-0 z-20 bg-[var(--bg)] -mx-3 px-3 pt-2 pb-2.5 border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <Dot color={lastScanSuccess ? 'var(--accent)' : 'var(--green)'} className={cn(lastScanSuccess && 'scale-150 transition-transform')} />
            <span className="font-medium text-[var(--text)] whitespace-nowrap">
              {lastScanSuccess ? 'Leitura recebida' : isManualTyping ? 'Digitação manual' : 'Coletor pronto'}
            </span>
            <span className="text-[var(--text-3)] truncate">
              {loadingData ? '· carregando estoque…' : `· ${agingList.length.toLocaleString('pt-BR')} lotes na base`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => (scannerActive ? stopScanner() : setShowCameraDrawer((v) => !v))}
              className={cn(iconBtn, (showCameraDrawer || scannerActive) && 'text-[var(--accent)] border-[var(--accent)]')}
              title="Ler pela câmera"
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Câmera</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !isManualTyping;
                setIsManualTyping(next);
                if (!next) inputRef.current?.blur();
              }}
              className={cn(iconBtn, isManualTyping && 'text-[var(--text)] bg-[var(--hover)] border-[var(--text-3)]')}
              title={isManualTyping ? 'Voltar ao modo coletor (oculta o teclado)' : 'Digitar código na tela'}
            >
              <Keyboard className="h-4 w-4" />
              <span className="hidden sm:inline">{isManualTyping ? 'Teclado' : 'Digitar'}</span>
            </button>
            {scannedResult && (
              <button type="button" onClick={handleClear} className={iconBtn} title="Limpar consulta (Esc)">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualInput.trim()) handleBarcodeScanned(manualInput.trim());
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={manualInput}
              inputMode={isManualTyping ? 'text' : 'none'}
              autoComplete="off"
              onChange={(e) => {
                const val = e.target.value;
                setManualInput(val);
                if (!isManualTyping && val.trim().length >= 6 && /[\s;|]/.test(val)) handleBarcodeScanned(val);
              }}
              placeholder={isManualTyping ? 'Material ou lote…' : 'Bipe a etiqueta do lote'}
              className="w-full h-10 pl-3 pr-9 bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--accent)] rounded-[var(--radius)] text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-3)] placeholder:font-sans outline-none"
            />
            {manualInput && (
              <button
                type="button"
                onClick={() => setManualInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-3)] hover:text-[var(--text)]"
                title="Limpar campo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button type="submit" className={cn(iconBtn, 'h-10 px-3.5')} title="Buscar">
            <Search className="h-4 w-4" />
          </button>
        </form>

        {history.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
            <History className="h-3.5 w-3.5 text-[var(--text-3)] shrink-0" />
            {history.slice(0, 8).map((h) => {
              const on = (loteCode || materialCode) && (h.lote ? up(h.lote) === loteUp : normMat(h.material) === matKey && !loteCode);
              return (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => reopenHistory(h)}
                  className={cn(
                    'h-7 px-2.5 rounded-full border text-[11.5px] font-mono whitespace-nowrap',
                    on
                      ? 'border-[var(--text-3)] bg-[var(--hover)] text-[var(--text)]'
                      : 'border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)]'
                  )}
                >
                  {h.lote || h.material || h.key}
                </button>
              );
            })}
          </div>
        )}

        {/* Câmera */}
        {showCameraDrawer && !scannerActive && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 py-2 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-3)]">Leitura pela câmera</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={processingImage}
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowCameraDrawer(false);
                }}
                className={iconBtn}
              >
                {processingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Foto
              </button>
              <button
                type="button"
                onClick={() => {
                  startScanner();
                  setShowCameraDrawer(false);
                }}
                className={cn(iconBtn, 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)] hover:text-[var(--bg)]')}
              >
                <QrCode className="h-4 w-4" />
                Ao vivo
              </button>
            </div>
          </div>
        )}

        {scannerActive && (
          <div className="mt-2 relative overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-black">
            <div id={scannerContainerId} className="w-full min-h-[220px]" />
            <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
              <button
                type="button"
                onClick={stopScanner}
                className="h-8 px-2.5 rounded bg-black/80 text-white text-xs font-medium border border-white/20 inline-flex items-center gap-1.5"
              >
                <CameraOff className="h-3.5 w-3.5" />
                Fechar
              </button>
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={cn(
                    'h-8 w-8 rounded border inline-flex items-center justify-center',
                    torchOn ? 'bg-[var(--amber)] text-black border-[var(--amber)]' : 'bg-black/80 text-white border-white/20'
                  )}
                  title="Lanterna"
                >
                  {torchOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
                </button>
              )}
            </div>
            {maxZoom > 1 && (
              <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-center gap-2 bg-black/80 p-2 rounded border border-white/15">
                <ZoomOut className="h-4 w-4 text-white/60" />
                <input
                  type="range"
                  min={1}
                  max={maxZoom}
                  step={0.1}
                  value={zoomLevel}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="w-40 accent-[var(--accent)]"
                />
                <ZoomIn className="h-4 w-4 text-white/60" />
                <span className="text-[11px] font-mono text-white w-8">{zoomLevel.toFixed(1)}x</span>
              </div>
            )}
          </div>
        )}

        {cameraError && (
          <p className="mt-2 text-xs text-[var(--red)] flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {cameraError}
          </p>
        )}

        <div id="barcode-file-reader-hidden-view" className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" />
      </div>

      {/* ================= ESTADO INICIAL ================= */}
      {!scannedResult && (
        <div className="py-14 text-center">
          {loadingData ? (
            <p className="text-sm text-[var(--text-3)] inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando estoque…
            </p>
          ) : (
            <>
              <QrCode className="h-6 w-6 mx-auto text-[var(--text-3)]" />
              <p className="mt-3 text-sm font-medium">Bipe a etiqueta do lote</p>
              <p className="mt-1 text-xs text-[var(--text-3)] max-w-xs mx-auto leading-relaxed">
                Saldo, posição, aging e validade do lote aparecem aqui. Também aceita código do material.
              </p>
            </>
          )}
        </div>
      )}

      {/* ================= RESULTADO ================= */}
      {scannedResult && (
        <div className="pt-4 pb-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          {/* ---------- LOTE LIDO ---------- */}
          <section ref={heroRef} className="scroll-mt-40 min-w-0">
            {loteCode ? (
              <>
                <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                  <span>Lote lido</span>
                  {scannedResult.volume ? (
                    <span className="font-mono border border-[var(--border-strong)] rounded px-1 leading-4">vol. {scannedResult.volume}</span>
                  ) : null}
                  {!loteEncontrado && <span className="text-[var(--red)]">· não encontrado</span>}
                </div>

                <div className="flex items-start justify-between gap-3 mt-0.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(loteCode, 'Lote')}
                    className="group min-w-0 text-left"
                    title="Copiar lote"
                  >
                    <h2 className="font-mono text-[30px] sm:text-[34px] leading-tight font-semibold tracking-tight break-all">
                      {loteCode}
                      <Copy className="inline h-4 w-4 ml-2 align-middle text-[var(--text-3)] opacity-60 group-hover:opacity-100" />
                    </h2>
                  </button>
                  {activeLoteItem && (
                    <span
                      className="mt-2 shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium"
                      style={{ borderColor: POS_META[activePos].color, color: POS_META[activePos].color }}
                    >
                      <Dot color={POS_META[activePos].color} />
                      {POS_META[activePos].label}
                    </span>
                  )}
                </div>

                {(materialCode || materialDescription) && (
                  <p className="mt-1 text-sm leading-snug">
                    <button
                      type="button"
                      onClick={() => handleCopy(materialCode, 'Material')}
                      className="font-mono font-medium text-[var(--accent)] mr-2"
                      title="Copiar material"
                    >
                      {materialCode}
                    </button>
                    <span className="text-[var(--text-2)]">{materialDescription}</span>
                  </p>
                )}

                {activeLoteItem && (
                  <>
                    {/* Quantidades e Valor em Estoque */}
                    <div className="mt-4 grid grid-cols-2 border-y border-[var(--border)] py-3">
                      <div className="pr-3">
                        <span className="block text-[11.5px] text-[var(--text-3)]">
                          Saldo do lote · {activePos === 'pes' ? 'PESAGEM' : POS_META[activePos].label}
                        </span>
                        <div className="flex items-baseline">
                          <span className="font-mono text-[34px] sm:text-[40px] leading-none font-semibold tracking-tight">
                            {fmtQ(saldoLote)}
                          </span>
                          <span className="font-mono text-sm text-[var(--text-3)] ml-1.5">{unidadeMedida}</span>
                        </div>
                        {valorMonetarioLote > 0 ? (
                          <span className="block text-[11.5px] font-mono text-[var(--text-2)] mt-1.5 font-medium truncate">
                            Valor: <strong className="text-[var(--text)]">{fmtBRL(valorMonetarioLote)}</strong>
                            {valorUnitario > 0 ? <span className="text-[var(--text-3)] font-sans font-normal"> ({fmtBRL(valorUnitario)}/{unidadeMedida})</span> : ''}
                          </span>
                        ) : (
                          <span className="block text-[11.5px] text-[var(--text-3)] mt-1.5">
                            Saldo disponível no estoque
                          </span>
                        )}
                      </div>
                      <div className="pl-3 border-l border-[var(--border)]">
                        <span className="block text-[11.5px] text-[var(--text-3)]">
                          Material na PESAGEM
                        </span>
                        <div className="flex items-baseline">
                          <span className={cn('font-mono text-[22px] sm:text-[26px] leading-tight font-semibold', saldoLote < 0 && 'text-[var(--red)]')}>
                            {fmtQ(totalPes)}
                          </span>
                          <span className="font-mono text-xs text-[var(--text-3)] ml-1">{unidadeMedida}</span>
                        </div>
                        <span className="block text-[11.5px] text-[var(--text-3)] mt-1">
                          {lotesPes} lote(s) em PES · {fmtQ(totalMaterial)} {unidadeMedida} total
                          {valorMonetarioTotalMaterial > 0 ? ` (${fmtBRL(valorMonetarioTotalMaterial)})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Fatos Técnicos */}
                    <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-y-3 py-3 border-b border-[var(--border)] text-[13px]">
                      <div>
                        <dt className="text-[11.5px] text-[var(--text-3)]">Posição</dt>
                        <dd className="font-mono truncate">{activeLoteItem.posicao_deposito || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] text-[var(--text-3)]">Aging</dt>
                        <dd className="font-mono" style={{ color: aging.color }}>
                          {activeLoteItem.dias_aging ?? '—'} d <span className="font-sans text-xs">· {aging.label}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] text-[var(--text-3)]">Validade</dt>
                        <dd className="font-mono">
                          {activeLoteItem.data_vencimento || '—'}
                          {vencDias !== null && (
                            <span
                              className="font-sans text-xs ml-1"
                              style={{ color: vencDias < 0 ? 'var(--red)' : vencDias <= 30 ? 'var(--amber)' : 'var(--text-3)' }}
                            >
                              {vencDias < 0 ? 'vencido' : `${vencDias} d`}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] text-[var(--text-3)]">Valor do lote</dt>
                        <dd className="font-mono truncate">
                          {valorMonetarioLote > 0 ? (
                            <span className="text-[var(--text)] font-medium">{fmtBRL(valorMonetarioLote)}</span>
                          ) : (
                            <span className="text-[var(--text-3)]">—</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] text-[var(--text-3)]">Tipo est. · últ. mov.</dt>
                        <dd className="font-mono truncate">
                          {activeLoteItem.tipo_estoque || 'Livre'}
                          {activeLoteItem.ultimo_movimento ? <span className="text-[var(--text-3)]"> · {activeLoteItem.ultimo_movimento}</span> : null}
                        </dd>
                      </div>
                    </dl>

                    {otherPositionsOfLote.length > 0 && (
                      <p className="py-2.5 border-b border-[var(--border)] text-xs text-[var(--text-3)]">
                        Este lote também está em{' '}
                        {otherPositionsOfLote.map((r, i) => (
                          <span key={i} className="text-[var(--text-2)]">
                            {i > 0 ? ' · ' : ''}
                            <Dot color={POS_META[posKind(r)].color} className="mr-1 align-middle" />
                            {POS_META[posKind(r)].label}{' '}
                            <span className="font-mono">{fmtQ(num(r.estoque_disponivel))} {r.unidade_medida || unidadeMedida}</span>
                          </span>
                        ))}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              /* ---------- Leitura só de material ---------- */
              <>
                <div className="text-[11.5px] text-[var(--text-3)]">Material lido</div>
                <h2 className="font-mono text-[30px] leading-tight font-semibold">{materialCode || scannedResult.raw}</h2>
                {materialDescription && <p className="text-sm text-[var(--text-2)] mt-0.5">{materialDescription}</p>}
                {allMaterialItems.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 border-y border-[var(--border)] py-3">
                    <div className="pr-3">
                      <span className="block text-[11.5px] text-[var(--text-3)]">Na PESAGEM</span>
                      <span className="font-mono text-[26px] font-semibold leading-tight">{fmtQ(totalPes)}</span>
                      <span className="font-mono text-xs text-[var(--text-3)] ml-1">{unidadeMedida}</span>
                    </div>
                    <div className="px-3 border-l border-[var(--border)]">
                      <span className="block text-[11.5px] text-[var(--text-3)]">Lotes em PES</span>
                      <span className="font-mono text-[26px] font-semibold leading-tight">{lotesPes}</span>
                    </div>
                    <div className="pl-3 border-l border-[var(--border)]">
                      <span className="block text-[11.5px] text-[var(--text-3)]">
                        Total material {valorMonetarioTotalMaterial > 0 ? `· ${fmtBRL(valorMonetarioTotalMaterial)}` : ''}
                      </span>
                      <span className="font-mono text-[20px] font-semibold leading-tight">{fmtQ(totalMaterial)}</span>
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-[var(--text-3)]">Bipe a etiqueta do lote ou toque em um lote da lista.</p>
              </>
            )}

            {/* Alertas */}
            {alerts.length > 0 && (
              <ul className="py-2">
                {alerts.map((a, i) => (
                  <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)_auto] gap-2 items-start py-1.5 text-[13px] leading-snug">
                    <Dot color={toneColor[a.tone]} className="mt-[6px]" />
                    <span className={a.tone === 'info' ? 'text-[var(--text-2)]' : 'text-[var(--text)]'}>{a.text}</span>
                    {a.action && (
                      <button type="button" onClick={a.action.onClick} className="text-xs font-medium text-[var(--accent)] whitespace-nowrap">
                        {a.action.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Nada encontrado */}
            {!activeLoteItem && !allMaterialItems.length && (
              <div className="py-6">
                <p className="text-sm text-[var(--text-2)]">
                  Nenhum lote ou material corresponde a <span className="font-mono text-[var(--text)]">{scannedResult.raw}</span>.
                </p>
                {rawMatches.length > 0 && (
                  <>
                    <p className="mt-4 mb-1 text-xs font-medium text-[var(--text-2)]">Parecidos na base</p>
                    {rawMatches.map((it, i) => (
                      renderLotRow(it, `${it.lote}-${i}`)
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Ações do lote lido (fixas no rodapé no celular) */}
            {activeLoteItem && (
              <div className="sticky bottom-0 z-10 -mx-3 px-3 py-2.5 bg-[var(--bg)] border-t border-[var(--border)] lg:static lg:mx-0 lg:px-0 lg:border-0 lg:pt-1 grid grid-cols-[1fr_1fr_auto] gap-2">
                {primaryIsMove ? (
                  <button
                    type="button"
                    onClick={() => openPipeline(activeLoteItem, ['mover_lt10', 'atualizar_db'])}
                    disabled={isBloquearMigoRunning}
                    className={cn(actBtn, 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]')}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Mover p/ PESAGEM
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openDevolverLido}
                    disabled={isDevolverRunning || saldoLote <= 0}
                    className={cn(actBtn, 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]')}
                  >
                    {isDevolverRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                    Devolver
                  </button>
                )}
                {primaryIsMove ? (
                  <button
                    type="button"
                    onClick={openDevolverLido}
                    disabled={isDevolverRunning || saldoLote <= 0}
                    className={cn(actBtn, 'bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)]')}
                  >
                    <Undo2 className="h-4 w-4" />
                    Devolver
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openPipeline(activeLoteItem, ['bloquear_migo'], saldoLote)}
                    disabled={isBloquearMigoRunning}
                    className={cn(actBtn, 'bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)]')}
                  >
                    {isBloquearMigoRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Bloquear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openPipeline(activeLoteItem, primaryIsMove ? ['bloquear_migo'] : [], saldoLote)}
                  disabled={isBloquearMigoRunning}
                  className={cn(actBtn, 'w-11 lg:w-auto bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)]')}
                  title="Mais ações no SAP (pipeline)"
                >
                  <Play className="h-4 w-4" />
                  <span className="hidden lg:inline">SAP</span>
                </button>
              </div>
            )}
          </section>

          {/* ---------- SECUNDÁRIO: OUTROS LOTES E REMESSAS ---------- */}
          {allMaterialItems.length > 0 && (
            <aside className="min-w-0">
              <div className="flex items-center gap-4 border-b border-[var(--border)]">
                {(['lotes', 'remessas'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSecTab(t)}
                    className={cn(
                      'relative h-9 text-[13px] font-medium inline-flex items-center gap-1.5',
                      secTab === t ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
                    )}
                  >
                    {t === 'lotes' ? (loteCode ? 'Outros lotes' : 'Lotes do material') : 'Remessas abertas'}
                    <span className="font-mono text-[11px] text-[var(--text-3)]">{t === 'lotes' ? otherLots.length : materialRemessas.length}</span>
                    {secTab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--text)]" />}
                  </button>
                ))}
              </div>

              {secTab === 'lotes' ? (
                <>
                  <p className="py-2 text-[11.5px] text-[var(--text-3)]">
                    PESAGEM primeiro, depois por vencimento · toque para focar no lote
                  </p>
                  {otherLots.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--text-3)]">Nenhum outro lote deste material no estoque.</p>
                  ) : (
                    <>
                      {visibleLots.map((it, i) => (
                        renderLotRow(it, `${it.lote}-${it.posicao_deposito}-${i}`)
                      ))}
                      {otherLots.length > visibleLots.length && (
                        <button
                          type="button"
                          onClick={() => setShowAllLots(true)}
                          className="w-full h-10 text-xs font-medium text-[var(--accent)] inline-flex items-center justify-center gap-1"
                        >
                          Ver todos ({otherLots.length}) <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="py-2 text-[11.5px] text-[var(--text-3)] flex justify-between gap-2">
                    <span>
                      Pedem <span className="font-mono text-[var(--text-2)]">{fmtQ(remessasQtd)} {unidadeMedida}</span> · PESAGEM tem{' '}
                      <span className="font-mono text-[var(--text-2)]">{fmtQ(totalPes)} {unidadeMedida}</span>
                    </span>
                    {onNavigateToTab && materialRemessas.length > 0 && (
                      <button type="button" onClick={() => onNavigateToTab('remessas')} className="text-[var(--accent)] whitespace-nowrap">
                        Ver todas
                      </button>
                    )}
                  </p>
                  {materialRemessas.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--text-3)]">Nenhuma remessa aberta para este material.</p>
                  ) : (
                    materialRemessas.map((r, i) => (
                      <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center px-1 py-2.5 border-b border-[var(--border)]">
                        <span className="min-w-0">
                          <span className="font-mono text-[13px] font-medium">{r.numero_remessa}</span>
                          <span className="text-[11.5px] text-[var(--text-3)]"> · item {r.item}</span>
                          <span className="block text-[11.5px] text-[var(--text-3)] font-mono">
                            {r.data_disponibilidade || r.data_picking || '—'}
                          </span>
                        </span>
                        <span className="font-mono text-[13px] text-right whitespace-nowrap">
                          {fmtQ(num(r.quantidade))}
                          <span className="text-[11px] text-[var(--text-3)] ml-1">{r.unidade_medida || 'KG'}</span>
                        </span>
                      </div>
                    ))
                  )}
                </>
              )}
            </aside>
          )}
        </div>
      )}

      {/* ================= DEVOLVER (/nZWM296) ================= */}
      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent className="sm:max-w-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px] max-h-[92vh] flex flex-col">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] text-left">
            <DialogTitle className="text-[15px] font-semibold">Devolver ao almoxarifado</DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-3)]">
              /nZWM296 · divida a quantidade em volumes, se necessário
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 pb-3 border-b border-[var(--border)]">
              <span className="font-mono text-[15px] font-semibold">{devolverLote}</span>
              <span className="font-mono text-sm text-right">
                {fmtQ(devolverSaldoTotal)} <span className="text-[var(--text-3)] text-xs">{devolverUnidade}</span>
              </span>
              <span className="text-xs text-[var(--text-3)] truncate">
                <span className="font-mono text-[var(--text-2)]">{devolverMaterial}</span> · {devolverDescricao}
              </span>
              <span className="text-[11px] text-[var(--text-3)] text-right">saldo do lote</span>
            </div>

            <div className="grid grid-cols-[24px_minmax(0,1fr)_72px_28px] gap-2 items-center pt-3 pb-1 text-[11px] text-[var(--text-3)]">
              <span>#</span>
              <span>Qtd. por volume</span>
              <span className="text-center">Volumes</span>
              <span />
            </div>
            {devolverVolumes.map((v, idx) => (
              <div key={v.id} className="grid grid-cols-[24px_minmax(0,1fr)_72px_28px] gap-2 items-center py-1">
                <span className="font-mono text-xs text-[var(--text-3)]">{idx + 1}</span>
                <div className="flex items-center h-10 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] focus-within:border-[var(--accent)]">
                  <input
                    value={v.quantidade}
                    onChange={(e) => handleUpdateVolume(idx, 'quantidade', e.target.value)}
                    inputMode="decimal"
                    placeholder="0,000"
                    className="flex-1 min-w-0 bg-transparent outline-none px-2.5 font-mono text-sm text-right"
                  />
                  <span className="pr-2.5 font-mono text-xs text-[var(--text-3)]">{devolverUnidade}</span>
                </div>
                <input
                  value={v.volume}
                  onChange={(e) => handleUpdateVolume(idx, 'volume', e.target.value)}
                  inputMode="numeric"
                  className="h-10 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] outline-none focus:border-[var(--accent)] font-mono text-sm text-center"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveVolume(idx)}
                  disabled={devolverVolumes.length === 1}
                  className="h-8 w-8 inline-flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--red)] disabled:opacity-30"
                  title="Remover volume"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className="flex flex-wrap gap-x-4 gap-y-1 py-2">
              <button type="button" onClick={handleAddVolume} className="text-xs font-medium text-[var(--accent)] inline-flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Adicionar volume
              </button>
              {saldoRestante > 0.0001 && (
                <button type="button" onClick={handleFillRestante} className="text-xs font-medium text-[var(--accent)]">
                  Usar restante ({fmtQ(saldoRestante)} {devolverUnidade})
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-[var(--text-3)]">
                  Total · {totalVolumesCount} volume(s)
                </span>
                <span className={cn('font-mono text-sm font-medium', isOverSaldo && 'text-[var(--red)]')}>
                  {fmtQ(somaVolumes)} / {fmtQ(devolverSaldoTotal)} {devolverUnidade}
                </span>
              </div>
              <div className="h-1.5 mt-2 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, devolverSaldoTotal ? (somaVolumes / devolverSaldoTotal) * 100 : 0)}%`,
                    background: isOverSaldo ? 'var(--red)' : 'var(--text-2)',
                  }}
                />
              </div>
              {isOverSaldo && <p className="mt-1.5 text-xs text-[var(--red)]">A soma passa do saldo do lote.</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setDevolverOpen(false)}
              className="h-10 px-4 rounded-[var(--radius)] border border-[var(--border-strong)] text-sm text-[var(--text-2)] hover:text-[var(--text)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDevolver}
              disabled={isDevolverRunning || isOverSaldo || somaVolumes <= 0 || hasInvalidVolume}
              className="h-10 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" /> Devolver {fmtQ(somaVolumes)} {devolverUnidade}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= PIPELINE SAP ================= */}
      <Dialog open={bloquearMigoOpen} onOpenChange={(o) => !isBloquearMigoRunning && setBloquearMigoOpen(o)}>
        <DialogContent className="sm:max-w-xl bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] p-0 gap-0 rounded-[8px] max-h-[92vh] flex flex-col">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] text-left">
            <DialogTitle className="text-[15px] font-semibold">Execução no SAP</DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-3)]">
              Ações executadas em sequência no SAP GUI via Planilha Sync
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5">
            {/* Item */}
            <div className="py-3 border-b border-[var(--border)]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[15px] font-semibold">{bloquearSelectedItems[0]?.lote || '—'}</span>
                <span className="font-mono text-xs text-[var(--accent)]">{bloquearSelectedItems[0]?.material}</span>
              </div>
              <p className="text-xs text-[var(--text-3)] truncate">{bloquearSelectedItems[0]?.descricao}</p>
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2 mt-2.5">
                <label className="text-[11px] text-[var(--text-3)]">
                  Quantidade
                  <input
                    value={bloquearSelectedItems[0]?.quantidade ?? ''}
                    onChange={(e) => updateItem('quantidade', e.target.value)}
                    disabled={isBloquearMigoRunning}
                    inputMode="decimal"
                    placeholder="0,000"
                    className="mt-1 w-full h-10 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] outline-none focus:border-[var(--accent)] font-mono text-sm text-right text-[var(--text)]"
                  />
                </label>
                <label className="text-[11px] text-[var(--text-3)]">
                  UMB
                  <input
                    value={bloquearSelectedItems[0]?.unidade ?? ''}
                    onChange={(e) => updateItem('unidade', e.target.value.toUpperCase())}
                    disabled={isBloquearMigoRunning}
                    className="mt-1 w-full h-10 px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] outline-none focus:border-[var(--accent)] font-mono text-sm uppercase text-center text-[var(--text)]"
                  />
                </label>
              </div>
            </div>

            {/* Modo MIGO + presets */}
            <div className="py-3 border-b border-[var(--border)] space-y-2.5">
              <div className="grid grid-cols-2 border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden">
                {(['bloquear', 'desbloquear'] as const).map((m) => {
                  const on =
                    m === 'desbloquear'
                      ? macroPipeline.some((s) => s.actionType === 'desbloquear_migo')
                      : macroPipeline.some((s) => s.actionType === 'bloquear_migo');
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={isBloquearMigoRunning}
                      onClick={() => handleToggleMigoMode(m)}
                      className={cn(
                        'h-10 text-[13px] font-medium inline-flex items-center justify-center gap-1.5',
                        m === 'desbloquear' && 'border-l border-[var(--border-strong)]',
                        on ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-3)]'
                      )}
                    >
                      {m === 'bloquear' ? 'Bloquear' : 'Desbloquear'}
                      <span className="font-mono text-[11px] text-[var(--text-3)]">{m === 'bloquear' ? 'Y84' : 'Y83'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    disabled={isBloquearMigoRunning}
                    onClick={() => {
                      setMacroPipeline(makeSteps(p.steps));
                      setRunState({});
                    }}
                    className={cn(
                      'h-8 px-3 rounded-full border text-xs whitespace-nowrap',
                      presetKey(p.steps) === pipelineKey
                        ? 'border-[var(--text-3)] bg-[var(--hover)] text-[var(--text)]'
                        : 'border-[var(--border-strong)] text-[var(--text-2)]'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Etapas */}
            <div className="py-2">
              {macroPipeline.length === 0 && (
                <p className="py-4 text-center text-xs text-[var(--text-3)]">Pipeline vazio. Escolha um atalho ou adicione ações abaixo.</p>
              )}
              {macroPipeline.map((step, idx) => {
                const def = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
                if (!def) return null;
                const st = runState[step.id];
                return (
                  <div key={step.id} className="py-2 border-b border-[var(--border)] last:border-0">
                    <div className="grid grid-cols-[26px_minmax(0,1fr)_auto] gap-2.5 items-center">
                      <span
                        className={cn(
                          'h-6 w-6 rounded-full border inline-flex items-center justify-center font-mono text-[11px]',
                          !st && 'border-[var(--border-strong)] text-[var(--text-2)]',
                          st?.s === 'run' && 'border-[var(--accent)] text-[var(--accent)]',
                          st?.s === 'ok' && 'border-[var(--green)] bg-[var(--green)] text-[var(--bg)]',
                          st?.s === 'fail' && 'border-[var(--red)] bg-[var(--red)] text-white',
                          st?.s === 'skip' && 'border-dashed border-[var(--border-strong)] text-[var(--text-3)]'
                        )}
                      >
                        {st?.s === 'run' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : st?.s === 'ok' ? (
                          <Check className="h-3 w-3" />
                        ) : st?.s === 'fail' ? (
                          '!'
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium truncate">{def.label}</span>
                        <span className={cn('block text-[11.5px] truncate', st?.s === 'fail' ? 'text-[var(--red)]' : 'text-[var(--text-3)]')}>
                          {st?.msg || def.description}
                        </span>
                      </span>
                      {!isBloquearMigoRunning && (
                        <span className="flex items-center">
                          <button type="button" disabled={idx === 0} onClick={() => moveStep(idx, idx - 1)} className="h-8 w-8 inline-flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-25" title="Subir">
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={idx === macroPipeline.length - 1} onClick={() => moveStep(idx, idx + 1)} className="h-8 w-8 inline-flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-25" title="Descer">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => removeStep(idx)} className="h-8 w-8 inline-flex items-center justify-center text-[var(--text-3)] hover:text-[var(--red)]" title="Remover">
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      )}
                    </div>
                    {step.actionType === 'mover_lt10' && (
                      <div className="mt-2 ml-[36px] flex gap-1.5 overflow-x-auto no-scrollbar">
                        {PREDEFINED_MOVER_ROUTES.map((route) => {
                          const on = (step.routeId || 'pes_pesagem') === route.id;
                          return (
                            <button
                              key={route.id}
                              type="button"
                              disabled={isBloquearMigoRunning}
                              onClick={() => setStepRoute(step.id, route.id)}
                              className={cn(
                                'h-7 px-2.5 rounded border font-mono text-[11px] whitespace-nowrap',
                                on ? 'border-[var(--accent)] text-[var(--text)] bg-[var(--accent-weak)]' : 'border-[var(--border-strong)] text-[var(--text-3)]'
                              )}
                            >
                              {route.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!isBloquearMigoRunning && (
              <div className="pb-3">
                <p className="text-[11px] text-[var(--text-3)] mb-1.5">Adicionar ação</p>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_MACROS.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => addStep(m.type)}
                      className="h-8 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] text-xs text-[var(--text-2)] hover:text-[var(--text)] inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> {m.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="pb-3 text-[11.5px] text-[var(--text-3)] flex items-center gap-2">
              <Dot color="var(--amber)" /> SAP GUI aberto e Planilha Sync conectado nesta estação.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-3)] font-mono">
              {macroPipeline.length} etapa{macroPipeline.length === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isBloquearMigoRunning}
                onClick={() => setBloquearMigoOpen(false)}
                className="h-10 px-4 rounded-[var(--radius)] border border-[var(--border-strong)] text-sm text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecutePipeline}
                disabled={isBloquearMigoRunning || macroPipeline.length === 0}
                className="h-10 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                {isBloquearMigoRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isBloquearMigoRunning ? 'Executando…' : 'Executar no SAP'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
