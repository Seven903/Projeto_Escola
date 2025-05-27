const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const expressLayouts = require("express-ejs-layouts");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const rota = require("./routes/rotas.js");

const app = express();
app.use(cors());
app.use(expressLayouts);
app.set("layout", "partials/layout");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/", rota);



app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
