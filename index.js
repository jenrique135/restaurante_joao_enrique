const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const crypto = require('crypto'); // nativo do Node.js, sem instalação

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// =====================
// FUNÇÕES DE HASH (crypto nativo)
// =====================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashVerify = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return hashVerify === hash;
}

// =====================
// CONEXÃO COM MYSQL (DOCKER)
// =====================
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'marmitadb'
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
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  const stored = hashPassword(password);

  const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';

  connection.query(sql, [username, stored], (err) => {
    if (err) {
      console.error(err);
      return res.send('Erro ao cadastrar');
    }

    res.send(`
      <h2>Usuário cadastrado com sucesso ✅</h2>
      <a href="/login">Ir para login</a>
    `);
  });
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

    if (verifyPassword(password, user.password)) {
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

// =====================
// SERVIDOR
// =====================
app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor rodando em http://localhost:3000');
});
