'use client';

import { useState, useRef } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { parseRemessasExcel } from '@/lib/remessa-parser';
import { replaceAllRemessas } from '@/lib/dashpesagem-api';
import { RemessaData } from '@/types/aging';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface RemessaUploadProps {
  onUploadComplete: () => void;
}

type Preview = {
  file: File;
  rows: RemessaData[];
  remessas: number;
  materiais: number;
  semRemessa: number;
  semMaterial: number;
  atrasadas: number;
  dataMin: string | null;
  dataMax: string | null;
};

const kb = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** DD/MM/AAAA ou AAAA-MM-DD → Date local */
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}
const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Erro desconhecido';
  }
}

export function RemessaUpload({ onUploadComplete }: RemessaUploadProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; text: string; at: Date } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetInput = () => {
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ---------------- leitura + prévia ---------------- */
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
      let data: RemessaData[];
      try {
        data = await parseRemessasExcel(file);
      } catch (e) {
        throw new Error(`Não foi possível ler a planilha: ${errText(e)}`);
      }
      if (!data?.length) throw new Error('Nenhuma remessa encontrada. Confira se é a exportação do SAP com as colunas esperadas.');

      const semRemessa = data.filter((r) => !String(r.numero_remessa ?? '').trim()).length;
      const semMaterial = data.filter((r) => !String(r.material ?? '').trim()).length;
      if (semRemessa === data.length || semMaterial === data.length) {
        throw new Error('As colunas Remessa e Material não foram encontradas na planilha.');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let min: Date | null = null;
      let max: Date | null = null;
      let atrasadas = 0;
      data.forEach((r) => {
        const d = parseDate(r.data_disponibilidade);
        if (!d) return;
        if (!min || d < min) min = d;
        if (!max || d > max) max = d;
        if (d < today) atrasadas++;
      });

      setPreview({
        file,
        rows: data,
        remessas: new Set(data.map((r) => String(r.numero_remessa))).size,
        materiais: new Set(data.map((r) => String(r.material))).size,
        semRemessa,
        semMaterial,
        atrasadas,
        dataMin: min ? dm(min) : null,
        dataMax: max ? dm(max) : null,
      });
    } catch (e) {
      setLastResult({ ok: false, text: errText(e), at: new Date() });
    } finally {
      setParsing(false);
      resetInput();
    }
  };

  /* ---------------- envio ---------------- */
  const handleUpload = async () => {
    if (!preview) return;
    // linhas sem remessa ou material não entram
    const rows = preview.rows.filter((r) => String(r.numero_remessa ?? '').trim() && String(r.material ?? '').trim());
    setUploading(true);
    try {
      await replaceAllRemessas(rows);
      setLastResult({
        ok: true,
        text: `${rows.length.toLocaleString('pt-BR')} itens de ${preview.remessas.toLocaleString('pt-BR')} remessas importados de ${preview.file.name}`,
        at: new Date(),
      });
      toast.success('Remessas atualizadas');
      setPreview(null);
      onUploadComplete();
    } catch (e) {
      console.error('Erro no upload de remessas:', e);
      setLastResult({ ok: false, text: `Falha ao salvar no banco: ${errText(e)}`, at: new Date() });
      toast.error('Não foi possível salvar as remessas');
    } finally {
      setUploading(false);
    }
  };

  /* ---------------- UI ---------------- */
  const btn =
    'h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';
  const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const invalidas = preview ? preview.rows.filter((r) => !String(r.numero_remessa ?? '').trim() || !String(r.material ?? '').trim()).length : 0;
  const validas = preview ? preview.rows.length - invalidas : 0;

  return (
    <section className="mb-8 max-w-[880px] text-[var(--text)]">
      {/* Cabeçalho da seção */}
      <div className="pb-2.5 border-b border-[var(--border-strong)]">
        <h3 className="text-[15px] font-semibold">Remessas abertas</h3>
        <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">
          Exportação do SAP com os itens aguardando picking. O envio substitui todas as remessas atuais.
        </p>
      </div>

      {/* Área de envio */}
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
            dragOver ? 'border-[var(--accent)] bg-[var(--accent-weak)]' : 'border-[var(--border-strong)] hover:border-[var(--text-3)]',
            (parsing || uploading) && 'pointer-events-none'
          )}
        >
          {parsing ? <Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)] shrink-0" /> : <Upload className="h-5 w-5 text-[var(--text-3)] shrink-0" />}
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">{parsing ? 'Lendo planilha…' : 'Arraste a planilha aqui ou clique para escolher'}</span>
            <span className="block text-[12px] text-[var(--text-3)] leading-relaxed">
              .xlsx ou .xls · colunas{' '}
              <span className="font-mono text-[var(--text-2)]">
                Remessa, Item, Material, Denominação, Qtd, Unidade, Centro, Depósito, Data disp., Data picking
              </span>
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

      {/* Prévia antes de substituir */}
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

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 py-3 border-y border-[var(--border)] mt-2">
            {(
              [
                ['Remessas', preview.remessas.toLocaleString('pt-BR'), `${preview.rows.length.toLocaleString('pt-BR')} itens`],
                ['Materiais', preview.materiais.toLocaleString('pt-BR'), 'distintos'],
                ['Disponibilidade', preview.dataMin ? preview.dataMin.slice(0, 5) : '—', preview.dataMax ? `até ${preview.dataMax}` : 'sem datas'],
                ['Atrasadas', preview.atrasadas.toLocaleString('pt-BR'), 'itens com data já vencida', preview.atrasadas ? 'var(--red)' : ''],
              ] as [string, string, string, string?][]
            ).map(([l, v, s, c], i) => (
              <div key={l} className={cn('px-4 min-w-0', i === 0 ? 'pl-0' : 'border-l border-[var(--border)]', i === 2 && 'max-sm:border-l-0 max-sm:pl-0')}>
                <dt className="text-[12px] text-[var(--text-3)]">{l}</dt>
                <dd className="font-mono text-[18px] font-semibold leading-tight" style={{ color: c || undefined }}>
                  {v}
                </dd>
                <dd className="text-[11.5px] text-[var(--text-3)] truncate">{s}</dd>
              </div>
            ))}
          </dl>

          {invalidas > 0 && (
            <p className="mt-2 text-[12px] text-[var(--amber)] flex items-start gap-2">
              <span className="w-[7px] h-[7px] rounded-full mt-[5px] shrink-0 bg-[var(--amber)]" />
              {invalidas} linha(s) sem remessa ou material serão ignoradas.
            </p>
          )}

          {/* Amostra */}
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-[12.5px] border-separate border-spacing-0">
              <thead>
                <tr className="text-[11.5px] text-[var(--text-3)]">
                  <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)]">Remessa</th>
                  <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)]">Item</th>
                  <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)]">Material</th>
                  <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)] hidden sm:table-cell">Descrição</th>
                  <th className="h-7 px-2 text-right font-medium border-b border-[var(--border)]">Qtd.</th>
                  <th className="h-7 px-2 text-left font-medium border-b border-[var(--border)] hidden sm:table-cell">Disponib.</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 5).map((r, i) => (
                  <tr key={`${r.numero_remessa}-${r.item}-${i}`}>
                    <td className="h-8 px-2 border-b border-[var(--border)] font-mono">{r.numero_remessa || '—'}</td>
                    <td className="h-8 px-2 border-b border-[var(--border)] font-mono text-[var(--text-2)]">{r.item}</td>
                    <td className="h-8 px-2 border-b border-[var(--border)] font-mono">{r.material || '—'}</td>
                    <td className="h-8 px-2 border-b border-[var(--border)] text-[var(--text-2)] max-w-[240px] truncate hidden sm:table-cell" title={r.descricao_material}>
                      {r.descricao_material}
                    </td>
                    <td className="h-8 px-2 border-b border-[var(--border)] font-mono text-right whitespace-nowrap">
                      {Number(r.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                      <span className="text-[11px] text-[var(--text-3)]">{r.unidade_medida}</span>
                    </td>
                    <td className="h-8 px-2 border-b border-[var(--border)] font-mono text-[var(--text-2)] hidden sm:table-cell">{r.data_disponibilidade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 5 && (
            <p className="px-2 pt-1.5 text-[12px] text-[var(--text-3)]">+ {(preview.rows.length - 5).toLocaleString('pt-BR')} itens</p>
          )}

          <div className="flex items-center justify-end gap-2 mt-4">
            <button type="button" onClick={() => setPreview(null)} disabled={uploading} className={btn}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || validas === 0}
              className="h-9 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Salvando…' : `Substituir remessas · ${validas.toLocaleString('pt-BR')} itens`}
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
    </section>
  );
}
