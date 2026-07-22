/**
 * Script de conversão: rotas.json → src/data/wip-recipes.json
 * Mapeia os campos do rotas.json para o formato esperado pelo wip-recipes.ts
 */

const fs = require('fs');
const path = require('path');

const rotasPath = path.join(__dirname, '../rotas.json');
const outputPath = path.join(__dirname, '../src/data/wip-recipes.json');

const rotas = JSON.parse(fs.readFileSync(rotasPath, 'utf-8'));

const viaMap = {
  'Via Úmida': 'UMIDA',
  'Via Seca': 'SECA',
};

const recipes = rotas.map((item) => {
  const codigoRaw = item['Código Produto SA '] ?? item['Código Produto SA'];
  const codigo = String(codigoRaw ?? '').trim();
  const produto = String(item['Descrição'] ?? '').trim();
  const familia = String(item['Família Produto SA'] ?? '').trim();
  const viaRaw = String(item['VIA (ÚMIDA / SECA)'] ?? '').trim();
  const via = viaMap[viaRaw] ?? undefined;

  const entry = { codigo, produto, familia };
  if (via) entry.via = via;
  return entry;
}).filter((r) => r.codigo !== '');

// Remove duplicatas mantendo o último registro encontrado (por codigo)
const seen = new Map();
for (const r of recipes) {
  seen.set(r.codigo.toUpperCase(), r);
}
const deduplicated = Array.from(seen.values());

fs.writeFileSync(outputPath, JSON.stringify(deduplicated, null, 2), 'utf-8');
console.log(`✅ wip-recipes.json gerado com ${deduplicated.length} entradas (${recipes.length - deduplicated.length} duplicatas removidas).`);
