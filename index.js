const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
const saltRounds = 10;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// =====================
// CONEXÃO COM MYSQL (DOCKER)
// =====================
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3307,
  user: 'user',
  password: 'password',
  database: 'marmitadb'
});

connection.connect((err) => {
  if (err) {
    console.error('Erro ao conectar:', err);
    return;
  }
  console.log('Conectado ao MySQL');
});

app.set('view engine', 'ejs');

// =====================
// PÁGINA INICIAL
// =====================
app.get('/', (req, res) => {
    res.render('login');
});

// =====================
// FORMULÁRIO CADASTRO
// =====================
app.get('/register', (req, res) => {
  res.send(`
    <h2>Cadastro</h2>
    <form method="POST" action="/register">
      <input name="username" placeholder="Usuário" required /><br><br>
      <input name="password" type="password" placeholder="Senha" required /><br><br>
      <button type="submit">Cadastrar</button>
    </form>
    <br>
    <a href="/">Voltar</a>
  `);
});

// =====================
// CADASTRAR USUÁRIO
// =====================
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const hash = await bcrypt.hash(password, saltRounds);

    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';

    connection.query(sql, [username, hash], (err) => {
      if (err) {
        console.error(err);
        return res.send('Erro ao cadastrar');
      }

      res.send(`
        <h2>Usuário cadastrado com sucesso ✅</h2>
        <a href="/login">Ir para login</a>
      `);
    });
  } catch (err) {
    console.error(err);
    res.send('Erro interno');
  }
});

// =====================
// FORMULÁRIO LOGIN
// =====================
app.get('/login', (req, res) => {
  res.send(`
    <h2>Login</h2>
    <form method="POST" action="/login">
      <input name="username" placeholder="Usuário" required /><br><br>
      <input name="password" type="password" placeholder="Senha" required /><br><br>
      <button type="submit">Entrar</button>
    </form>
    <br>
    <a href="/">Voltar</a>
  `);
});

// =====================
// LOGIN
// =====================
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const sql = 'SELECT * FROM users WHERE username = ?';

  connection.query(sql, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.send('Erro no servidor');
    }

    if (results.length === 0) {
      return res.send('Usuário não encontrado');
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        console.error(err);
        return res.send('Erro interno');
      }

      if (result) {
        res.send(`
          <h2>Login realizado com sucesso 🎉</h2>
          <p>Bem-vindo, ${user.username}</p>
          <a href="/">Voltar</a>
        `);
      } else {
        res.send('Senha incorreta');
      }
    });
  });
});

// =====================
// SERVIDOR
// =====================
app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor rodando em http://localhost:3000');
});
