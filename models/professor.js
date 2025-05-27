const Usuario = require("./Usuario");

class Professor extends Usuario {
  constructor(id, nome, email, senha, disciplina) {
    super(id, nome, email, senha, "professor");
    this.disciplina = disciplina;
  }

 
}

module.exports = Professor;
