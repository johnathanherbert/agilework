import { NextRequest, NextResponse } from 'next/server';

export function validateSyncKey(request: NextRequest): NextResponse | null {
  const expectedKey = process.env.SYNC_API_KEY;

  if (!expectedKey) return null;

  const providedKey = request.headers.get('x-sync-key') ?? '';

  if (providedKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Não autorizado. Header X-Sync-Key inválido ou ausente.' },
      { status: 401 }
    );
  }

  return null;
}
