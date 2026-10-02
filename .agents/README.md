# agilework-design-system · Skill para Google Antigravity

Skill com o design system das telas do AgileWork (Pesagem · Novamed).

## Instalação

**No projeto (recomendado):** copie a pasta inteira para a raiz do workspace:

```
<seu-projeto>/
└── .agents/
    └── skills/
        └── agilework-design-system/
            ├── SKILL.md
            ├── README.md
            ├── resources/
            ├── examples/
            └── scripts/
```

> O Antigravity usa `.agents/skills` por padrão e continua lendo `.agent/skills` (versões antigas).

**Global (todos os projetos):** `~/.gemini/config/skills/agilework-design-system/`
(no Windows: `%USERPROFILE%\.gemini\config\skills\agilework-design-system\`).
Se a skill não aparecer, use a opção do projeto — o caminho global varia entre Antigravity, IDE e CLI.

Não é preciso chamar a skill pelo nome: o agente carrega sozinho quando o pedido fala de tela,
dashboard, redesign, relatório por turno, "menos cara de IA", "mesmo padrão das outras telas" etc.
Para forçar: *"use a skill agilework-design-system"*.

## Conteúdo

| Pasta | O que tem |
|---|---|
| `SKILL.md` | Regras, princípios, tokens, componentes, relatório, inteligência, regras de código, fluxo |
| `resources/tokens.css` | Variáveis de cor/fonte (escuro + claro) |
| `resources/components.css` | Todos os componentes base |
| `resources/report.css` | Modo captura + impressão A4 paisagem |
| `resources/helpers.js` | Erro visível, `store` seguro, formatação pt-BR, turnos, toast, cópia, CSV, tema, ícones |
| `resources/shell.html` | Esqueleto de tela nova (sidebar expansível + notificações + topbar) já funcionando |
| `resources/patterns.md` | Catálogo de componentes com HTML |
| `resources/copy.md` | Microtexto e vocabulário Novamed |
| `examples/` | As 9 telas redesenhadas (Login, Dashboard, NTs, NTs concluídas, Solicitações, Mão de obra, Painel de produção, Heijunka, Administração) |
| `scripts/lint_design.py` | Verificador: `python scripts/lint_design.py tela.html` |

## Exemplos de pedidos

- "Crie a tela de Configurações no padrão AgileWork."
- "Redesenhe esta tela (print anexo) no mesmo conceito das outras."
- "Adicione ao Painel de produção um ranking por máquina."
- "Aplique a barra lateral e as notificações do admin em todas as telas de `examples/`."
