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

    const createBlankDefaultOperators = (y, m) => ['A', 'B', 'C', 'D'].map((leg, idx) => ({
      id: `op-${y}-${String(m).padStart(2, '0')}-${leg.toLowerCase()}-${idx + 1}`,
      leg,
      name: '',
      shifts: {},
      subShifts: {},
      pimo: 0,
      instrucaoMet: 0
    }));

    // 1. Tenta buscar a escala do mês específico
    const scheduleRecord = await db
      .prepare('SELECT * FROM monthly_schedules WHERE id = ?')
      .bind(scheduleId)
      .first();

    let observations = [];
    let customHolidays = [];
    let disabledHolidays = [];
    let isV2Independent = false;
    let savedMonthOperators = null;

    if (scheduleRecord) {
      try {
        const parsedObs = JSON.parse(scheduleRecord.observations || '[]');
        if (Array.isArray(parsedObs)) {
          observations = parsedObs;
        } else if (parsedObs && typeof parsedObs === 'object') {
          observations = Array.isArray(parsedObs.observations) ? parsedObs.observations : [];
          customHolidays = Array.isArray(parsedObs.customHolidays) ? parsedObs.customHolidays : [];
          disabledHolidays = Array.isArray(parsedObs.disabledHolidays) ? parsedObs.disabledHolidays : [];
          isV2Independent = Boolean(parsedObs.v2_independent);
          if (Array.isArray(parsedObs.monthOperators)) {
            savedMonthOperators = parsedObs.monthOperators;
          }
        }
      } catch (e) {
        observations = [];
      }
    }

    // 2. Busca os dados de turnos salvos para este mês específico
    const { results: monthData } = await db
      .prepare('SELECT * FROM operator_month_data WHERE schedule_id = ?')
      .bind(scheduleId)
      .all();

    const monthDataMap = {};
    (monthData || []).forEach(md => {
      monthDataMap[md.operator_id] = md;
    });

    let operators = [];

    // Caso 1: Mês já salvo com lista de operadores independente do mês (v2_independent)
    if (scheduleRecord && isV2Independent && Array.isArray(savedMonthOperators)) {
      operators = savedMonthOperators.map(op => {
        const data = monthDataMap[op.id] || {};
        let shifts = {};
        let subShifts = {};
        try { shifts = JSON.parse(data.shifts || '{}'); } catch (e) {}
        try { subShifts = JSON.parse(data.sub_shifts || '{}'); } catch (e) {}

        return {
          id: op.id,
          leg: op.leg,
          name: op.name || '',
          shifts,
          subShifts,
          pimo: data.pimo || 0,
          instrucaoMet: data.instrucao_met || 0
        };
      });
    } else if (year >= 2027) {
      // Caso 2: A partir de Janeiro de 2027, meses ainda não salvos com a nova lógica
      // iniciam vazios apenas com as legendas A, B, C, D e os campos de nome em branco
      operators = createBlankDefaultOperators(year, month);
      observations = [];
      customHolidays = [];
      disabledHolidays = [];
      isV2Independent = true;
    } else {
      // Caso 3: Meses até Dezembro de 2026 (escalas anteriores já preenchidas)
      // Reconstrói os operadores vinculados a este mês em operator_month_data sem filtrar por active=1,
      // garantindo que operadores excluídos em outros meses nunca sumam de escalas anteriores.
      if (scheduleRecord && monthData && monthData.length > 0) {
        const { results: joinedOps } = await db
          .prepare(`
            SELECT o.id, o.leg, o.name, o.sort_order,
                   md.shifts, md.sub_shifts, md.pimo, md.instrucao_met
            FROM operator_month_data md
            INNER JOIN operators o ON o.id = md.operator_id
            WHERE md.schedule_id = ?
            ORDER BY o.sort_order ASC, o.leg ASC
          `)
          .bind(scheduleId)
          .all();

        if (joinedOps && joinedOps.length > 0) {
          operators = joinedOps.map(row => {
            let shifts = {};
            let subShifts = {};
            try { shifts = JSON.parse(row.shifts || '{}'); } catch (e) {}
            try { subShifts = JSON.parse(row.sub_shifts || '{}'); } catch (e) {}
            return {
              id: row.id,
              leg: row.leg,
              name: row.name || '',
              shifts,
              subShifts,
              pimo: row.pimo || 0,
              instrucaoMet: row.instrucao_met || 0
            };
          });
        }
      }

      if (operators.length === 0) {
        const { results: dbOperators } = await db
          .prepare('SELECT * FROM operators WHERE sector = ? ORDER BY sort_order ASC, leg ASC')
          .bind(sector)
          .all();

        if (dbOperators && dbOperators.length > 0) {
          operators = dbOperators.map(op => {
            const data = monthDataMap[op.id] || {};
            let shifts = {};
            let subShifts = {};
            try { shifts = JSON.parse(data.shifts || '{}'); } catch (e) {}
            try { subShifts = JSON.parse(data.sub_shifts || '{}'); } catch (e) {}
            return {
              id: op.id,
              leg: op.leg,
              name: op.name || '',
              shifts,
              subShifts,
              pimo: data.pimo || 0,
              instrucaoMet: data.instrucao_met || 0
            };
          });
        } else {
          operators = createBlankDefaultOperators(year, month);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        year,
        month,
        sector,
        v2_independent: isV2Independent,
        operators,
        observations,
        customHolidays,
        disabledHolidays
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
    const { year, month, sector, operators, observations, customHolidays, disabledHolidays } = body;

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

    // Sanitiza e valida observações e feriados personalizados do mês
    const safeObs = Array.isArray(observations)
      ? observations.map(o => String(o || '').trim().slice(0, 300)).filter(Boolean)
      : [];

    const safeCustomHolidays = Array.isArray(customHolidays)
      ? customHolidays.slice(0, 50).map(c => ({
          id: String(c?.id || `custom-${parseInt(c?.day, 10) || 1}`).trim().slice(0, 50),
          day: Math.max(1, Math.min(31, parseInt(c?.day, 10) || 1)),
          month: parsedMonth,
          name: String(c?.name || 'Feriado Local').trim().slice(0, 100),
          type: String(c?.type || 'Personalizado / OM').trim().slice(0, 60)
        }))
      : [];

    const safeDisabledHolidays = Array.isArray(disabledHolidays)
      ? disabledHolidays.slice(0, 50).map(d => typeof d === 'number' ? d : String(d || '').trim().slice(0, 50)).filter(Boolean)
      : [];

    // 2. Processa os operadores e turnos deste mês de forma 100% independente de outros meses
    const cleanMonthOperators = [];
    const batchStatements = [
      // Remove apenas os dados de turnos anteriores deste próprio mês (scheduleId), sem afetar outros meses
      db.prepare('DELETE FROM operator_month_data WHERE schedule_id = ?').bind(scheduleId)
    ];

    const stmtInsertIgnoreOp = db.prepare(`
      INSERT OR IGNORE INTO operators (id, leg, name, sector, sort_order, active)
      VALUES (?, ?, ?, ?, ?, 1)
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

      cleanMonthOperators.push({
        id: cleanOpId,
        leg: cleanLeg,
        name: cleanName,
        sort_order: index + 1
      });

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

      batchStatements.push(stmtInsertIgnoreOp.bind(cleanOpId, cleanLeg, cleanName, cleanSector, index + 1));
      batchStatements.push(stmtUpsertMonthData.bind(
        scheduleId,
        cleanOpId,
        JSON.stringify(cleanShifts),
        JSON.stringify(cleanSubShifts),
        pimoVal,
        metVal
      ));
    });

    const serializedScheduleMeta = JSON.stringify({
      v2_independent: true,
      observations: safeObs,
      customHolidays: safeCustomHolidays,
      disabledHolidays: safeDisabledHolidays,
      monthOperators: cleanMonthOperators
    });

    // 1. Atualiza ou insere o registro da escala deste mês com sua lista própria de operadores
    await db
      .prepare(`
        INSERT INTO monthly_schedules (id, year, month, sector, observations, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          observations = excluded.observations,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(scheduleId, parsedYear, parsedMonth, cleanSector, serializedScheduleMeta)
      .run();

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
