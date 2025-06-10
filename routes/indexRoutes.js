const express = require('express');
const router = express.Router();
const { promisify } = require('util');
const db = require('../db/db');
const { isAuthenticated } = require('../middlewares/authMiddleware');

const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

router.get('/', (req, res) => {
    res.render('index', { 
        title: 'Bem-vindo ao Sistema Escolar',
        user: req.user,
        messages: req.flash()
    });
});

router.get('/painel', isAuthenticated, async (req, res) => {
    try {
        if (req.user.tipo === 'aluno') {
            let turmasInscritas = [];
            let atividadesPendentes = [];
            let atividadesAvaliadas = [];

            try {
                turmasInscritas = await dbAll(`
                    SELECT t.id_turma, t.nome, t.codigo, u_prof.nome AS nome_professor,
                           (SELECT COUNT(a.id_atividade) FROM Atividade a WHERE a.id_turma = t.id_turma) AS totalAtividades
                    FROM Turma t
                    JOIN Aluno_Turma at ON t.id_turma = at.id_turma
                    LEFT JOIN Usuario u_prof ON t.id_professor = u_prof.id_usuario
                    WHERE at.id_aluno = ?
                    ORDER BY t.nome ASC
                `, [req.user.id]);

                 
                for (let turma of turmasInscritas) {
                    try {
                        const notasDaTurma = await dbAll(`
                            SELECT e.nota
                            FROM Entrega e
                            JOIN Atividade a ON e.id_atividade = a.id_atividade
                            WHERE e.id_aluno = ? AND a.id_turma = ? AND e.status = 'avaliado' AND e.nota IS NOT NULL
                        `, [req.user.id, turma.id_turma]);

                        let somaNotas = 0;
                        if (notasDaTurma.length > 0) {
                            somaNotas = notasDaTurma.reduce((sum, entrega) => sum + entrega.nota, 0);
                            const mediaCem = somaNotas / notasDaTurma.length;  
                            turma.media_final_10 = (mediaCem / 10).toFixed(2);  
                        } else {
                            turma.media_final_10 = 'N/A';  
                        }
                    } catch (err) {
                        console.error(`Erro ao calcular média para a turma ${turma.nome}:`, err);
                        turma.media_final_10 = 'Erro';  
                    }
                }

            } catch (err) {
                console.error("Erro ao buscar turmas inscritas para aluno:", err);
                req.flash('error_msg', 'Erro ao carregar suas turmas.');
            }

            try {
                
                atividadesPendentes = await dbAll(`
                    SELECT a.id_atividade, a.titulo, a.prazo, t.nome AS nome_turma, e.status AS status_entrega
                    FROM Atividade a
                    JOIN Turma t ON a.id_turma = t.id_turma
                    JOIN Aluno_Turma at ON t.id_turma = at.id_turma
                    LEFT JOIN Entrega e ON a.id_atividade = e.id_atividade AND e.id_aluno = at.id_aluno
                    WHERE at.id_aluno = ? AND (e.id_entrega IS NULL OR e.status NOT IN ('avaliado'))
                    ORDER BY a.prazo ASC
                `, [req.user.id]);
            } catch (err) {
                console.error("Erro ao buscar atividades pendentes para aluno:", err);
                req.flash('error_msg', 'Erro ao carregar suas atividades pendentes.');
            }

            try {
                 atividadesAvaliadas = await dbAll(`
                    SELECT a.id_atividade, a.titulo, t.nome AS nome_turma, e.nota, e.comentario
                    FROM Atividade a
                    JOIN Turma t ON a.id_turma = t.id_turma
                    JOIN Entrega e ON a.id_atividade = e.id_atividade
                    WHERE e.id_aluno = ? AND e.status = 'avaliado'
                    ORDER BY e.data_entrega DESC
                `, [req.user.id]);
            } catch (err) {
                console.error("Erro ao buscar atividades avaliadas para aluno:", err);
                req.flash('error_msg', 'Erro ao carregar suas atividades avaliadas.');
            }

            res.render('painelAluno', {
                title: 'Painel do Aluno',
                user: req.user,
                turmasInscritas: turmasInscritas, 
                atividadesPendentes: atividadesPendentes,
                atividadesAvaliadas: atividadesAvaliadas,
                messages: req.flash()
            });
        } else if (req.user.tipo === 'professor') {
            let turmasProfessor = [];
            let atividadesCriadas = [];
            let entregasPendentes = [];

            try {
                turmasProfessor = await dbAll(`
                    SELECT t.id_turma, t.nome, t.codigo,
                           (SELECT COUNT(at.id_aluno) FROM Aluno_Turma at WHERE at.id_turma = t.id_turma) AS totalAlunos
                    FROM Turma t
                    WHERE t.id_professor = ?
                    ORDER BY t.nome ASC
                `, [req.user.id]);
            } catch (err) {
                console.error("Erro ao buscar turmas do professor:", err);
                req.flash('error_msg', 'Erro ao carregar suas turmas.');
            }

            try {
                atividadesCriadas = await dbAll(`
                    SELECT a.id_atividade, a.titulo, a.prazo, t.nome AS nome_turma
                    FROM Atividade a
                    JOIN Turma t ON a.id_turma = t.id_turma
                    WHERE a.id_professor = ?
                    ORDER BY a.prazo DESC
                `, [req.user.id]);
            } catch (err) {
                console.error("Erro ao buscar atividades criadas pelo professor:", err);
                req.flash('error_msg', 'Erro ao carregar suas atividades.');
            }

            try {
                entregasPendentes = await dbAll(`
                    SELECT e.id_entrega, e.id_atividade, e.id_aluno, e.data_entrega, e.status,
                           a.titulo AS titulo_atividade, u_aluno.nome AS nome_aluno, t.nome AS nome_turma
                    FROM Entrega e
                    JOIN Atividade a ON e.id_atividade = a.id_atividade
                    JOIN Turma t ON a.id_turma = t.id_turma
                    JOIN Usuario u_aluno ON e.id_aluno = u.id_usuario
                    WHERE t.id_professor = ? AND e.status != 'avaliado'
                    ORDER BY e.data_entrega ASC
                `, [req.user.id]);
            } catch (err) {
                console.error("Erro ao buscar entregas pendentes para professor:", err);
                req.flash('error_msg', 'Erro ao carregar entregas pendentes.');
            }

            res.render('painelProfessor', {
                title: 'Painel do Professor',
                user: req.user,
                turmasProfessor: turmasProfessor,
                atividadesCriadas: atividadesCriadas,
                entregasPendentes: entregasPendentes,
                messages: req.flash()
            });
        } else {
            req.flash('error_msg', 'Tipo de usuário não autorizado para acessar o painel.');
            res.redirect('/auth/login');
        }
    } catch (err) {
        console.error("Erro fatal ao carregar painel:", err);
        req.flash('error_msg', 'Ocorreu um erro inesperado ao carregar o painel. Tente novamente.');
        res.redirect('/auth/login');
    }
});

module.exports = router;
