# Exemplo de Uso - Sistema de Versionamento

## 🚀 Cenários de Uso

### 1. Desenvolvimento Diário
```bash
# Durante desenvolvimento - NÃO incrementa versão
npm run dev

# A versão permanece a mesma durante todo o desenvolvimento
# Versão atual: 0.1.1
```

### 2. Deploy/Build de Produção
```bash
# Build automático - incrementa versão automaticamente
npm run build

# Resultado:
# ✅ package.json atualizado para versão 0.1.2
# 🚀 Versão incrementada: 0.1.1 → 0.1.2
# Build criado com nova versão
```

### 3. Gerenciamento Manual
```bash
# Verificar versão atual
npm run version:current
# Saída: Versão atual: 0.1.2

# Incrementar manualmente (útil para hotfixes)
npm run version:increment
# Saída: 🚀 Versão incrementada: 0.1.2 → 0.1.3

# Resetar versão (início de novo ciclo)
npm run version:reset
# Saída: 🔄 Versão resetada para: 0.1.0
```

## 📈 Progressão de Versões

### Sequência Normal
```
0.1.0 → 0.1.1 → 0.1.2 → ... → 0.1.99 → 0.2.0
0.2.0 → 0.2.1 → 0.2.2 → ... → 0.2.99 → 0.3.0
...
0.9.0 → 0.9.1 → 0.9.2 → ... → 0.9.99 → 1.0.0
1.0.0 → 1.0.1 → 1.0.2 → ... → 1.0.99 → 1.1.0
```

### Exemplo Prático (100 builds)
```bash
# Builds 1-99
npm run build  # 0.1.0 → 0.1.1
npm run build  # 0.1.1 → 0.1.2
...
npm run build  # 0.1.98 → 0.1.99

# Build 100 - mudança de minor
npm run build  # 0.1.99 → 0.2.0

# Builds 101-199
npm run build  # 0.2.0 → 0.2.1
...

# Build 1000 - mudança de major
npm run build  # 0.9.99 → 1.0.0
```

## 🔍 Monitoramento no App

### Interface de Usuário
1. **Configurações**: Mostra versão atual
2. **API Endpoint**: `http://localhost:3000/api/version`
3. **Auto-Update**: Detecta mudanças automaticamente

### Response da API
```json
{
  "version": "0.1.1",
  "timestamp": "2025-06-05T01:29:26.276Z", 
  "buildNumber": 1749086966276,
  "environment": "production",
  "source": "version-file"
}
```

## 🛠 Workflow de Deploy

### Desenvolvimento Local
```bash
# 1. Desenvolver features
npm run dev

# 2. Testar localmente
# 3. Build final
npm run build  # Auto-incrementa versão

# 4. Deploy
# A nova versão é automaticamente detectada pelos usuários
```

### CI/CD Pipeline (Exemplo)
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        
      - name: Build with version increment
        run: npm run build  # Auto-incrementa versão
        
      - name: Deploy to Vercel
        # Vercel deploy steps...
```

## 🎯 Benefícios em Produção

### Para Desenvolvedores
- ✅ Zero configuração manual de versões
- ✅ Histórico automático de builds
- ✅ Controle granular quando necessário

### Para Usuários
- ✅ Sempre na versão mais recente
- ✅ Atualizações automáticas sem intervenção
- ✅ Notificações claras de novas versões

### Para Operação
- ✅ Rastreabilidade completa de versões
- ✅ Rollback simples alterando version.json
- ✅ Logs detalhados de cada incremento

---

**Sistema implementado e testado com sucesso! 🎉**
