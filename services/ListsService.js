class ListsService {
  async sync(userId, body) {
    return { servidorEm: new Date().toISOString(), listas: body.listas || [], mapaIds: [] };
  }
  async getListas(userId) { return []; }
  async criarLista(userId, data) { return { id: 'srv-1', ...data }; }
  async getLista(id, userId) { return null; }
  async patchLista(id, userId, data) { return { id, ...data }; }
  async addItem(listaId, userId, data) { return { id: 'srv-i1', ...data }; }
  async patchItem(listaId, itemId, userId, data) { return { id: itemId, ...data }; }
  async deleteItem(listaId, itemId, userId) { return true; }
  async compartilhar(listaId, userId, body) { return { token: 'abc123', url: 'https://oxepreco.app/l/abc123', expiraEm: null, modo: 'leitura' }; }
  async getCompartilhada(token) { return null; }
  async importar(userId, token) { return { id: 'srv-c1', origem: 'token' }; }
  async revogarCompartilhamento(listaId, userId) { return true; }
}

module.exports = new ListsService();
