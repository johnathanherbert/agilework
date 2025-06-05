// Script para testar o comportamento do auto-update
// Para ser executado no console do navegador

console.log('🧪 Testando sistema de auto-update...');

// Função para simular mudança de versão
function simulateVersionChange() {
  const newVersion = 'test-version-' + Date.now();
  localStorage.setItem('app_last_known_version', newVersion);
  console.log('✅ Versão simulada definida:', newVersion);
  
  // Recarregar para testar a detecção
  setTimeout(() => {
    console.log('🔄 Recarregando para testar detecção...');
    window.location.reload();
  }, 1000);
}

// Função para verificar estado atual
function checkCurrentState() {
  const lastKnown = localStorage.getItem('app_last_known_version');
  console.log('📊 Estado atual do auto-update:');
  console.log('- Última versão conhecida:', lastKnown);
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- NEXT_PUBLIC_APP_VERSION:', process.env.NEXT_PUBLIC_APP_VERSION);
}

// Função para limpar estado
function clearState() {
  localStorage.removeItem('app_last_known_version');
  console.log('🧹 Estado limpo');
  if (window.resetAppUpdateState) {
    window.resetAppUpdateState();
  }
}

// Disponibilizar funções globalmente
window.testAutoUpdate = {
  simulateVersionChange,
  checkCurrentState,
  clearState
};

console.log('🛠️  Funções disponíveis:');
console.log('- window.testAutoUpdate.simulateVersionChange() - Simula nova versão');
console.log('- window.testAutoUpdate.checkCurrentState() - Mostra estado atual');  
console.log('- window.testAutoUpdate.clearState() - Limpa estado');

// Mostrar estado inicial
checkCurrentState();
