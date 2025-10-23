#!/bin/bash

# 🚀 Script de Verificação Pré-Deploy
# Este script verifica se tudo está pronto para o deploy no Vercel

echo "🔍 Verificando pré-requisitos para deploy..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 1. Verificar se estamos na branch correta
echo "📌 Verificando branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "agile2.0" ]; then
    echo -e "${RED}✗ Branch incorreta: $CURRENT_BRANCH (deveria ser agile2.0)${NC}"
    ERRORS=$((ERRORS+1))
else
    echo -e "${GREEN}✓ Branch correta: agile2.0${NC}"
fi

# 2. Verificar se há mudanças não commitadas
echo "📝 Verificando status do Git..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠ Há mudanças não commitadas${NC}"
    WARNINGS=$((WARNINGS+1))
else
    echo -e "${GREEN}✓ Todos os arquivos commitados${NC}"
fi

# 3. Verificar se node_modules existe
echo "📦 Verificando dependências..."
if [ ! -d "node_modules" ]; then
    echo -e "${RED}✗ node_modules não encontrado. Execute: npm install${NC}"
    ERRORS=$((ERRORS+1))
else
    echo -e "${GREEN}✓ Dependências instaladas${NC}"
fi

# 4. Verificar se .env.local existe
echo "🔐 Verificando variáveis de ambiente..."
if [ ! -f ".env.local" ]; then
    echo -e "${RED}✗ .env.local não encontrado${NC}"
    ERRORS=$((ERRORS+1))
else
    echo -e "${GREEN}✓ .env.local encontrado${NC}"
    
    # Verificar se todas as variáveis necessárias existem
    REQUIRED_VARS=(
        "NEXT_PUBLIC_FIREBASE_API_KEY"
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
        "NEXT_PUBLIC_FIREBASE_APP_ID"
    )
    
    for VAR in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "$VAR" .env.local; then
            echo -e "${RED}  ✗ Variável $VAR não encontrada${NC}"
            ERRORS=$((ERRORS+1))
        fi
    done
fi

# 5. Testar build
echo "🔨 Testando build..."
if npm run build:no-version > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Build executado com sucesso${NC}"
else
    echo -e "${RED}✗ Build falhou. Execute: npm run build${NC}"
    ERRORS=$((ERRORS+1))
fi

# 6. Verificar lint
echo "🧹 Verificando lint..."
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Sem erros de lint${NC}"
else
    echo -e "${YELLOW}⚠ Há warnings/erros de lint${NC}"
    WARNINGS=$((WARNINGS+1))
fi

# 7. Verificar arquivos importantes
echo "📄 Verificando arquivos importantes..."
IMPORTANT_FILES=(
    "package.json"
    "next.config.js"
    "tsconfig.json"
    "vercel.json"
    "firestore-rules.txt"
    "VERCEL_DEPLOY_GUIDE.md"
    "DEPLOY_CHECKLIST.md"
)

for FILE in "${IMPORTANT_FILES[@]}"; do
    if [ ! -f "$FILE" ]; then
        echo -e "${YELLOW}  ⚠ Arquivo $FILE não encontrado${NC}"
        WARNINGS=$((WARNINGS+1))
    fi
done

# Resumo
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✨ Tudo pronto para deploy!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. git push origin agile2.0"
    echo "2. Criar novo projeto no Vercel"
    echo "3. Configurar branch 'agile2.0'"
    echo "4. Adicionar variáveis de ambiente"
    echo "5. Deploy!"
    echo ""
    echo "Veja VERCEL_DEPLOY_GUIDE.md para detalhes"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) encontrado(s)${NC}"
    echo "Você pode prosseguir, mas revise os warnings acima."
    exit 0
else
    echo -e "${RED}✗ $ERRORS erro(s) encontrado(s)${NC}"
    echo "Corrija os erros antes de fazer deploy."
    exit 1
fi
