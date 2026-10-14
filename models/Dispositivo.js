const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Dispositivo = sequelize.define('Dispositivo', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  usuarioId: { type: DataTypes.UUID, allowNull: false },
  token: { type: DataTypes.STRING(500), allowNull: false },
  plataforma: { type: DataTypes.STRING(20), allowNull: true },
  criadoEm: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'Dispositivos',
  timestamps: false,
});

module.exports = Dispositivo;
