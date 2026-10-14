const express = require('express');
const authMiddleware = require('../middlewares/auth');
const comunidadeService = require('../services/ComunidadeService');

const router = express.Router();

router.get('/feed', authMiddleware, async (req, res) => {
  const result = await comunidadeService.feed(req.query);
  res.json(result);
});

router.post('/posts', authMiddleware, async (req, res) => {
  const result = await comunidadeService.criarPost(req.userId, req.body);
  res.status(201).json(result);
});

router.post('/posts/:id/curtir', authMiddleware, async (req, res) => {
  await comunidadeService.curtir(req.params.id, req.userId);
  res.json({ success: true });
});

router.delete('/posts/:id/curtir', authMiddleware, async (req, res) => {
  await comunidadeService.descurtir(req.params.id, req.userId);
  res.json({ success: true });
});

router.get('/posts/:id/comentarios', authMiddleware, async (req, res) => {
  const result = await comunidadeService.comentarios(req.params.id, req.query);
  res.json(result);
});

router.post('/posts/:id/comentarios', authMiddleware, async (req, res) => {
  const result = await comunidadeService.adicionarComentario(req.params.id, req.userId, req.body.texto);
  res.status(201).json(result);
});

router.post('/posts/:id/salvar', authMiddleware, async (req, res) => {
  await comunidadeService.salvar(req.params.id, req.userId);
  res.json({ success: true });
});

router.delete('/posts/:id/salvar', authMiddleware, async (req, res) => {
  await comunidadeService.removerSalvo(req.params.id, req.userId);
  res.json({ success: true });
});

router.get('/salvos', authMiddleware, async (req, res) => {
  const result = await comunidadeService.salvos(req.userId);
  res.json(result);
});

router.delete('/posts/:id', authMiddleware, async (req, res) => {
  await comunidadeService.deletarPost(req.params.id, req.userId);
  res.status(204).send();
});

router.post('/posts/:id/denunciar', authMiddleware, async (req, res) => {
  await comunidadeService.denunciar(req.params.id, req.userId, req.body);
  res.json({ success: true });
});

router.get('/destaques', authMiddleware, async (req, res) => {
  const result = await comunidadeService.destaques();
  res.json(result);
});

module.exports = router;
