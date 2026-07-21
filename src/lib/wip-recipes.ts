import wipRecipesData from '@/data/wip-recipes.json';
import { ProductionVia } from '@/types';

export interface WipRecipe {
  codigo: string;
  produto: string;
  familia: string;
  via?: ProductionVia;
}

const wipRecipes = wipRecipesData as WipRecipe[];

// Normaliza o código digitado pelo usuário para permitir busca sem se preocupar
// com espaços em branco ou diferença de maiúsculas/minúsculas
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Busca uma receita/ordem do WIP pelo código do material (ex: "700071I").
 * Usado para autocompletar via, família e produto no formulário do Painel de Produção.
 */
export function findWipRecipeByCode(code: string): WipRecipe | undefined {
  if (!code) return undefined;
  const normalized = normalizeCode(code);
  return wipRecipes.find((recipe) => normalizeCode(recipe.codigo) === normalized);
}
