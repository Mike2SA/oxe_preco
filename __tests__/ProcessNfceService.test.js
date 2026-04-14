const { Sequelize } = require('sequelize');

const processNfceService = require('../services/ProcessNfceService');

// Mocks
jest.mock('../models', () => {
  const transactionMock = { commit: jest.fn(), rollback: jest.fn() };
  return {
    sequelize: {
      transaction: jest.fn().mockResolvedValue(transactionMock)
    },
    Mercado: { 
      findOne: jest.fn().mockResolvedValue(null), 
      create: jest.fn().mockResolvedValue({ id: 'mercado-123' }) 
    },
    Compra: { 
      findOne: jest.fn().mockResolvedValue(null), 
      create: jest.fn().mockResolvedValue({ id: 'compra-123' }) 
    },
    Produto: { 
      findOne: jest.fn().mockResolvedValue(null), 
      create: jest.fn().mockResolvedValue({ id: 'produto-123' }) 
    },
    Variacao: { create: jest.fn().mockResolvedValue({ id: 'variacao-123' }) },
    UnidadeMedida: { 
      findOne: jest.fn().mockResolvedValue(null), 
      create: jest.fn().mockResolvedValue({ id: 1 }) 
    },
    ItemComprado: { create: jest.fn() }
  };
});

jest.mock('../services/OpenAIService', () => ({
  normalizeItems: jest.fn().mockResolvedValue([{
    nome_base: 'BISCOITO MOCKADO',
    marca: 'MARCA MOCK',
    tamanho_unidade: 200,
    unidade_medida: 'G',
    tipo: 'CHOCOLATE'
  }])
}));

const { Mercado, Compra, Produto, Variacao, ItemComprado, sequelize } = require('../models');
const openAIService = require('../services/OpenAIService');

describe('ProcessNfceService (Processamento da NF)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve processar o JSON de NF chamando as modelagens corretas', async () => {
    const mockJsonSefaz = {
      estabelecimento: { nome: 'Mercadinho do Bairro', cnpj: '11.222.333/0001-44', endereco: 'Rua X' },
      itens: [
        { descricao: 'BISC RECH 140G', codigo: '123', quantidade: 2, unidade: 'UN', preco_unitario: 3.5, preco_total: 7.0, preco_base: 3.5 }
      ],
      totais: { qtd_itens: 1, valor_final: 7.0, valor_pago: 7.0, tributos: 0, desconto: 0 },
      metadados: { chave_acesso: '12345678901234567890123456789012345678901234', data_emissao: '01/01/2026', estado: 'BA' }
    };

    const result = await processNfceService.process(mockJsonSefaz);
    
    expect(result.success).toBe(true);
    expect(result.compraId).toBe('compra-123');

    // Verifica se Mercado foi criado
    expect(Mercado.create).toHaveBeenCalled();
    // Verifica OpenAI
    expect(openAIService.normalizeItems).toHaveBeenCalledWith(['BISC RECH 140G']);
    // Verifica persistências dos itens normalizados
    expect(Produto.create).toHaveBeenCalledWith(
      expect.objectContaining({ nome_base: 'BISCOITO MOCKADO' }), 
      expect.anything()
    );
    expect(Variacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'MARCA MOCK', tamanho_unidade: 200, tipo: 'CHOCOLATE' }), 
      expect.anything()
    );
    expect(ItemComprado.create).toHaveBeenCalled();

    // Commit transação
    const tMock = await sequelize.transaction();
    expect(tMock.commit).toHaveBeenCalled();
  });
});

