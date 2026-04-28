const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

let db;
const JWT_SECRET = process.env.JWT_SECRET;

async function init() {
  while (true) {
    try {
      db = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      });
      await db.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Order DB ready');
      break;
    } catch (err) {
      console.log('DB not ready, retrying...', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/orders', verifyToken, async (req, res) => {
  try {
    const { product_id, quantity, total_price } = req.body;
    const [result] = await db.execute(
      'INSERT INTO orders (user_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)',
      [req.user.id, product_id, quantity, total_price]
    );
    res.json({ id: result.insertId, product_id, quantity, total_price, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/orders', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order' }));

init().then(() => app.listen(3003, () => console.log('Order service running on port 3003')));
