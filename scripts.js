/**
 * SISTEMA DE ESCALA OPERACIONAL
 * Lógica Completa de Confecção, Acompanhamento e Gestão
 */

(() => {
  'use strict';

  // Chave do localStorage
  const STORAGE_KEY = 'escala_operacional_v1';

  // Nomes dos meses e dias da semana abreviados (Maio não se abrevia para MAI na língua portuguesa)
  const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAIO', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const WEEKDAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  // Estrutura Padrão Inicial da Escala (Sem turnos hardcoded; populada conforme preenchimento)
  const DEFAULT_DATA = {
    year: 2026,
    month: 9, // Outubro (0-indexed)
    sector: 'EMS-SP',
    operators: [
      { id: 'op-1', leg: 'A', name: 'SO J. Nunes', shifts: {}, subShifts: {} },
      { id: 'op-2', leg: 'B', name: '2S Natividade', shifts: {}, subShifts: {} },
      { id: 'op-3', leg: 'C', name: '1S André', shifts: {}, subShifts: {} },
      { id: 'op-4', leg: 'D', name: 'Operador D.O', shifts: {}, subShifts: {} }
    ],
    observations: []
  };

  // Estado da Aplicação
  let state = loadState();
  let currentMode = 'edit'; // 'edit' ou 'view'
  let activeCell = null;
  let selectedOpId = null; // Operador selecionado cujo X de excluir fica visivel

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

  // Botão Explícito de Salvar Alterações na Nuvem
  const btnSaveCloud = document.getElementById('btn-save-cloud');
  const saveStatusSubtext = document.getElementById('save-status-subtext');
  let hasUnsavedChanges = false;
  let isSavingToCloud = false;
  let successResetTimeout = null;

  const thead = document.getElementById('schedule-thead');
  const tbody = document.getElementById('schedule-tbody');
  const obsList = document.getElementById('obs-list');
  const btnAddObs = document.getElementById('btn-add-obs');
  const shiftPopover = document.getElementById('shift-popover');

  const statsTbody = document.getElementById('stats-tbody');
  const statsTfoot = document.getElementById('stats-tfoot');
  const statsTeamAverage = document.getElementById('stats-team-average');
  const statsMemorialFooter = document.getElementById('stats-memorial-footer');

  const btnOpenExtraHours = document.getElementById('btn-open-extra-hours');
  const modalExtraHours = document.getElementById('modal-extra-hours');
  const btnCloseExtraHours = document.getElementById('btn-close-extra-hours');
  const btnSaveExtraHours = document.getElementById('btn-save-extra-hours');
  const extraHoursTbody = document.getElementById('extra-hours-tbody');

  // Tela de Login Dedicada
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  const formLoginScreen = document.getElementById('form-login-screen');
  const tabLoginSignin = document.getElementById('tab-login-signin');
  const tabLoginSignup = document.getElementById('tab-login-signup');
  const loginGroupName = document.getElementById('login-group-name');
  const loginInputName = document.getElementById('login-input-name');
  const loginInputUser = document.getElementById('login-input-user');
  const loginInputPass = document.getElementById('login-input-pass');
  const loginDialogTitle = document.getElementById('login-dialog-title');
  const loginDialogDesc = document.getElementById('login-dialog-desc');
  const loginScreenError = document.getElementById('login-screen-error');
  const btnLoginSubmit = document.getElementById('btn-login-submit');

  const btnAuthUser = document.getElementById('btn-auth-user');
  const userDisplayName = document.getElementById('user-display-name');
  const btnEditUserName = document.getElementById('btn-edit-user-name');
  const modalEditUser = document.getElementById('modal-edit-user');
  const btnCloseEditUser = document.getElementById('btn-close-edit-user');
  const btnCancelEditUser = document.getElementById('btn-cancel-edit-user');
  const btnSaveEditUser = document.getElementById('btn-save-edit-user');
  const inputEditUserName = document.getElementById('input-edit-user-name');
  const editUserError = document.getElementById('edit-user-error');
  const lastChangeDisplay = document.getElementById('last-change-display');
  const modalAuth = document.getElementById('modal-auth');
  const btnCloseAuth = document.getElementById('btn-close-auth');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formAuth = document.getElementById('form-auth');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const groupName = document.getElementById('group-name');
  const authName = document.getElementById('auth-name');
  const authUsername = document.getElementById('auth-username');
  const authPassword = document.getElementById('auth-password');
  const btnSubmitAuth = document.getElementById('btn-submit-auth');

  let currentUser = loadCurrentUser();
  let syncTimeout = null;

  function loadCurrentUser() {
    try {
      const u = localStorage.getItem('escala_current_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  function getMonthStorageKey(year, month, sector) {
    return `escala_${sector || 'EMS-SP'}_${year}_${month}`;
  }

  // =========================================================================
  // PERSISTÊNCIA & CARREGAMENTO DE DADOS (CLOUDFLARE D1 + LOCALSTORAGE)
  // =========================================================================
  function loadState() {
    try {
      const key = getMonthStorageKey(DEFAULT_DATA.year, DEFAULT_DATA.month, DEFAULT_DATA.sector);
      const saved = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.operators && Array.isArray(parsed.operators)) {
          // Se for o cache antigo com dados de exemplo da planilha ODS, limpa os turnos para manter o padrão novo
          const isLegacySample = parsed.observations && parsed.observations.some(o => typeof o === 'string' && o.includes('1S Hiremar: 08T'));
          if (isLegacySample) {
            parsed.operators.forEach(op => {
              op.shifts = {};
              op.subShifts = {};
              op.pimo = 0;
              op.instrucaoMet = 0;
            });
            parsed.observations = [];
            localStorage.setItem(key, JSON.stringify(parsed));
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar dados locais:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function updateSaveButtonUI(status) {
    if (!btnSaveCloud || !saveStatusSubtext) return;
    if (successResetTimeout) {
      clearTimeout(successResetTimeout);
      successResetTimeout = null;
    }

    const titleEl = btnSaveCloud.querySelector('.btn-save-title');

    if (status === 'saving') {
      btnSaveCloud.className = 'btn-save-cloud state-saving';
      if (titleEl) titleEl.textContent = 'Salvando na Nuvem...';
      saveStatusSubtext.className = 'save-status-subtext subtext-saving';
      saveStatusSubtext.textContent = 'comunicando com o servidor...';
      btnSaveCloud.disabled = true;
    } else if (status === 'pending') {
      btnSaveCloud.className = 'btn-save-cloud state-pending';
      if (titleEl) titleEl.textContent = 'Salvar Alterações';
      saveStatusSubtext.className = 'save-status-subtext subtext-pending';
      saveStatusSubtext.textContent = 'aguardando salvamento';
      btnSaveCloud.disabled = false;
    } else if (status === 'success') {
      btnSaveCloud.className = 'btn-save-cloud state-success';
      if (titleEl) titleEl.textContent = 'Alterações Salvas';
      saveStatusSubtext.className = 'save-status-subtext subtext-success';
      saveStatusSubtext.textContent = 'dados salvos e sincronizados';
      btnSaveCloud.disabled = false;

      // Mantém a confirmação por 2,5 segundos e volta ao estado neutro
      successResetTimeout = setTimeout(() => {
        if (!hasUnsavedChanges && !isSavingToCloud) {
          updateSaveButtonUI('clean');
        }
      }, 2500);
    } else if (status === 'error') {
      btnSaveCloud.className = 'btn-save-cloud state-error';
      if (titleEl) titleEl.textContent = 'Erro ao Salvar!';
      saveStatusSubtext.className = 'save-status-subtext subtext-error';
      saveStatusSubtext.textContent = 'falha de conexão ou sessão';
      btnSaveCloud.disabled = false;
    } else {
      // Estado limpo (clean)
      btnSaveCloud.className = 'btn-save-cloud state-clean';
      if (titleEl) titleEl.textContent = 'Alterações Salvas';
      saveStatusSubtext.className = 'save-status-subtext subtext-clean';
      saveStatusSubtext.textContent = 'nenhuma alteração';
      btnSaveCloud.disabled = false;
    }
  }

  function saveState(markAsPending = true) {
    try {
      const key = getMonthStorageKey(state.year, state.month, state.sector);
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      
      if (markAsPending) {
        hasUnsavedChanges = true;
        updateSaveButtonUI('pending');
        triggerSaveIndicator('Alterações pendentes', 'cloud-syncing');
      }
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
    }
  }

  function handleSessionExpired() {
    currentUser = null;
    localStorage.removeItem('escala_current_user');
    updateAuthViewState();
    alert('Sua sessão expirou ou é inválida. Por favor, faça login novamente para salvar as alterações.');
  }

  async function syncWithCloud() {
    if (isSavingToCloud) return false;

    if (!currentUser || !currentUser.token) {
      alert('Você precisa estar conectado para sincronizar as alterações com a nuvem.');
      openAuthModal();
      return false;
    }

    isSavingToCloud = true;
    updateSaveButtonUI('saving');
    triggerSaveIndicator('Salvando na nuvem...', 'cloud-syncing');

    try {
      const res = await fetch('/api/escala', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify(state)
      });

      if (res.status === 401) {
        isSavingToCloud = false;
        updateSaveButtonUI('error');
        handleSessionExpired();
        return false;
      }

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          hasUnsavedChanges = false;
          isSavingToCloud = false;
          updateSaveButtonUI('success');
          triggerSaveIndicator('☁️ Nuvem sincronizada', 'cloud-synced');
          return true;
        }
      }

      throw new Error('Servidor retornou resposta inesperada');
    } catch (err) {
      console.error('Erro ao salvar na nuvem:', err);
      isSavingToCloud = false;
      updateSaveButtonUI('error');
      triggerSaveIndicator('Erro ao salvar na nuvem');
      alert('Não foi possível salvar na nuvem. Verifique sua conexão e tente novamente pelo botão "Salvar Alterações".');
      return false;
    }
  }

  async function loadMonthFromCloud(year, month, sector) {
    triggerSaveIndicator('Carregando...', 'cloud-syncing');
    try {
      const url = `/api/escala?year=${year}&month=${month}&sector=${encodeURIComponent(sector)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          state = json.data;
          const key = getMonthStorageKey(year, month, sector);
          localStorage.setItem(key, JSON.stringify(state));
          hasUnsavedChanges = false;
          updateSaveButtonUI('clean');
          triggerSaveIndicator('☁️ Nuvem sincronizada', 'cloud-synced');
          renderAll();
          return;
        }
      }
    } catch (err) {
      console.warn('Não foi possível carregar da nuvem, usando cache local:', err);
    }

    // Fallback: se não conseguiu carregar da nuvem, tenta o cache local daquele mês
    const key = getMonthStorageKey(year, month, sector);
    const localData = localStorage.getItem(key);
    if (localData) {
      try {
        state = JSON.parse(localData);
      } catch (e) {}
    } else {
      // Se não tem local daquele mês, mantém o efetivo de operadores e limpa turnos
      state.year = year;
      state.month = month;
      state.sector = sector;
      state.operators.forEach(op => {
        op.shifts = {};
        op.subShifts = {};
        op.pimo = 0;
        op.instrucaoMet = 0;
      });
      state.observations = [];
    }
    updateSaveButtonUI('clean');
    triggerSaveIndicator('Salvo local');
    renderAll();
  }

  function triggerSaveIndicator(text = 'Salvo', className = '') {
    if (saveStatus) {
      saveStatus.textContent = text;
      saveStatus.className = 'save-status ' + className;
      saveStatus.style.opacity = '1';
    }
  }

  // =========================================================================
  // REGISTRO DE ÚLTIMA ALTERAÇÃO
  // =========================================================================
  function formatChangeTime(date = new Date()) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}h${m}min${s}s`;
  }

  function recordLastChange(description) {
    if (!description) return;
    const timeStr = formatChangeTime();
    const fullText = `Última alteração: ${timeStr} - ${description}`;

    state.lastChangeText = fullText;
    state.lastChangeTime = Date.now();

    try {
      const key = `escala_last_change_${state.sector || 'EMS-SP'}_${state.year}_${state.month}`;
      localStorage.setItem(key, fullText);
      localStorage.setItem('escala_last_change_recent', fullText);
    } catch (e) {}

    renderLastChange();
  }

  function renderLastChange() {
    if (!lastChangeDisplay) return;
    const key = `escala_last_change_${state.sector || 'EMS-SP'}_${state.year}_${state.month}`;
    const text = state.lastChangeText || localStorage.getItem(key) || localStorage.getItem('escala_last_change_recent') || '';
    if (text) {
      lastChangeDisplay.textContent = text;
      lastChangeDisplay.style.display = 'inline-flex';
    } else {
      lastChangeDisplay.textContent = '';
      lastChangeDisplay.style.display = 'none';
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
    renderLastChange();
  }

  function syncHeaderControls() {
    selectMonth.value = state.month;
    inputYear.value = state.year;
    inputSector.value = state.sector || 'EMS-SP';
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
      <th class="cell-unit col-name" contenteditable="${currentMode === 'edit'}" data-action="edit-sector" spellcheck="false" title="Clique para editar Unidade/Setor">${escapeHtml(state.sector || 'EMS-SP')}</th>`;
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
      const weekendClass = d.isWeekend ? ' col-weekend' : '';
      tr2 += `<th class="cell-day-num col-day${weekendClass}${todayClass}">${d.dayNumber}</th>`;
    });
    tr2 += `</tr>`;

    thead.innerHTML = tr1 + tr2;
  }

  function renderBody() {
    const daysInfo = getMonthDaysInfo(state.year, state.month);
    const searchTerm = (searchOperator.value || '').trim().toLowerCase();
    const today = new Date();
    const isCurrentYearMonth = today.getFullYear() === state.year && today.getMonth() === state.month;
    const currentDay = today.getDate();

    let html = '';

    state.operators.forEach((op, opIndex) => {
      const isMatch = searchTerm ? op.name.toLowerCase().includes(searchTerm) : false;
      const rowDimmed = searchTerm && !isMatch ? ' operator-dimmed' : '';
      const rowMatched = isMatch ? ' operator-matched' : '';

      const safeOpId = escapeHtml(op.id);
      const rowSelected = (currentMode === 'edit' && op.id === selectedOpId) ? ' op-selected' : '';

      // 1. Linha Amarela Principal do Operador
      html += `<tr class="row-operator${rowDimmed}${rowMatched}${rowSelected}" data-op-id="${safeOpId}">`;
      
      // Coluna Legenda (A, B, C...) com setas brancas modernas ao selecionar
      html += `<td class="cell-leg-val col-leg" data-op-id="${safeOpId}">
        <div class="leg-container">
          <span class="leg-text" 
                contenteditable="${currentMode === 'edit'}" 
                data-action="edit-leg" 
                data-op-id="${safeOpId}" 
                spellcheck="false">${escapeHtml(op.leg)}</span>
          <div class="leg-move-arrows no-print">
            <button type="button" class="btn-leg-arrow btn-leg-up" data-action="move-up" data-op-id="${safeOpId}" title="Mover para cima" ${opIndex === 0 ? 'disabled' : ''} aria-label="Mover operador para cima">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M6 1L11 7H1L6 1Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
            </button>
            <button type="button" class="btn-leg-arrow btn-leg-down" data-action="move-down" data-op-id="${safeOpId}" title="Mover para baixo" ${opIndex === state.operators.length - 1 ? 'disabled' : ''} aria-label="Mover operador para baixo">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M6 7L1 1H11L6 7Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </td>`;

      // Coluna Nome do Operador (1 clique seleciona • Duplo clique edita o nome)
      html += `<td class="cell-op-name col-name" data-op-id="${safeOpId}" title="${currentMode === 'edit' ? '1 clique seleciona • Duplo clique edita o nome' : ''}">
        <div class="name-container">
          <div class="op-actions-group no-print">
            <button class="btn-del-op" data-action="del-op" data-op-id="${safeOpId}" title="Excluir operador">&times;</button>
          </div>
          <span class="op-name-text" 
                contenteditable="false" 
                data-action="edit-name" 
                data-op-id="${safeOpId}" 
                spellcheck="false">${escapeHtml(op.name)}</span>
        </div>
      </td>`;

      // Células de Turno (1..31)
      daysInfo.forEach(d => {
        const val = op.shifts[d.dayNumber] || '';
        const weekendClass = d.isWeekend ? ' col-weekend' : '';
        const todayClass = (isCurrentYearMonth && d.dayNumber === currentDay) ? ' col-today' : '';
        html += `<td class="cell-shift col-day${weekendClass}${todayClass}" 
                    tabindex="${currentMode === 'edit' ? 0 : -1}" 
                    data-val="${escapeHtml(val)}" 
                    data-op-id="${safeOpId}" 
                    data-day="${d.dayNumber}" 
                    data-is-sub="false">${escapeHtml(val)}</td>`;
      });
      html += `</tr>`;

      // 2. Linha Separadora Contínua apenas entre operadores (não aceita inserção de turnos)
      if (opIndex < state.operators.length - 1) {
        html += `<tr class="row-blue-stripe${rowDimmed}" data-sub-op-id="${safeOpId}">`;
        html += `<td class="cell-blank-sub col-leg" aria-hidden="true"></td>`;
        html += `<td class="cell-sub-name col-name" aria-hidden="true"></td>`;
        html += `<td class="cell-separator-days" colspan="${daysInfo.length}" aria-hidden="true"></td>`;
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
    let etapa5xTotalDias = 0;
    let etapa5xUteisDias = 0;
    let etapa10xTotalDias = 0;
    let etapa10xUteisDias = 0;

    daysInfo.forEach(d => {
      // Turno principal
      const val = (op.shifts && op.shifts[d.dayNumber]) || '';
      if (val === 'M') {
        countM++;
      } else if (val === 'T') {
        countT++;
        etapa5xTotalDias++;
        if (!d.isWeekend) {
          etapa5xUteisDias++;
        }
        // Etapa 5X: R$ 67,50 no fim de semana; R$ 54,00 em dia útil (-R$ 13,50)
        etapa5x += d.isWeekend ? 67.5 : 54.0;
      } else if (val === 'R') {
        countR++;
        etapa10xTotalDias++;
        if (!d.isWeekend) {
          etapa10xUteisDias++;
        }
        // Etapa 10X: R$ 135,00 no fim de semana; R$ 121,50 em dia útil (-R$ 13,50)
        etapa10x += d.isWeekend ? 135.0 : 121.5;
      }
    });

    const totalShifts = countM + countT + countR;

    // Fórmulas Oficiais da Planilha de Carga Horária:
    // CTop (Carga Operacional): 7,5h por M e 9,5h por T
    const cTop = (countM * 7.5) + (countT * 9.5);
    // Abertura + Briefing + Fechamento: 0,25h por M (15min) e 0,50h por T (15min briefing + 15min fechamento)
    const briefing = (countM * 0.25) + (countT * 0.5);
    // RISAER: 24h por turno R
    const risaerHours = countR * 24.0;
    // Cargas Adicionais da Planilha Oficial: PIMO e Instrução MET
    const pimo = parseFloat(op.pimo || 0) || 0;
    const instrucaoMet = parseFloat(op.instrucaoMet || 0) || 0;

    // Carga Total individual = CTop + Abert/Brief/Fech + RISAER + PIMO + Instrução MET
    const totalHours = cTop + briefing + risaerHours + pimo + instrucaoMet;

    return {
      countM,
      countT,
      countR,
      cTop,
      briefing,
      risaerHours,
      pimo,
      instrucaoMet,
      totalShifts,
      totalHours,
      etapa5x,
      etapa10x,
      etapa5xTotalDias,
      etapa5xUteisDias,
      etapa10xTotalDias,
      etapa10xUteisDias
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
    let totalTeamR = 0;
    let totalTeamPimo = 0;
    let totalTeamInstrucaoMet = 0;

    const searchTerm = (searchOperator ? searchOperator.value : '').trim().toLowerCase();
    let rowsHtml = '';

    state.operators.forEach(op => {
      const stats = calculateOperatorStats(op, daysInfo);
      totalTeamShifts += stats.totalShifts;
      totalTeamHours += stats.totalHours;
      totalTeamE5 += stats.etapa5x;
      totalTeamE10 += stats.etapa10x;
      totalTeamR += stats.countR;
      totalTeamPimo += stats.pimo;
      totalTeamInstrucaoMet += stats.instrucaoMet;

      const isMatch = searchTerm ? op.name.toLowerCase().includes(searchTerm) : false;
      const rowDimmed = searchTerm && !isMatch ? ' operator-dimmed' : '';
      const rowMatched = isMatch ? ' operator-matched' : '';

      const breakdown = [];
      if (stats.countM > 0) breakdown.push(`${stats.countM}M`);
      if (stats.countT > 0) {
        // Alerta: Quando o número de serviços "T" for > 10, fica vermelho e em negrito
        if (stats.countT > 10) {
          breakdown.push(`<span class="shift-t-alert"><strong>${stats.countT}T</strong></span>`);
        } else {
          breakdown.push(`${stats.countT}T`);
        }
      }
      if (stats.countR > 0) breakdown.push(`${stats.countR}R`);
      const breakdownText = breakdown.length ? ` <span class="shifts-breakdown">(${breakdown.join(', ')})</span>` : '';

      const tooltipParts = [
        `CTop: ${formatHours(stats.cTop)}`,
        `Abert/Brief/Fech: ${formatHours(stats.briefing)}`
      ];
      if (stats.risaerHours > 0) tooltipParts.push(`RISAER: ${formatHours(stats.risaerHours)}`);
      if (stats.pimo > 0) tooltipParts.push(`PIMO: ${formatHours(stats.pimo)}`);
      if (stats.instrucaoMet > 0) tooltipParts.push(`MET: ${formatHours(stats.instrucaoMet)}`);
      tooltipParts.push(`Total: ${formatHours(stats.totalHours)}`);

      const e5AlertClass = stats.countT > 10 ? ' count-t-alert' : '';
      const e5TotalDiasStr = String(stats.etapa5xTotalDias).padStart(2, '0');
      const e5UteisDiasStr = String(stats.etapa5xUteisDias).padStart(2, '0');

      const e10TotalDiasStr = String(stats.etapa10xTotalDias).padStart(2, '0');
      const e10UteisDiasStr = String(stats.etapa10xUteisDias).padStart(2, '0');

      rowsHtml += `<tr class="row-stat-operator${rowDimmed}${rowMatched}" data-op-id="${escapeHtml(op.id)}">
        <td class="col-stat-leg"><span class="stat-leg-badge">${escapeHtml(op.leg)}</span></td>
        <td class="col-stat-op" title="${escapeHtml(op.name)}">${escapeHtml(op.name)}</td>
        <td class="col-stat-shifts">${stats.totalShifts}${breakdownText}</td>
        <td class="col-stat-ctop">${formatHours(stats.cTop)}</td>
        <td class="col-stat-briefing">${formatHours(stats.briefing)}</td>
        <td class="col-stat-risaer">${formatHours(stats.risaerHours)}</td>
        <td class="col-stat-pimo">${formatHours(stats.pimo)}</td>
        <td class="col-stat-met">${formatHours(stats.instrucaoMet)}</td>
        <td class="col-stat-total"><strong>${formatHours(stats.totalHours)}</strong></td>
        <td class="col-stat-e5">
          <div class="etapa-split-cell">
            <div class="etapa-info-subcol">
              <span class="etapa-badge-row${e5AlertClass}"><strong>${e5TotalDiasStr}</strong> Dias totais</span>
              <span class="etapa-badge-row"><strong>${e5UteisDiasStr}</strong> Dias úteis</span>
            </div>
            <div class="etapa-val-subcol">
              <span class="etapa-val-amount">${formatCurrency(stats.etapa5x)}</span>
            </div>
          </div>
        </td>
        <td class="col-stat-e10">
          <div class="etapa-split-cell">
            <div class="etapa-info-subcol">
              <span class="etapa-badge-row"><strong>${e10TotalDiasStr}</strong> Dias totais</span>
              <span class="etapa-badge-row"><strong>${e10UteisDiasStr}</strong> Dias úteis</span>
            </div>
            <div class="etapa-val-subcol">
              <span class="etapa-val-amount">${formatCurrency(stats.etapa10x)}</span>
            </div>
          </div>
        </td>
      </tr>`;
    });

    statsTbody.innerHTML = rowsHtml;

    // Memorial de cálculo oficial da equipe (Fórmula da Planilha C19):
    // ((Dias * 17) + (Dias * 0,75) + (Qtd RISAER Equipe * 24) + PIMO Total) / Qtd Operadores + (MET Total / Qtd Operadores)
    const organHours = (totalDays * 17) + (totalDays * 0.75) + (totalTeamR * 24) + totalTeamPimo;
    const teamAverageHours = totalOps > 0 ? (organHours / totalOps) + (totalTeamInstrucaoMet / totalOps) : 0;
    const teamCeilHours = Math.ceil(teamAverageHours);
    const avgTeamActualHours = totalOps > 0 ? (totalTeamHours / totalOps) : 0;

    // Rodapé de Totais Gerais da Equipe (linha TOT removida a pedido do usuário)
    if (statsTfoot) {
      statsTfoot.innerHTML = '';
    }

    if (statsTeamAverage) {
      statsTeamAverage.textContent = `Média: ${teamAverageHours.toFixed(2).replace('.', ',')}h (${teamCeilHours}h) / OPR`;
    }

    if (statsMemorialFooter) {
      const formulaPimo = totalTeamPimo > 0 ? ` + ${totalTeamPimo}h PIMO` : '';
      const formulaRisaer = totalTeamR > 0 ? ` + (${totalTeamR}×24h RISAER)` : '';
      const formulaMet = totalTeamInstrucaoMet > 0 ? ` + (${totalTeamInstrucaoMet}h MET / ${totalOps})` : '';
      statsMemorialFooter.innerHTML = `<span><strong>Memorial de cálculo:</strong> [(${totalDays}×17h + ${totalDays}×0,75h${formulaRisaer}${formulaPimo}) / ${totalOps}${formulaMet}] = <strong>${teamAverageHours.toFixed(2).replace('.', ',')}h</strong> &rarr; <strong>${teamCeilHours}h</strong> (arredondar sempre para o inteiro superior)</span>`;
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
    recordLastChange(`Operador [${newOp.name}] foi adicionado`);
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
      const opName = op.name;
      state.operators = state.operators.filter(o => o.id !== opId);
      if (selectedOpId === opId) {
        selectedOpId = null;
      }
      saveState();
      recordLastChange(`Operador [${opName}] foi excluído`);
      renderBody();
      renderStatsTable();
    }
  }

  function moveOperator(opId, direction) {
    if (currentMode !== 'edit' || !opId) return;
    const index = state.operators.findIndex(o => o.id === opId);
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= state.operators.length) return;

    const [movedOp] = state.operators.splice(index, 1);
    state.operators.splice(targetIndex, 0, movedOp);

    selectedOpId = opId;
    saveState();
    recordLastChange(`Operador [${movedOp.name}] foi movido para ${direction < 0 ? 'cima' : 'baixo'}`);
    renderBody();
    renderStatsTable();
  }

  function addObservation() {
    if (currentMode !== 'edit') return;
    state.observations.push('Nova observação de escala;');
    saveState();
    recordLastChange('Observações atualizadas');
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
    recordLastChange('Observações atualizadas');
    renderObservations();
  }

  // =========================================================================
  // GESTÃO DE CARGAS ADICIONAIS (PIMO & INSTRUÇÃO MET)
  // =========================================================================
  function openExtraHoursModal() {
    if (!modalExtraHours || !extraHoursTbody) return;
    let html = '';
    state.operators.forEach(op => {
      const pimoVal = (op.pimo !== undefined && op.pimo !== null && op.pimo !== 0) ? op.pimo : '';
      const metVal = (op.instrucaoMet !== undefined && op.instrucaoMet !== null && op.instrucaoMet !== 0) ? op.instrucaoMet : '';
      html += `<tr data-op-id="${escapeHtml(op.id)}">
        <td class="col-op-td">
          <div class="op-cell-content">
            <span class="stat-leg-badge">${escapeHtml(op.leg)}</span>
            <span class="op-modal-name">${escapeHtml(op.name)}</span>
          </div>
        </td>
        <td class="col-hours-td">
          <input type="number" step="0.5" min="0" max="200" class="input-extra-hours input-pimo" value="${pimoVal}" placeholder="0">
        </td>
        <td class="col-hours-td">
          <input type="number" step="0.5" min="0" max="200" class="input-extra-hours input-met" value="${metVal}" placeholder="0">
        </td>
      </tr>`;
    });
    extraHoursTbody.innerHTML = html;
    modalExtraHours.classList.remove('hidden');
  }

  function closeExtraHoursModal() {
    if (!modalExtraHours) return;
    modalExtraHours.classList.add('hidden');
  }

  function saveExtraHoursModal() {
    if (!extraHoursTbody) return;
    const rows = extraHoursTbody.querySelectorAll('tr[data-op-id]');
    rows.forEach(tr => {
      const opId = tr.getAttribute('data-op-id');
      const inputPimo = tr.querySelector('.input-pimo');
      const inputMet = tr.querySelector('.input-met');
      const op = state.operators.find(o => o.id === opId);
      if (op) {
        op.pimo = inputPimo && inputPimo.value.trim() !== '' ? Math.max(0, parseFloat(inputPimo.value) || 0) : 0;
        op.instrucaoMet = inputMet && inputMet.value.trim() !== '' ? Math.max(0, parseFloat(inputMet.value) || 0) : 0;
      }
    });
    saveState();
    recordLastChange('Cargas extras PIMO / MET atualizadas');
    renderStatsTable();
    closeExtraHoursModal();
  }

  // =========================================================================
  // AUTENTICAÇÃO E TELA DE LOGIN DEDICADA
  // =========================================================================
  let authMode = 'login'; // 'login' ou 'register'

  function isValidPasswordRule(password) {
    if (!password || password.length < 8) return false;
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    return specialCharRegex.test(password);
  }

  function setupSystemThemeDetection() {
    const mediaQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;

    function applyOsTheme() {
      if (!loginScreen) return;
      if (mediaQuery.matches) {
        loginScreen.classList.add('os-dark');
        loginScreen.classList.remove('os-light');
      } else {
        loginScreen.classList.remove('os-dark');
        loginScreen.classList.add('os-light');
      }
    }

    try {
      mediaQuery.addEventListener('change', applyOsTheme);
    } catch (e) {
      if (mediaQuery.addListener) mediaQuery.addListener(applyOsTheme);
    }
    applyOsTheme();
  }

  function updateAuthViewState() {
    if (!loginScreen || !appScreen) return;

    if (currentUser) {
      // Usuário autenticado: esconde tela de login e exibe aplicação
      loginScreen.style.display = 'none';
      appScreen.style.display = 'block';
      if (userDisplayName) {
        userDisplayName.textContent = currentUser.name || currentUser.username;
      }
      if (btnAuthUser) {
        btnAuthUser.title = `Conectado como ${currentUser.name || currentUser.username}. Clique para sair.`;
      }
      if (btnEditUserName) {
        btnEditUserName.title = `Editar nome ou posto/graduação (${currentUser.name || currentUser.username})`;
      }
    } else {
      // Não autenticado: exibe tela de login e oculta aplicação
      loginScreen.style.display = 'flex';
      appScreen.style.display = 'none';
      if (loginScreenError) {
        loginScreenError.classList.add('hidden');
        loginScreenError.textContent = '';
      }
      setTimeout(() => {
        if (loginInputUser) loginInputUser.focus();
      }, 50);
    }
  }

  let activeLoginTab = 'login'; // 'login' ou 'register'

  function switchLoginScreenTab(mode) {
    activeLoginTab = mode;
    if (loginScreenError) {
      loginScreenError.classList.add('hidden');
      loginScreenError.textContent = '';
    }

    if (mode === 'login') {
      if (tabLoginSignin) tabLoginSignin.classList.add('active');
      if (tabLoginSignup) tabLoginSignup.classList.remove('active');
      if (loginGroupName) loginGroupName.style.display = 'none';
      if (loginDialogTitle) loginDialogTitle.textContent = 'Acesso ao Sistema';
      if (loginDialogDesc) loginDialogDesc.textContent = 'Informe suas credenciais para acessar a escala';
      if (btnLoginSubmit) btnLoginSubmit.innerHTML = '<span>Entrar</span>';
      if (loginInputUser) loginInputUser.focus();
    } else {
      if (tabLoginSignin) tabLoginSignin.classList.remove('active');
      if (tabLoginSignup) tabLoginSignup.classList.add('active');
      if (loginGroupName) loginGroupName.style.display = 'flex';
      if (loginDialogTitle) loginDialogTitle.textContent = 'Criar Nova Conta';
      if (loginDialogDesc) loginDialogDesc.textContent = 'Cadastre seu usuário para acessar e gerenciar a escala';
      if (btnLoginSubmit) btnLoginSubmit.innerHTML = '<span>Criar Conta e Acessar</span>';
      if (loginInputName) loginInputName.focus();
    }
  }

  async function handleLoginScreenSubmit(e) {
    e.preventDefault();
    if (!loginInputUser || !loginInputPass) return;

    const username = (loginInputUser.value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]/g, '')
      .trim();
    const password = loginInputPass.value;
    const name = loginInputName ? loginInputName.value.trim() : '';

    if (loginScreenError) {
      loginScreenError.classList.add('hidden');
      loginScreenError.textContent = '';
    }

    if (activeLoginTab === 'register' && !name) {
      if (loginScreenError) {
        loginScreenError.textContent = 'Informe seu nome ou nome de guerra.';
        loginScreenError.classList.remove('hidden');
      }
      if (loginInputName) loginInputName.focus();
      return;
    }

    // Validação da regra: 8 caracteres + caractere especial
    if (!isValidPasswordRule(password)) {
      if (loginScreenError) {
        loginScreenError.textContent = 'A senha deve conter no mínimo 8 caracteres e pelo menos um caractere especial (ex: !@#$%).';
        loginScreenError.classList.remove('hidden');
      }
      loginInputPass.focus();
      return;
    }

    btnLoginSubmit.disabled = true;
    btnLoginSubmit.innerHTML = activeLoginTab === 'login' ? '<span>Verificando...</span>' : '<span>Cadastrando...</span>';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: activeLoginTab,
          username,
          password,
          name: activeLoginTab === 'register' ? (name || username) : undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || (activeLoginTab === 'login' ? 'Usuário ou senha incorretos' : 'Erro ao cadastrar'));
      }

      currentUser = { ...json.user, token: json.token };
      localStorage.setItem('escala_current_user', JSON.stringify(currentUser));
      updateAuthViewState();
      // Carrega dados da nuvem
      loadMonthFromCloud(state.year, state.month, state.sector);
    } catch (err) {
      if (loginScreenError) {
        loginScreenError.textContent = err.message || 'Erro na autenticação';
        loginScreenError.classList.remove('hidden');
      }
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.innerHTML = activeLoginTab === 'login' ? '<span>Entrar</span>' : '<span>Criar Conta e Acessar</span>';
    }
  }

  function handleLogout() {
    const nome = (currentUser && (currentUser.name || currentUser.username)) || 'operador';
    if (confirm(`Deseja realmente sair da sessão de ${nome}?`)) {
      currentUser = null;
      localStorage.removeItem('escala_current_user');
      if (loginInputPass) loginInputPass.value = '';
      updateAuthViewState();
    }
  }

  function openAuthModal() {
    if (modalAuth) {
      switchAuthTab('register');
      if (authErrorMsg) authErrorMsg.classList.add('hidden');
      if (formAuth) formAuth.reset();
      modalAuth.classList.remove('hidden');
      if (authUsername) authUsername.focus();
    }
  }

  function closeAuthModal() {
    if (modalAuth) modalAuth.classList.add('hidden');
  }

  function switchAuthTab(mode) {
    authMode = mode;
    const titleEl = document.getElementById('auth-modal-title');
    if (mode === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (groupName) groupName.style.display = 'none';
      if (btnSubmitAuth) btnSubmitAuth.textContent = 'Entrar';
      if (titleEl) titleEl.textContent = 'Entrar no Sistema';
    } else {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.add('active');
      if (groupName) groupName.style.display = 'flex';
      if (btnSubmitAuth) btnSubmitAuth.textContent = 'Cadastrar Operador';
      if (titleEl) titleEl.textContent = 'Cadastrar Novo Operador';
    }
    if (authErrorMsg) authErrorMsg.classList.add('hidden');
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    if (authErrorMsg) authErrorMsg.classList.add('hidden');
    const username = authUsername.value.trim();
    const password = authPassword.value;
    const name = authName ? authName.value.trim() : '';

    if (!username || !password) {
      if (authErrorMsg) {
        authErrorMsg.textContent = 'Informe usuário e senha';
        authErrorMsg.classList.remove('hidden');
      }
      return;
    }

    if (authMode === 'register' && !isValidPasswordRule(password)) {
      if (authErrorMsg) {
        authErrorMsg.textContent = 'A senha deve conter no mínimo 8 caracteres e pelo menos um caractere especial (ex: !@#$%).';
        authErrorMsg.classList.remove('hidden');
      }
      return;
    }

    btnSubmitAuth.disabled = true;
    btnSubmitAuth.textContent = 'Processando...';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          username,
          password,
          name: authMode === 'register' ? (name || username) : undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro na autenticação');
      }

      if (authMode === 'login') {
        currentUser = { ...json.user, token: json.token };
        localStorage.setItem('escala_current_user', JSON.stringify(currentUser));
        updateAuthViewState();
        closeAuthModal();
      } else {
        alert('Operador cadastrado com sucesso!');
        closeAuthModal();
      }
    } catch (err) {
      if (authErrorMsg) {
        authErrorMsg.textContent = err.message;
        authErrorMsg.classList.remove('hidden');
      }
    } finally {
      btnSubmitAuth.disabled = false;
      btnSubmitAuth.textContent = authMode === 'login' ? 'Entrar' : 'Cadastrar Operador';
    }
  }

  // =========================================================================
  // EDIÇÃO DE IDENTIFICAÇÃO / POSTO / NOME DO USUÁRIO
  // =========================================================================
  function openEditUserModal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const modal = document.getElementById('modal-edit-user');
    if (!modal) return;
    const errEl = document.getElementById('edit-user-error');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
    const currentName = currentUser?.name || currentUser?.username || (userDisplayName ? userDisplayName.textContent.trim() : '');
    const input = document.getElementById('input-edit-user-name');
    if (input) {
      input.value = (currentName && currentName !== 'Operador') ? currentName : (currentUser?.name || '');
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setTimeout(() => {
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }

  function closeEditUserModal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const modal = document.getElementById('modal-edit-user');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
    const errEl = document.getElementById('edit-user-error');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
  }

  window.openEditUserModal = openEditUserModal;
  window.closeEditUserModal = closeEditUserModal;

  async function handleSaveNewUserName(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!inputEditUserName) return;
    const newName = inputEditUserName.value.trim();

    if (!newName) {
      if (editUserError) {
        editUserError.textContent = 'Informe seu nome ou posto/graduação.';
        editUserError.classList.remove('hidden');
      }
      return;
    }

    if (!currentUser) {
      currentUser = {
        name: newName,
        username: newName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]/g, '') || 'operador'
      };
    }

    const oldName = currentUser.name || currentUser.username || (userDisplayName ? userDisplayName.textContent.trim() : '');

    if (btnSaveEditUser) {
      btnSaveEditUser.disabled = true;
      btnSaveEditUser.textContent = 'Salvando...';
    }

    try {
      // 1. Persiste no servidor se token estiver ativo
      if (currentUser.token) {
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ action: 'update_name', name: newName })
          });
          if (res.ok) {
            const json = await res.json();
            if (json.token) currentUser.token = json.token;
            if (json.user && json.user.name) {
              currentUser.name = json.user.name;
            } else {
              currentUser.name = newName;
            }
          } else {
            currentUser.name = newName;
          }
        } catch (fetchErr) {
          console.warn('Erro ao conectar à API de autenticação:', fetchErr);
          currentUser.name = newName;
        }
      } else {
        currentUser.name = newName;
      }

      // 2. Salva no localStorage do usuário
      localStorage.setItem('escala_current_user', JSON.stringify(currentUser));

      // 3. Atualiza o texto imediatamente na barra superior
      if (userDisplayName) {
        userDisplayName.textContent = newName;
      }

      // 4. Propaga alteração em toda a escala onde o nome antigo constar como operador
      let scaleUpdated = false;
      if (state.operators && Array.isArray(state.operators)) {
        state.operators.forEach(op => {
          if (op.name === oldName || (oldName && op.name.toLowerCase() === oldName.toLowerCase())) {
            op.name = newName;
            scaleUpdated = true;
          }
        });
      }

      // 5. Atualiza UI e registra log de alteração
      updateAuthViewState();
      if (scaleUpdated) {
        saveState();
        renderBody();
        renderStatsTable();
      }
      recordLastChange(`Identificação do usuário atualizada para [${newName}]`);

      closeEditUserModal();
    } catch (err) {
      console.warn('Erro ao atualizar nome:', err);
      // Fallback local se offline
      currentUser.name = newName;
      localStorage.setItem('escala_current_user', JSON.stringify(currentUser));
      if (userDisplayName) {
        userDisplayName.textContent = newName;
      }
      updateAuthViewState();
      closeEditUserModal();
    } finally {
      if (btnSaveEditUser) {
        btnSaveEditUser.disabled = false;
        btnSaveEditUser.textContent = 'Salvar Alteração';
      }
    }
  }

  window.handleSaveNewUserName = handleSaveNewUserName;

  function getShiftFullName(val) {
    if (!val) return '';
    const code = val.trim().toUpperCase();
    if (code === 'M') return 'Manhã';
    if (code === 'T') return 'Tarde';
    if (code === 'R') return 'RISAER';
    if (code === 'F') return 'Folga';
    return code;
  }

  function formatShiftDescriptor(day, val) {
    const dayStr = String(day).padStart(2, '0');
    const name = getShiftFullName(val);
    return name ? `${dayStr} ${name}` : dayStr;
  }

  // =========================================================================
  // EDIÇÃO DE CÉLULAS & ATALHOS DE TECLADO
  // =========================================================================
  function updateCellShift(opId, day, val) {
    const op = state.operators.find(o => o.id === opId);
    if (!op) return;

    const oldVal = (op.shifts && op.shifts[day]) ? op.shifts[day] : '';
    val = val.trim().toUpperCase();

    if (val === oldVal) return;

    if (val) op.shifts[day] = val;
    else delete op.shifts[day];

    const opName = op.name || (currentUser?.name || 'Operador');
    if (!val) {
      const shiftDesc = formatShiftDescriptor(day, oldVal);
      recordLastChange(`Turno [${shiftDesc}] de [${opName}] foi excluído`);
    } else {
      const shiftDesc = formatShiftDescriptor(day, val);
      recordLastChange(`Turno [${shiftDesc}] foi adicionado para [${opName}]`);
    }

    saveState();

    // Atualiza apenas a célula específica no DOM para performance instantânea
    const selector = `[data-op-id="${opId}"] [data-day="${day}"]`;
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
    if (shiftPopover.style.display !== 'none' && activeCell === cell) {
      closeShiftPopover();
      return;
    }
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

    // Teclas diretas de turnos: M, T, N, F, etc.
    if (key.length === 1 && /^[a-zA-Z0-9*]$/.test(key)) {
      e.preventDefault();
      const val = key.toUpperCase();
      updateCellShift(opId, day, val);
      // Avança para o próximo dia automaticamente
      moveFocusCell(td, 0, 1);
      return;
    }

    // Teclas para limpar: Backspace, Delete ou Espaço
    if (key === 'Backspace' || key === 'Delete' || key === ' ') {
      e.preventDefault();
      updateCellShift(opId, day, '');
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
      if (shiftPopover.style.display !== 'none') {
        closeShiftPopover();
      } else {
        openShiftPopover(td);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      closeShiftPopover();
    }
  }

  function moveFocusCell(currentTd, rowDelta, colDelta) {
    const tr = currentTd.parentElement;
    const currentDay = parseInt(currentTd.getAttribute('data-day'), 10);
    const totalDays = getDaysInMonth(state.year, state.month);

    if (colDelta !== 0) {
      const nextDay = currentDay + colDelta;
      if (nextDay >= 1 && nextDay <= totalDays) {
        const nextCell = tr.querySelector(`[data-day="${nextDay}"]`);
        if (nextCell) nextCell.focus();
      }
    } else if (rowDelta !== 0) {
      // Movimento vertical (navega diretamente entre linhas de operadores, pulando a linha separadora)
      const opRows = Array.from(tbody.querySelectorAll('tr.row-operator'));
      const currentOpIdx = opRows.indexOf(tr);
      const targetOpIdx = currentOpIdx + rowDelta;
      if (targetOpIdx >= 0 && targetOpIdx < opRows.length) {
        const targetRow = opRows[targetOpIdx];
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
    function stepMonth(delta) {
      let targetMonth = state.month + delta;
      let targetYear = state.year;

      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      } else if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }

      if (targetYear < 2020 || targetYear > 2035) return;

      if (hasUnsavedChanges) {
        if (!confirm('Você possui alterações não salvas neste mês. Deseja mudar de mês e descartá-las?')) {
          return;
        }
      }

      if (selectMonth) selectMonth.value = targetMonth;
      if (inputYear && targetYear !== state.year) inputYear.value = targetYear;

      loadMonthFromCloud(targetYear, targetMonth, state.sector);
    }

    window.stepMonth = stepMonth;

    const btnNextMonth = document.getElementById('btn-next-month');
    const btnPrevMonth = document.getElementById('btn-prev-month');

    if (btnNextMonth) {
      btnNextMonth.addEventListener('click', (e) => {
        e.preventDefault();
        stepMonth(1);
      });
    }

    if (btnPrevMonth) {
      btnPrevMonth.addEventListener('click', (e) => {
        e.preventDefault();
        stepMonth(-1);
      });
    }

    selectMonth.addEventListener('change', (e) => {
      const newMonth = parseInt(e.target.value, 10);
      if (hasUnsavedChanges) {
        if (!confirm('Você possui alterações não salvas neste mês. Deseja mudar de mês e descartá-las?')) {
          e.target.value = state.month;
          return;
        }
      }
      loadMonthFromCloud(state.year, newMonth, state.sector);
    });

    function stepYear(delta) {
      const targetYear = state.year + delta;
      if (targetYear < 2020 || targetYear > 2035) return;

      if (hasUnsavedChanges) {
        if (!confirm('Você possui alterações não salvas neste mês. Deseja mudar de ano e descartá-las?')) {
          return;
        }
      }

      if (inputYear) inputYear.value = targetYear;
      loadMonthFromCloud(targetYear, state.month, state.sector);
    }

    window.stepYear = stepYear;

    const btnNextYear = document.getElementById('btn-next-year');
    const btnPrevYear = document.getElementById('btn-prev-year');

    if (btnNextYear) {
      btnNextYear.addEventListener('click', (e) => {
        e.preventDefault();
        stepYear(1);
      });
    }

    if (btnPrevYear) {
      btnPrevYear.addEventListener('click', (e) => {
        e.preventDefault();
        stepYear(-1);
      });
    }

    inputYear.addEventListener('change', (e) => {
      const y = parseInt(e.target.value, 10);
      if (y >= 2020 && y <= 2035) {
        if (hasUnsavedChanges) {
          if (!confirm('Você possui alterações não salvas neste mês. Deseja mudar de ano e descartá-las?')) {
            e.target.value = state.year;
            return;
          }
        }
        loadMonthFromCloud(y, state.month, state.sector);
      } else {
        e.target.value = state.year;
      }
    });

    inputSector.addEventListener('change', (e) => {
      const val = e.target.value.trim() || 'EMS-SP';
      if (state.sector !== val) {
        state.sector = val;
        saveState();
        recordLastChange(`Setor atualizado para ${val}`);
        // Atualiza no cabeçalho da tabela em tempo real
        const unitTh = thead.querySelector('.cell-unit');
        if (unitTh) unitTh.textContent = val;
      }
    });

    // Edição inline da Unidade / Setor diretamente na célula da tabela
    thead.addEventListener('blur', (e) => {
      const el = e.target;
      if (el && el.getAttribute('data-action') === 'edit-sector') {
        const val = el.textContent.trim().toUpperCase() || 'EMS-SP';
        if (state.sector !== val) {
          state.sector = val;
          el.textContent = val;
          if (inputSector) inputSector.value = val;
          saveState();
          recordLastChange(`Setor atualizado para ${val}`);
        }
      }
    }, true);

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
    function triggerPrint(e) {
      if (e) e.preventDefault();
      if (selectedOpId) {
        selectedOpId = null;
        renderBody();
      }
      closeShiftPopover();
      window.print();
    }
    window.triggerPrint = triggerPrint;

    if (btnPrint) {
      btnPrint.addEventListener('click', triggerPrint);
    }

    // 5. Dropdown de Opções
    btnMore.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && e.target !== btnMore) {
        dropdownMenu.classList.remove('show');
      }
      if (!shiftPopover.contains(e.target) && !e.target.closest('.cell-shift')) {
        closeShiftPopover();
      }
      // Se clicou fora da célula do nome, da legenda e dos botões de ação:
      if (!e.target.closest('.cell-op-name') && !e.target.closest('.cell-leg-val') && !e.target.closest('.btn-del-op')) {
        // Fecha qualquer caixa de edição de texto que esteja aberta
        closeOpNameEditing();

        // Fecha a seleção do operador (remove as setas e o botão X)
        if (selectedOpId) {
          selectedOpId = null;
          tbody.querySelectorAll('.row-operator.op-selected').forEach(tr => {
            tr.classList.remove('op-selected');
          });
        }
      }
    });

    // Tecla Enter ou Escape global para fechar caixa de seleção de turno ou operador selecionado
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        // Fecha popover de turno se estiver aberto
        if (shiftPopover.style.display !== 'none') {
          closeShiftPopover();
        }
        // Se houver operador selecionado e não estiver com o foco em campo de texto
        if (selectedOpId && !e.target.classList.contains('op-name-text') && !e.target.classList.contains('leg-text')) {
          closeOpNameEditing();
          selectedOpId = null;
          tbody.querySelectorAll('.row-operator.op-selected').forEach(tr => {
            tr.classList.remove('op-selected');
          });
        }
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
          const raw = JSON.parse(evt.target.result);
          if (!raw || typeof raw !== 'object' || !Array.isArray(raw.operators)) {
            alert('Formato de arquivo JSON inválido.');
            return;
          }

          const parsedYear = parseInt(raw.year, 10);
          const parsedMonth = parseInt(raw.month, 10);
          const cleanYear = (!isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) ? parsedYear : state.year;
          const cleanMonth = (!isNaN(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11) ? parsedMonth : state.month;
          const cleanSector = String(raw.sector || state.sector || 'EMS-SP').trim().slice(0, 50);

          const sanitizedOperators = [];
          for (const op of raw.operators) {
            if (!op || typeof op !== 'object') continue;
            const opId = String(op.id || ('op-' + Math.random().toString(36).slice(2, 9))).trim().slice(0, 50);
            const opLeg = String(op.leg || '').trim().slice(0, 10);
            const opName = String(op.name || '').trim().slice(0, 100);

            const shifts = {};
            if (op.shifts && typeof op.shifts === 'object') {
              for (const [day, val] of Object.entries(op.shifts)) {
                const dayNum = parseInt(day, 10);
                if (dayNum >= 1 && dayNum <= 31 && typeof val === 'string') {
                  shifts[dayNum] = val.trim().toUpperCase().slice(0, 10);
                }
              }
            }

            const subShifts = {};
            if (op.subShifts && typeof op.subShifts === 'object') {
              for (const [day, val] of Object.entries(op.subShifts)) {
                const dayNum = parseInt(day, 10);
                if (dayNum >= 1 && dayNum <= 31 && typeof val === 'string') {
                  subShifts[dayNum] = val.trim().toUpperCase().slice(0, 10);
                }
              }
            }

            sanitizedOperators.push({
              id: opId,
              leg: opLeg,
              name: opName,
              shifts: shifts,
              subShifts: subShifts,
              pimo: Math.max(0, Math.min(200, parseFloat(op.pimo || 0) || 0)),
              instrucaoMet: Math.max(0, Math.min(200, parseFloat(op.instrucaoMet || 0) || 0))
            });
          }

          if (sanitizedOperators.length === 0) {
            alert('O arquivo JSON não contém operadores válidos.');
            return;
          }

          const sanitizedObservations = Array.isArray(raw.observations)
            ? raw.observations.map(o => String(o || '').trim().slice(0, 300)).filter(Boolean)
            : [];

          state = {
            year: cleanYear,
            month: cleanMonth,
            sector: cleanSector,
            operators: sanitizedOperators,
            observations: sanitizedObservations
          };

          saveState();
          recordLastChange('Escala importada');
          renderAll();
          alert('Escala importada com sucesso!');
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
        recordLastChange('Turnos do mês limpos');
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

    // 8. Edição do Nome do Operador via Duplo Clique / Duplo Toque
    function closeOpNameEditing(targetSpan) {
      const spans = targetSpan ? [targetSpan] : tbody.querySelectorAll('.op-name-text.is-editing, .op-name-text[contenteditable="true"]');
      spans.forEach(span => {
        span.contentEditable = 'false';
        span.classList.remove('is-editing');
      });
    }

    function enableOpNameEditing(span) {
      if (currentMode !== 'edit' || !span) return;
      const opId = span.getAttribute('data-op-id');
      if (!opId) return;

      selectedOpId = opId;
      tbody.querySelectorAll('.row-operator').forEach(tr => {
        if (tr.getAttribute('data-op-id') === opId) {
          tr.classList.add('op-selected');
        } else {
          tr.classList.remove('op-selected');
        }
      });

      span.contentEditable = 'true';
      span.classList.add('is-editing');
      span.focus();

      // Posiciona o cursor no final do texto
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(span);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
    }

    // Duplo clique no Desktop para abrir edição de nome
    tbody.addEventListener('dblclick', (e) => {
      if (currentMode !== 'edit') return;
      const cellName = e.target.closest('.cell-op-name');
      if (cellName) {
        const span = cellName.querySelector('.op-name-text');
        if (span) {
          enableOpNameEditing(span);
        }
      }
    });

    // 9. Ações no Corpo da Tabela (Delegation de Cliques e Duplo Toque)
    let lastOpTapTime = 0;
    let lastOpTapId = null;

    tbody.addEventListener('click', (e) => {
      // Botão de mover operador para cima (seta na legenda)
      const btnUp = e.target.closest('[data-action="move-up"]');
      if (btnUp && !btnUp.disabled) {
        moveOperator(btnUp.getAttribute('data-op-id'), -1);
        return;
      }

      // Botão de mover operador para baixo (seta na legenda)
      const btnDown = e.target.closest('[data-action="move-down"]');
      if (btnDown && !btnDown.disabled) {
        moveOperator(btnDown.getAttribute('data-op-id'), 1);
        return;
      }

      // Botão de excluir operador (X vermelho)
      const btnDel = e.target.closest('[data-action="del-op"]');
      if (btnDel) {
        deleteOperator(btnDel.getAttribute('data-op-id'));
        return;
      }

      // Clique ou Duplo Toque na célula do nome do operador
      const cellName = e.target.closest('.cell-op-name');
      if (cellName && currentMode === 'edit') {
        const opId = cellName.getAttribute('data-op-id');
        const span = cellName.querySelector('.op-name-text');

        // Se já está em modo de edição, permite posicionar o cursor normalmente
        if (span && span.contentEditable === 'true') {
          return;
        }

        const now = Date.now();
        // Detecção de Duplo Toque / Duplo Clique (funciona em Desktop, Mobile e Tablet)
        if (lastOpTapId === opId && (now - lastOpTapTime) < 380) {
          lastOpTapTime = 0;
          lastOpTapId = null;
          if (span) {
            enableOpNameEditing(span);
          }
          return;
        }

        // 1 Único Clique: apenas seleciona a célula (exibe X vermelho e setas na legenda)
        lastOpTapTime = now;
        lastOpTapId = opId;
        selectedOpId = opId;

        tbody.querySelectorAll('.row-operator').forEach(tr => {
          if (tr.getAttribute('data-op-id') === opId) {
            tr.classList.add('op-selected');
          } else {
            tr.classList.remove('op-selected');
          }
        });
        return;
      }

      // Clique na célula da legenda também seleciona o operador
      const cellLeg = e.target.closest('.cell-leg-val');
      if (cellLeg && currentMode === 'edit') {
        const opId = cellLeg.getAttribute('data-op-id');
        if (opId && selectedOpId !== opId) {
          selectedOpId = opId;
          tbody.querySelectorAll('.row-operator').forEach(tr => {
            if (tr.getAttribute('data-op-id') === opId) {
              tr.classList.add('op-selected');
            } else {
              tr.classList.remove('op-selected');
            }
          });
        }
        return;
      }

      // Clique nas células de turno
      const cell = e.target.closest('.cell-shift');
      if (cell) {
        if (currentMode === 'edit') {
          cell.focus();
          openShiftPopover(cell);
        }
      }
    });

    tbody.addEventListener('keydown', (e) => {
      const el = e.target;

      // Teclas Enter e Escape ao editar nome do operador
      if (el.classList.contains('op-name-text') || el.getAttribute('data-action') === 'edit-name') {
        if (e.key === 'Enter') {
          e.preventDefault();
          const opId = el.getAttribute('data-op-id');
          const op = state.operators.find(o => o.id === opId);
          if (op) {
            const newName = el.textContent.trim();
            if (op.name !== newName) {
              op.name = newName;
              recordLastChange(`Operador renomeado para [${op.name}]`);
            }
          }
          closeOpNameEditing(el);
          el.blur();
          // Remove a seleção do operador ao apertar Enter
          selectedOpId = null;
          tbody.querySelectorAll('.row-operator.op-selected').forEach(tr => {
            tr.classList.remove('op-selected');
          });
          saveState();
          renderStatsTable();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const opId = el.getAttribute('data-op-id');
          const op = state.operators.find(o => o.id === opId);
          if (op) {
            el.textContent = op.name;
          }
          closeOpNameEditing(el);
          el.blur();
          selectedOpId = null;
          tbody.querySelectorAll('.row-operator.op-selected').forEach(tr => {
            tr.classList.remove('op-selected');
          });
          return;
        }
      }

      // Previne quebras de linha com Enter na legenda
      if (el.getAttribute('data-action') === 'edit-leg' && e.key === 'Enter') {
        e.preventDefault();
        el.blur();
        return;
      }

      // Navegação por teclado nas células de turno
      const cell = e.target.closest('.cell-shift');
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
        const newLeg = el.textContent.trim();
        if (op.leg !== newLeg) {
          op.leg = newLeg;
          saveState();
          recordLastChange(`Legenda alterada para ${op.leg} (${op.name})`);
          renderStatsTable();
        }
      } else if (action === 'edit-name') {
        const newName = el.textContent.trim();
        if (op.name !== newName) {
          op.name = newName;
          closeOpNameEditing(el);
          saveState();
          recordLastChange(`Operador renomeado para [${op.name}]`);
          renderStatsTable();
        } else {
          closeOpNameEditing(el);
        }
      }
    }, true);

    // 10. Popover de Seleção de Turno
    shiftPopover.addEventListener('click', (e) => {
      const btn = e.target.closest('.shift-pop-btn');
      if (!btn || !activeCell) return;
      const val = btn.getAttribute('data-val');
      const opId = activeCell.getAttribute('data-op-id');
      const day = parseInt(activeCell.getAttribute('data-day'), 10);

      updateCellShift(opId, day, val);
      closeShiftPopover();
    });

    // 11. Seção de Observações
    obsList.addEventListener('blur', (e) => {
      const el = e.target;
      if (el.getAttribute('data-action') === 'edit-obs') {
        const index = parseInt(el.getAttribute('data-index'), 10);
        const newText = el.textContent.trim();
        if (state.observations[index] !== newText) {
          state.observations[index] = newText;
          saveState();
          recordLastChange('Observações atualizadas');
        }
      }
    }, true);

    obsList.addEventListener('click', (e) => {
      const btnDel = e.target.closest('[data-action="del-obs"]');
      if (btnDel) {
        deleteObservation(parseInt(btnDel.getAttribute('data-index'), 10));
      }
    });

    // 12. Modal de Cargas Adicionais (PIMO / MET)
    if (btnOpenExtraHours) {
      btnOpenExtraHours.addEventListener('click', openExtraHoursModal);
    }
    if (btnCloseExtraHours) {
      btnCloseExtraHours.addEventListener('click', closeExtraHoursModal);
    }
    if (btnSaveExtraHours) {
      btnSaveExtraHours.addEventListener('click', saveExtraHoursModal);
    }
    if (modalExtraHours) {
      modalExtraHours.addEventListener('click', (e) => {
        if (e.target === modalExtraHours) {
          closeExtraHoursModal();
        }
      });
    }

    // 13. Autenticação e Tela de Login Dedicada
    const sanitizeUserField = (inputEl) => {
      if (!inputEl) return;
      inputEl.addEventListener('input', (e) => {
        const val = e.target.value;
        const sanitized = val
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9._-]/g, '');
        if (val !== sanitized) {
          e.target.value = sanitized;
        }
      });
    };
    sanitizeUserField(loginInputUser);
    sanitizeUserField(authUsername);

    if (formLoginScreen) {
      formLoginScreen.addEventListener('submit', handleLoginScreenSubmit);
    }
    if (tabLoginSignin) {
      tabLoginSignin.addEventListener('click', () => switchLoginScreenTab('login'));
    }
    if (tabLoginSignup) {
      tabLoginSignup.addEventListener('click', () => switchLoginScreenTab('register'));
    }
    if (btnAuthUser) {
      btnAuthUser.addEventListener('click', handleLogout);
    }
    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', closeAuthModal);
    }
    if (tabLogin) {
      tabLogin.addEventListener('click', () => switchAuthTab('login'));
    }
    if (tabRegister) {
      tabRegister.addEventListener('click', () => switchAuthTab('register'));
    }
    if (formAuth) {
      formAuth.addEventListener('submit', handleAuthSubmit);
    }
    if (modalAuth) {
      modalAuth.addEventListener('click', (e) => {
        if (e.target === modalAuth) {
          closeAuthModal();
        }
      });
    }

    // Modal de Edição de Nome / Posto do Usuário
    if (btnEditUserName) {
      btnEditUserName.addEventListener('click', openEditUserModal);
    }
    if (btnCloseEditUser) {
      btnCloseEditUser.addEventListener('click', closeEditUserModal);
    }
    if (btnCancelEditUser) {
      btnCancelEditUser.addEventListener('click', closeEditUserModal);
    }
    if (btnSaveEditUser) {
      btnSaveEditUser.addEventListener('click', handleSaveNewUserName);
    }
    if (inputEditUserName) {
      inputEditUserName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveNewUserName();
        } else if (e.key === 'Escape') {
          closeEditUserModal();
        }
      });
    }
    if (modalEditUser) {
      modalEditUser.addEventListener('click', (e) => {
        if (e.target === modalEditUser) {
          closeEditUserModal();
        }
      });
    }

    // 14. Botão de Salvar Alterações na Nuvem
    if (btnSaveCloud) {
      btnSaveCloud.addEventListener('click', () => {
        if (isSavingToCloud) return;
        syncWithCloud();
      });
    }

    // Aviso do navegador para evitar perda de dados no F5 ou fechamento acidental
    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Existem alterações não salvas na nuvem. Deseja realmente sair?';
        return e.returnValue;
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
    // Padrão oficial é o tema claro. Só ativa tema escuro se o usuário tiver salvo 'dark' explicitamente.
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  // Inicialização
  initTheme();
  setupSystemThemeDetection();
  setupEventListeners();
  updateSaveButtonUI('clean');
  renderAll();
  updateAuthViewState();
  if (currentUser) {
    loadMonthFromCloud(state.year, state.month, state.sector);
  }
})();
