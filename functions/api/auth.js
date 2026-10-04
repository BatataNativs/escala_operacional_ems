// Endpoint da API Cloudflare Pages Functions para Autenticação e Usuários
// Rota: /api/auth

async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password + ':escala_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Retorna a lista de operadores cadastrados no sistema
    const { results: users } = await db
      .prepare('SELECT id, username, name, role, created_at FROM users ORDER BY name ASC')
      .all();

    return new Response(JSON.stringify({
      success: true,
      users: users || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const action = body.action || 'login';

    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) {
        return new Response(JSON.stringify({ success: false, error: 'Informe usuário e senha' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const inputHash = await hashPassword(password);
      const user = await db
        .prepare('SELECT id, username, name, role FROM users WHERE username = ? AND password_hash = ?')
        .bind(username.trim().toLowerCase(), inputHash)
        .first();

      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Usuário ou senha incorretos' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Sessão / Token simples retornado ao cliente
      const sessionData = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        timestamp: Date.now()
      };

      return new Response(JSON.stringify({
        success: true,
        message: 'Login realizado com sucesso',
        user: sessionData
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } else if (action === 'register') {
      const { username, password, name, role } = body;
      if (!username || !password || !name) {
        return new Response(JSON.stringify({ success: false, error: 'Preencha todos os campos obrigatórios' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const cleanUsername = username.trim().toLowerCase();
      const existing = await db
        .prepare('SELECT id FROM users WHERE username = ?')
        .bind(cleanUsername)
        .first();

      if (existing) {
        return new Response(JSON.stringify({ success: false, error: 'Este nome de usuário já está em uso' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const passHash = await hashPassword(password);
      await db
        .prepare('INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)')
        .bind(cleanUsername, passHash, name.trim(), role || 'operator')
        .run();

      const newUser = await db
        .prepare('SELECT id, username, name, role FROM users WHERE username = ?')
        .bind(cleanUsername)
        .first();

      return new Response(JSON.stringify({
        success: true,
        message: 'Operador cadastrado com sucesso!',
        user: {
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          role: newUser.role,
          timestamp: Date.now()
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação não suportada' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Erro no servidor de autenticação'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
