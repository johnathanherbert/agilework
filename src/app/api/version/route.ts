import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Garante que esta rota NUNCA seja armazenada em cache estático pelo Next.js
// (Full Route Cache). Sem isso, em alguns ambientes de self-hosting (ex: Coolify)
// a resposta poderia ficar "congelada" com o conteúdo lido em build time,
// impedindo a detecção de novas versões após um redeploy.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Função para carregar versão do arquivo version.json
function getAppVersion() {
  try {
    const versionFile = path.join(process.cwd(), 'version.json');
    if (fs.existsSync(versionFile)) {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      return {
        version: data.version,
        timestamp: data.timestamp,
        buildNumber: data.buildNumber
      };
    }
  } catch (error) {
    console.log('Erro ao carregar version.json:', (error as Error).message);
  }
  
  // Fallback para versão padrão
  return {
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    buildNumber: Date.now()
  };
}

export async function GET() {
  const versionData = getAppVersion();
  const buildSignature = `${versionData.version}-${versionData.buildNumber || versionData.timestamp}`;

  return NextResponse.json(
    { 
      version: versionData.version,
      timestamp: versionData.timestamp,
      buildNumber: versionData.buildNumber,
      buildSignature,
      environment: process.env.NODE_ENV,
      source: 'version-file'
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
      },
    }
  );
}
