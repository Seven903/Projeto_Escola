require('dotenv').config(); 
const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');  

const db = require("./db/db");  

 
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const turmaRoutes = require('./routes/turmaRoutes');
const atividadesRoutes = require('./routes/atividadesRoutes');

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
    secret: process.env.SESSION_SECRET || 'umaChaveSecretaPadraoParaSessao', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }  
}));
app.use(flash()); 

 
const { verifyTokenAndSetUser } = require('./middlewares/authMiddleware');
app.use(verifyTokenAndSetUser); 

 
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error'); 
    res.locals.user = req.user || null;  
    next();
});

 
app.use('/', indexRoutes); 
app.use('/auth', authRoutes); 
app.use('/turmas', turmaRoutes); 
app.use('/atividades', atividadesRoutes); 

 
app.use((req, res, next) => {
    console.warn(`404 - Rota não encontrada: ${req.method} ${req.originalUrl}`);  
    res.status(404).render('error', { 
        title: 'Página Não Encontrada',
        message: 'A página que você está procurando não existe.',
        user: req.user || null, 
        messages: req.flash() 
    });
});

 
app.use((err, req, res, next) => {
    console.error("Erro Não Tratado:", err.stack);  

     
    if (res.headersSent) {
        return next(err);
    }

    res.status(500).render('error', { 
        title: 'Erro no Servidor',
        message: 'Ocorreu um erro inesperado no servidor. Tente novamente mais tarde.',
        error: process.env.NODE_ENV === 'development' ? err : {},  
        user: req.user || null, 
        messages: req.flash() 
    });
});

 
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}.`);
});
