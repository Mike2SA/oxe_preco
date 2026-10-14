# Backend — Mercados Próximos e Preços por Proximidade

> **Escopo:** backend (API Node.js, fora deste repositório).
> Suporta a feature **17 — Mercados próximos / onde comprar perto de mim**.
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Objetivo

Saber **onde fica o melhor preço perto de mim**, considerando distância e preço atual.

## 2. Modelo

`Mercado` ganha:

| Campo | Tipo | Observação |
|---|---|---|
| `lat` | double? | latitude |
| `lng` | double? | longitude |
| `endereco` | string? | logradouro/bairro |
| `cidade` | string? | usado no filtro |

> Geocodificação do CNPJ/razão social pode ser feita por job de backfill a partir do endereço das
> NFC-e. Mercados sem coordenadas são omitidos das buscas por proximidade.

## 3. Endpoints

### 3.1 `GET /api/mercados`

**Query**: `lat`, `lng`, `raioKm` (default `5`), `cidade?`, `limite` (default `20`).

**Resposta `200`**

```json
[
  {
    "id": "3",
    "nome": "Unimar",
    "razaoSocial": "Unimar Comércio LTDA",
    "lat": -12.9812, "lng": -38.4702,
    "distanciaKm": 1.8,
    "qtdItensMonitorados": 312
  }
]
```

Sem `lat`/`lng`, retorna os mercados da `cidade` ordenados por nome.

### 3.2 `GET /api/mercados/:id`

Detalhe do mercado (endereço, coordenadas, contato, quantos itens tem preço).

### 3.3 `GET /api/produtos/:produtoId/precos-proximos`

Preços do item nos mercados próximos, com distância e preço atual.

**Query**: `variacaoId?`, `lat`, `lng`, `raioKm`, `janelaDias?` (default 90).

**Resposta `200`**

```json
{
  "produtoId": "1", "variacaoId": "10", "nome": "Arroz Branco Tipo 1", "unidade": "kg",
  "mercados": [
    { "mercado": { "id": "3", "nome": "Unimar" }, "distanciaKm": 1.8,
      "preco": 14.50, "precoNormalizado": 2.90, "data": "2026-10-13" },
    { "mercado": { "id": "5", "nome": "Atakarejo" }, "distanciaKm": 3.2,
      "preco": 14.75, "precoNormalizado": 2.95, "data": "2026-10-13" }
  ]
}
```

Regras:

- Ordenação padrão por `distanciaKm`; parâmetro `ordenar=preco` ordena por preço normalizado.
- `melhorPreco` global também pode ser incluído para destaque.

### 3.4 `GET /api/mercados/:id/produtos?q=&page=`

Lista os itens com preço conhecido naquele mercado (opcional, usado ao "entrar" num mercado).

## 4. Erros

| Código | Situação |
|---|---|
| `400` | `lat`/`lng` inválidos |
| `401` | token ausente/expirado |
| `404` | mercado/produto inexistente |
| `200` com `[]` | nenhum mercado no raio |

## 5. Critérios de aceite

1. `mercados?lat&lng&raioKm` retorna apenas mercados dentro do raio, com `distanciaKm` correto.
2. `precos-proximos` combina distância e preço atual (janela).
3. Mercados sem coordenadas não aparecem em buscas por proximidade.
4. Funciona sem `lat/lng` caindo para filtro por `cidade`.

## 6. Notas para o frontend

- Requer permissão de localização (`geolocator`). Em fase 1, exibir **lista** ordenada por distância
  (sem mapa). Mapa (`google_maps_flutter`) fica como fase 2.
