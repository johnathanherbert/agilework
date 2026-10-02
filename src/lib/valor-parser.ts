import * as XLSX from 'xlsx';

export interface MaterialValor {
  material: string;
  valor_unitario: number;
  data_atualizacao?: Date;
}

export function parseValorExcelFile(file: File): Promise<MaterialValor[]> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Arquivo não fornecido'));
      return;
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      reject(new Error('Formato de arquivo inválido. Use .xlsx ou .xls'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        
        if (!data) {
          reject(new Error('Não foi possível ler o arquivo'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('Planilha vazia ou sem abas'));
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        if (!worksheet) {
          reject(new Error('Não foi possível acessar a planilha'));
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Planilha sem dados'));
          return;
        }

        const valoresData: MaterialValor[] = [];
        let linhasProcessadas = 0;
        let linhasIgnoradas = 0;
        
        jsonData.forEach((row: any) => {
          const allKeys = Object.keys(row);
          
          let materialKey: string | undefined = allKeys.find(key => key === 'Material');
          if (!materialKey) {
            materialKey = allKeys.find(key => 
              key.toLowerCase().includes('material') && 
              !key.toLowerCase().includes('texto') &&
              !key.toLowerCase().includes('tipo')
            );
          }
          if (!materialKey) {
            materialKey = allKeys.find(key => 
              key.toLowerCase().includes('codigo') ||
              key.toLowerCase().includes('código')
            );
          }
          
          let valorKey: string | undefined = allKeys.find(key => key === 'Valor unitário');
          if (!valorKey) {
            valorKey = allKeys.find(key => 
              key.toLowerCase().includes('valor') && 
              key.toLowerCase().includes('unitário')
            );
          }
          if (!valorKey) {
            valorKey = allKeys.find(key => 
              key.toLowerCase().includes('valor') ||
              key.toLowerCase().includes('preco') ||
              key.toLowerCase().includes('preço')
            );
          }

          if (!materialKey || !valorKey) {
            linhasIgnoradas++;
            return;
          }

          const material = String(row[materialKey] || '').trim();
          const valorRaw = row[valorKey];
          
          let valor = 0;
          if (typeof valorRaw === 'number') {
            valor = valorRaw;
          } else {
            const valorStr = String(valorRaw || '0').replace(',', '.');
            valor = parseFloat(valorStr);
          }

          if (!material || material === '' || isNaN(valor) || valor < 0) {
            linhasIgnoradas++;
            return;
          }

          valoresData.push({
            material,
            valor_unitario: valor,
            data_atualizacao: new Date(),
          });
          linhasProcessadas++;
        });

        if (valoresData.length === 0) {
          reject(new Error(`Nenhum dado válido encontrado. ${linhasIgnoradas} linhas foram ignoradas por dados inválidos ou colunas não reconhecidas. Verifique se a planilha tem colunas "Material" e "Valor Unitário".`));
          return;
        }

        resolve(valoresData);

      } catch (error) {
        console.error('Erro ao processar arquivo Excel:', error);
        reject(new Error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsBinaryString(file);
  });
}
