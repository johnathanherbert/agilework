import wipRecipesData from '@/data/wip-recipes.json';
import { ProductionVia } from '@/types';
import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface WipRecipe {
  codigo: string;
  produto: string;
  familia: string;
  via?: ProductionVia;
}

const staticWipRecipes = wipRecipesData as WipRecipe[];
let customWipRecipes: WipRecipe[] = [];
let isFirestoreLoaded = false;

// Função para escutar a coleção em tempo real
function initCustomRecipesListener() {
  if (typeof window === 'undefined') return;
  try {
    const q = query(collection(db, 'custom_routes'), orderBy('created_at', 'desc'));
    
    // Busca inicial imediata com getDocs para ter os dados disponíveis o quanto antes
    getDocs(q).then((snapshot) => {
      customWipRecipes = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          codigo: String(data.codigo || ''),
          produto: String(data.produto || ''),
          familia: String(data.familia || ''),
          via: (data.via as ProductionVia) || 'SECA',
        };
      });
      isFirestoreLoaded = true;
    }).catch((err) => {
      console.error('Erro ao fazer busca inicial de custom_routes:', err);
    });

    // Listener em tempo real para atualizações subsequentes
    onSnapshot(q, (snapshot) => {
      customWipRecipes = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          codigo: String(data.codigo || ''),
          produto: String(data.produto || ''),
          familia: String(data.familia || ''),
          via: (data.via as ProductionVia) || 'SECA',
        };
      });
      isFirestoreLoaded = true;
    }, (err) => {
      console.error('Erro ao sincronizar rotas customizadas no wip-recipes:', err);
    });
  } catch (e) {
    console.error('Erro ao inicializar escuta de rotas no Firestore:', e);
  }
}

initCustomRecipesListener();

// Normaliza texto para permitir busca sem se preocupar com espaços ou maiúsculas
function normalizeText(text: string): string {
  return (text || '').trim().toUpperCase();
}

/**
 * Retorna todas as receitas cadastradas (unindo estáticas do rotas.json e dinâmicas do Firestore)
 */
export function getAllWipRecipes(): WipRecipe[] {
  if (customWipRecipes.length === 0) {
    return staticWipRecipes;
  }

  // Sobrescreve receitas estáticas se houver uma customizada com mesmo código
  const customCodes = new Set(customWipRecipes.map(c => normalizeText(c.codigo)));
  const filteredStatic = staticWipRecipes.filter(r => !customCodes.has(normalizeText(r.codigo)));
  
  return [...customWipRecipes, ...filteredStatic];
}

/**
 * Busca uma receita/ordem do WIP pelo código do material (ex: "700071I").
 * Usado para autocompletar via, família e produto no formulário do Painel de Produção.
 */
export function findWipRecipeByCode(code: string): WipRecipe | undefined {
  if (!code) return undefined;
  const normalized = normalizeText(code);
  return getAllWipRecipes().find((recipe) => normalizeText(recipe.codigo) === normalized);
}

/**
 * Busca uma receita/ordem pelo nome do produto.
 */
export function findWipRecipeByProduct(produto: string): WipRecipe | undefined {
  if (!produto) return undefined;
  const normalized = normalizeText(produto);
  return getAllWipRecipes().find((recipe) => normalizeText(recipe.produto) === normalized);
}

/**
 * Pesquisa receitas por código, descrição de produto ou família.
 */
export function searchWipRecipes(queryStr: string, limit = 15): WipRecipe[] {
  if (!queryStr || queryStr.trim().length < 2) return [];
  const q = normalizeText(queryStr);

  const recipes = getAllWipRecipes();
  const results: WipRecipe[] = [];
  for (const recipe of recipes) {
    if (
      normalizeText(recipe.codigo).includes(q) ||
      normalizeText(recipe.produto).includes(q) ||
      normalizeText(recipe.familia).includes(q)
    ) {
      results.push(recipe);
      if (results.length >= limit) break;
    }
  }
  return results;
}

/**
 * Obtém a lista de todas as Famílias de Produtos únicas do rotas.json e Firestore
 */
export function getWipFamilies(): string[] {
  const families = new Set<string>();
  getAllWipRecipes().forEach((r) => {
    if (r.familia) families.add(r.familia.trim());
  });
  return Array.from(families).sort();
}


