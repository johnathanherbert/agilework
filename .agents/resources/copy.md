# Texto e terminologia · AgileWork (PT-BR)

## Tom
- Direto, técnico, sem marketing. O usuário é operador, líder ou gestor da Pesagem.
- Sentence case em tudo: "Ordens em andamento", "Pontos de atenção", "Registro de auditoria".
- Números sempre com contexto: "12/27", "de 29 escalados", "há 15 dias ou mais", "meta 50%".

## Troque isto → por isto
| Evite | Use |
|---|---|
| Bem-vindo! / Olá, usuário! | Entrar · Olá, Johnathan (quando lembrar o usuário) |
| Painel de Controle Admin | Administração |
| Registre-se aqui | Solicitar acesso |
| Pódio de Desempenho | Ranking de dias por % PD/PA |
| Mock | Dados de exemplo (no código) · botão "Mock" só em dev |
| Ver detalhes ↗ (em cada item) | Abrir (aparece no hover) |
| INATIVO (38d) em badge laranja | Inativo · 38 d (ponto âmbar + texto) |
| Especiais | Controlados |
| Sem PIN (badge) | — (célula vazia) |
| Clique aqui para… | (a própria linha é clicável; explique no subtítulo) |
| Ops! Algo deu errado | Erro na tela: <mensagem> (linha N) |
| Tem certeza? | Desativar a conta de Airton Reis? O acesso é bloqueado imediatamente. |

## Vocabulário Novamed / Pesagem
- **NT** — nota técnica (solicitação de material ao almoxarifado). "Criar NT", "NT 692433", "NTs em aberto".
- **Pago / pagar item** — item da NT entregue. "Marcar como pago".
- **OP** — ordem de produção. "OP S/N" quando ainda sem número.
- **Pesada** — ordem já pesada. **Baixa** — baixa no SAP.
- **Receita** — lista de matérias-primas/excipientes da ordem.
- **Saldo na área** — material já disponível na pesagem.
- **Falta solicitar** = necessário − saldo − NTs em aberto.
- **Fora da necessidade** — item em NT sem ordem correspondente.
- **Controlado** — material com `**` no cadastro (A2, C1…).
- **Via úmida / via seca**; **PD/PA automática / direta**; **LP** = lote piloto.
- **Máquina / família**: COP FET.5, COP LEG.12, KIL.500 TT (mono).
- **Turno**: 3º (23:45–07:20), 1º (07:20–15:50), 2º (15:50–23:45). "1º turno", nunca "Turno 1" em texto corrido.
- **Turma** A–D; **folga de escala** (ciclo), **folga flexível** (saldo), **férias**, **atestado**, **falta injustificada**, **atraso**.
- **Tratativa** — ação com colaborador (feedback, advertência, RH).
- **Heijunka / % PD/PA** — participação de PD/PA nas ordens entregues.
- **Lead time** — criação → último pagamento. **SLA / dentro do prazo**.

## Formatos
| Dado | Formato |
|---|---|
| Data curta | `29/09` · com dia: `Ter, 29/09` · longa: `Terça-feira, 29 de setembro de 2026` |
| Data e hora | `29/09 11:14` · completa: `29/09/2026 11:14` |
| Hora | `11:14` (relógio: `11:14:07`) |
| Relativo | `agora`, `há 5 min`, `hoje 08:34`, `ontem 23:41`, `há 24 dias` |
| Duração | `3h 47m` · compacta em relatório: `3h47` |
| Quantidade | `1.253` · kg: `17,849 kg` (3 casas) · un: `590.148 UN` |
| Percentual | `51%` · variação: `+6,2 pp` / `−19,7 pp` · absenteísmo: `2,35%` |
| Contagem | `12/27` (real/programado) |

## Mensagens (toast)
Curtas, no passado, sem ponto final: "Dados atualizados", "NT 692433 copiada", "Ocorrência salva",
"Resumo copiado — cole no WhatsApp", "Modo captura · Esc para sair", "3 usuários exportados".

## Vazios
"Nenhuma NT encontrada." · "Nenhuma NT em atraso." · "Nenhum cadastro aguardando aprovação." ·
"Tudo em dia. Nenhuma notificação nova." · "Nenhuma ordem programada para este turno." ·
"Sem dias completos no período." · "Nada fora do padrão."
