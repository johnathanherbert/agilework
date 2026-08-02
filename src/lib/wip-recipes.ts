import wipRecipesData from '@/data/wip-recipes.json';
import { ProductionVia } from '@/types';

export interface WipRecipe {
  codigo: string;
  produto: string;
  familia: string;
  via?: ProductionVia;
}

const wipRecipes = wipRecipesData as WipRecipe[];

// Normaliza texto para permitir busca sem se preocupar com espaços ou maiúsculas
function normalizeText(text: string): string {
  return text.trim().toUpperCase();
}

/**
 * Retorna todas as receitas cadastradas no rotas.json
 */
export function getAllWipRecipes(): WipRecipe[] {
  return wipRecipes;
}

/**
 * Busca uma receita/ordem do WIP pelo código do material (ex: "700071I").
 * Usado para autocompletar via, família e produto no formulário do Painel de Produção.
 */
export function findWipRecipeByCode(code: string): WipRecipe | undefined {
  if (!code) return undefined;
  const normalized = normalizeText(code);
  return wipRecipes.find((recipe) => normalizeText(recipe.codigo) === normalized);
}

/**
 * Busca uma receita/ordem pelo nome do produto.
 */
export function findWipRecipeByProduct(produto: string): WipRecipe | undefined {
  if (!produto) return undefined;
  const normalized = normalizeText(produto);
  return wipRecipes.find((recipe) => normalizeText(recipe.produto) === normalized);
}

/**
 * Pesquisa receitas por código, descrição de produto ou família.
 */
export function searchWipRecipes(query: string, limit = 15): WipRecipe[] {
  if (!query || query.trim().length < 2) return [];
  const q = normalizeText(query);

  const results: WipRecipe[] = [];
  for (const recipe of wipRecipes) {
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
 * Obtém a lista de todas as Famílias de Produtos únicas do rotas.json
 */
export function getWipFamilies(): string[] {
  const families = new Set<string>();
  wipRecipes.forEach((r) => {
    if (r.familia) families.add(r.familia.trim());
  });
  return Array.from(families).sort();
}

