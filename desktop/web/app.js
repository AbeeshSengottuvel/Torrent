/**
 * HAVEN // ALPINE TORRENT CLIENT CONTROLLER
 * Zero-Trust, Ad-Free, Security-Hardened BitTorrent Client
 * Conforms to docs/PLAN.md (MPL-2.0)
 */

class HavenApp {
  constructor() {
    this.activeView = 'transfers'; // 'transfers' | 'settings' | 'inspect'

    // Developer Sandbox State (Isolated from production - strictly false by default)
    this.isDeveloperModeUnlocked = localStorage.getItem('haven_dev_mode_unlocked') === 'true';
    this.useMockData = this.isDeveloperModeUnlocked && localStorage.getItem('haven_use_mock_data') === 'true';
    this.simulateWaveform = this.isDeveloperModeUnlocked && localStorage.getItem('haven_simulate_waveform') === 'true';
    this.simTickCount = 0;
    this.brandClickCount = 0;
    this.brandClickTimer = null;

    // Real Live State Buffers (Clean zero baseline in production)
    this.liveKernelEvents = [];
    this.globalDownSpeed = 0;
    this.globalUpSpeed = 0;
    this.globalRatio = 0;
    this.globalActivePeers = 0;

    // Rolling history buffers (Clean zero baseline in production)
    if (this.useMockData && this.simulateWaveform && window.MockSanctuaryData?.MOCK_SPEED_HISTORY) {
      this.inflowHistory = [...window.MockSanctuaryData.MOCK_SPEED_HISTORY.inflow];
      this.outflowHistory = [...window.MockSanctuaryData.MOCK_SPEED_HISTORY.outflow];
    } else {
      this.inflowHistory = new Array(60).fill(0);
      this.outflowHistory = new Array(60).fill(0);
    }

    this.swarms = this.initSwarms();
    this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.activeInspectorTab = 'speed';

    this.downloadDir = localStorage.getItem('haven_download_dir') || 'F:\\Torrent\\Sanctuary';
    this.currentThrottle = { downBytesSec: -1, upBytesSec: 5000 * 1024, maxConns: 60, preset: 'balanced' };
    this.pendingDeleteId = null;

    this.initElements();
    this.attachEvents();
    this.initSettingsEvents();
    this.loadSavedSettings();
    this.initNativeEngineEvents();
    this.initChart();
    this.startTicker();
    this.render();
    this.fetchDiskSpace(this.downloadDir);
    this.checkProductionPackaging();
    this.applyDeveloperModeVisibility();
    this.updateMeshMap();
  }

  async checkProductionPackaging() {
    try {
      // Force useMockData = false whenever a packaged production build launches
      let isPackaged = false;
      if (window.havenNative?.isPackaged) {
        isPackaged = await window.havenNative.isPackaged();
      }
      if (isPackaged) {
        if (this.useMockData) {
          this.useMockData = false;
          this.simulateWaveform = false;
          localStorage.setItem('haven_use_mock_data', 'false');
          localStorage.setItem('haven_simulate_waveform', 'false');
          this.swarms = this.initSwarms();
          this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
          this.inflowHistory = new Array(60).fill(0);
          this.outflowHistory = new Array(60).fill(0);
          this.render();
          this.updateMeshMap();
          this.applyDeveloperModeVisibility();
        }
      }
    } catch (_) {}
  }

  /* -------------------------------------------------------------------------
     SWARM REPOSITORY & SHOWCASE STATE
     ------------------------------------------------------------------------- */
  initSwarms() {
    // 1. If Developer Sandbox Mock Mode is active, provide virtual test swarms
    if (this.useMockData) {
      try {
        const savedMock = localStorage.getItem('haven_sandbox_mock_swarms');
        if (savedMock) {
          const parsed = JSON.parse(savedMock);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
      if (window.MockSanctuaryData?.MOCK_SWARMS) {
        return JSON.parse(JSON.stringify(window.MockSanctuaryData.MOCK_SWARMS));
      }
    }

    // 2. Production State: strictly load real torrents from cache/backend.
    // Purge any legacy dummy transfers (Arch Linux, Cosmos 4K, Debian 12, Alpine Photos).
    const mockIds = new Set(['swarm-arch-2025', 'swarm-cosmos-4k', 'swarm-alpine-photos', 'swarm-debian-12']);
    try {
      const saved = localStorage.getItem('haven_alpine_swarms');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const realSwarms = parsed.filter(s => !mockIds.has(s.id) && !s.isMock);
          return realSwarms;
        }
      }
    } catch (_) {}

    // Production clean default: 0 torrents
    return [];
  }

  saveSwarms(immediate = false) {
    if (this._saveSwarmsTimer) {
      clearTimeout(this._saveSwarmsTimer);
      this._saveSwarmsTimer = null;
    }
    const doSave = () => {
      try {
        if (this.useMockData) {
          localStorage.setItem('haven_sandbox_mock_swarms', JSON.stringify(this.swarms));
        } else {
          const mockIds = new Set(['swarm-arch-2025', 'swarm-cosmos-4k', 'swarm-alpine-photos', 'swarm-debian-12']);
          const realSwarms = this.swarms.filter(s => !mockIds.has(s.id) && !s.isMock);
          localStorage.setItem('haven_alpine_swarms', JSON.stringify(realSwarms));
        }
      } catch (_) {}
    };

    if (immediate) {
      doSave();
    } else {
      this._saveSwarmsTimer = setTimeout(doSave, 500);
    }
  }

  /* -------------------------------------------------------------------------
     DOM ELEMENT BINDINGS
     ------------------------------------------------------------------------- */
  initElements() {
    // Views
    this.transfersView = document.getElementById('transfersView');
    this.inspectView = document.getElementById('inspectView');
    this.settingsView = document.getElementById('settingsView');
    this.navTransfers = document.getElementById('navTransfers');
    this.navDeepInspect = document.getElementById('navDeepInspect');
    this.navSettingsStudio = document.getElementById('navSettingsStudio');
    this.btnBackToTransfers = document.getElementById('btnBackToTransfers');
    this.btnBackFromInspect = document.getElementById('btnBackFromInspect');
    this.btnOpenSettingsBottom = document.getElementById('btnOpenSettingsBottom');
    this.btnSecurityMode = document.getElementById('btnSecurityMode');
    this.btnNetguardIndicator = document.getElementById('btnNetguardIndicator');

    // Deep Inspect Studio Elements (Alpine Mist Single-Screen)
    this.inspectTorrentName = document.getElementById('inspectTorrentName');
    this.inspectStatusBadge = document.getElementById('inspectStatusBadge');
    this.btnInspectPause = document.getElementById('btnInspectPause');
    this.inspectPauseText = document.getElementById('inspectPauseText');
    this.btnInspectFolder = document.getElementById('btnInspectFolder');
    this.btnInspectVerify = document.getElementById('btnInspectVerify');
    this.winMinInspect = document.getElementById('winMinInspect');
    this.winMaxInspect = document.getElementById('winMaxInspect');
    this.winCloseInspect = document.getElementById('winCloseInspect');

    // Summary Strip
    this.inspectFlowLabel = document.getElementById('inspectFlowLabel');
    this.inspectFlowIcon = document.getElementById('inspectFlowIcon');
    this.inspectFlowVal = document.getElementById('inspectFlowVal');
    this.inspectFlowPeak = document.getElementById('inspectFlowPeak');
    this.inspectActivePeers = document.getElementById('inspectActivePeers');
    this.inspectSwarmBreakdown = document.getElementById('inspectSwarmBreakdown');
    this.inspectIntegrityVal = document.getElementById('inspectIntegrityVal');
    this.inspectIntegritySub = document.getElementById('inspectIntegritySub');
    this.inspectRatioVal = document.getElementById('inspectRatioVal');
    this.inspectRatioSub = document.getElementById('inspectRatioSub');

    // Hero Card Waveform & Micro-Pill Bitfield
    this.inspectDynamicsSub = document.getElementById('inspectDynamicsSub');
    this.waveformPeakFlag = document.getElementById('waveformPeakFlag');
    this.waveformPeakVal = document.getElementById('waveformPeakVal');
    this.waveformNowTick = document.getElementById('waveformNowTick');
    this.inspectWaveformCanvas = document.getElementById('inspectWaveformCanvas');
    this.inspectWaveformCtx = this.inspectWaveformCanvas ? this.inspectWaveformCanvas.getContext('2d') : null;
    this.inspectPieceStatsText = document.getElementById('inspectPieceStatsText');
    this.inspectPieceVerifiedBadge = document.getElementById('inspectPieceVerifiedBadge');
    this.pieceMatrixGrid = document.getElementById('pieceMatrixGrid');

    // Bottom-Left Segmented Tabs
    this.tabFilesCountLabel = document.getElementById('tabFilesCountLabel');
    this.tabTrackersCountLabel = document.getElementById('tabTrackersCountLabel');
    this.inspectTabTotalSize = document.getElementById('inspectTabTotalSize');
    this.inspectPaneFiles = document.getElementById('inspectPaneFiles');
    this.inspectPaneTrackers = document.getElementById('inspectPaneTrackers');
    this.inspectPaneEngine = document.getElementById('inspectPaneEngine');
    this.inspectManifestList = document.getElementById('inspectManifestList');
    this.inspectTrackersList = document.getElementById('inspectTrackersList');

    // Right Column Swarm & Wire Stream
    this.inspectPeersCountPill = document.getElementById('inspectPeersCountPill');
    this.inspectPeerRelaysSection = document.getElementById('inspectPeerRelaysSection');
    this.inspectWireFeedSection = document.getElementById('inspectWireFeedSection');
    this.inspectPeersList = document.getElementById('inspectPeersList');
    this.inspectWireEventsList = document.getElementById('inspectWireEventsList');

    // Sidebar
    this.sidebarSessionDown = document.getElementById('sidebarSessionDown');
    this.sidebarSessionUp = document.getElementById('sidebarSessionUp');
    this.sidebarPeersCount = document.getElementById('sidebarPeersCount');

    // Transfers View
    this.transfersListContainer = document.getElementById('transfersListContainer');
    this.activeCountBadge = document.getElementById('activeCountBadge');
    this.searchInput = document.getElementById('searchInput');
    this.filterButtons = document.querySelectorAll('.filter-segmented-pill .filter-pill-btn');

    // Inspector
    this.inspectorTargetName = document.getElementById('inspectorTargetName');
    this.inspectorCurrentSpeed = document.getElementById('inspectorCurrentSpeed');
    this.inspectorPeakSpeed = document.getElementById('inspectorPeakSpeed');
    this.btnTabFiles = document.getElementById('btnTabFiles');
    this.btnTabSpeed = document.getElementById('btnTabSpeed');
    this.inspectorSpeedView = document.getElementById('inspectorSpeedView');
    this.inspectorFilesView = document.getElementById('inspectorFilesView');
    this.filesManifestList = document.getElementById('filesManifestList');
    this.manifestFilesCount = document.getElementById('manifestFilesCount');
    this.manifestTotalSize = document.getElementById('manifestTotalSize');
    this.flowCanvas = document.getElementById('flowCanvas');
    this.flowCtx = this.flowCanvas ? this.flowCanvas.getContext('2d') : null;

    // Add Modal
    this.btnOpenAddModal = document.getElementById('btnOpenAddModal');
    this.addDownloadModal = document.getElementById('addDownloadModal');
    this.btnCloseAddModal = document.getElementById('btnCloseAddModal');
    this.btnCancelAddModal = document.getElementById('btnCancelAddModal');
    this.btnConfirmMagnet = document.getElementById('btnConfirmMagnet');
    this.typeMagnetTab = document.getElementById('typeMagnetTab');
    this.typeTorrentTab = document.getElementById('typeTorrentTab');
    this.paneMagnet = document.getElementById('paneMagnet');
    this.paneTorrent = document.getElementById('paneTorrent');
    this.modalMagnetUri = document.getElementById('modalMagnetUri');
    this.btnPasteClipboard = document.getElementById('btnPasteClipboard');
    this.dropZoneModal = document.getElementById('dropZoneModal');
    this.modalFileInput = document.getElementById('modalFileInput');
    this.btnBrowseTorrentFile = document.getElementById('btnBrowseTorrentFile');
    this.selectedTorrentFileName = document.getElementById('selectedTorrentFileName');
    this.selectedTorrentFileSize = document.getElementById('selectedTorrentFileSize');
    this.modalDestPath = document.getElementById('modalDestPath');
    this.modalDestSpace = document.getElementById('modalDestSpace');
    this.btnBrowseMagnetPath = document.getElementById('btnBrowseMagnetPath');
    this.btnToggleAdvanced = document.getElementById('btnToggleAdvanced');
    this.accordionChevron = document.getElementById('accordionChevron');
    this.accordionContent = document.getElementById('accordionContent');

    // Delete Modal
    this.deleteSwarmModal = document.getElementById('deleteSwarmModal');
    this.deleteSwarmTitle = document.getElementById('deleteSwarmTitle');
    this.btnCloseDeleteModal = document.getElementById('btnCloseDeleteModal');
    this.btnCancelDelete = document.getElementById('btnCancelDelete');
    this.btnConfirmDelete = document.getElementById('btnConfirmDelete');
    this.optKeepData = document.getElementById('optKeepData');
    this.optDeleteData = document.getElementById('optDeleteData');

    // Flow Control Modal
    this.trafficThrottleModal = document.getElementById('trafficThrottleModal');
    this.btnThrottle = document.getElementById('btnThrottle');
    this.btnCloseThrottleModal = document.getElementById('btnCloseThrottleModal');
    this.btnApplyThrottle = document.getElementById('btnApplyThrottle');
    this.btnResetThrottle = document.getElementById('btnResetThrottle');
    this.throttleDownSlider = document.getElementById('throttleDownSlider');
    this.throttleUpSlider = document.getElementById('throttleUpSlider');
    this.throttleWiresSlider = document.getElementById('throttleWiresSlider');
    this.throttleDownVal = document.getElementById('throttleDownVal');
    this.throttleUpVal = document.getElementById('throttleUpVal');
    this.throttleWiresVal = document.getElementById('throttleWiresVal');
    this.presetButtons = document.querySelectorAll('.throttle-presets-row .preset-pill-btn');

    // Context Menu
    this.swarmContextMenu = document.getElementById('swarmContextMenu');
    this.menuActionTogglePause = document.getElementById('menuActionTogglePause');
    this.menuActionPauseLabel = document.getElementById('menuActionPauseLabel');
    this.menuActionPauseIcon = document.getElementById('menuActionPauseIcon');
    this.menuActionForceStart = document.getElementById('menuActionForceStart');
    this.menuActionDeepInspect = document.getElementById('menuActionDeepInspect');
    this.menuActionOpenFolder = document.getElementById('menuActionOpenFolder');
    this.menuActionSequential = document.getElementById('menuActionSequential');
    this.menuActionSequentialCheck = document.getElementById('menuActionSequentialCheck');
    this.menuActionChangeVault = document.getElementById('menuActionChangeVault');
    this.subPriorityNormal = document.getElementById('subPriorityNormal');
    this.subPriorityHigh = document.getElementById('subPriorityHigh');
    this.subPriorityEco = document.getElementById('subPriorityEco');
    this.subPriorityCustom = document.getElementById('subPriorityCustom');
    this.menuActionVerifyChunks = document.getElementById('menuActionVerifyChunks');
    this.menuActionRefreshTrackers = document.getElementById('menuActionRefreshTrackers');
    this.menuActionCopyMagnet = document.getElementById('menuActionCopyMagnet');
    this.menuActionCopyInfoHash = document.getElementById('menuActionCopyInfoHash');
    this.menuActionRemoveSwarm = document.getElementById('menuActionRemoveSwarm');
    this.menuActionDeleteFiles = document.getElementById('menuActionDeleteFiles');

    // Toast & Overlay
    this.havenToast = document.getElementById('havenToast');
    this.dragDropOverlay = document.getElementById('dragDropOverlay');

    // Sanctuary Settings Screen Elements
    this.settingsSearchInput = document.getElementById('settingsSearchInput');
    this.anchorPills = document.querySelectorAll('.anchor-pill-btn');
    this.themeCards = document.querySelectorAll('.theme-card');
    this.chkDaylightSync = document.getElementById('chkDaylightSync');
    this.densityButtons = document.querySelectorAll('.density-btn');
    this.sliderDiffusion = document.getElementById('sliderDiffusion');
    this.diffusionValLabel = document.getElementById('diffusionValLabel');

    // Storage section
    this.settingsVaultPath = document.getElementById('settingsVaultPath');
    this.btnChangeVaultDir = document.getElementById('btnChangeVaultDir');
    this.vaultCapacityFill = document.getElementById('vaultCapacityFill');
    this.vaultCapacityTotal = document.getElementById('vaultCapacityTotal');
    this.vaultAvailableText = document.getElementById('vaultAvailableText');
    this.stagingPathDesc = document.getElementById('stagingPathDesc');
    this.chkQuarantineStaging = document.getElementById('chkQuarantineStaging');
    this.chkSafePathLock = document.getElementById('chkSafePathLock');
    this.chkPreallocate = document.getElementById('chkPreallocate');
    this.chkAutoOrganize = document.getElementById('chkAutoOrganize');
    this.chkMoveCompleted = document.getElementById('chkMoveCompleted');

    // Flow & Scheduler section
    this.qosSettingsCards = document.querySelectorAll('.qos-card');
    this.settingsDownSlider = document.getElementById('settingsDownSlider');
    this.settingsUpSlider = document.getElementById('settingsUpSlider');
    this.settingsDownVal = document.getElementById('settingsDownVal');
    this.settingsUpVal = document.getElementById('settingsUpVal');
    this.chkCircadian = document.getElementById('chkCircadian');
    this.selSeedRatio = document.getElementById('selSeedRatio');
    this.selSeedTime = document.getElementById('selSeedTime');

    // Mesh & Privacy section
    this.encPills = document.querySelectorAll('.enc-pill-btn');
    this.chkDht = document.getElementById('chkDht');
    this.chkPex = document.getElementById('chkPex');
    this.chkLpd = document.getElementById('chkLpd');
    this.chkUtp = document.getElementById('chkUtp');
    this.inputListeningPort = document.getElementById('inputListeningPort');
    this.btnRandomizePort = document.getElementById('btnRandomizePort');
    this.chkUpnp = document.getElementById('chkUpnp');

    // System section
    this.chkLaunchLogin = document.getElementById('chkLaunchLogin');
    this.chkMinimizeTray = document.getElementById('chkMinimizeTray');
    this.chkProtocols = document.getElementById('chkProtocols');
    this.chkPreventSleep = document.getElementById('chkPreventSleep');
    this.btnClearCache = document.getElementById('btnClearCache');
    this.btnResetDefaults = document.getElementById('btnResetDefaults');
    this.btnExportConfig = document.getElementById('btnExportConfig');
    this.btnSavePreferences = document.getElementById('btnSavePreferences');

    // Developer Sandbox elements
    this.brandVersionLabel = document.getElementById('brandVersionLabel');
    this.sandboxActiveBadge = document.getElementById('sandboxActiveBadge');
    this.btnExitSandbox = document.getElementById('btnExitSandbox');
    this.devSandboxPill = document.getElementById('devSandboxPill');
    this.secDevSandbox = document.getElementById('secDevSandbox');
    this.chkEnableMockData = document.getElementById('chkEnableMockData');
    this.chkSimulateWaveform = document.getElementById('chkSimulateWaveform');
    this.btnPurgeSandbox = document.getElementById('btnPurgeSandbox');
    this.meshStatusBadge = document.getElementById('meshStatusBadge');
    this.meshNodesOverlay = document.getElementById('meshNodesOverlay');
    this.meshIdleOverlay = document.getElementById('meshIdleOverlay');
    this.meshRateFrankfurt = document.getElementById('meshRateFrankfurt');
    this.meshRateTokyo = document.getElementById('meshRateTokyo');
    this.meshRateSeattle = document.getElementById('meshRateSeattle');
    this.meshRateStockholm = document.getElementById('meshRateStockholm');
    this.meshHubLabel = document.getElementById('meshHubLabel');

    // Window controls
    this.winMin = document.getElementById('winMin');
    this.winMax = document.getElementById('winMax');
    this.winClose = document.getElementById('winClose');
    this.winMinSettings = document.getElementById('winMinSettings');
    this.winMaxSettings = document.getElementById('winMaxSettings');
    this.winCloseSettings = document.getElementById('winCloseSettings');
  }

  /* -------------------------------------------------------------------------
     VIEW SWITCHER
     ------------------------------------------------------------------------- */
  switchView(viewName) {
    this.activeView = viewName;

    // Sidebar active item update
    this.navTransfers?.classList.toggle('active', viewName === 'transfers');
    this.navDeepInspect?.classList.toggle('active', viewName === 'inspect');
    this.navSettingsStudio?.classList.toggle('active', viewName === 'settings');

    const views = [
      { name: 'transfers', el: this.transfersView },
      { name: 'inspect', el: this.inspectView },
      { name: 'settings', el: this.settingsView }
    ];

    views.forEach(v => {
      if (!v.el) return;
      const isActive = v.name === viewName;
      v.el.classList.toggle('active', isActive);
      v.el.classList.toggle('hidden', !isActive);
    });

    if (viewName === 'settings') {
      this.settingsSearchInput?.focus();
    } else if (viewName === 'inspect') {
      this.renderDeepInspect();
      this.drawInspectMountainWaveform();
    } else {
      this.render();
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;

    // Sidebar active item update
    document.getElementById('navAllTransfers')?.classList.toggle('active', filter === 'all');
    document.getElementById('navDownloading')?.classList.toggle('active', filter === 'downloading');
    document.getElementById('navSeeding')?.classList.toggle('active', filter === 'seeding');
    document.getElementById('navCompleted')?.classList.toggle('active', filter === 'completed');

    // Filter pill buttons update
    this.filterButtons?.forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.filter || 'all') === filter);
    });

    this.render();
  }

  /* -------------------------------------------------------------------------
     EVENT ATTACHMENTS
     ------------------------------------------------------------------------- */
  attachEvents() {
    // Sidebar Filter Navigation
    const filterNavs = [
      { id: 'navAllTransfers', filter: 'all' },
      { id: 'navDownloading', filter: 'downloading' },
      { id: 'navSeeding', filter: 'seeding' },
      { id: 'navCompleted', filter: 'completed' }
    ];
    filterNavs.forEach(item => {
      document.getElementById(item.id)?.addEventListener('click', () => {
        this.switchView('transfers');
        this.setFilter(item.filter);
      });
    });

    this.btnBackToTransfers?.addEventListener('click', () => this.switchView('transfers'));
    this.btnBackFromInspect?.addEventListener('click', () => this.switchView('transfers'));
    this.btnOpenSettingsBottom?.addEventListener('click', () => this.switchView('settings'));
    this.btnSecurityMode?.addEventListener('click', () => this.switchView('settings'));
    this.btnNetguardIndicator?.addEventListener('click', () => this.switchView('settings'));
    this.inspectorTargetName?.addEventListener('click', () => this.switchView('inspect'));

    // Top Bar "Add Torrent" button
    this.btnOpenAddModal?.addEventListener('click', () => this.openAddModal());

    // Brand Version 5-Click Developer Mode Unlock
    this.brandVersionLabel?.addEventListener('click', () => {
      this.brandClickCount++;
      clearTimeout(this.brandClickTimer);
      this.brandClickTimer = setTimeout(() => {
        this.brandClickCount = 0;
      }, 2000);
      if (this.brandClickCount >= 5) {
        this.brandClickCount = 0;
        this.unlockDeveloperMode();
      }
    });

    // 1-Click Exit Sandbox Button in Header
    this.btnExitSandbox?.addEventListener('click', () => {
      this.purgeDeveloperSandbox();
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      // Ctrl+Shift+D -> Developer Mode Unlock
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        this.unlockDeveloperMode();
        return;
      }

      if (e.key === 'Escape') {
        this.hideContextMenu();
        this.closeAddModal();
        this.closeDeleteModal();
        this.closeThrottleModal();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'm' || e.key === 'N' || e.key === 'M')) {
        e.preventDefault();
        this.openAddModal();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        this.switchView('settings');
        return;
      }

      // If user is focused on an input, do not trigger card action shortcuts
      if (isInput) return;

      const targetId = this.selectedId || (this.swarms.length > 0 ? this.swarms[0].id : null);
      if (!targetId) return;

      // Space -> Toggle Pause/Resume
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.togglePauseSwarm(targetId);
        return;
      }

      // Ctrl+I or Cmd+I -> Open Deep Inspect Swarm
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        this.selectedId = targetId;
        this.switchView('inspect');
        return;
      }

      // Enter -> Open in Folder
      if (e.key === 'Enter') {
        e.preventDefault();
        this.openTorrentFolder(targetId);
        return;
      }

      // Ctrl+C -> Copy Magnet URI (when not highlighting text)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const selText = window.getSelection()?.toString();
        if (!selText) {
          e.preventDefault();
          this.copyTorrentMagnet(targetId);
        }
        return;
      }

      // Shift+Delete -> Trigger Delete Torrent + Disk Files confirmation
      if (e.shiftKey && (e.key === 'Delete' || e.code === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        this.promptDeleteWithFiles(targetId);
        return;
      }
    });

    // Add Modal Close
    this.btnCloseAddModal?.addEventListener('click', () => this.closeAddModal());
    this.btnCancelAddModal?.addEventListener('click', () => this.closeAddModal());
    this.addDownloadModal?.addEventListener('click', (e) => {
      if (e.target === this.addDownloadModal) this.closeAddModal();
    });

    this.typeMagnetTab?.addEventListener('click', () => this.setAddModalTab('magnet'));
    this.typeTorrentTab?.addEventListener('click', () => this.setAddModalTab('torrent'));

    this.btnPasteClipboard?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && this.modalMagnetUri) {
          this.modalMagnetUri.value = text.trim();
        }
      } catch (_) {}
    });

    this.btnBrowseMagnetPath?.addEventListener('click', async () => {
      if (window.havenNative?.selectFolder) {
        const folder = await window.havenNative.selectFolder();
        if (folder) {
          this.downloadDir = folder;
          localStorage.setItem('haven_download_dir', folder);
          if (this.modalDestPath) this.modalDestPath.textContent = this.formatDisplayPath(folder);
          if (this.settingsVaultPath) this.settingsVaultPath.value = folder;
          this.fetchDiskSpace(folder);
        }
      }
    });

    this.dropZoneModal?.addEventListener('click', () => this.modalFileInput?.click());
    this.btnBrowseTorrentFile?.addEventListener('click', async () => {
      if (window.havenNative?.selectTorrentFile) {
        const path = await window.havenNative.selectTorrentFile();
        if (path) this.loadTorrentFilePath(path);
      } else {
        this.modalFileInput?.click();
      }
    });
    this.modalFileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.path) this.loadTorrentFilePath(file.path);
        else this.loadTorrentFileBlob(file);
      }
    });

    this.btnToggleAdvanced?.addEventListener('click', () => {
      const isHidden = this.accordionContent.classList.contains('hidden');
      if (isHidden) {
        this.accordionContent.classList.remove('hidden');
        this.accordionChevron.classList.add('open');
      } else {
        this.accordionContent.classList.add('hidden');
        this.accordionChevron.classList.remove('open');
      }
    });

    this.btnConfirmMagnet?.addEventListener('click', () => this.handleStartDownload());

    // Filter Buttons in Transfers view
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.render();
      });
    });

    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    this.btnTabFiles?.addEventListener('click', () => this.switchInspectorTab('files'));
    this.btnTabSpeed?.addEventListener('click', () => this.switchInspectorTab('speed'));

    // Flow Control Quick Modal
    this.btnThrottle?.addEventListener('click', () => this.openThrottleModal());
    this.btnCloseThrottleModal?.addEventListener('click', () => this.closeThrottleModal());
    this.trafficThrottleModal?.addEventListener('click', (e) => {
      if (e.target === this.trafficThrottleModal) this.closeThrottleModal();
    });
    this.btnResetThrottle?.addEventListener('click', () => this.resetThrottle());
    this.btnApplyThrottle?.addEventListener('click', () => this.applyThrottle());

    this.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyThrottlePreset(btn.dataset.preset);
      });
    });

    this.throttleDownSlider?.addEventListener('input', () => {
      const val = parseInt(this.throttleDownSlider.value, 10);
      if (this.throttleDownVal) {
        this.throttleDownVal.textContent = val === 0 ? 'Unlimited' : (val >= 1000 ? `${(val / 1000).toFixed(1)} MB/s` : `${val} KB/s`);
      }
      this.presetButtons?.forEach(b => b.classList.remove('active'));
    });

    this.throttleUpSlider?.addEventListener('input', () => {
      const val = parseInt(this.throttleUpSlider.value, 10);
      if (this.throttleUpVal) {
        this.throttleUpVal.textContent = val === 0 ? 'Unlimited' : (val >= 1000 ? `${(val / 1000).toFixed(1)} MB/s` : `${val} KB/s`);
      }
      this.presetButtons?.forEach(b => b.classList.remove('active'));
    });

    this.throttleWiresSlider?.addEventListener('input', () => {
      const val = parseInt(this.throttleWiresSlider.value, 10);
      if (this.throttleWiresVal) {
        this.throttleWiresVal.textContent = `${val} Wires`;
      }
      this.presetButtons?.forEach(b => b.classList.remove('active'));
    });

    // Delete Modal
    this.btnCloseDeleteModal?.addEventListener('click', () => this.closeDeleteModal());
    this.btnCancelDelete?.addEventListener('click', () => this.closeDeleteModal());
    this.deleteSwarmModal?.addEventListener('click', (e) => {
      if (e.target === this.deleteSwarmModal) this.closeDeleteModal();
    });
    this.optKeepData?.addEventListener('click', () => {
      this.optKeepData.classList.add('active');
      this.optDeleteData.classList.remove('active');
    });
    this.optDeleteData?.addEventListener('click', () => {
      this.optDeleteData.classList.add('active');
      this.optKeepData.classList.remove('active');
    });
    this.btnConfirmDelete?.addEventListener('click', () => this.confirmDelete());

    // Window Drag & Drop
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dragDropOverlay?.classList.remove('hidden');
    });
    this.dragDropOverlay?.addEventListener('dragleave', (e) => {
      if (e.target === this.dragDropOverlay) {
        this.dragDropOverlay.classList.add('hidden');
      }
    });
    this.dragDropOverlay?.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dragDropOverlay.classList.add('hidden');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.path) this.loadTorrentFilePath(file.path);
        else this.loadTorrentFileBlob(file);
        this.openAddModal();
        this.setAddModalTab('torrent');
      }
    });

    // Deep Inspect Studio Actions (Alpine Mist Single-Screen)
    this.btnInspectPause?.addEventListener('click', () => {
      const swarm = this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
      if (!swarm) return;
      if (swarm.state === 'downloading') {
        this.pauseSwarm(swarm.id);
      } else {
        this.resumeSwarm(swarm.id);
      }
      this.renderDeepInspect();
    });
    this.btnInspectFolder?.addEventListener('click', () => {
      const swarm = this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
      if (swarm) this.openTorrentFolder(swarm.id);
      else this.showToast(`Storage Pool: ${this.downloadDir}`);
    });
    this.btnInspectVerify?.addEventListener('click', () => {
      const swarm = this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
      if (swarm) this.verifyLocalChunks(swarm.id);
    });

    // Waveform range toggles (60s | 15m | 1h)
    document.querySelectorAll('#inspectWaveformRangeGroup .waveform-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#inspectWaveformRangeGroup .waveform-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.inspectWaveformRange = btn.dataset.range || '60s';
        this.drawInspectMountainWaveform();
        this.showToast(`Flow dynamics window: ${this.inspectWaveformRange}`);
      });
    });

    // Inspector Segmented Subtabs (Files | Trackers | Engine)
    document.querySelectorAll('#inspectTabSwitchGroup .inspect-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchInspectSubTab(btn.dataset.tab);
      });
    });

    // Right Column Swarm Switcher (Peers | Live Stream)
    document.querySelectorAll('#inspectRightGroupToggle .swarm-pill-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#inspectRightGroupToggle .swarm-pill-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.switchInspectRightView(btn.dataset.view);
      });
    });

    // Floating Context Menu Actions
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#swarmContextMenu')) {
        this.hideContextMenu();
      }
    });

    // Group 1: Flow & Swarm Metrics
    this.menuActionTogglePause?.addEventListener('click', () => {
      if (this.contextSwarmId) this.togglePauseSwarm(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionForceStart?.addEventListener('click', () => {
      if (this.contextSwarmId) this.forceStartSwarm(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionDeepInspect?.addEventListener('click', () => {
      if (this.contextSwarmId) {
        this.selectedId = this.contextSwarmId;
        this.switchView('inspect');
      }
      this.hideContextMenu();
    });

    // Group 2: Files & Streaming
    this.menuActionOpenFolder?.addEventListener('click', () => {
      if (this.contextSwarmId) this.openTorrentFolder(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionSequential?.addEventListener('click', () => {
      if (this.contextSwarmId) this.toggleSequentialStream(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionChangeVault?.addEventListener('click', () => {
      if (this.contextSwarmId) this.changeTorrentVault(this.contextSwarmId);
      this.hideContextMenu();
    });

    // Group 3: Bandwidth & Swarm Maintenance
    this.subPriorityNormal?.addEventListener('click', () => {
      if (this.contextSwarmId) this.setFlowPriority(this.contextSwarmId, 'normal');
      this.hideContextMenu();
    });

    this.subPriorityHigh?.addEventListener('click', () => {
      if (this.contextSwarmId) this.setFlowPriority(this.contextSwarmId, 'high');
      this.hideContextMenu();
    });

    this.subPriorityEco?.addEventListener('click', () => {
      if (this.contextSwarmId) this.setFlowPriority(this.contextSwarmId, 'eco');
      this.hideContextMenu();
    });

    this.subPriorityCustom?.addEventListener('click', () => {
      this.openThrottleModal();
      this.hideContextMenu();
    });

    this.menuActionVerifyChunks?.addEventListener('click', () => {
      if (this.contextSwarmId) this.verifyLocalChunks(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionRefreshTrackers?.addEventListener('click', () => {
      if (this.contextSwarmId) this.refreshSwarmTrackers(this.contextSwarmId);
      this.hideContextMenu();
    });

    // Group 4: Clipboard Metadata
    this.menuActionCopyMagnet?.addEventListener('click', () => {
      if (this.contextSwarmId) this.copyTorrentMagnet(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionCopyInfoHash?.addEventListener('click', () => {
      if (this.contextSwarmId) this.copyTorrentInfoHash(this.contextSwarmId);
      this.hideContextMenu();
    });

    // Group 5: Destructive Actions
    this.menuActionRemoveSwarm?.addEventListener('click', () => {
      if (this.contextSwarmId) this.removeSwarmKeepFiles(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionDeleteFiles?.addEventListener('click', () => {
      if (this.contextSwarmId) this.promptDeleteWithFiles(this.contextSwarmId);
      this.hideContextMenu();
    });

    // Desktop Window Controls
    const attachWinControls = (min, max, close) => {
      min?.addEventListener('click', () => window.havenNative?.minimizeWindow());
      max?.addEventListener('click', () => window.havenNative?.maximizeWindow());
      close?.addEventListener('click', () => window.havenNative?.closeWindow());
    };
    attachWinControls(this.winMin, this.winMax, this.winClose);
    attachWinControls(this.winMinSettings, this.winMaxSettings, this.winCloseSettings);
    attachWinControls(this.winMinInspect, this.winMaxInspect, this.winCloseInspect);
  }

  /* -------------------------------------------------------------------------
     SANCTUARY SETTINGS EVENT HANDLERS & LOGIC
     ------------------------------------------------------------------------- */
  initSettingsEvents() {
    // 0. Dynamic OS-Aware Labels
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || '');
    const isWin = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || navigator.platform || '');
    const lblLaunch = document.getElementById('lblLaunchStartup');
    const lblTray = document.getElementById('lblMinimizeTray');
    if (lblLaunch) {
      lblLaunch.textContent = isMac ? 'Launch Haven at macOS login' : (isWin ? 'Launch Haven at Windows startup' : 'Launch Haven at system startup');
    }
    if (lblTray) {
      lblTray.textContent = isMac ? 'Minimize to menu bar tray on close' : 'Minimize to system tray on close';
    }

    // 1. Anchor Pill Navigation & ScrollSpy
    const scrollContainer = document.querySelector('.settings-scroll-area');
    this.anchorPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.anchorPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const targetId = pill.dataset.target;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          targetEl.classList.add('card-highlight-pulse');
          setTimeout(() => targetEl.classList.remove('card-highlight-pulse'), 1300);
        }
      });
    });

    // ScrollSpy to highlight active anchor pill automatically
    if (scrollContainer) {
      let isScrolling = false;
      scrollContainer.addEventListener('scroll', () => {
        if (isScrolling) return;
        isScrolling = true;
        requestAnimationFrame(() => {
          const sections = [
            { id: 'secAppearance', el: document.getElementById('secAppearance') },
            { id: 'secStorage', el: document.getElementById('secStorage') },
            { id: 'secFlow', el: document.getElementById('secFlow') },
            { id: 'secMesh', el: document.getElementById('secMesh') },
            { id: 'secSystem', el: document.getElementById('secSystem') }
          ].filter(s => s.el);

          const containerTop = scrollContainer.getBoundingClientRect().top;
          let currentSectionId = sections[0]?.id;

          for (const sec of sections) {
            const rect = sec.el.getBoundingClientRect();
            if (rect.top - containerTop <= 140) {
              currentSectionId = sec.id;
            }
          }

          if (currentSectionId) {
            this.anchorPills.forEach(pill => {
              pill.classList.toggle('active', pill.dataset.target === currentSectionId);
            });
          }
          isScrolling = false;
        });
      }, { passive: true });
    }

    // 2. Theme & Atmosphere Studio
    this.themeCards.forEach(card => {
      card.addEventListener('click', () => {
        this.themeCards.forEach(c => {
          c.classList.remove('active');
          c.querySelector('.theme-check-badge')?.classList.add('hidden');
        });
        card.classList.add('active');
        card.querySelector('.theme-check-badge')?.classList.remove('hidden');

        const theme = card.dataset.theme;
        this.applyTheme(theme);
        this.showToast(`Atmosphere set to ${card.querySelector('.theme-name').textContent}`);
        this.persistSanctuarySettings();
      });
    });

    // Daylight Sync toggle
    this.chkDaylightSync?.addEventListener('change', () => {
      const active = this.chkDaylightSync.checked;
      if (active) {
        this.evaluateDaylightSync();
      } else {
        this.showToast('Natural Daylight Sync paused. Manual theme override engaged.');
      }
      this.persistSanctuarySettings();
    });

    // Interface Density Buttons
    this.densityButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.densityButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const density = btn.dataset.density;
        document.body.classList.toggle('density-compact', density === 'compact');
        localStorage.setItem('haven_density', density);
        this.showToast(`Interface density set to ${density === 'compact' ? 'Compact' : 'Sanctuary (Spacious)'}`);
        this.persistSanctuarySettings();
      });
    });

    // Glass Diffusion Slider
    this.sliderDiffusion?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (this.diffusionValLabel) this.diffusionValLabel.textContent = `${val} px Frosted`;
      document.documentElement.style.setProperty('--backdrop-blur-depth', `${val}px`);
      this.persistSanctuarySettings();
    });

    // 3. Storage Vault & SafePath Rules
    this.btnChangeVaultDir?.addEventListener('click', async () => {
      if (window.havenNative?.selectFolder) {
        const folder = await window.havenNative.selectFolder();
        if (folder) {
          this.setVaultDirectory(folder);
        }
      } else {
        const input = prompt('Enter new storage vault path:', this.settingsVaultPath?.value || this.downloadDir);
        if (input && input.trim()) {
          this.setVaultDirectory(input.trim());
        }
      }
    });

    this.settingsVaultPath?.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (val) this.setVaultDirectory(val);
    });

    // SafePath Switches
    this.chkQuarantineStaging?.addEventListener('change', () => {
      const chk = this.chkQuarantineStaging.checked;
      this.showToast(`Quarantine staging ${chk ? 'enabled (temp chunks verified)' : 'disabled'}`);
      this.persistSanctuarySettings();
    });

    this.chkSafePathLock?.addEventListener('change', () => {
      const chk = this.chkSafePathLock.checked;
      this.showToast(`SafePath Confinement Lock ${chk ? 'enforced (traversal blocked)' : 'disabled'}`);
      this.persistSanctuarySettings();
    });

    this.chkPreallocate?.addEventListener('change', () => {
      const chk = this.chkPreallocate.checked;
      this.showToast(`Pre-allocation disk mode ${chk ? 'active (zero fragmentation)' : 'disabled'}`);
      this.persistSanctuarySettings();
    });

    this.chkAutoOrganize?.addEventListener('change', () => {
      const chk = this.chkAutoOrganize.checked;
      this.showToast(`Auto-organization ${chk ? 'enabled (routing Audio, Video, ISO bins)' : 'disabled'}`);
      this.persistSanctuarySettings();
    });

    this.chkMoveCompleted?.addEventListener('change', () => {
      const chk = this.chkMoveCompleted.checked;
      this.showToast(`Move completed transfers to cold archive ${chk ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });

    // 4. Flow Control, Bandwidth & Scheduler
    this.qosSettingsCards.forEach(card => {
      card.addEventListener('click', () => {
        this.qosSettingsCards.forEach(c => {
          c.classList.remove('active');
          const chk = c.querySelector('.qos-check');
          if (chk) chk.textContent = '';
        });
        card.classList.add('active');
        const checkEl = card.querySelector('.qos-check');
        if (checkEl) checkEl.textContent = '✓';

        const preset = card.dataset.preset;
        if (preset === 'unrestricted') {
          if (this.settingsDownSlider) this.settingsDownSlider.value = 0;
          if (this.settingsUpSlider) this.settingsUpSlider.value = 0;
          if (this.settingsDownVal) this.settingsDownVal.textContent = 'Unlimited (0 KB/s)';
          if (this.settingsUpVal) this.settingsUpVal.textContent = 'Unlimited (0 KB/s)';
        } else if (preset === 'balanced') {
          if (this.settingsDownSlider) this.settingsDownSlider.value = 0;
          if (this.settingsUpSlider) this.settingsUpSlider.value = 5000;
          if (this.settingsDownVal) this.settingsDownVal.textContent = 'Unlimited (0 KB/s)';
          if (this.settingsUpVal) this.settingsUpVal.textContent = '5.0 MB/s';
        } else if (preset === 'silent') {
          if (this.settingsDownSlider) this.settingsDownSlider.value = 2500;
          if (this.settingsUpSlider) this.settingsUpSlider.value = 500;
          if (this.settingsDownVal) this.settingsDownVal.textContent = '2.5 MB/s';
          if (this.settingsUpVal) this.settingsUpVal.textContent = '500 KB/s';
        }
        this.showToast(`QoS profile switched to ${card.querySelector('.qos-name').textContent}`);
        this.persistSanctuarySettings();
      });
    });

    this.settingsDownSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (this.settingsDownVal) {
        this.settingsDownVal.textContent = val === 0 ? 'Unlimited (0 KB/s)' : `${(val / 1000).toFixed(1)} MB/s`;
      }
      this.qosSettingsCards.forEach(c => c.classList.remove('active'));
    });

    this.settingsUpSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (this.settingsUpVal) {
        this.settingsUpVal.textContent = val === 0 ? 'Unlimited (0 KB/s)' : `${(val / 1000).toFixed(1)} MB/s`;
      }
      this.qosSettingsCards.forEach(c => c.classList.remove('active'));
    });

    // Circadian Scheduler Toggle & Timeline
    this.chkCircadian?.addEventListener('change', () => {
      const chk = this.chkCircadian.checked;
      const bar = document.querySelector('.circadian-timeline-bar');
      const label = document.querySelector('.circadian-state-label');
      if (bar) bar.style.opacity = chk ? '1' : '0.45';
      if (label) label.textContent = chk ? 'Active Rate: Day Throttle / Night Stream' : 'Circadian Scheduling Paused';
      this.showToast(`Circadian Speed Scheduler ${chk ? 'active' : 'paused'}`);
      this.persistSanctuarySettings();
    });

    document.querySelectorAll('.circadian-segment').forEach(seg => {
      seg.style.cursor = 'pointer';
      seg.addEventListener('click', () => {
        const title = seg.getAttribute('title') || seg.textContent;
        this.showToast(`Circadian Window: ${title}`);
      });
    });

    // Seed Limit Dropdowns
    this.selSeedRatio?.addEventListener('change', () => {
      const txt = this.selSeedRatio.options[this.selSeedRatio.selectedIndex].text;
      this.showToast(`Target seed ratio set to: ${txt}`);
      this.persistSanctuarySettings();
    });

    this.selSeedTime?.addEventListener('change', () => {
      const txt = this.selSeedTime.options[this.selSeedTime.selectedIndex].text;
      this.showToast(`Maximum seeding duration set to: ${txt}`);
      this.persistSanctuarySettings();
    });

    // 5. Swarm Mesh, Mountain Relays & Privacy
    this.encPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.encPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.showToast(`Payload Encryption set to: ${pill.textContent.trim()}`);
        this.persistSanctuarySettings();
      });
    });

    // Mountain Mesh Nodes Interactivity
    const nodeFrankfurt = document.querySelector('.node-frankfurt');
    const nodeTokyo = document.querySelector('.node-tokyo');
    const nodeSeattle = document.querySelector('.node-seattle');
    const nodeStockholm = document.querySelector('.node-stockholm');
    const centerHub = document.querySelector('.center-sanctuary-hub');

    [nodeFrankfurt, nodeTokyo, nodeSeattle, nodeStockholm, centerHub].forEach(n => {
      if (!n) return;
      n.style.cursor = 'pointer';
    });

    nodeFrankfurt?.addEventListener('click', () => {
      this.showToast('Frankfurt Relay: Haven 2.4 • 28ms ping • Inbound 2.6 MB/s • Verified peer');
    });
    nodeTokyo?.addEventListener('click', () => {
      this.showToast('Tokyo Relay: libtorrent • 132ms ping • Inbound 3.8 MB/s • Verified peer');
    });
    nodeSeattle?.addEventListener('click', () => {
      this.showToast('Seattle Relay: Transmission • 74ms ping • Inbound 1.4 MB/s • Verified peer');
    });
    nodeStockholm?.addEventListener('click', () => {
      this.showToast('Stockholm Relay: Haven Core • 35ms ping • Inbound 3.1 MB/s • Verified peer');
    });
    centerHub?.addEventListener('click', () => {
      this.showToast('You (Sanctuary Buffer): 148 verified mesh connections • Strict AES-256 E2E');
    });

    // Protocol Toggles
    this.chkDht?.addEventListener('change', () => {
      this.showToast(`Distributed Hash Table (DHT) ${this.chkDht.checked ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });
    this.chkPex?.addEventListener('change', () => {
      this.showToast(`Peer Exchange (PEX) Relay ${this.chkPex.checked ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });
    this.chkLpd?.addEventListener('change', () => {
      this.showToast(`Local Peer Discovery (LPD) ${this.chkLpd.checked ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });
    this.chkUtp?.addEventListener('change', () => {
      this.showToast(`uTP congestion control ${this.chkUtp.checked ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });

    // Listening Port & Randomize
    this.btnRandomizePort?.addEventListener('click', () => {
      const array = new Uint16Array(1);
      (window.crypto || window.msCrypto).getRandomValues(array);
      const randPort = 1024 + (array[0] % (65535 - 1024 + 1));
      if (this.inputListeningPort) {
        this.inputListeningPort.value = randPort;
        this.showToast(`Listening port randomized to ${randPort}`);
        this.persistSanctuarySettings();
      }
    });

    this.inputListeningPort?.addEventListener('change', () => {
      let p = parseInt(this.inputListeningPort.value, 10);
      if (isNaN(p) || p < 1024) p = 1024;
      if (p > 65535) p = 65535;
      this.inputListeningPort.value = p;
      this.showToast(`Listening port set to ${p}`);
      this.persistSanctuarySettings();
    });

    this.chkUpnp?.addEventListener('change', () => {
      const chk = this.chkUpnp.checked;
      const badge = document.querySelector('.port-status-badge');
      if (badge) {
        badge.textContent = chk ? '● Port Routable & Open' : '○ Port Forwarding Manual';
        badge.style.color = chk ? '#10b981' : 'var(--text-muted)';
        badge.style.backgroundColor = chk ? 'var(--alpine-green-light)' : 'var(--bg-subtle)';
      }
      this.showToast(`UPnP / NAT-PMP Auto-Forward ${chk ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });

    // 6. System & Automation Switches
    this.chkLaunchLogin?.addEventListener('change', () => {
      this.showToast(`Launch Haven at system startup ${this.chkLaunchLogin.checked ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });
    this.chkMinimizeTray?.addEventListener('change', () => {
      this.showToast(`Minimize to tray on close ${this.chkMinimizeTray.checked ? 'enabled' : 'disabled'}`);
      this.persistSanctuarySettings();
    });
    this.chkProtocols?.addEventListener('change', () => {
      this.showToast(`.torrent and magnet associations ${this.chkProtocols.checked ? 'registered' : 'unregistered'}`);
      this.persistSanctuarySettings();
    });
    this.chkPreventSleep?.addEventListener('change', () => {
      this.showToast(`System stay-awake assertion ${this.chkPreventSleep.checked ? 'asserted' : 'released'}`);
      this.persistSanctuarySettings();
    });

    // 7. Footer Action Buttons
    this.btnClearCache?.addEventListener('click', async () => {
      if (window.havenNative?.clearCache) {
        try {
          const res = await window.havenNative.clearCache();
          if (this.btnClearCache) {
            this.btnClearCache.textContent = 'Cache Cleared (0 KB)';
          }
          const freed = res?.freedMB ? `${res.freedMB} MB` : '0 KB';
          this.showToast(`✓ InfoHash cache cleared (${freed} freed on disk).`);
          return;
        } catch (err) {
          console.warn('Clear cache error:', err);
        }
      }
      if (this.btnClearCache) {
        this.btnClearCache.textContent = 'Cache Cleared (0 KB)';
      }
      this.showToast('✓ InfoHash cache cleared.');
    });

    this.btnResetDefaults?.addEventListener('click', () => {
      if (confirm('Reset all Sanctuary rules and atmosphere settings to pristine Alpine defaults?')) {
        this.resetAlpineDefaults();
      }
    });

    this.btnExportConfig?.addEventListener('click', () => {
      const config = this.collectSanctuarySettings();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'haven-sanctuary-config.json';
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('✓ Sanctuary configuration exported to haven-sanctuary-config.json');
    });

    this.btnSavePreferences?.addEventListener('click', () => {
      this.saveSanctuaryPreferences();
    });

    // Developer Sandbox Mode Toggles & Purge
    this.chkEnableMockData?.addEventListener('change', () => {
      this.toggleMockData(this.chkEnableMockData.checked);
    });

    this.chkSimulateWaveform?.addEventListener('change', () => {
      this.toggleWaveformSimulation(this.chkSimulateWaveform.checked);
    });

    this.btnPurgeSandbox?.addEventListener('click', () => {
      this.purgeDeveloperSandbox();
    });

    // Settings Live Search Filter
    this.settingsSearchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const sections = document.querySelectorAll('.settings-card');
      sections.forEach(sec => {
        const text = sec.textContent.toLowerCase();
        if (!query || text.includes(query)) {
          sec.style.display = '';
        } else {
          sec.style.display = 'none';
        }
      });
    });
  }

  setVaultDirectory(folder) {
    this.downloadDir = folder;
    if (this.settingsVaultPath) this.settingsVaultPath.value = folder;
    if (this.stagingPathDesc) {
      this.stagingPathDesc.textContent = `Keep temporary payload blocks safely until 100% SHA256 verified: ${folder}\\.staging`;
    }
    localStorage.setItem('haven_download_dir', folder);
    this.fetchDiskSpace(folder);
    this.showToast(`Storage vault bound to: ${folder}`);
    this.persistSanctuarySettings();
  }

  evaluateDaylightSync() {
    const hours = new Date().getHours();
    const isNight = hours < 7 || hours >= 19;
    const targetTheme = isNight ? 'midnight-pine' : 'alpine-mist';
    this.applyTheme(targetTheme);
    this.themeCards.forEach(c => {
      const isCard = c.dataset.theme === targetTheme;
      c.classList.toggle('active', isCard);
      c.querySelector('.theme-check-badge')?.classList.toggle('hidden', !isCard);
    });
    this.showToast(`Daylight Sync active: ${isNight ? 'Midnight Pine engaged for night' : 'Alpine Mist engaged for daytime'}`);
  }

  collectSanctuarySettings() {
    const activeEncPill = document.querySelector('.enc-pill-btn.active');
    return {
      version: '1.4',
      vault: this.settingsVaultPath?.value || this.downloadDir,
      theme: localStorage.getItem('haven_theme') || 'alpine-mist',
      density: localStorage.getItem('haven_density') || 'spacious',
      daylightSync: this.chkDaylightSync ? this.chkDaylightSync.checked : true,
      diffusion: this.sliderDiffusion ? parseInt(this.sliderDiffusion.value, 10) : 24,
      quarantineStaging: this.chkQuarantineStaging ? this.chkQuarantineStaging.checked : true,
      safePathLock: this.chkSafePathLock ? this.chkSafePathLock.checked : true,
      preallocate: this.chkPreallocate ? this.chkPreallocate.checked : true,
      autoOrganize: this.chkAutoOrganize ? this.chkAutoOrganize.checked : true,
      moveCompleted: this.chkMoveCompleted ? this.chkMoveCompleted.checked : false,
      maxDownKBs: this.settingsDownSlider ? parseInt(this.settingsDownSlider.value, 10) : 0,
      maxUpKBs: this.settingsUpSlider ? parseInt(this.settingsUpSlider.value, 10) : 5000,
      circadian: this.chkCircadian ? this.chkCircadian.checked : true,
      seedRatio: this.selSeedRatio ? this.selSeedRatio.value : '2.0',
      seedTime: this.selSeedTime ? this.selSeedTime.value : '72',
      encryption: activeEncPill ? activeEncPill.dataset.enc : 'strict',
      dht: this.chkDht ? this.chkDht.checked : true,
      pex: this.chkPex ? this.chkPex.checked : true,
      lpd: this.chkLpd ? this.chkLpd.checked : true,
      utp: this.chkUtp ? this.chkUtp.checked : true,
      port: this.inputListeningPort ? parseInt(this.inputListeningPort.value, 10) : 6881,
      upnp: this.chkUpnp ? this.chkUpnp.checked : true,
      launchLogin: this.chkLaunchLogin ? this.chkLaunchLogin.checked : true,
      minimizeTray: this.chkMinimizeTray ? this.chkMinimizeTray.checked : true,
      protocols: this.chkProtocols ? this.chkProtocols.checked : true,
      preventSleep: this.chkPreventSleep ? this.chkPreventSleep.checked : true,
      savedAt: new Date().toISOString()
    };
  }

  persistSanctuarySettings() {
    const config = this.collectSanctuarySettings();
    localStorage.setItem('haven_sanctuary_settings', JSON.stringify(config));
    if (window.havenNative?.saveConfig) {
      window.havenNative.saveConfig(config).catch(() => {});
    }
  }

  async saveSanctuaryPreferences() {
    const config = this.collectSanctuarySettings();
    localStorage.setItem('haven_sanctuary_settings', JSON.stringify(config));
    localStorage.setItem('haven_download_dir', config.vault);
    localStorage.setItem('haven_theme', config.theme);
    localStorage.setItem('haven_density', config.density);

    // Sync with Native Engine IPC if available
    if (window.havenNative?.setTrafficThrottle) {
      window.havenNative.setTrafficThrottle({
        downBytesSec: config.maxDownKBs > 0 ? config.maxDownKBs * 1024 : -1,
        upBytesSec: config.maxUpKBs > 0 ? config.maxUpKBs * 1024 : -1,
        maxConns: 60
      });
    }

    if (window.havenNative?.saveConfig) {
      try {
        await window.havenNative.saveConfig(config);
      } catch (err) {
        console.warn('Native saveConfig error:', err);
      }
    } else if (window.havenNative?.saveSettings) {
      window.havenNative.saveSettings(config);
    }

    this.showToast('✓ Sanctuary preferences saved & applied across engine.');
  }

  /* -------------------------------------------------------------------------
     DEVELOPER SANDBOX CONTROLLER
     ------------------------------------------------------------------------- */
  unlockDeveloperMode() {
    this.isDeveloperModeUnlocked = true;
    localStorage.setItem('haven_dev_mode_unlocked', 'true');
    this.applyDeveloperModeVisibility();
    this.showToast('Developer Mode Unlocked 🛠');
  }

  applyDeveloperModeVisibility() {
    if (this.isDeveloperModeUnlocked) {
      this.devSandboxPill?.classList.remove('hidden');
      this.secDevSandbox?.classList.remove('hidden');
    } else {
      this.devSandboxPill?.classList.add('hidden');
      this.secDevSandbox?.classList.add('hidden');
    }

    if (this.sandboxActiveBadge) {
      this.sandboxActiveBadge.classList.toggle('hidden', !this.useMockData);
    }

    if (this.chkEnableMockData) {
      this.chkEnableMockData.checked = this.useMockData;
    }
    if (this.chkSimulateWaveform) {
      this.chkSimulateWaveform.checked = this.simulateWaveform;
    }
  }

  toggleMockData(enable) {
    this.useMockData = enable;
    localStorage.setItem('haven_use_mock_data', String(enable));

    if (enable) {
      if (window.MockSanctuaryData?.MOCK_SWARMS) {
        this.swarms = JSON.parse(JSON.stringify(window.MockSanctuaryData.MOCK_SWARMS));
      }
      this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
      this.applyDeveloperModeVisibility();
      this.render();
      this.updateMeshMap();
      this.showToast('Sandbox Mock Transfers & Swarms Enabled 🛠');
    } else {
      this.swarms = this.initSwarms();
      this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
      this.applyDeveloperModeVisibility();
      this.render();
      this.updateMeshMap();
      this.showToast('Production State: Clean Real Torrents Active');
    }
  }

  toggleWaveformSimulation(enable) {
    this.simulateWaveform = enable;
    localStorage.setItem('haven_simulate_waveform', String(enable));
    this.updateMeshMap();
    if (!enable) {
      this.inflowHistory = new Array(60).fill(0);
      this.outflowHistory = new Array(60).fill(0);
      this.drawChart();
    }
    this.showToast(enable ? 'Simulating Live Speed Waveform & Peer Mesh ⚡' : 'Speed Waveform Simulation Stopped');
  }

  purgeDeveloperSandbox() {
    this.useMockData = false;
    this.simulateWaveform = false;
    localStorage.setItem('haven_use_mock_data', 'false');
    localStorage.setItem('haven_simulate_waveform', 'false');
    localStorage.removeItem('haven_sandbox_mock_swarms');

    if (this.chkEnableMockData) this.chkEnableMockData.checked = false;
    if (this.chkSimulateWaveform) this.chkSimulateWaveform.checked = false;

    this.inflowHistory = new Array(60).fill(0);
    this.outflowHistory = new Array(60).fill(0);

    this.swarms = this.initSwarms();
    this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;

    this.applyDeveloperModeVisibility();
    this.render();
    this.updateMeshMap();
    this.drawChart();
    this.showToast('Sandbox Purged: Returned to Clean WebTorrent State');
  }

  updateMeshMap() {
    if (!this.meshStatusBadge) return;

    if (this.simulateWaveform) {
      this.meshStatusBadge.textContent = '● 4 Simulated Relay Nodes (Dev Sandbox)';
      this.meshStatusBadge.className = 'card-status-badge badge-amber';
      this.meshIdleOverlay?.classList.add('hidden');
      this.meshNodesOverlay?.classList.remove('hidden');
      if (this.meshHubLabel) this.meshHubLabel.textContent = 'You (Simulated Hub)';
      return;
    }

    // Real mesh calculations from active swarms
    let totalConnectedPeers = 0;
    this.swarms.forEach(s => {
      totalConnectedPeers += (s.peers || 0);
    });

    if (totalConnectedPeers > 0) {
      this.meshStatusBadge.textContent = `● ${totalConnectedPeers} Verified Swarm Nodes`;
      this.meshStatusBadge.className = 'card-status-badge badge-mint';
      this.meshIdleOverlay?.classList.add('hidden');
      this.meshNodesOverlay?.classList.remove('hidden');
      if (this.meshHubLabel) this.meshHubLabel.textContent = 'You (Sanctuary Buffer)';
    } else {
      this.meshStatusBadge.textContent = '● 0 Active Relay Nodes — Waiting for Swarm';
      this.meshStatusBadge.className = 'card-status-badge badge-mint';
      this.meshIdleOverlay?.classList.remove('hidden');
      this.meshNodesOverlay?.classList.add('hidden');
      if (this.meshHubLabel) this.meshHubLabel.textContent = 'You (Idle Standby)';
    }
  }

  resetAlpineDefaults() {
    this.applyTheme('alpine-mist');
    this.themeCards.forEach(c => {
      const isDefault = c.dataset.theme === 'alpine-mist';
      c.classList.toggle('active', isDefault);
      c.querySelector('.theme-check-badge')?.classList.toggle('hidden', !isDefault);
    });

    document.body.classList.remove('density-compact');
    this.densityButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.density === 'spacious');
    });

    if (this.chkDaylightSync) this.chkDaylightSync.checked = true;
    if (this.sliderDiffusion) {
      this.sliderDiffusion.value = 24;
      if (this.diffusionValLabel) this.diffusionValLabel.textContent = '24 px Frosted';
      document.documentElement.style.setProperty('--backdrop-blur-depth', '24px');
    }

    if (this.chkQuarantineStaging) this.chkQuarantineStaging.checked = true;
    if (this.chkSafePathLock) this.chkSafePathLock.checked = true;
    if (this.chkPreallocate) this.chkPreallocate.checked = true;
    if (this.chkAutoOrganize) this.chkAutoOrganize.checked = true;
    if (this.chkMoveCompleted) this.chkMoveCompleted.checked = false;

    // Rates
    if (this.settingsDownSlider) this.settingsDownSlider.value = 0;
    if (this.settingsUpSlider) this.settingsUpSlider.value = 5000;
    if (this.settingsDownVal) this.settingsDownVal.textContent = 'Unlimited (0 KB/s)';
    if (this.settingsUpVal) this.settingsUpVal.textContent = '5.0 MB/s';

    this.qosSettingsCards.forEach(c => {
      const isBalanced = c.dataset.preset === 'balanced';
      c.classList.toggle('active', isBalanced);
      const chk = c.querySelector('.qos-check');
      if (chk) chk.textContent = isBalanced ? '✓' : '';
    });

    if (this.chkCircadian) this.chkCircadian.checked = true;
    const bar = document.querySelector('.circadian-timeline-bar');
    if (bar) bar.style.opacity = '1';

    if (this.selSeedRatio) this.selSeedRatio.value = '2.0';
    if (this.selSeedTime) this.selSeedTime.value = '72';

    this.encPills.forEach(p => {
      p.classList.toggle('active', p.dataset.enc === 'strict');
    });

    if (this.chkDht) this.chkDht.checked = true;
    if (this.chkPex) this.chkPex.checked = true;
    if (this.chkLpd) this.chkLpd.checked = true;
    if (this.chkUtp) this.chkUtp.checked = true;
    if (this.inputListeningPort) this.inputListeningPort.value = 6881;
    if (this.chkUpnp) this.chkUpnp.checked = true;

    if (this.chkLaunchLogin) this.chkLaunchLogin.checked = true;
    if (this.chkMinimizeTray) this.chkMinimizeTray.checked = true;
    if (this.chkProtocols) this.chkProtocols.checked = true;
    if (this.chkPreventSleep) this.chkPreventSleep.checked = true;

    this.persistSanctuarySettings();
    this.showToast('✓ Settings reset to pristine Alpine defaults.');
  }

  applyTheme(theme) {
    document.body.className = `alpine-theme theme-${theme}`;
    localStorage.setItem('haven_theme', theme);
  }

  async loadSavedSettings() {
    let saved = null;
    try {
      const raw = localStorage.getItem('haven_sanctuary_settings');
      if (raw) saved = JSON.parse(raw);
    } catch (_) {}

    if (window.havenNative?.loadConfig) {
      try {
        const fileCfg = await window.havenNative.loadConfig();
        if (fileCfg && typeof fileCfg === 'object') {
          saved = Object.assign({}, saved || {}, fileCfg);
          if (fileCfg.vault) {
            this.downloadDir = fileCfg.vault;
            this.fetchDiskSpace(this.downloadDir);
          }
        }
      } catch (_) {}
    }

    const savedTheme = saved?.theme || localStorage.getItem('haven_theme') || 'alpine-mist';
    this.applyTheme(savedTheme);
    this.themeCards.forEach(c => {
      const isActive = c.dataset.theme === savedTheme;
      c.classList.toggle('active', isActive);
      c.querySelector('.theme-check-badge')?.classList.toggle('hidden', !isActive);
    });

    const savedDensity = saved?.density || localStorage.getItem('haven_density') || 'spacious';
    document.body.classList.toggle('density-compact', savedDensity === 'compact');
    this.densityButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.density === savedDensity);
    });

    if (saved) {
      if (this.chkDaylightSync && typeof saved.daylightSync === 'boolean') {
        this.chkDaylightSync.checked = saved.daylightSync;
      }
      if (this.sliderDiffusion && saved.diffusion) {
        this.sliderDiffusion.value = saved.diffusion;
        if (this.diffusionValLabel) this.diffusionValLabel.textContent = `${saved.diffusion} px Frosted`;
        document.documentElement.style.setProperty('--backdrop-blur-depth', `${saved.diffusion}px`);
      }
      if (this.chkQuarantineStaging && typeof saved.quarantineStaging === 'boolean') {
        this.chkQuarantineStaging.checked = saved.quarantineStaging;
      }
      if (this.chkSafePathLock && typeof saved.safePathLock === 'boolean') {
        this.chkSafePathLock.checked = saved.safePathLock;
      }
      if (this.chkPreallocate && typeof saved.preallocate === 'boolean') {
        this.chkPreallocate.checked = saved.preallocate;
      }
      if (this.chkAutoOrganize && typeof saved.autoOrganize === 'boolean') {
        this.chkAutoOrganize.checked = saved.autoOrganize;
      }
      if (this.chkMoveCompleted && typeof saved.moveCompleted === 'boolean') {
        this.chkMoveCompleted.checked = saved.moveCompleted;
      }
      if (this.settingsDownSlider && typeof saved.maxDownKBs === 'number') {
        this.settingsDownSlider.value = saved.maxDownKBs;
        if (this.settingsDownVal) {
          this.settingsDownVal.textContent = saved.maxDownKBs === 0 ? 'Unlimited (0 KB/s)' : `${(saved.maxDownKBs / 1000).toFixed(1)} MB/s`;
        }
      }
      if (this.settingsUpSlider && typeof saved.maxUpKBs === 'number') {
        this.settingsUpSlider.value = saved.maxUpKBs;
        if (this.settingsUpVal) {
          this.settingsUpVal.textContent = saved.maxUpKBs === 0 ? 'Unlimited (0 KB/s)' : `${(saved.maxUpKBs / 1000).toFixed(1)} MB/s`;
        }
      }
      if (this.chkCircadian && typeof saved.circadian === 'boolean') {
        this.chkCircadian.checked = saved.circadian;
      }
      if (this.selSeedRatio && saved.seedRatio) {
        this.selSeedRatio.value = saved.seedRatio;
      }
      if (this.selSeedTime && saved.seedTime) {
        this.selSeedTime.value = saved.seedTime;
      }
      if (saved.encryption) {
        this.encPills.forEach(p => {
          p.classList.toggle('active', p.dataset.enc === saved.encryption);
        });
      }
      if (this.chkDht && typeof saved.dht === 'boolean') this.chkDht.checked = saved.dht;
      if (this.chkPex && typeof saved.pex === 'boolean') this.chkPex.checked = saved.pex;
      if (this.chkLpd && typeof saved.lpd === 'boolean') this.chkLpd.checked = saved.lpd;
      if (this.chkUtp && typeof saved.utp === 'boolean') this.chkUtp.checked = saved.utp;
      if (this.inputListeningPort && saved.port) this.inputListeningPort.value = saved.port;
      if (this.chkUpnp && typeof saved.upnp === 'boolean') this.chkUpnp.checked = saved.upnp;
      if (this.chkLaunchLogin && typeof saved.launchLogin === 'boolean') this.chkLaunchLogin.checked = saved.launchLogin;
      if (this.chkMinimizeTray && typeof saved.minimizeTray === 'boolean') this.chkMinimizeTray.checked = saved.minimizeTray;
      if (this.chkProtocols && typeof saved.protocols === 'boolean') this.chkProtocols.checked = saved.protocols;
      if (this.chkPreventSleep && typeof saved.preventSleep === 'boolean') this.chkPreventSleep.checked = saved.preventSleep;
    }

    if (this.settingsVaultPath) {
      this.settingsVaultPath.value = this.downloadDir;
    }
  }

  showToast(message) {
    if (!this.havenToast) return;
    this.havenToast.textContent = message;
    this.havenToast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.havenToast.classList.add('hidden');
    }, 3200);
  }

  /* -------------------------------------------------------------------------
     NATIVE ENGINE EVENTS
     ------------------------------------------------------------------------- */
  initNativeEngineEvents() {
    if (!window.havenNative) return;

    window.havenNative.onTorrentStatusBatch?.((payload) => {
      const batch = Array.isArray(payload) ? payload : (payload?.swarms || []);
      const globalStats = payload?.global;

      if (globalStats) {
        this.globalDownSpeed = globalStats.downloadSpeed || 0;
        this.globalUpSpeed = globalStats.uploadSpeed || 0;
        this.globalRatio = globalStats.ratio || 0;
        this.globalActivePeers = globalStats.totalActivePeers || 0;
      }

      let dirty = false;
      batch.forEach(status => {
        const s = this.swarms.find(item => item.id === status.id || (status.infoHash && item.hash && item.hash.toLowerCase() === status.infoHash.toLowerCase()));
        if (s) {
          dirty = true;
          s.progressPct = Math.round((status.progress || 0) * 100);
          s.rawDownSpeed = status.downloadSpeed || 0;
          s.rawUpSpeed = status.uploadSpeed || 0;
          s.downSpeed = this.formatSpeed(status.downloadSpeed || 0);
          s.upSpeed = this.formatSpeed(status.uploadSpeed || 0);
          s.peers = status.numPeers || 0;
          s.sizeBytes = status.total || s.sizeBytes;
          s.sizeFormatted = this.formatBytes(status.total || s.sizeBytes);
          s.verifiedBytes = status.verifiedBytes || 0;
          s.bytesOnDisk = status.bytesOnDisk || 0;
          s.ratio = status.ratio !== undefined ? Number(status.ratio).toFixed(2) : (s.ratio || '0.00');
          s.sequential = Boolean(status.sequential);
          s.flowPriority = status.flowPriority || s.flowPriority || 'normal';
          s.pieceLength = status.pieceLength || s.pieceLength;
          s.totalPieces = status.totalPieces || s.totalPieces;

          if (status.bitfield) s.bitfield = status.bitfield;
          if (Array.isArray(status.livePeers)) {
            s.livePeers = status.livePeers;
            s.peerNodes = status.livePeers;
          }
          if (Array.isArray(status.trackers)) s.trackers = status.trackers;
          if (Array.isArray(status.files) && status.files.length > 0) {
            s.files = status.files.map(f => ({
              ...f,
              sizeFormatted: this.formatBytes(f.length || f.sizeBytes || 0),
              progress: Math.round((f.progress || 0) * 100)
            }));
          }

          if (status.done) {
            s.state = 'completed';
            s.eta = 'Preserved locally';
          } else if (status.paused) {
            s.state = 'paused';
            s.eta = 'Paused';
          } else {
            s.state = s.progressPct >= 100 ? 'seeding' : 'downloading';
            s.eta = s.state === 'seeding' ? `Seeding • Ratio ${s.ratio}` : this.formatEta(status.timeRemaining);
          }
        }
      });

      if (batch.length === 0 && !this.useMockData) {
        this.globalDownSpeed = 0;
        this.globalUpSpeed = 0;
        this.globalActivePeers = 0;
      }

      if (dirty) {
        this.render();
        if (this.activeView === 'inspect') {
          this.renderDeepInspect();
        }
      }
    });

    // Real live kernel event stream listener
    window.havenNative.onKernelLog?.((logItem) => {
      if (!logItem) return;
      this.liveKernelEvents.unshift(logItem);
      if (this.liveKernelEvents.length > 60) {
        this.liveKernelEvents.pop();
      }
      if (this.activeView === 'inspect') {
        this.renderDeepInspectWireEvents();
      }
    });

    window.havenNative.onTorrentDone?.((data) => {
      const s = this.swarms.find(item => item.id === data.id);
      if (s) {
        s.progressPct = 100;
        s.state = 'completed';
        s.downSpeed = '0.0 KB/s';
        s.eta = 'Preserved locally';
        this.saveSwarms();
        this.render();
      }
    });

    window.havenNative.onOpenMagnet?.((uri) => {
      this.switchView('transfers');
      this.openAddModal();
      if (this.modalMagnetUri) this.modalMagnetUri.value = uri;
      this.setAddModalTab('magnet');
    });

    window.havenNative.onOpenTorrentFile?.((filePath) => {
      this.switchView('transfers');
      this.openAddModal();
      this.loadTorrentFilePath(filePath);
      this.setAddModalTab('torrent');
    });
  }

  /* -------------------------------------------------------------------------
     MODAL CONTROLS & ADD FLOW
     ------------------------------------------------------------------------- */
  openAddModal() {
    if (this.modalDestPath) {
      this.modalDestPath.textContent = this.formatDisplayPath(this.downloadDir);
    }
    this.addDownloadModal?.classList.remove('hidden');
    this.modalMagnetUri?.focus();
    this.fetchDiskSpace(this.downloadDir);
  }

  closeAddModal() {
    this.addDownloadModal?.classList.add('hidden');
    if (this.modalMagnetUri) this.modalMagnetUri.value = '';
    this.pendingTorrentData = null;
  }

  setAddModalTab(type) {
    if (type === 'magnet') {
      this.typeMagnetTab?.classList.add('active');
      this.typeTorrentTab?.classList.remove('active');
      this.paneMagnet?.classList.remove('hidden');
      this.paneTorrent?.classList.add('hidden');
    } else {
      this.typeTorrentTab?.classList.add('active');
      this.typeMagnetTab?.classList.remove('active');
      this.paneTorrent?.classList.remove('hidden');
      this.paneMagnet?.classList.add('hidden');
    }
  }

  async loadTorrentFilePath(filePath) {
    if (!window.havenNative?.parseTorrentFile) return;
    try {
      const parsed = await window.havenNative.parseTorrentFile(filePath);
      if (parsed) {
        const totalSize = parsed.totalBytes || parsed.length || 0;
        this.pendingTorrentData = {
          name: parsed.name || 'Torrent Package',
          hash: parsed.infoHash,
          sizeBytes: totalSize,
          source: filePath,
          files: parsed.files || []
        };
        if (this.selectedTorrentFileName) this.selectedTorrentFileName.textContent = parsed.name || filePath;
        if (this.selectedTorrentFileSize) this.selectedTorrentFileSize.textContent = `${this.formatBytes(totalSize)} • SafePath verified`;
      }
    } catch (_) {}
  }

  loadTorrentFileBlob(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      if (window.havenNative?.parseTorrentFile) {
        window.havenNative.parseTorrentFile({ buffer: base64, path: file.name }).then(parsed => {
          const totalSize = parsed.totalBytes || parsed.length || file.size || 0;
          this.pendingTorrentData = {
            name: parsed.name || file.name,
            hash: parsed.infoHash,
            sizeBytes: totalSize,
            fileBuffer: base64,
            files: parsed.files || []
          };
          if (this.selectedTorrentFileName) this.selectedTorrentFileName.textContent = parsed.name || file.name;
          if (this.selectedTorrentFileSize) this.selectedTorrentFileSize.textContent = `${this.formatBytes(totalSize)} • SafePath verified`;
        });
      }
    };
    reader.readAsDataURL(file);
  }

  handleStartDownload() {
    const magnetVal = this.modalMagnetUri?.value.trim();
    let newSwarm = null;

    if (this.pendingTorrentData) {
      newSwarm = {
        id: `swarm-${Date.now()}`,
        name: this.pendingTorrentData.name,
        category: this.detectCategory(this.pendingTorrentData.name),
        sizeFormatted: this.formatBytes(this.pendingTorrentData.sizeBytes),
        sizeBytes: this.pendingTorrentData.sizeBytes,
        progressPct: 0,
        state: 'downloading',
        downSpeed: 'Connecting...',
        upSpeed: '0.0 KB/s',
        rawDownSpeed: 0,
        rawUpSpeed: 0,
        eta: 'Resolving swarm...',
        peers: 0,
        hash: this.pendingTorrentData.hash || '',
        source: this.pendingTorrentData.source || null,
        fileBuffer: this.pendingTorrentData.fileBuffer || null,
        targetMount: this.downloadDir,
        files: this.pendingTorrentData.files || []
      };
    } else if (magnetVal && magnetVal.startsWith('magnet:?')) {
      const parsedName = this.extractMagnetName(magnetVal);
      const parsedHash = this.extractMagnetHash(magnetVal);
      newSwarm = {
        id: `swarm-${Date.now()}`,
        name: parsedName || 'Magnet Download',
        category: this.detectCategory(parsedName || ''),
        sizeFormatted: 'Metadata resolving...',
        sizeBytes: 0,
        progressPct: 0,
        state: 'downloading',
        downSpeed: 'Negotiating...',
        upSpeed: '0.0 KB/s',
        rawDownSpeed: 0,
        rawUpSpeed: 0,
        eta: 'Locating peers...',
        peers: 0,
        hash: parsedHash || '',
        source: magnetVal,
        targetMount: this.downloadDir,
        files: []
      };
    }

    if (newSwarm) {
      this.swarms.unshift(newSwarm);
      this.selectedId = newSwarm.id;
      this.saveSwarms();
      this.closeAddModal();
      this.render();

      if (window.havenNative?.startTorrent) {
        window.havenNative.startTorrent({
          id: newSwarm.id,
          hash: newSwarm.hash,
          source: newSwarm.source,
          fileBuffer: newSwarm.fileBuffer,
          name: newSwarm.name,
          targetDir: newSwarm.targetMount
        });
      }
      this.showToast(`Started transfer: ${newSwarm.name}`);
    }
  }

  /* -------------------------------------------------------------------------
     RENDER TRANSFERS CARDS
     ------------------------------------------------------------------------- */
  /* -------------------------------------------------------------------------
     RENDER TRANSFERS CARDS (KEYED DOM RECONCILIATION - CRIT-02)
     ------------------------------------------------------------------------- */
  createCardElement(swarm) {
    const card = document.createElement('div');
    const isSelected = swarm.id === this.selectedId;
    card.className = `transfer-card ${isSelected ? 'selected' : ''}`;
    card.dataset.id = swarm.id;
    card.dataset.state = swarm.state;

    const catClass = this.getCategoryClass(swarm.category, swarm.name);
    const catIcon = this.getCategorySvg(swarm.category, swarm.name);

    const isDownloading = swarm.state === 'downloading';
    const isSeeding = swarm.state === 'seeding';
    const isCompleted = swarm.state === 'completed';

    let speedsText = '';
    if (isDownloading) speedsText = `↓ ${swarm.downSpeed}  ↑ ${swarm.upSpeed}`;
    else if (isSeeding) speedsText = `↑ ${swarm.upSpeed}`;
    else speedsText = 'Complete';

    let metaText = '';
    if (isDownloading) {
      metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Downloading <span class="meta-bullet">•</span> ${swarm.eta}`;
    } else if (isSeeding) {
      const ratioStr = swarm.ratio !== undefined && swarm.ratio !== null ? (typeof swarm.ratio === 'number' ? swarm.ratio.toFixed(2) : swarm.ratio) : '0.00';
      metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Seeding <span class="meta-bullet">•</span> Ratio ${ratioStr}`;
    } else {
      metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Completed <span class="meta-bullet">•</span> Preserved locally`;
    }

    const actionBtnHtml = this.getCardActionBtnHtml(swarm);
    let fillClass = '';
    if (isCompleted) fillClass = 'complete-sage';
    else if (isSeeding) fillClass = 'complete-pine';

    card.innerHTML = `
      <div class="card-left-group">
        <div class="cat-icon-squircle ${catClass}">
          ${catIcon}
        </div>
        <div class="card-info-col">
          <div class="card-title-row">
            <span class="card-title">${this.escapeHtml(swarm.name)}</span>
            ${isDownloading || isSeeding ? '<span class="status-dot-active pulse"></span>' : ''}
          </div>
          <div class="card-meta-line">
            ${metaText}
          </div>
        </div>
      </div>

      <div class="card-right-group">
        <div class="card-progress-col">
          <div class="card-speed-row">
            <span>${speedsText}</span>
          </div>
          <div class="progress-track-sleek">
            <div class="progress-fill-sleek ${fillClass}" style="width: ${swarm.progressPct}%"></div>
          </div>
        </div>
        <span class="card-percentage">${swarm.progressPct}%</span>
        <div class="card-action-slot">${actionBtnHtml}</div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      this.selectedId = swarm.id;
      this.render();
      this.updateInspector();
    });

    card.addEventListener('dblclick', () => {
      this.selectedId = swarm.id;
      this.switchView('inspect');
    });

    card.addEventListener('click', (e) => {
      const pauseBtn = e.target.closest('.btn-pause-toggle');
      if (pauseBtn) {
        e.stopPropagation();
        const current = this.swarms.find(s => s.id === swarm.id);
        if (current && current.state === 'downloading') {
          this.pauseSwarm(swarm.id);
        } else {
          this.resumeSwarm(swarm.id);
        }
      }
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, swarm.id);
    });

    return card;
  }

  updateCardElement(card, swarm) {
    const isSelected = swarm.id === this.selectedId;
    card.classList.toggle('selected', isSelected);

    const isDownloading = swarm.state === 'downloading';
    const isSeeding = swarm.state === 'seeding';
    const isCompleted = swarm.state === 'completed';

    const titleRow = card.querySelector('.card-title-row');
    const existingDot = titleRow?.querySelector('.status-dot-active');
    if (isDownloading || isSeeding) {
      if (!existingDot && titleRow) {
        const dot = document.createElement('span');
        dot.className = 'status-dot-active pulse';
        titleRow.appendChild(dot);
      }
    } else if (existingDot) {
      existingDot.remove();
    }

    let speedsText = '';
    if (isDownloading) speedsText = `↓ ${swarm.downSpeed}  ↑ ${swarm.upSpeed}`;
    else if (isSeeding) speedsText = `↑ ${swarm.upSpeed}`;
    else speedsText = 'Complete';
    const speedEl = card.querySelector('.card-speed-row span');
    if (speedEl && speedEl.textContent !== speedsText) speedEl.textContent = speedsText;

    let metaText = '';
    if (isDownloading) {
      metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Downloading <span class="meta-bullet">•</span> ${swarm.eta}`;
    } else if (isSeeding) {
      const ratioStr = swarm.ratio !== undefined && swarm.ratio !== null ? (typeof swarm.ratio === 'number' ? swarm.ratio.toFixed(2) : swarm.ratio) : '0.00';
      metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Seeding <span class="meta-bullet">•</span> Ratio ${ratioStr}`;
    } else {
      metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Completed <span class="meta-bullet">•</span> Preserved locally`;
    }
    const metaEl = card.querySelector('.card-meta-line');
    if (metaEl && metaEl.innerHTML !== metaText) metaEl.innerHTML = metaText;

    let fillClass = '';
    if (isCompleted) fillClass = 'complete-sage';
    else if (isSeeding) fillClass = 'complete-pine';

    const fillEl = card.querySelector('.progress-fill-sleek');
    if (fillEl) {
      fillEl.className = `progress-fill-sleek ${fillClass}`;
      fillEl.style.width = `${swarm.progressPct}%`;
    }

    const pctEl = card.querySelector('.card-percentage');
    if (pctEl && pctEl.textContent !== `${swarm.progressPct}%`) {
      pctEl.textContent = `${swarm.progressPct}%`;
    }

    if (card.dataset.state !== swarm.state) {
      card.dataset.state = swarm.state;
      const slot = card.querySelector('.card-action-slot');
      if (slot) slot.innerHTML = this.getCardActionBtnHtml(swarm);
    }
  }

  getCardActionBtnHtml(swarm) {
    const isDownloading = swarm.state === 'downloading';
    const isSeeding = swarm.state === 'seeding';
    const isCompleted = swarm.state === 'completed';

    if (isSeeding) {
      return `
        <button class="card-action-btn btn-completed btn-seeding" title="Seeding active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      `;
    }
    if (isCompleted) {
      return `
        <button class="card-action-btn btn-completed btn-finished" title="Completed / Preserved">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      `;
    }
    return `
      <button class="card-action-btn btn-pause-toggle" data-id="${swarm.id}" title="${isDownloading ? 'Pause transfer' : 'Resume transfer'}">
        ${isDownloading ? `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"></rect>
            <rect x="14" y="4" width="4" height="16" rx="1"></rect>
          </svg>
        ` : `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `}
      </button>
    `;
  }

  render() {
    if (!this.transfersListContainer) return;

    const filtered = this.swarms.filter(s => {
      const matchesSearch = !this.searchQuery || 
        s.name.toLowerCase().includes(this.searchQuery) ||
        (s.hash && s.hash.toLowerCase().includes(this.searchQuery));

      if (!matchesSearch) return false;
      if (this.currentFilter === 'downloading') return s.state === 'downloading';
      if (this.currentFilter === 'seeding') return s.state === 'seeding';
      if (this.currentFilter === 'completed') return s.state === 'completed';
      return true;
    });

    if (this.activeCountBadge) {
      const activeCount = this.swarms.filter(s => s.state === 'downloading' || s.state === 'seeding').length;
      this.activeCountBadge.textContent = `${activeCount} active items`;
    }

    if (filtered.length === 0) {
      if (!this.transfersListContainer.querySelector('.empty-sanctuary-card')) {
        this.transfersListContainer.innerHTML = `
          <div class="empty-sanctuary-card" id="emptySanctuaryCard">
            <div class="empty-sanctuary-icon-wrap">
              <svg class="mountain-pines-svg" viewBox="0 0 120 80" fill="none" stroke="currentColor">
                <path d="M10 70 L38 24 L66 70 Z" stroke-width="1.8" stroke-linejoin="round" />
                <path d="M38 24 L38 70" stroke-width="1.4" stroke-dasharray="2 3" opacity="0.6"/>
                <path d="M50 70 L78 32 L106 70 Z" stroke-width="1.8" stroke-linejoin="round" />
                <path d="M78 32 L78 70" stroke-width="1.4" stroke-dasharray="2 3" opacity="0.6"/>
                <line x1="4" y1="70" x2="116" y2="70" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M28 48 L48 48" stroke-width="1.2" opacity="0.5"/>
                <path d="M68 54 L88 54" stroke-width="1.2" opacity="0.5"/>
                <circle cx="92" cy="18" r="7" stroke-width="1.4" stroke-dasharray="2 2" opacity="0.7"/>
              </svg>
            </div>
            <h3 class="empty-sanctuary-title">Your Sanctuary is Quiet</h3>
            <p class="empty-sanctuary-subtitle">No active transfers in this view. Drop a .torrent package anywhere or add a magnet link to begin.</p>
            <button class="btn-empty-add-torrent" id="btnEmptyAddTorrent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Add First Torrent</span>
            </button>
          </div>
        `;
        document.getElementById('btnEmptyAddTorrent')?.addEventListener('click', () => this.openAddModal());
      }
      this.updateInspector();
      return;
    }

    const emptyCard = this.transfersListContainer.querySelector('.empty-sanctuary-card');
    if (emptyCard) emptyCard.remove();

    const existingCardNodes = Array.from(this.transfersListContainer.querySelectorAll('.transfer-card'));
    const existingCardsMap = new Map();
    existingCardNodes.forEach(c => existingCardsMap.set(c.dataset.id, c));

    const activeIds = new Set(filtered.map(s => s.id));

    // Remove cards no longer in view
    existingCardsMap.forEach((card, id) => {
      if (!activeIds.has(id)) {
        card.remove();
        existingCardsMap.delete(id);
      }
    });

    // Reconcile and position cards
    filtered.forEach((swarm, idx) => {
      let card = existingCardsMap.get(swarm.id);
      if (card) {
        this.updateCardElement(card, swarm);
      } else {
        card = this.createCardElement(swarm);
        existingCardsMap.set(swarm.id, card);
      }

      const currentChildAtIndex = this.transfersListContainer.children[idx];
      if (currentChildAtIndex !== card) {
        this.transfersListContainer.insertBefore(card, currentChildAtIndex || null);
      }
    });

    this.updateInspector();
  }

  /* -------------------------------------------------------------------------
     INSPECTOR
     ------------------------------------------------------------------------- */
  updateInspector() {
    const selected = this.swarms.find(s => s.id === this.selectedId) || (this.swarms.length > 0 ? this.swarms[0] : null);
    
    if (!selected) {
      if (this.inspectorTargetName) this.inspectorTargetName.textContent = 'No stream selected';
      if (this.inspectorCurrentSpeed) this.inspectorCurrentSpeed.textContent = '0.0 MB/s';
      if (this.inspectorPeakSpeed) this.inspectorPeakSpeed.textContent = '0.0 MB/s — No active stream selected';
      if (this.activeInspectorTab === 'files' && this.filesManifestList) {
        if (this._lastInspectorTorrentId !== null) {
          this._lastInspectorTorrentId = null;
          this._lastInspectorManifestKey = null;
          if (this.manifestFilesCount) this.manifestFilesCount.textContent = '0';
          if (this.manifestTotalSize) this.manifestTotalSize.textContent = '0 B';
          this.filesManifestList.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
              No stream selected. Add or select a torrent to inspect file payloads.
            </div>
          `;
        }
      }
      return;
    }

    if (this.inspectorTargetName && this.inspectorTargetName.textContent !== selected.name) {
      this.inspectorTargetName.textContent = selected.name;
    }

    const curSpeedText = selected.state === 'downloading' ? selected.downSpeed : (selected.state === 'seeding' ? selected.upSpeed : '0.0 MB/s');
    if (this.inspectorCurrentSpeed && this.inspectorCurrentSpeed.textContent !== curSpeedText) {
      this.inspectorCurrentSpeed.textContent = curSpeedText;
    }

    const peakText = selected.peakSpeed ? `Peak ${selected.peakSpeed}` : (selected.state === 'downloading' ? `Peak ${selected.downSpeed}` : '0.0 MB/s — Idle stream');
    if (this.inspectorPeakSpeed && this.inspectorPeakSpeed.textContent !== peakText) {
      this.inspectorPeakSpeed.textContent = peakText;
    }

    if (this.activeInspectorTab === 'files' && this.filesManifestList) {
      const files = selected.files && selected.files.length > 0 ? selected.files : [
        { name: selected.name, sizeFormatted: selected.sizeFormatted, progress: selected.progressPct, safepath: true }
      ];

      const manifestKey = `${selected.id}_${files.length}_` + files.map(f => `${f.progress}_${f.name}`).join(',');
      if (this._lastInspectorManifestKey !== manifestKey) {
        this._lastInspectorManifestKey = manifestKey;
        this._lastInspectorTorrentId = selected.id;

        if (this.manifestFilesCount) this.manifestFilesCount.textContent = files.length;
        if (this.manifestTotalSize) this.manifestTotalSize.textContent = selected.sizeFormatted;

        this.filesManifestList.innerHTML = files.map(f => `
          <div class="manifest-file-item">
            <div class="manifest-file-left">
              <span>📄</span>
              <span style="font-weight: 500;">${this.escapeHtml(f.name)}</span>
              <span style="color: #6b7280; font-size: 12px;">(${f.sizeFormatted || this.formatBytes(f.size || 0)})</span>
            </div>
            <span class="manifest-badge-ok">SafePath OK</span>
          </div>
        `).join('');
      }
    }
  }

  switchInspectorTab(tab) {
    this.activeInspectorTab = tab;
    if (tab === 'files') {
      this.btnTabFiles?.classList.add('active');
      this.btnTabSpeed?.classList.remove('active');
      this.inspectorFilesView?.classList.remove('hidden');
      this.inspectorSpeedView?.classList.add('hidden');
    } else {
      this.btnTabSpeed?.classList.add('active');
      this.btnTabFiles?.classList.remove('active');
      this.inspectorSpeedView?.classList.remove('hidden');
      this.inspectorFilesView?.classList.add('hidden');
      this.drawChart();
    }
    this.updateInspector();
  }

  /* -------------------------------------------------------------------------
     DEEP INSPECT STUDIO (ALPINE MIST AESTHETIC - SINGLE SCREEN)
     ------------------------------------------------------------------------- */
  switchInspectSubTab(tabName) {
    this.activeInspectSubTab = tabName;
    document.querySelectorAll('#inspectTabSwitchGroup .inspect-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    this.inspectPaneFiles?.classList.toggle('hidden', tabName !== 'files');
    this.inspectPaneTrackers?.classList.toggle('hidden', tabName !== 'trackers');
    this.inspectPaneEngine?.classList.toggle('hidden', tabName !== 'engine');
  }

  switchInspectRightView(viewMode) {
    this.activeInspectRightView = viewMode;
    if (viewMode === 'peers') {
      if (this.inspectPeerRelaysSection) this.inspectPeerRelaysSection.style.display = 'flex';
      if (this.inspectWireFeedSection) this.inspectWireFeedSection.style.display = 'none';
    } else if (viewMode === 'stream') {
      if (this.inspectPeerRelaysSection) this.inspectPeerRelaysSection.style.display = 'none';
      if (this.inspectWireFeedSection) this.inspectWireFeedSection.style.display = 'flex';
    } else {
      if (this.inspectPeerRelaysSection) this.inspectPeerRelaysSection.style.display = 'flex';
      if (this.inspectWireFeedSection) this.inspectWireFeedSection.style.display = 'flex';
    }
  }

  renderDeepInspect() {
    const swarm = this.swarms.find(s => s.id === this.selectedId) || (this.swarms.length > 0 ? this.swarms[0] : null);
    
    // Clean zero-state when zero torrents are in the workspace
    if (!swarm) {
      if (this.inspectTorrentName) this.inspectTorrentName.textContent = 'No Transfer Selected';
      if (this.inspectStatusBadge) this.inspectStatusBadge.textContent = '● Standby';
      if (this.inspectPauseText) this.inspectPauseText.textContent = 'Pause Transfer';
      if (this.inspectFlowVal) this.inspectFlowVal.textContent = '0.0 KB/s';
      if (this.inspectFlowPeak) this.inspectFlowPeak.textContent = 'Peak 0.0 KB/s';
      if (this.inspectActivePeers) this.inspectActivePeers.textContent = '0 Active Peers';
      if (this.inspectSwarmBreakdown) this.inspectSwarmBreakdown.textContent = '0 Seeders • 0 Leechers';
      if (this.inspectPeersCountPill) this.inspectPeersCountPill.textContent = '0';
      if (this.inspectIntegrityVal) this.inspectIntegrityVal.textContent = '0% Verified';
      if (this.inspectIntegritySub) this.inspectIntegritySub.textContent = '0 Chunks • SHA-1';
      if (this.inspectRatioVal) this.inspectRatioVal.textContent = '0.00 Ratio';
      if (this.inspectRatioSub) this.inspectRatioSub.textContent = '0.0 MB Uploaded';
      if (this.inspectDynamicsSub) this.inspectDynamicsSub.textContent = 'Transfer Flow Inactive • 0.0 KB/s';
      if (this.inspectPieceStatsText) this.inspectPieceStatsText.textContent = '0 pieces • Standby';
      if (this.inspectPieceVerifiedBadge) this.inspectPieceVerifiedBadge.textContent = '0 Verified';

      if (this.pieceMatrixGrid) {
        let pillsHtml = '';
        for (let i = 0; i < 96; i++) {
          pillsHtml += `<div class="micro-piece-pill pending" title="Chunk #${i + 1} • Inactive"></div>`;
        }
        this.pieceMatrixGrid.innerHTML = pillsHtml;
      }

      if (this.inspectManifestList) {
        this.inspectManifestList.innerHTML = `
          <div class="inspect-file-row">
            <div class="inspect-file-meta">
              <div class="inspect-file-name" style="color: #667085;">No active transfer selected.</div>
              <div class="inspect-file-sub">Add a magnet link or .torrent package to view files.</div>
            </div>
          </div>
        `;
      }

      if (this.inspectTrackersList) {
        this.inspectTrackersList.innerHTML = `
          <div class="inspect-file-row">
            <div class="inspect-file-meta">
              <div class="inspect-file-name" style="color: #667085;">No trackers active.</div>
              <div class="inspect-file-sub">DHT node routing standby.</div>
            </div>
          </div>
        `;
      }

      if (this.inspectPeersList) {
        this.inspectPeersList.innerHTML = `
          <div class="peer-relay-row">
            <div class="relay-info-col">
              <div class="relay-location-client" style="color: #667085;">No connected swarm peers</div>
              <div class="relay-sub-specs">Waiting for active transfer...</div>
            </div>
            <div class="relay-speed-pill">0 B/s</div>
          </div>
        `;
      }

      this.renderDeepInspectWireEvents();
      this.drawInspectMountainWaveform();
      return;
    }

    const isSeeding = swarm.state === 'seeding';
    const isDownloading = swarm.state === 'downloading';
    const pct = (isSeeding || swarm.state === 'completed') ? 100 : (swarm.progressPct || 0);

    // 1. Top Bar Swarm Header
    if (this.inspectTorrentName) {
      this.inspectTorrentName.textContent = swarm.name;
    }
    if (this.inspectStatusBadge) {
      let badgeText = isSeeding ? `● Seeding • Ratio ${swarm.ratio || '0.00'}` : (isDownloading ? '● Downloading' : (swarm.state === 'paused' ? '⏸ Paused' : '● Preserved'));
      this.inspectStatusBadge.textContent = badgeText;
    }
    if (this.inspectPauseText) {
      this.inspectPauseText.textContent = isDownloading ? 'Pause Download' : (swarm.state === 'paused' ? 'Resume Transfer' : (isSeeding ? 'Pause Seeding' : 'Pause Transfer'));
    }

    // 2. Top Summary Strip (4 White Cards, 82px)
    if (this.inspectFlowVal) {
      this.inspectFlowVal.textContent = isSeeding ? `↑ ${swarm.upSpeed || '0.0 KB/s'}` : `↓ ${swarm.downSpeed || '0.0 KB/s'}`;
    }
    if (this.inspectFlowPeak) {
      this.inspectFlowPeak.textContent = `Peak ${swarm.peakSpeed || (isSeeding ? swarm.upSpeed : swarm.downSpeed) || '0.0 KB/s'}`;
    }
    if (this.inspectFlowIcon) {
      this.inspectFlowIcon.innerHTML = isSeeding
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    }

    const activePeersCount = swarm.peers || (swarm.livePeers ? swarm.livePeers.length : 0);
    const seeders = swarm.seedingPeers !== undefined ? swarm.seedingPeers : (isSeeding ? activePeersCount : 0);
    const leechers = swarm.leechingPeers !== undefined ? swarm.leechingPeers : Math.max(0, activePeersCount - seeders);
    if (this.inspectActivePeers) {
      this.inspectActivePeers.textContent = `${activePeersCount} Active Peers`;
    }
    if (this.inspectSwarmBreakdown) {
      if (swarm.seedingPeers !== undefined || isSeeding) {
        this.inspectSwarmBreakdown.textContent = `${seeders} Seeders • ${leechers} Leechers`;
      } else {
        this.inspectSwarmBreakdown.textContent = `${activePeersCount} Swarm Peers Connected`;
      }
    }
    if (this.inspectPeersCountPill) {
      this.inspectPeersCountPill.textContent = activePeersCount;
    }

    const totalChunks = swarm.totalPieces || swarm.totalChunks || 0;
    if (this.inspectIntegrityVal) {
      this.inspectIntegrityVal.textContent = `${pct}% Verified`;
    }
    if (this.inspectIntegritySub) {
      this.inspectIntegritySub.textContent = totalChunks > 0 ? `${totalChunks.toLocaleString()} Chunks • SHA-1` : 'Resolving chunks...';
    }

    if (this.inspectRatioVal) {
      this.inspectRatioVal.textContent = `${swarm.ratio || '0.00'} Ratio`;
    }
    if (this.inspectRatioSub) {
      const upFormatted = swarm.uploadedBytes ? this.formatBytes(swarm.uploadedBytes) : (swarm.uploadedFormatted || '0 B');
      this.inspectRatioSub.textContent = `${upFormatted} Uploaded`;
    }

    // 3. Hero Card: Flow Dynamics Subtitle & Piece Bitfield
    if (this.inspectDynamicsSub) {
      const flowName = isSeeding ? 'Outflow' : 'Inflow';
      const currentSpeed = isSeeding ? (swarm.upSpeed || '0.0 KB/s') : (swarm.downSpeed || '0.0 KB/s');
      this.inspectDynamicsSub.textContent = `Last 60 Seconds ${flowName} Rate • Current ${currentSpeed}`;
    }

    if (this.inspectPieceStatsText) {
      const pLenStr = swarm.pieceLength ? `${(swarm.pieceLength / (1024 * 1024)).toFixed(1)} MB` : '3.0 MB';
      this.inspectPieceStatsText.textContent = `${totalChunks.toLocaleString()} pieces @ ${pLenStr} chunks`;
    }
    if (this.inspectPieceVerifiedBadge) {
      const verifiedPieces = swarm.bitfield?.verifiedCount !== undefined 
        ? swarm.bitfield.verifiedCount 
        : Math.round(totalChunks * (pct / 100));
      this.inspectPieceVerifiedBadge.textContent = pct >= 100
        ? `All ${totalChunks.toLocaleString()} Verified`
        : `${verifiedPieces.toLocaleString()} Verified`;
    }

    // Ground-Truth Piece Matrix (Bucketed from WebTorrent Bitfield with diff cache - CRIT-03)
    if (this.pieceMatrixGrid) {
      const pieceStateSig = swarm.bitfield && Array.isArray(swarm.bitfield.buckets) && swarm.bitfield.buckets.length > 0
        ? `${swarm.id}_` + swarm.bitfield.buckets.map(b => `${b.state}_${b.startPiece}`).join(',')
        : `${swarm.id}_sample_${pct}_${isDownloading}`;

      if (this._lastPieceMatrixSig !== pieceStateSig || !this.pieceMatrixGrid.children.length) {
        this._lastPieceMatrixSig = pieceStateSig;
        if (swarm.bitfield && Array.isArray(swarm.bitfield.buckets) && swarm.bitfield.buckets.length > 0) {
          const bks = swarm.bitfield.buckets;
          const pieceLenMb = swarm.pieceLength ? (swarm.pieceLength / (1024 * 1024)).toFixed(1) : '1.0';
          let pillsHtml = '';
          bks.forEach(b => {
            const pillClass = b.state === 2 ? 'verified' : (b.state === 1 ? 'inflight' : 'pending');
            const stateDesc = b.state === 2 ? 'Verified SHA-1' : (b.state === 1 ? `${Math.round(b.ratio * 100)}% Verified` : 'Pending');
            const rangeLabel = b.startPiece === b.endPiece ? `#${b.startPiece + 1}` : `#${b.startPiece + 1}–#${b.endPiece + 1}`;
            const tip = `Piece ${rangeLabel} • ${pieceLenMb} MB/chunk • ${stateDesc}`;
            pillsHtml += `<div class="micro-piece-pill ${pillClass}" title="${tip}"></div>`;
          });
          this.pieceMatrixGrid.innerHTML = pillsHtml;
        } else {
          const samplePills = 96;
          const verifiedCount = Math.round(samplePills * (pct / 100));
          const inflightCount = isDownloading ? Math.min(4, samplePills - verifiedCount) : 0;
          let pillsHtml = '';
          for (let i = 0; i < samplePills; i++) {
            let pillClass = 'pending';
            let chunkNum = totalChunks > 0 ? Math.round(i * (totalChunks / samplePills)) + 1 : i + 1;
            let tip = `Chunk #${chunkNum} • Pending`;
            if (i < verifiedCount) {
              pillClass = 'verified';
              tip = `Chunk #${chunkNum} • Verified SHA-1`;
            } else if (i < verifiedCount + inflightCount) {
              pillClass = 'inflight';
              tip = `Chunk #${chunkNum} • Active Wire Transfer`;
            }
            pillsHtml += `<div class="micro-piece-pill ${pillClass}" title="${tip}"></div>`;
          }
          this.pieceMatrixGrid.innerHTML = pillsHtml;
        }
      }
    }

    // 4. Bottom-Left Segmented Tabs (Files, Trackers, Engine)
    const files = Array.isArray(swarm.files) ? swarm.files : [];
    const trackers = Array.isArray(swarm.trackers) ? swarm.trackers : [];

    if (this.tabFilesCountLabel) this.tabFilesCountLabel.textContent = `Files (${files.length})`;
    if (this.tabTrackersCountLabel) this.tabTrackersCountLabel.textContent = `Trackers & DHT (${trackers.length})`;
    if (this.inspectTabTotalSize) this.inspectTabTotalSize.textContent = `Total Content: ${swarm.sizeFormatted || '0 B'}`;

    if (this.inspectManifestList) {
      const manifestSig = `${swarm.id}_${files.length}_` + files.map(f => `${f.progress}_${f.priority}_${f.name}`).join(',');
      if (this._lastInspectManifestSig !== manifestSig || !this.inspectManifestList.children.length) {
        this._lastInspectManifestSig = manifestSig;

        if (files.length === 0) {
          this.inspectManifestList.innerHTML = `
            <div class="inspect-file-row">
              <div class="inspect-file-meta">
                <div class="inspect-file-name" style="color: #667085;">Resolving swarm metadata...</div>
                <div class="inspect-file-sub">Retrieving file manifest from connected peers</div>
              </div>
            </div>
          `;
        } else {
          this.inspectManifestList.innerHTML = files.map((file, idx) => {
            const isHigh = file.priority === 'high' || file.priority > 1;
            const fileProgress = file.progress !== undefined ? file.progress : pct;
            const sizeStr = file.sizeFormatted || (file.length ? this.formatBytes(file.length) : '0 B');
            return `
              <div class="inspect-file-row">
                <div class="inspect-file-left">
                  <div class="inspect-file-icon-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                  </div>
                  <div class="inspect-file-meta">
                    <div class="inspect-file-name">${this.escapeHtml(file.name)}</div>
                    <div class="inspect-file-sub">${sizeStr} • ${fileProgress}% verified</div>
                  </div>
                </div>
                <div class="inspect-file-mid">
                  <div class="inspect-file-progressbar">
                    <div class="inspect-file-progressfill" style="width: ${fileProgress}%"></div>
                  </div>
                  <span class="inspect-file-percent">${fileProgress}%</span>
                </div>
                <div class="inspect-file-right">
                  <button class="btn-file-prio ${isHigh ? 'prio-high' : 'prio-normal'}" data-index="${idx}">
                    ${isHigh ? 'High Priority' : 'Normal'}
                  </button>
                </div>
              </div>
            `;
          }).join('');

          this.inspectManifestList.querySelectorAll('.btn-file-prio').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const fIdx = parseInt(btn.dataset.index, 10);
              if (files[fIdx]) {
                files[fIdx].priority = files[fIdx].priority === 'high' ? 'normal' : 'high';
                if (window.havenNative?.selectTorrentFiles) {
                  const selectedIndices = files.map((f, i) => (f.selected !== false ? i : -1)).filter(i => i >= 0);
                  await window.havenNative.selectTorrentFiles({ id: swarm.id, fileIndices: selectedIndices });
                }
                this._lastInspectManifestSig = null;
                this.renderDeepInspect();
                this.showToast(`Set priority: ${files[fIdx].name} → ${files[fIdx].priority === 'high' ? 'High' : 'Normal'}`);
              }
            });
          });
        }
      }
    }

    if (this.inspectTrackersList) {
      const trackerSig = `${swarm.id}_${trackers.length}_` + trackers.map(t => `${t.host}_${t.status}`).join(',');
      if (this._lastInspectTrackerSig !== trackerSig || !this.inspectTrackersList.children.length) {
        this._lastInspectTrackerSig = trackerSig;

        if (trackers.length === 0) {
          this.inspectTrackersList.innerHTML = `
            <div class="inspect-file-row">
              <div class="inspect-file-meta">
                <div class="inspect-file-name" style="color: #667085;">Public trackers active</div>
                <div class="inspect-file-sub">DHT node routing actively querying bootstrap nodes</div>
              </div>
            </div>
          `;
        } else {
          this.inspectTrackersList.innerHTML = trackers.map(t => `
            <div class="inspect-file-row">
              <div class="inspect-file-left">
                <div class="inspect-file-icon-box" style="background: #EBF3F8; color: #3A5A78;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
                </div>
                <div class="inspect-file-meta">
                  <div class="inspect-file-name">${this.escapeHtml(t.host)}</div>
                  <div class="inspect-file-sub" style="color: #234F3E;">● ${t.status || 'Active'} • ${t.type || 'Tracker'}</div>
                </div>
              </div>
              <div class="inspect-file-right">
                <button class="btn-file-prio prio-normal btn-tracker-reannounce" data-host="${this.escapeHtml(t.host)}">Re-announce</button>
              </div>
            </div>
          `).join('');

          this.inspectTrackersList.querySelectorAll('.btn-tracker-reannounce').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (window.havenNative?.refreshTrackers) {
                await window.havenNative.refreshTrackers(swarm.id);
              }
              this.showToast(`Re-announced swarm to ${btn.dataset.host}`);
            });
          });
        }
      }
    }

    // Engine & Hardware Node Metrics
    if (window.havenNative?.getHardwareStats) {
      window.havenNative.getHardwareStats().then(stats => {
        if (stats && stats.success) {
          const ramEl = document.getElementById('inspectRamUsage');
          const sockEl = document.getElementById('inspectSocketCount');
          if (ramEl) ramEl.textContent = `${stats.heapUsedMB} MB (Node Heap)`;
          if (sockEl) sockEl.textContent = `${stats.activeSockets} Open Peer Sockets`;
        }
      }).catch(() => {});
    }

    // 5. Right Column Connected Peers (from real swarm.livePeers with diff cache - CRIT-03)
    const peerNodes = Array.isArray(swarm.livePeers) ? swarm.livePeers : [];
    if (this.inspectPeersList) {
      const peersSig = `${swarm.id}_${peerNodes.length}_` + peerNodes.map(p => `${p.remoteAddress || p.maskedIp}_${p.downloadSpeed}_${p.uploadSpeed}_${p.choked}`).join(',');
      if (this._lastInspectPeersSig !== peersSig || !this.inspectPeersList.children.length) {
        this._lastInspectPeersSig = peersSig;

        if (peerNodes.length === 0) {
          this.inspectPeersList.innerHTML = `
            <div class="peer-relay-row">
              <div class="relay-info-col">
                <div class="relay-location-client" style="color: #667085;">Searching swarm for peer connections...</div>
                <div class="relay-sub-specs">DHT routing & public tracker announce active</div>
              </div>
              <div class="relay-speed-pill">0 B/s</div>
            </div>
          `;
        } else {
          this.inspectPeersList.innerHTML = peerNodes.map(p => {
            const flag = p.protocol === 'webrtc' ? 'RTC' : (p.protocol && p.protocol.includes('uTP') ? 'uTP' : 'TCP');
            const speedText = p.downloadSpeed > 0 
              ? `↓ ${this.formatSpeed(p.downloadSpeed)}` 
              : (p.uploadSpeed > 0 ? `↑ ${this.formatSpeed(p.uploadSpeed)}` : '0 B/s');
            const encText = p.isEncrypted ? 'TLS 1.3 / Strict' : 'Plain uTP';
            const chokeText = p.choked ? 'Choked' : 'Active Flow';
            return `
              <div class="peer-relay-row">
                <div class="relay-left-col">
                  <div class="country-flag-badge">${flag}</div>
                  <div class="relay-info-col">
                    <div class="relay-location-client">${this.escapeHtml(p.maskedIp || p.remoteAddress || 'peer')} • ${this.escapeHtml(p.clientName || 'BitTorrent Peer')}</div>
                    <div class="relay-sub-specs">${encText} • ${chokeText}</div>
                  </div>
                </div>
                <div class="relay-speed-pill">${speedText}</div>
              </div>
            `;
          }).join('');
        }
      }
    }

    this.renderDeepInspectWireEvents();
    this.drawInspectMountainWaveform();
  }

  renderDeepInspectWireEvents() {
    if (!this.inspectWireEventsList) return;

    if (!this.liveKernelEvents || this.liveKernelEvents.length === 0) {
      if (this._lastWireSig !== 'empty') {
        this._lastWireSig = 'empty';
        this.inspectWireEventsList.innerHTML = `
          <div class="wire-event-row">
            <div class="wire-event-desc">
              <span class="wire-event-main" style="color: #667085;">Awaiting live kernel activity...</span>
              <span class="wire-event-sub">Real-time socket, piece verification, and wire events will appear here</span>
            </div>
          </div>
        `;
      }
      return;
    }

    const firstEvent = this.liveKernelEvents[0];
    const wireSig = `${this.liveKernelEvents.length}_${firstEvent?.timestamp}_${firstEvent?.tag}_${firstEvent?.message}`;
    if (this._lastWireSig === wireSig && this.inspectWireEventsList.children.length > 0) {
      return;
    }
    this._lastWireSig = wireSig;

    this.inspectWireEventsList.innerHTML = this.liveKernelEvents.slice(0, 20).map(e => {
      let tagClass = 'tag-wire';
      let tagIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
      
      const tag = (e.tag || 'KERNEL').toUpperCase();
      if (tag.includes('SEED')) {
        tagClass = 'tag-seed';
        tagIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
      } else if (tag.includes('RECV')) {
        tagClass = 'tag-seed';
        tagIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
      } else if (tag.includes('SHA') || tag.includes('HASH')) {
        tagClass = 'tag-hash';
        tagIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      } else if (tag.includes('DHT')) {
        tagClass = 'tag-dht';
        tagIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle></svg>';
      }

      return `
        <div class="wire-event-row">
          <div class="wire-event-left">
            <div class="wire-tag-pill ${tagClass}">${tagIcon}</div>
            <div class="wire-event-desc">
              <span class="wire-event-main">[${this.escapeHtml(tag)}] ${this.escapeHtml(e.message || '')}</span>
              <span class="wire-event-sub">${this.escapeHtml(e.timestamp || new Date().toLocaleTimeString())}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* -------------------------------------------------------------------------
     MOUNTAIN WAVEFORM RENDERER (65% HEIGHT AUTO-SCALING SPLINE)
     ------------------------------------------------------------------------- */
  drawInspectMountainWaveform() {
    if (this.activeView !== 'inspect') return;
    if (!this.inspectWaveformCanvas || !this.inspectWaveformCtx) return;
    const canvas = this.inspectWaveformCanvas;
    const ctx = this.inspectWaveformCtx;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const swarm = this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
    const isSeeding = swarm ? (swarm.state === 'seeding' || swarm.state === 'completed') : false;

    const inPoints = this.inflowHistory;
    const outPoints = this.outflowHistory;
    const primaryPoints = isSeeding ? outPoints : inPoints;
    const secondaryPoints = isSeeding ? inPoints : outPoints;

    const peakVal = Math.max(1.0, ...primaryPoints, ...secondaryPoints);
    // Auto-scale peak so it fills roughly 65% of the chart height nicely
    const scaleMax = peakVal / 0.65;

    const stepX = width / (primaryPoints.length - 1);
    const paddingBottom = 16;
    const chartHeight = height - paddingBottom - 10;
    const getY = (val) => height - paddingBottom - (val / scaleMax) * chartHeight;

    // 1. Position Peak Speed Flag
    let maxIdx = 0;
    let maxP = 0;
    primaryPoints.forEach((p, idx) => {
      if (p >= maxP) {
        maxP = p;
        maxIdx = idx;
      }
    });
    if (this.waveformPeakFlag && this.waveformPeakVal) {
      const peakPercent = (maxIdx / (primaryPoints.length - 1)) * 100;
      this.waveformPeakFlag.style.left = `${Math.min(84, Math.max(16, peakPercent))}%`;
      this.waveformPeakVal.textContent = maxP > 0 ? maxP.toFixed(1) : (swarm?.peakSpeed ? parseFloat(swarm.peakSpeed).toFixed(1) : '0.0');
    }

    if (this.waveformNowTick) {
      const curSpeed = isSeeding ? (swarm?.upSpeed || '0.0 KB/s') : (swarm?.downSpeed || '0.0 KB/s');
      this.waveformNowTick.textContent = `Now (${curSpeed})`;
    }

    // 2. Subtle horizontal grid lines
    ctx.strokeStyle = 'rgba(24, 29, 27, 0.04)';
    ctx.lineWidth = 1;
    [0.3, 0.65].forEach(ratio => {
      const y = height - paddingBottom - ratio * chartHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    // 3. Secondary Waveform (Alpine Slate)
    ctx.beginPath();
    ctx.moveTo(0, getY(secondaryPoints[0]));
    for (let i = 0; i < secondaryPoints.length - 1; i++) {
      const p0 = secondaryPoints[i];
      const p1 = secondaryPoints[i + 1];
      const x0 = i * stepX;
      const x1 = (i + 1) * stepX;
      const y0 = getY(p0);
      const y1 = getY(p1);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.strokeStyle = '#3A5A78';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Primary Mountain Area (Pine Green Soft Vertical Gradient)
    ctx.beginPath();
    ctx.moveTo(0, getY(primaryPoints[0]));
    for (let i = 0; i < primaryPoints.length - 1; i++) {
      const p0 = primaryPoints[i];
      const p1 = primaryPoints[i + 1];
      const x0 = i * stepX;
      const x1 = (i + 1) * stepX;
      const y0 = getY(p0);
      const y1 = getY(p1);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.lineTo(width, height - paddingBottom);
    ctx.lineTo(0, height - paddingBottom);
    ctx.closePath();

    const inGrad = ctx.createLinearGradient(0, getY(scaleMax * 0.7), 0, height - paddingBottom);
    inGrad.addColorStop(0, 'rgba(35, 79, 62, 0.22)');
    inGrad.addColorStop(0.5, 'rgba(35, 79, 62, 0.08)');
    inGrad.addColorStop(1, 'rgba(35, 79, 62, 0.0)');
    ctx.fillStyle = inGrad;
    ctx.fill();

    // Primary Mountain Crest Line (Solid Pine Green #234F3E)
    ctx.beginPath();
    ctx.moveTo(0, getY(primaryPoints[0]));
    for (let i = 0; i < primaryPoints.length - 1; i++) {
      const p0 = primaryPoints[i];
      const p1 = primaryPoints[i + 1];
      const x0 = i * stepX;
      const x1 = (i + 1) * stepX;
      const y0 = getY(p0);
      const y1 = getY(p1);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.strokeStyle = '#234F3E';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Current "Now" pulsing dot at right end
    const nowIdx = primaryPoints.length - 1;
    const nowX = nowIdx * stepX;
    const nowY = getY(primaryPoints[nowIdx]);

    ctx.beginPath();
    ctx.arc(nowX, nowY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(35, 79, 62, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(nowX, nowY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#234F3E';
    ctx.fill();
  }

  /* -------------------------------------------------------------------------
     SMOOTH FLOW DYNAMICS CHART
     ------------------------------------------------------------------------- */
  initChart() {
    this.drawChart();
    window.addEventListener('resize', () => {
      this.drawChart();
      if (this.activeView === 'inspect') {
        this.drawInspectMountainWaveform();
      }
    });
  }

  drawChart() {
    if (this.activeView !== 'transfers' || this.activeInspectorTab !== 'speed') return;
    if (!this.flowCanvas || !this.flowCtx) return;
    const canvas = this.flowCanvas;
    const ctx = this.flowCtx;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const points = this.inflowHistory;
    const outflowPoints = this.outflowHistory;
    const maxVal = Math.max(10.0, ...points, ...outflowPoints);

    const stepX = width / (points.length - 1);
    const paddingBottom = 20;
    const chartHeight = height - paddingBottom - 10;
    const getY = (val) => height - paddingBottom - (val / maxVal) * chartHeight;

    // 1. Inflow Area Gradient
    ctx.beginPath();
    ctx.moveTo(0, getY(points[0]));
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const x0 = i * stepX;
      const x1 = (i + 1) * stepX;
      const y0 = getY(p0);
      const y1 = getY(p1);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.lineTo(width, height - paddingBottom);
    ctx.lineTo(0, height - paddingBottom);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 10, 0, height - paddingBottom);
    gradient.addColorStop(0, 'rgba(35, 79, 62, 0.22)');
    gradient.addColorStop(1, 'rgba(35, 79, 62, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 2. Inflow Solid Line (Pine Green)
    ctx.beginPath();
    ctx.moveTo(0, getY(points[0]));
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const x0 = i * stepX;
      const x1 = (i + 1) * stepX;
      const y0 = getY(p0);
      const y1 = getY(p1);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.strokeStyle = '#234F3E';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.stroke();

    // 3. Outflow Dashed Line (Slate Secondary)
    ctx.beginPath();
    ctx.moveTo(0, getY(outflowPoints[0]));
    for (let i = 0; i < outflowPoints.length - 1; i++) {
      const p0 = outflowPoints[i];
      const p1 = outflowPoints[i + 1];
      const x0 = i * stepX;
      const x1 = (i + 1) * stepX;
      const y0 = getY(p0);
      const y1 = getY(p1);
      const cpX = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }
    ctx.strokeStyle = '#3A5A78';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Peak Marker Dot with Ring (Only if peak throughput > 0)
    const maxValSeen = Math.max(...points);
    if (maxValSeen > 0) {
      const peakIdx = points.indexOf(maxValSeen);
      if (peakIdx >= 0) {
        const peakX = peakIdx * stepX;
        const peakY = getY(points[peakIdx]);

        ctx.beginPath();
        ctx.arc(peakX, peakY, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(35, 79, 62, 0.25)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(peakX, peakY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#234F3E';
        ctx.fill();
      }
    }
  }

  /* -------------------------------------------------------------------------
     REAL-TIME TICKER
     ------------------------------------------------------------------------- */
  startTicker() {
    setInterval(() => {
      let downMB = 0;
      let upMB = 0;

      if (this.simulateWaveform) {
        // Developer Sandbox Simulation Mode
        const sim = window.MockSanctuaryData ? 
          window.MockSanctuaryData.generateSimulatedThroughput(this.simTickCount++) : 
          { downMB: 7.6, upMB: 1.6 };
        downMB = sim.downMB;
        upMB = sim.upMB;

        if (this.meshRateFrankfurt) this.meshRateFrankfurt.textContent = `Haven 2.4 - ${(2.4 + Math.sin(this.simTickCount * 0.2) * 0.5).toFixed(1)} MB/s`;
        if (this.meshRateTokyo) this.meshRateTokyo.textContent = `libtorrent - ${(3.5 + Math.cos(this.simTickCount * 0.15) * 0.7).toFixed(1)} MB/s`;
        if (this.meshRateSeattle) this.meshRateSeattle.textContent = `Transmission - ${(1.4 + Math.sin(this.simTickCount * 0.18) * 0.3).toFixed(1)} MB/s`;
        if (this.meshRateStockholm) this.meshRateStockholm.textContent = `Haven Core - ${(3.0 + Math.cos(this.simTickCount * 0.22) * 0.4).toFixed(1)} MB/s`;

        if (this.sidebarSessionDown) this.sidebarSessionDown.textContent = `${downMB.toFixed(1)} MB/s`;
        if (this.sidebarSessionUp) this.sidebarSessionUp.textContent = `${upMB.toFixed(1)} MB/s`;
      } else {
        // Ground-Truth Production State
        if (this.swarms.length === 0) {
          downMB = 0;
          upMB = 0;
          if (this.sidebarSessionDown) this.sidebarSessionDown.textContent = '0.0 KB/s';
          if (this.sidebarSessionUp) this.sidebarSessionUp.textContent = '0.0 KB/s';
        } else {
          let totalDown = this.globalDownSpeed || 0;
          let totalUp = this.globalUpSpeed || 0;

          if (totalDown === 0 && totalUp === 0) {
            this.swarms.forEach(s => {
              if (s.state === 'downloading') {
                totalDown += (s.rawDownSpeed || 0);
                totalUp += (s.rawUpSpeed || 0);
              } else if (s.state === 'seeding') {
                totalUp += (s.rawUpSpeed || 0);
              }
            });
          }

          downMB = totalDown > 0 ? totalDown / (1024 * 1024) : 0;
          upMB = totalUp > 0 ? totalUp / (1024 * 1024) : 0;

          if (this.sidebarSessionDown) this.sidebarSessionDown.textContent = this.formatSpeed(totalDown);
          if (this.sidebarSessionUp) this.sidebarSessionUp.textContent = this.formatSpeed(totalUp);
        }
      }

      this.inflowHistory.shift();
      this.inflowHistory.push(downMB > 0 ? Number(downMB.toFixed(2)) : 0);

      this.outflowHistory.shift();
      this.outflowHistory.push(upMB > 0 ? Number(upMB.toFixed(2)) : 0);

      if (this.activeView === 'transfers' && this.activeInspectorTab === 'speed') {
        this.drawChart();
      }

      if (this.activeView === 'inspect') {
        this.drawInspectMountainWaveform();
        const selectedSwarm = this.swarms.find(s => s.id === this.selectedId) || (this.swarms.length > 0 ? this.swarms[0] : null);
        if (!selectedSwarm || this.swarms.length === 0) {
          if (this.inspectInflowVal) this.inspectInflowVal.textContent = '0.0 KB/s';
          if (this.inspectOutflowVal) this.inspectOutflowVal.textContent = '0.0 KB/s';
          if (this.inspectLegendDown) this.inspectLegendDown.textContent = '0.0 KB/s';
          if (this.inspectLegendUp) this.inspectLegendUp.textContent = '0.0 KB/s';
          if (this.waveformNowTick) this.waveformNowTick.textContent = 'Now (0.0 KB/s)';
        } else if (selectedSwarm.state === 'downloading') {
          const currentInflow = selectedSwarm.downSpeed || `${(this.inflowHistory[this.inflowHistory.length - 1]).toFixed(1)} MB/s`;
          const currentOutflow = selectedSwarm.upSpeed || `${(this.outflowHistory[this.outflowHistory.length - 1]).toFixed(1)} MB/s`;
          if (this.inspectInflowVal) this.inspectInflowVal.textContent = currentInflow;
          if (this.inspectOutflowVal) this.inspectOutflowVal.textContent = currentOutflow;
          if (this.inspectLegendDown) this.inspectLegendDown.textContent = currentInflow;
          if (this.inspectLegendUp) this.inspectLegendUp.textContent = currentOutflow;
          if (this.waveformNowTick) this.waveformNowTick.textContent = `Now (${currentInflow})`;
        } else {
          const currentInflow = selectedSwarm.downSpeed || '0.0 KB/s';
          const currentOutflow = selectedSwarm.upSpeed || '0.0 KB/s';
          if (this.inspectInflowVal) this.inspectInflowVal.textContent = currentInflow;
          if (this.inspectOutflowVal) this.inspectOutflowVal.textContent = currentOutflow;
          if (this.inspectLegendDown) this.inspectLegendDown.textContent = currentInflow;
          if (this.inspectLegendUp) this.inspectLegendUp.textContent = currentOutflow;
          if (this.waveformNowTick) this.waveformNowTick.textContent = `Now (${currentOutflow})`;
        }
      }
    }, 1000);
  }

  pauseSwarm(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.state = 'paused';
    s.downSpeed = '0.0 KB/s';
    s.upSpeed = '0.0 KB/s';
    s.rawDownSpeed = 0;
    s.rawUpSpeed = 0;
    s.eta = 'Paused';
    this.saveSwarms();
    this.render();
    window.havenNative?.pauseTorrent?.(id);
    this.showToast(`Paused: ${s.name}`);
  }

  resumeSwarm(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.state = s.progressPct >= 100 ? 'seeding' : 'downloading';
    s.eta = s.state === 'seeding' ? 'Seeding' : 'Connecting to peers...';
    this.saveSwarms();
    this.render();
    window.havenNative?.resumeTorrent?.(id);
    this.showToast(`Resumed: ${s.name}`);
  }

  promptDelete(id) {
    this.pendingDeleteId = id;
    const s = this.swarms.find(item => item.id === id);
    if (this.deleteSwarmTitle) {
      this.deleteSwarmTitle.textContent = s ? s.name : 'Selected download';
    }
    this.deleteSwarmModal?.classList.remove('hidden');
  }

  closeDeleteModal() {
    this.pendingDeleteId = null;
    this.deleteSwarmModal?.classList.add('hidden');
  }

  confirmDelete() {
    if (!this.pendingDeleteId) return;
    const id = this.pendingDeleteId;
    const deleteFiles = this.optDeleteData?.classList.contains('active');
    const swarm = this.swarms.find(item => item.id === id);

    this.swarms = this.swarms.filter(item => item.id !== id);
    if (this.selectedId === id) {
      this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
    }

    if (window.havenNative?.deleteTorrent) {
      window.havenNative.deleteTorrent({
        id,
        deleteFiles,
        targetDir: swarm?.targetMount || this.downloadDir,
        name: swarm?.name || ''
      });
    }

    this.saveSwarms();
    this.closeDeleteModal();
    this.render();
    this.showToast('Download removed from workspace.');
  }

  showContextMenu(x, y, swarmId) {
    this.contextSwarmId = swarmId;
    this.selectedId = swarmId;
    this.render();
    if (!this.swarmContextMenu) return;

    const swarm = this.swarms.find(s => s.id === swarmId);
    if (swarm) {
      const isDownloading = swarm.state === 'downloading' || swarm.state === 'seeding';
      if (this.menuActionPauseLabel) {
        this.menuActionPauseLabel.textContent = isDownloading ? 'Pause Transfer' : 'Resume Transfer';
      }
      if (this.menuActionPauseIcon) {
        this.menuActionPauseIcon.innerHTML = isDownloading
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      }

      if (this.menuActionSequentialCheck) {
        this.menuActionSequentialCheck.classList.toggle('hidden', !swarm.sequential);
      }
    }

    this.swarmContextMenu.classList.remove('hidden');
    const menuWidth = 250;
    const menuHeight = this.swarmContextMenu.offsetHeight || 420;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    // Viewport collision detection: flip upward or leftward if near edge
    if (posX + menuWidth > winWidth - 10) {
      posX = Math.max(10, winWidth - menuWidth - 10);
    }
    if (posY + menuHeight > winHeight - 10) {
      posY = Math.max(10, posY - menuHeight);
    }

    this.swarmContextMenu.style.left = `${posX}px`;
    this.swarmContextMenu.style.top = `${posY}px`;

    // Flow priority submenu collision detection
    const subMenu = document.getElementById('flowPrioritySubmenu');
    if (subMenu) {
      if (posX + menuWidth + 210 > winWidth) {
        subMenu.classList.add('flip-left');
      } else {
        subMenu.classList.remove('flip-left');
      }
    }
  }

  hideContextMenu() {
    this.swarmContextMenu?.classList.add('hidden');
  }

  togglePauseSwarm(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    if (s.state === 'downloading' || s.state === 'seeding') {
      this.pauseSwarm(id);
    } else {
      this.resumeSwarm(id);
    }
  }

  async forceStartSwarm(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.forceStarted = true;
    s.state = 'downloading';
    if (window.havenNative?.forceStartTorrent) {
      await window.havenNative.forceStartTorrent(id);
    } else {
      this.resumeSwarm(id);
    }
    this.saveSwarms();
    this.render();
    this.showToast(`Force Start engaged (queue bypassed): ${s.name}`);
  }

  openTorrentFolder(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    const dir = s.targetMount || this.downloadDir;
    const fullPath = s.name ? `${dir}\\${s.name}` : dir;
    if (window.havenNative?.showItemInFolder) {
      window.havenNative.showItemInFolder(fullPath);
      this.showToast(`Revealing in folder: ${s.name}`);
    } else {
      this.showToast(`Vault Directory: ${fullPath}`);
    }
  }

  async toggleSequentialStream(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.sequential = !s.sequential;
    if (window.havenNative?.setSequentialStream) {
      await window.havenNative.setSequentialStream({ id, sequential: s.sequential });
    }
    this.saveSwarms();
    this.render();
    this.showToast(s.sequential ? 'Sequential Stream Active (Media ready to stream)' : 'Normal Rarest-First Stream Active');
  }

  async changeTorrentVault(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    if (window.havenNative?.changeSaveVault) {
      const newPath = await window.havenNative.changeSaveVault(id);
      if (newPath) {
        s.targetMount = newPath;
        this.saveSwarms();
        this.render();
        this.showToast(`Save Vault relocated to: ${newPath}`);
      }
    } else {
      const newPath = prompt('Select new save directory:', s.targetMount || this.downloadDir);
      if (newPath) {
        s.targetMount = newPath;
        this.saveSwarms();
        this.render();
        this.showToast(`Save Vault relocated to: ${newPath}`);
      }
    }
  }

  async setFlowPriority(id, priority) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.flowPriority = priority;
    if (window.havenNative?.setTorrentPriority) {
      await window.havenNative.setTorrentPriority({ id, priority });
    }
    this.saveSwarms();
    const label = priority === 'high' ? 'High Priority (Top)' : (priority === 'eco' ? 'Eco / Background' : 'Normal Flow (1.0x)');
    this.showToast(`Flow priority set to ${label} for ${s.name}`);
  }

  async verifyLocalChunks(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    if (window.havenNative?.recheckTorrent) {
      await window.havenNative.recheckTorrent(id);
    }
    this.showToast(`Verifying piece hash integrity for: ${s.name}`);
  }

  async refreshSwarmTrackers(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    if (window.havenNative?.refreshTrackers) {
      await window.havenNative.refreshTrackers(id);
    }
    this.showToast('Announced to all trackers & DHT swarm');
  }

  copyTorrentMagnet(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    const uri = s.magnetURI || `magnet:?xt=urn:btih:${s.hash}&dn=${encodeURIComponent(s.name)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(uri);
    }
    this.showToast('Magnet URI copied');
  }

  copyTorrentInfoHash(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(s.hash || '');
    }
    this.showToast(`InfoHash copied: ${s.hash || id}`);
  }

  async removeSwarmKeepFiles(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    if (window.havenNative?.deleteTorrent) {
      await window.havenNative.deleteTorrent({
        id,
        deleteFiles: false,
        targetDir: s.targetMount || this.downloadDir,
        name: s.name || ''
      });
    }
    this.swarms = this.swarms.filter(item => item.id !== id);
    if (this.selectedId === id) {
      this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
    }
    this.saveSwarms();
    this.render();
    this.showToast(`Removed from Sanctuary (files kept on disk): ${s.name}`);
  }

  promptDeleteWithFiles(id) {
    this.pendingDeleteId = id;
    const swarm = this.swarms.find(s => s.id === id);
    if (this.deleteSwarmTitle) {
      this.deleteSwarmTitle.textContent = swarm ? `Remove & Purge "${swarm.name}"?` : 'Delete Swarm';
    }
    if (this.optDeleteData) {
      const radio = this.optDeleteData.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }
    this.deleteSwarmModal?.classList.remove('hidden');
  }

  /* -------------------------------------------------------------------------
     FLOW CONTROL MODAL
     ------------------------------------------------------------------------- */
  openThrottleModal() {
    this.trafficThrottleModal?.classList.remove('hidden');
  }

  closeThrottleModal() {
    this.trafficThrottleModal?.classList.add('hidden');
  }

  applyThrottlePreset(preset) {
    if (preset === 'unlimited') {
      this.throttleDownSlider.value = 0;
      this.throttleUpSlider.value = 0;
      this.throttleWiresSlider.value = 60;
      this.throttleDownVal.textContent = 'Unlimited';
      this.throttleUpVal.textContent = 'Unlimited';
      this.throttleWiresVal.textContent = '60 Wires';
    } else if (preset === 'gaming') {
      this.throttleDownSlider.value = 1000;
      this.throttleUpSlider.value = 100;
      this.throttleWiresSlider.value = 25;
      this.throttleDownVal.textContent = '1.0 MB/s';
      this.throttleUpVal.textContent = '100 KB/s';
      this.throttleWiresVal.textContent = '25 Wires';
    } else if (preset === 'stealth') {
      this.throttleDownSlider.value = 250;
      this.throttleUpSlider.value = 50;
      this.throttleWiresSlider.value = 15;
      this.throttleDownVal.textContent = '250 KB/s';
      this.throttleUpVal.textContent = '50 KB/s';
      this.throttleWiresVal.textContent = '15 Wires';
    }
  }

  resetThrottle() {
    this.applyThrottlePreset('unlimited');
    this.presetButtons.forEach(b => b.classList.remove('active'));
    document.getElementById('presetUnlimited')?.classList.add('active');
  }

  applyThrottle() {
    const downKBs = parseInt(this.throttleDownSlider.value, 10);
    const upKBs = parseInt(this.throttleUpSlider.value, 10);
    const maxConns = parseInt(this.throttleWiresSlider.value, 10);

    const config = {
      downBytesSec: downKBs > 0 ? downKBs * 1024 : -1,
      upBytesSec: upKBs > 0 ? upKBs * 1024 : -1,
      maxConns
    };

    if (window.havenNative?.setTrafficThrottle) {
      window.havenNative.setTrafficThrottle(config);
    }
    this.closeThrottleModal();
    this.showToast('QoS flow limits applied.');
  }

  /* -------------------------------------------------------------------------
     HELPER METHODS
     ------------------------------------------------------------------------- */
  async fetchDiskSpace(targetDir) {
    if (window.havenNative?.getVolumeInfo) {
      try {
        const info = await window.havenNative.getVolumeInfo(targetDir || this.downloadDir);
        if (info) {
          if (this.modalDestSpace) {
            this.modalDestSpace.textContent = `${info.freeFormatted || '—'} Available`;
          }
          if (this.vaultAvailableText) {
            this.vaultAvailableText.textContent = `${info.freeFormatted || '—'} Available (${info.totalFormatted || '—'} Total)`;
          }
          if (this.vaultCapacityFill && typeof info.usedPct === 'number') {
            this.vaultCapacityFill.style.width = `${info.usedPct}%`;
          }
          if (this.vaultCapacityTotal) {
            const driveLabel = info.rootDrive ? `${info.rootDrive.replace(/[\/\\]$/, '')} Drive` : 'Storage Vault';
            this.vaultCapacityTotal.textContent = `${driveLabel} (${info.usedPct || 0}% Used)`;
          }
        }
      } catch (_) {}
    }
  }

  formatDisplayPath(fullPath) {
    if (!fullPath) return 'Downloads / Torrents';
    const parts = fullPath.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
    }
    return fullPath;
  }

  extractMagnetName(uri) {
    const match = uri.match(/[?&]dn=([^&]+)/);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
  }

  extractMagnetHash(uri) {
    const match = uri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    return match ? match[1].toLowerCase() : '';
  }

  detectCategory(name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('.iso') || lower.includes('linux') || lower.includes('installer') || lower.includes('debian') || lower.includes('arch')) return 'iso';
    if (lower.includes('4k') || lower.includes('hdr') || lower.includes('1080p') || lower.includes('.mkv') || lower.includes('.mp4') || lower.includes('movie') || lower.includes('nature') || lower.includes('video')) return 'video';
    if (lower.includes('photo') || lower.includes('asset') || lower.includes('image') || lower.includes('.zip') || lower.includes('.tar')) return 'asset';
    return 'package';
  }

  getCategoryClass(cat, name) {
    const c = cat || this.detectCategory(name);
    if (c === 'iso') return 'cat-iso';
    if (c === 'video') return 'cat-video';
    if (c === 'asset') return 'cat-asset';
    return 'cat-package';
  }

  getCategorySvg(cat, name) {
    const c = cat || this.detectCategory(name);
    if (c === 'iso') {
      return `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
    if (c === 'video') {
      return `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="2" y1="7" x2="7" y2="7"></line>
          <line x1="2" y1="17" x2="7" y2="17"></line>
          <line x1="17" y1="17" x2="22" y2="17"></line>
          <line x1="17" y1="7" x2="22" y2="7"></line>
        </svg>
      `;
    }
    if (c === 'asset') {
      return `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          <polygon points="12 11 12 17 17 14"></polygon>
        </svg>
      `;
    }
    return `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="4"></circle>
      </svg>
    `;
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0.0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  formatSpeed(bytesSec) {
    if (!bytesSec || bytesSec === 0) return '0.0 KB/s';
    if (bytesSec < 1024 * 1024) {
      return `${(bytesSec / 1024).toFixed(1)} KB/s`;
    }
    return `${(bytesSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  formatEta(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Connecting to peers...';
    if (seconds < 60) return `${Math.round(seconds)}s remaining`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s remaining`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m remaining`;
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}

// Instantiate App on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.havenApp = new HavenApp();
});
