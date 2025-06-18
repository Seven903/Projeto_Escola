const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');   
const { promisify } = require('util'); 
const db = require('../db/db');      

const dbGet = promisify(db.get.bind(db));
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db)); 

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';


router.get('/login', (req, res) => {
    res.render('auth/login', {
        title: 'Login',
        messages: req.flash() 
    });
});


router.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        req.flash('error_msg', 'Por favor, preencha todos os campos.');
        return res.redirect('/auth/login');
    }

    try {
        
        const user = await dbGet("SELECT * FROM Usuario WHERE email = ?", [email]);

       
        if (!user) {
            req.flash('error_msg', 'E-mail ou senha incorretos.'); 
            return res.redirect('/auth/login');
        }


        const isMatch = await bcrypt.compare(senha, user.senha);

        if (!isMatch) {
            req.flash('error_msg', 'E-mail ou senha incorretos.'); 
            return res.redirect('/auth/login');
        }

        
        const token = jwt.sign(
            { id: user.id_usuario, tipo: user.tipo },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 3600000 
        });

        req.flash('success_msg', `Bem-vindo(a) de volta, ${user.nome}!`);
        res.redirect('/painel'); 
    } catch (err) {
        console.error("Erro no processo de login:", err);
        req.flash('error_msg', 'Ocorreu um erro no servidor. Tente novamente mais tarde.');
        res.redirect('/auth/login');
    }
});

router.get('/cadastro', (req, res) => {
    res.render('auth/cadastro', {
        title: 'Cadastro',
        messages: req.flash() 
    });
});


router.post('/cadastro', async (req, res) => {
    const { nome, email, senha, senha2, tipo } = req.body;

    let errors = [];

    
    if (!nome || !email || !senha || !senha2 || !tipo) {
        errors.push({ msg: 'Por favor, preencha todos os campos.' });
    }
    if (senha !== senha2) {
        errors.push({ msg: 'As senhas não conferem.' });
    }
    if (tipo !== 'aluno' && tipo !== 'professor') {
        errors.push({ msg: 'Tipo de usuário inválido.' });
    }

    if (errors.length > 0) {
       
        req.flash('error_msg', errors.map(err => err.msg).join('<br>')); 
        return res.redirect('/auth/cadastro');
    }

    try {
       
        const existingUser = await dbGet("SELECT email FROM Usuario WHERE email = ?", [email]);
        if (existingUser) {
            req.flash('error_msg', 'Este e-mail já está cadastrado.');
            return res.redirect('/auth/cadastro');
        }

    
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);

   
        await dbRun("INSERT INTO Usuario (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
            [nome, email, hashedPassword, tipo]);

        req.flash('success_msg', 'Você foi cadastrado com sucesso! Faça login para continuar.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error("Erro no processo de cadastro:", err);
        req.flash('error_msg', 'Ocorreu um erro no servidor durante o cadastro. Tente novamente mais tarde.');
        res.redirect('/auth/cadastro');
    }
});


router.get('/logout', (req, res) => {
    res.clearCookie('token'); 
    req.flash('success_msg', 'Você saiu da sua conta.');
    res.redirect('/auth/login');
});

module.exports = router;
