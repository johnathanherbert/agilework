# Sistema de Versionamento Automático

Este projeto implementa um sistema de versionamento semântico simplificado que incrementa automaticamente a cada build.

## 📋 Formato de Versão

O formato seguido é `X.Y.Z` onde:

- **X**: Major version (0, 1, 2, ...)
- **Y**: Minor version (0-9)
- **Z**: Patch version (0-99)

## 🔄 Lógica de Incremento

- **Patch (Z)**: Incrementa a cada build (0, 1, 2, ..., 99)
- **Minor (Y)**: Incrementa quando patch chega a 100, resetando patch para 0
- **Major (X)**: Incrementa quando minor chega a 10, resetando minor para 0

### Exemplos de Progressão:
```
0.1.0 → 0.1.1 → 0.1.2 → ... → 0.1.99 → 0.2.0 → 0.2.1 → ...
0.9.99 → 1.0.0 → 1.0.1 → ...
```

## 🛠 Scripts Disponíveis

### Desenvolvimento
```bash
npm run dev              # Executa em modo desenvolvimento (não incrementa versão)
```

### Build e Deploy
```bash
npm run build            # Build + incremento automático de versão
npm run build:no-version # Build sem incrementar versão
```

### Gerenciamento de Versão
```bash
npm run version:current    # Mostra versão atual
npm run version:increment  # Incrementa versão manualmente
npm run version:reset      # Reseta versão para 0.1.0
```

## 📁 Arquivos do Sistema

### `version.json`
Arquivo principal que armazena:
```json
{
  "version": "0.1.0",
  "timestamp": "2025-06-04T12:00:00.000Z",
  "buildNumber": 1720000000000
}
```

### `scripts/version-manager.js`
Script Node.js que gerencia o incremento de versões.

### Integração com Next.js
- **`next.config.js`**: Configura build ID com a versão
- **`src/app/api/version/route.ts`**: API endpoint que retorna versão atual
- **`src/hooks/useAppUpdate.ts`**: Hook para detecção de atualizações

## 🚀 Como Funciona

### Desenvolvimento Local
1. Execute `npm run dev` - não incrementa versão
2. A versão permanece a mesma durante desenvolvimento

### Build Local
1. Execute `npm run build`
2. Script incrementa automaticamente a versão
3. Next.js usa a nova versão como Build ID
4. Sistema de auto-update detecta mudanças

### Produção (Vercel)
1. Em produção, usa `VERCEL_GIT_COMMIT_SHA` como versão
2. Sistema híbrido: git hash no Vercel, versão semântica local

## 🔧 Configuração

### Ambiente de Desenvolvimento
```env
NEXT_PUBLIC_APP_VERSION=0.1.0  # Automaticamente definido
NEXT_PUBLIC_BUILD_ID=0.1.0     # Automaticamente definido
```

### Produção (Vercel)
```env
VERCEL_GIT_COMMIT_SHA=abc123   # Automaticamente definido pelo Vercel
```

## 📊 Monitoramento

### Interface do Usuário
- **Configurações**: Card de "Atualizações do Sistema" mostra versão atual
- **Toast**: Notificação automática quando nova versão é detectada
- **Auto-reload**: Aplicação recarrega automaticamente com nova versão

### Logs de Desenvolvimento
```javascript
console.log('Versão atual:', process.env.NEXT_PUBLIC_APP_VERSION);
```

## 🎯 Benefícios

1. **Zero Configuração**: Incremento completamente automático
2. **Legibilidade**: Versões semânticas fáceis de entender
3. **Controle**: Scripts para gerenciamento manual quando necessário
4. **Integração**: Funciona com sistema de auto-update existente
5. **Flexibilidade**: Suporte híbrido para desenvolvimento e produção

## 🔍 Troubleshooting

### Versão não incrementa
```bash
# Verificar versão atual
npm run version:current

# Forçar incremento manual
npm run version:increment
```

### Resetar versão
```bash
# Voltar para versão inicial
npm run version:reset
```

### Verificar integração
```bash
# Verificar API de versão
curl http://localhost:3000/api/version
```

---

**Última atualização**: 04/06/2025  
**Versão do sistema**: 1.0.0
