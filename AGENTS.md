# AGENTS.md

Guia para agentes de IA que trabalham neste repositório. Leia isto antes de fazer alterações.

## Visão geral

**Oxe Preço** é a API backend (Node.js/Express) de um app (Flutter, repositório separado) de
acompanhamento de preços de supermercado. O fluxo principal:

1. O usuário escaneia o QR Code de uma NFC-e (cupom fiscal da SEFAZ-BA).
2. O app envia a URL do QR Code para `POST /consultar-nfce`.
3. O backend abre a página com **Puppeteer**, faz o parse do HTML (`node-html-parser`) e devolve
   o JSON estruturado da nota.
4. Os dados são normalizados com **OpenAI** (`gpt-4o-mini`) e persistidos no **SQL Server** via
   **Sequelize**.

Os comentários e mensagens do código estão em **português** — mantenha esse idioma.

## Stack

- **Runtime:** Node.js (CommonJS, `require`/`module.exports` — não há `"type": "module"`).
- **Web:** Express 5.
- **Banco:** SQL Server via Sequelize 6 + dialeto `mssql` (driver `tedious`).
- **Scraping:** Puppeteer (instância global reaproveitada).
- **IA:** SDK `openai`.
- **Auth:** `jsonwebtoken` + `bcrypt`.
- **Testes:** Jest + Supertest (`sqlite3` disponível como devDependency para testes de DB).

## Comandos

```bash
npm install          # instala dependências
npm start            # sobe a API (node server.js) — porta do .env (padrão 3000)
npm test             # roda a suíte Jest (__tests__/)
```

Não há script de lint/build. Não há migração automática: o schema é aplicado manualmente via SQL.

## Configuração / variáveis de ambiente

Copie/ajuste `.env` na raiz (não é versionado). O arquivo é carregado com `dotenv`.

```
DB_SERVER=localhost
DB_NAME=OXE_PRECO
DB_USER=sa
DB_PASSWORD=...
PORT=3000
OPENAI_API_KEY=...
# opcional: JWT_SECRET (fallback 'super_secret_key_oxe_preco')
```

> **Segurança:** o `.env` atual contém credenciais reais (senha do banco e chave OpenAI). Nunca
> versione esses valores nem os imprima em logs ou respostas ao usuário.

## Estrutura de diretórios

```
server.js                     # entrypoint: Express, rotas inline, parser da NFC-e, endpoints da API
database/
  index.js                    # instância Sequelize (mssql) + hook global de uppercase
  ddl_usuarios.sql            # DDL inicial da tabela Usuarios (desatualizado, ver migration)
  migration_uuid_standardize.sql  # migração INT/TINYINT -> UNIQUEIDENTIFIER
  migration_alertas_watchers_dispositivos.sql  # novas tabelas + colunas de Mercados/Produtos
models/
  index.js                    # define associações e reexporta os models
  {Mercado,Compra,ItemComprado,Produto,Variacao,UnidadeMedida,Usuario}.js
services/
  OpenAIService.js            # normalização de descrições de itens via OpenAI (chunks de 50)
  ProcessNfceService.js       # persiste o JSON da NF no banco em transação
middlewares/
  auth.js                     # valida Bearer JWT, injeta req.userId e req.user
routes/
  auth.js                     # /api/auth/register e /api/auth/login
__tests__/                    # testes Jest (auth, OpenAIService, ProcessNfceService)
specs/
  historico-precos-api.md     # contrato dos endpoints de histórico/ranking (a implementar)
test_auth.js / test_db.js     # scripts manuais de debug contra o DB real (não são testes Jest)
```

## Arquitetura e convenções

### Rotas e autenticação
- Rotas de auth ficam em `routes/auth.js`; o resto vive diretamente em `server.js`.
- Rotas de dados usam `authMiddleware`, que popula `req.userId` (UUID do usuário) e `req.user`.
- Erros retornam JSON com a chave `erro` (`{ erro: '...' }`). Siga esse padrão.
- `POST /consultar-nfce` responde `409 { duplicada: true, compraId }` quando a NF já foi importada e
  `422` quando nenhum item é encontrado.
- O JWT usa o id do usuário em `{ id }`; expiração de 30 dias. `SECRET_KEY` tem fallback fixo —
  definir `JWT_SECRET` em produção.

### Parser da NFC-e (`server.js`)
- Funções puras: `parseSefazHtml` orquestra `parseEstabelecimento`, `parseItens`, `parseTotais`,
  `parseMetadados`. Ao mexer em seletores, considere adicionar/atualizar teste.
- `toDouble` normaliza valores monetários no formato BR (`R$ 1.234,56`).
- O parser é específico do HTML da SEFAZ-BA (`estado: 'BA'`).
- Puppeteer usa **uma instância global** (`getBrowserInstance`) reaproveitada entre requisições, com
  `--no-sandbox` e `--ignore-certificate-errors` (a SEFAZ usa certificado não confiável localmente).
  Feche páginas no `finally`; o browser é encerrado em `SIGINT`/`SIGTERM`.

### Persistência (`services/ProcessNfceService.js`)
- Tudo roda dentro de uma `sequelize.transaction()`. Em erro, faz `rollback` e relança.
- Deduplicação pela `chave_nfce` (unique em `Compra`); se já existe, `rollback` e retorna
  `{ success: false, message: 'Nota Fiscal já processada.', compraId }`.
- Cria/reaproveita `Mercado` (por CNPJ), `Produto` (por `nome_base`), `Variacao` e `UnidadeMedida`;
  sempre cria nova `Variacao` por item.
- A falha de persistência em `/consultar-nfce` é **engolida** de propósito (não quebra o parse); a
  resposta 200 continua com o JSON extraído.

### IA (`services/OpenAIService.js`)
- `normalizeItems(descricoes)` divide em chunks de 50 e chama em paralelo; retorna sempre um array do
  mesmo tamanho da entrada (com fallback item a item em caso de erro).
- Prompt em português, `temperature: 0.1`, `response_format: json_object`. O modelo (`gpt-4o-mini`)
  está fixo no código.

### Models e banco
- Todos os PKs são **UUID** (`Sequelize.UUIDV4`), após a migração `migration_uuid_standardize.sql`.
  `ddl_usuarios.sql` está desatualizado (usa `INT IDENTITY`) — prefira a migração.
- `timestamps: false` e `created_at` com `defaultValue: Sequelize.literal('getutcdate()')`;
  `tableName` no plural em português (ex.: `Compras`, `ItensComprados`).
- **Hook global** em `database/index.js`: antes de validar, converte strings para MAIÚSCULO, exceto
  `email`, `senha_hash`, `senha` e `token`. Isso afeta todos os models criados via Sequelize —
  salvar itens no DB armazena texto em caixa alta.
- `Mercado` tem hook próprio que remove não-dígitos do `cnpj`.
- Sempre declare novas associações em `models/index.js`.

## Modelo de dados (resumo)

`Mercado` 1—N `Compra` 1—N `ItemComprado` N—1 `Variacao` N—1 `Produto`.
`Compra` e `Variacao` referenciam `UnidadeMedida`. `Compra.user_id` liga ao `Usuario`.

## Testes

- Ficam em `__tests__/` e usam Jest com mocks de `../models`, `openai` e `../services/OpenAIService`.
- Os testes **não** tocam o banco real: mockam os models. Rode `npm test` antes de finalizar mudanças.
- `test_auth.js` e `test_db.js` são scripts manuais contra o DB real — **não** são executados pelo
  Jest e não devem ser incluídos na suíte automaticamente.

## Contrato pendente (specs/)

`specs/historico-precos-api.md` descreve endpoints a implementar:
`GET /api/produtos/melhores-precos` e `GET /api/produtos/:produtoId/historico-precos`.
A regra central é o **preço normalizado** = `preco_unit_real / variacao.tamanho_unidade` (para `un`,
não dividir). `/api/produtos/melhores-precos-agrupados` está marcado como deprecado, mas deve ser
mantido durante a transição. Consulte a spec ao implementar — ela é a fonte de verdade do contrato.

## Git

- Remote: `https://github.com/Mike2SA/oxe_preco.git`.
- Mensagens de commit seguem Conventional Commits em português, minúsculas, sem acento
  (ex.: `fix: padroniza todos os models para UUID`, `feat: adiciona verificacoes de duplicidade`).

## Pegadinhas

- Não quebre o contrato do Flutter: nomes de campos em PT-BR (`precoNormalizado`, `mercado`, etc.) e
  o formato de `fromJson` do app são consumidos externamente.
- O hook de uppercase pode surpreender testes que comparam strings de entrada/saída.
- `server.zip` está versionado (artefato); ignore-o ao investigar o código.
- Express 5 muda o comportamento de erros/rotas em relação ao Express 4 — evite padrões exclusivos do 4.
