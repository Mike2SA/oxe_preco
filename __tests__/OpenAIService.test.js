const { OpenAI } = require('openai');
const openAIService = require('../services/OpenAIService');

// Mock out the module
jest.mock('openai');

describe('OpenAIService', () => {
  let mockCreate;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = jest.fn();
    
    // We only need to mock the specific chain used by the service
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));
    
    // Re-initialize to apply mock since it might have been required before the mock
    // In OpenAIService.js, the instance of OpenAI is created inside the constructor
    // which was called once at the bottom when module is exported.
    // So we can manually re-assign the openai mock for this test
    openAIService.openai = new OpenAI();
  });

  it('deve retornar array vazio se os valores informados forem nulos ou vazios', async () => {
    const result1 = await openAIService.normalizeItems(null);
    expect(result1).toEqual([]);

    const result2 = await openAIService.normalizeItems([]);
    expect(result2).toEqual([]);
  });

  it('deve parsear corretamente os items devolvidos pela IA', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              itens: [
                { id: 0, nome_base: 'FEIJAO CARIOCA', marca: 'GOL', tamanho_unidade: 1, unidade_medida: 'KG', tipo: 'TIPO 1' },
                { id: 1, nome_base: 'ARROZ BRANCO', marca: 'TIO JOAO', tamanho_unidade: 5, unidade_medida: 'KG', tipo: 'INTEGRAL' }
              ]
            })
          }
        }
      ]
    });

    const items = ['FEIJ P G MAIS CARIO T1 1KG', 'ARR BC T JOAO INTG 5KG'];
    const result = await openAIService.normalizeItems(items);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      nome_base: 'FEIJAO CARIOCA', marca: 'GOL', tamanho_unidade: 1, unidade_medida: 'KG', tipo: 'TIPO 1'
    });
    expect(result[1]).toEqual({
      nome_base: 'ARROZ BRANCO', marca: 'TIO JOAO', tamanho_unidade: 5, unidade_medida: 'KG', tipo: 'INTEGRAL'
    });
  });

  it('deve usar um fallback para cada item em caso de falha da IA', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API failure'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const items = ['AGUÁ MINERAL 500ML', 'PÃO FORMA'];
    const result = await openAIService.normalizeItems(items);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      nome_base: 'AGUÁ MINERAL 500ML',
      marca: null,
      tamanho_unidade: 1,
      unidade_medida: 'UN',
      tipo: null
    });

    consoleSpy.mockRestore();
  });
});
