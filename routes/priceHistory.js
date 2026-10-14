const express = require('express');
const authMiddleware = require('../middlewares/auth');
const priceHistoryService = require('../services/PriceHistoryService');
const { Produto, Variacao, UnidadeMedida } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// GET /api/produtos/melhores-precos
router.get('/melhores-precos', authMiddleware, async (req, res) => {
  const { produtoIds, janelaDias = 90, variacaoId } = req.query;
  if (!produtoIds || produtoIds === '') {
    return res.status(400).json({ erro: 'produtoIds ausente/vazio' });
  }
  try {
    const resultado = await priceHistoryService.melhoresPrecos(produtoIds, janelaDias, variacaoId);
    return res.status(200).json(resultado);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

// GET /api/produtos - com q
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};
    if (q && q !== '') {
      where.nome_base = { [Op.iLike]: `%${q}%` };
    }
    const produtos = await Produto.findAll({
      where,
      order: [['nome_base', 'ASC']]
    });
    res.json(produtos);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// GET /api/produtos/:id (opcional)
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    return res.json({ id: String(produto.id), nome: produto.nome_base || produto.nome });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

// GET /api/produtos/:produtoId/historico-precos
router.get('/:produtoId/historico-precos', authMiddleware, async (req, res) => {
  const { produtoId } = req.params;
  const { variacaoId, mercados, janelaDias = 365, agrupar = true } = req.query;
  try {
    const resultado = await priceHistoryService.historicoPrecos(
      produtoId,
      variacaoId,
      mercados,
      janelaDias,
      agrupar === 'false' ? false : true
    );
    return res.status(200).json(resultado);
  } catch (e) {
    if (e.message === 'PRODUTO_NAO_ENCONTRADO') {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    if (e.message === 'VARIACAO_NAO_ENCONTRADA') {
      return res.status(404).json({ erro: 'Variação não encontrada' });
    }
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
