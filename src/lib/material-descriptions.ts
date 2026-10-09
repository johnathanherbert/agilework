/**
 * lib/material-descriptions.ts
 * Cache persistente e centralizado de descrições de materiais no módulo de Pesagem.
 * Garante que mesmo quando um material ou lote sai do depósito (estoque 0),
 * sua descrição permaneça sempre disponível em todas as abas (TODO, Scanner, etc.).
 */

const STORAGE_KEY = 'pesagem_material_descriptions_cache';

// Cache em memória
const memoryMap = new Map<string, string>();
let isLoadedFromStorage = false;

function norm(mat?: string | null): string {
  if (!mat) return '';
  return String(mat).trim().replace(/^0+/, '');
}

function loadStorage(): void {
  if (isLoadedFromStorage || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: Record<string, string> = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        if (v && v.trim()) {
          memoryMap.set(k, v.trim());
          const n = norm(k);
          if (n) memoryMap.set(n, v.trim());
        }
      }
    }
    isLoadedFromStorage = true;
  } catch {
    // Falha silenciosa em ambientes restritos
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function persistToStorageDebounced(): void {
  if (typeof window === 'undefined') return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj: Record<string, string> = {};
      memoryMap.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // QuotaExceededError handling
    }
  }, 300);
}

/**
 * Salva uma descrição para o material informado
 */
export function rememberMaterialDescription(material?: string | null, description?: string | null): void {
  if (!material || !description) return;
  loadStorage();
  const mat = String(material).trim();
  const desc = String(description).trim();
  if (!mat || !desc || desc.toLowerCase() === 'sem descrição') return;

  memoryMap.set(mat, desc);
  const n = norm(mat);
  if (n) memoryMap.set(n, desc);

  persistToStorageDebounced();
}

/**
 * Registra um lote de itens contendo material e descrição (Aging, Remessas, TODOs, etc.)
 */
export function rememberMaterialDescriptions(
  items: Array<{
    material?: string | null;
    texto_breve_material?: string | null;
    descricao_material?: string | null;
    mp_nome?: string | null;
  }>
): void {
  if (!Array.isArray(items) || items.length === 0) return;
  loadStorage();
  let changed = false;

  for (const item of items) {
    if (!item || !item.material) continue;
    const mat = String(item.material).trim();
    const desc = (item.texto_breve_material || item.descricao_material || item.mp_nome || '').trim();
    if (!mat || !desc || desc.toLowerCase() === 'sem descrição') continue;

    const existing = memoryMap.get(mat);
    if (existing !== desc) {
      memoryMap.set(mat, desc);
      const n = norm(mat);
      if (n) memoryMap.set(n, desc);
      changed = true;
    }
  }

  if (changed) {
    persistToStorageDebounced();
  }
}

/**
 * Recupera a descrição de um material pelo código.
 * Se não encontrar, retorna o fallback fornecido ou string vazia.
 */
export function getMaterialDescription(material?: string | null, fallback?: string): string {
  if (!material) return fallback || '';
  loadStorage();
  const mat = String(material).trim();
  const n = norm(mat);

  const found = memoryMap.get(mat) || memoryMap.get(n);
  if (found && found.trim()) return found.trim();

  return (fallback || '').trim();
}
