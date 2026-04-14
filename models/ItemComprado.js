const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../database');

const ItemComprado = sequelize.define('ItemComprado', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4
  },
  compra_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  variacao_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  quantidade_embalagem: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  preco_total_real: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false
  },
  preco_unit_real: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  preco_unit_normalizado: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  nome_original_nf: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('getutcdate()')
  }
}, {
  tableName: 'ItensComprados',
  timestamps: false
});

module.exports = ItemComprado;
