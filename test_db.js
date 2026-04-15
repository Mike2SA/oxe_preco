const { sequelize, Usuario } = require('./models');
const bcrypt = require('bcrypt');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // Fetch some users to see what's in the DB (safe query)
    const users = await Usuario.findAll({ limit: 5 });
    console.log('Existing users count:', users.length);

    const emailTest = 'debug_' + Date.now() + '@test.com';
    const senhaTest = 'Mypassword123';

    console.log('--- TESTE DE CRIAÇÃO ---');
    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senhaTest, salt);

    const user = await Usuario.create({
      nome: 'Debug User',
      email: emailTest,
      senha_hash: senha_hash
    });
    
    console.log('Usuário Criado (ID):', user.id);
    console.log('E-mail salvo no objeto:', user.email);
    console.log('Senha Hash no objeto:', user.senha_hash);

    // Agora buscamos do banco para ver como foi persistido
    const userFromDb = await Usuario.findByPk(user.id);
    console.log('--- DO BANCO ---');
    console.log('E-mail no DB:', userFromDb.email);
    console.log('Hash no DB:', userFromDb.senha_hash);
    
    const isValid = await bcrypt.compare(senhaTest, userFromDb.senha_hash);
    console.log('Bcrypt match?', isValid);

    process.exit(0);
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
})();
