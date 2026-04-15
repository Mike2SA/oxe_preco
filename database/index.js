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

// Hook global para transformar certas strings em caixa alta (uppercase) antes de salvar no banco
sequelize.addHook('beforeValidate', (instance) => {
  if (instance && instance.dataValues) {
    for (const key of Object.keys(instance.dataValues)) {
      const value = instance.dataValues[key];
      if (typeof value === 'string') {
        const shouldSkip = (key === 'email' || key === 'senha_hash' || key === 'senha' || key === 'token');
        
        if (!shouldSkip) {
          instance.dataValues[key] = value.toUpperCase();
        } else {
          // Log para confirmar que estamos pulando
          console.log(`[Sequelize Hook] Poupando campo: ${key} (valor: ${value.substring(0, 10)}...)`);
        }
      }
    }
  }
});

module.exports = sequelize;
