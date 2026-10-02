---
name: agilework-design-system
description: Design system do AgileWork (Pesagem · Novamed / Grupo EMS). Use ao criar, redesenhar, revisar ou corrigir qualquer tela, dashboard, relatório, formulário ou componente HTML/CSS/JS do sistema de gestão de NTs e produção — Notas Técnicas, NTs concluídas, Solicitações, Mão de obra, Painel de produção, Heijunka, Administração, Login ou telas novas. Também use quando pedirem uma interface "mais profissional", "menos parecida com IA", "no mesmo conceito/padrão das outras telas", visão para print/WhatsApp/TV ou relatório por turno.
---

# AgileWork Design System

Linguagem visual e padrões de código das telas do AgileWork (Pesagem · Novamed). O objetivo é uma
interface **sóbria, densa em informação e legível**, que pareça ferramenta interna feita por quem
usa — **não** um template gerado por IA.

Referências prontas em `examples/` (9 telas completas, funcionando). **Sempre abra a tela de exemplo
mais parecida antes de começar** e copie a estrutura dela em vez de inventar uma nova.

| Precisa de… | Abra |
|---|---|
| Lista com linhas expansíveis + painel lateral de atividade | `examples/gerenciamento_nts_redesign.html` |
| Histórico com período, agrupamento por dia, CSV, paginação | `examples/nts_concluidas_redesign.html` |
| Visão geral / home com KPIs, gráfico por hora, atalhos | `examples/dashboard_operacional_redesign.html` |
| Painel mestre-detalhe (lista à esquerda filtra tabela) + modal de auditoria | `examples/solicitacoes_redesign.html` |
| Múltiplas abas, calendário, CRUD com modais, regras automáticas | `examples/mao_de_obra_redesign.html` |
| Relatório por turno lado a lado, WhatsApp, captura, PDF | `examples/painel_producao_redesign.html` |
| Gráfico SVG próprio, detalhe editável, ranking, insights | `examples/heijunka_redesign.html` |
| **Barra lateral expansível + painel de notificações** + gaveta de edição | `examples/admin_redesign.html` |
| Login dividido, PIN, validação, bloqueio por tentativas | `examples/login_redesign.html` |

Recursos reutilizáveis em `resources/`:
- `tokens.css` — variáveis de cor/tipografia (tema escuro + claro). **Copiar literalmente.**
- `components.css` — todos os componentes base.
- `report.css` — modo captura e impressão A4 paisagem.
- `helpers.js` — utilitários obrigatórios (erro na tela, `store` seguro, toast, cópia, datas, turnos).
- `shell.html` — esqueleto completo de página nova (sidebar + topbar + notificações + main).
- `patterns.md` — catálogo de componentes com HTML pronto.
- `copy.md` — microtexto e terminologia em PT-BR.

---

## 1. Princípios (o que torna o design "não-IA")

1. **Cor é informação, não decoração.** Interface em tons de cinza; vermelho, âmbar, verde, azul e
   violeta só aparecem para indicar estado. Se tirar a cor e o elemento perder significado, a cor está certa.
2. **Status = ponto de 7px + texto.** Nunca pílula colorida preenchida, nunca badge em CAIXA ALTA.
3. **Números em fonte mono** (`JetBrains Mono`) para códigos, quantidades, horários, NT, matrícula, %.
   Com `font-feature-settings:"tnum"`, colunas alinham sozinhas.
4. **Faixa de KPIs única dividida por bordas**, não 4 cards separados com ícone em caixinha colorida.
5. **Tabelas em vez de cards** sempre que houver mais de ~6 itens. Linha densa (44–52px), ações
   aparecem só no hover, clique na linha expande o detalhe.
6. **Hierarquia por peso e tom de texto** (`--text`, `--text-2`, `--text-3`), não por tamanho exagerado
   nem por cor.
7. **Sem nomes truncados** em relatórios. Se não cabe, quebre linha ou mude o layout.
8. **Toda tela entrega algo além do dado bruto**: ritmo vs tempo decorrido, comparação com período
   anterior, "pontos de atenção" automáticos, meta visível. Ver §6.

### Proibido (remova se encontrar)
- `linear-gradient` / `radial-gradient` decorativo, glow, `backdrop-filter`, sombras coloridas.
- Faixa tricolor (verde/amarelo/azul) no rodapé ou topo.
- Ícone dentro de quadrado/círculo colorido ao lado de cada título ou KPI.
- Emojis na interface (só permitidos no **texto copiado para WhatsApp**: ⚠️ ✅ ▲ ▼).
- Rótulos em CAIXA ALTA com letter-spacing (exceção: cabeçalho de grupo em tabela de relatório, 11.5px).
- Badges preenchidos coloridos ("ATIVO" verde, "PENDENTE" laranja).
- Gráfico de rosca/pizza (use barra proporcional horizontal).
- Títulos genéricos: "Bem-vindo!", "Dashboard Incrível", "Visão Geral Completa".
- `border-radius` > 8px em containers; botões arredondados tipo pílula.
- Textos de marketing ("Gerencie tudo com facilidade!").

---

## 2. Tokens

Copie `resources/tokens.css` no início do `<style>`. Resumo:

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0e1013` | `#f6f7f9` | fundo da página |
| `--surface` | `#14171b` | `#ffffff` | cards, sidebar, topbar |
| `--surface-2` | `#191c21` | `#fafbfc` | cabeçalho de tabela, detalhe expandido |
| `--hover` | `#1d2127` | `#f1f3f5` | hover, item ativo, segmento ligado |
| `--border` / `--border-strong` | `#23272e` / `#2e333b` | `#e4e7eb` / `#d3d8de` | divisórias / inputs e botões |
| `--text` / `--text-2` / `--text-3` | `#e6e8eb` / `#9aa1ab` / `#6b727c` | `#14171b` / `#5b636e` / `#8a929c` | principal / secundário / rótulo |
| `--accent` | `#4c8dff` | `#2563eb` | foco, seleção, marcador do "agora" |
| `--red` `--amber` `--green` `--violet` | | | atraso/erro · pendente/atenção · ok/concluído · lote piloto, PIN, férias |

- Fonte: `Inter` 400/500/600, corpo **13px**. Mono: `JetBrains Mono` 400/500.
- Raio: `--radius:6px` (modais 8px, badges 3–4px, avatares 50%).
- Tema: `[data-theme="light"]` no `<html>`; botão de lua alterna.
- Ícones: SVG inline 24×24, `stroke-width:1.6`, sem preenchimento, 16px (14px em botões).
  Use os paths do objeto `ICON` em `resources/helpers.js` para manter o mesmo traço.

Semântica de cor fixa (não invente outras):

| Estado | Cor | Exemplos |
|---|---|---|
| Concluído / pago / presente / online | `--green` | NT concluída, item pago |
| Em andamento / pendente com ação / atenção | `--amber` | parcial, atestado, sem máquina, volume baixo |
| Atraso / não concluído / falta / erro | `--red` | NT > 2h, turno fechou com saldo, abaixo da meta |
| Selecionado / agora / foco | `--accent` | turno atual, dia selecionado, aguardando aprovação |
| Categoria especial | `--violet` | LP (lote piloto), PIN, férias |
| Programado / futuro / neutro | contorno `--text-3` sem preenchimento | pendente, folga de escala |

---

## 3. Estrutura de página

```
┌ sidebar (52px recolhida | 236px aberta) ┬ topbar 48px: breadcrumb · turno · relógio · data │ online │ 🔔 │ ☾ │ avatar
│  logo + marca                            ├──────────────────────────────────────────────────────────
│  Menu principal                          │ main (padding 24px 28px)
│  Operações e fábrica                     │   page-head: h1 18px + subtítulo --text-3 │ ações à direita
│  Administração                           │   [tabs]  (se houver visões)
│  ─ rodapé: dev + Recolher menu           │   faixa de KPIs (summary)
│                                          │   toolbar: segmentado · busca "/" · selects · switches
│                                          │   conteúdo (tabela / grid de cards / lado a lado)
```

- Use `resources/shell.html` como ponto de partida. Ele já tem sidebar expansível
  (tecla `[`, lembra estado), painel de notificações (tecla `N`), tema, relógio e turno atual.
- Painel lateral de atividade (340px à direita) só em telas operacionais "ao vivo" (ex.: NTs).
- Breadcrumb: `Área / <b>Tela</b>` (ex.: `Pesagem / Painel de produção`, `Administração / Usuários`).

### Menu (ordem fixa)
- **Menu principal:** Dashboard · Gerenciar NTs (contador de abertas) · NTs concluídas · Solicitações · Configurações
- **Operações e fábrica:** Mão de obra · Painel de produção · Heijunka
- **Administração:** Gestão de usuários (contador vermelho de aprovações pendentes)

Item ativo: fundo `--hover` + barra de 2px `--accent` à esquerda. Recolhido: só ícones, tooltip com
o nome, contador vira ponto vermelho.

---

## 4. Componentes principais

Detalhes e HTML em `resources/patterns.md`. Resumo das regras:

- **Botões:** 32px (28px `.sm`). Padrão = contorno `--border-strong`, texto `--text-2`.
  `.primary` = fundo `--text`, texto `--bg` (preto no claro, branco no escuro) — **no máximo um por área**.
  `.danger` só muda para vermelho no hover.
- **Segmentado (`.seg`):** filtros de período, modo de visão, turno. Item ligado = `--hover`.
- **Abas (`.tabs`):** sublinhado de 2px `--text`; contador mono ao lado (`.n`, vermelho se alerta).
- **Faixa de KPIs (`.summary`):** 3–6 colunas; `label` 12px `--text-3` (com ponto de cor opcional),
  `strong` 20–28px 600, `p`/`small` com contexto ("de 29 escalados", "meta 50%"). Clicável quando filtra.
- **Tabela:** cabeçalho `--surface-2` 36px 12px `--text-3`; colunas ordenáveis ficam `--text` quando ativas;
  linha hover `--hover`; `chevron` que gira 90° ao expandir; detalhe em `--surface-2` com indentação.
- **Barra de progresso:** 4–8px, trilho `--track`/`--border`; preenchimento `--text-2` (neutro),
  `--green` quando 100%, `--accent` quando é métrica principal. **Marcador vertical de 2px** para meta
  ou tempo decorrido.
- **Busca:** 32px com ícone, `kbd "/"` à direita; atalho `/` foca.
- **Modal:** overlay `rgba(0,0,0,.55)`, caixa `--surface` raio 8px, cabeçalho/rodapé com borda,
  Esc e clique fora fecham. Formulários em grid 2 colunas, `label` 12px acima do campo.
- **Gaveta (drawer):** 440px à direita para editar entidade (usuário, ordem). Mostra
  "Alterações não salvas" e desabilita Salvar sem mudança.
- **Toast:** pílula `--text`/`--bg` centralizada embaixo, 1,8s. Toda ação confirma com toast.
- **Switch:** 26–28×15–16px, ligado = `--accent`.
- **Etiqueta textual (`.flag`):** 10.5–11px, borda `--border-strong`, texto na cor do estado
  (ex.: `Urgente`, `Controlado`, `volume baixo`, `LP` violeta). Nunca preenchida.
- **Avatar:** círculo 22–32px, iniciais 600, fundo `#2a3038`; ponto verde = online.
- **Linha do tempo (feed):** hora mono à direita · linha vertical · anel verde · título + meta em `--text-3`.
- **Gráficos:** SVG desenhado à mão (sem biblioteca). Barras empilhadas (principal `--accent`
  na base, resto `--bar` acima), linha `--amber` para %, média móvel tracejada `--text-2`,
  meta em `--red` a 70% de opacidade, dia/hora em andamento com barra tracejada e opacidade .45.
  Tooltip escuro com `dl` mono. Eixo em mono 10.5px `--text-3`.

---

## 5. Relatório / print / WhatsApp

Telas que viram relatório (Painel de produção, Heijunka) devem ter:

1. **Totais do dia em destaque no topo** (número 34px + `/total` + % + barra + divisão por turno).
2. **Visão "Lado a lado"** (3 colunas por turno, tabela mini com ponto de status · máquina mono ·
   produto que quebra linha · real/prog) e **visão "Detalhado"** (seções por turno, tabela completa).
   Salve a escolha com `store`.
3. **Botões agrupados em `.seg.share`:** `WhatsApp` (copia texto formatado) · `Imagem` (opcional,
   html2canvas via CDN com fallback) · `Captura` (tela limpa + tela cheia, Esc sai) · `PDF` (`window.print`).
4. **`.print-head`** oculto na tela e visível em captura/impressão: título + legenda de status +
   "Emitido em dd/mm às hh:mm".
5. CSS de `resources/report.css`: `@page A4 landscape`, cores claras forçadas, `.no-print` some,
   `break-inside:avoid` em linhas, `thead` repete.

Texto para WhatsApp (`waText()`): título em `*negrito*`, data e hora de atualização, linha em branco,
métricas `*Rótulo:* valor (pct%)`, blocos por turno, alertas com `⚠️`, tendências com `▲`/`▼`.

---

## 6. Inteligência esperada

Não entregue só a tabela. Cada tela deve calcular e exibir ao menos um destes:

- **Ritmo:** `% realizado` vs `% do turno decorrido`; alerta se ficar mais de `RITMO_TOL` (15) pp atrás.
  Mostre o marcador de tempo decorrido na barra.
- **Comparação:** vs período anterior (em pp), vs média do período, vs meta (`▲ +6,2 pp`).
- **Continuidade entre turnos:** saldo não concluído num turno → "Reprogramada no 1º turno" /
  "Saldo do 3º turno: fechou 1/3". Sem reprogramação = vermelho.
- **Pontos de atenção** gerados por regras, ordenados por peso, clicáveis (rolam até a linha e
  piscam `flash`). Ponto vermelho = crítico, âmbar = atenção, cinza = informativo.
- **Qualificadores honestos:** recorde em dia de volume baixo recebe `flag`; dia em andamento
  fica fora de médias e recordes.
- **Regras configuráveis no topo do `<script>`** em `CONFIGURAÇÃO` (ex.: `META`, `SLA_MIN`,
  `LATE_MIN`, `INATIVO_DIAS`, `TRAT_REGRA`, `SHIFTS`). Nunca números mágicos no meio do código.

Domínio Novamed a respeitar:
- **Turnos:** 3º 23:45–07:20 (abre o dia produtivo) · 1º 07:20–15:50 · 2º 15:50–23:45.
- **Turmas A–D**, escala com ciclo de 28 dias (folga de escala ≠ folga flexível ≠ férias).
- **Vias:** úmida e seca. **PD/PA:** automática e direta. **LP** = lote piloto.
- Materiais com `**` no nome = **controlados** (exibir etiqueta `Controlado`, remover os `**`).
- Códigos SAP de 6 dígitos (sufixo `I` possível), NT de 6 ou 10 dígitos, quantidades em kg com 3 casas
  (`toLocaleString('pt-BR')`).

---

## 7. Regras de código (obrigatórias)

Arquivo **HTML único** (CSS e JS embutidos), sem framework, sem build. Deve abrir por duplo clique,
no preview do OneDrive/SharePoint e em Edge/Chrome corporativos.

1. **Primeira coisa no `<script>`:** o listener de erro que mostra faixa vermelha (`errBanner`) — ver
   `helpers.js`. Tela em branco é inaceitável.
2. **Nunca acesse `localStorage` direto.** Use o wrapper `store.get/set/del` com `try/catch`
   (bloqueio no preview do SharePoint já derrubou uma tela inteira).
3. **Inicialização dentro de `try{ … }catch(e){ … }`** que dispara o `errBanner`.
4. Evite sintaxe que quebra em visualizadores antigos: `?.`, `??=`, `||=`, `catch{` sem parâmetro.
   Prefira `(x||{}).prop`, `catch(e){}`. `const/let`, arrow functions e template strings são OK.
5. Clipboard com fallback (`textarea` + `execCommand('copy')`) — ver `copyText` em `helpers.js`.
6. Dados de exemplo num bloco `/* DADOS DE EXEMPLO (substituir pela API) */`; chamadas de API
   isoladas em funções `apiXxx()` que retornam Promise.
7. Render por funções `renderXxx()` + um `render()` geral; estado em variáveis no topo; eventos por
   delegação (`closest('[data-...]')`).
8. Escape de texto vindo de dados com `esc()` antes de interpolar em HTML.
9. Formatação sempre `pt-BR`: `toLocaleString('pt-BR')`, datas `dd/mm`, horas `hh:mm`, duração `3h 47m`,
   percentuais inteiros (`51%`) ou `pp` com vírgula (`+6,2 pp`).
10. Atalhos: `/` busca · `Esc` fecha modal/gaveta/captura · `N` notificações · `[` sidebar ·
    `←/→` navega dia quando houver seleção de dia.
11. Acessibilidade mínima: `title` em botões só-ícone, `aria-label` em inputs sem rótulo visível,
    foco visível (`border-color:var(--accent)`).

---

## 8. Texto (PT-BR)

Ver `resources/copy.md`. Essencial:
- Frases curtas, sentence case ("Ordens em andamento", não "Ordens Em Andamento").
- Títulos descrevem o conteúdo ("Ritmo de pagamento", "Pontos de atenção", "Requer atenção").
- Vazio sempre explicado: "Nenhuma NT em atraso.", "Nenhum cadastro aguardando aprovação."
- Confirmações destrutivas dizem o efeito: "Desativar a conta de X? O acesso é bloqueado imediatamente."
- Termos Novamed: NT, OP, PD/PA, pesagem, pesada, baixa, lote, turma, turno, via úmida/seca,
  matéria-prima, excipiente, saldo na área, almoxarifado.

---

## 9. Fluxo de trabalho

1. Leia o pedido e identifique a tela de exemplo mais próxima (tabela no topo). Abra-a.
2. Se houver print da tela antiga, liste: dados exibidos, ações, filtros. **Nada pode sumir** —
   só mudar de lugar ou de forma. Diga ao usuário o que foi reposicionado.
3. Parta de `resources/shell.html` (ou do exemplo), aplique tokens e componentes.
4. Adicione pelo menos um elemento de inteligência (§6) e deixe as regras em `CONFIGURAÇÃO`.
5. Rode `python scripts/lint_design.py <arquivo.html>` e corrija tudo que for `ERRO`.
6. Abra no navegador (tema escuro **e** claro; largura 1366 e 1920). Se for relatório, teste
   Captura e Imprimir.
7. Ao responder: resultado primeiro, depois o que mudou por seção, regras assumidas e onde trocar os
   dados de exemplo pela API.
