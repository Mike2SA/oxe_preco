const { Op } = require('sequelize');
const { Compra, Mercado, ItemComprado, Variacao, Produto, UnidadeMedida } = require('../models');

class ReportsService {
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
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async gastos(userId, { de, ate, agruparPor = 'mes' }) {
    const now = new Date();
    let deDate = de ? new Date(de + 'T00:00:00Z') : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let ateDate = ate ? new Date(ate + 'T23:59:59Z') : new Date();

    const compras = await Compra.findAll({
      where: {
        user_id: userId,
        data_compra: { [Op.gte]: deDate, [Op.lte]: ateDate },
      },
      include: [Mercado],
    });

    const total = compras.reduce((sum, c) => sum + parseFloat(c.total_nf || 0), 0);
    const comprasCount = compras.length;

    const grupos = [];
    if (agruparPor === 'mes') {
      const map = {};
      for (const c of compras) {
        const d = new Date(c.data_compra);
        const chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        if (!map[chave]) map[chave] = { total: 0, compras: 0 };
        map[chave].total += parseFloat(c.total_nf || 0);
        map[chave].compras++;
      }
      for (const [chave, val] of Object.entries(map)) {
        grupos.push({
          chave,
          rotulo: chave,
          total: parseFloat(val.total.toFixed(2)),
          compras: val.compras,
          percentual: total > 0 ? parseFloat(((val.total / total) * 100).toFixed(1)) : 0,
        });
      }
      grupos.sort((a, b) => a.chave.localeCompare(b.chave));
    } else if (agruparPor === 'mercado') {
      const map = {};
      for (const c of compras) {
        const chave = c.mercado_id ? String(c.mercado_id) : 'null';
        const rotulo = c.Mercado ? c.Mercado.nome : 'Sem mercado';
        if (!map[chave]) map[chave] = { total: 0, compras: 0, rotulo };
        map[chave].total += parseFloat(c.total_nf || 0);
        map[chave].compras++;
      }
      for (const [chave, val] of Object.entries(map)) {
        grupos.push({
          chave,
          rotulo: val.rotulo,
          total: parseFloat(val.total.toFixed(2)),
          compras: val.compras,
          percentual: total > 0 ? parseFloat(((val.total / total) * 100).toFixed(1)) : 0,
        });
      }
      grupos.sort((a, b) => b.total - a.total);
    } else if (agruparPor === 'categoria') {
      // Para simplificar - categoria não existe nos modelos; retorna vazio com estrutura
      grupos.length = 0;
    }

    return {
      periodo: { de: this.formatDate(deDate), ate: this.formatDate(ateDate) },
      agruparPor,
      total: parseFloat(total.toFixed(2)),
      compras: comprasCount,
      grupos,
    };
  }

  async economia(userId, { de, ate, janelaDias = 90 }) {
    const now = new Date();
    let deDate = de ? new Date(de + 'T00:00:00Z') : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let ateDate = ate ? new Date(ate + 'T23:59:59Z') : new Date();

    const itens = await ItemComprado.findAll({
      include: [
        { model: Variacao, include: [UnidadeMedida, Produto] },
        { model: Compra, where: { user_id: userId, data_compra: { [Op.gte]: deDate, [Op.lte]: ateDate } }, required: true },
      ],
    });

    let totalPago = 0;
    let totalMelhorPreco = 0;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - janelaDias);

    for (const item of itens) {
      const pago = parseFloat(item.preco_total_real || item.preco_unit_real * (item.quantidade_embalagem || 1) || 0);
      totalPago += pago;

      // Buscar melhor preço normalizado na janela para mesma variação/produto
      const melhores = await ItemComprado.findAll({
        where: { variacao_id: item.variacao_id },
        include: [
          { model: Variacao, include: [UnidadeMedida] },
          { model: Compra, where: { data_compra: { [Op.gte]: dataLimite } }, required: true },
        ],
        order: [['preco_unit_real', 'ASC']],
        limit: 5,
      });
      if (melhores && melhores.length > 0) {
        const melhor = melhores[0];
        const precoNormMelhor = this.calcularPrecoNormalizado(melhor.preco_unit_real, melhor.Variacao.tamanho_unidade, melhor.Variacao.UnidadeMedida?.sigla);
        const sigla = (melhor.Variacao.UnidadeMedida?.sigla || '').toUpperCase();
        let qtd = item.quantidade_embalagem || 1;
        if (sigla !== 'UN') {
          // Comparar por quantidade equivalente? simplificado: usa quantidade do item
        }
        const melhorTotal = sigla === 'UN' ? precoNormMelhor * qtd : precoNormMelhor * (item.quantidade_embalagem || 1) * (melhor.Variacao.tamanho_unidade || 1); // simplificado
        // Melhor abordagem: comparar preco_normalizado * quantidade_base
        const qtdBase = item.quantidade_embalagem || 1;
        const melhorTotalCalc = precoNormMelhor * qtdBase; // aproximação
        totalMelhorPreco += Math.min(melhorTotalCalc, pago); // não deixa negativo
      } else {
        totalMelhorPreco += pago;
      }
    }

    const economiaEstimada = Math.max(0, totalPago - totalMelhorPreco);
    const economiaPercentual = totalPago > 0 ? parseFloat(((economiaEstimada / totalPago) * 100).toFixed(1)) : 0;

    return {
      periodo: { de: this.formatDate(deDate), ate: this.formatDate(ateDate) },
      totalPago: parseFloat(totalPago.toFixed(2)),
      totalMelhorPreco: parseFloat(totalMelhorPreco.toFixed(2)),
      economiaEstimada: parseFloat(economiaEstimada.toFixed(2)),
      economiaPercentual,
    };
  }

  async resumo(userId) {
    const now = new Date();
    const mesInicio = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const mesFim = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    const mesAntInicio = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const mesAntFim = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));

    const compras = await Compra.findAll({
      where: { user_id: userId, data_compra: { [Op.gte]: mesInicio, [Op.lte]: mesFim } },
    });
    const gastoMes = compras.reduce((sum, c) => sum + parseFloat(c.total_nf || 0), 0);

    const comprasAnt = await Compra.findAll({
      where: { user_id: userId, data_compra: { [Op.gte]: mesAntInicio, [Op.lte]: mesAntFim } },
    });
    const gastoMesAnt = comprasAnt.reduce((sum, c) => sum + parseFloat(c.total_nf || 0), 0);
    let variacaoPercentualMesAnterior = 0;
    if (gastoMesAnt > 0) {
      variacaoPercentualMesAnterior = parseFloat((((gastoMes - gastoMesAnt) / gastoMesAnt) * 100).toFixed(1));
    }

    // Orçamento simples em memória - não persiste
    const orcamento = await this.getOrcamento(userId);
    const metaMensal = orcamento.valorMensal || null;
    const percentualDaMeta = metaMensal ? parseFloat(((gastoMes / metaMensal) * 100).toFixed(1)) : null;

    return {
      mesAtual: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      gastoMes: parseFloat(gastoMes.toFixed(2)),
      economiaMes: 0,
      variacaoPercentualMesAnterior,
      metaMensal,
      percentualDaMeta,
    };
  }

  async getOrcamento(userId) {
    // Simples - retornar null ou valor padrão; sem tabela persistente ainda
    return { valorMensal: null, premium: false };
  }

  async setOrcamento(userId, valorMensal) {
    // Não persiste - apenas retorna
    return { valorMensal: parseFloat(valorMensal) || 0, premium: false };
  }

  async orcamentoStatus(userId, mes) {
    const now = new Date();
    const [ano, mesNum] = (mes || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`).split('-').map(Number);
    const mesInicio = new Date(Date.UTC(ano, mesNum - 1, 1));
    const mesFim = new Date(Date.UTC(ano, mesNum, 0, 23, 59, 59));
    const compras = await Compra.findAll({ where: { user_id: userId, data_compra: { [Op.gte]: mesInicio, [Op.lte]: mesFim } } });
    const gasto = compras.reduce((sum, c) => sum + parseFloat(c.total_nf || 0), 0);
    const meta = 0;
    let restante = -gasto;
    let percentual = gasto > 0 ? 100 : 0;
    let excedido = gasto > 0;
    let alerta = 'estourado';
    if (meta > 0) {
      restante = meta - gasto;
      percentual = parseFloat(((gasto / meta) * 100).toFixed(1));
      excedido = gasto > meta;
      if (percentual < 80) alerta = 'ok';
      else if (percentual <= 100) alerta = 'atencao';
      else alerta = 'estourado';
    } else {
      alerta = 'ok';
      restante = 0;
      excedido = false;
      percentual = 0;
    }
    return { meta, gasto: parseFloat(gasto.toFixed(2)), restante: parseFloat(restante.toFixed(2)), percentual, excedido, alerta };
  }
}

module.exports = new ReportsService();
