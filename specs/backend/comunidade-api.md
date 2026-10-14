# Backend — Comunidade (Feed Social de Preços)

> **Escopo:** backend (API Node.js, fora deste repositório).
> Suporta a feature **15 — Comunidade real** (hoje a tela é 100% mockada).
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Objetivo

Substituir os cards fixos de `community.dart` por um feed real de promoções enviadas pelos usuários,
com curtidas, comentários, salvar e destaque automático de "melhor preço".

## 2. Modelo

- `Post(id, usuarioId, produtoId, variacaoId?, mercadoId, preco, precoNormalizado, fotoUrl?, texto?,
  cidade, criadoEm, curtidas, comentarios, salvo, destaque)`
- `Curtida(postId, usuarioId, criadoEm)`
- `Comentario(id, postId, usuarioId, texto, criadoEm)`
- `Salvo(postId, usuarioId, criadoEm)`

## 3. Endpoints

### 3.1 `GET /api/comunidade/feed`

**Query**: `cidade?`, `categoria?`, `mercadoId?`, `ordenar` (`recentes` | `populares`), `page`,
`pageSize`.

**Resposta `200`**

```json
{
  "items": [
    {
      "id": "p1",
      "autor": { "id": "u1", "nome": "Ricardo M.", "avatarUrl": null },
      "produto": { "id": "1", "nome": "Arroz Agulhinha Tio João (5kg)" },
      "mercado": { "id": "3", "nome": "Atacadão - Paralela" },
      "preco": 24.90,
      "precoAnterior": 30.50,
      "descontoPercentual": 18.0,
      "fotoUrl": null,
      "texto": "Achei barato hoje!",
      "cidade": "Salvador",
      "criadoEm": "2026-10-13T08:00:00Z",
      "curtidas": 24,
      "comentarios": 12,
      "curtidoPorMim": false,
      "salvoPorMim": false,
      "destaque": false,
      "verificado": false
    }
  ],
  "page": 1,
  "total": 57
}
```

### 3.2 `POST /api/comunidade/posts`

Body: `{ "produtoId": "1", "variacaoId": "10", "mercadoId": "3", "preco": 24.90, "texto": "...", "fotoUrl": "..." }`
→ `201`. `precoAnterior` e `descontoPercentual` são calculados pelo servidor (melhor preço anterior).
`verificado` = `true` quando o preço confere com uma NFC-e do próprio autor.

### 3.3 Interações

- `POST /api/comunidade/posts/:id/curtir` / `DELETE .../curtir`
- `GET /api/comunidade/posts/:id/comentarios?page=`
- `POST /api/comunidade/posts/:id/comentarios` (body `{ "texto": "..." }`)
- `POST /api/comunidade/posts/:id/salvar` / `DELETE .../salvar`
- `GET /api/comunidade/salvos`
- `DELETE /api/comunidade/posts/:id` (somente o autor ou admin)

`POST /api/comunidade/posts/:id/denunciar` → registra denúncia.

### 3.4 `GET /api/comunidade/destaques`

"Melhor preço da semana" calculado a partir dos dados reais (maior desconto percentual do período).

```json
[
  { "produto": { "id": "1", "nome": "Ovos Brancos (30 un)" }, "mercado": { "id": "9", "nome": "Hiper Ideal - Lapa" },
    "preco": 15.99, "descontoPercentual": 25.0, "postId": "p3" }
]
```

## 4. Regras / moderação

1. Um post por `(usuarioId, produtoId, mercadoId)` por dia (evitar spam).
2. Preço obrigatório; foto opcional.
3. Feed público somente-leitura com token; criar/interagir exige login.
4. Denúncias acima de um limite ocultam o post automaticamente (`oculto`).

## 5. Erros

| Código | Situação |
|---|---|
| `400` | body inválido / preço ausente |
| `401` | token ausente/expirado |
| `403` | editar/remover post de outro usuário |
| `404` | post inexistente |
| `409` | post duplicado no mesmo dia |

## 6. Critérios de aceite

1. Feed retorna posts reais ordenados por data/popularidade.
2. Curtir/descurtir reflete em `curtidoPorMim` e na contagem.
3. Comentários e salvar funcionam; "salvos" lista o que o usuário guardou.
4. `destaques` é calculado de dados reais (não mock).
5. Post verificado por NFC-e recebe o selo.
