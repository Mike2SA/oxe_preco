# Backend — API de Otimização de Lista por Mercado

> **Escopo:** backend (API Node.js, fora deste repositório).
> Suporta a feature **06 — Comparativo da lista por mercado**.
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Objetivo

Dada uma lista de compras (itens + quantidade), calcular:

1. o **custo total da lista em cada mercado**;
2. a **divisão ótima** (o que comprar em cada mercado para minimizar o gasto);
3. a **economia estimada** em relação a comprar tudo em um único mercado.

Reaproveita o modelo de "preço atual por mercado" já definido em
`specs/backend/historico-precos-api.md` (observação mais recente na janela, preço normalizado por
`tamanho_unidade`).

## 2. Endpoint

### `POST /api/listas/otimizacao`

Usamos `POST` porque a lista pode ter muitos itens.

**Body**

```json
{
  "itens": [
    { "produtoId": "1", "variacaoId": "10", "quantidade": 2 },
    { "produtoId": "7", "variacaoId": null,  "quantidade": 1 }
  ],
  "janelaDias": 90,
  "mercados": ["3", "5", "7"],
  "maxMercados": null
}
```

| Campo | Obrigatório | Default | Descrição |
|---|---|---|---|
| `itens[].produtoId` | sim | — | produto base |
| `itens[].variacaoId` | não | melhor variação | variação vencedora (menor preço normalizado) quando ausente |
| `itens[].quantidade` | não | `1` | multiplicador do preço unitário |
| `janelaDias` | não | `90` | janela de "preço atual" |
| `mercados` | não | todos | restringe a análise a estes mercados |
| `maxMercados` | não | `null` | limite de mercados na divisão ótima (ex.: `2` = no máximo 2 paradas) |

**Resposta `200`**

```json
{
  "itensConsiderados": 2,
  "porMercado": [
    {
      "mercado": { "id": "3", "nome": "Unimar" },
      "total": 47.20,
      "itensDisponiveis": 2,
      "itensFaltantes": 0,
      "cobreListaCompleta": true
    },
    {
      "mercado": { "id": "5", "nome": "Atakarejo" },
      "total": 51.10,
      "itensDisponiveis": 2,
      "itensFaltantes": 0,
      "cobreListaCompleta": true
    }
  ],
  "divisaoOtima": [
    {
      "mercado": { "id": "3", "nome": "Unimar" },
      "itens": [
        { "produtoId": "1", "variacaoId": "10", "quantidade": 2, "precoUnitario": 14.50, "precoNormalizado": 2.90, "subtotal": 29.00 }
      ],
      "subtotal": 29.00
    },
    {
      "mercado": { "id": "5", "nome": "Atakarejo" },
      "itens": [
        { "produtoId": "7", "variacaoId": "", "quantidade": 1, "precoUnitario": 18.10, "precoNormalizado": 18.10, "subtotal": 18.10 }
      ],
      "subtotal": 18.10
    }
  ],
  "totalOtimizado": 47.10,
  "melhorMercadoUnico": { "mercado": { "id": "3", "nome": "Unimar" }, "total": 47.20 },
  "economia": 0.10,
  "economiaPercentual": 0.21,
  "mercadosNecessarios": 2
}
```

## 3. Regras de negócio

1. **Preço atual**: observação mais recente do mercado dentro de `janelaDias` (ver spec de histórico).
2. **Preço efetivo do item**: `precoNormalizado × quantidade`. Para `unidade == "un"`, usa o preço cheio.
3. **Item indisponível**: mercado que não tem preço do item na janela conta como `itensFaltantes`.
4. **`porMercado`**: ordenar por `total` ascendente. Mercados que não têm nenhum item são omitidos.
5. **`divisaoOtima`**: para cada item, escolher o mercado de menor preço; agrupar por mercado. Nunca
   dividir um mesmo item entre mercados.
6. **`maxMercados`**: quando informado, limitar o número de mercados da divisão (heurística gulosa:
   começar pelo mercado que cobre mais itens de menor custo, depois o próximo melhor para o que
   sobrou). Documentar a heurística na resposta.
7. **`melhorMercadoUnico`**: mercado com menor total entre os que cobrem **toda** a lista. `null` se
   nenhum mercado cobre tudo.
8. **`economia`**: `melhorMercadoUnico.total - totalOtimizado`. Quando não há mercado único, a
   economia é calculada contra o **pior** mercado que cobre tudo, ou fica `null`.
9. Ordem de desempate de preço: observação mais recente, depois nome do mercado.

## 4. Erros

| Código | Situação |
|---|---|
| `400` | `itens` ausente/vazio, ou item sem `produtoId` |
| `401` | token ausente/expirado |
| `200` com `porMercado: []` | nenhum preço encontrado na janela para nenhum item |

## 5. Critérios de aceite

1. Custo por mercado respeita `precoNormalizado × quantidade`.
2. A divisão ótima nunca coloca o mesmo item em dois mercados.
3. `economia` bate com `melhorMercadoUnico.total - totalOtimizado`.
4. `maxMercados = 1` retorna divisão com um único mercado.
5. Item sem preço em nenhum mercado não quebra a resposta (entra em `itensFaltantes`).

## 6. Notas para o frontend

- O app pode enviar apenas os `produtoId` e `quantidade` da lista local (SQLite).
- Quando o endpoint não existir, o app deve cair no fluxo atual (menor preço item a item).
