const express = require('express');
const authMiddleware = require('../middlewares/auth');
const listsService = require('../services/ListsService');

const router = express.Router();

router.post('/listas/sync', authMiddleware, async (req, res) => {
  const result = await listsService.sync(req.userId, req.body);
  res.json(result);
});

router.get('/listas', authMiddleware, async (req, res) => {
  const result = await listsService.getListas(req.userId);
  res.json(result);
});

router.post('/listas', authMiddleware, async (req, res) => {
  const result = await listsService.criarLista(req.userId, req.body);
  res.status(201).json(result);
});

router.get('/listas/:id', authMiddleware, async (req, res) => {
  const result = await listsService.getLista(req.params.id, req.userId);
  if (!result) return res.status(404).json({ erro: 'Lista não encontrada' });
  res.json(result);
});

router.patch('/listas/:id', authMiddleware, async (req, res) => {
  const result = await listsService.patchLista(req.params.id, req.userId, req.body);
  res.json(result);
});

router.post('/listas/:id/itens', authMiddleware, async (req, res) => {
  const result = await listsService.addItem(req.params.id, req.userId, req.body);
  res.status(201).json(result);
});

router.patch('/listas/:id/itens/:itemId', authMiddleware, async (req, res) => {
  const result = await listsService.patchItem(req.params.id, req.params.itemId, req.userId, req.body);
  res.json(result);
});

router.delete('/listas/:id/itens/:itemId', authMiddleware, async (req, res) => {
  await listsService.deleteItem(req.params.id, req.params.itemId, req.userId);
  res.status(204).send();
});

router.post('/listas/:id/compartilhar', authMiddleware, async (req, res) => {
  const result = await listsService.compartilhar(req.params.id, req.userId, req.body);
  res.json(result);
});

router.get('/listas/compartilhadas/:token', async (req, res) => {
  const result = await listsService.getCompartilhada(req.params.token);
  if (!result) return res.status(404).json({ erro: 'Token inválido ou expirado' });
  res.json(result);
});

router.post('/listas/importar', authMiddleware, async (req, res) => {
  const result = await listsService.importar(req.userId, req.body.token);
  res.status(201).json(result);
});

router.delete('/listas/:id/compartilhar', authMiddleware, async (req, res) => {
  await listsService.revogarCompartilhamento(req.params.id, req.userId);
  res.status(204).send();
});

module.exports = router;
