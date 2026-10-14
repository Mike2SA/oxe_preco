const { Op } = require('sequelize');
const { Produto, Variacao, UnidadeMedida, ItemComprado, Compra, Mercado } = require('../models');

class CatalogoService {
  calcularPrecoNormalizado(precoUnitReal, tamanhoUnidade, unidadeSigla) {
    const sigla = (unidadeSigla || '').toUpperCase().trim();
    if (sigla === 'UN') return parseFloat(precoUnitReal);
    const tam = parseFloat(tamanhoUnidade);
    if (tam > 0) return parseFloat(precoUnitReal) / tam;
    return parseFloat(precoUnitReal);
  }

  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  async getProdutos(params) {
    const { q, categoria, ean, page, pageSize } = params;
    const where = {};
    if (q) where.nome_base = { [Op.iLike]: `%${q}%` };
    const produtos = await Produto.findAll({ where, order: [['nome_base', 'ASC']] });
    return page ? { items: produtos, page: parseInt(page), total: produtos.length } : produtos;
  }

  async getPorEan(ean) {
    const produtos = await Produto.findAll({ where: { eans: { [Op.contains]: [ean] } } });
    if (!produtos || produtos.length === 0) throw new Error('NOT_FOUND');
    const produto = produtos[0];
    const variacoes = await Variacao.findAll({ where: { produto_id: produto.id }, include: [UnidadeMedida] });
    const variacao = variacoes[0];
    const janelaDias = 90;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - janelaDias);
    const itens = await ItemComprado.findAll({
      include: [
        { model: Variacao, where: { id: variacao.id }, required: true },
        { model: Compra, where: { data_compra: { [Op.gte]: dataLimite } }, required: true },
        { model: Mercado, required: true },
      ],
    });
    let melhorPreco = null;
    if (itens && itens.length > 0) {
      const porMercado = {};
      for (const item of itens) {
        const mid = item.Compra.Mercado.id;
        if (!porMercado[mid] || new Date(item.Compra.data_compra) > new Date(porMercado[mid].Compra.data_compra)) {
          porMercado[mid] = item;
        }
      }
      const resultados = Object.values(porMercado).map(item => {
        const v = item.Variacao;
        const precoNorm = this.calcularPrecoNormalizado(item.preco_unit_real, v.tamanho_unidade, v.UnidadeMedida?.sigla);
        return { item, mercado: item.Compra.Mercado, dataCompra: item.Compra.data_compra, preco: item.preco_unit_real, precoNormalizado: precoNorm };
      });
      resultados.sort((a,b) => a.precoNormalizado - b.precoNormalizado);
      const m = resultados[0];
      melhorPreco = { preco: m.preco, precoNormalizado: m.precoNormalizado, data: this.formatDate(m.dataCompra), mercado: { id: String(m.mercado.id), nome: m.mercado.nome } };
    }
    return {
      produto: { id: String(produto.id), nome: produto.nome_base || produto.nome, categoria: produto.categoria, eans: produto.eans || [] },
      variacao: { id: String(variacao.id), marca: variacao.marca, unidade: (variacao.UnidadeMedida?.sigla||'UN').toLowerCase(), quantidadePadrao: parseFloat(variacao.tamanho_unidade)||1.0 },
      melhorPreco,
    };
  }

  async getProdutoDetalhe(id) {
    const produto = await Produto.findByPk(id);
    if (!produto) throw new Error('NOT_FOUND');
    const variacoes = await Variacao.findAll({ where: { produto_id: id }, include: [UnidadeMedida] });
    return {
      id: String(produto.id),
      nome: produto.nome_base || produto.nome,
      categoria: produto.categoria,
      eans: produto.eans || [],
      variacoes: variacoes.map(v => ({ id: String(v.id), marca: v.marca, unidade: (v.UnidadeMedida?.sigla||'UN').toLowerCase(), quantidadePadrao: parseFloat(v.tamanho_unidade)||1.0 })),
    };
  }

  async getCategorias() {
    const produtos = await Produto.findAll({ attributes: ['categoria'], where: { categoria: { [Op.ne]: null } }, group: ['categoria'] });
    return produtos.map((p, i) => ({ id: String(i+1), nome: p.categoria }));
  }

  async getSugestoes(tipo = 'frequentes', limite = 10, userId) {
    return [{ chave: tipo, titulo: tipo === 'frequentes' ? 'Você compra sempre' : 'Para repor', itens: [] }];
  }
}

module.exports = new CatalogoService();
