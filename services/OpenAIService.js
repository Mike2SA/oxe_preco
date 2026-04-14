const { OpenAI } = require('openai');
require('dotenv').config();

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Pede para o chat extrair os metadados dos nomes originais vindos da sefaz em lote.
   * Divide em blocos para evitar erro de limite de tokens em notas grandes.
   * @param {Array<string>} originalNames Exemplo: ["BISC RECH BAUDUCC CHOC 140G", "OVO BRANCO GRANDE"]
   */
  async normalizeItems(originalNames) {
    if (!originalNames || originalNames.length === 0) return [];

    try {
      const payload = originalNames.map((desc, index) => ({ id: index, descricao: desc }));

      // Split em chunks de 50 itens
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        chunks.push(payload.slice(i, i + CHUNK_SIZE));
      }

      // Prepara as promises para executar as chamadas em paralelo
      const promises = chunks.map(async (chunk) => {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Você é um assistente especialista em interpretar e estruturar dados de produtos de supermercado a partir de NFC-e (cupom fiscal).

Sua tarefa é analisar uma lista contendo as descrições dos itens e extrair informações estruturadas de cada um.

IMPORTANTE:
- Os nomes podem conter abreviações comuns. Você deve expandi-las mentalmente para interpretar corretamente.
  Exemplos:
  QJO = QUEIJO
  MUSS = MUSSARELA ou MUÇARELA
  CHOC = CHOCOLATE
  BISC = BISCOITO
  REF = REFRIGERANTE
  INT = INTEGRAL
  DESN = DESNATADO
  TRAD = TRADICIONAL
  CX = CAIXA
  PET = GARRAFA PET
  UN = UNIDADE
  LT = LATA
  etc.

- O texto pode conter:
  - Marca misturada com o nome
  - Quantidade + unidade (ex: 500G, 1L, 350ML, 2UN)
  - Características do produto (ex: LIGHT, ZERO, INTEGRAL, CHOCOLATE)
  - Ruídos como códigos, números irrelevantes ou símbolos

Sua missão é identificar e retornar para cada item:
- id: o mesmo id enviado na requisição para aquele item
- nome_base: nome principal padronizado do produto (ex: "BISCOITO RECHEADO")
- marca: nome da marca (ex: "BAUDUCCO")
- tamanho_unidade: número do tamanho (usar ponto como decimal, ex: 1.5, 350, 0.5)
- unidade_medida: sigla da unidade em MAIÚSCULO (G, KG, ML, L, UN)
- tipo: características adicionais relevantes (ex: "CHOCOLATE", "INTEGRAL", "ZERO AÇÚCAR")

REGRAS IMPORTANTES:
- Não invente informações.
- Se algum campo não puder ser identificado, retorne null.
- Padronize tudo em MAIÚSCULO.
- Remova redundâncias (ex: não repetir marca dentro do nome_base).
- Separe corretamente o que é marca e o que é descrição.
- Considere variações e erros comuns de digitação.

Você receberá um array JSON no formato: [{"id": 0, "descricao": "..."}]
Responda SOMENTE com um JSON válido contendo um array "itens" no seguinte formato:

{
  "itens": [
    {
      "id": 0,
      "nome_base": "",
      "marca": "",
      "tamanho_unidade": 0,
      "unidade_medida": "",
      "tipo": ""
    }
  ]
}`
            },
            {
              role: "user",
              content: JSON.stringify(chunk)
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });

        return JSON.parse(response.choices[0].message.content);
      });

      const resolvedChunks = await Promise.all(promises);
      
      const resultsMap = new Map();
      resolvedChunks.forEach(parsedJson => {
        if (parsedJson && parsedJson.itens) {
          parsedJson.itens.forEach(item => {
            resultsMap.set(item.id, item);
          });
        }
      });

      return originalNames.map((desc, index) => {
        const parsed = resultsMap.get(index);
        if (parsed) {
          return {
            nome_base: parsed.nome_base || desc,
            marca: parsed.marca || null,
            tamanho_unidade: parsed.tamanho_unidade || 1,
            unidade_medida: parsed.unidade_medida || 'UN',
            tipo: parsed.tipo || null
          };
        }
        return {
          nome_base: desc,
          marca: null,
          tamanho_unidade: 1,
          unidade_medida: 'UN',
          tipo: null
        };
      });

    } catch (error) {
      console.error('OpenAI Error parsing items:', error.message);
      // Fallback
      return originalNames.map(desc => ({
        nome_base: desc,
        marca: null,
        tamanho_unidade: 1,
        unidade_medida: 'UN',
        tipo: null
      }));
    }
  }
}

module.exports = new OpenAIService();
