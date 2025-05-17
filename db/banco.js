const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("banco.db");

db.run(`
  CREATE TABLE estudante(
    matr INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    idade INTEGER);
`);
