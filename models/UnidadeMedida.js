const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const UnidadeMedida = sequelize.define('UnidadeMedida', {
  id: {
    type: DataTypes.TINYINT,
    primaryKey: true,
    autoIncrement: true,
  },
  sigla: {
    type: DataTypes.CHAR(2),
    allowNull: false,
    unique: true
  },
  descricao: {
    type: DataTypes.STRING(50),
    allowNull: false
  }
}, {
  tableName: 'UnidadesMedida',
  timestamps: false,
});

module.exports = UnidadeMedida;
