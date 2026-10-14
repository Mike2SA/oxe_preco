const express = require('express');
const authMiddleware = require('../middlewares/auth');
const optimizationService = require('../services/OptimizationService');

const router = express.Router();

router.post('/otimizacao', authMiddleware, async (req, res) => {
  try {
    const { itens, janelaDias = 90, mercados, maxMercados } = req.body;
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'itens ausente/vazio' });
    }
    const mercadosFiltro = mercados && Array.isArray(mercados) ? mercados.map(String) : null;
    const resultado = await optimizationService.otimizarLista(itens, janelaDias, mercadosFiltro, maxMercados);
    return res.status(200).json(resultado);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
