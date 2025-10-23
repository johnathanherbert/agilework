// Script para verificar se o usuário existe no Firestore
// Usage: node scripts/check-user.js <uid>

const admin = require('firebase-admin');

// Inicializar Firebase Admin com as credenciais do .env.local
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Para ambiente de desenvolvimento, usamos as credenciais públicas
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function checkUser(uid) {
  try {
    console.log(`🔍 Verificando usuário: ${uid}`);
    
    // Buscar documento do usuário
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (userDoc.exists) {
      console.log('✅ Usuário encontrado no Firestore:');
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log('❌ Usuário NÃO encontrado no Firestore');
      console.log('');
      console.log('📝 O documento do usuário deve ser criado automaticamente ao registrar.');
      console.log('   Se você se registrou antes da implementação do sistema de usuários,');
      console.log('   o documento não foi criado.');
      console.log('');
      console.log('💡 Solução: Faça logout e login novamente, ou crie manualmente via Firebase Console.');
    }
    
    // Buscar usuário no Auth
    console.log('');
    console.log('🔍 Verificando Firebase Auth...');
    try {
      const authUser = await admin.auth().getUser(uid);
      console.log('✅ Usuário encontrado no Auth:');
      console.log(`   Email: ${authUser.email}`);
      console.log(`   Display Name: ${authUser.displayName || '(não definido)'}`);
      console.log(`   Criado em: ${authUser.metadata.creationTime}`);
    } catch (authError) {
      console.log('❌ Usuário não encontrado no Auth');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

const uid = process.argv[2];
if (!uid) {
  console.log('Usage: node scripts/check-user.js <uid>');
  process.exit(1);
}

checkUser(uid).then(() => {
  process.exit(0);
});
