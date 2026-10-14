class ComunidadeService {
  async feed(params) { return { items: [], page: 1, total: 0 }; }
  async criarPost(userId, data) { return { id: 'p1', ...data }; }
  async curtir(postId, userId) { return { success: true }; }
  async descurtir(postId, userId) { return { success: true }; }
  async comentarios(postId, params) { return []; }
  async adicionarComentario(postId, userId, texto) { return { id: 'c1', texto }; }
  async salvar(postId, userId) { return { success: true }; }
  async removerSalvo(postId, userId) { return { success: true }; }
  async salvos(userId) { return []; }
  async deletarPost(postId, userId) { return { success: true }; }
  async denunciar(postId, userId, motivo) { return { success: true }; }
  async destaques() { return []; }
}

module.exports = new ComunidadeService();
