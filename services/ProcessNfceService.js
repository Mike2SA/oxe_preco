const { sequelize, Mercado, Compra, ItemComprado, Produto, Variacao, UnidadeMedida } = require('../models');

class ProcessNfceService {
  /**
   * Processa o JSON extraído do site da Sefaz e insere no banco
   * @param {Object} data JSON retornado pelo parseSefazHtml
   * @param {string} userId (Opcional) ID do usuário autenticado
   */
  async process(data, userId = null) {
    const t = await sequelize.transaction();

    try {
      const { estabelecimento, itens, totais, metadados } = data;

      // 1. Encontrar ou Criar Mercado
      let mercado = null;
      if (estabelecimento.cnpj) {
        mercado = await Mercado.findOne({ where: { cnpj: estabelecimento.cnpj }, transaction: t });
      }

      if (!mercado) {
        mercado = await Mercado.create({
          nome: estabelecimento.nome || 'Mercado Desconhecido',
          cnpj: estabelecimento.cnpj,
          // cidade_id, latitude e longitude ficam null por enquanto
        }, { transaction: t });
      }

      // 2. Verificar se a Compra já existe (chave nfce única)
      let compra = await Compra.findOne({ where: { chave_nfce: metadados.chave_acesso }, transaction: t });
      
      if (compra) {
        await t.rollback();
        return { success: false, message: 'Nota Fiscal já processada.', compraId: compra.id };
      }

      // 3. Garantir unidade de medida padrao para a Compra
      // Geralmente notas fiscais não possuem uma unidade geral, mas como é NOT NULL na Model, usaremos UN (Unidade)
      let defaultUnidadeCompra = await this._findOrCreateUnidade('UN', 'Unidade padrão NF', t);

      // 4. Inserir Compra
      let dataCompraDate = new Date();
      if (metadados.data_emissao) {
        const [day, month, year] = metadados.data_emissao.split('/');
        if (day && month && year) {
           dataCompraDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
        }
      }

      compra = await Compra.create({
        user_id: userId,
        chave_nfce: metadados.chave_acesso,
        mercado_id: mercado.id,
        data_compra: dataCompraDate,
        total_nf: totais.valor_final || 0,
        unidade_medida_id: defaultUnidadeCompra.id,
        status: 'processada'
      }, { transaction: t });

      const openAIService = require('./OpenAIService');

      // Chamada em lote para OpenAI
      const descricoes = itens.map(i => i.descricao);
      const parsedItems = await openAIService.normalizeItems(descricoes);

      // 5. Inserir Itens
      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        
        // Dados normalizados retornados pela API
        const iaParsed = parsedItems[i];

        let nomeBase = item.descricao;
        let marcaStr = null;
        let tamanhoUn = item.quantidade || 1;
        let pUnidade = (item.unidade || 'UN').substring(0, 2).toUpperCase();
        let tipoStr = null;

        if (iaParsed) {
          nomeBase = iaParsed.nome_base || nomeBase;
          marcaStr = iaParsed.marca || null;
          tamanhoUn = (typeof iaParsed.tamanho_unidade === 'number' && iaParsed.tamanho_unidade > 0) ? iaParsed.tamanho_unidade : tamanhoUn;
          pUnidade = iaParsed.unidade_medida ? iaParsed.unidade_medida.substring(0, 2).toUpperCase() : pUnidade;
          tipoStr = iaParsed.tipo || null;
        }

        // Recupera ou cria unidade parseada
        const unidadeModel = await this._findOrCreateUnidade(pUnidade, `Unidade ${pUnidade}`, t);

        // Criar ou Buscar Produto Base
        let produto = await Produto.findOne({ where: { nome_base: nomeBase }, transaction: t });
        if (!produto) {
          produto = await Produto.create({
            nome_base: nomeBase,
            categoria: null
          }, { transaction: t });
        }

        // Criar Variacao
        // Num fluxo real pode verificar duplicidade de variação. Aqui vamos criar sempre.
        const variacao = await Variacao.create({
          produto_id: produto.id,
          marca: marcaStr,
          tamanho_unidade: tamanhoUn,
          unidade_medida_id: unidadeModel.id,
          tipo: tipoStr
        }, { transaction: t });

        // Inserir Item Comprado
        await ItemComprado.create({
          compra_id: compra.id,
          variacao_id: variacao.id,
          quantidade_embalagem: item.quantidade || 0,
          preco_total_real: item.preco_total || 0,
          preco_unit_real: item.preco_unitario || 0,
          preco_unit_normalizado: item.preco_base || item.preco_unitario || 0,
          nome_original_nf: item.descricao
        }, { transaction: t });
      }

      await t.commit();
      return { success: true, compraId: compra.id };

    } catch (error) {
      await t.rollback();
      console.error("Erro ao processar JSON no DB:", error);
      throw error;
    }
  }

  // Helper local para Units
  async _findOrCreateUnidade(sigla, descricao, t) {
    let un = await UnidadeMedida.findOne({ where: { sigla }, transaction: t });
    if (!un) {
      un = await UnidadeMedida.create({ sigla, descricao }, { transaction: t });
    }
    return un;
  }
}

module.exports = new ProcessNfceService();
