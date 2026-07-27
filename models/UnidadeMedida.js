const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../database');

const UnidadeMedida = sequelize.define('UnidadeMedida', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4
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
