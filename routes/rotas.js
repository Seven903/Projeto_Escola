const exoress = require("express");
const rota = exoress.Router();

rota.get("/", (req, res) => {
  res.render("index.ejs");
});

rota.get("/turmas",(req,res)=>{
    res.render("turmas/index.ejs")
})

rota.get("/professores",(req,res)=>{
    res.render("professores/index.ejs")
})

rota.get("/atividades/nova",(req,res)=>{
    res.render("atividades/nova.ejs")
})

rota.get("/alunos",(req,res)=>{
    res.render("alunos/index.ejs")
})


rota.get("/alunos/:id/editar",(req,res)=>{
    res.render("alunos/editar.ejs")
})


rota.get("/alunos/novo",(req,res)=>{
    res.render("alunos/novo.ejs")
})
module.exports = rota;