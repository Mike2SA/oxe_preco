const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'OXE_PRECO',
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_SERVER || 'localhost',
    dialect: 'mssql',
    dialectOptions: {
      options: {
        encrypt: true, // Use this if you're on Windows Azure
        trustServerCertificate: true, // Change to true for local dev / self-signed certs
      },
    },
    logging: false,
  }
);

// Hook global para transformar todas as strings em caixa alta (uppercase) antes de salvar no banco
sequelize.addHook('beforeValidate', (instance) => {
  if (instance && instance.dataValues) {
    for (const key of Object.keys(instance.dataValues)) {
      if (typeof instance.dataValues[key] === 'string') {
        instance.dataValues[key] = instance.dataValues[key].toUpperCase();
      }
    }
  }
});

module.exports = sequelize;
