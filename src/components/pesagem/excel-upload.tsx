'use client';

import React, { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, X, ArrowUpRight } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel-parser';
import { replaceAllAgingData, saveSnapshotHistorico, fetchMaterialValores } from '@/lib/dashpesagem-api';
import { AgingData } from '@/types/aging';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ExcelUploadProps {
  onUploadComplete: () => void;
  onClose?: () => void;
}

export function ExcelUpload({ onUploadComplete, onClose }: ExcelUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus('error');
      setMessage('Por favor, selecione um arquivo Excel (MB52 ou LX02).');
      return;
    }

    setUploading(true);
    setStatus('idle');
    setMessage('Lendo e estruturando dados da planilha...');

    try {
      let data: AgingData[];

      try {
        data = await parseExcelFile(file);
      } catch (parseError) {
        throw new Error(
          `Erro ao processar arquivo: ${parseError instanceof Error ? parseError.message : 'Formato inválido'}`
        );
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhum lote válido foi encontrado no arquivo. Verifique se o formato corresponde ao relatório MB52/LX02.');
      }

      const primeiroItem = data[0];
      if (!primeiroItem.material || !primeiroItem.lote) {
        throw new Error('Campos obrigatórios ausentes: certifique-se de que a planilha possui as colunas Material e Lote.');
      }

      setMessage(`Enviando ${data.length.toLocaleString('pt-BR')} registros para a base de dados...`);

      try {
        await replaceAllAgingData(data);
      } catch (uploadError) {
        throw new Error(
          `Falha ao salvar no banco: ${uploadError instanceof Error ? uploadError.message : 'Erro na conexão'}`
        );
      }

      setMessage('Atualizando snapshot de histórico financeiro...');
      try {
        const valores = await fetchMaterialValores();
        await saveSnapshotHistorico(data, valores);
      } catch {
        // Ignora erro de histórico
      }

      setStatus('success');
      setMessage(`✓ ${data.length.toLocaleString('pt-BR')} registros importados com sucesso!`);
      toast.success(`${data.length} lotes carregados com sucesso!`);
      setFile(null);

      if (fileInputRef.current) fileInputRef.current.value = '';

      setTimeout(() => {
        onUploadComplete();
      }, 800);
    } catch (error) {
      console.error('Erro no upload de estoque:', error);
      setStatus('error');
      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      setMessage(`Erro: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Zona de Drop / Seleção */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer bg-[var(--surface-2)] flex flex-col items-center justify-center gap-2",
          isDragOver
            ? "border-[var(--accent)] bg-[var(--accent-weak)] ring-2 ring-[var(--accent)]"
            : "border-[var(--border-strong)] hover:border-[var(--text-3)]",
          uploading && "opacity-50 pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.txt,.tsv"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--accent)] shadow-xs">
          <Upload size={18} />
        </div>

        <div>
          <p className="text-xs font-semibold text-[var(--text)]">
            {file ? file.name : 'Arraste o arquivo Excel aqui ou clique para selecionar'}
          </p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5 font-mono">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Suporta relatórios SAP (.xlsx, .xls, .txt, .tsv)'}
          </p>
        </div>
      </div>

      {/* Mensagem de Status */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2.5 p-3 rounded-[var(--radius)] text-xs font-mono",
            status === 'success' && "bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/30",
            status === 'error' && "bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/30",
            status === 'idle' && "bg-[var(--accent-weak)] text-[var(--accent)] border border-[var(--accent)]/30"
          )}
        >
          {status === 'success' && <CheckCircle2 size={15} className="shrink-0" />}
          {status === 'error' && <AlertCircle size={15} className="shrink-0" />}
          {status === 'idle' && <Loader2 size={15} className="animate-spin shrink-0" />}
          <span className="truncate">{message}</span>
        </div>
      )}

      {/* Regras e Colunas Esperadas */}
      <div className="p-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border)] text-[11px] text-[var(--text-3)] leading-relaxed">
        <b className="text-[var(--text-2)] block mb-1 font-sans">Colunas esperadas no relatório:</b>
        <code>Material, Texto breve, UMB, Lote, Centro, Depósito, Tipo depósito, Posição depósito, Estoque disponível, Vencimento, Último movimento</code>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
        {onClose && (
          <button
            type="button"
            className="btn sm"
            onClick={onClose}
            disabled={uploading}
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          className="btn primary sm"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload size={13} />
              Atualizar Dados
            </>
          )}
        </button>
      </div>
    </div>
  );
}
