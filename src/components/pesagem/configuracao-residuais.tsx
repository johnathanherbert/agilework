'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Scale,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Save,
  Loader2,
  Plus,
  X,
  AlertTriangle,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { ConfiguracaoResiduais } from '@/types/aging';
import { fetchConfiguracaoResiduais, saveConfiguracaoResiduais } from '@/lib/dashpesagem-api';
import toast from 'react-hot-toast';

interface ConfiguracaoResiduaisProps {
  onConfigChange?: () => void;
}

const DEFAULT_CONFIG: ConfiguracaoResiduais = {
  limite_verde: 100,
  limite_amarelo: 900,
  limite_maximo: 999,
  materiais_alto_valor: [],
  dias_atencao: 3,
  dias_alerta: 7,
  dias_critico: 20,
  dias_vencimento_proximo: 30,
};

export function ConfiguracaoResiduaisComponent({ onConfigChange }: ConfiguracaoResiduaisProps) {
  const [config, setConfig] = useState<ConfiguracaoResiduais>(DEFAULT_CONFIG);
  const [novoMaterial, setNovoMaterial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await fetchConfiguracaoResiduais();
      setConfig({
        ...DEFAULT_CONFIG,
        ...data,
      });
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validações de integridade
    const diasAlerta = Number(config.dias_alerta ?? 7);
    const diasCritico = Number(config.dias_critico ?? 20);

    if (diasAlerta >= diasCritico) {
      toast.error('O número de dias para Alerta deve ser menor que o de Crítico.');
      return;
    }

    if (config.limite_verde >= config.limite_amarelo || config.limite_amarelo >= config.limite_maximo) {
      toast.error('Os limites em gramas devem seguir a ordem: Verde < Amarelo < Vermelho (Máximo).');
      return;
    }

    setSaving(true);
    try {
      await saveConfiguracaoResiduais(config);
      toast.success('Configurações salvas com sucesso!');
      if (onConfigChange) {
        onConfigChange();
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setConfig({
      ...DEFAULT_CONFIG,
      materiais_alto_valor: config.materiais_alto_valor, // preserva materiais já cadastrados
    });
    toast.success('Valores padrão restaurados (clique em Salvar para persistir).');
  };

  const handleAddMaterial = () => {
    const materialTrimmed = novoMaterial.trim().toUpperCase();
    if (!materialTrimmed) return;

    if (config.materiais_alto_valor.includes(materialTrimmed)) {
      toast.error('Material já está na lista.');
      return;
    }

    setConfig({
      ...config,
      materiais_alto_valor: [...config.materiais_alto_valor, materialTrimmed],
    });
    setNovoMaterial('');
  };

  const handleRemoveMaterial = (material: string) => {
    setConfig({
      ...config,
      materiais_alto_valor: config.materiais_alto_valor.filter((m) => m !== material),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-[var(--surface)] rounded-lg border border-[var(--border-strong)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        <span className="ml-3 text-xs text-[var(--text-3)] font-mono">Carregando parâmetros operacionais...</span>
      </div>
    );
  }

  const diasAlerta = Number(config.dias_alerta ?? 7);
  const diasCritico = Number(config.dias_critico ?? 20);
  const diasVencimento = Number(config.dias_vencimento_proximo ?? 30);

  return (
    <div className="space-y-4">
      {/* SEÇÃO 1: FAIXAS DE AGING (DIAS DE ESTOQUE) */}
      <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center">
              <Clock size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                Faixas de Aging (Dias em Estoque)
              </h3>
              <p className="text-[11px] text-[var(--text-3)] font-mono">
                Limites de dias para classificação de criticidade dos lotes e alertas
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)]">
            AGING TIMING
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Grid de Inputs de Dias */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Dias para Alerta */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Início Alerta</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/30">
                  ALERTA
                </span>
              </div>
              <input
                id="dias-alerta"
                type="number"
                min="1"
                max={diasCritico - 1}
                value={diasAlerta}
                onChange={(e) => setConfig({ ...config, dias_alerta: parseInt(e.target.value) || 0 })}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono font-bold text-xs rounded-[var(--radius)] px-3 py-1.5 outline-none"
              />
              <p className="text-[10.5px] font-mono text-[var(--text-3)]">
                Normal: &lt;{diasAlerta}d • Alerta: <span className="text-[var(--amber)]">{diasAlerta} a {diasCritico - 1}d</span>
              </p>
            </div>

            {/* 2. Dias para Crítico */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Início Crítico</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/30">
                  CRÍTICO
                </span>
              </div>
              <input
                id="dias-critico"
                type="number"
                min={diasAlerta + 1}
                value={diasCritico}
                onChange={(e) => setConfig({ ...config, dias_critico: parseInt(e.target.value) || 0 })}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono font-bold text-xs rounded-[var(--radius)] px-3 py-1.5 outline-none"
              />
              <p className="text-[10.5px] font-mono text-[var(--text-3)]">
                Lotes em estado crítico: <span className="text-[var(--red)] font-bold">≥ {diasCritico} dias</span>
              </p>
            </div>

            {/* 3. Dias de Vencimento Próximo */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Vencimento Próximo</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  VALIDADE
                </span>
              </div>
              <input
                id="dias-vencimento"
                type="number"
                min="1"
                value={diasVencimento}
                onChange={(e) => setConfig({ ...config, dias_vencimento_proximo: parseInt(e.target.value) || 0 })}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono font-bold text-xs rounded-[var(--radius)] px-3 py-1.5 outline-none"
              />
              <p className="text-[10.5px] font-mono text-[var(--text-3)]">
                Vencendo nos próximos <span className="text-purple-400 font-bold">{diasVencimento} dias</span>
              </p>
            </div>
          </div>

          {/* Visualizador da Barra de Aging */}
          <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                Régua de Classificação Visual de Aging
              </span>
              <span className="text-[var(--text-3)] font-mono text-[10.5px]">
                Normal: &lt;{diasAlerta}d • Alerta: {diasAlerta}–{diasCritico - 1}d • Crítico: ≥{diasCritico}d
              </span>
            </div>

            <div className="h-6 w-full rounded-md overflow-hidden flex border border-[var(--border-strong)] shadow-inner font-mono text-[10.5px] font-bold text-center leading-6">
              <div
                style={{ width: `${Math.max(25, (diasAlerta / (diasCritico * 1.3)) * 100)}%` }}
                className="bg-[var(--accent)] text-[var(--bg)] transition-all flex items-center justify-center truncate px-2"
                title={`Normal: 0 a ${diasAlerta - 1} dias`}
              >
                Normal (&lt;{diasAlerta}d)
              </div>
              <div
                style={{ width: `${Math.max(30, ((diasCritico - diasAlerta) / (diasCritico * 1.3)) * 100)}%` }}
                className="bg-[var(--amber)] text-[#0e1014] transition-all flex items-center justify-center truncate px-2"
                title={`Alerta: ${diasAlerta} a ${diasCritico - 1} dias`}
              >
                Alerta ({diasAlerta}–{diasCritico - 1}d)
              </div>
              <div
                className="bg-[var(--red)] text-white flex-1 transition-all flex items-center justify-center truncate px-2"
                title={`Crítico: ≥ ${diasCritico} dias`}
              >
                Crítico (≥{diasCritico}d)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: FAIXAS DE SALDOS RESIDUAIS (GRAMAS) */}
      <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center">
              <Scale size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                Faixas de Saldos Residuais (Gramas)
              </h3>
              <p className="text-[11px] text-[var(--text-3)] font-mono">
                Limites em gramas para classificação de sobras no depósito PES
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)]">
            SOBRAS PES
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Verde */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Verde / Leve</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/30">
                  Até {config.limite_verde}g
                </span>
              </div>
              <input
                id="limite-verde"
                type="number"
                value={config.limite_verde}
                onChange={(e) => setConfig({ ...config, limite_verde: parseInt(e.target.value) || 0 })}
                min="0"
                step="10"
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono font-bold text-xs rounded-[var(--radius)] px-3 py-1.5 outline-none"
              />
              <p className="text-[10.5px] font-mono text-[var(--text-3)]">0g até {config.limite_verde}g</p>
            </div>

            {/* Amarelo */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Amarelo / Médio</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/30">
                  Até {config.limite_amarelo}g
                </span>
              </div>
              <input
                id="limite-amarelo"
                type="number"
                value={config.limite_amarelo}
                onChange={(e) => setConfig({ ...config, limite_amarelo: parseInt(e.target.value) || 0 })}
                min={config.limite_verde}
                step="50"
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono font-bold text-xs rounded-[var(--radius)] px-3 py-1.5 outline-none"
              />
              <p className="text-[10.5px] font-mono text-[var(--text-3)]">{config.limite_verde}g a {config.limite_amarelo}g</p>
            </div>

            {/* Vermelho / Máximo Residual */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Vermelho / Alto</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/30">
                  Até {config.limite_maximo}g
                </span>
              </div>
              <input
                id="limite-maximo"
                type="number"
                value={config.limite_maximo}
                onChange={(e) => setConfig({ ...config, limite_maximo: parseInt(e.target.value) || 0 })}
                min={config.limite_amarelo}
                step="50"
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono font-bold text-xs rounded-[var(--radius)] px-3 py-1.5 outline-none"
              />
              <p className="text-[10.5px] font-mono text-[var(--text-3)]">{config.limite_amarelo}g a {config.limite_maximo}g</p>
            </div>

            {/* Estoque Normal */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-2)]/60 border border-[var(--border)] space-y-2 opacity-80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Estoque Normal</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-3)] border border-[var(--border)]">
                  PADRÃO
                </span>
              </div>
              <input
                value={`> ${config.limite_maximo}g (≥ 1 KG)`}
                disabled
                className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] font-mono font-bold text-xs rounded-[var(--radius)] px-3 py-1.5 cursor-not-allowed opacity-75"
              />
              <p className="text-[10.5px] font-mono text-[var(--text-3)]">Estoque padrão de produção</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius)] text-xs text-[var(--text-2)] font-mono">
            <AlertTriangle className="h-4 w-4 text-[var(--amber)] mt-0.5 shrink-0" />
            <div>
              <strong className="text-[var(--text)] font-sans">Regra de Conversão:</strong> Apenas saldos de pesagem até{' '}
              <span className="text-[var(--accent)] font-bold">{config.limite_maximo}g</span> são analisados na esteira de
              residuais. Lotes com saldo superior são considerados estoque integral de produção.
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: MATERIAIS DE EXTREMA ATENÇÃO / ALTO VALOR */}
      <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center">
              <ShieldAlert size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                Materiais de Extrema Atenção (Alto Valor)
              </h3>
              <p className="text-[11px] text-[var(--text-3)] font-mono">
                Materiais nobres e de altíssimo valor que exigem monitoramento contínuo
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)]">
            {config.materiais_alto_valor.length} CADASTRADOS
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2 max-w-md">
            <input
              placeholder="Código do material (ex: 011370)"
              value={novoMaterial}
              onChange={(e) => setNovoMaterial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMaterial();
                }
              }}
              className="flex-1 bg-[var(--surface-2)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono text-xs rounded-[var(--radius)] px-3 py-2 outline-none placeholder:text-[var(--text-3)]"
            />
            <button
              type="button"
              onClick={handleAddMaterial}
              className="px-3.5 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-bold text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={13} className="text-[var(--accent)]" />
              Adicionar
            </button>
          </div>

          {config.materiais_alto_valor.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {config.materiais_alto_valor.map((material) => (
                <div
                  key={material}
                  className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border-strong)] px-2.5 py-1 rounded-[var(--radius)] text-xs font-mono font-semibold flex items-center gap-2 shadow-2xs"
                >
                  <span className="text-[var(--accent)]">{material}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(material)}
                    className="text-[var(--text-3)] hover:text-[var(--red)] transition-colors p-0.5 rounded cursor-pointer"
                    title="Remover material"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-3)] font-mono italic pt-1">
              Nenhum material cadastrado nesta lista de atenção especial.
            </p>
          )}
        </div>
      </div>

      {/* BARRA DE AÇÕES: SALVAR / RESTAURAR */}
      <div className="flex items-center justify-between p-4 bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs flex-wrap gap-3">
        <button
          type="button"
          onClick={handleRestoreDefaults}
          disabled={saving}
          className="px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text-3)] hover:text-[var(--text)] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCcw size={13} />
          Restaurar Padrões
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-[var(--bg)] font-bold text-xs tracking-wide shadow-xs transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Salvando Parâmetros...
            </>
          ) : (
            <>
              <Save size={14} />
              Salvar Todas as Configurações
            </>
          )}
        </button>
      </div>
    </div>
  );
}

