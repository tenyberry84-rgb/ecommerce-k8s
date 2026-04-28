const express = require('express');
const mysql = require('mysql2/promise');
const redis = require('redis');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

let db, redisClient;
const JWT_SECRET = process.env.JWT_SECRET;

async function init() {
  redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
  });
  redisClient.on('error', err => console.log('Redis error:', err.message));
  await redisClient.connect();
  console.log('Redis connected');

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
        CREATE TABLE IF NOT EXISTS products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          stock INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Product DB ready');
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

app.get('/products', async (req, res) => {
  try {
    const cached = await redisClient.get('all_products');
    if (cached) {
      return res.json({ source: 'cache (Redis)', data: JSON.parse(cached) });
    }
    const [rows] = await db.execute('SELECT * FROM products ORDER BY created_at DESC');
    await redisClient.setEx('all_products', 60, JSON.stringify(rows));
    res.json({ source: 'database (MySQL)', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/products', verifyToken, async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    const [result] = await db.execute(
      'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',
      [name, price, stock || 0]
    );
    await redisClient.del('all_products');
    res.json({ id: result.insertId, name, price, stock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/products/:id', verifyToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    await redisClient.del('all_products');
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'product', version: '2.0' }));

init().then(() => app.listen(3002, () => console.log('Product service running on port 3002')));
