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
            turmas = await dbAll("SELECT t.*, u.nome as nome_professor FROM Turma t LEFT JOIN Usuario u ON t.id_professor = u.id_usuario WHERE t.id_professor = ?", [req.user.id]);
        } else if (req.user.tipo === 'aluno') {
            pageTitle = "Turmas Inscritas";
            turmas = await dbAll(`
                SELECT t.*, u_prof.nome as nome_professor
                FROM Turma t
                JOIN Aluno_Turma at ON t.id_turma = at.id_turma
                LEFT JOIN Usuario u_prof ON t.id_professor = u_prof.id_usuario
                WHERE at.id_aluno = ?
            `, [req.user.id]);
        } else if (req.user.tipo === 'administrador') {
            pageTitle = "Todas as Turmas";
             turmas = await dbAll("SELECT t.*, u.nome as nome_professor FROM Turma t LEFT JOIN Usuario u ON t.id_professor = u.id_usuario");
        }
        
        res.render('turmas/index', {
            title: pageTitle,
            turmas: turmas,
            user: req.user 
        });
    } catch (err) {
        console.error("Erro ao buscar turmas:", err);
        req.flash('error_msg', 'Não foi possível carregar as turmas.');
        res.redirect('/painel');
    }
});


router.get('/nova', isAuthenticated, isProfessor, (req, res) => {
    res.render('turmas/nova', { title: 'Criar Nova Turma' });
});


router.post('/', isAuthenticated, isProfessor, async (req, res) => {
    const { nome, descricao, codigo } = req.body; 
    if (!nome || !codigo) {
        req.flash('error_msg', 'Nome e Código da Turma são obrigatórios.');
        return res.redirect('/turmas/nova');
    }

    try {
        
        const turmaExistente = await dbGet("SELECT id_turma FROM Turma WHERE codigo = ?", [codigo]);
        if (turmaExistente) {
            req.flash('error_msg', 'Este código de turma já está em uso.');
            return res.redirect('/turmas/nova');
        }

        await dbRun("INSERT INTO Turma (nome, descricao, codigo, id_professor) VALUES (?, ?, ?, ?)",
            [nome, descricao || null, codigo, req.user.id]);
        req.flash('success_msg', 'Turma criada com sucesso!');
        res.redirect('/turmas');
    } catch (err) {
        console.error("Erro ao criar turma:", err);
        req.flash('error_msg', 'Erro ao criar turma. Tente novamente.');
        res.redirect('/turmas/nova');
    }
});


router.get('/:id', isAuthenticated, async (req, res) => {
    const turmaId = req.params.id;
    try {
        const turma = await dbGet("SELECT t.*, u.nome as nome_professor FROM Turma t LEFT JOIN Usuario u ON t.id_professor = u.id_usuario WHERE t.id_turma = ?", [turmaId]);
        if (!turma) {
            req.flash('error_msg', 'Turma não encontrada.');
            return res.redirect('/turmas');
        }

        let podeVerDetalhes = false;
        if (req.user.tipo === 'professor' && turma.id_professor === req.user.id) {
            podeVerDetalhes = true;
        } else if (req.user.tipo === 'aluno') {
            const inscricao = await dbGet("SELECT * FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [req.user.id, turmaId]);
            if (inscricao) podeVerDetalhes = true;
        } else if (req.user.tipo === 'administrador') {
            podeVerDetalhes = true;
        }

        if (!podeVerDetalhes) {
            req.flash('error_msg', 'Você não tem permissão para ver esta turma.');
            return res.redirect('/turmas');
        }

        const alunosInscritos = await dbAll("SELECT u.id_usuario, u.nome, u.email FROM Usuario u JOIN Aluno_Turma at ON u.id_usuario = at.id_aluno WHERE at.id_turma = ?", [turmaId]);
        const atividadesDaTurma = await dbAll("SELECT * FROM Atividade WHERE id_turma = ?", [turmaId]);

        res.render('turmas/ver', {
            title: `Turma: ${turma.nome}`,
            turma,
            alunos: alunosInscritos,
            atividades: atividadesDaTurma,
            user: req.user
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
        const turma = await dbGet("SELECT * FROM Turma WHERE id_turma = ? AND id_professor = ?", [turmaId, req.user.id]);
        if (!turma) {
            req.flash('error_msg', 'Turma não encontrada ou você não tem permissão para editá-la.');
            return res.redirect('/turmas');
        }
        res.render('turmas/editar', { title: `Editar Turma: ${turma.nome}`, turma });
    } catch (err) {
        console.error("Erro ao buscar turma para edição:", err);
        req.flash('error_msg', 'Erro ao carregar turma para edição.');
        res.redirect('/turmas');
    }
});


router.put('/:id', isAuthenticated, isProfessor, async (req, res) => {
    const turmaId = req.params.id;
    const { nome, descricao, codigo } = req.body;
    if (!nome || !codigo) {
        req.flash('error_msg', 'Nome e Código da Turma são obrigatórios.');
        // Para redirecionar de volta ao form de edição, precisamos buscar a turma novamente ou passar os dados
        return res.redirect(`/turmas/${turmaId}/editar`);
    }
    try {
        
        const outraTurmaComCodigo = await dbGet("SELECT id_turma FROM Turma WHERE codigo = ? AND id_turma != ?", [codigo, turmaId]);
        if (outraTurmaComCodigo) {
            req.flash('error_msg', 'Este código de turma já está em uso por outra turma.');
            return res.redirect(`/turmas/${turmaId}/editar`);
        }

        await dbRun("UPDATE Turma SET nome = ?, descricao = ?, codigo = ? WHERE id_turma = ? AND id_professor = ?",
            [nome, descricao || null, codigo, turmaId, req.user.id]);
        req.flash('success_msg', 'Turma atualizada com sucesso!');
        res.redirect('/turmas');
    } catch (err) {
        console.error("Erro ao atualizar turma:", err);
        req.flash('error_msg', 'Erro ao atualizar turma.');
        res.redirect(`/turmas/${turmaId}/editar`);
    }
});


router.delete('/:id', isAuthenticated, isProfessor, async (req, res) => {
    const turmaId = req.params.id;
    try {
        
        const result = await dbRun("DELETE FROM Turma WHERE id_turma = ? AND id_professor = ?", [turmaId, req.user.id]);
        if (result.changes === 0) {
             req.flash('error_msg', 'Turma não encontrada ou você não tem permissão para removê-la.');
        } else {
            req.flash('success_msg', 'Turma removida com sucesso!');
        }
        res.redirect('/turmas');
    } catch (err) {
        console.error("Erro ao remover turma:", err);
        req.flash('error_msg', 'Erro ao remover turma.');
        res.redirect('/turmas');
    }
});


router.post('/inscrever', isAuthenticated, isAluno, async (req, res) => {
    const { codigoTurma } = req.body;
    if (!codigoTurma) {
        req.flash('error_msg', 'Código da turma é obrigatório.');
        return res.redirect('/painel'); 
    }
    try {
        const turma = await dbGet("SELECT id_turma FROM Turma WHERE codigo = ?", [codigoTurma]);
        if (!turma) {
            req.flash('error_msg', 'Turma com este código não encontrada.');
            return res.redirect('/painel');
        }

        const jaInscrito = await dbGet("SELECT * FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [req.user.id, turma.id_turma]);
        if (jaInscrito) {
            req.flash('error_msg', 'Você já está inscrito nesta turma.');
            return res.redirect(`/turmas/${turma.id_turma}`);
        }

        await dbRun("INSERT INTO Aluno_Turma (id_aluno, id_turma) VALUES (?, ?)", [req.user.id, turma.id_turma]);
        req.flash('success_msg', 'Inscrição na turma realizada com sucesso!');
        res.redirect(`/turmas/${turma.id_turma}`);
    } catch (err) {
        console.error("Erro ao inscrever aluno na turma:", err);
        req.flash('error_msg', 'Erro ao processar inscrição.');
        res.redirect('/painel');
    }
});


router.post('/:id/adicionar-aluno', isAuthenticated, isProfessor, async (req, res) => {
    const turmaId = req.params.id;
    const { emailAluno } = req.body;

    if (!emailAluno) {
        req.flash('error_msg', 'Email do aluno é obrigatório.');
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
            req.flash('error_msg', `Aluno com email "${emailAluno}" não encontrado.`);
            return res.redirect(`/turmas/${turmaId}`);
        }

        const jaInscrito = await dbGet("SELECT * FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [aluno.id_usuario, turmaId]);
        if (jaInscrito) {
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
        req.flash('success_msg', 'Aluno removido da turma.');
        res.redirect(`/turmas/${turmaId}`);
    } catch (err) {
        console.error("Erro ao remover aluno:", err);
        req.flash('error_msg', 'Erro ao remover aluno da turma.');
        res.redirect(`/turmas/${turmaId}`);
    }
});


module.exports = router;