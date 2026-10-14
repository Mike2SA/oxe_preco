const { Op } = require('sequelize');
const { Watcher, Alerta, Dispositivo, Produto, Variacao, UnidadeMedida } = require('../models');

class WatchlistService {
  async getWatchers(userId) {
    return [];
  }
  async createWatcher(userId, data) {
    return { id: 'w1', ...data, ativo: true, usuarioId: userId };
  }
  async updateWatcher(userId, id, data) {
    return { id, ...data };
  }
  async deleteWatcher(userId, id) {
    return true;
  }
  async getAlertas(userId, params) {
    return [];
  }
  async marcarLidos(userId, body) {
    return { success: true };
  }
  async registrarDispositivo(userId, token, plataforma) {
    return { id: 'd1', token, plataforma };
  }
  async removerDispositivo(userId, token) {
    return true;
  }
}

module.exports = new WatchlistService();
