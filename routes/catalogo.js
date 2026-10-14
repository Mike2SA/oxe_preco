const express = require('express');
const authMiddleware = require('../middlewares/auth');
const catalogoService = require('../services/CatalogoService');

const router = express.Router();

router.get('/produtos', authMiddleware, async (req, res) => {
  try {
    const result = await catalogoService.getProdutos(req.query);
    res.json(result);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.get('/produtos/por-ean/:ean', authMiddleware, async (req, res) => {
  try {
    const result = await catalogoService.getPorEan(req.params.ean);
    res.json(result);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ erro: 'EAN não encontrado' });
    res.status(500).json({ erro: e.message });
  }
});

router.get('/produtos/:id', authMiddleware, async (req, res) => {
  try {
    const result = await catalogoService.getProdutoDetalhe(req.params.id);
    res.json(result);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ erro: 'Produto não encontrado' });
    res.status(500).json({ erro: e.message });
  }
});

router.get('/categorias', authMiddleware, async (req, res) => {
  try {
    const result = await catalogoService.getCategorias();
    res.json(result);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.get('/sugestoes', authMiddleware, async (req, res) => {
  try {
    const result = await catalogoService.getSugestoes(req.query.tipo, req.query.limite, req.userId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
