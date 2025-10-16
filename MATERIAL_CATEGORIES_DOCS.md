# Sistema de Categorização de Materiais e Controle de Tempo

## Visão Geral

O sistema agora categoriza materiais em três tipos diferentes, cada um com seu próprio limite de tempo para consideração de atraso:

- **NORMAL**: Materiais comuns (limite de 2 horas)
- **CFA (Câmara Fria)**: Materiais que necessitam refrigeração (limite de 4 horas)
- **INF (Inflamável)**: Materiais inflamáveis (limite de 4 horas)

## Configuração de Limites de Tempo

Os limites de tempo estão configurados no arquivo `/src/data/material-categories.json`:

```json
{
  "timeLimits": {
    "CFA": 240,    // 4 horas em minutos
    "INF": 240,    // 4 horas em minutos
    "NORMAL": 120  // 2 horas em minutos
  }
}
```

### Como Alterar os Limites de Tempo

Para modificar os limites de tempo, edite o arquivo `material-categories.json` ou altere as constantes em `/src/lib/utils.ts`:

```typescript
export const TIME_LIMITS = {
  CFA: materialCategories.timeLimits.CFA,
  INF: materialCategories.timeLimits.INF,
  NORMAL: materialCategories.timeLimits.NORMAL
}
```

## Materiais Cadastrados

### Câmara Fria (CFA)
- 011748 - ORLISTAT
- 011776 - ROSUVASTATINA CALCICA
- 013368 - TELMISARTANA
- 011454 - PANTOPRAZOL SODICO SESQUIIDRATADO MICRON
- 012367 - ATORVASTATINA CALCICA
- 302042 - HIALURONATO DE SODIO (ALIM)
- 012173 - DESLORATADINA (EP)
- 016331 - LACTASE(ASPERGILLUS ORYZAE)100.000 ALU/G
- 011645 - ACARBOSE
- 011384 - LORATADINA(MICRONIZADA)
- 016016 - LIMECICLINA
- 016364 - LUTEINA FLORAGLO LUTEIN5%CWS/S-TG (ALIM)
- 019419 - ZEAXANTINA NATURAL 5% (ALIM)
- 301958 - BISSULFATO DE CLOPIDOGREL

### Inflamáveis (INF)
- 011370 - OXIDO FERRO PRETO C 335198
- 010047 - ALCOOL ISOPROPILICO(ISOPROPANOL)
- 010720 - CLORETO METILENO (D2)**
- 010276 - ESS HORTELA
- 011393 - DINITRATO ISOSSORBIDA 25%/LACTOSEUSP
- 011362 - AROMA CASSIS IFF BR 018999
- 011142 - ETANOL ABSOLUTO P.A.
- 010010 - ACETONA **

## Lógica de Cálculo de Tempo

### Para Itens NÃO Pagos

1. **Dentro do Prazo**: Mostra o tempo decorrido desde a criação
   - Exemplo: "58min", "1h30min"

2. **Em Atraso**: Mostra o tempo APÓS o limite ser excedido
   - Exemplo para material normal (2h limite): "1min atraso", "30min atraso"
   - Exemplo para CFA/INF (4h limite): "15min atraso", "1h20min atraso"

### Para Itens Pagos

1. **Pago Dentro do Prazo**: Mostra "Pago" + tempo que levou
   - Exemplo: "Pago 58min", "Pago 1h30min"

2. **Pago com Atraso**: Mostra o tempo de atraso
   - Exemplo: "1h20min de atraso", "30min de atraso"

## Indicadores Visuais

### Ícones de Categoria

- **❄️ Snowflake (Azul)**: Material de Câmara Fria
- **🔥 Flame (Laranja)**: Material Inflamável
- Sem ícone: Material Normal

### Badges de Status

- **Verde**: Pago dentro do prazo
- **Vermelho**: Em atraso (ou pago com atraso)
- **Cinza**: Dentro do prazo (aguardando)

## Funções Principais

### `getMaterialCategory(materialCode: string)`
Retorna a categoria do material ('CFA', 'INF' ou 'NORMAL')

### `getTimeLimitForMaterial(materialCode: string)`
Retorna o limite de tempo em minutos para o material

### `isItemDelayed(startDate, materialCode, endDate?)`
Verifica se um item está em atraso considerando sua categoria

### `calculateItemDelayTime(startDate, materialCode, endDate?)`
Calcula o tempo de atraso em milissegundos (apenas o excedente)

### `formatItemTime(createdDate, createdTime, materialCode, status, paymentTime?)`
Formata o tempo do item baseado em sua categoria e status, retornando:
- `displayText`: Texto formatado para exibição
- `isDelayed`: Boolean indicando se está em atraso
- `category`: Categoria do material

## Exemplos de Uso

```typescript
import { formatItemTime, getMaterialCategory } from '@/lib/utils'

// Exemplo 1: Item normal em atraso
const result1 = formatItemTime(
  '15/10/2025',
  '10:00:00',
  '999999', // código não categorizado
  'Ag. Pagamento',
  null
)
// Após 2h10min: { displayText: '10min atraso', isDelayed: true, category: 'NORMAL' }

// Exemplo 2: Item de câmara fria pago
const result2 = formatItemTime(
  '15/10/2025',
  '10:00:00',
  '011748', // ORLISTAT - CFA
  'Pago',
  '13:30:00' // pago após 3h30min
)
// { displayText: 'Pago 3h30min', isDelayed: false, category: 'CFA' }

// Exemplo 3: Item inflamável pago com atraso
const result3 = formatItemTime(
  '15/10/2025',
  '10:00:00',
  '010010', // ACETONA - INF
  'Pago',
  '15:00:00' // pago após 5h (1h de atraso)
)
// { displayText: '1h de atraso', isDelayed: true, category: 'INF' }
```

## Como Adicionar Novos Materiais

1. Edite o arquivo `/src/data/material-categories.json`
2. Adicione o código do material na lista apropriada:

```json
{
  "materials": {
    "CFA": [
      "011748",
      "SEU_NOVO_CODIGO_AQUI"
    ],
    "INF": [
      "010010",
      "OUTRO_CODIGO_AQUI"
    ]
  }
}
```

3. O sistema automaticamente aplicará o limite de tempo correto

## Notas Importantes

- A categorização é baseada APENAS no código do item, não na NT inteira
- Cada item pode ter um limite de tempo diferente dentro da mesma NT
- Os limites podem ser alterados em tempo de desenvolvimento editando o JSON ou as constantes
- O sistema mantém compatibilidade com itens antigos que não têm categorização
