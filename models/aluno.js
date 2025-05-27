const Usuario = require("./Usuario");

class Aluno extends Usuario {
  constructor(id, nome, email, senha, idade, turmaId) {
    super(id, nome, email, senha, "aluno");
    this.idade = idade;
    this.turmaId = turmaId;
  }

}

module.exports = Aluno;
