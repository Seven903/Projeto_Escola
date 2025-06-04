const jwt = require('jsonwebtoken');
const db = require('../db/db'); 

const JWT_SECRET = process.env.JWT_SECRET;


function verifyTokenAndSetUser(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        res.locals.user = null; 
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
   
        db.get("SELECT id_usuario, nome, email, tipo FROM Usuario WHERE id_usuario = ?", [decoded.id], (err, user) => {
            if (err || !user) {
                res.locals.user = null;
            } else {
                res.locals.user = user; 
                req.user = user; 
            }
            next();
        });
    } catch (err) {
        console.error("Erro ao verificar token:", err.message);
        res.clearCookie('token'); 
        res.locals.user = null;
        next();
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

function isAdmin(req, res, next) {
    if (req.user && req.user.tipo === 'administrador') {
        return next();
    }
    req.flash('error_msg', 'Acesso negado. Somente administradores podem acessar esta página.');
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
    isAluno,
    isAdmin
};
