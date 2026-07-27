const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../database');

const Compra = sequelize.define('Compra', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  chave_nfce: {
    type: DataTypes.STRING(44),
    allowNull: false,
    unique: true
  },
  mercado_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  data_compra: {
    type: DataTypes.DATE,
    allowNull: false
  },
  total_nf: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  unidade_medida_id: {
    type: DataTypes.TINYINT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'processada'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('getutcdate()')
  }
}, {
  tableName: 'Compras',
  timestamps: false
});

module.exports = Compra;
