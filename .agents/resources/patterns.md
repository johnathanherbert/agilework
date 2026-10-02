# Catálogo de padrões · AgileWork

Todos os trechos usam classes de `components.css` e ícones de `helpers.js` (`ic('nome')`).
Para ver funcionando, abra o exemplo indicado em cada item.

---

## 1. Cabeçalho da página
```html
<div class="page-head">
  <div>
    <h1>Painel de produção</h1>
    <p class="subtitle"><i class="live"></i>Programação de Ter, 29/09 · 1º turno em andamento</p>
  </div>
  <div class="actions">
    <div class="seg share">…WhatsApp · Captura · PDF…</div>
    <button class="btn">…</button>
    <button class="btn primary"><svg…plus/>Ordem</button>   <!-- no máximo 1 primary -->
  </div>
</div>
```
- `h1` diz o que é a tela, sem adjetivo. Subtítulo diz o recorte (data, período, regra).
- `.live` (ponto verde pulsando) só se os dados atualizam sozinhos.

## 2. Faixa de KPIs
```html
<section class="summary" style="grid-template-columns:repeat(5,1fr)">
  <button data-quick="all" class="on"><label>Total de usuários</label><strong>38</strong><p>cadastrados</p></button>
  <button data-quick="online"><label><i class="dot" style="background:var(--green)"></i>Online agora</label><strong>4</strong><p>ativos nos últimos 5 min</p></button>
  <div class="bad"><label><i class="dot" style="background:var(--red)"></i>Em atraso</label><strong>9</strong><p>&gt; 2h sem início</p></div>
</section>
```
- Use `<button>` quando o KPI filtra a lista (estado `.on`). Clicar de novo volta para "todos".
- Os números precisam fechar entre si (ex.: não mostrar "Ativos 38" e "Inativos 13" com total 38 —
  separe "Contas ativas" de "Sem atividade").
- Métrica principal pode ganhar barra com marcador de meta:
  `<div class="bar main"><span style="width:51%"></span><b style="left:calc(50% - 1px)"></b></div>`

**Totais do dia (relatório)** — `examples/painel_producao_redesign.html` → `.daybar`:
número 34px + `/total` + `%` à direita + barra 8px + divisão por turno em mono (`3º 11/13 · 1º 1/14 · 2º —`).

## 3. Toolbar
```html
<div class="toolbar">
  <div class="seg" id="perSeg"><button class="on">7 dias</button><button>15 dias</button><button>30 dias</button><button>Mês atual</button></div>
  <span class="vsep"></span>
  <label class="search"><svg…search/><input id="q" placeholder="Buscar NT, código ou material"><kbd>/</kbd></label>
  <select class="select"><option value="">Todas as famílias</option>…</select>
  <label class="check"><input type="checkbox">Ocultar concluídas</label>
  <div class="grow"></div>
  <span class="muted" style="font-size:12px">11 de 38 usuários</span>
</div>
```

## 4. Abas com contador
```html
<div class="tabs">
  <button class="tab active" data-v="quadro">Quadro do dia</button>
  <button class="tab" data-v="occ">Ocorrências <span class="n">14</span></button>
  <button class="tab" data-v="trat">Tratativas <span class="n alert">3</span></button>
</div>
```

## 5. Tabela com linha expansível
`examples/gerenciamento_nts_redesign.html`, `examples/nts_concluidas_redesign.html`, `examples/solicitacoes_redesign.html`
- Grid CSS (`.row` com `grid-template-columns`) quando precisa de linha + detalhe; `<table class="t">` para tabelas simples.
- 1ª coluna: chevron (`.chev`, gira quando `.open`). Código/NT em mono 12.5px 500 + botão copiar que aparece no hover.
- Status: `<span class="st late"><i></i>Em atraso</span>`.
- Coluna de tempo (`Aberta há 3h 12m`) fica vermelha quando passa do limite.
- Ações (`.row-actions`: editar, adicionar, excluir) só no hover, excluir fica vermelho no hover.
- Detalhe (`.detail`) com sub-tabela `.items`/`.sub-t` em `--surface-2`, indentado 40px.
- Agrupamento por dia: linha `.group` ("Hoje", "Ontem", "Qui, 24/09") quando ordenado por data.
- Rodapé: "1–25 de 132" + Anterior/Próxima.

## 6. Status (ponto + texto)
| Classe | Uso |
|---|---|
| `.st.ok` | Concluída, Pago, Presente, Atendido |
| `.st.and` | Em andamento, Parcial |
| `.st.late` / `.st.nao` | Em atraso, Não concluída · faltou 2 |
| `.st.pend` / `.st.prog` | Pendente, Programada (anel sem preenchimento) |
| `.st.sel` | Aguardando aprovação, Coberto por NT |
| `.badge.now` / `.badge.done` | Fase de turno: Em andamento (azul pulsando) / Encerrado / Próximo |

Etiquetas textuais: `<span class="flag">Urgente</span>`, `<span class="flag">volume baixo</span>`,
`<span class="lp">LP</span>`, `<span class="turma">D</span>` (quadrado mono 20px para turma).

## 7. Barra de progresso com marcador
```html
<div class="bar"><span style="width:7%"></span><b style="left:calc(55% - 1px)" title="Tempo decorrido"></b></div>
```
- Preenchimento neutro `--text-2`; `.full` verde em 100%; `.main` azul para métrica principal.
- `<b>` = meta ou tempo decorrido. Se o realizado ficar mais de 15 pp atrás, texto "Abaixo do ritmo" em vermelho.
- Barra empilhada (PA/PD/Manual): `.stack` com `<i>` por parte, largura proporcional — ver Heijunka "Por turno".

## 8. Relatório por turno (lado a lado)
`examples/painel_producao_redesign.html` → `renderSide()`
- `.cols` com `grid-template-columns:repeat(n,minmax(0,1fr))`, um `.scol` por turno.
- `.sc-head`: nome + horário mono + fase + botão "+"; dois mini-KPIs (Ordens, PD/PA) com barra.
- Turno atual: `border-top:3px solid var(--accent)`.
- `table.mini` com `colgroup` fixo (ponto 22px · máquina 86px · produto auto · qtd 50px).
- Grupos `tr.g` ("ÚMIDA 5/5", "SECA 6/8", "PD/PA · AUTOMÁTICA 6/7") — única exceção permitida de caixa alta.
- Notas de continuidade abaixo do produto: `.note` âmbar ("Saldo do 3º turno: fechou 1/3"), `.note.info` cinza.

## 9. Pontos de atenção
```js
// cada item: {c:cor, w:peso, t:título, d:detalhe, go:id-alvo, tag:contexto}
L.push({c:'var(--red)', w:3, t:'1º turno abaixo do ritmo', d:'7% realizado com 55% do turno decorrido · faltam 13 ordens em 3h47', go:'sh-1', tag:'1º turno'});
L.sort(function(a,b){return b.w-a.w;});
```
Render: `.ai` com ponto colorido, título 500, detalhe `--text-3`, tag à direita. Clique → `scrollIntoView` + classe `flash`.
Em grid de 2 colunas quando dentro de relatório; lista simples em card lateral.

## 10. Gráfico SVG (sem biblioteca)
`examples/heijunka_redesign.html` → `renderDaily()` ; `examples/dashboard_operacional_redesign.html` → `renderChart()` (barras com div)
- Escala "bonita": `niceMax(v)` arredonda para 10/20/50/100.
- Grade horizontal tracejada `stroke:var(--border)`, eixos em mono 10.5px `--text-3`, eixo % à direita.
- Barras: principal `--accent` embaixo, restante `--bar` em cima; largura `min(24, gw*.62)`.
- Linha de % `--amber` 1.8px; ponto cheio quando na meta, vazado quando abaixo.
- Média móvel 7 dias tracejada `--text-2`; meta `--red` opacidade .7.
- Período em andamento: opacidade .45 + contorno tracejado; fora de médias e recordes.
- Área de clique transparente por coluna (`rect.hit[data-k]`) → tooltip `.tip` + seleção destacada com `--accent-weak`.
- Redesenhar no `resize` (debounce 120ms) e ao sair do modo captura.

## 11. Mestre-detalhe
`examples/solicitacoes_redesign.html`: coluna esquerda 300px (`.orders`) com formulário curto no topo e
lista selecionável (`.order.sel` com borda esquerda `--accent`); clicar filtra a tabela da direita;
"Limpar filtro" aparece quando há seleção.

## 12. Calendário
`examples/mao_de_obra_redesign.html` → `renderCal()`: grade 7 colunas, célula 104px, dia em mono num
círculo (hoje = fundo `--text`), feriado em âmbar, até 3 eventos com ponto + nome curto e "+N mais",
painel lateral com detalhe do dia e resumo do mês. Duplo clique cria lançamento.

## 13. Modal de formulário
```html
<div class="overlay" id="mX"><form class="modal">
  <div class="modal-head"><h2>Lançar ocorrência</h2><button type="button" class="icon-btn" data-close>…close…</button></div>
  <div class="modal-body">
    <div class="field full"><label>Colaborador</label><select class="select">…</select></div>
    <div class="field"><label>Início</label><input class="input mono" type="date"></div>
    <div class="field"><label>Fim</label><input class="input mono" type="date"></div>
  </div>
  <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary">Salvar</button></div>
</form></div>
```
- Autopreenchimento ao digitar código (`.help.ok` "Encontrado: …").
- Validar conflito antes de salvar (ex.: período sobreposto) com `confirm` explicativo.

## 14. Gaveta de edição
`examples/admin_redesign.html` → `renderDrawer()`: cabeçalho com avatar/nome/e-mail, seções `.dr-sec`
(Situação em `.kv`, Função, Permissões com `.sw` — padrão travado com opacidade .55 —, Segurança,
Zona de risco com `.btn.danger`), rodapé "Alterações não salvas" + Cancelar/Salvar (desabilitado sem mudança).
Toda alteração salva gera linha no registro de auditoria.

## 15. Barra lateral + notificações
`resources/shell.html` (e `examples/admin_redesign.html`).
- Menu gerado de `MENU` (seção → itens `[chave, ícone, rótulo, contador]`).
- Notificações: abas Todas/Não lidas/NTs/Produção/Sistema; grupos "Última hora/Hoje/Anteriores";
  ponto azul = não lida; "Abrir" só no hover; ações "Marcar lidas" e lixeira; rodapé com status e "Som e alertas".
- `pushNotif(n)` adiciona, anima o contador (`bump`) e toca bip curto (WebAudio) se habilitado.

## 16. Login
`examples/login_redesign.html`: tela dividida (esquerda relógio 64px mono + turno atual com barra + 3 turnos;
direita formulário 340px). Segmentado "E-mail e senha | PIN". PIN em 4 caixas com auto-envio e colar.
"Olá, Nome" quando lembra o usuário + "Não sou eu". Bloqueio após 5 tentativas com contagem regressiva.
Caps Lock avisado. "Solicitar acesso" (não "Registre-se") com medidor de força.

## 17. Compartilhar (relatório)
```html
<div class="seg share">
  <button id="waBtn">…whatsapp…WhatsApp</button>
  <button id="capBtn">…capture…Captura</button>
  <button id="printBtn">…print…PDF</button>
</div>
```
Texto WhatsApp:
```
*Painel de produção · Pesagem*
Ter, 29/09 · atualizado às 12:02

*Ordens entregues no dia:* 12/27 (44%)
*PD/PA entregues no dia:* 7/14 (50%)

*1º turno* · em andamento
Ordens 1/14 (7%) · PD/PA 1/7 (14%)
⚠️ Abaixo do ritmo: 7% feito com 55% do turno decorrido
```

## 18. Estados vazios, carregando, erro
- Vazio: `.empty` com frase específica ("Nenhuma NT concluída no período.").
- Carregando botão: `<span class="spin"></span>Entrando…` e `disabled`.
- Erro de formulário: borda `--red` no campo + `.hint.err` abaixo; alerta geral `.alert` com borda vermelha.
- Sucesso: `.alert.ok` (borda verde) ou toast.
