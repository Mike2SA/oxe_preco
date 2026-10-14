const express = require('express');
const authMiddleware = require('../middlewares/auth');
const mercadosService = require('../services/MercadosProximosService');

const router = express.Router();

router.get('/mercados', authMiddleware, async (req, res) => {
  try {
    const result = await mercadosService.getMercados(req.query);
    res.json(result);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.get('/mercados/:id', authMiddleware, async (req, res) => {
  try {
    const result = await mercadosService.getMercadoDetalhe(req.params.id);
    if (!result) return res.status(404).json({ erro: 'Mercado não encontrado' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.get('/produtos/:produtoId/precos-proximos', authMiddleware, async (req, res) => {
  try {
    const result = await mercadosService.getPrecosProximos(req.params.produtoId, req.query);
    res.json(result);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.get('/mercados/:id/produtos', authMiddleware, async (req, res) => {
  try {
    const result = await mercadosService.getProdutosMercado(req.params.id, req.query);
    res.json(result);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
