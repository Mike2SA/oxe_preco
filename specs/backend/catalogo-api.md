# Backend — Catálogo: Busca, Código de Barras (EAN), Categorias e Sugestões

> **Escopo:** backend (API Node.js, fora deste repositório).
> Suporta as features **09 — Scanner EAN**, **13 — Categorias na lista**, **16 — Sugestões
> inteligentes** e complementa a **04 — Pesquisa principal** (`?q=`).
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Modelo estendido

`Produto` ganha:

| Campo | Tipo | Origem |
|---|---|---|
| `categoriaId` | string? | novo cadastro/parse |
| `categoria` | string? | nome da categoria |
| `eans` | string[] | códigos de barras conhecidos (vindos das NFC-e) |

`Variacao` continua `marca` + `tamanho_unidade` + `unidade` (`kg`/`L`/`un`).

## 2. Endpoints

### 2.1 `GET /api/produtos` (estendido)

**Query params** (todos opcionais e combináveis):

| Param | Descrição |
|---|---|
| `q` | busca por nome, `contains`, case-insensitive e sem acento |
| `categoria` | filtra por `categoriaId` |
| `ean` | filtra por código de barras exato |
| `page` | paginação (default `1`) |
| `pageSize` | itens por página (default `50`, máx `200`) |

**Resposta `200`**: `{ "items": [ Produto ], "page": 1, "total": 123 }` quando `page`/`pageSize`
forem enviados; sem eles, mantém a resposta atual (array simples) para retrocompatibilidade.

### 2.2 `GET /api/produtos/por-ean/:ean`

Usado pelo scanner de código de barras na gôndola.

**Resposta `200`**

```json
{
  "produto": { "id": "1", "nome": "Arroz Branco Tipo 1", "categoria": "Mercearia", "eans": ["7896004400001"] },
  "variacao": { "id": "10", "marca": "Tio João", "unidade": "kg", "quantidadePadrao": 5.0 },
  "melhorPreco": {
    "preco": 14.50,
    "precoNormalizado": 2.90,
    "data": "2026-10-13",
    "mercado": { "id": "3", "nome": "Unimar" }
  }
}
```

Regras:

- `404` quando o EAN não está associado a nenhum produto.
- `melhorPreco` segue a mesma regra de `historico-precos-api.md` (janela `janelaDias`, default 90).
- Deve existir índice único em `ean` → `variacaoId` (o mesmo EAN pode aparecer em várias notas).

### 2.3 `GET /api/produtos/:id` (detalhe)

Retorna `{ id, nome, categoria, eans, variacoes: [...] }`. Alimenta telas que abrem os detalhes sem
ter o objeto em mãos.

### 2.4 `GET /api/categorias`

**Resposta `200`**: `[{ "id": "1", "nome": "Mercearia" }, { "id": "2", "nome": "Limpeza" }]`

Usado para agrupar itens na lista e para o filtro de categorias.

### 2.5 `GET /api/produtos/sugestoes`

Sugestões de lista a partir do **histórico do próprio usuário** (substitui os cards fixos
"Churrasco"/"Limpeza").

**Query params**: `tipo` (`frequentes` | `naoComprados`), `limite` (default 10).

**Resposta `200`**

```json
[
  {
    "chave": "frequentes",
    "titulo": "Você compra sempre",
    "itens": [ { "produtoId": "1", "nome": "Arroz", "frequencia": 6, "ultimoPreco": 14.50 } ]
  }
]
```

Regras:

- Considera apenas compras do usuário autenticado.
- `frequentes`: produtos presentes em ≥ 3 notas nos últimos 6 meses, ordenados por frequência.
- `naoComprados`: itens comprados historicamente que não aparecem em nota há mais de 30 dias.

## 3. Erros

| Código | Situação |
|---|---|
| `400` | parâmetros inválidos (`pageSize` > 200, etc.) |
| `401` | token ausente/expirado |
| `404` | `produto`/`ean` inexistente |
| `200` com `[]` | sem resultados |

## 4. Critérios de aceite

1. `?q=` filtra sem acento/caixa e funciona junto com `categoria`.
2. `por-ean/:ean` retorna produto + melhor preço ou `404`.
3. `categorias` lista categorias distintas existentes.
4. `sugestoes` varia conforme o histórico do usuário (não é mais mock).
5. Respostas antigas de `/produtos` continuam válidas para versões antigas do app.

## 5. Pendências

- Estratégia de normalização dos nomes de categoria (cadastro manual × derivado do parse).
- Popular `eans` a partir dos itens de NFC-e (`nome_original_nf` + código de barras, quando vier).
