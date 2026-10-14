const { Op } = require('sequelize');
const { sequelize, Produto, Variacao, UnidadeMedida, ItemComprado, Compra, Mercado } = require('../models');

class PriceHistoryService {
  /**
   * Calcula preço normalizado
   * precoNormalizado = preco_unit_real / variacao.tamanho_unidade (para unidades != 'UN')
   */
  calcularPrecoNormalizado(precoUnitReal, tamanhoUnidade, unidadeSigla) {
    const sigla = (unidadeSigla || '').toUpperCase().trim();
    if (sigla === 'UN') {
      return parseFloat(precoUnitReal);
    }
    const tam = parseFloat(tamanhoUnidade);
    if (tam > 0) {
      return parseFloat(precoUnitReal) / tam;
    }
    return parseFloat(precoUnitReal);
  }

  /**
   * Formata data YYYY-MM-DD
   */
  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Encontra a variação "vencedora" (menor preço normalizado) para um produto
   * Considera itens dentro da janela de dias
   */
  async encontrarVariacaoVencedora(produtoId, janelaDias = 90, variacaoIdFiltro = null) {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - janelaDias);

    const where = {
      [Op.and]: [
        sequelize.literal(`"Compra"."data_compra" >= '${dataLimite.toISOString()}'`),
      ],
    };

    let variacoes = await Variacao.findAll({
      where: variacaoIdFiltro ? { id: variacaoIdFiltro, produto_id: produtoId } : { produto_id: produtoId },
      include: [
        { model: UnidadeMedida },
        {
          model: ItemComprado,
          required: true,
          include: [
            {
              model: Compra,
              required: true,
              where: { data_compra: { [Op.gte]: dataLimite } },
            },
          ],
        },
      ],
    });

    if (!variacoes || variacoes.length === 0) {
      // Tentar sem filtro de data, só para ver se existe variação
      variacoes = await Variacao.findAll({
        where: variacaoIdFiltro ? { id: variacaoIdFiltro, produto_id: produtoId } : { produto_id: produtoId },
        include: [
          { model: UnidadeMedida },
          { model: ItemComprado, include: [{ model: Compra }] },
        ],
      });
      if (!variacoes || variacoes.length === 0) {
        return null;
      }
    }

    // Encontrar variação com menor preço normalizado entre os itens
    let melhor = null;
    let melhorPrecoNorm = Infinity;

    for (const variacao of variacoes) {
      for (const item of variacao.ItensComprados || []) {
        const precoNorm = this.calcularPrecoNormalizado(
          item.preco_unit_real,
          variacao.tamanho_unidade,
          variacao.UnidadeMedida?.sigla || 'UN'
        );
        if (precoNorm < melhorPrecoNorm) {
          melhorPrecoNorm = precoNorm;
          melhor = { variacao, item, precoNorm };
        } else if (precoNorm === melhorPrecoNorm && melhor) {
          // desempate: por data mais recente se quiser, mas mantemos primeiro por simplicidade
        }
      }
    }

    if (!melhor) {
      // Pega primeira variação com algum item
      for (const variacao of variacoes) {
        if (variacao.ItensComprados && variacao.ItensComprados.length > 0) {
          const item = variacao.ItensComprados[0];
          const precoNorm = this.calcularPrecoNormalizado(
            item.preco_unit_real,
            variacao.tamanho_unidade,
            variacao.UnidadeMedida?.sigla || 'UN'
          );
          melhor = { variacao, item, precoNorm };
          break;
        }
      }
    }

    return melhor;
  }

  /**
   * Busca todos os preços "atuais" por mercado para um produto/variação
   * Preço atual = observação mais recente de cada mercado dentro da janela
   */
  async buscarPrecosAtuais(produtoId, variacaoId, janelaDias = 90, mercadosFiltro = null) {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - janelaDias);

    const includeMercado = mercadosFiltro && mercadosFiltro.length > 0
      ? { model: Mercado, where: { id: mercadosFiltro }, required: true }
      : { model: Mercado, required: true };

    const itens = await ItemComprado.findAll({
      include: [
        {
          model: Variacao,
          where: { id: variacaoId, produto_id: produtoId },
          include: [{ model: UnidadeMedida }, { model: Produto }],
          required: true,
        },
        {
          model: Compra,
          where: { data_compra: { [Op.gte]: dataLimite } },
          required: true,
        },
        includeMercado,
      ],
    });

    if (!itens || itens.length === 0) {
      return [];
    }

    // Agrupar por mercado - manter apenas o item mais recente por mercado
    const porMercado = {};
    for (const item of itens) {
      const mercadoId = item.Compra.Mercado.id;
      if (!porMercado[mercadoId] || new Date(item.Compra.data_compra) > new Date(porMercado[mercadoId].Compra.data_compra)) {
        porMercado[mercadoId] = item;
      } else if (new Date(item.Compra.data_compra) === new Date(porMercado[mercadoId].Compra.data_compra)) {
        // empate por data - pode manter o primeiro; regra diz desempatar por data recente e nome mercado
        // se mesma data, mantemos o existente por simplicidade
      }
    }

    // Converter para array com preços calculados
    const resultados = Object.values(porMercado).map(item => {
      const variacao = item.Variacao;
      const unidadeSigla = variacao.UnidadeMedida?.sigla || 'UN';
      const precoNormalizado = this.calcularPrecoNormalizado(item.preco_unit_real, variacao.tamanho_unidade, unidadeSigla);
      return {
        item,
        variacao,
        mercado: item.Compra.Mercado,
        dataCompra: item.Compra.data_compra,
        preco: parseFloat(item.preco_unit_real),
        precoNormalizado,
        unidadeSigla,
      };
    });

    // Ordenar por preço normalizado asc, depois por data recente desc, depois por nome mercado
    resultados.sort((a, b) => {
      if (a.precoNormalizado !== b.precoNormalizado) {
        return a.precoNormalizado - b.precoNormalizado;
      }
      if (new Date(b.dataCompra) !== new Date(a.dataCompra)) {
        return new Date(b.dataCompra) - new Date(a.dataCompra);
      }
      return (a.mercado.nome || '').localeCompare(b.mercado.nome || '');
    });

    return resultados;
  }

  async melhoresPrecos(produtoIdsCsv, janelaDias = 90, variacaoIdFiltro = null) {
    if (!produtoIdsCsv) return [];
    const produtoIds = produtoIdsCsv.split(',').map(s => s.trim()).filter(Boolean);
    const janela = parseInt(janelaDias) || 90;

    const resultados = [];
    for (const produtoId of produtoIds) {
      const produto = await Produto.findByPk(produtoId);
      if (!produto) continue;

      // Determinar variação vencedora
      let variacaoEscolhida = variacaoIdFiltro;
      let melhorInfo = null;
      if (!variacaoEscolhida) {
        melhorInfo = await this.encontrarVariacaoVencedora(produtoId, janela);
        if (!melhorInfo) continue;
        variacaoEscolhida = melhorInfo.variacao.id;
      } else {
        // Verifica se variação existe para este produto
        const variacao = await Variacao.findOne({
          where: { id: variacaoEscolhida, produto_id: produtoId },
          include: [{ model: UnidadeMedida }],
        });
        if (!variacao) continue;
        melhorInfo = { variacao };
      }

      const precosAtuais = await this.buscarPrecosAtuais(produtoId, variacaoEscolhida, janela);
      if (!precosAtuais || precosAtuais.length === 0) continue;

      const variacao = precosAtuais[0].variacao || melhorInfo.variacao;
      const unidadeSigla = (variacao.UnidadeMedida?.sigla || 'UN').toUpperCase();
      const tamanhoUnidade = variacao.tamanho_unidade;

      const melhor = precosAtuais[0];
      const resposta = {
        produtoId: String(produto.id),
        variacaoId: String(variacao.id),
        nome: produto.nome_base || produto.nome,
        marca: variacao.marca,
        unidade: unidadeSigla === 'UN' ? 'un' : unidadeSigla.toLowerCase(),
        quantidadePadrao: parseFloat(tamanhoUnidade) || 1.0,
        melhorPreco: melhor.preco,
        melhorPrecoNormalizado: melhor.precoNormalizado,
        data: this.formatDate(melhor.dataCompra),
        mercado: { id: String(melhor.mercado.id), nome: melhor.mercado.nome },
        posicao: 1,
        outrosPrecos: [],
        piorMercado: null,
      };

      // outrosPrecos: posições 2 e 3
      if (precosAtuais.length >= 2) {
        resposta.outrosPrecos.push({
          posicao: 2,
          data: this.formatDate(precosAtuais[1].dataCompra),
          mercado: { id: String(precosAtuais[1].mercado.id), nome: precosAtuais[1].mercado.nome },
          preco: precosAtuais[1].preco,
          precoNormalizado: precosAtuais[1].precoNormalizado,
        });
      }
      if (precosAtuais.length >= 3) {
        resposta.outrosPrecos.push({
          posicao: 3,
          data: this.formatDate(precosAtuais[2].dataCompra),
          mercado: { id: String(precosAtuais[2].mercado.id), nome: precosAtuais[2].mercado.nome },
          preco: precosAtuais[2].preco,
          precoNormalizado: precosAtuais[2].precoNormalizado,
        });
      }

      // piorMercado: última posição
      if (precosAtuais.length >= 2) {
        const ultimo = precosAtuais[precosAtuais.length - 1];
        resposta.piorMercado = {
          posicao: precosAtuais.length,
          data: this.formatDate(ultimo.dataCompra),
          mercado: { id: String(ultimo.mercado.id), nome: ultimo.mercado.nome },
          preco: ultimo.preco,
          precoNormalizado: ultimo.precoNormalizado,
        };
      }

      resultados.push(resposta);
    }
    return resultados;
  }

  async historicoPrecos(produtoId, variacaoIdFiltro = null, mercadosCsv = null, janelaDias = 365, agrupar = true) {
    const produto = await Produto.findByPk(produtoId);
    if (!produto) {
      throw new Error('PRODUTO_NAO_ENCONTRADO');
    }

    // Determinar variação
    let variacao = null;
    if (variacaoIdFiltro) {
      variacao = await Variacao.findOne({
        where: { id: variacaoIdFiltro, produto_id: produtoId },
        include: [{ model: UnidadeMedida }],
      });
    } else {
      const melhorInfo = await this.encontrarVariacaoVencedora(produtoId, 90); // usar janela atual p/ escolher melhor variação p/ detalhes
      if (melhorInfo) {
        variacao = melhorInfo.variacao;
      } else {
        variacao = await Variacao.findOne({
          where: { produto_id: produtoId },
          include: [{ model: UnidadeMedida }],
        });
      }
    }
    if (!variacao) {
      throw new Error('VARIACAO_NAO_ENCONTRADA');
    }

    const unidadeSigla = variacao.UnidadeMedida?.sigla || 'UN';
    const unidadeExibicao = (unidadeSigla.toUpperCase() === 'UN') ? 'un' : unidadeSigla.toLowerCase();

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(janelaDias));

    const mercadosFiltro = mercadosCsv ? mercadosCsv.split(',').map(s => s.trim()).filter(Boolean) : null;
    const includeMercadoHist = mercadosFiltro && mercadosFiltro.length > 0
      ? { model: Mercado, where: { id: mercadosFiltro }, required: true }
      : { model: Mercado, required: true };

    // Buscar todos os itens do histórico para esta variação
    const todosItens = await ItemComprado.findAll({
      include: [
        {
          model: Variacao,
          where: { id: variacao.id },
          include: [{ model: UnidadeMedida }],
          required: true,
        },
        {
          model: Compra,
          where: { data_compra: { [Op.gte]: dataLimite } },
          required: true,
        },
        includeMercadoHist,
      ],
      order: [['created_at', 'ASC'], [{ model: Compra }, 'data_compra', 'ASC']],
    });

    // Mercados disponíveis (sempre completo, independente do filtro)
    const mercadosDisponiveis = await ItemComprado.findAll({
      attributes: [],
      include: [
        { model: Variacao, where: { id: variacao.id }, attributes: [], required: true },
        { model: Compra, where: { data_compra: { [Op.gte]: dataLimite } }, attributes: [], required: true },
        { model: Mercado, attributes: ['id', 'nome'], required: true },
      ],
      group: ['Mercado.id', 'Mercado.nome'],
      raw: true,
    }).then(rows => rows.map(r => ({ id: String(r['Mercado.id']), nome: r['Mercado.nome'] })));

    // Aplicar deduplicação por mercado se agrupar=true
    let historicoBruto = [];
    if (agrupar) {
      const porMercado = {};
      for (const item of todosItens) {
        const mercadoId = item.Compra.Mercado.id;
        const precoNorm = this.calcularPrecoNormalizado(item.preco_unit_real, variacao.tamanho_unidade, unidadeSigla);
        if (!porMercado[mercadoId]) {
          porMercado[mercadoId] = {
            ultimoPreco: precoNorm,
            itens: [{ item, precoNorm }]
          };
        } else {
          // Só adiciona se preço mudou
          if (Math.abs(precoNorm - porMercado[mercadoId].ultimoPreco) > 0.0001) {
            porMercado[mercadoId].ultimoPreco = precoNorm;
            porMercado[mercadoId].itens.push({ item, precoNorm });
          }
        }
      }
      // Flatten
      for (const mercadoId of Object.keys(porMercado)) {
        historicoBruto = historicoBruto.concat(porMercado[mercadoId].itens);
      }
    } else {
      for (const item of todosItens) {
        const precoNorm = this.calcularPrecoNormalizado(item.preco_unit_real, variacao.tamanho_unidade, unidadeSigla);
        historicoBruto.push({ item, precoNorm });
      }
    }

    // Ordenar por data desc
    historicoBruto.sort((a, b) => {
      return new Date(b.item.Compra.data_compra) - new Date(a.item.Compra.data_compra);
    });

    const historico = historicoBruto.map((h, idx) => ({
      posicao: idx + 1,
      data: this.formatDate(h.item.Compra.data_compra),
      mercado: { id: String(h.item.Compra.Mercado.id), nome: h.item.Compra.Mercado.nome },
      preco: parseFloat(h.item.preco_unit_real),
      precoNormalizado: h.precoNorm,
      melhor: idx === 0, // será ajustado depois? melhor em relação ao geral - mas spec diz marcar melhor; vamos marcar true p/ primeiro da lista (mais recente) e false outros
    }));
    // Marcar melhor como o de menor precoNormalizado no conjunto? Ou manter como true p/ primeiro
    if (historico.length > 0) {
      let melhorIdx = 0;
      let melhorNorm = historico[0].precoNormalizado;
      for (let i = 1; i < historico.length; i++) {
        if (historico[i].precoNormalizado < melhorNorm - 0.0001) {
          melhorNorm = historico[i].precoNormalizado;
          melhorIdx = i;
        }
      }
      historico.forEach((h, idx) => {
        h.melhor = (idx === melhorIdx);
      });
    }

    // Evolução: menor preço normalizado por data distinta (presente no filtro aplicado)
    const porData = {};
    for (const h of historicoBruto) {
      const dataFmt = this.formatDate(h.item.Compra.data_compra);
      if (!porData[dataFmt] || h.precoNorm < porData[dataFmt].melhorPrecoNormalizado) {
        porData[dataFmt] = {
          data: dataFmt,
          melhorPreco: parseFloat(h.item.preco_unit_real),
          melhorPrecoNormalizado: h.precoNorm,
        };
      }
    }
    const evolucao = Object.values(porData).sort((a, b) => a.data.localeCompare(b.data));

    // Melhor preço atual (respeita filtro de mercados)
    const precosAtuais = await this.buscarPrecosAtuais(produtoId, variacao.id, parseInt(janelaDias), mercadosFiltro);
    let melhorPrecoAtual = null;
    if (precosAtuais && precosAtuais.length > 0) {
      const melhor = precosAtuais[0];
      melhorPrecoAtual = {
        preco: melhor.preco,
        precoNormalizado: melhor.precoNormalizado,
        data: this.formatDate(melhor.dataCompra),
        mercado: { id: String(melhor.mercado.id), nome: melhor.mercado.nome },
      };
    }

    return {
      produtoId: String(produto.id),
      variacaoId: String(variacao.id),
      nome: produto.nome_base || produto.nome,
      marca: variacao.marca,
      unidade: unidadeExibicao,
      quantidadePadrao: parseFloat(variacao.tamanho_unidade) || 1.0,
      melhorPrecoAtual,
      mercadosDisponiveis: mercadosDisponiveis.sort((a,b) => (a.nome||'').localeCompare(b.nome||'')),
      historico,
      evolucao,
    };
  }
}

module.exports = new PriceHistoryService();
