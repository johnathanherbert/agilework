export interface ParsedBarcode {
  material: string;
  lote: string;
  quantidade?: number | null;
  volume?: string | null;
  raw: string;
  extra?: string[];
}

/**
 * Faz o parsing de códigos de barras (ex: padrão Code 128 / Pesagem com Material, Lote, Qtd do Volume, etc.)
 */
export function parseBarcode(rawText: string): ParsedBarcode {
  const clean = (rawText || '').trim();
  if (!clean) {
    return { material: '', lote: '', raw: '' };
  }

  let parts = clean.split(/[\t\s]+/);

  if (parts.length === 1) {
    if (clean.includes(';')) {
      parts = clean.split(';');
    } else if (clean.includes('|')) {
      parts = clean.split('|');
    }
  }

  const material = parts[0]?.trim() || '';
  const lote = parts[1]?.trim() || '';
  const qtdRaw = parts[2]?.trim() || '';

  // Limpa sufixos de unidade como 'KG', 'UN', 'G' ou prefixos 'Q'
  let quantidade: number | null = null;
  if (qtdRaw) {
    const cleanedNumber = qtdRaw
      .replace(/^[Qq:]+/, '')
      .replace(/[A-Za-z]+$/, '')
      .replace(/\s/g, '')
      .replace(',', '.');
    const parsedNum = parseFloat(cleanedNumber);
    if (!isNaN(parsedNum)) {
      quantidade = parsedNum;
    }
  }

  // Tenta extrair número do volume (se presente na 4ª posição ou extra)
  let volume: string | null = null;
  const volCandidate = parts[3]?.trim();
  if (volCandidate) {
    const cleanVol = volCandidate.replace(/^[Vv]([Oo][Ll])?[:.]?/, '').trim();
    if (cleanVol) {
      volume = cleanVol;
    }
  }

  return {
    material,
    lote,
    quantidade,
    volume,
    raw: clean,
    extra: parts.slice(3),
  };
}

