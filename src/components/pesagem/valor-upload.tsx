'use client';

import { useState } from 'react';
import { Upload, Lock, ShieldCheck, Trash2, KeyRound, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import { parseValorExcelFile, MaterialValor } from '@/lib/valor-parser';
import { replaceAllMaterialValores, invalidateMaterialValoresCache } from '@/lib/dashpesagem-api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const ADMIN_PASSWORD = '070594';

interface ValorUploadProps {
  onUploadComplete?: () => void;
}

export function ValorUpload({ onUploadComplete }: ValorUploadProps = {}) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleClearCache = () => {
    invalidateMaterialValoresCache();
    toast.success('Cache limpo! Os valores serão recarregados do banco.');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setMessage('');
      setStatus('idle');
    } else {
      setStatus('error');
      setMessage('Senha de administrador incorreta.');
      toast.error('Senha incorreta!');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage('');
      setStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus('error');
      setMessage('Selecione uma planilha de valores (.xlsx ou .xls)');
      return;
    }

    setUploading(true);
    setStatus('idle');
    setMessage('Processando e validando planilha...');

    try {
      // Parse do arquivo Excel
      const valoresData = await parseValorExcelFile(file);

      if (!valoresData || valoresData.length === 0) {
        throw new Error('Nenhum valor válido encontrado no arquivo.');
      }

      setMessage(`Enviando ${valoresData.length.toLocaleString('pt-BR')} registros para o banco...`);

      // Substitui todos os valores via API Route
      await replaceAllMaterialValores(
        valoresData.map((v: MaterialValor) => ({
          material: v.material,
          valor_unitario: v.valor_unitario,
        }))
      );

      setStatus('success');
      setMessage(`✓ ${valoresData.length.toLocaleString('pt-BR')} materiais e preços atualizados!`);
      toast.success(`${valoresData.length} materiais importados com sucesso!`);
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById('valor-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Notifica o componente pai
      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      setStatus('error');
      const errText = error instanceof Error ? error.message : 'Erro desconhecido';
      setMessage(`Erro: ${errText}`);
      toast.error(errText);
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs overflow-hidden flex flex-col h-full">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center">
              <Lock size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Acesso Restrito</h3>
              <p className="text-[11px] text-[var(--text-3)] font-mono">Tabela de Preços & Valuation</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)]">
            ADMIN PIN
          </span>
        </div>

        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <p className="text-xs text-[var(--text-2)] leading-relaxed">
            A alteração dos valores unitários requer autenticação para evitar modificações acidentais nos custos da operação.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
                <KeyRound size={12} className="text-[var(--accent)]" /> Senha de Administrador
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--surface-2)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text)] font-mono text-xs rounded-[var(--radius)] px-3 py-2 outline-none transition-colors placeholder:text-[var(--text-3)]"
                autoFocus
              />
            </div>

            {message && status === 'error' && (
              <div className="flex items-center gap-2 p-2.5 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] text-xs font-mono">
                <AlertCircle size={14} className="shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full h-9 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] font-bold text-xs tracking-wide shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck size={14} />
              Desbloquear Acesso
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center">
            <Upload size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Valores Unitários</h3>
            <p className="text-[11px] text-[var(--text-3)] font-mono">Atualização de base de preços</p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsAuthenticated(false);
            setPassword('');
            setFile(null);
            setMessage('');
          }}
          className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          Sair
        </button>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Input de arquivo */}
        <div className="space-y-2">
          <label htmlFor="valor-file-input" className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] block">
            Planilha Excel (.xlsx, .xls)
          </label>
          <input
            id="valor-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
            className="w-full text-xs font-mono file:mr-3 file:py-1.5 file:px-3 file:rounded-[var(--radius)] file:border file:border-[var(--border-strong)] file:text-xs file:font-semibold file:bg-[var(--surface-2)] file:text-[var(--text)] hover:file:bg-[var(--hover)] text-[var(--text-2)] cursor-pointer bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius)] p-1.5 focus:border-[var(--accent)] outline-none"
          />
          {file && (
            <p className="text-[11px] font-mono text-[var(--accent)]">
              Arquivo: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Guia de formato */}
        <div className="p-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border)] text-[11px] text-[var(--text-3)] leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-sans font-semibold text-[var(--text-2)]">
            <Info size={12} className="text-[var(--accent)]" /> Colunas esperadas:
          </div>
          <p className="font-mono text-[10.5px]">
            • Coluna 1: <code>Material</code> ou <code>Código</code><br />
            • Coluna 2: <code>Valor</code> ou <code>Preço Unitário</code>
          </p>
        </div>

        {/* Cache & Info */}
        <div className="p-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border)] flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-[var(--text)]">Cache de Precificação</p>
            <p className="text-[10px] text-[var(--text-3)] font-mono">Retenção local de 24h para alta performance</p>
          </div>
          <button
            type="button"
            onClick={handleClearCache}
            className="px-2 py-1 rounded bg-[var(--surface)] hover:bg-[var(--surface-3)] border border-[var(--border-strong)] text-[10.5px] font-mono font-semibold text-[var(--text-2)] hover:text-[var(--text)] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 size={11} className="text-[var(--accent)]" />
            Limpar Cache
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-[var(--radius)] text-xs font-mono",
              status === 'success' && "bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/30",
              status === 'error' && "bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/30",
              status === 'idle' && "bg-[var(--accent-weak)] text-[var(--accent)] border border-[var(--accent)]/30"
            )}
          >
            {status === 'success' && <CheckCircle2 size={14} className="shrink-0" />}
            {status === 'error' && <AlertCircle size={14} className="shrink-0" />}
            {status === 'idle' && <Loader2 size={14} className="animate-spin shrink-0" />}
            <span className="truncate">{message}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full h-9 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--bg)] font-bold text-xs tracking-wide shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Processando e Salvando...
            </>
          ) : (
            <>
              <Upload size={14} />
              Enviar Tabela de Valores
            </>
          )}
        </button>
      </div>
    </div>
  );
}

