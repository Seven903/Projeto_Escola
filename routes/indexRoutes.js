const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/authMiddleware'); 


router.get('/', (req, res) => {
   
    res.render('index', { title: 'Bem-vindo ao Sistema Escolar' });
});


router.get('/painel', isAuthenticated, (req, res) => {
    if (req.user.tipo === 'aluno') {
        // Coletar dados para o painel do aluno
        // Ex: turmas, atividades pendentes, notas
        // Por simplicidade, vamos apenas renderizar uma view básica
        res.render('painelAluno', { title: 'Painel do Aluno', user: req.user });
    } else if (req.user.tipo === 'professor') {
        // Coletar dados para o painel do professor
        // Ex: turmas que leciona, atividades criadas, entregas pendentes de correção
        res.render('painelProfessor', { title: 'Painel do Professor', user: req.user });
    } else if (req.user.tipo === 'administrador') {
        res.render('painelAdmin', { title: 'Painel do Administrador', user: req.user });
    }
    else {
        req.flash('error_msg', 'Tipo de usuário desconhecido.');
        res.redirect('/auth/login');
    }
});

module.exports = router;
