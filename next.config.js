   /** @type {import('next').NextConfig} */
const fs = require('fs');
const path = require('path');

// Função para carregar versão do arquivo version.json
function getAppVersion() {
  try {
    const versionFile = path.join(__dirname, 'version.json');
    if (fs.existsSync(versionFile)) {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      return data.version;
    }
  } catch (error) {
    console.log('Usando versão fallback devido ao erro:', error.message);
  }
  
  // Fallback para versão do package.json ou padrão
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return packageJson.version;
  } catch {
    return '0.1.0';
  }
}

const appVersion = getAppVersion();

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Generate a unique build ID using our version system
  generateBuildId: async () => {
    // Em produção (Vercel), usar git hash; em desenvolvimento/build local, usar nossa versão
    return process.env.VERCEL_GIT_COMMIT_SHA || appVersion;
  },
  // Add environment variables
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || appVersion,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  // Add any other configurations you might need
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}

module.exports = nextConfig