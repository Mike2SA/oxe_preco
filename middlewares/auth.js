const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_key_oxe_preco';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ erro: 'Token de autenticação não fornecido' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
        return res.status(401).json({ erro: 'Erro no token: formato inválido' });
    }

    const [scheme, token] = parts;
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ erro: 'Erro no token: tipo incorreto (deve ser Bearer)' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ erro: 'Token inválido ou expirado' });
        }
        
        req.userId = decoded.id;
        req.user = decoded; // Salva o objeto decodificado inteiro
        return next();
    });
};

module.exports = authMiddleware;
