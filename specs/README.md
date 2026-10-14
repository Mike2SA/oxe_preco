# Specs — OxePreço

Índice das especificações deste ciclo. As specs separam claramente o que é
**frontend** (app Flutter, `lib/`) do que é **backend** (API Node.js, fora deste repositório).

## Estrutura

```
specs/
  README.md                          # este arquivo (índice + convenções)
  backend/
    historico-precos-api.md          # contrato REST de histórico de preços / ranking
    otimizacao-lista-api.md          # custo por mercado + divisão ótima da lista
    catalogo-api.md                  # busca (?q=), EAN, categorias, sugestões
    alertas-preco-api.md             # watchlist + push de preços
    relatorios-e-orcamento-api.md    # gastos, economia e orçamento mensal
    sincronizacao-listas-api.md      # sync offline + compartilhamento de listas
    comunidade-api.md                # feed social (posts, curtidas, comentários)
    mercados-proximos-api.md         # mercados por proximidade/geolocalização
  frontend/
    01-onboarding-primeiro-acesso.md # onboarding só no 1º acesso + email no SharedPreferences
    02-melhores-precos-lista-expansivel.md # lista de menores preços com "Outros preços"
    03-detalhes-preco-item.md        # tela de detalhes do preço do item (filtro + gráfico)
    04-pesquisa-principal.md         # campo "Pesquisar" na Home
    05-modo-compra.md                # "estou no mercado": carrinho em tempo real
    06-comparativo-lista-mercado.md  # onde comprar a lista mais barato (otimização)
    07-home-busca-e-dados-reais.md   # dados reais na Home/busca + limpeza técnica
    08-crud-listas.md                # renomear/excluir listas e itens
    09-scanner-ean.md                # código de barras do produto na gôndola
    10-alertas-preco.md              # seguir produto e ser avisado
    11-painel-gastos-orcamento.md    # gastos por mês/mercado + orçamento
    12-offline-e-sincronizacao.md    # cache offline + fila de notas + sync
    13-categorias-lista.md           # agrupar itens por categoria
    14-repetir-e-compartilhar.md     # repetir compra + compartilhar lista
    15-comunidade-real.md            # feed real (substitui o mock)
    16-sugestoes-inteligentes.md     # sugestões do histórico real
    17-mercados-proximos.md          # onde comprar perto de mim
    18-colar-url-nfce.md             # fallback: colar o link da NFC-e
```

## Decisões de produto já fechadas

1. Onboarding aparece apenas na primeira abertura. Depois disso o app vai direto para o
   **Login** (auto-login continua desativado, por decisão anterior do usuário).
2. O e-mail do último acesso é guardado para **pré-preencher o Login**.
3. A visão de "melhores preços" por item substitui a visão agrupada por mercado dentro da
   `BestPricesListScreen` existente.
4. Comparação é por **Produto + Variação**, normalizando o preço por unidade (R$/kg, R$/L, R$/un).
5. Gráfico de evolução usa **linha única do melhor preço** ao longo do tempo.
6. O `#` das tabelas é **posição/ranking** (1 = melhor preço), não ID de banco.
7. A busca da Home abre uma **tela de busca somente leitura** (sem checkbox/quantidade).
8. A janela de "preço atual" é de **90 dias** (parametrizável no backend via `janelaDias`).
9. Se um produto tiver múltiplas variações, exibimos **somente a variação vencedora** (sem seletor).
10. O gráfico de evolução usa **`fl_chart`**, que será adicionado ao `pubspec.yaml`.
11. A busca filtra **localmente** a lista de `/api/produtos`; o parâmetro `?q=` fica como evolução futura.
12. O onboarding **não** terá botão "Pular".

## Contexto do backend (verificado em 13/10/2026)

O servidor `http://189.89.155.143:3000` respondeu:

- Rotas autenticadas já existentes retornam `401` sem token: `/api/produtos`, `/api/produtos/recentes`,
  `/api/produtos/melhores-precos-agrupados`, `/api/compras`, etc.
- Todos os candidatos a histórico de preços testados retornaram `404` (não existem ainda):
  `/api/produtos/historico`, `/api/produtos/:id/precos`, `/api/precos`, `/api/produtos/:id/historico`, etc.

Conclusão: **os endpoints de histórico/ranking do item precisam ser criados**; esta spec propõe o contrato.

## Ciclo 2 — Melhorias do dia-a-dia

Specs nascidas da análise de uso real do app. A coluna **Backend** indica o contrato REST
necessário; **Frontend**, a tela/fluxo no app Flutter.

| # | Ponto sugerido | Backend | Frontend |
|---|---|---|---|
| 05 | Modo compra ("estou no mercado") | — (usa endpoints atuais) | `frontend/05-modo-compra.md` |
| 06 | Comparativo/otimização da lista por mercado | `otimizacao-lista-api.md` | `frontend/06-comparativo-lista-mercado.md` |
| 07 | Home e busca com dados reais + limpeza técnica | `relatorios-e-orcamento-api.md` | `frontend/07-home-busca-e-dados-reais.md` |
| 08 | CRUD de listas (renomear/excluir/itens) | — (SQLite local) | `frontend/08-crud-listas.md` |
| 09 | Scanner de código de barras (EAN) | `catalogo-api.md` | `frontend/09-scanner-ean.md` |
| 10 | Alertas de preço / watchlist | `alertas-preco-api.md` | `frontend/10-alertas-preco.md` |
| 11 | Painel de gastos + orçamento | `relatorios-e-orcamento-api.md` | `frontend/11-painel-gastos-orcamento.md` |
| 12 | Offline real + sincronização | `sincronizacao-listas-api.md` | `frontend/12-offline-e-sincronizacao.md` |
| 13 | Categorias na lista | `catalogo-api.md` | `frontend/13-categorias-lista.md` |
| 14 | Repetir compra + compartilhar lista | `sincronizacao-listas-api.md` | `frontend/14-repetir-e-compartilhar.md` |
| 15 | Comunidade real (feed) | `comunidade-api.md` | `frontend/15-comunidade-real.md` |
| 16 | Sugestões inteligentes | `catalogo-api.md` | `frontend/16-sugestoes-inteligentes.md` |
| 17 | Mercados próximos / geolocalização | `mercados-proximos-api.md` | `frontend/17-mercados-proximos.md` |
| 18 | Colar URL da NFC-e (fallback) | — (usa `/consultar-nfce`) | `frontend/18-colar-url-nfce.md` |

### Ordem de ataque sugerida

1. **Saneamento (07 parcial)** — remover mocks/código morto e ligar botões (baixo risco).
2. **05 + 06** — entregam o maior valor de uso no dia-a-dia (compra e economia real).
3. **08 + 18** — pequenos ganhos de usabilidade, sem dependência de backend.
4. **12 + 09** — offline confiável e consulta na gôndola.
5. **10 + 11 + 16** — engajamento e controle financeiro (dependem de backend novo).
6. **13 + 14 + 15 + 17** — recursos incrementais.

### Dependências de pacote (frontend)

| Feature | Pacotes novos |
|---|---|
| 10 alertas (fase 2) | `firebase_messaging`, `flutter_local_notifications` |
| 12 offline | `connectivity_plus` |
| 14 compartilhar | `share_plus`, `qr_flutter` |
| 17 próximos | `geolocator` (fase 1), `google_maps_flutter` (fase 2) |

## Convenções

- Preços enviados pela API em `double` com ponto decimal; exibidos no app com vírgula e 2 casas.
- Datas na API em ISO-8601 (`YYYY-MM-DD`); exibidas como `dd/MM` (ou `dd/MM/yyyy` se o ano diferir do atual).
- Autenticação: `Authorization: Bearer <jwt_token>`.
- Textos de UI em pt-BR; estilo seguindo `OxeColors` (Material 3, Poppins).
