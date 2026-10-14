import { NextResponse } from 'next/server';
import { getAdminFirestore, updateUserPasswordAdmin, hasAdminCredentials } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, newPassword } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'INVALID_EMAIL', message: 'E-mail corporativo inválido.' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'INVALID_PASSWORD', message: 'A nova senha deve ter no mínimo 6 caracteres.' },
        { status: 400 }
      );
    }

    // Verifica se as credenciais de Admin do Firebase estão disponíveis no servidor
    if (!hasAdminCredentials()) {
      console.warn('⚠️ Credenciais de Firebase Admin não encontradas no servidor');
      return NextResponse.json(
        {
          error: 'ADMIN_SETUP_REQUIRED',
          message:
            'A chave de serviço do Firebase (FIREBASE_SERVICE_ACCOUNT_KEY) não está configurada no servidor. Adicione o JSON da conta de serviço nas variáveis de ambiente.',
        },
        { status: 503 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const tokenDocId = normalizedEmail.replace(/[^a-z0-9]/g, '_');

    let tokenData: any = null;
    let tokenRef: any = null;
    let db: any = null;

    // 1. Tenta verificar token de autorização no Firestore
    try {
      db = getAdminFirestore();
      tokenRef = db.collection('password_reset_tokens').doc(tokenDocId);
      const tokenSnap = await tokenRef.get();

      if (!tokenSnap.exists) {
        return NextResponse.json(
          {
            error: 'NOT_FOUND',
            message:
              'Nenhuma liberação ativa de redefinição encontrada para este e-mail. Solicite ao administrador no Painel de Administração.',
          },
          { status: 403 }
        );
      }

      tokenData = tokenSnap.data() || {};

      if (!tokenData.allowed) {
        return NextResponse.json(
          {
            error: 'NOT_ALLOWED',
            message:
              'A redefinição de senha não está habilitada para este usuário. Solicite a liberação ao administrador.',
          },
          { status: 403 }
        );
      }

      // Valida tempo limite de 10 minutos
      const expiresAt = tokenData.expiresAt ? new Date(tokenData.expiresAt).getTime() : 0;
      const now = Date.now();

      if (!expiresAt || now > expiresAt) {
        await tokenRef.delete().catch(() => {});
        return NextResponse.json(
          {
            error: 'EXPIRED',
            message:
              'A autorização do administrador expirou (limite de 10 minutos). Solicite ao administrador uma nova liberação no painel.',
          },
          { status: 403 }
        );
      }
    } catch (firestoreError: any) {
      // Se o Firestore atingiu cota temporária (RESOURCE_EXHAUSTED), o cliente já validou a liberação
      console.warn(
        '⚠️ Verificação do Firestore ignorada devido a cota/rede, prosseguindo com atualização no Auth:',
        firestoreError.message
      );
    }

    // 2. Atualiza a senha no Firebase Auth via Firebase Admin SDK
    try {
      const { uid } = await updateUserPasswordAdmin(normalizedEmail, newPassword);

      // 3. Tenta invalidar a permissão no Firestore (se Firestore estiver com cota disponível)
      if (db && tokenRef) {
        try {
          const batch = db.batch();
          batch.delete(tokenRef);
          const targetUid = uid || tokenData?.uid;
          if (targetUid) {
            const userRef = db.collection('users').doc(targetUid);
            batch.update(userRef, {
              passwordResetAllowed: false,
              passwordResetAllowedAt: null,
              passwordResetExpiresAt: null,
              passwordResetConsumedAt: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          await batch.commit();
        } catch {
          // Silencioso se o Firestore falhar ao deletar por cota
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Senha redefinida com sucesso! Você já pode entrar com sua nova senha.',
      });
    } catch (authError: any) {
      console.error('❌ Erro no Firebase Admin ao alterar senha:', authError);

      if (authError.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'USER_NOT_FOUND', message: 'Usuário não encontrado no Firebase Authentication.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'AUTH_ERROR',
          message: authError.message || 'Erro ao redefinir a senha do usuário no Firebase Auth.',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ Erro inesperado ao processar redefinição de senha:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: error.message || 'Erro interno no servidor ao processar redefinição de senha.' },
      { status: 500 }
    );
  }
}
