import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
  // Em produção (Vercel), priorizar git hash; caso contrário, usar nosso sistema de versão
  const isProduction = process.env.VERCEL_GIT_COMMIT_SHA;
  
  if (isProduction) {
    // Produção no Vercel - usar git hash como antes
    const version = process.env.VERCEL_GIT_COMMIT_SHA || 'production';
    
    return NextResponse.json(
      { 
        version,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        source: 'vercel-git'
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } else {
    // Desenvolvimento/build local - usar nosso sistema de versão
    const versionData = getAppVersion();
    
    return NextResponse.json(
      { 
        version: versionData.version,
        timestamp: versionData.timestamp,
        buildNumber: versionData.buildNumber,
        environment: process.env.NODE_ENV,
        source: 'version-file'
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}
