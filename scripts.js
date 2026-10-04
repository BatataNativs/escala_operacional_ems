/**
 * SISTEMA DE ESCALA OPERACIONAL
 * Lógica Completa de Confecção, Acompanhamento e Gestão
 */

(() => {
  'use strict';

  // Chave do localStorage
  const STORAGE_KEY = 'escala_operacional_v1';

  // Nomes dos meses e dias da semana abreviados
  const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const WEEKDAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  // Dados Padrão (Fieis à planilha Escala - Out 2026.ods)
  const DEFAULT_DATA = {
    year: 2026,
    month: 9, // Outubro (0-indexed)
    sector: 'EMS-SP',
    operators: [
      {
        id: 'op-1',
        leg: 'A',
        name: 'SO J. Nunes',
        shifts: {
          1: 'M', 2: 'M', 5: 'M', 6: 'M', 7: 'M', 8: 'M', 9: 'M',
          12: 'M', 13: 'M', 14: 'M', 15: 'M', 16: 'M',
          19: 'M', 20: 'M', 21: 'M', 22: 'M', 23: 'M',
          26: 'M', 27: 'M', 28: 'M', 29: 'M', 30: 'M'
        },
        subShifts: {}
      },
      {
        id: 'op-2',
        leg: 'B',
        name: '2S Natividade',
        shifts: {
          2: 'T', 3: 'M', 5: 'T', 8: 'T', 11: 'T', 14: 'T',
          17: 'T', 18: 'M', 20: 'T', 23: 'T', 24: 'M', 26: 'T', 29: 'T'
        },
        subShifts: {}
      },
      {
        id: 'op-3',
        leg: 'C',
        name: '1S André',
        shifts: {
          3: 'T', 4: 'M', 6: 'T', 9: 'T', 10: 'M', 12: 'T',
          15: 'T', 18: 'T', 21: 'T', 24: 'T', 25: 'M', 27: 'T', 30: 'T', 31: 'M'
        },
        subShifts: {}
      },
      {
        id: 'op-4',
        leg: 'D',
        name: 'Operador D.O',
        shifts: {
          1: 'T', 4: 'T', 7: 'T', 10: 'T', 11: 'M', 13: 'T',
          16: 'T', 17: 'M', 19: 'T', 22: 'T', 25: 'T', 28: 'T', 31: 'T'
        },
        subShifts: {}
      }
    ],
    observations: [
      '1S Hiremar: 08T, 13T e 31T;',
      '2S Marisol: 16T, 17M e 22T;',
      '2S Amanda Lopes: 1T, 04T e 07T;',
      '2S Seiffert: 19T, 25T e 28T;'
    ]
  };

  // Estado da Aplicação
  let state = loadState();
  let currentMode = 'edit'; // 'edit' ou 'view'
  let activeCell = null;

  // Elementos do DOM
  const selectMonth = document.getElementById('select-month');
  const inputYear = document.getElementById('input-year');
  const inputSector = document.getElementById('input-sector');
  const btnModeEdit = document.getElementById('btn-mode-edit');
  const btnModeView = document.getElementById('btn-mode-view');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnAddOperator = document.getElementById('btn-add-operator');
  const btnPrint = document.getElementById('btn-print');
  const btnMore = document.getElementById('btn-more');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const actionExportJson = document.getElementById('action-export-json');
  const actionImportJson = document.getElementById('action-import-json');
  const fileInputJson = document.getElementById('file-input-json');
  const actionClearAll = document.getElementById('action-clear-all');

  const searchOperator = document.getElementById('search-operator');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const saveStatus = document.getElementById('save-status');

  const thead = document.getElementById('schedule-thead');
  const tbody = document.getElementById('schedule-tbody');
  const obsList = document.getElementById('obs-list');
  const btnAddObs = document.getElementById('btn-add-obs');
  const shiftPopover = document.getElementById('shift-popover');

  const statsTbody = document.getElementById('stats-tbody');
  const statsTfoot = document.getElementById('stats-tfoot');
  const statsTeamAverage = document.getElementById('stats-team-average');
  const statsMemorialFooter = document.getElementById('stats-memorial-footer');

  // =========================================================================
  // PERSISTÊNCIA & CARREGAMENTO DE DADOS
  // =========================================================================
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.operators && Array.isArray(parsed.operators)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar dados do localStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      triggerSaveIndicator();
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
    }
  }

  function triggerSaveIndicator() {
    if (saveStatus) {
      saveStatus.textContent = 'Salvo';
      saveStatus.style.opacity = '1';
    }
  }

  // =========================================================================
  // CÁLCULO DE DIAS DO MÊS E CALENDÁRIO
  // =========================================================================
  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getMonthDaysInfo(year, month) {
    const totalDays = getDaysInMonth(year, month);
    const days = [];
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay(); // 0: DOM, 6: SÁB
      days.push({
        dayNumber: day,
        dayOfWeekName: WEEKDAY_NAMES[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      });
    }
    return days;
  }

  // =========================================================================
  // RENDERIZAÇÃO DA TABELA
  // =========================================================================
  function renderAll() {
    syncHeaderControls();
    renderHeader();
    renderBody();
    renderObservations();
    renderStatsTable();
  }

  function syncHeaderControls() {
    selectMonth.value = state.month;
    inputYear.value = state.year;
    inputSector.value = state.sector;
  }

  function renderHeader() {
    const daysInfo = getMonthDaysInfo(state.year, state.month);
    const monthShort = MONTH_NAMES[state.month];

    // Data de hoje para destaque
    const today = new Date();
    const isCurrentYearMonth = today.getFullYear() === state.year && today.getMonth() === state.month;
    const currentDay = today.getDate();

    // Atualiza o badge do ano
    const yearBadge = document.getElementById('year-badge');
    if (yearBadge) {
      yearBadge.textContent = state.year;
    }

    // Linha 1: Mês, Unidade e Dias da Semana (QUI, SEX, SÁB, DOM...)
    let tr1 = `<tr>
      <th class="cell-month col-leg">${monthShort}</th>
      <th class="cell-unit col-name">${escapeHtml(state.sector)}</th>`;
    daysInfo.forEach(d => {
      const cls = d.isWeekend ? 'cell-weekend' : 'cell-weekday';
      const todayClass = (isCurrentYearMonth && d.dayNumber === currentDay) ? ' col-today' : '';
      tr1 += `<th class="${cls} col-day${todayClass}">${d.dayOfWeekName}</th>`;
    });
    tr1 += `</tr>`;

    // Linha 2: Leg., Operadores, 1 a 31
    let tr2 = `<tr>
      <th class="cell-hdr-leg col-leg">Leg.</th>
      <th class="cell-hdr-op col-name">Operadores</th>`;
    daysInfo.forEach(d => {
      const todayClass = (isCurrentYearMonth && d.dayNumber === currentDay) ? ' col-today' : '';
      tr2 += `<th class="cell-day-num col-day${todayClass}">${d.dayNumber}</th>`;
    });
    tr2 += `</tr>`;

    thead.innerHTML = tr1 + tr2;
  }

  function renderBody() {
    const daysInfo = getMonthDaysInfo(state.year, state.month);
    const searchTerm = (searchOperator.value || '').trim().toLowerCase();

    let html = '';

    state.operators.forEach((op, opIndex) => {
      const isMatch = searchTerm ? op.name.toLowerCase().includes(searchTerm) : false;
      const rowDimmed = searchTerm && !isMatch ? ' operator-dimmed' : '';
      const rowMatched = isMatch ? ' operator-matched' : '';

      // 1. Linha Amarela Principal do Operador
      html += `<tr class="row-operator${rowDimmed}${rowMatched}" data-op-id="${op.id}">`;
      
      // Coluna Legenda (A, B, C...)
      html += `<td class="cell-leg-val col-leg" 
                  contenteditable="${currentMode === 'edit'}" 
                  data-action="edit-leg" 
                  data-op-id="${op.id}" 
                  spellcheck="false">${escapeHtml(op.leg)}</td>`;

      // Coluna Nome do Operador (X vermelho no início da célula)
      html += `<td class="cell-op-name col-name">
        <div class="name-container">
          <button class="btn-del-op no-print" data-action="del-op" data-op-id="${op.id}" title="Excluir operador">&times;</button>
          <span class="op-name-text" 
                contenteditable="${currentMode === 'edit'}" 
                data-action="edit-name" 
                data-op-id="${op.id}" 
                spellcheck="false">${escapeHtml(op.name)}</span>
        </div>
      </td>`;

      // Células de Turno (1..31)
      daysInfo.forEach(d => {
        const val = op.shifts[d.dayNumber] || '';
        html += `<td class="cell-shift col-day" 
                    tabindex="${currentMode === 'edit' ? 0 : -1}" 
                    data-val="${escapeHtml(val)}" 
                    data-op-id="${op.id}" 
                    data-day="${d.dayNumber}" 
                    data-is-sub="false">${escapeHtml(val)}</td>`;
      });
      html += `</tr>`;

      // 2. Linha Azul Intermediária apenas entre operadores (não após o último operador)
      if (opIndex < state.operators.length - 1) {
        html += `<tr class="row-blue-stripe${rowDimmed}" data-sub-op-id="${op.id}">`;
        html += `<td class="cell-blank-sub col-leg"></td>`;
        html += `<td class="cell-sub-name col-name"></td>`;
        daysInfo.forEach(d => {
          const subVal = (op.subShifts && op.subShifts[d.dayNumber]) || '';
          html += `<td class="cell-sub-shift col-day" 
                      tabindex="${currentMode === 'edit' ? 0 : -1}" 
                      data-val="${escapeHtml(subVal)}" 
                      data-op-id="${op.id}" 
                      data-day="${d.dayNumber}" 
                      data-is-sub="true">${escapeHtml(subVal)}</td>`;
        });
        html += `</tr>`;
      }
    });

    tbody.innerHTML = html;
  }

  function renderObservations() {
    let html = '';
    state.observations.forEach((obs, index) => {
      html += `<div class="obs-row" data-index="${index}">
        <span class="obs-text" 
              contenteditable="${currentMode === 'edit'}" 
              data-action="edit-obs" 
              data-index="${index}" 
              spellcheck="false">${escapeHtml(obs)}</span>
        <button class="obs-del-btn no-print" data-action="del-obs" data-index="${index}" title="Excluir anotação">&times;</button>
      </div>`;
    });
    obsList.innerHTML = html;
  }

  // =========================================================================
  // CÁLCULO DE CARGA HORÁRIA E ETAPAS (5X E 10X)
  // =========================================================================
  function calculateOperatorStats(op, daysInfo) {
    let countM = 0;
    let countT = 0;
    let countR = 0;
    let etapa5x = 0;
    let etapa10x = 0;

    daysInfo.forEach(d => {
      // Turno principal
      const val = (op.shifts && op.shifts[d.dayNumber]) || '';
      if (val === 'M') {
        countM++;
      } else if (val === 'T') {
        countT++;
        // Etapa 5X: R$ 67,50 no fim de semana; R$ 54,00 em dia útil (-R$ 13,50)
        etapa5x += d.isWeekend ? 67.5 : 54.0;
      } else if (val === 'R') {
        countR++;
        // Etapa 10X: R$ 135,00 no fim de semana; R$ 121,50 em dia útil (-R$ 13,50)
        etapa10x += d.isWeekend ? 135.0 : 121.5;
      }

      // SubTurno (faixa secundária) se houver
      const subVal = (op.subShifts && op.subShifts[d.dayNumber]) || '';
      if (subVal === 'M') {
        countM++;
      } else if (subVal === 'T') {
        countT++;
        etapa5x += d.isWeekend ? 67.5 : 54.0;
      } else if (subVal === 'R') {
        countR++;
        etapa10x += d.isWeekend ? 135.0 : 121.5;
      }
    });

    const totalShifts = countM + countT + countR;
    // Carga Horária: M (7,5h op + 0,25h abertura = 7,75h), T (9,5h op + 0,5h briefing/fechamento = 10,0h), R (24,0h)
    const totalHours = (countM * 7.75) + (countT * 10.0) + (countR * 24.0);

    return {
      countM,
      countT,
      countR,
      totalShifts,
      totalHours,
      etapa5x,
      etapa10x
    };
  }

  function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatHours(val) {
    return val.toFixed(2).replace('.', ',') + 'h';
  }

  function renderStatsTable() {
    if (!statsTbody) return;

    const daysInfo = getMonthDaysInfo(state.year, state.month);
    const totalDays = daysInfo.length;
    const totalOps = state.operators.length;

    let totalTeamShifts = 0;
    let totalTeamHours = 0;
    let totalTeamE5 = 0;
    let totalTeamE10 = 0;

    const searchTerm = (searchOperator ? searchOperator.value : '').trim().toLowerCase();
    let rowsHtml = '';

    state.operators.forEach(op => {
      const stats = calculateOperatorStats(op, daysInfo);
      totalTeamShifts += stats.totalShifts;
      totalTeamHours += stats.totalHours;
      totalTeamE5 += stats.etapa5x;
      totalTeamE10 += stats.etapa10x;

      const isMatch = searchTerm ? op.name.toLowerCase().includes(searchTerm) : false;
      const rowDimmed = searchTerm && !isMatch ? ' operator-dimmed' : '';
      const rowMatched = isMatch ? ' operator-matched' : '';

      const breakdown = [];
      if (stats.countM > 0) breakdown.push(`${stats.countM}M`);
      if (stats.countT > 0) breakdown.push(`${stats.countT}T`);
      if (stats.countR > 0) breakdown.push(`${stats.countR}R`);
      const breakdownText = breakdown.length ? ` <span class="shifts-breakdown">(${breakdown.join(', ')})</span>` : '';

      rowsHtml += `<tr class="row-stat-operator${rowDimmed}${rowMatched}" data-op-id="${op.id}">
        <td class="col-stat-leg"><span class="stat-leg-badge">${escapeHtml(op.leg)}</span></td>
        <td class="col-stat-op">${escapeHtml(op.name)}</td>
        <td class="col-stat-shifts">${stats.totalShifts}${breakdownText}</td>
        <td class="col-stat-hours" title="${stats.totalHours.toFixed(2)} horas operacionais e administrativas">${formatHours(stats.totalHours)}</td>
        <td class="col-stat-e5">${formatCurrency(stats.etapa5x)}</td>
        <td class="col-stat-e10">${formatCurrency(stats.etapa10x)}</td>
      </tr>`;
    });

    statsTbody.innerHTML = rowsHtml;

    // Rodapé de Totais Gerais da Equipe
    if (statsTfoot) {
      const avgTeamHours = totalOps > 0 ? (totalTeamHours / totalOps) : 0;

      statsTfoot.innerHTML = `<tr>
        <td class="col-stat-leg"><strong>TOT</strong></td>
        <td class="col-stat-op"><strong>Total / Média Equipe</strong></td>
        <td class="col-stat-shifts"><strong>${totalTeamShifts}</strong></td>
        <td class="col-stat-hours" title="Média por operador: ${formatHours(avgTeamHours)} (${totalTeamHours.toFixed(2)}h total / ${totalOps} operadores)"><strong>${formatHours(avgTeamHours)}</strong></td>
        <td class="col-stat-e5"><strong>${formatCurrency(totalTeamE5)}</strong></td>
        <td class="col-stat-e10"><strong>${formatCurrency(totalTeamE10)}</strong></td>
      </tr>`;
    }

    // Memorial de cálculo oficial:
    // (DiasNoMês * 17h + DiasNoMês * 0,75h) / TotalOperadores
    const teamAverageHours = totalOps > 0 ? ((totalDays * 17) + (totalDays * 0.75)) / totalOps : 0;

    if (statsTeamAverage) {
      statsTeamAverage.textContent = `Média Prevista: ${teamAverageHours.toFixed(2).replace('.', ',')}h / op`;
    }

    if (statsMemorialFooter) {
      statsMemorialFooter.innerHTML = `<span><strong>Memorial de cálculo da equipe:</strong> (${totalDays} × 17h + ${totalDays} × 0,75h) / ${totalOps} = <strong>${teamAverageHours.toFixed(2).replace('.', ',')}h</strong></span>`;
    }
  }

  // =========================================================================
  // GESTÃO DE OPERADORES & OBSERVAÇÕES
  // =========================================================================
  function addOperator() {
    if (currentMode !== 'edit') return;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nextLeg = state.operators.length < letters.length ? letters[state.operators.length] : `O${state.operators.length + 1}`;
    
    const newOp = {
      id: 'op-' + Date.now(),
      leg: nextLeg,
      name: `Novo Operador ${state.operators.length + 1}`,
      shifts: {},
      subShifts: {}
    };

    state.operators.push(newOp);
    saveState();
    renderBody();
    renderStatsTable();

    // Foca no nome do operador recém-adicionado
    setTimeout(() => {
      const newEl = tbody.querySelector(`[data-op-id="${newOp.id}"] .op-name-text`);
      if (newEl) {
        newEl.focus();
        selectElementContents(newEl);
      }
    }, 50);
  }

  function deleteOperator(opId) {
    const op = state.operators.find(o => o.id === opId);
    if (!op) return;
    if (confirm(`Deseja remover o operador "${op.name}" da escala?`)) {
      state.operators = state.operators.filter(o => o.id !== opId);
      saveState();
      renderBody();
      renderStatsTable();
    }
  }

  function addObservation() {
    if (currentMode !== 'edit') return;
    state.observations.push('Nova observação de escala;');
    saveState();
    renderObservations();

    setTimeout(() => {
      const rows = obsList.querySelectorAll('.obs-text');
      const last = rows[rows.length - 1];
      if (last) {
        last.focus();
        selectElementContents(last);
      }
    }, 50);
  }

  function deleteObservation(index) {
    state.observations.splice(index, 1);
    saveState();
    renderObservations();
  }

  // =========================================================================
  // EDIÇÃO DE CÉLULAS & ATALHOS DE TECLADO
  // =========================================================================
  function updateCellShift(opId, day, isSub, val) {
    const op = state.operators.find(o => o.id === opId);
    if (!op) return;

    val = val.trim().toUpperCase();

    if (isSub) {
      if (!op.subShifts) op.subShifts = {};
      if (val) op.subShifts[day] = val;
      else delete op.subShifts[day];
    } else {
      if (val) op.shifts[day] = val;
      else delete op.shifts[day];
    }

    saveState();

    // Atualiza apenas a célula específica no DOM para performance instantânea
    const selector = isSub 
      ? `[data-sub-op-id="${opId}"] [data-day="${day}"]` 
      : `[data-op-id="${opId}"] [data-day="${day}"]`;
    const td = tbody.querySelector(selector);
    if (td) {
      td.textContent = val;
      td.setAttribute('data-val', val);
    }

    // Recalcula e atualiza instantaneamente a tabela de Carga Horária & Etapas
    renderStatsTable();
  }

  function openShiftPopover(cell) {
    if (currentMode !== 'edit') return;
    activeCell = cell;

    const rect = cell.getBoundingClientRect();
    shiftPopover.style.display = 'flex';
    shiftPopover.style.top = `${window.scrollY + rect.bottom + 4}px`;
    shiftPopover.style.left = `${window.scrollX + rect.left - 20}px`;
  }

  function closeShiftPopover() {
    shiftPopover.style.display = 'none';
    activeCell = null;
  }

  // Navegação por teclado nas células da tabela
  function handleCellKeyDown(e, td) {
    if (currentMode !== 'edit') return;

    const key = e.key;
    const opId = td.getAttribute('data-op-id');
    const day = parseInt(td.getAttribute('data-day'), 10);
    const isSub = td.getAttribute('data-is-sub') === 'true';

    // Teclas diretas de turnos: M, T, N, F, etc.
    if (key.length === 1 && /^[a-zA-Z0-9*]$/.test(key)) {
      e.preventDefault();
      const val = key.toUpperCase();
      updateCellShift(opId, day, isSub, val);
      // Avança para o próximo dia automaticamente
      moveFocusCell(td, 0, 1);
      return;
    }

    // Teclas para limpar: Backspace, Delete ou Espaço
    if (key === 'Backspace' || key === 'Delete' || key === ' ') {
      e.preventDefault();
      updateCellShift(opId, day, isSub, '');
      return;
    }

    // Setas do Teclado para navegar entre as células
    if (key === 'ArrowRight') {
      e.preventDefault();
      moveFocusCell(td, 0, 1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      moveFocusCell(td, 0, -1);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      moveFocusCell(td, 1, 0);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      moveFocusCell(td, -1, 0);
    } else if (key === 'Enter') {
      e.preventDefault();
      openShiftPopover(td);
    }
  }

  function moveFocusCell(currentTd, rowDelta, colDelta) {
    const tr = currentTd.parentElement;
    const isSub = currentTd.getAttribute('data-is-sub') === 'true';
    const currentDay = parseInt(currentTd.getAttribute('data-day'), 10);
    const totalDays = getDaysInMonth(state.year, state.month);

    if (colDelta !== 0) {
      const nextDay = currentDay + colDelta;
      if (nextDay >= 1 && nextDay <= totalDays) {
        const nextCell = tr.querySelector(`[data-day="${nextDay}"]`);
        if (nextCell) nextCell.focus();
      }
    } else if (rowDelta !== 0) {
      // Movimento vertical (entre operadores e sublinhas)
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const currentRowIdx = allRows.indexOf(tr);
      const targetRowIdx = currentRowIdx + (rowDelta * (isSub ? 2 : 2));
      if (targetRowIdx >= 0 && targetRowIdx < allRows.length) {
        const targetRow = allRows[targetRowIdx];
        const targetCell = targetRow.querySelector(`[data-day="${currentDay}"]`);
        if (targetCell) targetCell.focus();
      }
    }
  }

  // =========================================================================
  // LISTENERS DE EVENTOS
  // =========================================================================
  function setupEventListeners() {
    // 1. Mudança de Mês, Ano e Unidade
    selectMonth.addEventListener('change', (e) => {
      state.month = parseInt(e.target.value, 10);
      saveState();
      renderAll();
    });

    inputYear.addEventListener('change', (e) => {
      const y = parseInt(e.target.value, 10);
      if (y >= 2000 && y <= 2100) {
        state.year = y;
        saveState();
        renderAll();
      }
    });

    inputSector.addEventListener('input', (e) => {
      state.sector = e.target.value;
      saveState();
      // Atualiza no cabeçalho da tabela
      const unitTh = thead.querySelector('.cell-unit');
      if (unitTh) unitTh.textContent = state.sector;
    });

    // 2. Alternador de Modo: Edição vs Visualização
    btnModeEdit.addEventListener('click', () => {
      currentMode = 'edit';
      btnModeEdit.classList.add('active');
      btnModeView.classList.remove('active');
      document.body.classList.remove('mode-view');
      btnAddOperator.title = 'Adicionar Operador';
      if (btnAddObs) btnAddObs.title = 'Adicionar Linha de Observação';
      renderAll();
    });

    btnModeView.addEventListener('click', () => {
      currentMode = 'view';
      btnModeView.classList.add('active');
      btnModeEdit.classList.remove('active');
      document.body.classList.add('mode-view');
      btnAddOperator.title = 'Mude para o modo de Edição para habilitar adição de operador';
      if (btnAddObs) btnAddObs.title = 'Mude para o modo de Edição para habilitar adição de notas';
      closeShiftPopover();
      renderAll();
    });

    // 2.1 Alternador de Tema: Claro / Escuro
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('escala_theme', isDark ? 'dark' : 'light');
      });
    }

    // 3. Adicionar Operador e Observação
    btnAddOperator.addEventListener('click', addOperator);
    btnAddObs.addEventListener('click', addObservation);

    // 4. Imprimir / Salvar em PDF
    btnPrint.addEventListener('click', () => {
      window.print();
    });

    // 5. Dropdown de Opções
    btnMore.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && e.target !== btnMore) {
        dropdownMenu.classList.remove('show');
      }
      if (!shiftPopover.contains(e.target) && !e.target.classList.contains('cell-shift') && !e.target.classList.contains('cell-sub-shift')) {
        closeShiftPopover();
      }
    });

    // 6. Exportar e Importar JSON
    actionExportJson.addEventListener('click', (e) => {
      e.preventDefault();
      dropdownMenu.classList.remove('show');
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Escala_${state.sector}_${MONTH_NAMES[state.month]}_${state.year}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    actionImportJson.addEventListener('click', (e) => {
      e.preventDefault();
      dropdownMenu.classList.remove('show');
      fileInputJson.click();
    });

    fileInputJson.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (imported.operators && Array.isArray(imported.operators)) {
            state = imported;
            saveState();
            renderAll();
            alert('Escala importada com sucesso!');
          } else {
            alert('Formato de arquivo JSON inválido.');
          }
        } catch (err) {
          alert('Erro ao processar arquivo JSON.');
        }
      };
      reader.readAsText(file);
      fileInputJson.value = '';
    });

    actionClearAll.addEventListener('click', (e) => {
      e.preventDefault();
      dropdownMenu.classList.remove('show');
      if (confirm('Tem certeza de que deseja limpar todos os turnos de todos os operadores deste mês?')) {
        state.operators.forEach(op => {
          op.shifts = {};
          op.subShifts = {};
        });
        saveState();
        renderAll();
      }
    });

    // 7. Busca e Destaque de Operadores
    searchOperator.addEventListener('input', () => {
      btnClearSearch.style.display = searchOperator.value ? 'block' : 'none';
      renderBody();
      renderStatsTable();
    });

    btnClearSearch.addEventListener('click', () => {
      searchOperator.value = '';
      btnClearSearch.style.display = 'none';
      renderBody();
      renderStatsTable();
    });

    // 8. Ações no Corpo da Tabela (Delegation)
    tbody.addEventListener('click', (e) => {
      // Botão de excluir operador (X vermelho)
      const btnAction = e.target.closest('[data-action="del-op"]');
      if (btnAction) {
        deleteOperator(btnAction.getAttribute('data-op-id'));
        return;
      }

      // Clique nas células de turno
      const cell = e.target.closest('.cell-shift, .cell-sub-shift');
      if (cell) {
        if (currentMode === 'edit') {
          cell.focus();
          openShiftPopover(cell);
        }
      }
    });

    tbody.addEventListener('keydown', (e) => {
      const cell = e.target.closest('.cell-shift, .cell-sub-shift');
      if (cell) {
        handleCellKeyDown(e, cell);
      }
    });

    // Edição inline de Legenda e Nome do Operador
    tbody.addEventListener('blur', (e) => {
      const el = e.target;
      const action = el.getAttribute('data-action');
      const opId = el.getAttribute('data-op-id');
      if (!action || !opId) return;

      const op = state.operators.find(o => o.id === opId);
      if (!op) return;

      if (action === 'edit-leg') {
        op.leg = el.textContent.trim();
        saveState();
        renderStatsTable();
      } else if (action === 'edit-name') {
        op.name = el.textContent.trim();
        saveState();
        renderStatsTable();
      }
    }, true);

    // Previne quebras de linha com Enter em nomes/legendas
    tbody.addEventListener('keydown', (e) => {
      const el = e.target;
      if (el.hasAttribute('contenteditable') && e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
    });

    // 10. Popover de Seleção de Turno
    shiftPopover.addEventListener('click', (e) => {
      const btn = e.target.closest('.shift-pop-btn');
      if (!btn || !activeCell) return;
      const val = btn.getAttribute('data-val');
      const opId = activeCell.getAttribute('data-op-id');
      const day = parseInt(activeCell.getAttribute('data-day'), 10);
      const isSub = activeCell.getAttribute('data-is-sub') === 'true';

      updateCellShift(opId, day, isSub, val);
      closeShiftPopover();
    });

    // 11. Seção de Observações
    obsList.addEventListener('blur', (e) => {
      const el = e.target;
      if (el.getAttribute('data-action') === 'edit-obs') {
        const index = parseInt(el.getAttribute('data-index'), 10);
        state.observations[index] = el.textContent.trim();
        saveState();
      }
    }, true);

    obsList.addEventListener('click', (e) => {
      const btnDel = e.target.closest('[data-action="del-obs"]');
      if (btnDel) {
        deleteObservation(parseInt(btnDel.getAttribute('data-index'), 10));
      }
    });
  }

  // =========================================================================
  // AUXILIARES
  // =========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function selectElementContents(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('escala_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  // Inicialização
  initTheme();
  setupEventListeners();
  renderAll();
})();
