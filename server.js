const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname, 'data.json');

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(
    DATA,
    JSON.stringify(
      {
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
      },
      null,
      2
    )
  );
}

const read = () => {
  return JSON.parse(fs.readFileSync(DATA, 'utf8'));
};

const write = (data) => {
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
};

const sessions = new Map();

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });

  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let b = '';

    req.on('data', (chunk) => {
      b += chunk;
    });

    req.on('end', () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function auth(req) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');

  return sessions.get(token) || null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });

    return res.end();
  }

  try {
    if (req.url === '/api/register' && req.method === 'POST') {
      const b = await body(req);
      const d = read();

      if (!b.name || !b.email || !b.password) {
        return send(res, 400, {
          error: 'Name, email and password are required'
        });
      }

      const email = String(b.email).trim().toLowerCase();

      if (d.users.some((u) => u.email === email)) {
        return send(res, 409, {
          error: 'Email already registered'
        });
      }

      const user = {
        id: crypto.randomUUID(),
        name: String(b.name).trim(),
        email,
        password: String(b.password),
        balance: 0
      };

      d.users.push(user);
      write(d);

      const token = crypto.randomUUID();
      sessions.set(token, user.id);

      return send(res, 200, {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          balance: user.balance
        }
      });
    }

    if (req.url === '/api/login' && req.method === 'POST') {
      const b = await body(req);
      const d = read();

      const email = String(b.email || '').trim().toLowerCase();
      const password = String(b.password || '');

      const user = d.users.find(
        (u) => u.email === email && u.password === password
      );

      if (!user) {
        return send(res, 401, {
          error: 'Invalid login'
        });
      }

      const token = crypto.randomUUID();
      sessions.set(token, user.id);

      return send(res, 200, {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          balance: user.balance
        }
      });
    }

    const userId = auth(req);

    if (!userId) {
      return send(res, 401, {
        error: 'Login required'
      });
    }

    const d = read();
    const user = d.users.find((u) => u.id === userId);

    if (!user) {
      return send(res, 401, {
        error: 'User not found'
      });
    }

    if (req.url === '/api/me' && req.method === 'GET') {
      return send(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          balance: user.balance
        }
      });
    }

    if (req.url === '/api/tasks' && req.method === 'GET') {
      return send(res, 200, {
        tasks: d.tasks
      });
    }

    if (
      req.url.startsWith('/api/tasks/') &&
      req.method === 'POST'
    ) {
      const taskId = req.url.split('/').pop();
      const task = d.tasks.find((t) => t.id === taskId);

      if (!task) {
        return send(res, 404, {
          error: 'Task not found'
        });
      }

      user.balance += Number(task.reward);
      write(d);

      return send(res, 200, {
        ok: true,
        reward: task.reward,
        balance: user.balance
      });
    }

    if (req.url === '/api/withdraw' && req.method === 'POST') {
      const b = await body(req);
      const amount = Number(b.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > user.balance
      ) {
        return send(res, 400, {
          error: 'Invalid amount'
        });
      }

      d.withdrawals.push({
        id: crypto.randomUUID(),
        userId: user.id,
        amount,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      write(d);

      return send(res, 200, {
        ok: true,
        message: 'Withdrawal request submitted for manual review.'
      });
    }

    return send(res, 404, {
      error: 'Not found'
    });

  } catch (error) {
    console.error(error);

    return send(res, 500, {
      error: 'Server error'
    });
  }
});

server.listen(
  process.env.PORT || 3000,
  '0.0.0.0',
  () => {
    console.log('Earnly server running');
  }
);
