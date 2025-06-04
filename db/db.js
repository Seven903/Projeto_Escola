const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db/banco.db", (err) => {
  if (err) {
    console.error("Erro ao abrir o banco de dados:", err.message);
  } else {
    console.log("Conectado ao banco de dados SQLite.");
    db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
      if (pragmaErr) {
        console.error("Erro ao ativar PRAGMA foreign_keys:", pragmaErr.message);
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
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('aluno', 'professor', 'administrador'))
);`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Usuario:", err.message);
    }
  );

  db.run(
    `
    CREATE TABLE IF NOT EXISTS Professor (
    id_usuario INTEGER PRIMARY KEY,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
);
    `,
    (err) => {
      if (err) console.error("Erro ao criar tabela Professor:", err.message);
    }
  );
  db.run(
    `
   CREATE TABLE IF NOT EXISTS Aluno (
    id_usuario INTEGER PRIMARY KEY,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
);

    `,
    (err) => {
      if (err) console.error("Erro ao criar tabela Aluno:", err.message);
    }
  );
  db.run(
    `
   CREATE TABLE IF NOT EXISTS Turma (
    id_turma INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    codigo VARCHAR(20) UNIQUE,
    id_professor INTEGER,
    FOREIGN KEY (id_professor) REFERENCES Professor(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
); `,
    (err) => {
      if (err) console.error("Erro ao criar tabela Turma:", err.message);
    }
  );
  db.run(
    `
   CREATE TABLE IF NOT EXISTS Atividade (
    id_atividade INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    prazo DATETIME,
    id_turma INTEGER NOT NULL,
    arquivo VARCHAR(500),
    FOREIGN KEY (id_turma) REFERENCES Turma(id_turma) ON DELETE CASCADE ON UPDATE CASCADE
);
`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Atividade:", err.message);
    }
  );
  db.run(
    `
   CREATE TABLE IF NOT EXISTS Aluno_Turma (
    id_aluno_turma INTEGER PRIMARY KEY AUTOINCREMENT,
    id_aluno INTEGER NOT NULL,
    id_turma INTEGER NOT NULL,
    data_inscricao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_aluno) REFERENCES Aluno(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES Turma(id_turma) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (id_aluno, id_turma)
);
`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Aluno_Turma:", err.message);
    }
  );
  db.run(
    `
   CREATE TABLE IF NOT EXISTS Entrega (
    id_entrega INTEGER PRIMARY KEY AUTOINCREMENT,
    id_atividade INTEGER NOT NULL,
    id_aluno INTEGER NOT NULL,
    data_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,
    arquivo VARCHAR(500),
    nota DECIMAL(5,2),
    comentario TEXT,
    status VARCHAR(50) DEFAULT 'entregue' CHECK (status IN ('entregue', 'atrasado', 'avaliado', 'pendente')),
    FOREIGN KEY (id_atividade) REFERENCES Atividade(id_atividade) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_aluno) REFERENCES Aluno(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (id_atividade, id_aluno)
);
`,
    (err) => {
      if (err) console.error("Erro ao criar tabela Entrega:", err.message);
    }
  );
  db.run(
    `
  CREATE TABLE IF NOT EXISTS Media_Aluno_Turma (
    id_media INTEGER PRIMARY KEY AUTOINCREMENT,
    id_aluno INTEGER NOT NULL,
    id_turma INTEGER NOT NULL,
    media_final DECIMAL(5,2),
    FOREIGN KEY (id_aluno) REFERENCES Aluno(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES Turma(id_turma) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (id_aluno, id_turma)
);`,
    (err) => {
      if (err)
        console.error("Erro ao criar tabela Media_Aluno_Turma:", err.message);
      else console.log("Tabelas criadas/verificadas com sucesso.");
    }
  );
});

module.exports = db;