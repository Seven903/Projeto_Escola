require('dotenv').config(); 
const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');

const db = require("./db/db") 

// Importar rotas
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
//const alunoRoutes = require('./routes/alunoRoutes');
//const professorRoutes = require('./routes/professorRoutes');
const turmaRoutes = require('./routes/turmaRoutes');
//const atividadeRoutes = require('./routes/atividadeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(expressLayouts);
app.set("layout", "partials/layout"); 
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, "public"))); 
app.use(cookieParser()); 


app.use(session({
  secret: process.env.SESSION_SECRET || 'umaChaveSecretaParaSessao', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));
app.use(flash());


app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error'); 
  res.locals.currentUser = req.user; 
  next();
});


const { verifyTokenAndSetUser } = require('./middlewares/authMiddleware');
app.use(verifyTokenAndSetUser);


// Usar Rotas
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
//app.use('/alunos', alunoRoutes); 
//app.use('/professores', professorRoutes); 
app.use('/turmas', turmaRoutes);
//app.use('/atividades', atividadeRoutes);



app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err.stack);
  res.status(500).render('error', { 
    title: 'Erro no Servidor',
    message: 'Ocorreu um erro inesperado no servidor.',
    error: process.env.NODE_ENV === 'development' ? err : {} 
  });
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}. Conectado ao banco: ${db.filename}`);
});