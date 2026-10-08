'use client';

import { useState, useRef } from 'react';
import { Loader2, Upload, X, Lock } from 'lucide-react';
import { parseValorExcelFile, MaterialValor } from '@/lib/valor-parser';
import { replaceAllMaterialValores, invalidateMaterialValoresCache } from '@/lib/dashpesagem-api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ⚠️ Proteção apenas de interface: a API de substituição também deve exigir autorização no servidor.
const ADMIN_PASSWORD = '070594';

interface ValorUploadProps {
  onUploadComplete?: () => void;
}

type Preview = {
  file: File;
  rows: MaterialValor[];
  duplicados: number;
  zerados: number;
  min: number;
  max: number;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 4 });
const kb = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function ValorUpload({ onUploadComplete }: ValorUploadProps = {}) {
  const [password, setPassword] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; text: string; at: Date } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---------------- acesso ---------------- */
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPinError(false);
      setPassword('');
    } else {
      setPinError(true);
      setPassword('');
    }
  };

  const lock = () => {
    setIsAuthenticated(false);
    setPreview(null);
    setLastResult(null);
  };

  /* ---------------- arquivo ---------------- */
  const resetInput = () => {
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Use uma planilha .xlsx ou .xls');
      resetInput();
      return;
    }
    setParsing(true);
    setPreview(null);
    setLastResult(null);
    try {
      const parsed = await parseValorExcelFile(file);
      if (!parsed?.length) throw new Error('Nenhum valor válido encontrado. Confira as colunas Material e Valor.');
      // último valor de cada material prevalece
      const map = new Map<string, MaterialValor>();
      parsed.forEach((r) => map.set(String(r.material).trim(), r));
      const rows = Array.from(map.values());
      const vals = rows.map((r) => Number(r.valor_unitario) || 0);
      setPreview({
        file,
        rows,
        duplicados: parsed.length - rows.length,
        zerados: vals.filter((v) => v <= 0).length,
        min: Math.min(...vals),
        max: Math.max(...vals),
      });
    } catch (err) {
      const t = err instanceof Error ? err.message : 'Não foi possível ler a planilha';
      setLastResult({ ok: false, text: t, at: new Date() });
    } finally {
      setParsing(false);
      resetInput();
    }
  };

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      await replaceAllMaterialValores(
        preview.rows.map((v) => ({ material: v.material, valor_unitario: v.valor_unitario }))
      );
      invalidateMaterialValoresCache();
      const n = preview.rows.length;
      setLastResult({ ok: true, text: `${n.toLocaleString('pt-BR')} valores importados de ${preview.file.name}`, at: new Date() });
      toast.success('Tabela de valores atualizada');
      setPreview(null);
      onUploadComplete?.();
    } catch (err) {
      console.error('Erro no upload de valores:', err);
      const t = err instanceof Error ? err.message : 'Erro desconhecido';
      setLastResult({ ok: false, text: `Falha ao salvar: ${t}`, at: new Date() });
      toast.error('Não foi possível salvar os valores');
    } finally {
      setUploading(false);
    }
  };

  const handleClearCache = () => {
    invalidateMaterialValoresCache();
    toast.success('Cache limpo · os valores serão recarregados do banco');
  };

  /* ---------------- UI ---------------- */
  const btn =
    'h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';
  const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <section className="mb-8 max-w-[880px] text-[var(--text)]">
      {/* Cabeçalho da seção (mesmo padrão de Configurações) */}
      <div className="flex items-end justify-between gap-3 pb-2.5 border-b border-[var(--border-strong)]">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2">
            Valores unitários
            <span className="text-[10.5px] font-medium text-[var(--amber)] border border-[var(--border-strong)] rounded px-1 leading-4">
              protegido
            </span>
          </h3>
          <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">
            R$ por unidade de cada material, usado para valorizar o estoque. O envio substitui a tabela inteira.
          </p>
        </div>
        {isAuthenticated && (
          <button type="button" onClick={lock} className="text-[12.5px] text-[var(--text-3)] hover:text-[var(--text)] inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Bloquear
          </button>
        )}
      </div>

      {/* ---------- Bloqueado ---------- */}
      {!isAuthenticated ? (
        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 items-center py-3.5">
          <div>
            <span className="block text-[13px] font-medium">Senha de administrador</span>
            <span className={cn('block text-[12px] mt-0.5', pinError ? 'text-[var(--red)]' : 'text-[var(--text-3)]')}>
              {pinError ? 'Senha incorreta. Tente de novo.' : 'Necessária para trocar a tabela de preços.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPinError(false);
              }}
              placeholder="Senha"
              className={cn(
                'h-9 w-[132px] px-2.5 bg-[var(--bg)] border rounded-[var(--radius)] font-mono text-[13px] tracking-[.2em] text-center outline-none focus:border-[var(--accent)]',
                pinError ? 'border-[var(--red)]' : 'border-[var(--border-strong)]'
              )}
            />
            <button type="submit" disabled={!password} className={cn(btn, 'h-9')}>
              Desbloquear
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* ---------- Área de envio ---------- */}
          {!preview && (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                'mt-3.5 flex items-center gap-4 px-4 py-4 border border-dashed rounded-[var(--radius)] cursor-pointer transition-colors',
                dragOver ? 'border-[var(--accent)] bg-[var(--accent-weak)]' : 'border-[var(--border-strong)] hover:border-[var(--text-3)]'
              )}
            >
              {parsing ? <Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" /> : <Upload className="h-5 w-5 text-[var(--text-3)]" />}
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{parsing ? 'Lendo planilha…' : 'Arraste a planilha aqui ou clique para escolher'}</span>
                <span className="block text-[12px] text-[var(--text-3)]">
                  .xlsx ou .xls · colunas <span className="font-mono text-[var(--text-2)]">Material</span> (ou Código) e{' '}
                  <span className="font-mono text-[var(--text-2)]">Valor</span> (ou Preço unitário)
                </span>
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={parsing || uploading}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          )}

          {/* ---------- Prévia antes de substituir ---------- */}
          {preview && (
            <div className="mt-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium truncate">
                  {preview.file.name} <span className="font-normal text-[var(--text-3)]">· {kb(preview.file.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  disabled={uploading}
                  className="h-7 w-7 grid place-items-center rounded text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-40"
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 py-3 border-y border-[var(--border)] mt-2">
                {[
                  ['Materiais', preview.rows.length.toLocaleString('pt-BR'), ''],
                  ['Menor valor', brl(preview.min), ''],
                  ['Maior valor', brl(preview.max), ''],
                  ['Atenção', preview.zerados ? `${preview.zerados} zerado(s)` : preview.duplicados ? `${preview.duplicados} repetido(s)` : 'nenhuma', preview.zerados ? 'var(--amber)' : ''],
                ].map(([l, v, c], i) => (
                  <div key={l} className={cn('px-4 min-w-0', i === 0 ? 'pl-0' : 'border-l border-[var(--border)]', i === 2 && 'max-sm:border-l-0 max-sm:pl-0')}>
                    <dt className="text-[12px] text-[var(--text-3)]">{l}</dt>
                    <dd className="font-mono text-[15px] font-medium truncate" style={{ color: c || undefined }}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              {preview.duplicados > 0 && (
                <p className="mt-2 text-[12px] text-[var(--text-3)]">
                  {preview.duplicados} material(is) aparecem mais de uma vez; vale o último valor da planilha.
                </p>
              )}

              {/* Amostra */}
              <table className="w-full mt-3 text-[12.5px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-[11.5px] text-[var(--text-3)]">
                    <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)]">Material</th>
                    <th className="h-7 px-2 text-right font-medium border-b border-[var(--border)]">Valor unitário</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 6).map((r) => (
                    <tr key={r.material}>
                      <td className="h-8 px-2 border-b border-[var(--border)] font-mono">{r.material}</td>
                      <td className={cn('h-8 px-2 border-b border-[var(--border)] font-mono text-right', Number(r.valor_unitario) <= 0 && 'text-[var(--amber)]')}>
                        {brl(Number(r.valor_unitario) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 6 && (
                <p className="px-2 pt-1.5 text-[12px] text-[var(--text-3)]">+ {(preview.rows.length - 6).toLocaleString('pt-BR')} materiais</p>
              )}

              <div className="flex items-center justify-end gap-2 mt-4">
                <button type="button" onClick={() => setPreview(null)} disabled={uploading} className={cn(btn, 'h-9')}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="h-9 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? 'Salvando…' : `Substituir tabela · ${preview.rows.length.toLocaleString('pt-BR')} valores`}
                </button>
              </div>
            </div>
          )}

          {/* Resultado do último envio */}
          {lastResult && (
            <p className={cn('mt-3 text-[12.5px] flex items-start gap-2', lastResult.ok ? 'text-[var(--text-2)]' : 'text-[var(--red)]')}>
              <span className="w-[7px] h-[7px] rounded-full mt-[6px] shrink-0" style={{ background: lastResult.ok ? 'var(--green)' : 'var(--red)' }} />
              <span>
                {lastResult.text} <span className="text-[var(--text-3)] font-mono">· {hhmm(lastResult.at)}</span>
              </span>
            </p>
          )}

          {/* Cache */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 items-center py-3.5 mt-3 border-t border-[var(--border)]">
            <div>
              <span className="block text-[13px] font-medium">Cache de valores</span>
              <span className="block text-[12px] text-[var(--text-3)] mt-0.5">
                Os preços ficam guardados no navegador por 24 h. Limpe se a tela mostrar valores antigos.
              </span>
            </div>
            <button type="button" onClick={handleClearCache} className={btn}>
              Limpar cache
            </button>
          </div>
        </>
      )}
    </section>
  );
}