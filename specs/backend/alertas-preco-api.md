# Backend — Watchlist e Alertas de Preço

> **Escopo:** backend (API Node.js, fora deste repositório).
> Suporta a feature **10 — Alertas de preço / watchlist**.
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Objetivo

Permitir que o usuário "siga" um produto/variacão e seja avisado quando:

- o preço atingir um **preço-alvo** (`precoAlvo`); ou
- o preço **cair** em relação à última observação conhecida.

## 2. Modelo

- `Watcher(id, usuarioId, produtoId, variacaoId, mercadoId?, precoAlvo?, modo, ativo, criadoEm)`
  - `modo`: `alvo` (atingiu preçoAlvo) | `queda` (qualquer queda).
  - `mercadoId` opcional: só alerta quando aquele mercado baixar.
- `Alerta(id, watcherId, produtoId, variacaoId, preco, precoNormalizado, mercado, data, lido)`
- `Dispositivo(id, usuarioId, token, plataforma, criadoEm)` — tokens de push (FCM/APNs).

## 3. Endpoints

### 3.1 `GET /api/watchers`

Lista os watchers do usuário com o preço atual e o progresso até o alvo.

```json
[
  {
    "id": "w1",
    "produtoId": "1", "variacaoId": "10", "nome": "Arroz Branco Tipo 1", "marca": "Tio João",
    "mercado": { "id": "3", "nome": "Unimar" },
    "precoAlvo": 12.00,
    "modo": "alvo",
    "ativo": true,
    "precoAtual": { "preco": 14.50, "precoNormalizado": 2.90, "data": "2026-10-13", "mercado": { "id": "3", "nome": "Unimar" } },
    "distanciaPercentual": 17.2
  }
]
```

### 3.2 `POST /api/watchers`

**Body**: `{ "produtoId": "1", "variacaoId": "10", "mercadoId": null, "precoAlvo": 12.00, "modo": "alvo" }`
→ `201` com o watcher criado. Idempotente por `(produtoId, variacaoId, mercadoId)`.

### 3.3 `PATCH /api/watchers/:id`

Atualiza `precoAlvo`, `modo` ou `ativo`.

### 3.4 `DELETE /api/watchers/:id`

Remove o watcher (`204`).

### 3.5 `GET /api/alertas`

**Query**: `lido` (bool), `page`, `pageSize`. Retorna o histórico de alertas, mais recentes primeiro.

### 3.6 `POST /api/alertas/marcar-lidos`

**Body**: `{ "ids": ["a1","a2"] }` ou `{ "todos": true }`.

### 3.7 `POST /api/dispositivos` / `DELETE /api/dispositivos/:token`

Registra/remove o token de push do aparelho.

## 4. Processamento dos alertas

1. Job periódico (a cada nota importada e/ou em intervalo) recalcula o **preço atual** dos
   produtos com watchers ativos.
2. Se `modo == "alvo"` e `precoAtual.precoNormalizado <= precoAlvo` → cria `Alerta` e envia push.
3. Se `modo == "queda"` e o preço atual for menor que o último preço gravado → cria `Alerta` e
   envia push.
4. Gravar o preço de referência no watcher para evitar alertas repetidos (só alerta em nova queda).
5. Respeitar `mercadoId` quando informado.

## 5. Erros

| Código | Situação |
|---|---|
| `400` | body inválido / `produtoId` ausente |
| `401` | token ausente/expirado |
| `404` | watcher inexistente |

## 6. Critérios de aceite

1. Criar watcher de alvo e receber alerta quando o preço normalizado cruzar o alvo.
2. Não repetir alerta de queda enquanto o preço não voltar a cair.
3. Watchers de um usuário não são visíveis para outro.
4. Push chega ao dispositivo registrado; sem token, o alerta ainda fica no histórico.

## 7. Integração no app

- O app precisa do Firebase Cloud Messaging (`firebase_messaging`) + notificações locais
  (`flutter_local_notifications`) para exibir o alerta.
- Alternativa sem push (fase 1): consultar `GET /api/alertas` ao abrir o app e mostrar um selo.
