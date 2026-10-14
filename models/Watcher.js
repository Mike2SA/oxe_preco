const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Watcher = sequelize.define('Watcher', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  usuarioId: { type: DataTypes.UUID, allowNull: false },
  produtoId: { type: DataTypes.UUID, allowNull: false },
  variacaoId: { type: DataTypes.UUID, allowNull: true },
  mercadoId: { type: DataTypes.UUID, allowNull: true },
  precoAlvo: { type: DataTypes.DECIMAL(10,2), allowNull: true },
  modo: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'queda' },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  criadoEm: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'Watchers',
  timestamps: false,
});

module.exports = Watcher;
