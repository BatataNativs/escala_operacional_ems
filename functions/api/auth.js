// Endpoint da API Cloudflare Pages Functions para Autenticação e Usuários
// Rota: /api/auth

// Segredo para assinatura de tokens deve ser fornecido via variável de ambiente AUTH_SECRET no Cloudflare
export function getAuthSecret(env) {
  const secret = env && env.AUTH_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('Configuração pendente: a variável AUTH_SECRET precisa ser configurada nas variáveis de ambiente do Cloudflare Pages.');
  }
  return secret.trim();
}

// Extrai token Bearer de forma segura e insensível a maiúsculas/minúsculas
export function extractBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Memória temporária de instâncias para mitigação de força bruta simples
const loginAttempts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 15 * 60 * 1000;
  }
  
  if (record.count >= 8) {
    return false; // Bloqueado por 15 minutos
  }
  return true;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  record.count += 1;
  loginAttempts.set(ip, record);
}

function resetAttempts(ip) {
  loginAttempts.delete(ip);
}

// ---------------------------------------------------------------------------
// HASH SEGURO DE SENHAS: PBKDF2 com Salt Randômico e 100.000 iterações (OWASP)
// ---------------------------------------------------------------------------
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.startsWith('pbkdf2:')) {
    return false;
  }
  
  const parts = storedHash.split(':');
  if (parts.length !== 4) return false;
  
  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const originalHashHex = parts[3];
  
  const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const enc = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const candidateHashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return candidateHashHex === originalHashHex;
}

// ---------------------------------------------------------------------------
// GERAÇÃO DE TOKEN DE SESSÃO ASSINADO (HMAC-SHA256 - Validade 7 dias)
// ---------------------------------------------------------------------------
export async function createSessionToken(user, secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error('AUTH_SECRET ausente para assinatura de token');
  }
  const enc = new TextEncoder();
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
  };

  const payloadBase64 = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadBase64));
  const sigHex = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${payloadBase64}.${sigHex}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  if (!secret || typeof secret !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, sigHex] = parts;
  const enc = new TextEncoder();

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payloadBase64));
    
    if (!isValid) return null;

    const payload = JSON.parse(atob(payloadBase64));
    if (Date.now() > payload.exp) {
      return null; // Expirado
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HANDLERS HTTP
// ---------------------------------------------------------------------------

// Bloqueia GET para evitar enumeração de rotas e usuários
export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: false,
    error: 'Método não permitido'
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

  let authSecret;
  try {
    authSecret = getAuthSecret(env);
  } catch (cfgErr) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro de configuração do servidor: a variável AUTH_SECRET precisa ser configurada nas configurações do Cloudflare Pages.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const action = body.action || 'login';

    function sanitizeUsername(u) {
      if (!u || typeof u !== 'string') return '';
      return String(u)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9._-]/g, '')
        .trim();
    }

    if (action === 'login') {
      if (!checkRateLimit(clientIp)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Muitas tentativas incorretas. Aguarde alguns minutos antes de tentar novamente.'
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { username, password } = body;
      if (!username || !password || typeof password !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'Informe usuário e senha' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const cleanUsername = sanitizeUsername(username);
      if (!cleanUsername || cleanUsername.length > 40 || password.length > 50) {
        return new Response(JSON.stringify({ success: false, error: 'Usuário ou senha incorretos' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = await db
        .prepare('SELECT id, username, password_hash, name, role FROM users WHERE username = ?')
        .bind(cleanUsername)
        .first();

      if (!user) {
        recordFailedAttempt(clientIp);
        return new Response(JSON.stringify({ success: false, error: 'Usuário ou senha incorretos' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const passwordMatches = await verifyPassword(password, user.password_hash);
      if (!passwordMatches) {
        recordFailedAttempt(clientIp);
        return new Response(JSON.stringify({ success: false, error: 'Usuário ou senha incorretos' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      resetAttempts(clientIp);

      const token = await createSessionToken(user, authSecret);

      return new Response(JSON.stringify({
        success: true,
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } else if (action === 'register') {
      const { username, password, name } = body;
      const cleanUsername = sanitizeUsername(username);
      const cleanName = (typeof name === 'string' ? name.trim() : '');

      if (!cleanUsername || !password || !cleanName || typeof password !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'Preencha todos os campos obrigatórios' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (cleanUsername.length < 3 || cleanUsername.length > 40) {
        return new Response(JSON.stringify({ success: false, error: 'O nome de usuário deve ter entre 3 e 40 caracteres' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (cleanName.length > 60) {
        return new Response(JSON.stringify({ success: false, error: 'O nome deve ter no máximo 60 caracteres' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validação de senha: min 8 e max 50 caracteres + caractere especial
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
      if (password.length < 8 || password.length > 50 || !hasSpecial) {
        return new Response(JSON.stringify({
          success: false,
          error: 'A senha deve ter entre 8 e 50 caracteres e conter pelo menos um caractere especial (!@#$...).'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Lista restrita de operadores autorizados da escala
      const ALLOWED_USERNAMES = ['natividadedan', 'jnunesjnf', 'andreapr'];
      if (!ALLOWED_USERNAMES.includes(cleanUsername.toLowerCase())) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Identificação não autorizada. Apenas operadores autorizados podem criar acesso.'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

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

      // Todos os usuários autenticados possuem o mesmo perfil operacional
      const assignedRole = 'operator';

      const passHash = await hashPassword(password);
      await db
        .prepare('INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)')
        .bind(cleanUsername, passHash, cleanName, assignedRole)
        .run();

      const newUser = await db
        .prepare('SELECT id, username, name, role FROM users WHERE username = ?')
        .bind(cleanUsername)
        .first();

      const token = await createSessionToken(newUser, authSecret);

      return new Response(JSON.stringify({
        success: true,
        message: 'Cadastro realizado com sucesso!',
        token,
        user: newUser
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'update_name') {
      const token = extractBearerToken(request);
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'Sessão não autenticada' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const session = await verifySessionToken(token, authSecret);
      if (!session) {
        return new Response(JSON.stringify({ success: false, error: 'Sessão inválida ou expirada' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { name } = body;
      const cleanName = (typeof name === 'string' ? name.trim() : '');
      if (!cleanName) {
        return new Response(JSON.stringify({ success: false, error: 'O nome não pode ficar em branco' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (cleanName.length > 60) {
        return new Response(JSON.stringify({ success: false, error: 'O nome deve ter no máximo 60 caracteres' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(cleanName, session.id).run();

      const updatedUser = await db.prepare('SELECT id, username, name, role FROM users WHERE id = ?').bind(session.id).first();
      if (!updatedUser) {
        return new Response(JSON.stringify({ success: false, error: 'Usuário não encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const newToken = await createSessionToken(updatedUser, authSecret);

      return new Response(JSON.stringify({
        success: true,
        message: 'Nome atualizado com sucesso!',
        token: newToken,
        user: updatedUser
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação não suportada' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const requestId = crypto.randomUUID();
    console.error(`[AUTH_ERROR_${requestId}]`, err);
    return new Response(JSON.stringify({
      success: false,
      error: 'Ocorreu um erro interno. Tente novamente mais tarde.',
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
