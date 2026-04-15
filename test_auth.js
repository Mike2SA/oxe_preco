const { Usuario } = require('c:/node/oxe_preco_node/models');
const bcrypt = require('bcrypt');

(async () => {
    try {
        const email = 'Teste_Login@email.com';
        const senha = 'Mypassword123';
        
        let user = await Usuario.findOne({ where: { email } });
        if (user) {
            await user.destroy();
        }

        const salt = await bcrypt.genSalt(10);
        const senha_hash = await bcrypt.hash(senha, salt);
        console.log("Hash gerado (length):", senha_hash.length, "=>", senha_hash);

        // CREATE
        user = await Usuario.create({
            nome: 'Teste',
            email,
            senha_hash
        });

        console.log("Usuario salvo:", user.toJSON());

        // TRY LOGIN
        const fetchedUser = await Usuario.findOne({ where: { email } });
        console.log("Fetched User:", fetchedUser.toJSON());

        const valid = await bcrypt.compare(senha, fetchedUser.senha_hash);
        console.log("Senha Valida:", valid);

        process.exit(0);

    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
