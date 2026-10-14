const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../database');

const Mercado = sequelize.define('Mercado', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4
  },
  nome: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  cidade_id: {
    type: DataTypes.INTEGER,
    allowNull: true // changed as per user request
  },
  cnpj: {
    type: DataTypes.STRING(18),
    allowNull: true
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  lat: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true
  },
  lng: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true
  },
  endereco: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  cidade: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('getutcdate()')
  }
}, {
  tableName: 'Mercados',
  timestamps: false,
  hooks: {
    beforeValidate: (mercado) => {
      if (mercado.cnpj) {
        mercado.cnpj = mercado.cnpj.replace(/\D/g, '');
      }
    }
  }
});

module.exports = Mercado;
