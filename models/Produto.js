const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../database');

const Produto = sequelize.define('Produto', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4
  },
  nome_base: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  categoria: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  categoriaId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  eans: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('getutcdate()')
  }
}, {
  tableName: 'Produtos',
  timestamps: false
});

module.exports = Produto;
