import { NextResponse } from 'next/server';

export async function GET() {
  // Retorna a versão atual do build
  const version = process.env.NEXT_PUBLIC_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'development';
  
  return NextResponse.json(
    { 
      version,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
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
