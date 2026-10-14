const { Op } = require('sequelize');
const { sequelize, Produto, Variacao, UnidadeMedida, ItemComprado, Compra, Mercado } = require('../models');

class OptimizationService {
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

  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async buscarPrecoAtualDoItem(produtoId, variacaoId, janelaDias = 90) {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - janelaDias);

    const whereVariacao = { produto_id: produtoId };
    if (variacaoId) whereVariacao.id = variacaoId;

    const itens = await ItemComprado.findAll({
      include: [
        {
          model: Variacao,
          where: whereVariacao,
          include: [{ model: UnidadeMedida }, { model: Produto }],
          required: true,
        },
        {
          model: Compra,
          where: { data_compra: { [Op.gte]: dataLimite } },
          required: true,
        },
        { model: Mercado, required: true },
      ],
    });

    if (!itens || itens.length === 0) return [];

    const porMercado = {};
    for (const item of itens) {
      const mercadoId = item.Compra.Mercado.id;
      if (!porMercado[mercadoId] || new Date(item.Compra.data_compra) > new Date(porMercado[mercadoId].Compra.data_compra)) {
        porMercado[mercadoId] = item;
      }
    }

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

    resultados.sort((a, b) => {
      if (a.precoNormalizado !== b.precoNormalizado) return a.precoNormalizado - b.precoNormalizado;
      if (new Date(b.dataCompra) !== new Date(a.dataCompra)) return new Date(b.dataCompra) - new Date(a.dataCompra);
      return (a.mercado.nome || '').localeCompare(b.mercado.nome || '');
    });

    return resultados;
  }

  async encontrarMelhorVariacao(produtoId, janelaDias = 90) {
    const precos = await this.buscarPrecoAtualDoItem(produtoId, null, janelaDias);
    if (!precos || precos.length === 0) return null;
    return precos[0].variacao.id;
  }

  async otimizarLista(itensInput, janelaDias = 90, mercadosFiltro = null, maxMercados = null) {
    const janela = parseInt(janelaDias) || 90;
    const itensProcessados = [];

    // Processar cada item
    for (const input of itensInput) {
      const produtoId = input.produtoId;
      if (!produtoId) continue;
      const quantidade = parseFloat(input.quantidade) || 1;

      let variacaoId = input.variacaoId;
      if (!variacaoId) {
        const melhorVar = await this.encontrarMelhorVariacao(produtoId, janela);
        if (!melhorVar) continue;
        variacaoId = melhorVar;
      }

      const precos = await this.buscarPrecoAtualDoItem(produtoId, variacaoId, janela);
      if (!precos || precos.length === 0) {
        // Item sem preço - guardar como indisponível
        const prod = await Produto.findByPk(produtoId);
        const varObj = await Variacao.findByPk(variacaoId, { include: [UnidadeMedida] });
        itensProcessados.push({
          produtoId,
          variacaoId,
          quantidade,
          disponivel: false,
          precosPorMercado: [],
          produto: prod,
          variacao: varObj,
        });
        continue;
      }

      let precosFiltrados = precos;
      if (mercadosFiltro && mercadosFiltro.length > 0) {
        precosFiltrados = precos.filter(p => mercadosFiltro.includes(String(p.mercado.id)));
      }
      if (!precosFiltrados || precosFiltrados.length === 0) {
        const prod = await Produto.findByPk(produtoId);
        const varObj = precos[0].variacao;
        itensProcessados.push({
          produtoId,
          variacaoId,
          quantidade,
          disponivel: false,
          precosPorMercado: [],
          produto: prod,
          variacao: varObj,
        });
        continue;
      }

      const prod = precosFiltrados[0].variacao.Produto || (await Produto.findByPk(produtoId));
      itensProcessados.push({
        produtoId,
        variacaoId,
        quantidade,
        disponivel: true,
        precosPorMercado: precosFiltrados.map(p => ({
          mercado: p.mercado,
          precoUnitario: p.preco,
          precoNormalizado: p.precoNormalizado,
          subtotal: p.precoNormalizado * quantidade, // usando normalizado conforme regra
          dataCompra: p.dataCompra,
        })),
        produto: prod,
        variacao: precosFiltrados[0].variacao,
      });
    }

    // Calcular porMercado (melhor preço por mercado para cada item disponível)
    const mercadoMap = {};
    for (const item of itensProcessados) {
      if (!item.disponivel) continue;
      for (const pm of item.precosPorMercado) {
        const mid = pm.mercado.id;
        if (!mercadoMap[mid]) {
          mercadoMap[mid] = {
            mercado: pm.mercado,
            total: 0,
            itensDisponiveis: 0,
            itensFaltantes: 0,
            itensCobertos: [],
          };
        }
      }
    }

    // Para cada mercado, somar o melhor preço que ele oferece? Ou somar se ele tem o item - mas cada item vai para um mercado na divisão ótima
    // Para "porMercado" (total da lista no mercado): mercado cobre todos os itens que tem - usa preço daquele mercado
    for (const mid of Object.keys(mercadoMap)) {
      let total = 0;
      let itensDisponiveis = 0;
      let itensFaltantes = 0;
      for (const item of itensProcessados) {
        const pm = item.precosPorMercado.find(x => String(x.mercado.id) === String(mid));
        if (pm) {
          total += pm.precoNormalizado * item.quantidade;
          itensDisponiveis++;
        } else {
          itensFaltantes++;
        }
      }
      mercadoMap[mid].total = parseFloat(total.toFixed(2));
      mercadoMap[mid].itensDisponiveis = itensDisponiveis;
      mercadoMap[mid].itensFaltantes = itensFaltantes;
      mercadoMap[mid].cobreListaCompleta = itensFaltantes === 0;
    }

    const porMercado = Object.values(mercadoMap).sort((a, b) => a.total - b.total);

    // Divisão ótima: para cada item, escolher mercado com menor preço normalizado
    const divisaoPorMercado = {};
    for (const item of itensProcessados) {
      if (!item.disponivel) continue;
      if (item.precosPorMercado.length === 0) continue;
      // Pegar o melhor (menor) preço para este item
      const melhorPm = item.precosPorMercado[0];
      const mid = melhorPm.mercado.id;
      if (!divisaoPorMercado[mid]) {
        divisaoPorMercado[mid] = {
          mercado: melhorPm.mercado,
          itens: [],
          subtotal: 0,
        };
      }
      const subtotalItem = melhorPm.precoNormalizado * item.quantidade;
      divisaoPorMercado[mid].itens.push({
        produtoId: String(item.produtoId),
        variacaoId: item.variacaoId ? String(item.variacaoId) : '',
        quantidade: item.quantidade,
        precoUnitario: melhorPm.precoUnitario,
        precoNormalizado: melhorPm.precoNormalizado,
        subtotal: parseFloat(subtotalItem.toFixed(2)),
      });
      divisaoPorMercado[mid].subtotal += subtotalItem;
    }

    let divisaoOtima = Object.values(divisaoPorMercado).map(d => ({
      mercado: { id: String(d.mercado.id), nome: d.mercado.nome },
      itens: d.itens,
      subtotal: parseFloat(d.subtotal.toFixed(2)),
    }));

    let totalOtimizado = divisaoOtima.reduce((sum, d) => sum + d.subtotal, 0);
    totalOtimizado = parseFloat(totalOtimizado.toFixed(2));

    // Aplicar maxMercados se informado
    const maxM = maxMercados ? parseInt(maxMercados) : null;
    if (maxM && maxM > 0 && divisaoOtima.length > maxM) {
      // Heurística simples: manter os mercados com mais itens/custo menor
      divisaoOtima = divisaoOtima.slice(0, maxM);
      totalOtimizado = divisaoOtima.reduce((sum, d) => sum + d.subtotal, 0);
      totalOtimizado = parseFloat(totalOtimizado.toFixed(2));
    }

    // Melhor mercado único
    const melhoresQueCobremTudo = porMercado.filter(p => p.cobreListaCompleta);
    let melhorMercadoUnico = null;
    if (melhoresQueCobremTudo.length > 0) {
      melhorMercadoUnico = {
        mercado: { id: String(melhoresQueCobremTudo[0].mercado.id), nome: melhoresQueCobremTudo[0].mercado.nome },
        total: melhoresQueCobremTudo[0].total,
      };
    }

    // Economia
    let economia = null;
    let economiaPercentual = null;
    if (melhorMercadoUnico) {
      economia = parseFloat((melhorMercadoUnico.total - totalOtimizado).toFixed(2));
      if (melhorMercadoUnico.total > 0) {
        economiaPercentual = parseFloat(((economia / melhorMercadoUnico.total) * 100).toFixed(2));
      }
    } else if (porMercado.length > 0) {
      // calcular contra o pior que cobre tudo? ou não definido
      const pioresQueCobremTudo = [...melhoresQueCobremTudo].reverse();
      const ref = pioresQueCobremTudo.length > 0 ? pioresQueCobremTudo[0] : porMercado[porMercado.length - 1];
      economia = parseFloat((ref.total - totalOtimizado).toFixed(2));
      if (ref.total > 0) {
        economiaPercentual = parseFloat(((economia / ref.total) * 100).toFixed(2));
      }
    }

    return {
      itensConsiderados: itensProcessados.filter(i => i.disponivel).length,
      porMercado: porMercado.map(p => ({
        mercado: { id: String(p.mercado.id), nome: p.mercado.nome },
        total: p.total,
        itensDisponiveis: p.itensDisponiveis,
        itensFaltantes: p.itensFaltantes,
        cobreListaCompleta: p.cobreListaCompleta,
      })),
      divisaoOtima,
      totalOtimizado,
      melhorMercadoUnico,
      economia,
      economiaPercentual,
      mercadosNecessarios: divisaoOtima.length,
    };
  }
}

module.exports = new OptimizationService();
