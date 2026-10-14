# Backend — API de Histórico de Preços e Ranking

> **Escopo:** backend (API Node.js, fora deste repositório). Documento de contrato que o time de
> backend precisa implementar para suportar as features 2, 3 e 4 do app.
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Contexto e modelo de dados assumido

Fontes atuais já consumidas pelo app:

| Endpoint | Uso |
|---|---|
| `GET /api/compras` | lista de compras (NFC-e) |
| `GET /api/compras/:id/itens` | itens de uma compra |
| `GET /api/produtos` | produtos base |
| `GET /api/produtos/recentes` | preços recentes (Home) |
| `GET /api/compras/itens-base` | produtos-base de compras |
| `GET /api/produtos/melhores-precos-agrupados` | melhores preços agrupados por mercado (será substituído na feature 2) |
| `POST /consultar-nfce` | parse da NFC-e a partir do QR Code |

Modelo conceitual (nomes conforme os `fromJson` do app):

- `Mercado(id, razao_social, cnpj)`
- `Compra(id, chave_nfce, data_compra, total_nf, mercado)`
- `Produto(id, nome)`
- `Variacao(id, marca, tamanho_unidade, produto)`
- `ItemComprado(id, preco_unit_real, preco_total_real, quantidade_embalagem, nome_original_nf, variacao)`

Cada `ItemComprado` de uma `Compra` é uma **observação de preço**: um produto/variacão, em um
mercado, em uma data, com um valor.

### 1.1 Preço normalizado (regra central)

Para comparar embalagens diferentes do mesmo item:

```
se variacao.tamanho_unidade (quantidadePadrao) > 0:
    precoNormalizado = item.preco_unit_real / variacao.tamanho_unidade
senão:
    precoNormalizado = item.preco_unit_real
```

- Unidade de medida (`kg`, `L`, `un`) determina o rótulo: `R$/kg`, `R$/L`, `R$/un`.
- Quando a unidade é `un`, exibimos o preço cheio (`preco_unit_real`), pois normalizar por 1 não muda nada.

### 1.2 Preço atual por mercado

Para cada mercado, o **preço atual** é a observação **mais recente** daquele mercado dentro da
**janela** (parâmetro `janelaDias`, padrão **90 dias**).

### 1.3 Ranking / posição (#)

Ordenando os mercados pelo preço atual (normalizado) de forma ascendente:

- posição `1` = **melhor preço**;
- posição `2` e `3` = 2º e 3º melhores;
- última posição = **pior mercado** (maior preço atual).

Empate de preço: desempata pela observação mais recente e depois pelo nome do mercado (ordem estável).

## 2. Endpoints propostos

### 2.1 `GET /api/produtos/melhores-precos`

Alimenta a **feature 2** (lista de itens com "Outros preços").

**Query params**

| Param | Obrigatório | Default | Descrição |
|---|---|---|---|
| `produtoIds` | sim | — | CSV de ids de produto, ex.: `1,2,3` |
| `janelaDias` | não | `90` | Janela de "preço atual" em dias |
| `variacaoId` | não | — | Restringe a uma variação específica |

**Resposta `200`** — array com um objeto por produto:

```json
[
  {
    "produtoId": "1",
    "variacaoId": "10",
    "nome": "Arroz Branco Tipo 1",
    "marca": "Tio João",
    "unidade": "kg",
    "quantidadePadrao": 5.0,
    "melhorPreco": 14.50,
    "melhorPrecoNormalizado": 2.90,
    "data": "2026-10-13",
    "mercado": { "id": "3", "nome": "Unimar" },
    "posicao": 1,
    "outrosPrecos": [
      { "posicao": 2, "data": "2026-10-13", "mercado": { "id": "5", "nome": "Atakarejo" }, "preco": 14.75, "precoNormalizado": 2.95 },
      { "posicao": 3, "data": "2026-09-03", "mercado": { "id": "7", "nome": "Unibem" }, "preco": 19.90, "precoNormalizado": 3.98 }
    ],
    "piorMercado": { "posicao": 9, "data": "2026-08-12", "mercado": { "id": "7", "nome": "Unibem" }, "preco": 19.90, "precoNormalizado": 3.98 }
  }
]
```

Regras da resposta:

- `outrosPrecos`: no máximo as posições `2` e `3` (0, 1 ou 2 itens conforme os mercados disponíveis).
- `piorMercado`: última posição do ranking; `null` se houver menos de 2 mercados com preço.
- Quando `piorMercado` coincidir com um item de `outrosPrecos` (poucos mercados), o front deve
  evitar duplicar a linha (ver feature 2).
- Quando `variacaoId` não é informado, retorna a variação de **menor preço normalizado** do produto.
- Valores monetários são **unitários** (`preco_unit_real` e sua versão normalizada), não o total da linha.

**Erros**

| Código | Situação |
|---|---|
| `400` | `produtoIds` ausente/vazio |
| `401` | token ausente/expirado |
| `200` com `[]` | nenhum preço encontrado na janela |

### 2.2 `GET /api/produtos/:produtoId/historico-precos`

Alimenta a **feature 3** (detalhes do item, filtro por mercado e gráfico).

**Query params**

| Param | Obrigatório | Default | Descrição |
|---|---|---|---|
| `variacaoId` | não | melhor variação | Variação a detalhar |
| `mercados` | não | todos | CSV de ids de mercado para filtrar |
| `janelaDias` | não | `365` | Janela do histórico |
| `agrupar` | não | `true` | `true` = remove variações repetidas por mercado (ver 2.2.1) |

**Resposta `200`**

```json
{
  "produtoId": "1",
  "variacaoId": "10",
  "nome": "Arroz Branco Tipo 1",
  "marca": "Tio João",
  "unidade": "kg",
  "quantidadePadrao": 5.0,
  "melhorPrecoAtual": {
    "preco": 14.50,
    "precoNormalizado": 2.90,
    "data": "2026-10-13",
    "mercado": { "id": "3", "nome": "Unimar" }
  },
  "mercadosDisponiveis": [
    { "id": "3", "nome": "Unimar" },
    { "id": "5", "nome": "Atakarejo" },
    { "id": "7", "nome": "Unibem" }
  ],
  "historico": [
    { "posicao": 1, "data": "2026-10-13", "mercado": { "id": "3", "nome": "Unimar" }, "preco": 14.50, "precoNormalizado": 2.90, "melhor": true },
    { "posicao": 2, "data": "2026-09-03", "mercado": { "id": "5", "nome": "Atakarejo" }, "preco": 14.75, "precoNormalizado": 2.95, "melhor": false },
    { "posicao": 3, "data": "2026-08-12", "mercado": { "id": "7", "nome": "Unibem" }, "preco": 19.90, "precoNormalizado": 3.98, "melhor": false }
  ],
  "evolucao": [
    { "data": "2026-08-12", "melhorPreco": 19.90, "melhorPrecoNormalizado": 3.98 },
    { "data": "2026-09-03", "melhorPreco": 14.75, "melhorPrecoNormalizado": 2.95 },
    { "data": "2026-10-13", "melhorPreco": 14.50, "melhorPrecoNormalizado": 2.90 }
  ]
}
```

#### 2.2.1 Regra de deduplicação do `historico` (`agrupar=true`)

Percorrer as observações do mais antigo para o mais novo **por mercado**; emitir uma linha apenas
quando o `precoNormalizado` **mudar** em relação à observação anterior do mesmo mercado.
Ou seja: se o preço não mudou, não duplica (requisito da feature 3).

Depois de filtrar, ordenar a exibição do mais recente para o mais antigo e numerar `posicao`
de `1..N` **na ordem exibida**.

#### 2.2.2 Série `evolucao` (gráfico)

Para cada data distinta presente no filtro, retornar o **menor** `precoNormalizado` entre os
mercados (o melhor preço daquele dia). Ordenar ascendente por data. É a série da linha única do
gráfico (decisão de produto).

#### 2.2.3 Filtro de mercados

- `mercados` aplica-se a `historico` e `evolucao`.
- `mercadosDisponiveis` é sempre retornado completo (todos os mercados com histórico), para
  popular os checkboxes mesmo com filtro ativo.
- `melhorPrecoAtual` deve respeitar o filtro quando ele estiver ativo.

**Erros**

| Código | Situação |
|---|---|
| `404` | produto/variacão não encontrados |
| `401` | token ausente/expirado |
| `200` com `historico: []` | sem observações na janela |

### 2.3 `GET /api/produtos?q=` (extensão)

Para a **feature 4**, adicionar o parâmetro opcional `q`:

- Busca por nome do produto, `contains`, case-insensitive e sem acento (se viável).
- Mantém a resposta atual: `[{ "id": "1", "nome": "Arroz Branco Tipo 1" }]`.
- Sem `q`, mantém o comportamento atual (lista completa).

> **Decisão atual:** o app filtra **localmente** a lista retornada por `/api/produtos` (como já faz
> hoje). O parâmetro `q` **não é requisito** deste ciclo; fica documentado como evolução recomendada
> para quando a base crescer.

### 2.4 `GET /api/produtos/:id` (opcional)

Detalhe simples do produto (`id`, `nome`) caso o app abra os detalhes sem ter o objeto em mãos.

## 3. O que muda no backend existente

- **Criar** os endpoints 2.1 e 2.2 (independem do parse da NFC-e).
- **Estender** `/api/produtos` com `q` (2.3).
- **Deprecar** `/api/produtos/melhores-precos-agrupados` após a migração da `BestPricesListScreen`
  (feature 2). Mantê-lo durante a transição para não quebrar versões antigas do app.
- Reaproveitar a agregação que já existe em `/melhores-precos-agrupados`, agora no grão
  produto+varação e com normalização por unidade.

## 4. Critérios de aceite (backend)

1. `GET /produtos/melhores-precos?produtoIds=1` retorna ranking correto com `outrosPrecos` (máx. 2) e `piorMercado`.
2. Preços normalizados respeitam `tamanho_unidade`; `un` não é dividido.
3. `GET /produtos/:id/historico-precos` não repete linhas quando o preço do mercado não muda.
4. `evolucao` retorna o menor preço por data, ordenado.
5. Filtro `mercados` afeta `historico`, `evolucao` e `melhorPrecoAtual`, sem afetar `mercadosDisponiveis`.
6. Respostas sem dados retornam `200` com arrays vazios (não erro), exceto produto inexistente (`404`).

## 5. Decisões fechadas e pendências

**Fechadas (13/10/2026):**

- **Janela de "atual"**: `90` dias para "preço atual" (feature 2), parametrizável por `janelaDias`.
- **Múltiplas variações**: quando um produto tem várias variações com preços, a API retorna e o app
  exibe **somente a variação vencedora** (menor preço normalizado). Sem seletor de variação.
- **Filtro de busca**: o front filtra localmente `/api/produtos`; `?q=` é evolução futura, não requisito.

**Pendências:**

- **Unidade do produto**: `tamanho_unidade` já vem preenchido de forma confiável no parse da NFC-e?
  Se não, a normalização não é possível e cai no preço cheio.
- **Nomes de campos**: manter PT-BR como o restante da API (`precoNormalizado`, `mercado`) — a confirmar
  com o time de backend.
