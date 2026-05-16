const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();

// Oculta o header X-Powered-By para não expor informações do framework
app.disable('x-powered-by');

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
// VALIDADORES DE ENTRADA
// =====================
function validateUserInput(username, password) {
  const errors = [];
  if (!username || typeof username !== 'string' || username.trim() === '') {
    errors.push('O campo "usuário" não pode estar vazio.');
  } else {
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 50)
      errors.push('O usuário deve ter entre 3 e 50 caracteres.');
    if (!/^\w+$/.test(trimmed))
      errors.push('O usuário só pode conter letras, números e underscores.');
  }
  if (!password || typeof password !== 'string' || password.trim() === '') {
    errors.push('O campo "senha" não pode estar vazio.');
  } else if (password.length < 6) {
    errors.push('A senha deve ter no mínimo 6 caracteres.');
  }
  return errors;
}

function validateItemInput(name, price, category) {
  const errors = [];
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('O campo "nome" não pode estar vazio.');
  } else if (name.trim().length > 100) {
    errors.push('O nome deve ter no máximo 100 caracteres.');
  }
  const parsedPrice = parseFloat(price);
  if (price === undefined || price === null || price === '') {
    errors.push('O campo "preço" é obrigatório.');
  } else if (isNaN(parsedPrice)) {
    errors.push('O campo "preço" deve ser um número válido.');
  } else if (parsedPrice <= 0) {
    errors.push('O preço deve ser um número positivo (maior que zero).');
  }
  if (category !== undefined && category !== null && category !== '') {
    if (typeof category !== 'string' || category.trim().length > 50)
      errors.push('A categoria deve ter no máximo 50 caracteres.');
  }
  return errors;
}

function validateOrderInput(customer_name, item_id, quantity) {
  const errors = [];
  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim() === '') {
    errors.push('O campo "nome do cliente" não pode estar vazio.');
  } else if (customer_name.trim().length > 100) {
    errors.push('O nome do cliente deve ter no máximo 100 caracteres.');
  }
  const parsedItemId = parseInt(item_id, 10);
  if (!item_id || isNaN(parsedItemId) || parsedItemId <= 0) {
    errors.push('Selecione uma marmita válida.');
  }
  const parsedQty = parseInt(quantity, 10);
  if (!quantity || isNaN(parsedQty) || parsedQty <= 0) {
    errors.push('A quantidade deve ser um número inteiro positivo.');
  } else if (parsedQty > 99) {
    errors.push('A quantidade máxima por pedido é 99.');
  }
  return errors;
}

function sendValidationError(res, errors) {
  return res.status(400).json({ error: 'Dados inválidos', details: errors });
}

// =====================
// CONEXÃO COM MYSQL
// =====================
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'marmitadb'
});

connection.connect((err) => {
  if (err) { console.error('Erro ao conectar:', err); return; }
  console.log('Conectado ao MySQL');
});

app.set('view engine', 'ejs');

// =====================
// PÁGINA INICIAL → tela de login
// =====================
app.get('/', (req, res) => {
  res.render('login', { error: null, success: null });
});

// =====================
// DASHBOARD — lista pedidos em tempo real
// =====================
app.get('/dashboard', (req, res) => {
  const sql = `
    SELECT o.id, o.customer_name, i.name AS item_name, i.category,
           o.quantity, o.total, o.status, o.created_at
    FROM orders o
    JOIN items i ON o.item_id = i.id
    ORDER BY o.created_at DESC
  `;
  connection.query(sql, (err, orders) => {
    if (err) { console.error(err); return res.status(500).send('Erro ao carregar dashboard.'); }
    res.render('dashboard', { orders });
  });
});

// =====================
// FORMULÁRIO CADASTRO
// =====================
app.get('/register', (req, res) => {
  res.render('register', { error: null, success: null });
});

// =====================
// CADASTRAR USUÁRIO
// =====================
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const errors = validateUserInput(username, password);
  if (errors.length > 0)
    return res.render('register', { error: errors[0], success: null });
  const stored = hashPassword(password);
  const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
  connection.query(sql, [username.trim(), stored], (err) => {
    if (err) {
      const msg = err.code === 'ER_DUP_ENTRY' ? 'Usuário já existe.' : 'Erro interno ao cadastrar usuário.';
      return res.render('register', { error: msg, success: null });
    }
    res.render('login', { error: null, success: 'Conta criada com sucesso! Faça login para continuar.' });
  });
});

// =====================
// FORMULÁRIO LOGIN
// =====================
app.get('/login', (req, res) => {
  res.render('login', { error: null, success: null });
});

// =====================
// LOGIN
// =====================
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const errors = validateUserInput(username, password);
  if (errors.length > 0) return sendValidationError(res, errors);
  const sql = 'SELECT * FROM users WHERE username = ?';
  connection.query(sql, [username.trim()], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro interno no servidor.' });
    if (results.length === 0) return res.render('login', { error: 'Usuário não encontrado.', success: null });
    const user = results[0];
    if (verifyPassword(password, user.password)) {
      res.redirect('/dashboard');
    } else {
      return res.render('login', { error: 'Senha incorreta.', success: null });
    }
  });
});

// =====================
// LISTAR MARMITAS
// =====================
app.get('/items', (req, res) => {
  connection.query('SELECT * FROM items', (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro interno ao buscar itens.' });
    res.json(results);
  });
});

// =====================
// CADASTRAR MARMITA
// =====================
app.post('/items', (req, res) => {
  const { name, price, category } = req.body;
  const errors = validateItemInput(name, price, category);
  if (errors.length > 0) return sendValidationError(res, errors);
  const parsedPrice = parseFloat(price);
  const categoryValue = category ? category.trim() : null;
  const sql = 'INSERT INTO items (name, price, category) VALUES (?, ?, ?)';
  connection.query(sql, [name.trim(), parsedPrice, categoryValue], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro interno ao cadastrar item.' });
    res.status(201).json({ message: 'Marmita cadastrada.', id: result.insertId, name: name.trim(), price: parsedPrice, category: categoryValue });
  });
});

// =====================
// ATUALIZAR MARMITA
// =====================
app.put('/items/:id', (req, res) => {
  const parsedId = parseInt(req.params.id, 10);
  if (isNaN(parsedId) || parsedId <= 0)
    return sendValidationError(res, ['O parâmetro "id" deve ser um número inteiro positivo.']);
  const { name, price, category } = req.body;
  const errors = validateItemInput(name, price, category);
  if (errors.length > 0) return sendValidationError(res, errors);
  const parsedPrice = parseFloat(price);
  const categoryValue = category ? category.trim() : null;
  const sql = 'UPDATE items SET name = ?, price = ?, category = ? WHERE id = ?';
  connection.query(sql, [name.trim(), parsedPrice, categoryValue, parsedId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro interno ao atualizar item.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item não encontrado.' });
    res.json({ message: 'Marmita atualizada com sucesso.' });
  });
});

// =====================
// DELETAR MARMITA
// =====================
app.delete('/items/:id', (req, res) => {
  const parsedId = parseInt(req.params.id, 10);
  if (isNaN(parsedId) || parsedId <= 0)
    return sendValidationError(res, ['O parâmetro "id" deve ser um número inteiro positivo.']);
  connection.query('DELETE FROM items WHERE id = ?', [parsedId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro interno ao deletar item.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item não encontrado.' });
    res.json({ message: 'Marmita deletada com sucesso.' });
  });
});

// =====================
// INTERFACE: NOVO PEDIDO
// =====================
app.get('/orders/new', (req, res) => {
  connection.query('SELECT * FROM items ORDER BY category, name', (err, items) => {
    if (err) return res.status(500).send('Erro ao carregar marmitas.');
    res.render('orders', { items, error: null, success: null });
  });
});

// =====================
// POST /orders — CRIAR PEDIDO
// =====================
app.post('/orders', (req, res) => {
  const { customer_name, item_id, quantity } = req.body;

  const errors = validateOrderInput(customer_name, item_id, quantity);
  if (errors.length > 0) return sendValidationError(res, errors);

  const parsedItemId = parseInt(item_id, 10);
  const parsedQty   = parseInt(quantity, 10);

  // Busca o preço atual do item para calcular o total
  connection.query('SELECT * FROM items WHERE id = ?', [parsedItemId], (err, items) => {
    if (err || items.length === 0)
      return res.status(404).json({ error: 'Marmita não encontrada.' });

    const item  = items[0];
    const total = (item.price * parsedQty).toFixed(2);

    const sql = `
      INSERT INTO orders (customer_name, item_id, quantity, total, status)
      VALUES (?, ?, ?, ?, 'Aberto')
    `;
    connection.query(sql, [customer_name.trim(), parsedItemId, parsedQty, total], (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao registrar pedido.' });

      // Aceita JSON (API) ou redirect (formulário web)
      if (req.headers['content-type']?.includes('application/json')) {
        return res.status(201).json({
          message: 'Pedido registrado com sucesso.',
          id: result.insertId,
          customer_name: customer_name.trim(),
          item: item.name,
          quantity: parsedQty,
          total: parseFloat(total),
          status: 'Aberto'
        });
      }
      res.redirect('/dashboard');
    });
  });
});

// =====================
// GET /orders — LISTAR PEDIDOS (JSON)
// =====================
app.get('/orders', (req, res) => {
  const sql = `
    SELECT o.id, o.customer_name, i.name AS item_name, i.category,
           o.quantity, o.total, o.status, o.created_at
    FROM orders o
    JOIN items i ON o.item_id = i.id
    ORDER BY o.created_at DESC
  `;
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar pedidos.' });
    res.json(results);
  });
});

// =====================
// PATCH /orders/:id/status — ATUALIZAR STATUS
// =====================
app.patch('/orders/:id/status', (req, res) => {
  const parsedId = parseInt(req.params.id, 10);
  if (isNaN(parsedId) || parsedId <= 0)
    return sendValidationError(res, ['ID inválido.']);

  const { status } = req.body;
  const validStatuses = ['Aberto', 'Em preparo', 'Saiu para entrega', 'Entregue', 'Cancelado'];
  if (!status || !validStatuses.includes(status))
    return res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(', ')}` });

  connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, parsedId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar status.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json({ message: 'Status atualizado.', id: parsedId, status });
  });
});

// =====================
// GET /admin — PAINEL KANBAN
// =====================
app.get('/admin', (req, res) => {
  res.render('admin');
});

// =====================
// GET /admin/export — EXPORTAR CSV
// =====================
app.get('/admin/export', (req, res) => {
  const sql = `
    SELECT
      o.id                                    AS 'ID Pedido',
      o.customer_name                         AS 'Cliente',
      i.name                                  AS 'Marmita',
      i.category                              AS 'Categoria',
      o.quantity                              AS 'Quantidade',
      o.total                                 AS 'Total (R$)',
      o.status                                AS 'Status',
      DATE_FORMAT(o.created_at, '%d/%m/%Y')   AS 'Data',
      DATE_FORMAT(o.created_at, '%H:%i')      AS 'Hora'
    FROM orders o
    JOIN items i ON o.item_id = i.id
    ORDER BY o.created_at DESC
  `;

  connection.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao gerar relatório.' });

    if (rows.length === 0)
      return res.status(404).json({ error: 'Nenhum pedido encontrado para exportar.' });

    // BOM UTF-8 garante que o Excel abra acentos corretamente
    const BOM = '\uFEFF';
    const headers = Object.keys(rows[0]).join(';');

    const csvRows = rows.map(row =>
      Object.values(row).map(val => {
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(';') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(';')
    );

    const csv = BOM + headers + '\n' + csvRows.join('\n');
    const filename = `jenrique_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });
});

// =====================
// SERVIDOR
// =====================
app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor rodando em http://localhost:3000');
});
