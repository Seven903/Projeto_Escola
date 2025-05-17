const sqlite3 = require('sqlite3').verbose()


function executarComando(comando){
    const db = new sqlite3.Database('banco.db')
    db.run(comando)
    db.close();
}


module.exports = {executarComando}