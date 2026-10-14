# Backend — Sincronização e Compartilhamento de Listas

> **Escopo:** backend (API Node.js, fora deste repositório).
> Suporta as features **12 — Offline e sincronização** e **14 — Repetir e compartilhar lista**.
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Objetivo

Hoje as listas vivem apenas no SQLite local (`synced` existe mas nunca é usado). Este contrato
promove a **fonte da verdade para o servidor**, permitindo:

- editar a lista no celular e continuar em outro aparelho;
- criar/editar **offline** e sincronizar quando voltar a rede;
- **compartilhar** uma lista (link/QR) com outra pessoa.

O app mantém uma cópia local como cache offline.

## 2. Modelo

- `Lista(id, usuarioId, nome, criadaEm, atualizadaEm, atualizadaPor, deletada, versao)`
- `ListaItem(id, listaId, produtoId, variacaoId?, nomeProduto, quantidade, categoria?, isChecked, adicionadoEm, atualizadoEm)`
- Toda linha tem `atualizadaEm` (ISO-8601) para resolução de conflito.

## 3. Sincronização incremental

### 3.1 `POST /api/listas/sync`

**Body**

```json
{
  "desde": "2026-10-01T00:00:00Z",
  "listas": [
    { "idLocal": "12", "id": "srv-8", "nome": "Semana", "deletada": false, "atualizadaEm": "2026-10-13T10:00:00Z",
      "itens": [
        { "idLocal": "99", "id": "srv-i3", "produtoId": "1", "variacaoId": "10", "nomeProduto": "Arroz", "quantidade": 2, "isChecked": 1, "atualizadaEm": "2026-10-13T10:00:00Z" }
      ]
    }
  ]
}
```

**Resposta `200`**

```json
{
  "servidorEm": "2026-10-13T10:05:00Z",
  "listas": [ /* registros alterados no servidor desde `desde`, no mesmo formato */ ],
  "mapaIds": [ { "idLocal": "12", "id": "srv-8" } ]
}
```

Regras:

1. **Last-write-wins** por `atualizadaEm` (linha a linha). Empate: vence o servidor.
2. `deletada: true` = exclusão lógica (tombstone) para propagar a remoção aos outros aparelhos.
3. `mapaIds` reconcilia IDs locais (autoincrement) com IDs do servidor.
4. `desde` ausente = envio integral (primeira sincronização / reset).
5. Limite de payload (ex.: 500 itens por chamada) → `400` com instrução de paginar.

### 3.2 CRUD online (quando há rede)

- `GET /api/listas` · `POST /api/listas` · `GET /api/listas/:id`
- `PATCH /api/listas/:id` (renomear / marcar deletada)
- `POST /api/listas/:id/itens` · `PATCH /api/listas/:id/itens/:itemId` (quantidade, `isChecked`) · `DELETE /api/listas/:id/itens/:itemId`

## 4. Compartilhamento

### 4.1 `POST /api/listas/:id/compartilhar`

Gera (ou reutiliza) um token de compartilhamento.

```json
{ "token": "abc123", "url": "https://oxepreco.app/l/abc123", "expiraEm": null, "modo": "leitura" }
```

- `modo`: `leitura` (padrão) | `edicao`.
- Reenviar cria novo token se `rotacionar: true`.

### 4.2 `GET /api/listas/compartilhadas/:token`

Acesso **sem autenticação** (ou com login para importar). Retorna a lista em modo leitura.

### 4.3 `POST /api/listas/importar`

Body `{ "token": "abc123" }` → cria uma cópia da lista para o usuário autenticado. Resposta `201`
com a nova `Lista` (e `origem: token`).

### 4.4 `DELETE /api/listas/:id/compartilhar`

Revoga o token (`204`).

## 5. Erros

| Código | Situação |
|---|---|
| `400` | payload acima do limite / body inválido |
| `401` | token ausente/expirado |
| `403` | tentar editar lista de outro usuário |
| `404` | lista / token inexistente ou expirado |

## 6. Critérios de aceite

1. Criar lista offline, marcar `synced=0` e sincronizar ao voltar a rede sem duplicar itens.
2. Editar a mesma lista em dois aparelhos converge para o estado mais recente (LWW).
3. Excluir um item em um aparelho remove no outro após sync.
4. Link compartilhado abre a lista em modo leitura; importar cria cópia.
5. Reenviar `sync` sem mudanças não cria duplicatas.

## 7. Notas para o frontend

- Migração do SQLite local: adicionar `atualizada_em`, `servidor_id`, `deletada` às tabelas
  `listas`/`lista_itens` (nova versão do banco) e um `SyncService` que dispara no `online`.
