const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { promisify } = require('util');

const JWT_SECRET = process.env.JWT_SECRET;

 
function verifyTokenAndSetUser(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        res.locals.user = null;
        req.user = null;
        return next();  
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
      
        db.get("SELECT id_usuario, nome, email, tipo FROM Usuario WHERE id_usuario = ?", [decoded.id], (err, user) => {
            if (err) {
                console.error("Erro ao buscar usuário do token:", err.message);
                res.clearCookie('token');
                res.locals.user = null;
                req.user = null;
                return next();  
            }
            
            if (!user) {
                console.warn("Usuário do token não encontrado no banco de dados.");
                res.clearCookie('token');
                res.locals.user = null;
                req.user = null;
                return next();  
            } else {
                
                req.user = { 
                    id: user.id_usuario,  
                    id_usuario: user.id_usuario,  
                    nome: user.nome,
                    email: user.email,
                    tipo: user.tipo
                };
                res.locals.user = req.user;  
                return next();  
            }
        });
    } catch (err) {
         
        console.error("Erro ao verificar token JWT:", err.message);
        res.clearCookie('token'); 
        res.locals.user = null;
        req.user = null;
        return next();  
    }
}

 
function isAuthenticated(req, res, next) {
    if (req.user) {
        return next();
    }
    req.flash('error_msg', 'Por favor, faça login para acessar esta página.');
    res.redirect('/auth/login'); 
}

 
function isProfessor(req, res, next) {
    if (req.user && req.user.tipo === 'professor') {
        return next();
    }
    req.flash('error_msg', 'Acesso negado. Somente professores podem acessar esta página.');
    if (req.user) {
        res.redirect('/painel'); 
    } else {
        res.redirect('/auth/login'); 
    }
}

 
function isAluno(req, res, next) {
    if (req.user && req.user.tipo === 'aluno') {
        return next();
    }
    req.flash('error_msg', 'Acesso negado. Somente alunos podem acessar esta página.');
    if (req.user) {
        res.redirect('/painel');  
    } else {
        res.redirect('/auth/login');  
    }
}

module.exports = {
    verifyTokenAndSetUser,
    isAuthenticated,
    isProfessor,
    isAluno
};
