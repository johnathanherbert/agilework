"use client";

import React, { useState } from "react";
import { CloudArrowUpIcon, CheckIcon } from "@heroicons/react/24/outline";
import * as XLSX from 'xlsx';
import { uploadExcelAging } from "@/lib/dashpesagem-api";
import toast from 'react-hot-toast';

interface ExcelUploaderProps {
  onDataUpdated: () => void;
  openUploadDialog: boolean;
  handleCloseUploadDialog: () => void;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({
  onDataUpdated,
  openUploadDialog,
  handleCloseUploadDialog,
}) => {
  const [uploading, setUploading] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");

  if (!openUploadDialog) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          setExcelData(jsonData);
        } catch (err) {
          console.error("Erro ao ler Excel:", err);
          toast.error("Erro ao processar planilha Excel");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processData = async () => {
    if (excelData.length === 0) return;
    setUploading(true);

    try {
      const rows = excelData.filter(row => 
        Array.isArray(row) &&
        row.some(cell => typeof cell === 'string' ? cell.trim() : cell) && 
        !String(row[0] || '').includes("Estoques WM") && 
        !String(row[0] || '').includes("Nº depósito")
      );

      if (rows.length < 2) {
        throw new Error("Planilha vazia ou sem cabeçalho válido");
      }

      const headers = rows[0].map((h: any) => String(h || '').trim());
      const dataRows = rows.slice(1);

      // Normaliza as colunas do SAP (LX02 / LS24 / Ajuste)
      const columnMapping: Record<string, string> = {
        "Material": "material",
        "Texto breve material": "texto_breve_material",
        "Texto breve de material": "texto_breve_material",
        "Lote": "lote",
        "Estoque disponível": "estoque_disponivel",
        "UMB": "unidade_medida",
        "Centro": "centro",
        "Depósito": "deposito",
        "Depósito ": "deposito",
        "Tipo depósito": "tipo_deposito",
        "Tipo": "tipo_deposito",
        "Posição depósito": "posicao_deposito",
        "Pos.depósito": "posicao_deposito",
        "Posição": "posicao_deposito",
        "Tipo de estoque": "tipo_estoque",
        "Data da entrada de mercadorias": "ultima_entrada_deposito",
        "Último movimento": "ultimo_movimento",
        "Data vencimento": "data_vencimento",
        "Vencimento": "data_vencimento",
      };

      const formattedData = dataRows
        .filter(row => Array.isArray(row) && row.some(c => c !== undefined && c !== null && c !== ''))
        .map(row => {
          const item: any = {
            deposito: 'PES',
            tipo_deposito: 'PES',
            posicao_deposito: 'PESAGEM',
            unidade_medida: 'KG',
            centro: '600',
          };

          headers.forEach((header: string, index: number) => {
            const mappedKey = columnMapping[header] || Object.entries(columnMapping).find(([k]) => header.toLowerCase().includes(k.toLowerCase()))?.[1];
            if (mappedKey) {
              let value = row[index];
              if (typeof value === 'string') value = value.trim();

              if (mappedKey === 'estoque_disponivel') {
                if (typeof value === 'string') {
                  value = parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
                }
              } else if (mappedKey === 'material') {
                value = String(value || '').padStart(6, '0');
              }
              item[mappedKey] = value;
            }
          });

          return item;
        })
        .filter(item => item.material && item.estoque_disponivel > 0);

      if (formattedData.length === 0) {
        throw new Error("Nenhum registro válido encontrado para upload");
      }

      const result = await uploadExcelAging(formattedData);
      toast.success(`Estoque atualizado! ${result.count || formattedData.length} itens sincronizados.`);
      onDataUpdated();
      handleCloseUploadDialog();
    } catch (err: any) {
      console.error("Erro ao subir dados de estoque:", err);
      toast.error(err.message || "Erro ao processar dados");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudArrowUpIcon className="w-5 h-5" />
            <h2 className="text-base font-bold">Atualizar Saldo na Área (Excel SAP)</h2>
          </div>
          <button onClick={handleCloseUploadDialog} className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Selecione a planilha exportada do SAP (ajuste / estoques WM) para calcular o saldo na área e as necessidades de pesagem.
          </p>

          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <CloudArrowUpIcon className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                  {fileName ? fileName : "Clique para selecionar a planilha (.xlsx, .xls)"}
                </p>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
            </label>
          </div>

          {excelData.length > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs flex items-center gap-2">
              <CheckIcon className="w-4 h-4 shrink-0" />
              <span>{excelData.length} linhas carregadas da planilha.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-2">
          <button
            onClick={handleCloseUploadDialog}
            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={processData}
            disabled={uploading || excelData.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? "Processando..." : "Processar e Sincronizar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelUploader;
