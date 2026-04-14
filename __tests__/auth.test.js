const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/auth');
const { Usuario } = require('../models');

jest.mock('../models', () => ({
    Usuario: {
        findOne: jest.fn(),
        create: jest.fn(),
    }
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('POST /api/auth/register - success', async () => {
        Usuario.findOne.mockResolvedValue(null);
        Usuario.create.mockResolvedValue({ id: 1, nome: 'Teste', email: 'teste@teste.com' });

        const res = await request(app)
            .post('/api/auth/register')
            .send({ nome: 'Teste', email: 'teste@teste.com', senha: '123' });

        expect(res.statusCode).toBe(201);
        expect(res.body.usuario).toHaveProperty('id', 1);
        expect(res.body.usuario).toHaveProperty('nome', 'Teste');
    });

    test('POST /api/auth/login - failure when user not found', async () => {
        Usuario.findOne.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'errado@teste.com', senha: '321' });

        expect(res.statusCode).toBe(401);
        expect(res.body.erro).toBe('Credenciais inválidas');
    });
});
