const express = require('express');
const router = express.Router();
const { promisify } = require('util');
const db = require('../db/db');
const { isAuthenticated, isProfessor, isAluno } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbRun = promisify(db.run.bind(db));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

router.get('/', isAuthenticated, async (req, res) => {
    try {
        let atividades = [];
        let pageTitle = 'Atividades';
        let turmasDisponiveis = [];

        if (req.user.tipo === 'professor') {
            pageTitle = 'Minhas Atividades (Professor)';
            atividades = await dbAll(`
                SELECT a.*, t.nome AS nome_turma, u.nome AS nome_professor
                FROM Atividade a
                JOIN Turma t ON a.id_turma = t.id_turma
                JOIN Usuario u ON a.id_professor = u.id_usuario
                WHERE a.id_professor = ?
                ORDER BY a.prazo DESC
            `, [req.user.id]);
            turmasDisponiveis = await dbAll("SELECT id_turma, nome FROM Turma WHERE id_professor = ?", [req.user.id]);
        } else if (req.user.tipo === 'aluno') {
            pageTitle = 'Minhas Atividades (Aluno)';
            atividades = await dbAll(`
                SELECT a.*, t.nome AS nome_turma, u.nome AS nome_professor,
                       e.status AS status_entrega, e.nota AS nota_entrega, e.id_entrega, e.comentario AS comentario_entrega
                FROM Atividade a
                JOIN Turma t ON a.id_turma = t.id_turma
                JOIN Aluno_Turma at ON t.id_turma = at.id_turma
                LEFT JOIN Entrega e ON a.id_atividade = e.id_atividade AND at.id_aluno = e.id_aluno
                JOIN Usuario u ON a.id_professor = u.id_usuario
                WHERE at.id_aluno = ?
                ORDER BY a.prazo DESC
            `, [req.user.id]);
        } else {
            req.flash('error_msg', 'Tipo de usuário não autorizado para ver atividades.');
            return res.redirect('/painel');
        }

        res.render('atividades/index', {
            title: pageTitle,
            atividades: atividades,
            user: req.user,
            turmas: turmasDisponiveis,
            messages: req.flash()
        });

    } catch (err) {
        console.error('Erro ao listar atividades:', err);
        req.flash('error_msg', 'Erro ao carregar atividades.');
        res.redirect('/painel');
    }
});

router.get('/nova', isAuthenticated, isProfessor, async (req, res) => {
    try {
        const turmas = await dbAll("SELECT id_turma, nome, codigo FROM Turma WHERE id_professor = ?", [req.user.id]);
        if (turmas.length === 0) {
            req.flash('error_msg', 'Você precisa ter turmas criadas para poder criar atividades.');
            return res.redirect('/atividades'); 
        }
        res.render('atividades/nova', {
            title: 'Criar Nova Atividade',
            turmas: turmas,
            user: req.user,
            messages: req.flash()
        });
    } catch (err) {
        console.error('Erro ao carregar formulário de nova atividade:', err);
        req.flash('error_msg', 'Erro ao carregar dados para nova atividade.');
        res.redirect('/atividades');
    }
});

router.post('/', isAuthenticated, isProfessor, upload.single('arquivo'), async (req, res) => {
    const { titulo, descricao, data, hora, id_turma } = req.body; 
    const id_professor = req.user.id;
    const arquivo = req.file ? `/uploads/${req.file.filename}` : null;

    if (!titulo || !descricao || !data || !id_turma) {
        req.flash('error_msg', 'Título, Descrição, Data e Turma são obrigatórios.');
        if (arquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', arquivo));
        return res.redirect('/atividades/nova');
    }

    let prazoCompleto;
    if (hora) {
        prazoCompleto = `${data}T${hora}:00`; 
    } else {
        prazoCompleto = `${data}T23:59:59`; 
    }

    const prazoDateObj = new Date(prazoCompleto);
    const now = new Date();

    
    if (prazoDateObj <= now) {
        req.flash('error_msg', 'O prazo de entrega deve ser uma data e hora futura.');
        if (arquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', arquivo));
        return res.redirect('/atividades/nova');
    }

    try {
        const turmaDoProfessor = await dbGet("SELECT id_turma FROM Turma WHERE id_turma = ? AND id_professor = ?", [id_turma, id_professor]);
        if (!turmaDoProfessor) {
            req.flash('error_msg', 'Você não tem permissão para adicionar atividades a esta turma.');
            if (arquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', arquivo));
            return res.redirect('/atividades/nova');
        }

        await dbRun("INSERT INTO Atividade (titulo, descricao, prazo, id_turma, id_professor, arquivo) VALUES (?, ?, ?, ?, ?, ?)",
            [titulo, descricao, prazoDateObj.toISOString(), id_turma, id_professor, arquivo]); 

        req.flash('success_msg', 'Atividade criada com sucesso!');
        res.redirect(`/turmas/${id_turma}`);
    } catch (err) {
        console.error('Erro ao criar atividade:', err);
        req.flash('error_msg', 'Erro ao criar atividade. Tente novamente.');
        if (arquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', arquivo));
        res.redirect('/atividades/nova');
    }
});

router.get('/:id', isAuthenticated, async (req, res) => {
    const atividadeId = req.params.id;
    try {
        const atividade = await dbGet(`
            SELECT a.*, t.nome AS nome_turma, u.nome AS nome_professor
            FROM Atividade a
            JOIN Turma t ON a.id_turma = t.id_turma
            JOIN Usuario u ON a.id_professor = u.id_usuario
            WHERE a.id_atividade = ?
        `, [atividadeId]);

        if (!atividade) {
            req.flash('error_msg', 'Atividade não encontrada.');
            return res.redirect('/atividades');
        }

        let hasAccess = false;
        let entregas = [];
        let minhaEntrega = null;

        if (req.user.tipo === 'professor') {
            const professorDaTurma = await dbGet("SELECT id_turma FROM Turma WHERE id_turma = ? AND id_professor = ?", [atividade.id_turma, req.user.id]);
            if (atividade.id_professor === req.user.id || professorDaTurma) {
                 hasAccess = true;
                 entregas = await dbAll(`
                    SELECT e.*, u.nome AS nome_aluno, u.email AS email_aluno
                    FROM Entrega e
                    JOIN Usuario u ON e.id_aluno = u.id_usuario
                    WHERE e.id_atividade = ?
                    ORDER BY e.data_entrega DESC
                `, [atividadeId]);
            }
        } else if (req.user.tipo === 'aluno') {
            const alunoNaTurma = await dbGet("SELECT id_aluno FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [req.user.id, atividade.id_turma]);
            if (alunoNaTurma) {
                hasAccess = true;
                minhaEntrega = await dbGet("SELECT * FROM Entrega WHERE id_aluno = ? AND id_atividade = ?", [req.user.id, atividadeId]);
            }
        }

        if (!hasAccess) {
            req.flash('error_msg', 'Você não tem permissão para visualizar esta atividade.');
            return res.redirect('/atividades');
        }
        
        res.render('atividades/ver', {
            title: atividade.titulo,
            atividade: atividade,
            entregas: entregas,
            minhaEntrega: minhaEntrega,
            user: req.user,
            messages: req.flash()
        });

    } catch (err) {
        console.error('Erro ao visualizar atividade:', err);
        req.flash('error_msg', 'Erro ao carregar detalhes da atividade.');
        res.redirect('/atividades');
    }
});

router.get('/:id/editar', isAuthenticated, isProfessor, async (req, res) => {
    const atividadeId = req.params.id;
    try {
        const atividade = await dbGet(`
            SELECT a.*, t.id_professor AS id_professor_turma
            FROM Atividade a
            JOIN Turma t ON a.id_turma = t.id_turma
            WHERE a.id_atividade = ? AND a.id_professor = ?
        `, [atividadeId, req.user.id]);

        if (!atividade) {
            req.flash('error_msg', 'Atividade não encontrada ou você não tem permissão para editá-la.');
            return res.redirect('/atividades');
        }
        const turmas = await dbAll("SELECT id_turma, nome, codigo FROM Turma WHERE id_professor = ?", [req.user.id]);

        res.render('atividades/editar', {
            title: `Editar Atividade: ${atividade.titulo}`,
            atividade: atividade,
            turmas: turmas,
            user: req.user,
            messages: req.flash()
        });
    } catch (err) {
        console.error('Erro ao carregar formulário de edição de atividade:', err);
        req.flash('error_msg', 'Erro ao carregar atividade para edição.');
        res.redirect('/atividades');
    }
});

router.put('/:id', isAuthenticated, isProfessor, upload.single('arquivo'), async (req, res) => {
    const atividadeId = req.params.id;
    const { titulo, descricao, data, hora, id_turma, arquivo_existente } = req.body; 
    const novoArquivo = req.file ? `/uploads/${req.file.filename}` : null;

    let arquivoFinal = novoArquivo;
    if (!novoArquivo && arquivo_existente) {
        arquivoFinal = arquivo_existente;
    } else if (novoArquivo && arquivo_existente) {
        const oldFilePath = path.join(__dirname, '..', 'public', arquivo_existente);
        if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
        }
    }

    if (!titulo || !descricao || !data || !id_turma) { 
        req.flash('error_msg', 'Título, Descrição, Data e Turma são obrigatórios.');
        if (novoArquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', novoArquivo));
        return res.redirect(`/atividades/${atividadeId}/editar`);
    }

    
    let prazoCompleto;
    if (hora) {
        prazoCompleto = `${data}T${hora}:00`; 
    } else {
        prazoCompleto = `${data}T23:59:59`;
    }

    const prazoDateObj = new Date(prazoCompleto);
    const now = new Date();

    
    if (prazoDateObj <= now) {
        req.flash('error_msg', 'O prazo de entrega deve ser uma data e hora futura.');
        if (novoArquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', novoArquivo));
        return res.redirect(`/atividades/${atividadeId}/editar`);
    }

    try {
        const atividadeExistente = await dbGet("SELECT id_professor FROM Atividade WHERE id_atividade = ?", [atividadeId]);
        if (!atividadeExistente || atividadeExistente.id_professor !== req.user.id) {
            req.flash('error_msg', 'Você não tem permissão para editar esta atividade.');
            if (novoArquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', novoArquivo));
            return res.redirect('/atividades');
        }

        const turmaDoProfessor = await dbGet("SELECT id_turma FROM Turma WHERE id_turma = ? AND id_professor = ?", [id_turma, req.user.id]);
        if (!turmaDoProfessor) {
            req.flash('error_msg', 'Você não tem permissão para associar atividades a esta turma.');
            if (novoArquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', novoArquivo));
            return res.redirect(`/atividades/${atividadeId}/editar`);
        }

        await dbRun("UPDATE Atividade SET titulo = ?, descricao = ?, prazo = ?, id_turma = ?, arquivo = ? WHERE id_atividade = ?",
            [titulo, descricao, prazoDateObj.toISOString(), id_turma, arquivoFinal, atividadeId]);

        req.flash('success_msg', 'Atividade atualizada com sucesso!');
        res.redirect(`/atividades/${atividadeId}`);
    } catch (err) {
        console.error('Erro ao atualizar atividade:', err);
        req.flash('error_msg', 'Erro ao atualizar atividade.');
        if (novoArquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', novoArquivo));
        res.redirect(`/atividades/${atividadeId}/editar`);
    }
});

router.delete('/:id', isAuthenticated, isProfessor, async (req, res) => {
    const atividadeId = req.params.id;
    try {
        const atividade = await dbGet("SELECT id_atividade, id_professor, arquivo FROM Atividade WHERE id_atividade = ?", [atividadeId]);

        if (!atividade) {
            req.flash('error_msg', 'Atividade não encontrada.');
            return res.redirect('/atividades');
        }

        if (atividade.id_professor === req.user.id) {
            await dbRun("DELETE FROM Atividade WHERE id_atividade = ?", [atividadeId]);

            if (atividade.arquivo) {
                const filePath = path.join(__dirname, '..', 'public', atividade.arquivo);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            req.flash('success_msg', 'Atividade excluída com sucesso!');
            return res.redirect('/atividades');
        } else {
            req.flash('error_msg', 'Você não tem permissão para excluir esta atividade.');
            return res.redirect('/atividades');
        }
    } catch (err) {
        console.error('Erro ao excluir atividade:', err);
        req.flash('error_msg', 'Erro ao excluir atividade.');
        res.redirect('/atividades');
    }
});

router.post('/:atividadeId/entregar', isAuthenticated, isAluno, upload.single('arquivo'), async (req, res) => {
    const atividadeId = req.params.atividadeId;
    const id_aluno = req.user.id;
    const { comentario } = req.body;
    const arquivo = req.file ? `/uploads/${req.file.filename}` : null;

    if (!arquivo) {
        req.flash('error_msg', 'É necessário enviar um arquivo para a entrega.');
        return res.redirect(`/atividades/${atividadeId}`);
    }

    try {
        const atividade = await dbGet("SELECT id_turma, prazo FROM Atividade WHERE id_atividade = ?", [atividadeId]);
        if (!atividade) {
            req.flash('error_msg', 'Atividade não encontrada.');
            if (arquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', arquivo));
            return res.redirect('/atividades');
        }
        const alunoNaTurma = await dbGet("SELECT id_aluno FROM Aluno_Turma WHERE id_aluno = ? AND id_turma = ?", [id_aluno, atividade.id_turma]);
        if (!alunoNaTurma) {
            req.flash('error_msg', 'Você não está matriculado na turma desta atividade.');
            if (arquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', arquivo));
            return res.redirect(`/atividades/${atividadeId}`);
        }

        let status = 'entregue';
        if (atividade.prazo && new Date() > new Date(atividade.prazo)) {
            status = 'atrasado';
        }

        const entregaExistente = await dbGet("SELECT id_entrega, arquivo FROM Entrega WHERE id_atividade = ? AND id_aluno = ?", [atividadeId, id_aluno]);

        if (entregaExistente) {
            await dbRun("UPDATE Entrega SET arquivo = ?, comentario = ?, data_entrega = CURRENT_TIMESTAMP, status = ? WHERE id_entrega = ?",
                [arquivo, comentario || null, status, entregaExistente.id_entrega]);
            if (entregaExistente.arquivo) {
                const oldFilePath = path.join(__dirname, '..', 'public', entregaExistente.arquivo);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            req.flash('success_msg', 'Entrega atualizada com sucesso!');
        } else {
            await dbRun("INSERT INTO Entrega (id_atividade, id_aluno, arquivo, comentario, status) VALUES (?, ?, ?, ?, ?)",
                [atividadeId, id_aluno, arquivo, comentario || null, status]);
            req.flash('success_msg', 'Entrega realizada com sucesso!');
        }

        res.redirect('/atividades'); 

    } catch (err) {
        console.error('Erro ao realizar/atualizar entrega:', err);
        req.flash('error_msg', 'Erro ao processar sua entrega.');
        if (arquivo) fs.unlinkSync(path.join(__dirname, '..', 'public', arquivo));
        res.redirect(`/atividades/${atividadeId}`);
    }
});

router.post('/entregas/:entregaId/avaliar', isAuthenticated, isProfessor, async (req, res) => {
    const { entregaId } = req.params;
    const { nota, comentario } = req.body;
    const id_professor = req.user.id;

    if (nota === undefined || nota === null || nota < 0 || nota > 100) {
        req.flash('error_msg', 'Nota inválida. Deve ser um número entre 0 e 100.');
        const entrega = await dbGet("SELECT id_atividade FROM Entrega WHERE id_entrega = ?", [entregaId]);
        return res.redirect(entrega ? `/atividades/${entrega.id_atividade}` : '/atividades');
    }

    try {
        const entregaDetalhes = await dbGet(`
            SELECT e.id_atividade, t.id_professor
            FROM Entrega e
            JOIN Atividade a ON e.id_atividade = a.id_atividade
            JOIN Turma t ON a.id_turma = t.id_turma
            WHERE e.id_entrega = ?
        `, [entregaId]);

        if (!entregaDetalhes) {
            req.flash('error_msg', 'Entrega não encontrada.');
            return res.redirect('/atividades');
        }
        if (entregaDetalhes.id_professor !== id_professor) {
            req.flash('error_msg', 'Você não tem permissão para avaliar esta entrega.');
            return res.redirect('/atividades');
        }

        await dbRun("UPDATE Entrega SET nota = ?, comentario = ?, status = 'avaliado' WHERE id_entrega = ?",
            [nota, comentario || null, entregaId]);

        req.flash('success_msg', 'Entrega avaliada com sucesso!');
        res.redirect(`/atividades/${entregaDetalhes.id_atividade}`);

    } catch (err) {
        console.error('Erro ao avaliar entrega:', err);
        req.flash('error_msg', 'Erro ao avaliar entrega.');
        const entrega = await dbGet("SELECT id_atividade FROM Entrega WHERE id_entrega = ?", [entregaId]);
        res.redirect(entrega ? `/atividades/${entrega.id_atividade}` : '/atividades');
    }
});

module.exports = router;
