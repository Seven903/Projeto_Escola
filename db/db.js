const sqlite3 = require("sqlite3").verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'banco.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao abrir o banco de dados:", err.message);
  } else {
    console.log("Conectado ao banco de dados SQLite.");
    db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
      if (pragmaErr) {
        console.error("Erro ao ativar PRAGMA foreign_keys:", pragmaErr.message);
      } else {
        console.log("PRAGMA foreign_keys ativado.");
      }
    });
  }
});

db.serialize(() => {
   
  db.run(
    `
    CREATE TABLE IF NOT EXISTS Usuario (
        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('aluno', 'professor'))
    );`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Usuario:", err.message);
    }
  );

   
  db.run(
    `
    CREATE TABLE IF NOT EXISTS Turma (
        id_turma INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(255) NOT NULL,
        codigo VARCHAR(100) NOT NULL UNIQUE, -- Código para alunos se inscreverem
        descricao TEXT,
        id_professor INTEGER NOT NULL, -- Referencia diretamente a Usuario.id_usuario
        FOREIGN KEY (id_professor) REFERENCES Usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Turma:", err.message);
    }
  );

   
  db.run(
    `
    CREATE TABLE IF NOT EXISTS Aluno_Turma (
        id_aluno INTEGER NOT NULL,
        id_turma INTEGER NOT NULL,
        PRIMARY KEY (id_aluno, id_turma),
        FOREIGN KEY (id_aluno) REFERENCES Usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (id_turma) REFERENCES Turma(id_turma) ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Aluno_Turma:", err.message);
    }
  );

  
  db.run(
    `
    CREATE TABLE IF NOT EXISTS Atividade (
        id_atividade INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT NOT NULL,
        prazo DATETIME NOT NULL,
        id_turma INTEGER NOT NULL,
        id_professor INTEGER NOT NULL, -- COLUNA CORRIGIDA AQUI
        arquivo VARCHAR(500), -- Caminho para o arquivo anexo da atividade
        FOREIGN KEY (id_turma) REFERENCES Turma(id_turma) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (id_professor) REFERENCES Usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE -- Chave estrangeira para Usuario
    );`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Atividade:", err.message);
    }
  );

   
  db.run(
    `
    CREATE TABLE IF NOT EXISTS Entrega (
        id_entrega INTEGER PRIMARY KEY AUTOINCREMENT,
        id_atividade INTEGER NOT NULL,
        id_aluno INTEGER NOT NULL,
        data_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,
        arquivo VARCHAR(500), -- Caminho para o arquivo de entrega do aluno
        nota DECIMAL(5,2), -- Nota atribuída pelo professor (0-100)
        comentario TEXT, -- Comentário do professor
        status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'entregue', 'atrasado', 'avaliado')),
        FOREIGN KEY (id_atividade) REFERENCES Atividade(id_atividade) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (id_aluno) REFERENCES Usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE -- Chave estrangeira para Usuario
    );`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Entrega:", err.message);
    }
  );

  console.log("Tabelas criadas/verificadas com sucesso.");
});

module.exports = db;
