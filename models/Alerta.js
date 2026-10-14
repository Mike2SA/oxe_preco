const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Alerta = sequelize.define('Alerta', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  watcherId: { type: DataTypes.UUID, allowNull: true },
  produtoId: { type: DataTypes.UUID, allowNull: false },
  variacaoId: { type: DataTypes.UUID, allowNull: true },
  preco: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  precoNormalizado: { type: DataTypes.DECIMAL(10,4), allowNull: true },
  mercado: { type: DataTypes.STRING(100), allowNull: true },
  data: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  lido: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'Alertas',
  timestamps: false,
});

module.exports = Alerta;
