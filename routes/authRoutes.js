const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;


router.get('/cadastro', (req, res) => {
    res.render('auth/cadastro', { title: 'Cadastro' });
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
        const userExists = await new Promise((resolve, reject) => {
            db.get("SELECT email FROM Usuario WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (userExists) {
            req.flash('error_msg', 'Este e-mail já está cadastrado.');
            return res.redirect('/auth/cadastro');
        }

        const hashedPassword = await bcrypt.hash(senha, SALT_ROUNDS);

        db.run("INSERT INTO Usuario (nome, email, senha, tipo) VALUES (?, ?, ?, ?)", [nome, email, hashedPassword, tipo], function(err) {
            if (err) {
                console.error("Erro ao cadastrar usuário (Usuario):", err.message);
                req.flash('error_msg', 'Erro ao cadastrar. Tente novamente.');
                return res.redirect('/auth/cadastro');
            }
            const userId = this.lastID;

            

            const specificTable = tipo === 'aluno' ? 'Aluno' : 'Professor';
            db.run(`INSERT INTO ${specificTable} (id_usuario) VALUES (?)`, [userId], (specificErr) => {
                if (specificErr) {
                    console.error(`Erro ao cadastrar em ${specificTable}:`, specificErr.message);
                    
                    req.flash('error_msg', `Erro ao finalizar cadastro de ${tipo}. Tente novamente.`);
                    return res.redirect('/auth/cadastro');
                }
                req.flash('success_msg', 'Cadastro realizado com sucesso! Faça o login.');
                res.redirect('/auth/login');
            });
        });
    } catch (error) {
        console.error("Erro no processo de cadastro:", error);
        req.flash('error_msg', 'Ocorreu um erro no servidor. Tente mais tarde.');
        res.redirect('/auth/cadastro');
    }
});


router.get('/login', (req, res) => {
    res.render('auth/login', { title: 'Login' });
});


router.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        req.flash('error_msg', 'E-mail e senha são obrigatórios.');
        return res.redirect('/auth/login');
    }

    try {
        db.get("SELECT * FROM Usuario WHERE email = ?", [email], async (err, user) => {
            if (err) {
                console.error("Erro ao buscar usuário:", err.message);
                req.flash('error_msg', 'Erro no servidor. Tente novamente.');
                return res.redirect('/auth/login');
            }
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
        });
    } catch (error) {
        console.error("Erro no processo de login:", error);
        req.flash('error_msg', 'Ocorreu um erro no servidor. Tente mais tarde.');
        res.redirect('/auth/login');
    }
});


router.get('/logout', (req, res) => {
    res.clearCookie('token');
    req.flash('success_msg', 'Você foi desconectado.');
    res.redirect('/auth/login');
});

module.exports = router;