const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

const router = express.Router();

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_key_oxe_preco';

router.post('/register', async (req, res) => {
    try {
        let { nome, email, senha } = req.body;
        
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        }
        email = email.trim();

        const usuarioExistente = await Usuario.findOne({ where: { email } });
        if (usuarioExistente) {
            return res.status(400).json({ erro: 'E-mail já está em uso' });
        }

        const salt = await bcrypt.genSalt(10);
        const senha_hash = await bcrypt.hash(senha, salt);

        const novoUsuario = await Usuario.create({
            nome,
            email,
            senha_hash
        });

        res.status(201).json({ 
            mensagem: 'Usuário cadastrado com sucesso',
            usuario: { id: novoUsuario.id, nome: novoUsuario.nome, email: novoUsuario.email }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: e.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        let { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }
        email = email.trim();

        const usuario = await Usuario.findOne({ where: { email } });
        if (!usuario) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, nome: usuario.nome },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        res.json({
            token,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: e.message });
    }
});

module.exports = router;
