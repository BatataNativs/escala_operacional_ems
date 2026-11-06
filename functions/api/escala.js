// Endpoint da API Cloudflare Pages Functions para Escala Operacional
// Rota: /api/escala

import { verifySessionToken, getAuthSecret, extractBearerToken } from './auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;

  try {
    let secret;
    try {
      secret = getAuthSecret(env);
    } catch (cfgErr) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro de configuração do servidor: a variável AUTH_SECRET precisa ser configurada nas configurações do Cloudflare Pages.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // -------------------------------------------------------------------------
    // AUTORIZAÇÃO: Validação de Token de Sessão (bloqueia leitura anônima)
    // -------------------------------------------------------------------------
    const token = extractBearerToken(request);
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sessão não autenticada. Faça login para visualizar a escala.'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const session = await verifySessionToken(token, secret);
    if (!session) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sessão expirada ou inválida. Faça login novamente.'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(request.url);
    const now = new Date();
    const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(url.searchParams.get('month') || String(now.getMonth()), 10); // 0-11
    const sector = (url.searchParams.get('sector') || 'EMS-SP').trim().slice(0, 50);
    const scheduleId = `${year}-${String(month).padStart(2, '0')}_${sector}`;

    // 1. Tenta buscar a escala do mês específico
    const scheduleRecord = await db
      .prepare('SELECT * FROM monthly_schedules WHERE id = ?')
      .bind(scheduleId)
      .first();

    // 2. Busca o efetivo de operadores cadastrados
    let { results: dbOperators } = await db
      .prepare('SELECT * FROM operators WHERE sector = ? AND active = 1 ORDER BY sort_order ASC, leg ASC')
      .bind(sector)
      .all();

    // Se o banco estiver totalmente novo (primeiro acesso), popula com o efetivo padrão inicial
    if (!dbOperators || dbOperators.length === 0) {
      const defaultOperators = [
        { id: 'op-1', leg: 'A', name: 'SO J. Nunes', sort_order: 1 },
        { id: 'op-2', leg: 'B', name: '2S Natividade', sort_order: 2 },
        { id: 'op-3', leg: 'C', name: '1S André', sort_order: 3 },
        { id: 'op-4', leg: 'D', name: 'Operador D.O', sort_order: 4 }
      ];

      const stmtOp = db.prepare('INSERT INTO operators (id, leg, name, sector, sort_order) VALUES (?, ?, ?, ?, ?)');
      await db.batch(defaultOperators.map(o => stmtOp.bind(o.id, o.leg, o.name, sector, o.sort_order)));

      const refreshed = await db
        .prepare('SELECT * FROM operators WHERE sector = ? AND active = 1 ORDER BY sort_order ASC')
        .bind(sector)
        .all();
      dbOperators = refreshed.results;
    }

    // 3. Se a escala do mês ainda não existir, cria a entrada inicial vazia
    let observations = [];
    if (!scheduleRecord) {
      await db
        .prepare('INSERT INTO monthly_schedules (id, year, month, sector, observations) VALUES (?, ?, ?, ?, ?)')
        .bind(scheduleId, year, month, sector, '[]')
        .run();

      observations = [];

      const stmtInitial = db.prepare('INSERT INTO operator_month_data (schedule_id, operator_id, shifts, sub_shifts, pimo, instrucao_met) VALUES (?, ?, ?, ?, ?, ?)');
      const batchArr = dbOperators.map(o => {
        return stmtInitial.bind(scheduleId, o.id, '{}', '{}', 0, 0);
      });
      await db.batch(batchArr);
    } else {
      try {
        observations = JSON.parse(scheduleRecord.observations || '[]');
      } catch (e) {
        observations = [];
      }
    }

    // 4. Busca os dados de turnos dos operadores para este mês
    const { results: monthData } = await db
      .prepare('SELECT * FROM operator_month_data WHERE schedule_id = ?')
      .bind(scheduleId)
      .all();

    const monthDataMap = {};
    (monthData || []).forEach(md => {
      monthDataMap[md.operator_id] = md;
    });

    // 5. Monta o objeto dos operadores no formato esperado pelo frontend
    const operators = dbOperators.map(op => {
      const data = monthDataMap[op.id] || {};
      let shifts = {};
      let subShifts = {};
      try { shifts = JSON.parse(data.shifts || '{}'); } catch (e) {}
      try { subShifts = JSON.parse(data.sub_shifts || '{}'); } catch (e) {}

      return {
        id: op.id,
        leg: op.leg,
        name: op.name,
        shifts: shifts,
        subShifts: subShifts,
        pimo: data.pimo || 0,
        instrucaoMet: data.instrucao_met || 0
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        year,
        month,
        sector,
        operators,
        observations
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(`[ESCALA_GET_ERROR_${requestId}]`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro ao carregar escala do banco de dados.',
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;

  try {
    let secret;
    try {
      secret = getAuthSecret(env);
    } catch (cfgErr) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro de configuração do servidor: a variável AUTH_SECRET precisa ser configurada nas configurações do Cloudflare Pages.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // -------------------------------------------------------------------------
    // AUTORIZAÇÃO: Validação de Token de Sessão (Mitigação BOLA/IDOR)
    // -------------------------------------------------------------------------
    const token = extractBearerToken(request);
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sessão não autenticada. Faça login para continuar.'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const session = await verifySessionToken(token, secret);
    if (!session) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sessão expirada ou inválida. Faça login novamente.'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // -------------------------------------------------------------------------
    // CONTROLE DE ACESSO: Qualquer operador autenticado com sessão válida pode salvar
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // VALIDAÇÃO RÍGIDA DE ENTRADAS (Mitigação Risco 02)
    // -------------------------------------------------------------------------
    const body = await request.json();
    const { year, month, sector, operators, observations } = body;

    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (
      isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100 ||
      isNaN(parsedMonth) || parsedMonth < 0 || parsedMonth > 11 ||
      !sector || typeof sector !== 'string' ||
      !Array.isArray(operators) || operators.length > 200
    ) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Parâmetros inválidos fornecidos para salvar a escala'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const cleanSector = sector.trim().slice(0, 50);
    const scheduleId = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}_${cleanSector}`;

    // Sanitiza e valida observações
    const safeObs = Array.isArray(observations)
      ? observations.map(o => String(o || '').trim().slice(0, 300)).filter(Boolean)
      : [];

    // 1. Atualiza ou insere o registro da escala
    await db
      .prepare(`
        INSERT INTO monthly_schedules (id, year, month, sector, observations, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          observations = excluded.observations,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(scheduleId, parsedYear, parsedMonth, cleanSector, JSON.stringify(safeObs))
      .run();

    // 2. Atualiza operadores gerais e turnos deste mês em lote
    const batchStatements = [];

    const stmtUpsertOp = db.prepare(`
      INSERT INTO operators (id, leg, name, sector, sort_order, active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        leg = excluded.leg,
        name = excluded.name,
        sort_order = excluded.sort_order,
        active = 1
    `);

    const stmtUpsertMonthData = db.prepare(`
      INSERT INTO operator_month_data (schedule_id, operator_id, shifts, sub_shifts, pimo, instrucao_met)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(schedule_id, operator_id) DO UPDATE SET
        shifts = excluded.shifts,
        sub_shifts = excluded.sub_shifts,
        pimo = excluded.pimo,
        instrucao_met = excluded.instrucao_met
    `);

    operators.forEach((op, index) => {
      if (!op || !op.id) return;
      const cleanOpId = String(op.id).trim().slice(0, 50);
      const cleanLeg = String(op.leg || '').trim().slice(0, 10);
      const cleanName = String(op.name || '').trim().slice(0, 100);

      // Validação de formato dos turnos (apenas números como chave, strings curtas como valor)
      const cleanShifts = {};
      if (op.shifts && typeof op.shifts === 'object') {
        for (const [day, shiftVal] of Object.entries(op.shifts)) {
          const dayNum = parseInt(day, 10);
          if (dayNum >= 1 && dayNum <= 31 && typeof shiftVal === 'string') {
            cleanShifts[dayNum] = shiftVal.trim().toUpperCase().slice(0, 10);
          }
        }
      }

      const cleanSubShifts = {};
      if (op.subShifts && typeof op.subShifts === 'object') {
        for (const [day, shiftVal] of Object.entries(op.subShifts)) {
          const dayNum = parseInt(day, 10);
          if (dayNum >= 1 && dayNum <= 31 && typeof shiftVal === 'string') {
            cleanSubShifts[dayNum] = shiftVal.trim().toUpperCase().slice(0, 10);
          }
        }
      }

      const pimoVal = Math.max(0, Math.min(200, parseFloat(op.pimo || 0) || 0));
      const metVal = Math.max(0, Math.min(200, parseFloat(op.instrucaoMet || 0) || 0));

      batchStatements.push(stmtUpsertOp.bind(cleanOpId, cleanLeg, cleanName, cleanSector, index + 1));
      batchStatements.push(stmtUpsertMonthData.bind(
        scheduleId,
        cleanOpId,
        JSON.stringify(cleanShifts),
        JSON.stringify(cleanSubShifts),
        pimoVal,
        metVal
      ));
    });

    if (batchStatements.length > 0) {
      await db.batch(batchStatements);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Escala sincronizada com sucesso',
      scheduleId,
      updated_at: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(`[ESCALA_POST_ERROR_${requestId}]`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro ao salvar escala no banco de dados.',
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
