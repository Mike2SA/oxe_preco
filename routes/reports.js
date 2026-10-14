const express = require('express');
const authMiddleware = require('../middlewares/auth');
const reportsService = require('../services/ReportsService');

const router = express.Router();

router.get('/relatorios/gastos', authMiddleware, async (req, res) => {
  const { de, ate, agruparPor = 'mes' } = req.query;
  try {
    const resultado = await reportsService.gastos(req.userId, { de, ate, agruparPor });
    return res.status(200).json(resultado);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

router.get('/relatorios/economia', authMiddleware, async (req, res) => {
  const { de, ate } = req.query;
  try {
    const resultado = await reportsService.economia(req.userId, { de, ate });
    return res.status(200).json(resultado);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

router.get('/relatorios/resumo', authMiddleware, async (req, res) => {
  try {
    const resultado = await reportsService.resumo(req.userId);
    return res.status(200).json(resultado);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

router.get('/orcamento', authMiddleware, async (req, res) => {
  try {
    const orcamento = await reportsService.getOrcamento(req.userId);
    return res.json(orcamento);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

router.put('/orcamento', authMiddleware, async (req, res) => {
  try {
    const { valorMensal } = req.body;
    const orcamento = await reportsService.setOrcamento(req.userId, valorMensal);
    return res.json(orcamento);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

router.get('/orcamento/status', authMiddleware, async (req, res) => {
  const { mes } = req.query;
  try {
    const status = await reportsService.orcamentoStatus(req.userId, mes);
    return res.json(status);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
