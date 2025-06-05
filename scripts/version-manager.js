#!/usr/bin/env node

/**
 * Sistema de Versionamento Automático
 * 
 * Gerencia versões no formato X.Y.Z onde:
 * - X: Major version (incrementa quando Y chega a 9 e Z chega a 99)
 * - Y: Minor version (incrementa quando Z chega a 99, reseta para 0)
 * - Z: Patch version (incrementa a cada build, reseta para 0 quando Y incrementa)
 * 
 * Exemplos: 0.1.0 -> 0.1.1 -> ... -> 0.1.99 -> 0.2.0 -> ... -> 0.9.99 -> 1.0.0
 */

const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de versão
const VERSION_FILE = path.join(__dirname, '../version.json');
const PACKAGE_JSON = path.join(__dirname, '../package.json');

// Carregar versão atual ou criar versão inicial
function loadCurrentVersion() {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
      return data.version;
    }
  } catch (error) {
    console.log('Arquivo de versão não encontrado ou inválido, criando versão inicial...');
  }
  
  // Versão inicial
  return '0.1.0';
}

// Incrementar versão seguindo a lógica semântica simplificada
function incrementVersion(currentVersion) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newMajor = major;
  let newMinor = minor;
  let newPatch = patch;
  
  // Incrementar patch
  newPatch++;
  
  // Se patch chegou a 100, incrementar minor e resetar patch
  if (newPatch >= 100) {
    newMinor++;
    newPatch = 0;
  }
  
  // Se minor chegou a 10, incrementar major e resetar minor
  if (newMinor >= 10) {
    newMajor++;
    newMinor = 0;
  }
  
  return `${newMajor}.${newMinor}.${newPatch}`;
}

// Salvar nova versão
function saveVersion(version) {
  const versionData = {
    version,
    timestamp: new Date().toISOString(),
    buildNumber: Date.now()
  };
  
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
  return versionData;
}

// Atualizar package.json
function updatePackageJson(version) {
  try {
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    packageData.version = version;
    fs.writeFileSync(PACKAGE_JSON, JSON.stringify(packageData, null, 2));
    console.log(`✅ package.json atualizado para versão ${version}`);
  } catch (error) {
    console.error('❌ Erro ao atualizar package.json:', error.message);
  }
}

// Função principal
function main() {
  const command = process.argv[2];
  
  if (command === 'current') {
    // Apenas mostrar versão atual
    const currentVersion = loadCurrentVersion();
    console.log(`Versão atual: ${currentVersion}`);
    return;
  }
  
  if (command === 'increment' || !command) {
    // Incrementar versão (padrão)
    const currentVersion = loadCurrentVersion();
    const newVersion = incrementVersion(currentVersion);
    const versionData = saveVersion(newVersion);
    
    // Atualizar package.json
    updatePackageJson(newVersion);
    
    console.log(`🚀 Versão incrementada: ${currentVersion} → ${newVersion}`);
    console.log(`📅 Timestamp: ${versionData.timestamp}`);
    console.log(`🔢 Build ID: ${versionData.buildNumber}`);
    
    return newVersion;
  }
  
  if (command === 'reset') {
    // Resetar para versão inicial
    const newVersion = '0.1.0';
    const versionData = saveVersion(newVersion);
    updatePackageJson(newVersion);
    
    console.log(`🔄 Versão resetada para: ${newVersion}`);
    return newVersion;
  }
  
  console.log(`
Uso: node scripts/version-manager.js [comando]

Comandos:
  increment  - Incrementa a versão (padrão)
  current    - Mostra a versão atual
  reset      - Reseta para versão 0.1.0

Exemplos:
  node scripts/version-manager.js          # Incrementa versão
  node scripts/version-manager.js current  # Mostra versão atual
  node scripts/version-manager.js reset    # Reseta versão
  `);
}

if (require.main === module) {
  main();
}

module.exports = {
  loadCurrentVersion,
  incrementVersion,
  saveVersion,
  updatePackageJson
};
