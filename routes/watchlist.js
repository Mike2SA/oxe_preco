const express = require('express');
const authMiddleware = require('../middlewares/auth');
const watchlistService = require('../services/WatchlistService');

const router = express.Router();

router.get('/watchers', authMiddleware, async (req, res) => {
  const result = await watchlistService.getWatchers(req.userId);
  res.json(result);
});

router.post('/watchers', authMiddleware, async (req, res) => {
  const result = await watchlistService.createWatcher(req.userId, req.body);
  res.status(201).json(result);
});

router.patch('/watchers/:id', authMiddleware, async (req, res) => {
  const result = await watchlistService.updateWatcher(req.userId, req.params.id, req.body);
  res.json(result);
});

router.delete('/watchers/:id', authMiddleware, async (req, res) => {
  await watchlistService.deleteWatcher(req.userId, req.params.id);
  res.status(204).send();
});

router.get('/alertas', authMiddleware, async (req, res) => {
  const result = await watchlistService.getAlertas(req.userId, req.query);
  res.json(result);
});

router.post('/alertas/marcar-lidos', authMiddleware, async (req, res) => {
  const result = await watchlistService.marcarLidos(req.userId, req.body);
  res.json(result);
});

router.post('/dispositivos', authMiddleware, async (req, res) => {
  const { token, plataforma } = req.body;
  const result = await watchlistService.registrarDispositivo(req.userId, token, plataforma);
  res.status(201).json(result);
});

router.delete('/dispositivos/:token', authMiddleware, async (req, res) => {
  await watchlistService.removerDispositivo(req.userId, req.params.token);
  res.status(204).send();
});

module.exports = router;
