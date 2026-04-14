const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../database');

const Variacao = sequelize.define('Variacao', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4
  },
  produto_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  marca: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tamanho_unidade: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  unidade_medida_id: {
    type: DataTypes.TINYINT,
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('getutcdate()')
  }
}, {
  tableName: 'Variacoes',
  timestamps: false
});

module.exports = Variacao;
