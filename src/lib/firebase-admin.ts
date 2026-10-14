import fs from 'fs';
import path from 'path';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

const ADMIN_APP_NAME = 'agilework-admin-auth';

function findLocalServiceAccountFile(): string | null {
  try {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);
    const match = files.find(
      (f) =>
        (f.includes('firebase-adminsdk') || f.includes('serviceAccountKey')) &&
        f.endsWith('.json')
    );
    if (match) {
      return path.join(cwd, match);
    }
  } catch {
    // Silencioso se não conseguir listar
  }
  return null;
}

function getServiceAccountCredentials(): any | null {
  // 1. Tenta carregar de process.env.FIREBASE_SERVICE_ACCOUNT_KEY (suporta JSON puro ou Base64)
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawKey) {
    try {
      if (typeof rawKey === 'object') return rawKey;
      const trimmed = rawKey.trim();
      if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed);
      }
      // Se estiver em Base64 (ideal para Coolify, Docker, CI/CD)
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e: any) {
      console.error('❌ Erro no parse de process.env.FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
    }
  }

  // 2. Tenta carregar de arquivo JSON local no root
  const localFile = findLocalServiceAccountFile();
  if (localFile) {
    try {
      const content = fs.readFileSync(localFile, 'utf8');
      return JSON.parse(content);
    } catch (e: any) {
      console.error(`❌ Erro ao ler arquivo ${localFile}:`, e.message);
    }
  }

  // 3. Tenta ler diretamente do .env.local (caso o processo Next.js não tenha sido reiniciado)
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(['"]?)([\s\S]*?)\1(?:\r?\n|$)/);
      if (match && match[2]) {
        try {
          return JSON.parse(match[2].trim());
        } catch {}
      }
    }
  } catch {}

  // 4. Tenta credenciais individuais
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agiliework',
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

export function hasAdminCredentials(): boolean {
  return Boolean(getServiceAccountCredentials());
}

export function getFirebaseAdminApp(): App {
  // Procura app nomeada já existente
  const existingApp = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (existingApp) {
    return existingApp;
  }

  const credentials = getServiceAccountCredentials();
  const projectId = credentials?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agiliework';

  if (credentials) {
    try {
      const app = initializeApp(
        {
          credential: cert(credentials),
          projectId,
        },
        ADMIN_APP_NAME
      );
      console.log(`✅ Firebase Admin inicializado com sucesso [${ADMIN_APP_NAME}]`);
      return app;
    } catch (e: any) {
      console.error('❌ Erro ao inicializar Firebase Admin com credenciais:', e.message);
    }
  }

  // Fallback: se estiver em ambiente GCP com ADC
  try {
    return initializeApp({ projectId }, ADMIN_APP_NAME);
  } catch (e: any) {
    console.error('❌ Erro no fallback de Firebase Admin:', e.message);
    throw new Error('Firebase Admin SDK não pôde ser autenticado.');
  }
}

export function getAdminAuth(): Auth {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}

export function getAdminFirestore(): Firestore {
  const app = getFirebaseAdminApp();
  return getFirestore(app);
}

/**
 * Atualiza a senha de um usuário no Firebase Auth sem envio de e-mail.
 */
export async function updateUserPasswordAdmin(email: string, newPassword: string): Promise<{ uid: string }> {
  const auth = getAdminAuth();
  const normalizedEmail = email.trim().toLowerCase();
  const userRecord = await auth.getUserByEmail(normalizedEmail);
  await auth.updateUser(userRecord.uid, { password: newPassword });
  return { uid: userRecord.uid };
}
