const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { isAuthenticated, isProfessor, isAluno } = require('../middlewares/authMiddleware');
const { promisify } = require('util');

const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbRun = promisify(db.run.bind(db));

router.get('/', isAuthenticated, async (req, res) => {
    try {
        let turmas = [];
        let pageTitle = "Minhas Turmas";

        if (req.user.tipo === 'professor') {
            turmas = await dbAll(`
                SELECT t.*, u.nome as nome_professor
                FROM Turma t
                LEFT JOIN Usuario u ON t.id_professor = u.id_usuario
                WHERE t.id_professor = ?
                ORDER BY t.nome ASC
            `, [req.user.id]);  
        } else if (req.user.tipo === 'aluno') {
            pageTitle = "Turmas Inscritas";
            turmas = await dbAll(`
                SELECT t.*, u_prof.nome as nome_professor
                FROM Turma t
                JOIN Aluno_Turma at ON t.id_turma = at.id_turma
                LEFT JOIN Usuario u_prof ON t.id_professor = u_prof.id_usuario
                WHERE at.id_aluno = ?
                ORDER BY t.nome ASC
            `, [req.user.id]);  
        } else {
            req.flash('error_msg', 'Tipo de usuário não autorizado para ver turmas.');
            return res.redirect('/painel');
        }

        res.render('turmas/index', {
            title: pageTitle,
            turmas: turmas,
            user: req.user,
            messages: req.flash()
        });
    } catch (err) {
        console.error("Erro ao listar turmas:", err);
        req.flash('error_msg', 'Não foi possível carregar as turmas.');
        res.redirect('/painel');
    }
});

router.get('/nova', isAuthenticated, isProfessor, (req, res) => {
    res.render('turmas/nova', { 
        title: 'Criar Nova Turma',
        messages: req.flash() 
    });
});

router.post('/', isAuthenticated, isProfessor, async (req, res) => {
    const { nome, codigo, descricao } = req.body;
    const id_professor = req.user.id; 

    if (!nome || !codigo) {
        req.flash('error_msg', 'Nome e Código da Turma são obrigatórios.');
        return res.redirect('/turmas/nova');
    }

    try {
        const turmaExistente = await dbGet("SELECT codigo FROM Turma WHERE codigo = ?", [codigo]);
        if (turmaExistente) {
            req.flash('error_msg', 'Já existe uma turma com este código.');
            return res.redirect('/turmas/nova');
        }

        await dbRun("INSERT INTO Turma (nome, codigo, descricao, id_professor) VALUES (?, ?, ?, ?)",
            [nome, codigo, descricao || null, id_professor]);

        req.flash('success_msg', 'Turma criada com sucesso!');
        res.redirect('/turmas');
    } catch (err) {
        console.error("Erro ao criar turma:", err);
        req.flash('error_msg', 'Erro ao criar turma. Tente novamente.');
        res.redirect('/turmas/nova');
    }
});

router.get('/inscrever', isAuthenticated, isAluno, (req, res) => {
    res.render('turmas/inscrever', {
        title: 'Inscrever-se em Turma',
        messages: req.flash()
    });
});

router.post('/inscrever', isAuthenticated, isAluno, async (req, res) => {
    const { codigoTurma } = req.body;
    const id_aluno = req.user.id;  

    if (!codigoTurma) {
        req.flash('error_msg', 'O código da turma é obrigatório.');
        return res.redirect('/turmas/inscrever');
    }

    try {
        const turma = await dbGet("SELECT id_turma FROM Turma WHERE codigo = ?", [codigoTurma]);
        if (!turma) {
            req.flash('error_msg', 'Turma não encontrada com o código fornecido.');
            return res.redirect('/turmas/inscrever');
        }

        const jaInscrito = await dbGet("SELECT id_aluno FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [id_aluno, turma.id_turma]);
        if (jaInscrito) {
            req.flash('error_msg', 'Você já está inscrito nesta turma.');
            return res.redirect('/turmas');
        }

        await dbRun("INSERT INTO Aluno_Turma (id_aluno, id_turma) VALUES (?, ?)", [id_aluno, turma.id_turma]);
        req.flash('success_msg', 'Inscrição na turma realizada com sucesso!');
        res.redirect('/turmas');
    } catch (err) {
        console.error("Erro ao inscrever aluno na turma:", err);
        req.flash('error_msg', 'Erro ao inscrever na turma. Tente novamente.');
        res.redirect('/turmas/inscrever');
    }
});

router.get('/:id', isAuthenticated, async (req, res) => {
    const turmaId = req.params.id;
    try {
        const turma = await dbGet(`
            SELECT t.*, u.nome as nome_professor
            FROM Turma t
            LEFT JOIN Usuario u ON t.id_professor = u.id_usuario
            WHERE t.id_turma = ?
        `, [turmaId]);

        if (!turma) {
            req.flash('error_msg', 'Turma não encontrada.');
            return res.redirect('/turmas');
        }

        let hasAccess = false;
        let alunosInscritos = [];
        let atividadesDaTurma = [];

        if (req.user.tipo === 'professor' && turma.id_professor === req.user.id) {
            hasAccess = true;
            alunosInscritos = await dbAll(`
                SELECT u.id_usuario, u.nome, u.email
                FROM Usuario u
                JOIN Aluno_Turma at ON u.id_usuario = at.id_aluno
                WHERE at.id_turma = ? AND u.tipo = 'aluno'
                ORDER BY u.nome ASC
            `, [turmaId]);
            atividadesDaTurma = await dbAll(`
                SELECT * FROM Atividade WHERE id_turma = ?
                ORDER BY prazo ASC
            `, [turmaId]);
        } else if (req.user.tipo === 'aluno') {
            const alunoNaTurma = await dbGet("SELECT id_aluno FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [req.user.id, turmaId]); 
            if (alunoNaTurma) {
                hasAccess = true;
                atividadesDaTurma = await dbAll(`
                    SELECT * FROM Atividade WHERE id_turma = ?
                    ORDER BY prazo ASC
                `, [turmaId]);
            }
        }

        if (!hasAccess) {
            req.flash('error_msg', 'Você não tem permissão para visualizar esta turma.');
            return res.redirect('/turmas');
        }

        res.render('turmas/detalhes', {
            title: `Detalhes da Turma: ${turma.nome}`,
            turma: turma,
            alunos: alunosInscritos,
            atividades: atividadesDaTurma,
            user: req.user,
            messages: req.flash()
        });

    } catch (err) {
        console.error("Erro ao buscar detalhes da turma:", err);
        req.flash('error_msg', 'Erro ao carregar detalhes da turma.');
        res.redirect('/turmas');
    }
});

router.get('/:id/editar', isAuthenticated, isProfessor, async (req, res) => {
    const turmaId = req.params.id;
    try {
        const turma = await dbGet("SELECT * FROM Turma WHERE id_turma = ? AND id_professor = ?", [turmaId, req.user.id]); // Usa req.user.id
        if (!turma) {
            req.flash('error_msg', 'Turma não encontrada ou você não tem permissão para editá-la.');
            return res.redirect('/turmas');
        }
        res.render('turmas/editar', { 
            title: `Editar Turma: ${turma.nome}`, 
            turma: turma,
            messages: req.flash()
        });
    } catch (err) {
        console.error("Erro ao carregar formulário de edição de turma:", err);
        req.flash('error_msg', 'Erro ao carregar turma para edição.');
        res.redirect('/turmas');
    }
});

router.put('/:id', isAuthenticated, isProfessor, async (req, res) => {
    const turmaId = req.params.id;
    const { nome, codigo, descricao } = req.body;

    if (!nome || !codigo) {
        req.flash('error_msg', 'Nome e Código da Turma são obrigatórios.');
        return res.redirect(`/turmas/${turmaId}/editar`);
    }

    try {
        const turmaDoProfessor = await dbGet("SELECT id_turma FROM Turma WHERE id_turma = ? AND id_professor = ?", [turmaId, req.user.id]); 
        if (!turmaDoProfessor) {
            req.flash('error_msg', 'Você não tem permissão para editar esta turma.');
            return res.redirect('/turmas');
        }

        const codigoExistente = await dbGet("SELECT id_turma FROM Turma WHERE codigo = ? AND id_turma != ?", [codigo, turmaId]);
        if (codigoExistente) {
            req.flash('error_msg', 'Já existe outra turma com este código.');
            return res.redirect(`/turmas/${turmaId}/editar`);
        }

        await dbRun("UPDATE Turma SET nome = ?, codigo = ?, descricao = ? WHERE id_turma = ?",
            [nome, codigo, descricao || null, turmaId]);

        req.flash('success_msg', 'Turma atualizada com sucesso!');
        res.redirect(`/turmas/${turmaId}`);
    } catch (err) {
        console.error("Erro ao atualizar turma:", err);
        req.flash('error_msg', 'Erro ao atualizar turma.');
        res.redirect(`/turmas/${turmaId}/editar`);
    }
});

router.delete('/:id', isAuthenticated, isProfessor, async (req, res) => {
    const turmaId = req.params.id;
    try {
        const turmaDoProfessor = await dbGet("SELECT id_turma FROM Turma WHERE id_turma = ? AND id_professor = ?", [turmaId, req.user.id]);  
        if (!turmaDoProfessor) {
            req.flash('error_msg', 'Você não tem permissão para remover esta turma.');
            return res.redirect('/turmas');
        }

        await dbRun("DELETE FROM Turma WHERE id_turma = ?", [turmaId]);
        req.flash('success_msg', 'Turma removida com sucesso!');
        res.redirect('/turmas');
    } catch (err) {
        console.error("Erro ao remover turma:", err);
        req.flash('error_msg', 'Erro ao remover turma.');
        res.redirect('/turmas');
    }
});

router.post('/:id/adicionar-aluno', isAuthenticated, isProfessor, async (req, res) => {
    const turmaId = req.params.id;
    const { emailAluno } = req.body;

    if (!emailAluno) {
        req.flash('error_msg', 'O e-mail do aluno é obrigatório.');
        return res.redirect(`/turmas/${turmaId}`);
    }

    try {
        const turmaDoProfessor = await dbGet("SELECT id_turma FROM Turma WHERE id_turma = ? AND id_professor = ?", [turmaId, req.user.id]);  
        if (!turmaDoProfessor) {
            req.flash('error_msg', 'Você não tem permissão para gerenciar esta turma.');
            return res.redirect('/turmas');
        }

        const aluno = await dbGet("SELECT id_usuario FROM Usuario WHERE email = ? AND tipo = 'aluno'", [emailAluno]);
        if (!aluno) {
            req.flash('error_msg', 'Aluno não encontrado ou e-mail inválido.');
            return res.redirect(`/turmas/${turmaId}`);
        }

        const jaNaTurma = await dbGet("SELECT id_aluno FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [aluno.id_usuario, turmaId]);
        if (jaNaTurma) {
            req.flash('error_msg', 'Este aluno já está inscrito nesta turma.');
            return res.redirect(`/turmas/${turmaId}`);
        }

        await dbRun("INSERT INTO Aluno_Turma (id_aluno, id_turma) VALUES (?, ?)", [aluno.id_usuario, turmaId]);
        req.flash('success_msg', `Aluno ${emailAluno} adicionado à turma!`);
        res.redirect(`/turmas/${turmaId}`);

    } catch (err) {
        console.error("Erro ao adicionar aluno:", err);
        req.flash('error_msg', 'Erro ao adicionar aluno à turma.');
        res.redirect(`/turmas/${turmaId}`);
    }
});

router.post('/:id/remover-aluno/:alunoId', isAuthenticated, isProfessor, async (req, res) => {
    const { id: turmaId, alunoId } = req.params;
    try {
        const turmaDoProfessor = await dbGet("SELECT id_turma FROM Turma WHERE id_turma = ? AND id_professor = ?", [turmaId, req.user.id]);  
        if (!turmaDoProfessor) {
            req.flash('error_msg', 'Você não tem permissão para gerenciar esta turma.');
            return res.redirect('/turmas');
        }

        await dbRun("DELETE FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [alunoId, turmaId]);
        req.flash('success_msg', 'Aluno removido da turma!');
        res.redirect(`/turmas/${turmaId}`);

    } catch (err) {
        console.error("Erro ao remover aluno:", err);
        req.flash('error_msg', 'Erro ao remover aluno da turma.');
        res.redirect(`/turmas/${turmaId}`);
    }
});

module.exports = router;
