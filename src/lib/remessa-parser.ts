import * as XLSX from 'xlsx';
import { RemessaData } from '@/types/aging';

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).trim();
  if (cleanStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return cleanStr;
  }
  if (cleanStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    return cleanStr.replace(/\./g, '/');
  }
  return cleanStr;
}

function cleanString(str: any): string {
  if (!str) return '';
  return String(str).trim();
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).replace(/\./g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

function isRemessaHeaderRow(row: any[]): boolean {
  return row[1] === 'SNVM' && row[2] && String(row[2]).includes('.');
}

function isRemessaItemRow(row: any[]): boolean {
  const col1 = String(row[1] || '').trim();
  const col3 = String(row[3] || '').trim();
  return !!col1.match(/^\d{9}$/) && !!col3.match(/^\d+$/);
}

export async function parseRemessasExcel(file: File): Promise<RemessaData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          blankrows: true,
        });

        const remessas: RemessaData[] = [];
        let currentDataPicking: string | null = null;
        let currentPesoTotal: number | null = null;

        for (let i = 4; i < jsonData.length; i++) {
          const row = jsonData[i];

          if (!row || row.every(cell => !cell)) {
            continue;
          }

          if (isRemessaHeaderRow(row)) {
            currentDataPicking = parseDate(row[2]);
            currentPesoTotal = parseNumber(row[4]);
            continue;
          }

          if (isRemessaItemRow(row)) {
            const remessa: RemessaData = {
              numero_remessa: cleanString(row[1]),
              data_picking: currentDataPicking || undefined,
              peso_total_remessa: currentPesoTotal || undefined,
              item: cleanString(row[3]),
              data_disponibilidade: parseDate(row[5]),
              quantidade: parseNumber(row[6]),
              unidade_medida: cleanString(row[9]),
              material: cleanString(row[10]),
              centro: cleanString(row[13]),
              deposito: cleanString(row[14]),
              descricao_material: cleanString(row[15]),
            };

            if (remessa.numero_remessa && remessa.material && remessa.quantidade > 0) {
              remessas.push(remessa);
            }
          }
        }

        resolve(remessas);
      } catch (error) {
        console.error('Error parsing Excel:', error);
        reject(new Error('Erro ao processar arquivo Excel de remessas'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsBinaryString(file);
  });
}

export function validateRemessasExcel(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          blankrows: false,
        });

        const hasExpectedHeaders =
          jsonData.length > 10 &&
          (jsonData[1]?.includes('LExp') || jsonData[2]?.includes('Remessa'));

        resolve(hasExpectedHeaders);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsBinaryString(file);
  });
}
