'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { AgingData, RemessaData } from '@/types/aging';
import { fetchAgingData, fetchRemessas, triggerSapAutomation, checkSapAutomationStatus } from '@/lib/dashpesagem-api';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  QrCode,
  Camera,
  CameraOff,
  Search,
  Package,
  Layers,
  MapPin,
  Clock,
  AlertTriangle,
  RotateCcw,
  Smartphone,
  ChevronRight,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  ZoomOut,
  Loader2,
  Undo2,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Sparkles,
  ArrowRightLeft,
  RefreshCw,
  ChevronUp,
  ArrowDown,
  X,
  GripVertical,
  Play,
} from 'lucide-react';

interface ConsultaRapidaViewProps {
  agingData?: AgingData[];
  remessas?: RemessaData[];
  currentUserEmail?: string;
  onNavigateToTab?: (tab: string) => void;
  isEmbedded?: boolean;
}

export function ConsultaRapidaView({
  agingData: initialAging,
  remessas: initialRemessas,
  currentUserEmail,
  onNavigateToTab,
  isEmbedded = false,
}: ConsultaRapidaViewProps) {
  const [agingList, setAgingList] = useState<AgingData[]>(initialAging || []);
  const [remessasList, setRemessasList] = useState<RemessaData[]>(initialRemessas || []);
  const [loadingData, setLoadingData] = useState<boolean>(!initialAging || initialAging.length === 0);

  // Devolver Modal State
  const [devolverOpen, setDevolverOpen] = useState<boolean>(false);
  const [devolverMaterial, setDevolverMaterial] = useState<string>('');
  const [devolverDescricao, setDevolverDescricao] = useState<string>('');
  const [devolverLote, setDevolverLote] = useState<string>('');
  const [devolverUnidade, setDevolverUnidade] = useState<string>('KG');
  const [devolverSaldoTotal, setDevolverSaldoTotal] = useState<number>(0);
  const [devolverVolumes, setDevolverVolumes] = useState<DevolverVolumeItem[]>([
    { id: '1', quantidade: '', volume: '1' },
  ]);
  const [isDevolverRunning, setIsDevolverRunning] = useState<boolean>(false);

  // Bloquear/Desbloquear Modal State & Macro Pipeline
  const [bloquearMigoOpen, setBloquearMigoOpen] = useState<boolean>(false);
  const [bloquearSelectedItems, setBloquearSelectedItems] = useState<BloquearItemParam[]>([]);
  const [macroPipeline, setMacroPipeline] = useState<MacroActionItem[]>([
    { id: 'step-1', actionType: 'bloquear_migo' },
  ]);
  const [isBloquearMigoRunning, setIsBloquearMigoRunning] = useState<boolean>(false);
  const [draggedMacroIndex, setDraggedMacroIndex] = useState<number | null>(null);

  // Scanner State
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<ParsedBarcode | null>(null);
  const [processingImage, setProcessingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scanner HTML element ref & Html5Qrcode instance
  const scannerContainerId = 'mobile-barcode-reader-view';
  const html5QrCodeRef = useRef<any>(null);

  // Buffer para coletor Bluetooth
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sincroniza props se atualizarem
  useEffect(() => {
    if (initialAging && initialAging.length > 0) {
      setAgingList(initialAging);
      setLoadingData(false);
    }
  }, [initialAging]);

  useEffect(() => {
    if (initialRemessas && initialRemessas.length > 0) {
      setRemessasList(initialRemessas);
    }
  }, [initialRemessas]);

  // Carrega dados de estoque e remessas caso não tenham sido passados via props
  const loadStockData = async () => {
    if (initialAging && initialAging.length > 0) return;
    setLoadingData(true);
    try {
      const [aging, remessas] = await Promise.all([
        fetchAgingData().catch(() => []),
        fetchRemessas().catch(() => []),
      ]);
      setAgingList(aging);
      setRemessasList(remessas);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, []);

  // Foca automaticamente no campo para facilitar coletores
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Ouvinte global de teclas para Coletor Bluetooth / Scanner Físico (Modo Teclado HID)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeDiff > 400 && barcodeBufferRef.current.length > 0) {
        barcodeBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const textToProcess = barcodeBufferRef.current.trim() || (document.activeElement === inputRef.current ? manualInput.trim() : '');
        if (textToProcess) {
          e.preventDefault();
          handleBarcodeScanned(textToProcess);
          barcodeBufferRef.current = '';
          if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
          return;
        }
      }

      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;

        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
        }

        bufferTimeoutRef.current = setTimeout(() => {
          if (barcodeBufferRef.current.length >= 4) {
            const buffered = barcodeBufferRef.current.trim();
            handleBarcodeScanned(buffered);
            barcodeBufferRef.current = '';
          }
        }, 250);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
    };
  }, [manualInput]);

  // Controles de câmera
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(1);

  // Iniciar e Parar o leitor de câmera
  const startScanner = async () => {
    setCameraError(null);
    setScannerActive(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch (e) {
          // Ignora
        }
      }

      const instance = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = instance;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.floor(viewfinderWidth * 0.90);
        const height = Math.min(Math.floor(viewfinderHeight * 0.5), 180);
        return { width: Math.max(width, 240), height: Math.max(height, 100) };
      };

      await instance.start(
        { facingMode: 'environment' },
        {
          fps: 25,
          qrbox: qrboxFunction,
          aspectRatio: 1.777778,
          disableFlip: false,
        },
        (decodedText: string) => {
          handleBarcodeScanned(decodedText);
          stopScanner();
        },
        () => {}
      );

      try {
        const capabilities: any = instance.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
        if (capabilities && capabilities.zoom) {
          setMaxZoom(capabilities.zoom.max || 1);
        }
      } catch (e) {
        // Ignora
      }
    } catch (err: any) {
      console.error('Erro ao iniciar câmera:', err);
      setCameraError(
        'Não foi possível acessar a câmera. Verifique se concedeu permissão HTTPS.'
      );
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
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
      const nextState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      toast.error('Não foi possível alternar a lanterna');
    }
  };

  const handleZoomChange = async (newZoom: number) => {
    if (!html5QrCodeRef.current) return;
    try {
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ zoom: newZoom }],
      });
      setZoomLevel(newZoom);
    } catch (err) {
      // Falha silenciosa
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    const toastId = toast.loading('Lendo etiqueta da foto HD...');

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      let tempContainer = document.getElementById('barcode-file-reader-hidden-view');
      if (!tempContainer) {
        tempContainer = document.createElement('div');
        tempContainer.id = 'barcode-file-reader-hidden-view';
        tempContainer.style.display = 'none';
        document.body.appendChild(tempContainer);
      }

      const fileScanner = new Html5Qrcode('barcode-file-reader-hidden-view', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      try {
        const decodedText = await fileScanner.scanFile(file, true);
        toast.dismiss(toastId);
        toast.success('Código de barras identificado com sucesso!');
        handleBarcodeScanned(decodedText);
        await fileScanner.clear();
      } catch (scanErr) {
        toast.dismiss(toastId);
        toast.error('Nenhum código legível encontrado na foto. Tente aproximar da etiqueta.');
        await fileScanner.clear();
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Falha ao processar arquivo de imagem');
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBarcodeScanned = (rawText: string) => {
    if (!rawText || rawText.trim() === '') return;

    try {
      const parsed = parseBarcode(rawText);
      setScannedResult(parsed);
      setManualInput(rawText);

      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([80, 40, 80]);
        }
      } catch (e) {
        // Ignora
      }

      const foundStock = agingList.some(
        (a) =>
          (parsed.material && a.material.replace(/^0+/, '') === parsed.material.replace(/^0+/, '')) ||
          (parsed.lote && a.lote.toUpperCase() === parsed.lote.toUpperCase())
      );

      if (foundStock) {
        toast.success(`Etiqueta identificada: Lote ${parsed.lote || parsed.material}`, {
          icon: '🏷️',
        });
      } else {
        toast('Material/Lote lido, buscando dados...', {
          icon: '🔍',
        });
      }
    } catch (e) {
      setScannedResult({
        raw: rawText,
        material: rawText.trim(),
        lote: '',
        quantidade: null,
      });
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleBarcodeScanned(manualInput.trim());
    }
  };

  const handleClear = () => {
    setScannedResult(null);
    setManualInput('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Itens filtrados pelo lote ou material lido
  const loteItems = useMemo(() => {
    if (!scannedResult) return [];

    let filtered = agingList;

    if (scannedResult.lote) {
      const cleanLot = scannedResult.lote.trim().toUpperCase();
      const byLote = filtered.filter(
        (item) => String(item.lote).trim().toUpperCase() === cleanLot
      );
      if (byLote.length > 0) return byLote;
    }

    if (scannedResult.material) {
      const cleanMat = scannedResult.material.trim().replace(/^0+/, '');
      return filtered.filter(
        (item) => String(item.material).trim().replace(/^0+/, '') === cleanMat
      );
    }

    const raw = scannedResult.raw.trim().toUpperCase();
    return filtered.filter(
      (item) =>
        String(item.lote).trim().toUpperCase().includes(raw) ||
        String(item.material).trim().includes(raw) ||
        String(item.texto_breve_material).toUpperCase().includes(raw)
    );
  }, [scannedResult, agingList]);

  // Itens de outros lotes do mesmo material
  const allMaterialItems = useMemo(() => {
    if (!scannedResult) return [];

    const matCode =
      loteItems[0]?.material ||
      scannedResult.material ||
      '';

    if (!matCode) return [];

    const cleanMat = matCode.trim().replace(/^0+/, '');
    return agingList.filter(
      (item) => String(item.material).trim().replace(/^0+/, '') === cleanMat
    );
  }, [scannedResult, loteItems, agingList]);

  const totalEstoqueLote = useMemo(() => {
    return loteItems.reduce((acc, curr) => acc + (Number(curr.estoque_disponivel) || 0), 0);
  }, [loteItems]);

  const materialCode = loteItems[0]?.material || scannedResult?.material || '';
  const materialDescription =
    loteItems[0]?.texto_breve_material ||
    allMaterialItems[0]?.texto_breve_material ||
    'Material lido via etiqueta';
  // Importante: o lote exibido/considerado "lido" deve vir exclusivamente do que foi
  // efetivamente escaneado/digitado, nunca "adivinhado" a partir do primeiro item da
  // lista. Uma busca apenas por código de material deve listar todos os lotes em aberto.
  const loteCode = (scannedResult?.lote || '').trim();
  const loteEncontradoNoEstoque = useMemo(() => {
    if (!loteCode) return true;
    const cleanLot = loteCode.toUpperCase();
    return agingList.some((item) => String(item.lote).trim().toUpperCase() === cleanLot);
  }, [loteCode, agingList]);
  const unidadeMedida = loteItems[0]?.unidade_medida || allMaterialItems[0]?.unidade_medida || 'KG';

  const formatAgingDays = (days?: number) => {
    if (days === undefined || days === null) return <span className="text-[var(--text-3)] font-mono">-</span>;
    if (days >= 15) {
      return <span className="text-[var(--red)] font-bold font-mono">{days}d (Crítico)</span>;
    }
    if (days >= 7) {
      return <span className="text-[var(--amber)] font-bold font-mono">{days}d (Alerta)</span>;
    }
    return <span className="text-[var(--green)] font-bold font-mono">{days}d (Normal)</span>;
  };

  const materialRemessas = useMemo(() => {
    if (!materialCode) return [];
    const matClean = materialCode.trim().replace(/^0+/, '');
    return remessasList.filter(
      (r) => r.material.trim().replace(/^0+/, '') === matClean
    );
  }, [remessasList, materialCode]);

  // Lógica de Devolver Fracionado
  const parseQtdNumber = (val: string): number => {
    if (!val) return 0;
    const cleaned = String(val).trim().replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const somaVolumes = useMemo(() => {
    return (
      Math.round(
        devolverVolumes.reduce((acc, v) => {
          const qtd = parseQtdNumber(v.quantidade);
          const vol = parseQtdNumber(v.volume);
          const mult = vol > 0 ? vol : 1;
          return acc + (qtd * mult);
        }, 0) * 1000
      ) / 1000
    );
  }, [devolverVolumes]);

  const totalVolumesCount = useMemo(() => {
    return devolverVolumes.reduce((acc, v) => {
      const vol = parseQtdNumber(v.volume);
      return acc + (vol > 0 ? vol : 1);
    }, 0);
  }, [devolverVolumes]);

  const saldoRestante = Math.max(0, Math.round((devolverSaldoTotal - somaVolumes) * 1000) / 1000);
  const isOverSaldo = somaVolumes > devolverSaldoTotal + 0.0001;

  const handleOpenDevolver = (
    mat: string,
    lot: string,
    desc: string,
    unidade: string,
    saldoTotal: number
  ) => {
    setDevolverMaterial(mat);
    setDevolverLote(lot);
    setDevolverDescricao(desc);
    setDevolverUnidade(unidade || 'KG');
    setDevolverSaldoTotal(saldoTotal);

    const saldoFormatted = saldoTotal > 0
      ? saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false })
      : '';

    setDevolverVolumes([
      { id: String(Date.now()), quantidade: saldoFormatted, volume: '1' },
    ]);
    setDevolverOpen(true);
  };

  const handleAddVolume = () => {
    setDevolverVolumes((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        quantidade: '',
        volume: '1',
      },
    ]);
  };

  const handleRemoveVolume = (idx: number) => {
    setDevolverVolumes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateVolume = (
    idx: number,
    field: 'quantidade' | 'volume',
    value: string
  ) => {
    setDevolverVolumes((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleFillRestante = () => {
    if (saldoRestante <= 0.0001) return;
    const restanteStr = saldoRestante.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });

    setDevolverVolumes((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && parseQtdNumber(prev[lastIdx].quantidade) === 0) {
        const copy = [...prev];
        copy[lastIdx] = { ...copy[lastIdx], quantidade: restanteStr };
        return copy;
      }
      return [
        ...prev,
        {
          id: String(Date.now()),
          quantidade: restanteStr,
          volume: '1',
        },
      ];
    });
  };

  const handleConfirmDevolver = async () => {
    if (!devolverMaterial || !devolverLote || devolverVolumes.length === 0) return;

    const hasInvalid = devolverVolumes.some((v) => !v.quantidade.trim() || parseQtdNumber(v.quantidade) <= 0);
    if (hasInvalid) {
      toast.error('Preencha a quantidade válida de todos os volumes.');
      return;
    }

    if (isOverSaldo) {
      toast.error('A soma dos volumes ultrapassa o saldo disponível do lote!');
      return;
    }

    setDevolverOpen(false);
    setIsDevolverRunning(true);
    const countVolumes = devolverVolumes.length;
    const toastId = toast.loading(`Enviando devolução de ${devolverMaterial} (${countVolumes} volume(s)) ao Planilha Sync...`);

    const vbsCode = generateDevolverZwm296Vbs(devolverMaterial, devolverLote, devolverVolumes);

    try {
      const res = await triggerSapAutomation('devolver', currentUserEmail || 'Mobile / Consulta', vbsCode);
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar devolução: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsDevolverRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading(`Aguardando execução do script de devolução (/nzwm296) no SAP...`, { id: toastId });

      let attempts = 0;
      const maxAttempts = 40;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast.success(`Devolução executada com sucesso no SAP para o lote ${devolverLote}!`, { id: toastId, icon: '📦' });
            loadStockData();
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast.error(`Execução no SAP falhou: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId, icon: '⚠️' });
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsDevolverRunning(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsDevolverRunning(false);
    }
  };

  // Lógica de Bloquear/Desbloquear MIGO / Pipeline de Macros
  const handleOpenBloquear = (
    mat: string,
    lot: string,
    quantidade: number | string,
    unidade: string,
    descricao?: string
  ) => {
    const qtdStr = typeof quantidade === 'number'
      ? (quantidade > 0 ? quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false }) : '')
      : String(quantidade || '');

    setBloquearSelectedItems([
      {
        material: mat,
        lote: lot,
        quantidade: qtdStr,
        unidade: unidade || 'KG',
        descricao: descricao || materialDescription,
      },
    ]);
    setMacroPipeline([{ id: `step-${Date.now()}`, actionType: 'bloquear_migo' }]);
    setBloquearMigoOpen(true);
  };

  const handleToggleMigoMode = (mode: 'bloquear' | 'desbloquear') => {
    const targetType = mode === 'bloquear' ? 'bloquear_migo' : 'desbloquear_migo';
    setMacroPipeline((prev) => {
      const hasMigo = prev.some((m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo');
      if (!hasMigo) {
        return [{ id: `step-${Date.now()}`, actionType: targetType }, ...prev];
      }
      return prev.map((m) => {
        if (m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo') {
          return { ...m, actionType: targetType };
        }
        return m;
      });
    });
  };

  const handleUpdateSingleBloquearItem = (field: keyof BloquearItemParam, value: string) => {
    setBloquearSelectedItems((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[0] = { ...copy[0], [field]: value };
      return copy;
    });
  };

  const handleAddMacroToPipeline = (actionType: MacroActionType) => {
    setMacroPipeline((prev) => [
      ...prev,
      { id: `${actionType}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, actionType },
    ]);
  };

  const handleRemoveMacroFromPipeline = (index: number) => {
    setMacroPipeline((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveMacroInPipeline = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= macroPipeline.length) return;
    setMacroPipeline((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleUpdateStepRoute = (stepId: string, routeId: string) => {
    setMacroPipeline((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, routeId } : s))
    );
  };

  const handleApplyMacroPreset = (presetTypes: MacroActionType[]) => {
    setMacroPipeline(
      presetTypes.map((actionType, i) => ({
        id: `${actionType}-${Date.now()}-${i}`,
        actionType,
        routeId: actionType === 'mover_lt10' ? 'pes_pesagem' : undefined,
      }))
    );
  };

  const executeSapJobAndWait = async (
    action: string,
    user: string,
    vbsCode?: string,
    maxSeconds = 60
  ): Promise<{ success: boolean; message?: string }> => {
    return new Promise(async (resolve) => {
      try {
        const res = await triggerSapAutomation(action, user, vbsCode);
        if (!res.success || !res.job) {
          return resolve({ success: false, message: res.error || 'Erro ao criar solicitação' });
        }

        const jobId = res.job.id;
        let attempts = 0;
        const maxAttempts = Math.ceil(maxSeconds / 2);

        const interval = setInterval(async () => {
          attempts++;
          try {
            const statusJob = await checkSapAutomationStatus(jobId);
            if (statusJob?.status === 'completed') {
              clearInterval(interval);
              return resolve({ success: true, message: statusJob.result_message });
            } else if (statusJob?.status === 'failed') {
              clearInterval(interval);
              return resolve({ success: false, message: statusJob.result_message || 'Falha na execução do SAP' });
            } else if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({ success: false, message: 'Tempo limite excedido aguardando resposta do SAP' });
            }
          } catch (e: any) {
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({ success: false, message: e?.message || 'Erro de comunicação' });
            }
          }
        }, 2000);
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Erro inesperado' });
      }
    });
  };

  const handleExecuteBloquearMacroPipeline = async () => {
    if (macroPipeline.length === 0) {
      toast.error('Adicione ao menos uma macro ao pipeline de execução.');
      return;
    }

    const hasBloquearOrDesbloquear = macroPipeline.some(
      (m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo'
    );
    if (hasBloquearOrDesbloquear) {
      if (bloquearSelectedItems.length === 0) return;
      const hasInvalid = bloquearSelectedItems.some(
        (it) => !it.material.trim() || !it.lote.trim() || !it.quantidade.trim()
      );
      if (hasInvalid) {
        toast.error('Preencha os campos obrigatórios (Material, Lote e Quantidade).');
        return;
      }
    }

    setBloquearMigoOpen(false);
    setIsBloquearMigoRunning(true);
    const totalSteps = macroPipeline.length;
    const countItems = bloquearSelectedItems.length;
    const toastId = toast.loading(`Iniciando pipeline de ${totalSteps} etapa(s) no SAP...`);

    try {
      for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
        const step = macroPipeline[stepIdx];
        const stepNumber = stepIdx + 1;
        const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
        const label = macroDef?.shortLabel || step.actionType;

        toast.loading(`[${stepNumber}/${totalSteps}] Executando: ${label}...`, { id: toastId });

        let res: { success: boolean; message?: string };

        if (step.actionType === 'bloquear_migo') {
          const vbsCode = generateBloquearMigoVbs(bloquearSelectedItems);
          res = await executeSapJobAndWait(
            'bloquear_migo',
            currentUserEmail || 'Mobile / Consulta',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'desbloquear_migo') {
          const vbsCode = generateDesbloquearMigoVbs(bloquearSelectedItems);
          res = await executeSapJobAndWait(
            'desbloquear_migo',
            currentUserEmail || 'Mobile / Consulta',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'mover_lt10') {
          const targetRoute = PREDEFINED_MOVER_ROUTES.find((r) => r.id === (step.routeId || 'pes_pesagem')) || PREDEFINED_MOVER_ROUTES[0];
          const moverItemsParam: MoverItemParam[] = bloquearSelectedItems.map((it) => ({
            material: it.material,
            lote: it.lote,
            quantidade: it.quantidade,
            unidade: it.unidade,
            depositoOrigem: it.depositoOrigem || 'PES',
            descricao: it.descricao,
          }));
          const vbsCode = generateMoverLt10Vbs(moverItemsParam, { tipo: targetRoute.tipo, posicao: targetRoute.posicao });
          res = await executeSapJobAndWait(
            'mover_lt10',
            currentUserEmail || 'Mobile / Consulta',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'mover_ajuste') {
          res = await executeSapJobAndWait(
            'movermigo',
            currentUserEmail || 'Mobile / Consulta',
            undefined,
            60
          );
        } else if (step.actionType === 'atualizar_db') {
          res = await executeSapJobAndWait(
            'atualizar_db',
            currentUserEmail || 'Mobile / Consulta',
            undefined,
            180
          );
        } else if (step.actionType === 'devolver') {
          const firstMat = bloquearSelectedItems[0]?.material || '';
          const firstLot = bloquearSelectedItems[0]?.lote || '';
          const vbsCode = generateDevolverZwm296Vbs(
            firstMat,
            firstLot,
            bloquearSelectedItems.map((it, idx) => ({
              quantidade: it.quantidade,
              volume: String(idx + 1),
            }))
          );
          res = await executeSapJobAndWait(
            'devolver',
            currentUserEmail || 'Mobile / Consulta',
            vbsCode,
            90
          );
        } else {
          res = { success: true };
        }

        if (!res.success) {
          toast.error(`Falha na etapa [${stepNumber}/${totalSteps} - ${label}]: ${res.message || 'Erro no SAP'}`, {
            id: toastId,
            duration: 8000,
          });
          setIsBloquearMigoRunning(false);
          return;
        }
      }

      toast.success(`Pipeline completo executado com sucesso no SAP!`, {
        id: toastId,
        icon: '🎉',
        duration: 5000,
      });
      loadStockData();
    } catch (err: any) {
      toast.error(`Erro ao executar pipeline: ${err?.message || err}`, { id: toastId });
    } finally {
      setIsBloquearMigoRunning(false);
    }
  };

  return (
    <div className={cn("text-[var(--text)] font-sans w-full", !isEmbedded ? "max-w-6xl mx-auto px-2 sm:px-3" : "w-full")}>
      <div className="space-y-3">
        {/* Card de Leitura / Entrada */}
        <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg p-3 sm:p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 grid place-items-center text-[var(--accent)] shrink-0">
                <QrCode className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)] block font-mono">
                  Consulta Rápida & Scanner
                </span>
                <span className="text-[11px] text-[var(--text-3)] hidden sm:inline">
                  Leitor de código de barras, fotos de etiquetas ou entrada manual
                </span>
              </div>
            </div>
            {scannedResult && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-[var(--red)] hover:text-[var(--red)] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/25 hover:bg-[var(--red)]/20 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar Consulta
              </button>
            )}
          </div>

          {/* Container do Vídeo da Câmera */}
          <div className={`overflow-hidden rounded-lg bg-black border border-[var(--border-strong)] shadow-inner relative ${scannerActive ? 'block' : 'hidden'}`}>
            <div id={scannerContainerId} className="w-full min-h-[240px]" />
            
            {/* Controles sobrepostos da câmera (Lanterna e Zoom) */}
            {scannerActive && (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-lg border backdrop-blur-md shadow-lg transition-all ${
                      torchOn
                        ? 'bg-[var(--amber)] text-black border-[var(--amber)] font-bold'
                        : 'bg-black/70 text-white border-white/20 hover:bg-black/90'
                    }`}
                    title="Alternar Lanterna"
                  >
                    {torchOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
                  </button>
                )}
              </div>
            )}

            {/* Slider de Zoom rápido se suportado */}
            {scannerActive && maxZoom > 1 && (
              <div className="absolute bottom-10 left-4 right-4 z-20 flex items-center justify-center gap-3 bg-black/70 backdrop-blur-md p-2 rounded-lg border border-white/15">
                <ZoomOut className="h-4 w-4 text-[var(--text-3)]" />
                <input
                  type="range"
                  min={1}
                  max={maxZoom}
                  step={0.1}
                  value={zoomLevel}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="w-40 accent-[var(--accent)]"
                />
                <ZoomIn className="h-4 w-4 text-[var(--text-3)]" />
                <span className="text-[11px] font-mono text-[var(--accent)] font-bold">{zoomLevel.toFixed(1)}x</span>
              </div>
            )}

            <div className="p-2.5 bg-[var(--surface-2)] border-t border-[var(--border)] text-center">
              <p className="text-xs font-semibold text-[var(--text)]">
                Enquadre a etiqueta de 10cm na barra horizontal
              </p>
              <p className="text-[10px] text-[var(--text-3)]">
                Mantenha a cerca de 15-25cm de distância para foco nítido
              </p>
            </div>
          </div>

          {cameraError && (
            <div className="p-2.5 rounded-lg bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Container oculto para o scanner de arquivos */}
          <div id="barcode-file-reader-hidden-view" className="hidden" />

          {/* Input nativo de captura de câmera (alta definição nativa do celular) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageCapture}
            className="hidden"
          />

          {/* Ações de Captura e Campo de Entrada */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
            {/* Botões de Câmera */}
            <div className="grid grid-cols-2 gap-2 sm:col-span-5">
              <button
                type="button"
                disabled={processingImage}
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 bg-[var(--text)] hover:opacity-90 text-[var(--bg)] rounded-[var(--radius)] font-bold text-xs flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {processingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--bg)]" />
                    <span>Lendo...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-[var(--bg)]" />
                    <span>Tirar Foto HD</span>
                  </>
                )}
              </button>

              {!scannerActive ? (
                <button
                  type="button"
                  disabled={processingImage}
                  onClick={startScanner}
                  className="py-2 px-3 bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--text)] border border-[var(--border-strong)] rounded-[var(--radius)] font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <QrCode className="h-4 w-4 text-[var(--accent)]" />
                  <span>Leitor Ao Vivo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="py-2 px-3 bg-[var(--red)] hover:bg-[var(--red)]/90 text-white rounded-[var(--radius)] font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <CameraOff className="h-4 w-4" />
                  <span>Fechar Leitor</span>
                </button>
              )}
            </div>

            {/* Formulário Manual / Coletor */}
            <form onSubmit={handleManualSearch} className="sm:col-span-7 flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManualInput(val);
                    if (val.trim().length >= 6 && (val.includes(' ') || val.includes('\t') || val.includes(';') || val.includes('|'))) {
                      handleBarcodeScanned(val);
                    }
                  }}
                  placeholder="Bipe com coletor ou digite material/lote..."
                  className="w-full pl-3 pr-9 py-2 bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[var(--radius)] text-xs sm:text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none transition-all font-mono"
                />
                {manualInput && (
                  <button
                    type="button"
                    onClick={() => setManualInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] rounded-[var(--radius)] font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Buscar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Se nenhum resultado pesquisado ainda */}
        {!scannedResult && !loadingData && (
          <div className="text-center py-12 px-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] flex items-center justify-center mx-auto text-[var(--accent)] shadow-inner">
              <Package className="h-6 w-6 opacity-80" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-bold text-[var(--text)]">Aguardando leitura de etiqueta ou material</p>
              <p className="text-xs text-[var(--text-3)] max-w-md mx-auto mt-1 leading-relaxed">
                Escaneie o código de barras com a câmera, bipe com o coletor ou informe o código para consultar outros lotes do material, remessas e executar devoluções ou bloqueios no SAP.
              </p>
            </div>
          </div>
        )}

        {/* Resultado da Consulta Direta */}
        {scannedResult && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Card Principal do Material / Lote Lido */}
            <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg p-3.5 sm:p-4.5 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
                {/* Informações do Material e Lote */}
                <div className="md:col-span-7 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-3)] bg-[var(--surface-2)] px-2 py-0.5 rounded border border-[var(--border)]">
                      Material
                    </span>
                    <span className="text-xl sm:text-2xl font-mono font-bold text-[var(--accent)]">
                      {materialCode || 'N/A'}
                    </span>
                    {loteCode ? (
                      <span
                        className={cn(
                          "font-mono text-xs px-2.5 py-0.5 font-bold rounded border",
                          loteEncontradoNoEstoque
                            ? "bg-[var(--amber)]/15 border-[var(--amber)]/30 text-[var(--amber)]"
                            : "bg-[var(--red)]/15 border-[var(--red)]/30 text-[var(--red)]"
                        )}
                      >
                        Lote Lido: {loteCode}
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-mono px-2 py-0.5 font-medium rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)]">
                        Busca por código · todos os lotes
                      </span>
                    )}
                  </div>
                  {loteCode && !loteEncontradoNoEstoque && (
                    <p className="text-[11px] text-[var(--red)] font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Lote não localizado no estoque atual — exibindo todos os lotes do material.
                    </p>
                  )}
                  <p className="text-xs sm:text-sm text-[var(--text-2)] font-medium leading-snug">
                    {materialDescription}
                  </p>
                  
                  {/* Resumo rápido de estoque */}
                  <div className="flex items-center gap-2 pt-1 text-xs text-[var(--text-2)] flex-wrap">
                    <div className="flex items-baseline gap-1.5 bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1 rounded-[var(--radius)] font-mono">
                      <span className="text-[10.5px] text-[var(--text-3)] font-semibold">
                        {loteCode ? 'Estoque Lote:' : 'Estoque Total:'}
                      </span>
                      <span className="font-mono font-bold text-[var(--text)]">
                        {totalEstoqueLote > 0
                          ? totalEstoqueLote.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                          : (scannedResult.quantidade !== null && scannedResult.quantidade !== undefined ? scannedResult.quantidade : '0')}
                      </span>
                      <span className="text-[10.5px] text-[var(--accent)] font-bold">{unidadeMedida}</span>
                    </div>

                    {allMaterialItems.length > 0 && (
                      <div className="flex items-baseline gap-1.5 bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1 rounded-[var(--radius)] font-mono">
                        <span className="text-[10.5px] text-[var(--text-3)] font-semibold">Lotes:</span>
                        <span className="font-mono font-bold text-[var(--accent)]">
                          {allMaterialItems.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões de Ação Imediata */}
                <div className="md:col-span-5 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {/* 1. Botão Devolver */}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenDevolver(
                          materialCode,
                          loteCode,
                          materialDescription,
                          unidadeMedida,
                          totalEstoqueLote > 0 ? totalEstoqueLote : Number(scannedResult.quantidade || 0)
                        )
                      }
                      disabled={isDevolverRunning || !loteCode}
                      title="Devolver ao almoxarifado via /nzwm296"
                      className="py-2.5 px-3 bg-[var(--amber)] hover:bg-[var(--amber)]/90 text-black font-bold text-xs rounded-[var(--radius)] shadow-2xs transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Undo2 className="h-4 w-4 shrink-0" />
                      <span>Devolver</span>
                    </button>

                    {/* 2. Botão Bloquear / Desbloquear MIGO */}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenBloquear(
                          materialCode,
                          loteCode,
                          totalEstoqueLote > 0 ? totalEstoqueLote : Number(scannedResult.quantidade || 0),
                          unidadeMedida,
                          materialDescription
                        )
                      }
                      disabled={isBloquearMigoRunning || !loteCode}
                      title="Bloquear ou desbloquear no SAP via MIGO"
                      className="py-2.5 px-3 bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-semibold text-xs rounded-[var(--radius)] shadow-2xs transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <div className="flex items-center -space-x-1 shrink-0">
                        <Lock className="h-3.5 w-3.5 text-[var(--accent)]" />
                        <Unlock className="h-3.5 w-3.5 text-[var(--green)]" />
                      </div>
                      <span>Bloq / Desbloq</span>
                    </button>
                  </div>
                  {!loteCode && (
                    <p className="text-[10.5px] text-[var(--text-3)] text-center md:text-right font-mono">
                      Selecione um lote na lista abaixo para devolver ou bloquear.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Grid Principal com Outros Lotes do Material e Remessas Abertas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Coluna 1: Outros Lotes do Material */}
              <div className="lg:col-span-7 space-y-3">
                <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg p-3.5 sm:p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-[var(--accent-weak)] text-[var(--accent)]">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
                          Outros Lotes do Material
                        </h3>
                        <p className="text-[10.5px] text-[var(--text-3)]">
                          {allMaterialItems.length} {allMaterialItems.length === 1 ? 'lote encontrado' : 'lotes encontrados no estoque'}
                        </p>
                      </div>
                    </div>
                    {allMaterialItems.length > 0 && (
                      <span className="text-[10.5px] px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] font-mono font-medium">
                        Total: {allMaterialItems.reduce((acc, c) => acc + (Number(c.estoque_disponivel) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {unidadeMedida}
                      </span>
                    )}
                  </div>

                  {allMaterialItems.length === 0 ? (
                    <div className="text-center py-6 px-3 bg-[var(--surface-2)]/40 rounded-lg border border-[var(--border)] space-y-1">
                      <p className="text-xs font-semibold text-[var(--text-2)]">Nenhum lote deste material encontrado em estoque</p>
                      <p className="text-[10px] text-[var(--text-3)]">Verifique se o material possui saldo ativo na última atualização.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {allMaterialItems.map((item, idx) => {
                        const isCurrentLote = loteCode && String(item.lote).trim().toUpperCase() === loteCode.trim().toUpperCase();
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-3 rounded-lg border text-xs transition-all",
                              isCurrentLote
                                ? "bg-[var(--amber)]/10 border-[var(--amber)]/40 ring-1 ring-[var(--amber)]/30"
                                : "bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border)]"
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              {/* Lote e Posição */}
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-[var(--amber)] text-sm">
                                    {item.lote}
                                  </span>
                                  {isCurrentLote && (
                                    <span className="bg-[var(--amber)] text-black text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                                      Lido
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <span className="text-[var(--text-3)]">Posição:</span>
                                    <span className="font-mono font-bold text-[var(--accent)]">
                                      {item.posicao_deposito || 'S/ POS'}
                                    </span>
                                    {item.tipo_deposito && (
                                      <span className="bg-[var(--surface)] border border-[var(--border)] text-[9.5px] text-[var(--text-3)] font-mono py-0 px-1 rounded">
                                        {item.tipo_deposito}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-[10.5px] text-[var(--text-3)] flex items-center gap-2 flex-wrap font-mono">
                                  <span>Aging: {formatAgingDays(item.dias_aging)}</span>
                                  {item.data_vencimento && (
                                    <>
                                      <span>•</span>
                                      <span>Venc: <strong className="text-[var(--text-2)]">{item.data_vencimento}</strong></span>
                                    </>
                                  )}
                                  {item.tipo_estoque && item.tipo_estoque !== 'Livre' && (
                                    <>
                                      <span>•</span>
                                      <span className="text-[var(--red)] font-semibold">Tipo {item.tipo_estoque}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Saldo e Ações Rápidas */}
                              <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-[var(--border)] pt-2 sm:pt-0">
                                <div className="text-left sm:text-right">
                                  <span className="font-mono font-bold text-sm text-[var(--text)]">
                                    {Number(item.estoque_disponivel || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                                  </span>
                                  <span className="text-[10px] text-[var(--accent)] ml-1 font-semibold">{item.unidade_medida || 'KG'}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenBloquear(
                                        item.material,
                                        item.lote,
                                        Number(item.estoque_disponivel) || 0,
                                        item.unidade_medida,
                                        item.texto_breve_material || materialDescription
                                      )
                                    }
                                    className="px-2 py-1 bg-[var(--surface)] hover:bg-[var(--hover)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border-strong)] rounded text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Bloquear ou Desbloquear no SAP via MIGO"
                                  >
                                    <Lock className="h-3 w-3" /> Bloq
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenDevolver(
                                        item.material,
                                        item.lote,
                                        item.texto_breve_material || materialDescription,
                                        item.unidade_medida,
                                        Number(item.estoque_disponivel) || 0
                                      )
                                    }
                                    className="px-2 py-1 bg-[var(--amber)]/15 hover:bg-[var(--amber)] text-[var(--amber)] hover:text-black border border-[var(--amber)]/30 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                    title="Devolver ao almoxarifado via /nzwm296"
                                  >
                                    <Undo2 className="h-3 w-3" /> Devolver
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna 2: Remessas Abertas do Material */}
              <div className="lg:col-span-5 space-y-3">
                <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg p-3.5 sm:p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-[var(--accent-weak)] text-[var(--accent)]">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
                          Remessas Abertas
                        </h3>
                        <p className="text-[10.5px] text-[var(--text-3)]">
                          {materialRemessas.length} {materialRemessas.length === 1 ? 'remessa pendente' : 'remessas pendentes'}
                        </p>
                      </div>
                    </div>
                    {onNavigateToTab && materialRemessas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('remessas')}
                        className="text-[10.5px] text-[var(--accent)] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                      >
                        Ver todas <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {materialRemessas.length === 0 ? (
                    <div className="text-center py-6 px-3 bg-[var(--surface-2)]/40 rounded-lg border border-[var(--border)] space-y-1">
                      <p className="text-xs font-semibold text-[var(--text-2)]">Nenhuma remessa em aberto</p>
                      <p className="text-[10px] text-[var(--text-3)]">Não há ordens de picking pendentes para este material.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {materialRemessas.map((rem, idx) => (
                        <div
                          key={idx}
                          className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 text-xs flex items-center justify-between hover:bg-[var(--hover)] transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[var(--accent)]">{rem.numero_remessa}</span>
                              <span className="text-[10px] font-mono text-[var(--text-3)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                                Item {rem.item}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-[var(--text-3)] mt-1 font-mono">
                              Data: <strong className="text-[var(--text-2)]">{rem.data_disponibilidade || rem.data_picking || '-'}</strong>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-[var(--green)] text-sm">
                              {Number(rem.quantidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                            </span>
                            <p className="text-[10px] text-[var(--text-3)] font-semibold font-mono">{rem.unidade_medida || 'KG'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para Devolução Fracionada (/nzwm296) */}
      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent className="sm:max-w-lg bg-[#0e1014] border border-[var(--border-strong)] text-[var(--text)] p-4 sm:p-6 max-h-[92vh] overflow-y-auto gap-4 rounded-xl shadow-2xl">
          <DialogHeader className="gap-1">
            <DialogTitle className="flex items-start gap-2 text-[var(--amber)] text-sm sm:text-base font-bold text-left">
              <Undo2 className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--amber)] shrink-0 mt-0.5" />
              <span>Devolução Fracionada ao Almoxarifado (/nzwm296)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-3)]">
              Informe a divisão de volumes para devolução de saldo no SAP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Informações do Lote */}
            <div className="p-3 rounded-lg bg-[var(--surface-2)]/60 border border-[var(--border)] space-y-1.5 text-xs font-mono">
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-3)] shrink-0">Material:</span>
                <span className="font-mono font-bold text-[var(--accent)] truncate text-right">{devolverMaterial}</span>
              </div>
              {devolverDescricao && (
                <div className="flex justify-between gap-2 text-[11px]">
                  <span className="text-[var(--text-3)] shrink-0">Descrição:</span>
                  <span className="text-[var(--text-2)] truncate text-right">{devolverDescricao}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-3)] shrink-0">Lote:</span>
                <span className="font-mono font-bold text-[var(--amber)] truncate text-right">{devolverLote}</span>
              </div>
              <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-1.5 mt-1 font-semibold">
                <span className="text-[var(--text-3)] shrink-0">Saldo Disponível:</span>
                <span className="font-mono text-[var(--green)] text-right">
                  {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {devolverUnidade}
                </span>
              </div>
            </div>

            {/* Lista de Volumes */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)] font-mono">
                  Volumes a Devolver ({devolverVolumes.length})
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddVolume}
                  className="h-8 sm:h-7 text-xs bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--hover)] w-full sm:w-auto cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-1 text-[var(--accent)]" /> Adicionar Volume
                </Button>
              </div>

              <div className="space-y-2 max-h-64 sm:max-h-48 overflow-y-auto pr-1">
                {devolverVolumes.map((vol, idx) => (
                  <div
                    key={vol.id}
                    className="p-3 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--border)] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--accent)] font-mono">
                        Volume #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={devolverVolumes.length === 1}
                        onClick={() => handleRemoveVolume(idx)}
                        className="h-6 w-6 text-[var(--red)] hover:bg-[var(--red)]/10 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--text-3)] block mb-0.5 font-mono">Qtd a devolver</label>
                        <Input
                          type="text"
                          value={vol.quantidade}
                          onChange={(e) => handleUpdateVolume(idx, 'quantidade', e.target.value)}
                          placeholder="Ex: 5,420"
                          className="h-9 sm:h-8 text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--text)] font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-[var(--text-3)] block mb-0.5 font-mono">Volume</label>
                        <Input
                          type="text"
                          value={vol.volume}
                          onChange={(e) => handleUpdateVolume(idx, 'volume', e.target.value)}
                          placeholder="1"
                          className="h-9 sm:h-8 text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--text)] font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão de Preenchimento Automático do Restante */}
              {saldoRestante > 0.0001 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleFillRestante}
                    className="text-xs text-[var(--accent)] hover:underline flex items-start gap-1.5 font-semibold text-left cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                    <span>Adicionar restante ({saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {devolverUnidade}) em novo volume</span>
                  </button>
                </div>
              )}

              {/* Barra de Progresso / Totalizador */}
              <div className="p-3 rounded-lg bg-[var(--surface-2)]/60 border border-[var(--border)] space-y-1 text-xs">
                <div className="flex justify-between items-baseline gap-2 flex-wrap font-mono">
                  <span className="text-[var(--text-3)] shrink-0">Total a Devolver:</span>
                  <span className={cn('font-bold text-right', isOverSaldo ? 'text-[var(--red)]' : 'text-[var(--accent)]')}>
                    {somaVolumes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} / {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {devolverUnidade}
                  </span>
                </div>
                {isOverSaldo && (
                  <p className="text-[11px] text-[var(--red)] font-semibold">
                    ⚠️ A quantidade total informada excede o saldo disponível!
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDevolverOpen(false)}
              className="bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--text-2)] hover:text-[var(--text)] cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDevolver}
              disabled={isDevolverRunning || isOverSaldo || somaVolumes <= 0}
              className="bg-[var(--amber)] hover:bg-[var(--amber)]/90 text-black font-bold gap-1.5 cursor-pointer shadow-xs"
            >
              <Undo2 className="h-4 w-4" />
              <span>Confirmar e Enviar ao SAP</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Bloquear/Desbloquear e Pipeline de Macros no SAP (Redesign AgileWork Design System) */}
      <Dialog open={bloquearMigoOpen} onOpenChange={setBloquearMigoOpen}>
        <DialogContent className="bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] sm:max-w-2xl max-h-[88vh] overflow-hidden rounded-[8px] p-0 shadow-2xl flex flex-col">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-[var(--text)]">
                  Execução SAP &amp; Pipeline de Macros
                </h2>
                <span className="mono text-[11px] text-[var(--text-3)]">
                  ({bloquearSelectedItems.length} {bloquearSelectedItems.length === 1 ? 'lote selecionado' : 'lotes selecionados'})
                </span>
              </div>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                Automação em lote via MIGO / LT10 integrada ao Planilha Sync
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBloquearMigoOpen(false)}
              className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded transition-colors"
              title="Fechar (Esc)"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[13px]">
            {/* Seletor Segmentado de Operação Base (.seg) */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-medium text-[var(--text-2)]">Operação no MIGO:</span>
              <div className="seg">
                <button
                  type="button"
                  onClick={() => handleToggleMigoMode('bloquear')}
                  className={!macroPipeline.some((m) => m.actionType === 'desbloquear_migo') ? 'on' : ''}
                >
                  <span className="dot" style={{ background: 'var(--amber)' }} />
                  Bloquear saldo (Y84)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMigoMode('desbloquear')}
                  className={macroPipeline.some((m) => m.actionType === 'desbloquear_migo') ? 'on' : ''}
                >
                  <span className="dot" style={{ background: 'var(--green)' }} />
                  Desbloquear saldo (Y83)
                </button>
              </div>
            </div>

            {/* Detalhes do Item / Parâmetros */}
            <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface-2)] p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="block text-[11px] text-[var(--text-3)] mb-1">Código SAP</span>
                  <span className="mono font-medium text-xs text-[var(--text)]">
                    {bloquearSelectedItems[0]?.material || '—'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[11px] text-[var(--text-3)] mb-1">Descrição do material</span>
                  <span className="text-xs text-[var(--text-2)] truncate block" title={bloquearSelectedItems[0]?.descricao}>
                    {bloquearSelectedItems[0]?.descricao || '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
                <div>
                  <span className="block text-[11px] text-[var(--text-3)] mb-1">Lote</span>
                  <span className="mono font-medium text-xs text-[var(--text)]">
                    {bloquearSelectedItems[0]?.lote || '—'}
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-3)] mb-1">
                    Quantidade
                  </label>
                  <input
                    type="text"
                    value={bloquearSelectedItems[0]?.quantidade ?? ''}
                    onChange={(e) => handleUpdateSingleBloquearItem('quantidade', e.target.value)}
                    className="input mono text-xs h-7"
                    placeholder="0,000"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-3)] mb-1">
                    Unidade (UMB)
                  </label>
                  <input
                    type="text"
                    value={bloquearSelectedItems[0]?.unidade ?? ''}
                    onChange={(e) => handleUpdateSingleBloquearItem('unidade', e.target.value.toUpperCase())}
                    className="input mono text-xs uppercase h-7"
                    placeholder="KG"
                  />
                </div>
              </div>
            </div>

            {/* Pipeline de Execução */}
            <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    Etapas do pipeline
                  </span>
                  <span className="mono text-[11px] text-[var(--text-3)]">
                    ({macroPipeline.length} {macroPipeline.length === 1 ? 'etapa' : 'etapas'})
                  </span>
                </div>

                {/* Predefinições Rápidas (.seg) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-[var(--text-3)]">Predefinições:</span>
                  <div className="seg">
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['bloquear_migo', 'mover_lt10', 'atualizar_db'])}
                      title="Bloquear MIGO ➔ Mover (/nlt10) ➔ Atualizar Base"
                    >
                      Completo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['mover_lt10', 'atualizar_db'])}
                      title="Mover (/nlt10) ➔ Atualizar Base"
                    >
                      Mover + DB
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['bloquear_migo'])}
                      title="Apenas Bloquear via MIGO (Y84)"
                    >
                      Só Bloquear
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['desbloquear_migo'])}
                      title="Apenas Desbloquear via MIGO (Y83)"
                    >
                      Só Desbloquear
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista Sequencial */}
              <div className="space-y-1.5">
                {macroPipeline.map((step, idx) => {
                  const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
                  if (!macroDef) return null;

                  return (
                    <div
                      key={step.id}
                      className="border border-[var(--border)] rounded-[var(--radius)] p-2.5 bg-[var(--surface-2)] text-xs transition-colors hover:border-[var(--border-strong)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="mono text-[11px] text-[var(--text-3)] w-4 text-center select-none">
                            {idx + 1}.
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="dot"
                                style={{
                                  background:
                                    step.actionType === 'bloquear_migo'
                                      ? 'var(--amber)'
                                      : step.actionType === 'desbloquear_migo'
                                      ? 'var(--green)'
                                      : step.actionType === 'mover_lt10'
                                      ? 'var(--accent)'
                                      : 'var(--text-3)',
                                }}
                              />
                              <span className="font-medium text-xs text-[var(--text)]">
                                {macroDef.label}
                              </span>
                            </div>
                            <span className="text-[11px] text-[var(--text-3)] block mt-0.5 truncate">
                              {macroDef.description}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveMacroInPipeline(idx, idx - 1)}
                            className="btn sm"
                            style={{ width: '26px', padding: 0, justifyContent: 'center' }}
                            title="Mover para cima"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === macroPipeline.length - 1}
                            onClick={() => handleMoveMacroInPipeline(idx, idx + 1)}
                            className="btn sm"
                            style={{ width: '26px', padding: 0, justifyContent: 'center' }}
                            title="Mover para baixo"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMacroFromPipeline(idx)}
                            className="btn sm danger"
                            style={{ width: '26px', padding: 0, justifyContent: 'center' }}
                            title="Remover etapa"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>

                      {step.actionType === 'mover_lt10' && (
                        <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] text-[var(--text-3)]">Destino LT10:</span>
                          <div className="seg">
                            {PREDEFINED_MOVER_ROUTES.map((route) => {
                              const isCurrentRoute = (step.routeId || 'pes_pesagem') === route.id;
                              return (
                                <button
                                  key={route.id}
                                  type="button"
                                  onClick={() => handleUpdateStepRoute(step.id, route.id)}
                                  className={cn("mono text-[11px]", isCurrentRoute && "on")}
                                >
                                  {route.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Adicionar Ação ao Pipeline */}
              <div className="pt-2 border-t border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-3)] block mb-1.5">
                  Adicionar ação ao pipeline:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_MACROS.map((macro) => (
                    <button
                      key={macro.type}
                      type="button"
                      onClick={() => handleAddMacroToPipeline(macro.type)}
                      className="btn sm"
                    >
                      <Plus size={11} />
                      <span>{macro.shortLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Aviso Informativo */}
            <div className="flex items-center gap-2 p-2.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-3)]">
              <span className="dot" style={{ background: 'var(--amber)' }} />
              <span>
                Certifique-se de que o SAP GUI está com a sessão aberta e o Planilha Sync conectado na estação.
              </span>
            </div>
          </div>

          {/* Rodapé Padrão */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <span className="text-xs text-[var(--text-3)] mono">
              {macroPipeline.length} etapa(s) no fluxo
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBloquearMigoOpen(false)}
                className="btn sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteBloquearMacroPipeline}
                disabled={isBloquearMigoRunning || macroPipeline.length === 0}
                className="btn primary sm"
              >
                {isBloquearMigoRunning ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Executando no SAP…</span>
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    <span>Executar no SAP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
