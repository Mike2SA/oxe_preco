# Backend — Relatórios de Gastos e Orçamento Mensal

> **Escopo:** backend (API Node.js, fora deste repositório).
> Suporta as features **11 — Painel de gastos + orçamento** e alimenta o card "Economia do mês"
> da feature **07 — Home com dados reais**.
>
> Base: `http://189.89.155.143:3000/api` — autenticação `Authorization: Bearer <jwt_token>`.

## 1. Objetivo

Transformar as NFC-e importadas em informação útil: quanto o usuário gastou (por mês, mercado,
categoria), quanto economizou e quanto falta para estourar o orçamento.

## 2. Endpoints

### 2.1 `GET /api/relatorios/gastos`

**Query params**

| Param | Obrigatório | Default | Descrição |
|---|---|---|---|
| `de` | não | início do mês atual | data inicial (`YYYY-MM-DD`) |
| `ate` | não | hoje | data final |
| `agruparPor` | não | `mes` | `mes` \| `mercado` \| `categoria` |

**Resposta `200`** (exemplo com `agruparPor=mercado`)

```json
{
  "periodo": { "de": "2026-10-01", "ate": "2026-10-31" },
  "agruparPor": "mercado",
  "total": 842.35,
  "compras": 6,
  "grupos": [
    { "chave": "3", "rotulo": "Unimar", "total": 410.10, "compras": 3, "percentual": 48.7 },
    { "chave": "5", "rotulo": "Atakarejo", "total": 432.25, "compras": 3, "percentual": 51.3 }
  ]
}
```

Regras:

- Soma `Compra.total_nf` no período e agrupa pela chave escolhida.
- `agruparPor=categoria`: a categoria vem do produto/variacão de cada item; compras com itens de
  categorias distintas são rateadas por item.
- `percentual` = `total / total * 100`.

### 2.2 `GET /api/relatorios/economia`

Estimate de economia: compara o que foi **pago** com o **melhor preço disponível** de cada item.

```json
{
  "periodo": { "de": "2026-10-01", "ate": "2026-10-31" },
  "totalPago": 842.35,
  "totalMelhorPreco": 730.10,
  "economiaEstimada": 112.25,
  "economiaPercentual": 13.3
}
```

Regras: para cada item comprado, usar o menor `precoNormalizado × quantidade` observado na janela
(default 90 dias) e comparar com o valor efetivamente pago. Não incluir itens sem preço comparável.

### 2.3 `GET /api/relatorios/resumo`

Resumo pronto para o card da Home:

```json
{
  "mesAtual": "2026-10",
  "gastoMes": 210.40,
  "economiaMes": 47.20,
  "variacaoPercentualMesAnterior": 12.0,
  "metaMensal": 600.00,
  "percentualDaMeta": 35.0
}
```

### 2.4 Orçamento

- `GET /api/orcamento` → `{ "valorMensal": 600.00, "premium": false }` (`null` se não definido).
- `PUT /api/orcamento` → body `{ "valorMensal": 600.00 }` (250 = salva).
- `GET /api/orcamento/status?mes=YYYY-MM` →
  `{ "meta": 600.00, "gasto": 420.00, "restante": 180.00, "percentual": 70.0, "excedido": false, "alerta": "atencao" }`
  - `alerta`: `ok` (< 80%), `atencao` (80–100%), `estourado` (> 100%).

## 3. Erros

| Código | Situação |
|---|---|
| `400` | datas inválidas / `agruparPor` desconhecido |
| `401` | token ausente/expirado |
| `200` com `grupos: []` | sem compras no período |

## 4. Critérios de aceite

1. `gastos` por mês bate com a soma de `total_nf` das compras do usuário no período.
2. `economia` não é negativa e ignora itens sem preço comparável.
3. `resumo` retorna os campos usados pelo card da Home.
4. `orcamento/status` retorna `alerta` coerente com o percentual.
5. Todos os dados são restritos ao usuário autenticado.
