'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, X, RotateCcw } from 'lucide-react';
import { ConfiguracaoResiduais } from '@/types/aging';
import { fetchConfiguracaoResiduais, saveConfiguracaoResiduais } from '@/lib/dashpesagem-api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

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

const same = (a: ConfiguracaoResiduais, b: ConfiguracaoResiduais) => JSON.stringify(a) === JSON.stringify(b);
const toInt = (v: string) => {
  const n = parseInt(v.replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
};
const fmtG = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : `${g} g`);

/* ---------------------------------------------------------------------------
 * Linha de configuração: rótulo + explicação à esquerda, controle à direita
 * ------------------------------------------------------------------------- */
function Row({
  label,
  hint,
  dot,
  children,
  error,
}: {
  label: string;
  hint?: React.ReactNode;
  dot?: string;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 items-center py-3.5 border-b border-[var(--border)] last:border-b-0">
      <div className="min-w-0">
        <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]">
          {dot && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: dot }} />}
          {label}
        </span>
        {hint && <span className="block text-[12px] text-[var(--text-3)] mt-0.5 leading-snug">{hint}</span>}
        {error && <span className="block text-[12px] text-[var(--red)] mt-0.5">{error}</span>}
      </div>
      <div className="flex items-center gap-2 justify-end">{children}</div>
    </div>
  );
}

function NumField({
  value,
  onChange,
  unit,
  invalid,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  unit: string;
  invalid?: boolean;
  id: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center h-9 w-[124px] border rounded-[var(--radius)] bg-[var(--bg)] focus-within:border-[var(--accent)]',
        invalid ? 'border-[var(--red)]' : 'border-[var(--border-strong)]'
      )}
    >
      <input
        id={id}
        inputMode="numeric"
        value={String(value ?? '')}
        onChange={(e) => onChange(toInt(e.target.value))}
        className="flex-1 min-w-0 bg-transparent outline-none px-2.5 font-mono text-[13px] text-right text-[var(--text)]"
      />
      <span className="pr-2.5 text-[12px] text-[var(--text-3)]">{unit}</span>
    </div>
  );
}

function Section({ title, desc, right, children }: { title: string; desc: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between gap-3 pb-2.5 border-b border-[var(--border-strong)]">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
          <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">{desc}</p>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Régua proporcional com marcações reais (não decorativa) */
function Ruler({ cuts, max, unit, colors }: { cuts: number[]; max: number; unit: (n: number) => string; colors: string[] }) {
  const pts = [0, ...cuts.map((c) => Math.min(c, max)), max];
  return (
    <div className="pt-4 pb-1">
      <div className="flex h-2 rounded-full overflow-hidden bg-[var(--border)]">
        {colors.map((c, i) => (
          <span key={i} style={{ width: `${Math.max(0, ((pts[i + 1] - pts[i]) / max) * 100)}%`, background: c }} />
        ))}
      </div>
      <div className="relative h-5 mt-1">
        {cuts.map((c, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 font-mono text-[11px] text-[var(--text-3)] whitespace-nowrap"
            style={{ left: `${Math.min(100, (c / max) * 100)}%` }}
          >
            {unit(c)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConfiguracaoResiduaisComponent({ onConfigChange }: ConfiguracaoResiduaisProps) {
  const [config, setConfig] = useState<ConfiguracaoResiduais>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState<ConfiguracaoResiduais>(DEFAULT_CONFIG);
  const [novoMaterial, setNovoMaterial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchConfiguracaoResiduais();
        const merged = { ...DEFAULT_CONFIG, ...data, materiais_alto_valor: data?.materiais_alto_valor || [] };
        setConfig(merged);
        setSaved(merged);
      } catch (error) {
        console.error('Erro ao carregar configuração:', error);
        toast.error('Não foi possível carregar as configurações');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = <K extends keyof ConfiguracaoResiduais>(k: K, v: ConfiguracaoResiduais[K]) => setConfig((c) => ({ ...c, [k]: v }));

  const diasAlerta = Number(config.dias_alerta ?? 7);
  const diasCritico = Number(config.dias_critico ?? 20);
  const diasVenc = Number(config.dias_vencimento_proximo ?? 30);
  const { limite_verde: gV, limite_amarelo: gA, limite_maximo: gM } = config;

  // Validação ao vivo
  const errDias = diasAlerta < 1 ? 'Use pelo menos 1 dia.' : diasAlerta >= diasCritico ? 'Precisa ser menor que o início do crítico.' : null;
  const errVenc = diasVenc < 1 ? 'Use pelo menos 1 dia.' : null;
  const errVerde = gV >= gA ? 'Precisa ser menor que o limite amarelo.' : null;
  const errAmarelo = gA >= gM ? 'Precisa ser menor que o limite máximo.' : null;
  const valid = !errDias && !errVenc && !errVerde && !errAmarelo;
  const dirty = !same(config, saved);

  const dirtySections = useMemo(() => {
    const s: string[] = [];
    if (config.dias_alerta !== saved.dias_alerta || config.dias_critico !== saved.dias_critico || config.dias_vencimento_proximo !== saved.dias_vencimento_proximo) s.push('aging');
    if (gV !== saved.limite_verde || gA !== saved.limite_amarelo || gM !== saved.limite_maximo) s.push('residuais');
    if (JSON.stringify(config.materiais_alto_valor) !== JSON.stringify(saved.materiais_alto_valor)) s.push('materiais');
    return s;
  }, [config, saved, gV, gA, gM]);

  const handleSave = async () => {
    if (!valid) {
      toast.error('Corrija os campos em vermelho antes de salvar');
      return;
    }
    setSaving(true);
    try {
      await saveConfiguracaoResiduais(config);
      setSaved(config);
      toast.success('Configurações salvas');
      onConfigChange?.();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S salva
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !saving) handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, config]);

  const isDefault = same({ ...DEFAULT_CONFIG, materiais_alto_valor: config.materiais_alto_valor }, config);
  const handleRestoreDefaults = () => setConfig({ ...DEFAULT_CONFIG, materiais_alto_valor: config.materiais_alto_valor });

  /* ---------- materiais de alto valor ---------- */
  const parseCodes = (raw: string) =>
    Array.from(new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)));

  const handleAddMaterial = () => {
    const codes = parseCodes(novoMaterial);
    if (!codes.length) return;
    const novos = codes.filter((c) => !config.materiais_alto_valor.includes(c));
    const repetidos = codes.length - novos.length;
    if (novos.length) set('materiais_alto_valor', [...config.materiais_alto_valor, ...novos]);
    setNovoMaterial('');
    if (repetidos && !novos.length) toast.error(codes.length === 1 ? 'Material já está na lista' : 'Todos já estão na lista');
    else if (repetidos) toast(`${novos.length} adicionado(s) · ${repetidos} já estavam na lista`);
  };

  const handleRemoveMaterial = (m: string) => set('materiais_alto_valor', config.materiais_alto_valor.filter((x) => x !== m));

  if (loading) {
    return (
      <p className="py-16 flex items-center justify-center gap-2 text-[12.5px] text-[var(--text-3)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configurações…
      </p>
    );
  }

  const rulerDiasMax = Math.max(diasCritico + Math.ceil(diasCritico * 0.5), diasVenc, 10);

  return (
    <div className="max-w-[880px] text-[var(--text)] pb-20">
      {/* ======================= AGING ======================= */}
      <Section
        title="Faixas de aging"
        desc="Dias em estoque que classificam os lotes como normal, alerta ou crítico."
        right={dirtySections.includes('aging') && <span className="text-[11.5px] text-[var(--amber)]">alterado</span>}
      >
        <Row
          label="Alerta a partir de"
          dot="var(--amber)"
          hint={<>Lotes com <span className="font-mono">{diasAlerta}</span> dias ou mais. Normal fica abaixo disso.</>}
          error={errDias}
        >
          <NumField id="dias-alerta" value={diasAlerta} onChange={(n) => set('dias_alerta', n)} unit="dias" invalid={!!errDias} />
        </Row>
        <Row
          label="Crítico a partir de"
          dot="var(--red)"
          hint={<>Lotes com <span className="font-mono">{diasCritico}</span> dias ou mais.</>}
        >
          <NumField id="dias-critico" value={diasCritico} onChange={(n) => set('dias_critico', n)} unit="dias" invalid={!!errDias} />
        </Row>
        <Row
          label="Vencimento próximo"
          hint={<>Destaca lotes que vencem nos próximos <span className="font-mono">{diasVenc}</span> dias.</>}
          error={errVenc}
        >
          <NumField id="dias-vencimento" value={diasVenc} onChange={(n) => set('dias_vencimento_proximo', n)} unit="dias" invalid={!!errVenc} />
        </Row>

        {!errDias && (
          <>
            <Ruler
              cuts={[diasAlerta, diasCritico]}
              max={rulerDiasMax}
              unit={(n) => `${n} d`}
              colors={['var(--green)', 'var(--amber)', 'var(--red)']}
            />
            <p className="text-[12px] text-[var(--text-3)]">
              Normal <span className="font-mono text-[var(--text-2)]">0–{diasAlerta - 1} d</span> · Alerta{' '}
              <span className="font-mono text-[var(--text-2)]">{diasAlerta}–{diasCritico - 1} d</span> · Crítico{' '}
              <span className="font-mono text-[var(--text-2)]">≥ {diasCritico} d</span>
            </p>
          </>
        )}
      </Section>

      {/* ======================= RESIDUAIS ======================= */}
      <Section
        title="Saldos residuais"
        desc="Sobras pequenas no depósito PES, em gramas. Acima do limite máximo o lote é tratado como estoque normal."
        right={dirtySections.includes('residuais') && <span className="text-[11.5px] text-[var(--amber)]">alterado</span>}
      >
        <Row label="Verde até" dot="var(--green)" hint={<>Sobras de <span className="font-mono">0</span> a <span className="font-mono">{fmtG(gV)}</span>.</>} error={errVerde}>
          <NumField id="limite-verde" value={gV} onChange={(n) => set('limite_verde', n)} unit="g" invalid={!!errVerde} />
        </Row>
        <Row
          label="Amarelo até"
          dot="var(--amber)"
          hint={<>Acima de <span className="font-mono">{fmtG(gV)}</span> até <span className="font-mono">{fmtG(gA)}</span>.</>}
          error={errAmarelo}
        >
          <NumField id="limite-amarelo" value={gA} onChange={(n) => set('limite_amarelo', n)} unit="g" invalid={!!errVerde || !!errAmarelo} />
        </Row>
        <Row
          label="Limite máximo do residual"
          dot="var(--red)"
          hint={<>Vermelho de <span className="font-mono">{fmtG(gA)}</span> até <span className="font-mono">{fmtG(gM)}</span>. Acima disso não entra na análise de residuais.</>}
        >
          <NumField id="limite-maximo" value={gM} onChange={(n) => set('limite_maximo', n)} unit="g" invalid={!!errAmarelo} />
        </Row>

        {!errVerde && !errAmarelo && (
          <>
            <Ruler
              cuts={[gV, gA, gM]}
              max={Math.max(gM * 1.15, gM + 100)}
              unit={fmtG}
              colors={['var(--green)', 'var(--amber)', 'var(--red)', 'var(--text-3)']}
            />
            <p className="text-[12px] text-[var(--text-3)]">
              Estoque normal acima de <span className="font-mono text-[var(--text-2)]">{fmtG(gM)}</span>
            </p>
          </>
        )}
      </Section>

      {/* ======================= MATERIAIS ======================= */}
      <Section
        title="Materiais de alto valor"
        desc="Recebem destaque e monitoramento nos residuais, independente da faixa."
        right={
          <span className="text-[12px] text-[var(--text-3)]">
            {dirtySections.includes('materiais') && <span className="text-[var(--amber)] mr-2">alterado</span>}
            <span className="font-mono text-[var(--text-2)]">{config.materiais_alto_valor.length}</span> cadastrado(s)
          </span>
        }
      >
        <form
          className="flex gap-2 pt-3.5 max-w-[520px]"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddMaterial();
          }}
        >
          <input
            value={novoMaterial}
            onChange={(e) => setNovoMaterial(e.target.value)}
            placeholder="Código do material · cole vários separados por espaço ou vírgula"
            className="flex-1 min-w-0 h-9 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] font-mono text-[13px] text-[var(--text)] placeholder:font-sans placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={!novoMaterial.trim()}
            className="h-9 px-3.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[13px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] disabled:opacity-40"
          >
            Adicionar
          </button>
        </form>

        {config.materiais_alto_valor.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-3">
            {config.materiais_alto_valor.map((m) => (
              <span
                key={m}
                className={cn(
                  'inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full border text-[12.5px] font-mono',
                  saved.materiais_alto_valor.includes(m) ? 'border-[var(--border-strong)] text-[var(--text)]' : 'border-[var(--accent)] text-[var(--text)]'
                )}
                title={saved.materiais_alto_valor.includes(m) ? undefined : 'Novo · ainda não salvo'}
              >
                {m}
                <button
                  type="button"
                  onClick={() => handleRemoveMaterial(m)}
                  className="h-5 w-5 grid place-items-center rounded-full text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--hover)]"
                  title="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="pt-3 text-[12.5px] text-[var(--text-3)]">Nenhum material na lista.</p>
        )}
      </Section>

      {/* ======================= RODAPÉ ======================= */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={handleRestoreDefaults}
          disabled={saving || isDefault}
          className="text-[12.5px] text-[var(--text-3)] hover:text-[var(--text)] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:hover:text-[var(--text-3)]"
          title="Volta faixas de aging e residuais ao padrão. A lista de materiais é mantida."
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrões
        </button>
      </div>

      {/* Barra de salvar: só aparece com alterações */}
      {dirty && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-5 z-40 flex items-center gap-3 pl-4 pr-2 py-2 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_16px_40px_rgba(0,0,0,.45)] min-w-[min(520px,92vw)]">
          <span className="w-[7px] h-[7px] rounded-full bg-[var(--amber)] shrink-0" />
          <span className="flex-1 text-[13px] text-[var(--text-2)]">
            {valid ? (
              <>Alterações não salvas em {dirtySections.length} seç{dirtySections.length > 1 ? 'ões' : 'ão'}</>
            ) : (
              <span className="text-[var(--red)]">Corrija os campos em vermelho</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setConfig(saved)}
            disabled={saving}
            className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-40"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !valid}
            className="h-8 px-3.5 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[12.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar'}
            {!saving && <kbd className="font-mono text-[10px] opacity-60 border border-current rounded px-1">Ctrl S</kbd>}
          </button>
        </div>
      )}
    </div>
  );
}
