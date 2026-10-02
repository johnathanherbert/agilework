'use client';

import { useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle, Package, Info } from 'lucide-react';
import { parseRemessasExcel } from '@/lib/remessa-parser';
import { replaceAllRemessas } from '@/lib/dashpesagem-api';
import { RemessaData } from '@/types/aging';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface RemessaUploadProps {
  onUploadComplete: () => void;
}

export function RemessaUpload({ onUploadComplete }: RemessaUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus('error');
      setMessage('Por favor, selecione um arquivo de remessas (.xlsx ou .xls)');
      return;
    }

    setUploading(true);
    setStatus('idle');
    setMessage('Processando arquivo de remessas do SAP...');

    try {
      // Parse do Excel
      let data: RemessaData[];

      try {
        data = await parseRemessasExcel(file);
      } catch (parseError) {
        throw new Error(`Erro ao processar Excel: ${parseError instanceof Error ? parseError.message : 'Formato inválido'}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhuma remessa encontrada no arquivo. Verifique se a planilha contém dados válidos do SAP.');
      }

      // Validar estrutura dos dados
      const primeiraRemessa = data[0];
      if (!primeiraRemessa.numero_remessa || !primeiraRemessa.material) {
        throw new Error('Dados inválidos: campos obrigatórios (Remessa, Material) não encontrados.');
      }

      // Upload para o banco
      setMessage(`Enviando ${data.length.toLocaleString('pt-BR')} itens de remessa para o banco...`);

      try {
        await replaceAllRemessas(data);
      } catch (uploadError) {
        throw new Error(`Erro ao salvar no banco: ${uploadError instanceof Error ? uploadError.message : 'Falha na conexão'}`);
      }

      setStatus('success');
      setMessage(`✓ ${data.length.toLocaleString('pt-BR')} itens de remessa importados com sucesso!`);
      toast.success(`${data.length} remessas carregadas com sucesso!`);
      setFile(null);

      // Limpa o input
      const fileInput = document.getElementById('remessa-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Notifica o componente pai
      setTimeout(() => {
        onUploadComplete();
      }, 1000);

    } catch (error) {
      console.error('Erro no upload de remessas:', error);
      setStatus('error');

      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      setMessage(`Erro: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xs overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center">
            <Package size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Remessas SAP</h3>
            <p className="text-[11px] text-[var(--text-3)] font-mono">Ordens e Picking pendentes</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)]">
          SAP EXP
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Input de arquivo */}
        <div className="space-y-2">
          <label htmlFor="remessa-file" className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] block">
            Planilha de Remessas (.xlsx, .xls)
          </label>
          <input
            id="remessa-file"
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
            <Info size={12} className="text-[var(--accent)]" /> Colunas esperadas no relatório SAP:
          </div>
          <p className="font-mono text-[10.5px]">
            <code>Remessa, Data picking, Item, Data disp., Qtd, Unidade, Material, Centro, Depósito, Denominação</code>
          </p>
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
              Processando Remessas...
            </>
          ) : (
            <>
              <Upload size={14} />
              Enviar Planilha de Remessas
            </>
          )}
        </button>
      </div>
    </div>
  );
}

