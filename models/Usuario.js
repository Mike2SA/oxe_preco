const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../database');

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nome: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  senha_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('getutcdate()')
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('getutcdate()')
  }
}, {
  tableName: 'Usuarios',
  timestamps: false
});

module.exports = Usuario;
