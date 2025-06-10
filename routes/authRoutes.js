const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { promisify } = require('util');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

const dbGet = promisify(db.get.bind(db));
const dbRun = promisify(db.run.bind(db));

router.get('/cadastro', (req, res) => {
    res.render('auth/cadastro', { 
        title: 'Cadastro',
        messages: req.flash() 
    });
});

router.post('/cadastro', async (req, res) => {
    const { nome, email, senha, confirmarSenha, tipo } = req.body;

    if (!nome || !email || !senha || !confirmarSenha || !tipo) {
        req.flash('error_msg', 'Todos os campos são obrigatórios.');
        return res.redirect('/auth/cadastro');
    }
    if (senha !== confirmarSenha) {
        req.flash('error_msg', 'As senhas não coincidem.');
        return res.redirect('/auth/cadastro');
    }
    if (!['aluno', 'professor'].includes(tipo)) {
        req.flash('error_msg', 'Tipo de usuário inválido.');
        return res.redirect('/auth/cadastro');
    }

    try {
        const userExists = await dbGet("SELECT email FROM Usuario WHERE email = ?", [email]);
        if (userExists) {
            req.flash('error_msg', 'E-mail já cadastrado.');
            return res.redirect('/auth/cadastro');
        }

        const hashedPassword = await bcrypt.hash(senha, SALT_ROUNDS);

        await dbRun("INSERT INTO Usuario (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
            [nome, email, hashedPassword, tipo]);

        req.flash('success_msg', 'Você foi cadastrado com sucesso! Faça login para continuar.');
        res.redirect('/auth/login');
    } catch (error) {
        console.error("Erro no processo de cadastro:", error);
        req.flash('error_msg', 'Ocorreu um erro no servidor ao cadastrar. Tente mais tarde.');
        res.redirect('/auth/cadastro');
    }
});

router.get('/login', (req, res) => {
    res.render('auth/login', { 
        title: 'Login',
        messages: req.flash() 
    });
});

router.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        req.flash('error_msg', 'E-mail e senha são obrigatórios.');
        return res.redirect('/auth/login');
    }

    try {
        const user = await dbGet("SELECT id_usuario, nome, email, senha, tipo FROM Usuario WHERE email = ?", [email]);

        if (!user) {
            req.flash('error_msg', 'E-mail ou senha inválidos.');
            return res.redirect('/auth/login');
        }

        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            req.flash('error_msg', 'E-mail ou senha inválidos.');
            return res.redirect('/auth/login');
        }

        const tokenPayload = {
            id: user.id_usuario,  
            nome: user.nome,
            email: user.email,
            tipo: user.tipo
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' }); 

        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' }); 
        
        req.flash('success_msg', 'Login realizado com sucesso!');
        res.redirect('/painel'); 
    } catch (error) {
        console.error("Erro no processo de login:", error);
        req.flash('error_msg', 'Ocorreu um erro no servidor. Tente mais tarde.');
        res.redirect('/auth/login');
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('token'); 
    req.flash('success_msg', 'Você foi desconectado com sucesso.');
    res.redirect('/auth/login'); 
});

module.exports = router;
