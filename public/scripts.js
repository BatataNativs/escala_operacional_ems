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
    operators: [],
    observations: [],
    customHolidays: [],
    disabledHolidays: []
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

  // Botão Explícito de Salvar Alterações na Nuvem & Desfazer
  const btnSaveCloud = document.getElementById('btn-save-cloud');
  const btnUndoChanges = document.getElementById('btn-undo-changes');
  const saveStatusSubtext = document.getElementById('save-status-subtext');
  let hasUnsavedChanges = false;
  let isSavingToCloud = false;
  let successResetTimeout = null;

  // Histórico de alterações não salvas (desfazer antes de salvar)
  let unsavedHistory = [];
  let baselineSavedJson = JSON.stringify(state);
  const MAX_UNDO_HISTORY = 40;

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

  // Modo Edição Rápida (Pintura de Turnos)
  let activePaintTool = null; // 'M', 'T', 'R' ou null
  const paintModeBar = document.getElementById('paint-mode-bar');
  const paintModeBadge = document.getElementById('paint-mode-badge');
  const btnExitPaintMode = document.getElementById('btn-exit-paint-mode');
  const sheetContainer = document.getElementById('sheet-container');
  const chipPaintButtons = document.querySelectorAll('.chip-btn-paint');

  // Gestão de Feriados e Dias Não Úteis
  const chipHolidayLegend = document.getElementById('chip-holiday-legend');
  const badgeHolidayCount = document.getElementById('badge-holiday-count');
  const actionManageHolidays = document.getElementById('action-manage-holidays');
  const menuHolidayCount = document.getElementById('menu-holiday-count');
  const modalHolidays = document.getElementById('modal-holidays');
  const modalHolidaysTitle = document.getElementById('modal-holidays-title');
  const btnCloseHolidays = document.getElementById('btn-close-holidays');
  const btnConfirmHolidays = document.getElementById('btn-confirm-holidays');
  const holidaysTbody = document.getElementById('holidays-tbody');
  const selectNewHolidayDay = document.getElementById('select-new-holiday-day');
  const inputNewHolidayName = document.getElementById('input-new-holiday-name');
  const btnAddCustomHoliday = document.getElementById('btn-add-custom-holiday');

  // Tela de Login Dedicada
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  const formLoginScreen = document.getElementById('form-login-screen');
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

  // Banner e Modal de Troca de Senha
  const bannerMustChangePassword = document.getElementById('banner-must-change-password');
  const btnBannerChangePassword = document.getElementById('btn-banner-change-password');
  const btnOpenChangePassword = document.getElementById('btn-open-change-password');
  const modalChangePassword = document.getElementById('modal-change-password');
  const formChangePassword = document.getElementById('form-change-password');
  const btnCloseChangePassword = document.getElementById('btn-close-change-password');
  const btnCancelChangePassword = document.getElementById('btn-cancel-change-password');
  const inputCurrentPass = document.getElementById('input-current-pass');
  const inputNewPass = document.getElementById('input-new-pass');
  const inputConfirmPass = document.getElementById('input-confirm-pass');
  const changePassError = document.getElementById('change-pass-error');
  const changePassSuccess = document.getElementById('change-pass-success');
  const btnSaveChangePassword = document.getElementById('btn-save-change-password');

  // Painel do Administrador: Reset de Senha de Operadores
  const btnAdminResetUsers = document.getElementById('btn-admin-reset-users');
  const actionAdminResetUsers = document.getElementById('action-admin-reset-users');
  const modalAdminReset = document.getElementById('modal-admin-reset-password');
  const formAdminReset = document.getElementById('form-admin-reset-password');
  const btnCloseAdminReset = document.getElementById('btn-close-admin-reset');
  const btnCancelAdminReset = document.getElementById('btn-cancel-admin-reset');
  const selectAdminTargetUser = document.getElementById('select-admin-target-user');
  const inputAdminTempPass = document.getElementById('input-admin-temp-password');
  const btnGenTempPass = document.getElementById('btn-gen-temp-password');
  const adminResetError = document.getElementById('admin-reset-error');
  const adminResetSuccess = document.getElementById('admin-reset-success');
  const btnSubmitAdminReset = document.getElementById('btn-submit-admin-reset');

  // Modal de Conflito de Escala (ICA 63-33)
  const modalConflictWarning = document.getElementById('modal-conflict-warning');
  const conflictModalMessage = document.getElementById('conflict-modal-message');
  const btnCloseConflict = document.getElementById('btn-close-conflict');
  const btnCancelConflict = document.getElementById('btn-cancel-conflict');
  const btnConfirmConflict = document.getElementById('btn-confirm-conflict');
  let pendingConflictAction = null;

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
          if (!Array.isArray(parsed.customHolidays)) {
            parsed.customHolidays = [];
          }
          if (!Array.isArray(parsed.disabledHolidays)) {
            parsed.disabledHolidays = [];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar dados locais:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function updateUndoButtonUI() {
    if (!btnUndoChanges) return;
    const canUndo = unsavedHistory.length > 0;
    btnUndoChanges.disabled = !canUndo;
    if (canUndo) {
      btnUndoChanges.setAttribute('title', `Desfazer última alteração não salva (${unsavedHistory.length} na fila) [Ctrl+Z]`);
    } else {
      btnUndoChanges.setAttribute('title', 'Nenhuma alteração não salva para desfazer');
    }
  }

  function pushUnsavedSnapshot() {
    try {
      const snapshot = JSON.stringify(state);
      // Evita duplicar se for idêntico ao último snapshot empilhado
      if (unsavedHistory.length > 0 && unsavedHistory[unsavedHistory.length - 1] === snapshot) {
        return;
      }
      unsavedHistory.push(snapshot);
      if (unsavedHistory.length > MAX_UNDO_HISTORY) {
        unsavedHistory.shift();
      }
      updateUndoButtonUI();
    } catch (e) {
      console.warn('Erro ao salvar snapshot de desfazer:', e);
    }
  }

  function handleUndo() {
    if (unsavedHistory.length === 0) return;
    
    // Desempilha o estado anterior
    const prevSnapshot = unsavedHistory.pop();
    if (!prevSnapshot) return;

    try {
      state = JSON.parse(prevSnapshot);
      
      // Salva no localStorage sem forçar nova marcação se voltou ao baseline
      const key = getMonthStorageKey(state.year, state.month, state.sector);
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // Verifica se o estado atual voltou exatamente ao baseline salvo
      const currentJson = JSON.stringify(state);
      if (currentJson === baselineSavedJson) {
        hasUnsavedChanges = false;
        updateSaveButtonUI('clean');
        triggerSaveIndicator('Alterações desfeitas');
      } else {
        hasUnsavedChanges = true;
        updateSaveButtonUI('pending');
        triggerSaveIndicator('Desfeito', 'cloud-syncing');
      }

      updateUndoButtonUI();
      renderAll();
      renderLastChange();
    } catch (err) {
      console.error('Erro ao restaurar estado anterior:', err);
    }
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
    updateUndoButtonUI();
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

  function handleSessionExpired(msg) {
    currentUser = null;
    localStorage.removeItem('escala_current_user');
    clearRenderedDom();
    updateAuthViewState();
    const alertMsg = msg || 'Sua sessão expirou ou é inválida. Por favor, faça login novamente.';
    if (loginScreenError) {
      loginScreenError.textContent = alertMsg;
      loginScreenError.classList.remove('hidden');
    }
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
        handleSessionExpired('Sua sessão expirou. Por favor, faça login novamente para salvar as alterações.');
        alert('Sua sessão expirou. Faça login novamente.');
        return false;
      }

      if (res.status === 403) {
        isSavingToCloud = false;
        updateSaveButtonUI('error');
        triggerSaveIndicator('Permissão negada');
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || 'Acesso negado para salvar alterações.');
        return false;
      }

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          hasUnsavedChanges = false;
          isSavingToCloud = false;
          baselineSavedJson = JSON.stringify(state);
          unsavedHistory = [];
          updateUndoButtonUI();
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
    if (!currentUser || !currentUser.token) return;
    triggerSaveIndicator('Carregando...', 'cloud-syncing');
    try {
      const url = `/api/escala?year=${year}&month=${month}&sector=${encodeURIComponent(sector)}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        }
      });
      if (res.status === 401) {
        handleSessionExpired('Sua sessão anterior expirou ou precisa ser renovada. Faça login novamente.');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const key = getMonthStorageKey(year, month, sector);
          const localSaved = localStorage.getItem(key);
          let localState = null;
          if (localSaved) {
            try { localState = JSON.parse(localSaved); } catch (e) {}
          }

          // Verifica se a nuvem retornou turnos vazios, mas o navegador já possuía turnos salvos localmente
          const cloudHasShifts = json.data.operators && json.data.operators.some(op => op.shifts && Object.keys(op.shifts).length > 0);
          const localHasShifts = localState && localState.operators && localState.operators.some(op => op.shifts && Object.keys(op.shifts).length > 0);

          if (!cloudHasShifts && localHasShifts) {
            // Preserva os dados locais preenchidos para não apagar a escala do usuário
            state = localState;
            hasUnsavedChanges = true;
            updateSaveButtonUI('pending');
            triggerSaveIndicator('Recuperado do cache local', 'cloud-syncing');
          } else {
            state = json.data;
            localStorage.setItem(key, JSON.stringify(state));
            baselineSavedJson = JSON.stringify(state);
            unsavedHistory = [];
            hasUnsavedChanges = false;
            updateSaveButtonUI('clean');
            updateUndoButtonUI();
            triggerSaveIndicator('☁️ Nuvem sincronizada', 'cloud-synced');
          }

          state.lastChangeText = null;
          renderLastChange();
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
    baselineSavedJson = JSON.stringify(state);
    unsavedHistory = [];
    updateSaveButtonUI('clean');
    updateUndoButtonUI();
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
    const text = state.lastChangeText || localStorage.getItem(key) || '';
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
  // MOTOR DE FERIADOS (NACIONAIS, ESTADUAIS DE SP E MUNICIPAIS DA CAPITAL)
  // =========================================================================

  // Algoritmo de Meeus/Jones/Butcher para cálculo astronômico do Domingo de Páscoa
  function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed (2: Março, 3: Abril)
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  }

  // Retorna a lista de feriados oficiais (Nacionais, Estado de SP e Capital de SP)
  function getOfficialHolidaysForYear(year) {
    const easter = getEasterSunday(year);
    const addD = (days) => {
      const d = new Date(year, easter.getMonth(), easter.getDate() + days);
      return { month: d.getMonth(), day: d.getDate() };
    };

    const carnavalSeg = addD(-48);
    const carnavalTer = addD(-47);
    const sextaSanta = addD(-2);
    const corpusChristi = addD(60);

    return [
      // Feriados Nacionais Fixos (Lei 10.607/2002 e Lei 6.802/1980)
      { id: 'nat-01-01', month: 0, day: 1, name: 'Confraternização Universal (Ano Novo)', type: 'Feriado Nacional' },
      { id: 'nat-04-21', month: 3, day: 21, name: 'Tiradentes', type: 'Feriado Nacional' },
      { id: 'nat-05-01', month: 4, day: 1, name: 'Dia Mundial do Trabalho', type: 'Feriado Nacional' },
      { id: 'nat-09-07', month: 8, day: 7, name: 'Independência do Brasil', type: 'Feriado Nacional' },
      { id: 'nat-10-12', month: 9, day: 12, name: 'Nossa Senhora Aparecida (Padroeira do Brasil)', type: 'Feriado Nacional' },
      { id: 'nat-11-02', month: 10, day: 2, name: 'Finados', type: 'Feriado Nacional' },
      { id: 'nat-11-15', month: 10, day: 15, name: 'Proclamação da República', type: 'Feriado Nacional' },
      { id: 'nat-11-20', month: 10, day: 20, name: 'Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)', type: 'Feriado Nacional' },
      { id: 'nat-12-25', month: 11, day: 25, name: 'Natal', type: 'Feriado Nacional' },

      // Feriado Estadual - São Paulo (Lei Estadual nº 9.497/1997)
      { id: 'sp-07-09', month: 6, day: 9, name: 'Revolução Constitucionalista de 1932', type: 'Feriado Estadual (SP)' },

      // Feriado Municipal - São Paulo Capital (Lei Municipal nº 14.485/2007)
      { id: 'sp-01-25', month: 0, day: 25, name: 'Aniversário da Cidade de São Paulo', type: 'Feriado Municipal (SP)' },

      // Feriados Móveis
      { id: 'mov-carnaval-seg', month: carnavalSeg.month, day: carnavalSeg.day, name: 'Segunda-feira de Carnaval', type: 'Ponto Facultativo' },
      { id: 'mov-carnaval-ter', month: carnavalTer.month, day: carnavalTer.day, name: 'Terça-feira de Carnaval', type: 'Ponto Facultativo / Carnaval' },
      { id: 'mov-sexta-santa', month: sextaSanta.month, day: sextaSanta.day, name: 'Sexta-feira Santa (Paixão de Cristo)', type: 'Feriado Nacional' },
      { id: 'mov-corpus-christi', month: corpusChristi.month, day: corpusChristi.day, name: 'Corpus Christi', type: 'Feriado Municipal (SP)' }
    ];
  }

  function getHolidayForDay(year, month, day, appState) {
    const s = appState || state;
    const disabled = (s && Array.isArray(s.disabledHolidays)) ? s.disabledHolidays : [];
    const customs = (s && Array.isArray(s.customHolidays)) ? s.customHolidays : [];

    // 1. Feriados personalizados do usuário no mês
    const customMatch = customs.find(c => parseInt(c.day, 10) === day && (c.month === undefined || parseInt(c.month, 10) === month));
    if (customMatch) {
      return {
        id: customMatch.id || `custom-${day}`,
        name: customMatch.name || 'Feriado Local',
        type: customMatch.type || 'Personalizado / OM',
        isCustom: true,
        isDisabled: false
      };
    }

    // 2. Feriados oficiais
    const officialList = getOfficialHolidaysForYear(year);
    const match = officialList.find(h => h.month === month && h.day === day);
    if (!match) return null;

    const isDisabled = disabled.includes(match.id) || disabled.includes(day);
    return {
      ...match,
      isCustom: false,
      isDisabled
    };
  }

  function getMonthHolidays(year, month, appState) {
    const s = appState || state;
    const disabled = (s && Array.isArray(s.disabledHolidays)) ? s.disabledHolidays : [];
    const customs = (s && Array.isArray(s.customHolidays)) ? s.customHolidays : [];

    const officialList = getOfficialHolidaysForYear(year).filter(h => h.month === month);
    const list = officialList.map(h => {
      const isDisabled = disabled.includes(h.id) || disabled.includes(h.day);
      return {
        ...h,
        isCustom: false,
        isDisabled
      };
    });

    customs.forEach(c => {
      if (c.month === undefined || parseInt(c.month, 10) === month) {
        list.push({
          id: c.id || `custom-${c.day}`,
          month,
          day: parseInt(c.day, 10),
          name: c.name || 'Feriado Local',
          type: c.type || 'Personalizado / OM',
          isCustom: true,
          isDisabled: false
        });
      }
    });

    list.sort((a, b) => a.day - b.day);
    return list;
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
      const holiday = getHolidayForDay(year, month, day, state);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = Boolean(holiday && !holiday.isDisabled);
      const isBusinessDay = !isWeekend && !isHoliday; // Dia útil

      days.push({
        dayNumber: day,
        dayOfWeek,
        dayOfWeekName: WEEKDAY_NAMES[dayOfWeek],
        isWeekend,
        isHoliday,
        holidayName: holiday ? holiday.name : null,
        holidayType: holiday ? holiday.type : null,
        holidayIsCustom: holiday ? Boolean(holiday.isCustom) : false,
        isBusinessDay
      });
    }
    return days;
  }

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
    // Feriados mantêm as cores originais da semana (cell-weekend ou cell-weekday)
    let tr1 = `<tr>
      <th class="cell-month col-leg">${monthShort}</th>
      <th class="cell-unit col-name" contenteditable="${currentMode === 'edit'}" data-action="edit-sector" spellcheck="false" title="Clique para editar Unidade/Setor">${escapeHtml(state.sector || 'EMS-SP')}</th>`;
    daysInfo.forEach(d => {
      const cls = d.isWeekend ? 'cell-weekend' : 'cell-weekday';
      const todayClass = (isCurrentYearMonth && d.dayNumber === currentDay) ? ' col-today' : '';
      const holidayTitle = d.isHoliday ? ` title="${escapeHtml(d.holidayName)} (${d.holidayType}) - Não útil"` : '';
      tr1 += `<th class="${cls} col-day${todayClass}"${holidayTitle}>${d.dayOfWeekName}</th>`;
    });
    tr1 += `</tr>`;

    // Linha 2: Leg., Operadores, 1 a 31
    // Apenas o número do dia fica em vermelho no feriado, sem a estrelinha
    let tr2 = `<tr>
      <th class="cell-hdr-leg col-leg">Leg.</th>
      <th class="cell-hdr-op col-name">Operadores</th>`;
    daysInfo.forEach(d => {
      const todayClass = (isCurrentYearMonth && d.dayNumber === currentDay) ? ' col-today' : '';
      const weekendClass = d.isWeekend ? ' col-weekend' : '';
      const holidayClass = d.isHoliday ? ' col-holiday' : '';
      const holidayTitle = d.isHoliday ? ` title="Feriado: ${escapeHtml(d.holidayName)} (${d.holidayType}) - Dia não útil"` : '';
      tr2 += `<th class="cell-day-num col-day${weekendClass}${holidayClass}${todayClass}"${holidayTitle}>${d.dayNumber}</th>`;
    });
    tr2 += `</tr>`;

    thead.innerHTML = tr1 + tr2;

    // Atualiza contadores de feriados na barra de legendas e no menu
    const activeHolidays = daysInfo.filter(d => d.isHoliday);
    if (badgeHolidayCount) {
      badgeHolidayCount.textContent = activeHolidays.length;
    }
    if (menuHolidayCount) {
      menuHolidayCount.textContent = activeHolidays.length;
    }
  }

  // =========================================================================
  // REGRAS DE NEGÓCIO E ALERTAS DA ICA 63-33
  // =========================================================================

  // Detecta sequências de mais de 5 folgas consecutivas (> 5 dias sem serviço operacional - ICA 63-33, item 8.4.5.1)
  function getConsecutiveOffDaysMap(op, daysInfo) {
    const map = {};
    let currentStreak = [];

    for (let i = 0; i < daysInfo.length; i++) {
      const d = daysInfo[i];
      const val = (op.shifts && op.shifts[d.dayNumber]) ? op.shifts[d.dayNumber].trim() : '';
      const isOff = (!val);

      if (isOff) {
        currentStreak.push(d.dayNumber);
      } else {
        if (currentStreak.length > 5) {
          const len = currentStreak.length;
          const startDay = currentStreak[0];
          const endDay = currentStreak[len - 1];
          currentStreak.forEach((dayNum, idx) => {
            let type = 'mid';
            if (idx === 0) type = 'start';
            else if (idx === len - 1) type = 'end';
            map[dayNum] = { type, length: len, startDay, endDay };
          });
        }
        currentStreak = [];
      }
    }

    if (currentStreak.length > 5) {
      const len = currentStreak.length;
      const startDay = currentStreak[0];
      const endDay = currentStreak[len - 1];
      currentStreak.forEach((dayNum, idx) => {
        let type = 'mid';
        if (idx === 0) type = 'start';
        else if (idx === len - 1) type = 'end';
        map[dayNum] = { type, length: len, startDay, endDay };
      });
    }

    return map;
  }

  // Detecta conflito de 24h de descanso pós-RISAER -> Turno M (ICA 63-33, Tab. 30)
  function getOperatorConflictsMap(op, daysInfo) {
    const map = {};
    if (!op || !op.shifts) return map;

    daysInfo.forEach(d => {
      const day = d.dayNumber;
      const val = op.shifts[day];
      if (val === 'M') {
        const prevVal = op.shifts[day - 1];
        if (prevVal === 'R') {
          map[day] = {
            type: 'RM_CONFLICT',
            prevDay: day - 1,
            message: `⚠️ Conflito de Escala (ICA 63-33, Tab. 30): Turno M às 06h00 imediatamente após serviço RISAER (24h) no dia ${day - 1}. É exigido intervalo mínimo de 24 horas de não trabalho.`
          };
        }
      }
    });

    return map;
  }

  // Atualiza em tempo real as células da linha do operador (streaks de folga e conflito)
  function refreshOperatorRowCells(opId) {
    const op = state.operators.find(o => o.id === opId);
    if (!op) return;

    const daysInfo = getMonthDaysInfo(state.year, state.month);
    const offMap = getConsecutiveOffDaysMap(op, daysInfo);
    const conflictMap = getOperatorConflictsMap(op, daysInfo);

    daysInfo.forEach(d => {
      const selector = `[data-op-id="${opId}"] [data-day="${d.dayNumber}"]`;
      const td = tbody.querySelector(selector);
      if (!td) return;

      const val = (op.shifts && op.shifts[d.dayNumber]) || '';
      td.textContent = val;
      td.setAttribute('data-val', val);

      td.classList.remove('streak-off-start', 'streak-off-mid', 'streak-off-end', 'cell-conflict-rm');

      let cellTitle = '';
      const offInfo = offMap[d.dayNumber];
      if (offInfo) {
        if (offInfo.type === 'start') td.classList.add('streak-off-start');
        else if (offInfo.type === 'end') td.classList.add('streak-off-end');
        else td.classList.add('streak-off-mid');
        cellTitle = `Período com ${offInfo.length} dias consecutivos sem escala operacional (ICA 63-33, item 8.4.5.1)`;
      }

      const conflictInfo = conflictMap[d.dayNumber];
      if (conflictInfo) {
        td.classList.add('cell-conflict-rm');
        cellTitle = conflictInfo.message;
      }

      if (cellTitle) {
        td.setAttribute('title', cellTitle);
      } else {
        td.removeAttribute('title');
      }
    });
  }

  // Gerenciamento do Modal de Alerta de Conflito R -> M
  function showConflictModal({ opName, day, prevDay, val, onConfirm, onCancel }) {
    pendingConflictAction = { onConfirm, onCancel };

    if (val === 'M') {
      conflictModalMessage.innerHTML = `O operador <strong>${escapeHtml(opName)}</strong> está escalado em <strong>RISAER (24h)</strong> no dia <strong>${prevDay}</strong>.<br><br>A assunção do turno <strong>M (06h00 às 13h30)</strong> no dia <strong>${day}</strong> não cumpre o intervalo regulamentar mínimo de 24 horas de não trabalho pós-RISAER.`;
    } else {
      conflictModalMessage.innerHTML = `O operador <strong>${escapeHtml(opName)}</strong> já possui turno <strong>M (06h00 às 13h30)</strong> no dia <strong>${day}</strong>.<br><br>Escalá-lo em <strong>RISAER</strong> no dia <strong>${prevDay}</strong> não permite o intervalo regulamentar mínimo de 24 horas de descanso antes do início do turno M.`;
    }

    modalConflictWarning.classList.remove('hidden');
    if (btnCancelConflict) btnCancelConflict.focus();
  }

  function closeConflictModal(confirmed = false) {
    if (modalConflictWarning) {
      modalConflictWarning.classList.add('hidden');
    }
    if (pendingConflictAction) {
      const action = pendingConflictAction;
      pendingConflictAction = null;
      if (confirmed) {
        action.onConfirm();
      } else {
        action.onCancel();
      }
    }
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

      // Células de Turno (1..31) com detecção de blocos de folga (>5 dias) e conflitos ICA 63-33
      const offMap = getConsecutiveOffDaysMap(op, daysInfo);
      const conflictMap = getOperatorConflictsMap(op, daysInfo);

            daysInfo.forEach(d => {
        const val = (op.shifts && op.shifts[d.dayNumber]) || '';
        const weekendClass = d.isWeekend ? ' col-weekend' : '';
        const holidayClass = d.isHoliday ? ' col-holiday' : '';
        const todayClass = (isCurrentYearMonth && d.dayNumber === currentDay) ? ' col-today' : '';

        let streakClass = '';
        let cellTitle = '';
        const offInfo = offMap[d.dayNumber];
        if (offInfo) {
          if (offInfo.type === 'start') streakClass = ' streak-off-start';
          else if (offInfo.type === 'end') streakClass = ' streak-off-end';
          else streakClass = ' streak-off-mid';
          cellTitle = `Período com ${offInfo.length} dias consecutivos sem escala operacional (ICA 63-33, item 8.4.5.1)`;
        }

        let conflictClass = '';
        const conflictInfo = conflictMap[d.dayNumber];
        if (conflictInfo) {
          conflictClass = ' cell-conflict-rm';
          cellTitle = conflictInfo.message;
        }

        if (!cellTitle && d.isHoliday) {
          cellTitle = `Dia ${d.dayNumber}/${state.month + 1} - Feriado: ${d.holidayName} (${d.holidayType}) - Não útil / Etapa integral`;
        }

        html += `<td class="cell-shift col-day${weekendClass}${holidayClass}${todayClass}${streakClass}${conflictClass}" 
                    tabindex="${currentMode === 'edit' ? 0 : -1}" 
                    data-val="${escapeHtml(val)}" 
                    data-op-id="${safeOpId}" 
                    data-day="${d.dayNumber}" 
                    data-is-sub="false"${cellTitle ? ` title="${escapeHtml(cellTitle)}"` : ''}>${escapeHtml(val)}</td>`;
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
      const isNonWorking = d.isWeekend || d.isHoliday; // Dia não útil: fim de semana ou feriado

      if (val === 'M') {
        countM++;
      } else if (val === 'T') {
        countT++;
        etapa5xTotalDias++;
        if (!isNonWorking) {
          etapa5xUteisDias++;
          // Etapa 5X com desconto de rancho em dia útil com expediente ordinário (-R$ 13,50)
          etapa5x += 54.0;
        } else {
          // Etapa 5X integral no fim de semana ou feriado (sem desconto de rancho): R$ 67,50
          etapa5x += 67.5;
        }
      } else if (val === 'R') {
        countR++;
        etapa10xTotalDias++;
        if (!isNonWorking) {
          etapa10xUteisDias++;
          // Etapa 10X com desconto de rancho em dia útil com expediente ordinário (-R$ 13,50)
          etapa10x += 121.5;
        } else {
          // Etapa 10X integral no fim de semana ou feriado (sem desconto de rancho): R$ 135,00
          etapa10x += 135.0;
        }
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

      const isHoursAlert = (stats.totalHours < 127 || stats.totalHours > 188);
      const hoursAlertClass = isHoursAlert ? ' total-hours-alert' : '';

      let totalTooltip = `Total: ${formatHours(stats.totalHours)}`;
      if (stats.totalHours < 127) {
        totalTooltip += ` (Abaixo do mínimo regulamentar de 127h para H17 - ICA 63-33, Tab. 18-A)`;
      } else if (stats.totalHours > 188) {
        totalTooltip += ` (Acima do limite máximo regulamentar de 188h - ICA 63-33, item 4.2.6.1)`;
      }

      rowsHtml += `<tr class="row-stat-operator${rowDimmed}${rowMatched}" data-op-id="${escapeHtml(op.id)}">
        <td class="col-stat-leg"><span class="stat-leg-badge">${escapeHtml(op.leg)}</span></td>
        <td class="col-stat-op" title="${escapeHtml(op.name)}">${escapeHtml(op.name)}</td>
        <td class="col-stat-shifts">${stats.totalShifts}${breakdownText}</td>
        <td class="col-stat-ctop">${formatHours(stats.cTop)}</td>
        <td class="col-stat-briefing">${formatHours(stats.briefing)}</td>
        <td class="col-stat-risaer">${formatHours(stats.risaerHours)}</td>
        <td class="col-stat-pimo">${formatHours(stats.pimo)}</td>
        <td class="col-stat-met">${formatHours(stats.instrucaoMet)}</td>
        <td class="col-stat-total${hoursAlertClass}" title="${escapeHtml(totalTooltip)}"><strong>${formatHours(stats.totalHours)}</strong></td>
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
      statsTeamAverage.textContent = `H17: 127 | ${teamCeilHours} / OPR`;
      statsTeamAverage.title = `Piso regulamentar H17: 127h | Média calculada da equipe: ${teamAverageHours.toFixed(2).replace('.', ',')}h (arredondar para o superior: ${teamCeilHours}h) / OPR (ICA 63-33, Anexo A e Tab. 18-A)`;
    }

    if (statsMemorialFooter) {
      const formulaPimo = totalTeamPimo > 0 ? ` + ${totalTeamPimo}h PIMO` : '';
      const formulaRisaer = totalTeamR > 0 ? ` + (${totalTeamR}×24h RISAER)` : '';
      const formulaMet = totalTeamInstrucaoMet > 0 ? ` + (${totalTeamInstrucaoMet}h MET / ${totalOps})` : '';
      statsMemorialFooter.innerHTML = `<span><strong>Memorial de cálculo (ICA 63-33 / Base H17: 127h):</strong> [(${totalDays}×17h + ${totalDays}×0,75h${formulaRisaer}${formulaPimo}) / ${totalOps}${formulaMet}] = <strong>${teamAverageHours.toFixed(2).replace('.', ',')}h</strong> &rarr; <strong>${teamCeilHours}h / OPR</strong> (arredondar sempre para o inteiro superior)</span>`;
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

    pushUnsavedSnapshot();
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
      pushUnsavedSnapshot();
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

    pushUnsavedSnapshot();
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
    pushUnsavedSnapshot();
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
    pushUnsavedSnapshot();
    state.observations.splice(index, 1);
    saveState();
    recordLastChange('Observações atualizadas');
    renderObservations();
  }

  // =========================================================================
  // GESTÃO DE CARGAS ADICIONAIS (PIMO & INSTRUÇÃO MET)
  // =========================================================================
    // =========================================================================
  // GESTÃO E VISUALIZAÇÃO DE FERIADOS E DIAS NÃO ÚTEIS
  // =========================================================================
  function openHolidaysModal() {
    if (!modalHolidays || !holidaysTbody) return;
    renderHolidaysModal();
    modalHolidays.classList.remove('hidden');
  }

  function closeHolidaysModal() {
    if (!modalHolidays) return;
    modalHolidays.classList.add('hidden');
  }

  function renderHolidaysModal() {
    if (!holidaysTbody) return;
    const monthName = MONTH_NAMES[state.month];
    if (modalHolidaysTitle) {
      modalHolidaysTitle.textContent = `Feriados e Dias Não Úteis - ${monthName}/${state.year} (${state.sector || 'EMS-SP'})`;
    }

    const holidays = getMonthHolidays(state.year, state.month, state);
    const totalDays = getDaysInMonth(state.year, state.month);

    // Popula seletor de dias
    if (selectNewHolidayDay) {
      let selHtml = '';
      for (let day = 1; day <= totalDays; day++) {
        const dObj = new Date(state.year, state.month, day);
        const wName = WEEKDAY_NAMES[dObj.getDay()];
        selHtml += `<option value="${day}">Dia ${String(day).padStart(2, '0')} (${wName})</option>`;
      }
      selectNewHolidayDay.innerHTML = selHtml;
    }

    if (holidays.length === 0) {
      holidaysTbody.innerHTML = `<tr><td colspan="5" class="holidays-empty-cell">Nenhum feriado registrado para ${monthName}/${state.year}. Todos os dias entre segunda e sexta-feira são contabilizados como dias úteis ordinários.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    holidays.forEach(h => {
      const dObj = new Date(state.year, state.month, h.day);
      const wName = WEEKDAY_NAMES[dObj.getDay()];
      const isWeekendDay = dObj.getDay() === 0 || dObj.getDay() === 6;
      const statusClass = h.isDisabled ? 'status-disabled' : 'status-active';

      let actionBtn = '';
      if (h.isCustom) {
        actionBtn = `<button type="button" class="btn-holiday-del" data-action="del-custom-holiday" data-id="${escapeHtml(h.id)}" title="Excluir feriado personalizado">&times;</button>`;
      } else {
        actionBtn = `<button type="button" class="btn-holiday-toggle ${h.isDisabled ? 'btn-activate' : 'btn-deactivate'}" data-action="toggle-holiday" data-id="${escapeHtml(h.id)}" title="${h.isDisabled ? 'Reativar feriado' : 'Desativar feriado (tratar como dia útil ordinário)'}">
          ${h.isDisabled ? 'Reativar' : 'Desativar'}
        </button>`;
      }

      rowsHtml += `<tr>
        <td class="holiday-day-cell"><strong>${String(h.day).padStart(2, '0')}</strong>/${String(state.month + 1).padStart(2, '0')}</td>
        <td class="holiday-weekday-cell">${wName}</td>
        <td class="holiday-name-cell">${escapeHtml(h.name)}</td>
        <td class="holiday-type-cell"><span class="holiday-badge-type">${escapeHtml(h.type)}</span></td>
        <td class="holiday-action-cell ${statusClass}">${actionBtn}</td>
      </tr>`;
    });

    holidaysTbody.innerHTML = rowsHtml;
  }

  function addCustomHoliday() {
    if (!selectNewHolidayDay || !inputNewHolidayName) return;
    const day = parseInt(selectNewHolidayDay.value, 10);
    const name = inputNewHolidayName.value.trim();
    if (!day || !name) {
      alert('Por favor, informe o dia e a descrição do feriado.');
      return;
    }

    if (!Array.isArray(state.customHolidays)) {
      state.customHolidays = [];
    }

    const existing = state.customHolidays.find(c => parseInt(c.day, 10) === day && (c.month === undefined || parseInt(c.month, 10) === state.month));
    pushUnsavedSnapshot();
    if (existing) {
      existing.name = name;
    } else {
      state.customHolidays.push({
        id: `custom-${state.year}-${state.month}-${day}-${Date.now()}`,
        month: state.month,
        day,
        name,
        type: 'Personalizado / OM'
      });
    }

    inputNewHolidayName.value = '';
    saveState();
    recordLastChange(`Feriado adicionado no dia ${day}: "${name}"`);
    renderHolidaysModal();
    renderAll();
  }

  function deleteCustomHoliday(holidayId) {
    if (!Array.isArray(state.customHolidays)) return;
    pushUnsavedSnapshot();
    const prev = state.customHolidays.find(c => c.id === holidayId);
    state.customHolidays = state.customHolidays.filter(c => c.id !== holidayId);
    saveState();
    if (prev) {
      recordLastChange(`Feriado personalizado removido do dia ${prev.day}: "${prev.name}"`);
    }
    renderHolidaysModal();
    renderAll();
  }

  function toggleOfficialHoliday(holidayId) {
    if (!Array.isArray(state.disabledHolidays)) {
      state.disabledHolidays = [];
    }
    pushUnsavedSnapshot();
    const idx = state.disabledHolidays.indexOf(holidayId);
    if (idx >= 0) {
      state.disabledHolidays.splice(idx, 1);
      recordLastChange(`Feriado reativado [${holidayId}]`);
    } else {
      state.disabledHolidays.push(holidayId);
      recordLastChange(`Feriado desativado [${holidayId}]`);
    }
    saveState();
    renderHolidaysModal();
    renderAll();
  }

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
    pushUnsavedSnapshot();
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
    if (!password || password.length < 8 || password.length > 50) return false;
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
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
      // Alerta de primeiro acesso / necessidade de trocar senha inicial
      if (bannerMustChangePassword) {
        if (currentUser.must_change_password) {
          bannerMustChangePassword.classList.remove('hidden');
        } else {
          bannerMustChangePassword.classList.add('hidden');
        }
      }

      // Painel do Administrador (disponível para natividadedan e role 'admin')
      const isAdmin = Boolean(currentUser.role === 'admin' || currentUser.username === 'natividadedan');
      if (btnAdminResetUsers) {
        if (isAdmin) {
          btnAdminResetUsers.classList.remove('hidden');
        } else {
          btnAdminResetUsers.classList.add('hidden');
        }
      }
      if (actionAdminResetUsers) {
        if (isAdmin) {
          actionAdminResetUsers.classList.remove('hidden');
        } else {
          actionAdminResetUsers.classList.add('hidden');
        }
      }
    } else {
      // Não autenticado: exibe tela de login e oculta aplicação
      loginScreen.style.display = 'flex';
      appScreen.style.display = 'none';
      if (bannerMustChangePassword) {
        bannerMustChangePassword.classList.add('hidden');
      }
      if (btnAdminResetUsers) {
        btnAdminResetUsers.classList.add('hidden');
      }
      if (actionAdminResetUsers) {
        actionAdminResetUsers.classList.add('hidden');
      }
      if (loginScreenError) {
        loginScreenError.classList.add('hidden');
        loginScreenError.textContent = '';
      }
      setTimeout(() => {
        if (loginInputUser) loginInputUser.focus();
      }, 50);
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

    if (loginScreenError) {
      loginScreenError.classList.add('hidden');
      loginScreenError.textContent = '';
    }

    if (!username || !password) {
      if (loginScreenError) {
        loginScreenError.textContent = 'Informe usuário e senha para continuar.';
        loginScreenError.classList.remove('hidden');
      }
      return;
    }

    btnLoginSubmit.disabled = true;
    btnLoginSubmit.innerHTML = '<span>Verificando...</span>';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username,
          password
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Usuário ou senha incorretos');
      }

      currentUser = { ...json.user, token: json.token };
      localStorage.setItem('escala_current_user', JSON.stringify(currentUser));
      updateAuthViewState();
      renderAll();
      // Carrega dados da nuvem
      loadMonthFromCloud(state.year, state.month, state.sector);

      // O banner de aviso de primeiro acesso é exibido automaticamente no topo caso seja senha inicial,
      // permitindo que o usuário visualize e utilize o sistema normalmente sem bloqueio rígido.
    } catch (err) {
      if (loginScreenError) {
        loginScreenError.textContent = err.message || 'Erro na autenticação';
        loginScreenError.classList.remove('hidden');
      }
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.innerHTML = '<span>Entrar</span>';
    }
  }

  function clearRenderedDom() {
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';
    if (obsList) obsList.innerHTML = '';
    if (statsTbody) statsTbody.innerHTML = '';
    if (statsMemorialFooter) statsMemorialFooter.innerHTML = '';
  }

  function handleLogout() {
    const nome = (currentUser && (currentUser.name || currentUser.username)) || 'operador';
    if (confirm(`Deseja realmente sair da sessão de ${nome}?`)) {
      currentUser = null;
      localStorage.removeItem('escala_current_user');

      // Limpa dados de cache da escala da máquina local para segurança do terminal
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('escala_') || k === STORAGE_KEY)) {
          if (k !== 'escala_theme') {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Reseta estado em memória para o padrão limpo
      state = JSON.parse(JSON.stringify(DEFAULT_DATA));
      unsavedHistory = [];
      hasUnsavedChanges = false;
      updateSaveButtonUI('clean');

      if (loginInputPass) loginInputPass.value = '';
      clearRenderedDom();
      updateAuthViewState();
    }
  }

  // =========================================================================
  // MODAL DE ALTERAÇÃO DE SENHA DO OPERADOR
  // =========================================================================
  function openChangePasswordModal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!modalChangePassword) return;
    if (changePassError) {
      changePassError.classList.add('hidden');
      changePassError.textContent = '';
    }
    if (changePassSuccess) {
      changePassSuccess.classList.add('hidden');
      changePassSuccess.textContent = '';
    }
    if (formChangePassword) formChangePassword.reset();
    modalChangePassword.classList.remove('hidden');
    modalChangePassword.style.display = 'flex';
    setTimeout(() => {
      if (inputCurrentPass) inputCurrentPass.focus();
    }, 50);
  }

  function closeChangePasswordModal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (modalChangePassword) {
      modalChangePassword.classList.add('hidden');
      modalChangePassword.style.display = 'none';
    }
    if (changePassError) {
      changePassError.classList.add('hidden');
      changePassError.textContent = '';
    }
    if (changePassSuccess) {
      changePassSuccess.classList.add('hidden');
      changePassSuccess.textContent = '';
    }
    if (formChangePassword) formChangePassword.reset();
  }

  async function handleSaveNewPassword(e) {
    e.preventDefault();
    if (!currentUser || !currentUser.token) {
      handleSessionExpired();
      return;
    }

    const currentPassword = inputCurrentPass ? inputCurrentPass.value : '';
    const newPassword = inputNewPass ? inputNewPass.value : '';
    const confirmPassword = inputConfirmPass ? inputConfirmPass.value : '';

    if (changePassError) {
      changePassError.classList.add('hidden');
      changePassError.textContent = '';
    }
    if (changePassSuccess) {
      changePassSuccess.classList.add('hidden');
      changePassSuccess.textContent = '';
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      if (changePassError) {
        changePassError.textContent = 'Preencha todos os campos obrigatórios.';
        changePassError.classList.remove('hidden');
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (changePassError) {
        changePassError.textContent = 'A confirmação de senha não confere com a nova senha.';
        changePassError.classList.remove('hidden');
      }
      if (inputConfirmPass) inputConfirmPass.focus();
      return;
    }

    if (!isValidPasswordRule(newPassword)) {
      if (changePassError) {
        changePassError.textContent = 'A nova senha deve ter entre 8 e 50 caracteres e pelo menos um caractere especial (!@#$...).';
        changePassError.classList.remove('hidden');
      }
      if (inputNewPass) inputNewPass.focus();
      return;
    }

    if (currentPassword === newPassword) {
      if (changePassError) {
        changePassError.textContent = 'A nova senha deve ser diferente da senha atual.';
        changePassError.classList.remove('hidden');
      }
      if (inputNewPass) inputNewPass.focus();
      return;
    }

    if (btnSaveChangePassword) {
      btnSaveChangePassword.disabled = true;
      btnSaveChangePassword.textContent = 'Gravando...';
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword,
          newPassword
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao alterar senha.');
      }

      currentUser = { ...json.user, token: json.token };
      localStorage.setItem('escala_current_user', JSON.stringify(currentUser));

      if (bannerMustChangePassword) {
        bannerMustChangePassword.classList.add('hidden');
      }

      if (changePassSuccess) {
        changePassSuccess.textContent = 'Senha alterada com sucesso!';
        changePassSuccess.classList.remove('hidden');
      }

      setTimeout(() => {
        closeChangePasswordModal();
      }, 1400);

    } catch (err) {
      if (changePassError) {
        changePassError.textContent = err.message || 'Erro ao atualizar senha.';
        changePassError.classList.remove('hidden');
      }
    } finally {
      if (btnSaveChangePassword) {
        btnSaveChangePassword.disabled = false;
        btnSaveChangePassword.textContent = 'Salvar Nova Senha';
      }
    }
  }

  window.openChangePasswordModal = openChangePasswordModal;
  window.closeChangePasswordModal = closeChangePasswordModal;
  window.handleSaveNewPassword = handleSaveNewPassword;

  // =========================================================================
  // PAINEL DO ADMINISTRADOR: RESET DE SENHA DE OPERADORES
  // =========================================================================
  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const specials = '!@#$%&*';
    let pass = '';
    for (let i = 0; i < 7; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += specials.charAt(Math.floor(Math.random() * specials.length));
    pass += Math.floor(Math.random() * 9) + 1;
    return pass;
  }

  async function openAdminResetModal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!modalAdminReset) return;

    if (adminResetError) {
      adminResetError.classList.add('hidden');
      adminResetError.textContent = '';
    }
    if (adminResetSuccess) {
      adminResetSuccess.classList.add('hidden');
      adminResetSuccess.textContent = '';
    }
    if (inputAdminTempPass) {
      inputAdminTempPass.value = 'Mudar@123';
    }

    modalAdminReset.classList.remove('hidden');
    modalAdminReset.style.display = 'flex';

    if (selectAdminTargetUser) {
      selectAdminTargetUser.innerHTML = '<option value="">Carregando operadores...</option>';
      selectAdminTargetUser.disabled = true;
    }

    try {
      if (!currentUser || !currentUser.token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ action: 'admin_list_users' })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao consultar lista de operadores.');
      }

      if (selectAdminTargetUser) {
        selectAdminTargetUser.innerHTML = '<option value="">-- Selecione o Operador --</option>';
        const users = json.users || [];
        users.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.username;
          const status = u.must_change_password ? ' [Senha inicial]' : '';
          opt.textContent = `${u.name || u.username} (${u.username})${status}`;
          selectAdminTargetUser.appendChild(opt);
        });
        selectAdminTargetUser.disabled = false;
        selectAdminTargetUser.focus();
      }
    } catch (err) {
      if (adminResetError) {
        adminResetError.textContent = err.message || 'Erro ao carregar operadores.';
        adminResetError.classList.remove('hidden');
      }
      if (selectAdminTargetUser) {
        selectAdminTargetUser.innerHTML = '<option value="">Falha ao carregar lista</option>';
        selectAdminTargetUser.disabled = false;
      }
    }
  }

  function closeAdminResetModal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (modalAdminReset) {
      modalAdminReset.classList.add('hidden');
      modalAdminReset.style.display = 'none';
    }
    if (adminResetError) {
      adminResetError.classList.add('hidden');
      adminResetError.textContent = '';
    }
    if (adminResetSuccess) {
      adminResetSuccess.classList.add('hidden');
      adminResetSuccess.textContent = '';
    }
    if (formAdminReset) formAdminReset.reset();
  }

  async function handleAdminResetSubmit(e) {
    e.preventDefault();
    if (!currentUser || !currentUser.token) {
      handleSessionExpired();
      return;
    }

    const targetUsername = selectAdminTargetUser ? selectAdminTargetUser.value : '';
    const temporaryPassword = inputAdminTempPass ? inputAdminTempPass.value.trim() : 'Mudar@123';

    if (adminResetError) {
      adminResetError.classList.add('hidden');
      adminResetError.textContent = '';
    }
    if (adminResetSuccess) {
      adminResetSuccess.classList.add('hidden');
      adminResetSuccess.textContent = '';
    }

    if (!targetUsername) {
      if (adminResetError) {
        adminResetError.textContent = 'Selecione o operador que terá a senha resetada.';
        adminResetError.classList.remove('hidden');
      }
      return;
    }

    if (!isValidPasswordRule(temporaryPassword)) {
      if (adminResetError) {
        adminResetError.textContent = 'A senha provisória deve ter entre 8 e 50 caracteres e pelo menos um caractere especial (!@#$...).';
        adminResetError.classList.remove('hidden');
      }
      return;
    }

    const selText = selectAdminTargetUser && selectAdminTargetUser.selectedOptions[0] ? selectAdminTargetUser.selectedOptions[0].textContent : targetUsername;
    if (!confirm(`Deseja realmente resetar a senha de ${selText} para "${temporaryPassword}"?`)) {
      return;
    }

    if (btnSubmitAdminReset) {
      btnSubmitAdminReset.disabled = true;
      btnSubmitAdminReset.textContent = 'Resetando...';
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          action: 'admin_reset_user_password',
          targetUsername,
          temporaryPassword
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao resetar senha do operador.');
      }

      if (adminResetSuccess) {
        adminResetSuccess.textContent = `Sucesso! A senha de ${json.operatorName || targetUsername} foi redefinida para "${temporaryPassword}". No próximo acesso dele, o sistema solicitará o cadastro de uma nova senha pessoal.`;
        adminResetSuccess.classList.remove('hidden');
      }

      if (selectAdminTargetUser && selectAdminTargetUser.selectedOptions[0]) {
        const opt = selectAdminTargetUser.selectedOptions[0];
        if (!opt.textContent.includes('[Senha inicial]')) {
          opt.textContent += ' [Senha inicial]';
        }
      }

    } catch (err) {
      if (adminResetError) {
        adminResetError.textContent = err.message || 'Erro ao processar reset de senha.';
        adminResetError.classList.remove('hidden');
      }
    } finally {
      if (btnSubmitAdminReset) {
        btnSubmitAdminReset.disabled = false;
        btnSubmitAdminReset.textContent = 'Confirmar Reset';
      }
    }
  }

  window.openAdminResetModal = openAdminResetModal;
  window.closeAdminResetModal = closeAdminResetModal;

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
    const currentName = currentUser?.name || currentUser?.username || '';
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

    if (newName.length > 60) {
      if (editUserError) {
        editUserError.textContent = 'O nome deve ter no máximo 60 caracteres.';
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

    const oldName = currentUser.name || currentUser.username || '';

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
            if (json.user) {
              if (json.user.name) currentUser.name = json.user.name;
              if (json.user.role) currentUser.role = json.user.role;
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
  function updateCellShift(opId, day, val, skipConflictCheck = false) {
    const op = state.operators.find(o => o.id === opId);
    if (!op) return;

    const oldVal = (op.shifts && op.shifts[day]) ? op.shifts[day] : '';
    val = val.trim().toUpperCase();

    if (val === oldVal) return;

    // Alerta de Conflito R -> M (ICA 63-33, Tab. 30: intervalo obrigatório de 24h de descanso)
    if (!skipConflictCheck) {
      if (val === 'M') {
        const prevVal = (op.shifts && op.shifts[day - 1]) ? op.shifts[day - 1] : '';
        if (prevVal === 'R') {
          const opName = op.name || 'Operador';
          showConflictModal({
            opName,
            day,
            prevDay: day - 1,
            val: 'M',
            onConfirm: () => {
              updateCellShift(opId, day, val, true);
            },
            onCancel: () => {
              const selector = `[data-op-id="${opId}"] [data-day="${day}"]`;
              const td = tbody.querySelector(selector);
              if (td) td.focus();
            }
          });
          return;
        }
      } else if (val === 'R') {
        const nextVal = (op.shifts && op.shifts[day + 1]) ? op.shifts[day + 1] : '';
        if (nextVal === 'M') {
          const opName = op.name || 'Operador';
          showConflictModal({
            opName,
            day: day + 1,
            prevDay: day,
            val: 'R',
            onConfirm: () => {
              updateCellShift(opId, day, val, true);
            },
            onCancel: () => {
              const selector = `[data-op-id="${opId}"] [data-day="${day}"]`;
              const td = tbody.querySelector(selector);
              if (td) td.focus();
            }
          });
          return;
        }
      }
    }

    pushUnsavedSnapshot();

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

    // Atualiza dinamicamente as células da linha (inclusive streaks de folga e conflitos)
    refreshOperatorRowCells(opId);

    // Recalcula e atualiza instantaneamente a tabela de Carga Horária & Etapas
    renderStatsTable();
  }

  // Controladores de Modo Edição Rápida (Pintura de Turnos)
  function setPaintMode(shift) {
    if (currentMode !== 'edit') {
      currentMode = 'edit';
      if (btnModeEdit) btnModeEdit.classList.add('active');
      if (btnModeView) btnModeView.classList.remove('active');
      document.body.classList.remove('mode-view');
      renderAll();
    }

    // Se clicar no botão que já está ativo, desativa o modo pintura (toggle)
    if (activePaintTool === shift) {
      exitPaintMode();
      return;
    }

    activePaintTool = shift;
    closeShiftPopover();

    // Destaque visual nos chips de turno
    chipPaintButtons.forEach(btn => {
      const p = btn.getAttribute('data-paint');
      if (p === shift) {
        btn.classList.add('chip-paint-active');
      } else {
        btn.classList.remove('chip-paint-active');
      }
    });

    // Atualiza a barra de aviso de Edição Rápida
    if (paintModeBar && paintModeBadge) {
      paintModeBar.style.display = 'flex';
      paintModeBadge.className = 'paint-mode-badge';
      if (shift === 'M') {
        paintModeBadge.classList.add('badge-paint-m');
        paintModeBadge.textContent = 'M (Manhã | 06h00 às 13h30)';
      } else if (shift === 'T') {
        paintModeBadge.classList.add('badge-paint-t');
        paintModeBadge.textContent = 'T (Tarde | 13h30 às 23h00)';
      } else if (shift === 'R') {
        paintModeBadge.classList.add('badge-paint-r');
        paintModeBadge.textContent = 'R (RISAER | 24 Horas)';
      }
    }

    if (sheetContainer) {
      sheetContainer.classList.add('paint-active');
    }
  }

  function exitPaintMode() {
    activePaintTool = null;

    chipPaintButtons.forEach(btn => {
      btn.classList.remove('chip-paint-active');
    });

    if (paintModeBar) {
      paintModeBar.style.display = 'none';
    }

    if (sheetContainer) {
      sheetContainer.classList.remove('paint-active');
    }
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
      // Avança para o próximo dia se não abriu o modal de conflito
      if (!modalConflictWarning || modalConflictWarning.classList.contains('hidden')) {
        moveFocusCell(td, 0, 1);
      }
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
      exitPaintMode();
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

    // Tecla Enter ou Escape global para fechar caixa de seleção de turno, modal de conflito ou operador selecionado
    document.addEventListener('keydown', (e) => {
      // Se o modal de conflito estiver visível
      if (modalConflictWarning && !modalConflictWarning.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeConflictModal(false);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          closeConflictModal(true);
          return;
        }
      }

      // Se o modal de alteração de senha estiver visível
      if (modalChangePassword && !modalChangePassword.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeChangePasswordModal();
          return;
        }
      }

      // Se o modal de edição de usuário estiver visível
      if (modalEditUser && !modalEditUser.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeEditUserModal();
          return;
        }
      }

      // Se o modal de administração de reset de senha estiver visível
      if (modalAdminReset && !modalAdminReset.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeAdminResetModal();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (activePaintTool) {
          exitPaintMode();
        }
      }

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
          if (activePaintTool) {
            // Modo Pintura / Edição Rápida ativo: aplica o turno diretamente com suporte a Desfazer
            const opId = cell.getAttribute('data-op-id');
            const day = parseInt(cell.getAttribute('data-day'), 10);
            updateCellShift(opId, day, activePaintTool);
          } else {
            // Modo normal: abre o popover de seleção de turno (M | T | R | Limpar)
            cell.focus();
            openShiftPopover(cell);
          }
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
              pushUnsavedSnapshot();
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
          pushUnsavedSnapshot();
          op.leg = newLeg;
          saveState();
          recordLastChange(`Legenda alterada para ${op.leg} (${op.name})`);
          renderStatsTable();
        }
      } else if (action === 'edit-name') {
        const newName = el.textContent.trim();
        if (op.name !== newName) {
          pushUnsavedSnapshot();
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
          pushUnsavedSnapshot();
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

        // 11.5 Eventos do Modo Edição Rápida (Pintura de Turnos)
    chipPaintButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const paintVal = btn.getAttribute('data-paint');
        if (paintVal) {
          setPaintMode(paintVal);
        }
      });
    });

    if (btnExitPaintMode) {
      btnExitPaintMode.addEventListener('click', () => {
        exitPaintMode();
      });
    }

    // 12. Gestão de Feriados e Dias Não Úteis
    if (chipHolidayLegend) {
      chipHolidayLegend.addEventListener('click', openHolidaysModal);
    }
    if (actionManageHolidays) {
      actionManageHolidays.addEventListener('click', (e) => {
        e.preventDefault();
        dropdownMenu.classList.remove('show');
        openHolidaysModal();
      });
    }
    if (btnCloseHolidays) {
      btnCloseHolidays.addEventListener('click', closeHolidaysModal);
    }
    if (btnConfirmHolidays) {
      btnConfirmHolidays.addEventListener('click', closeHolidaysModal);
    }
    if (modalHolidays) {
      modalHolidays.addEventListener('click', (e) => {
        if (e.target === modalHolidays) closeHolidaysModal();
      });
    }
    if (btnAddCustomHoliday) {
      btnAddCustomHoliday.addEventListener('click', addCustomHoliday);
    }
    if (holidaysTbody) {
      holidaysTbody.addEventListener('click', (e) => {
        const btnDel = e.target.closest('[data-action="del-custom-holiday"]');
        if (btnDel) {
          const id = btnDel.getAttribute('data-id');
          deleteCustomHoliday(id);
          return;
        }
        const btnToggle = e.target.closest('[data-action="toggle-holiday"]');
        if (btnToggle) {
          const id = btnToggle.getAttribute('data-id');
          toggleOfficialHoliday(id);
          return;
        }
      });
    }

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

    if (formLoginScreen) {
      formLoginScreen.addEventListener('submit', handleLoginScreenSubmit);
    }
    if (btnAuthUser) {
      btnAuthUser.addEventListener('click', handleLogout);
    }
    // Banner de Aviso e Modal de Alteração de Senha do Operador
    if (btnOpenChangePassword) {
      btnOpenChangePassword.addEventListener('click', openChangePasswordModal);
    }
    if (btnBannerChangePassword) {
      btnBannerChangePassword.addEventListener('click', openChangePasswordModal);
    }
    if (btnCloseChangePassword) {
      btnCloseChangePassword.addEventListener('click', closeChangePasswordModal);
    }
    if (btnCancelChangePassword) {
      btnCancelChangePassword.addEventListener('click', closeChangePasswordModal);
    }
    if (formChangePassword) {
      formChangePassword.addEventListener('submit', handleSaveNewPassword);
    }
    if (modalChangePassword) {
      modalChangePassword.addEventListener('click', (e) => {
        if (e.target === modalChangePassword) {
          closeChangePasswordModal();
        }
      });
    }

    // Painel do Administrador: Reset de Senha de Operadores
    if (btnAdminResetUsers) {
      btnAdminResetUsers.addEventListener('click', openAdminResetModal);
    }
    if (actionAdminResetUsers) {
      actionAdminResetUsers.addEventListener('click', (e) => {
        e.preventDefault();
        dropdownMenu.classList.remove('show');
        openAdminResetModal();
      });
    }
    if (btnCloseAdminReset) {
      btnCloseAdminReset.addEventListener('click', closeAdminResetModal);
    }
    if (btnCancelAdminReset) {
      btnCancelAdminReset.addEventListener('click', closeAdminResetModal);
    }
    if (btnGenTempPass) {
      btnGenTempPass.addEventListener('click', () => {
        if (inputAdminTempPass) {
          inputAdminTempPass.value = generateRandomPassword();
        }
      });
    }
    if (formAdminReset) {
      formAdminReset.addEventListener('submit', handleAdminResetSubmit);
    }
    if (modalAdminReset) {
      modalAdminReset.addEventListener('click', (e) => {
        if (e.target === modalAdminReset) {
          closeAdminResetModal();
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

    // Modal de Alerta de Conflito de Escala (ICA 63-33)
    if (btnCloseConflict) {
      btnCloseConflict.addEventListener('click', () => closeConflictModal(false));
    }
    if (btnCancelConflict) {
      btnCancelConflict.addEventListener('click', () => closeConflictModal(false));
    }
    if (btnConfirmConflict) {
      btnConfirmConflict.addEventListener('click', () => closeConflictModal(true));
    }
    if (modalConflictWarning) {
      modalConflictWarning.addEventListener('click', (e) => {
        if (e.target === modalConflictWarning) {
          closeConflictModal(false);
        }
      });
    }

    // 14. Botão de Salvar Alterações na Nuvem & Desfazer
    if (btnSaveCloud) {
      btnSaveCloud.addEventListener('click', () => {
        if (isSavingToCloud) return;
        syncWithCloud();
      });
    }

    if (btnUndoChanges) {
      btnUndoChanges.addEventListener('click', () => {
        handleUndo();
      });
    }

    // Atalho global Ctrl+Z (Cmd+Z no Mac) para desfazer a última alteração não salva
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        // Ignora se o foco estiver dentro de um campo de digitação de texto padrão
        const tag = (e.target.tagName || '').toLowerCase();
        const isEditable = e.target.isContentEditable;
        if (tag === 'input' || tag === 'textarea' || isEditable) {
          return;
        }
        if (unsavedHistory.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    });

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
  updateAuthViewState();
  if (currentUser) {
    renderAll();
    loadMonthFromCloud(state.year, state.month, state.sector);
  } else {
    clearRenderedDom();
  }
})();
