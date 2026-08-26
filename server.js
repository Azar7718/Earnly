const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname, 'data.json');

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(
    DATA,
    JSON.stringify({
      users: [
        {
          id: 'u1',
          name: 'Demo User',
          email: 'demo@earnly.test',
          password: 'demo123',
          balance: 0
        }
      ],
      tasks: [
        {
          id: 't1',
          title: 'Product feedback',
          description: 'Share genuine feedback on a product experience.',
          reward: 25
        },
        {
          id: 't2',
          title: 'Content review',
          description: 'Review a short piece of content.',
          reward: 15
        },
        {
          id: 't3',
          title: 'Survey',
          description: 'Complete a clearly disclosed survey.',
          reward: 30
        }
      ],
      withdrawals: []
    }, null, 2)
  );
}

const read = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));

const write = (data) => {
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
};

const sessions = new Map();

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });

  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let b = '';

    req.on('data', (x) => {
      b += x;
    });

    req.on('end', () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function auth(req) {
  const token = (req.headers.authorization || '')
    .replace('Bearer ', '');

  return sessions.get(token || '');
}

const server = http.createServer(async (req, res) => {

  if (
    req.method === 'GET' &&
    (req.url === '/' || req.url === '/index.html')
  ) {
    const indexPath = path.join(__dirname, 'public', 'index.html');

    if (!fs.existsSync(indexPath)) {
      return send(res, 404, {
        error: 'index.html not found'
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
    });

    return res.end(fs.readFileSync(indexPath));
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });

    return res.end();
  }

  try {

    if (req.url === '/api/register' && req.method === 'POST') {
      const b = await body(req);
      const d = read();

      if (!b.email || !b.password || !b.name) {
        return send(res, 400, {
          error: 'Name, email and password are required'
        });
      }

      if (d.users.some((u) => u.email === b.email)) {
        return send(res, 409, {
          error: 'Email already registered'
        });
      }

      const u = {
        id: crypto.randomUUID(),
        name: b.name,
        email: b.email,
        password: b.password,
        balance: 0
      };

      d.users.push(u);
      write(d);

      const token = crypto.randomUUID();
      sessions.set(token, u.id);

      return send(res, 200, {
        token,
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          balance: 0
        }
      });
    }

    if (req.url === '/api/login' && req.method === 'POST') {
      const b = await body(req);
      const d = read();

      const u = d.users.find(
        (x) => x.email === b.email && x.password === b.password
      );

      if (!u) {
        return send(res, 401, {
          error: 'Invalid login'
        });
      }

      const token = crypto.randomUUID();
      sessions.set(token, u.id);

      return send(res, 200, {
        token,
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          balance: u.balance
        }
      });
    }

    const uid = auth(req);

    if (!uid) {
      return send(res, 401, {
        error: 'Login required'
      });
    }

    const d = read();
    const u = d.users.find((x) => x.id === uid);

    if (!u) {
      return send(res, 401, {
        error: 'User not found'
      });
    }

    if (req.url === '/api/me') {
      return send(res, 200, {
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          balance: u.balance
        }
      });
    }

    if (req.url === '/api/tasks') { 
