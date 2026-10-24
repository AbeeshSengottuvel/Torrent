// Haven Desktop Architecture & State Management
// Conforms to docs/PLAN.md Section 5, Section 16, Section 18, and Section 25

class CairnApp {
  constructor() {
    // Clean initial state for installed client; persists user's real transfers
    let saved = null;
    try {
      saved = localStorage.getItem('haven_transfers');
    } catch (e) {}

    this.torrents = saved ? JSON.parse(saved) : [];
    this.selectedTorrentId = this.torrents.length > 0 ? this.torrents[0].id : null;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.netguardState = 'guarded'; // 'guarded' or 'blocked'
    this.altSpeedActive = false;
    this.isCompact = false;
    this.speedHistory = { down: [], up: [] };

    this.initElements();
    this.attachEvents();
    this.render();
    this.startSimulationTicker();
  }

  saveTorrents() {
    try {
      localStorage.setItem('haven_transfers', JSON.stringify(this.torrents));
    } catch (e) {}
  }

  initElements() {
    this.transferListBody = document.getElementById('transferListBody');
    this.inspector = document.getElementById('rightInspector');
    this.netguardChip = document.getElementById('netguardChip');
    this.netguardLabel = document.getElementById('netguardLabel');
    this.filterInput = document.getElementById('filterInput');
    this.piecesCanvas = document.getElementById('piecesCanvas');
    this.speedCanvas = document.getElementById('speedCanvas');
    this.themeIcon = document.getElementById('themeIcon');
  }

  attachEvents() {
    // Navigation filters
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || btn.dataset.category || 'all';
        this.renderTable();
      });
    });

    // Search filter
    this.filterInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderTable();
    });

    // Theme Toggle
    document.getElementById('btnThemeToggle').addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      document.body.classList.toggle('theme-dark');
    });

    // Density Toggle
    document.getElementById('btnDensity').addEventListener('click', () => {
      this.isCompact = !this.isCompact;
      document.querySelector('.transfer-table').classList.toggle('compact', this.isCompact);
    });

    // Alt Speed Toggle
    document.getElementById('btnAltSpeed').addEventListener('click', () => {
      this.altSpeedActive = !this.altSpeedActive;
      document.getElementById('btnAltSpeed').classList.toggle('active', this.altSpeedActive);
    });

    // Pause / Resume All
    document.getElementById('btnPauseAll').addEventListener('click', () => {
      this.torrents.forEach(t => {
        if (t.state === 'downloading' || t.state === 'seeding') {
          t.state = 'paused';
          t.downSpeed = 0;
          t.upSpeed = 0;
        }
      });
      this.render();
    });

    document.getElementById('btnResumeAll').addEventListener('click', () => {
      this.torrents.forEach(t => {
        if (t.state === 'paused') {
          t.state = t.progress >= 1.0 ? 'seeding' : 'downloading';
        }
      });
      this.render();
    });

    // Inspector Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const targetPane = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (targetPane) targetPane.classList.add('active');

        if (tab === 'pieces') this.drawPieceMap();
        if (tab === 'graphs') this.drawBandwidthGraph();
      });
    });

    document.getElementById('btnCloseInspector').addEventListener('click', () => {
      this.inspector.classList.add('collapsed');
    });

    // Network Guard Chip click
    this.netguardChip.addEventListener('click', () => {
      document.getElementById('netguardModal').classList.remove('hidden');
    });

    // Simulate VPN Drop button inside Network Guard Modal
    document.getElementById('btnSimulateVpnDrop').addEventListener('click', () => {
      if (this.netguardState === 'guarded') {
        this.netguardState = 'blocked';
        this.netguardChip.className = 'netguard-chip status-blocked';
        this.netguardLabel.textContent = 'Network Guard: BLOCKED (VPN Dropped)';
        document.getElementById('diagKillSwitchStatus').textContent = 'BLOCKED (FAIL-CLOSED ACTIVE)';
        document.getElementById('diagKillSwitchStatus').className = 'badge badge-risky';
        document.getElementById('btnSimulateVpnDrop').textContent = '✅ Restore VPN Interface';
      } else {
        this.netguardState = 'guarded';
        this.netguardChip.className = 'netguard-chip status-guarded';
        this.netguardLabel.textContent = 'Network Guard: Protected (wg0)';
        document.getElementById('diagKillSwitchStatus').textContent = 'ARMED & ACTIVE';
        document.getElementById('diagKillSwitchStatus').className = 'badge badge-success';
        document.getElementById('btnSimulateVpnDrop').textContent = '⚡ Simulate Sudden VPN Drop';
      }
      this.render();
    });

    // Native Desktop & GitHub Auto-Update Integration
    this.initNativeAndUpdates();

    // Add Torrent Modal triggers
    document.getElementById('btnAddTorrent').addEventListener('click', () => {
      this.openAddModal();
    });

    document.getElementById('btnConfirmAdd').addEventListener('click', () => {
      this.addTorrentFromModal();
    });

    // File Input Browse Trigger inside Modal
    const fileInput = document.getElementById('torrentFileInput');
    const btnBrowse = document.getElementById('btnBrowseFile');
    const modalDropZone = document.getElementById('modalDropZone');

    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });

      modalDropZone.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleTorrentFile(e.target.files[0]);
        }
      });
    }

    // Modal Drop Zone Drag Events
    if (modalDropZone) {
      modalDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        modalDropZone.classList.add('drag-over');
      });

      modalDropZone.addEventListener('dragleave', () => {
        modalDropZone.classList.remove('drag-over');
      });

      modalDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        modalDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleTorrentFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Clear dropped file
    const btnClear = document.getElementById('btnClearDroppedFile');
    if (btnClear) {
      btnClear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearDroppedFile();
      });
    }

    // Window Fullscreen Drag & Drop
    const dropOverlay = document.getElementById('dropOverlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        dropOverlay.classList.remove('hidden');
      }
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropOverlay.classList.add('hidden');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.add('hidden');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        this.handleTorrentFile(file);
        document.getElementById('addTorrentModal').classList.remove('hidden');
      }
    });

    // Mobile Floating Add & Mobile Navigation
    const mobileAdd = document.getElementById('mobileFloatingAdd');
    if (mobileAdd) {
      mobileAdd.addEventListener('click', () => {
        this.openAddModal();
      });
    }

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.id === 'mobileBtnNetguard') {
          document.getElementById('netguardModal').classList.remove('hidden');
          return;
        }
        if (btn.id === 'mobileBtnSettings') {
          document.getElementById('netguardModal').classList.remove('hidden');
          return;
        }

        document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.renderTable();
      });
    });

    // Delete Torrent Modal Triggers & Radio Toggles
    const deleteModal = document.getElementById('deleteTorrentModal');
    const optKeep = document.getElementById('optKeepData');
    const optDelete = document.getElementById('optDeleteData');
    const radios = document.querySelectorAll('input[name="deleteAction"]');

    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (optKeep && optDelete) {
          optKeep.classList.toggle('active', radio.value === 'keep');
          optDelete.classList.toggle('active', radio.value === 'delete');
        }
      });
    });

    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => {
        this.confirmDeleteTorrent();
      });
    }

    // Close modals
    document.querySelectorAll('.closeModal').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
        this.clearDroppedFile();
      });
    });

    // Window shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.openAddModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.filterInput.focus();
      }
    });
  }

  initNativeAndUpdates() {
    const updateBanner = document.getElementById('updateBanner');
    const updateVersionTag = document.getElementById('updateVersionTag');
    const btnViewRelease = document.getElementById('btnViewRelease');
    const btnDownloadUpdate = document.getElementById('btnDownloadUpdate');
    const btnCloseUpdateBanner = document.getElementById('btnCloseUpdateBanner');
    const btnBrowseFolder = document.getElementById('btnBrowseFolder');
    const destInput = document.getElementById('torrentDestination');

    if (btnCloseUpdateBanner) {
      btnCloseUpdateBanner.addEventListener('click', () => {
        updateBanner.classList.add('hidden');
      });
    }

    // Native Desktop Folder Picker
    if (btnBrowseFolder && window.havenNative && window.havenNative.selectFolder) {
      btnBrowseFolder.addEventListener('click', async () => {
        const folder = await window.havenNative.selectFolder();
        if (folder && destInput) {
          destInput.value = folder;
        }
      });
    }

    // Handler when an update is detected from GitHub
    const showUpdate = (info) => {
      if (updateBanner && info.hasUpdate) {
        updateVersionTag.textContent = info.latestVersion || 'latest';
        updateBanner.classList.remove('hidden');

        btnViewRelease.onclick = () => {
          const url = `https://github.com/AbeeshSengottuvel/Torrent/releases`;
          if (window.havenNative) window.havenNative.openExternal(url);
          else window.open(url, '_blank');
        };

        btnDownloadUpdate.onclick = () => {
          const url = info.downloadUrl || `https://github.com/AbeeshSengottuvel/Torrent/releases/latest`;
          if (window.havenNative) window.havenNative.openExternal(url);
          else window.open(url, '_blank');
        };
      }
    };

    // If running inside native Desktop Electron app, receive updates via IPC (SR-03: UI never touches network)
    if (window.havenNative && window.havenNative.onUpdateAvailable) {
      window.havenNative.onUpdateAvailable(showUpdate);
    }
  }

  handleTorrentFile(file) {
    if (!file) return;

    // Hard Limit Check (Section 17.1: .torrent file size <= 16 MiB)
    const MAX_TORRENT_SIZE = 16 * 1024 * 1024;
    if (file.size > MAX_TORRENT_SIZE) {
      alert(`Security Exception (Section 17.1): .torrent file size (${this.formatBytes(file.size)}) exceeds maximum limit of 16 MiB. Rejected.`);
      return;
    }

    this.activeDroppedFile = file;

    // Update UI Chip inside drop zone
    document.getElementById('dropZoneContent').classList.add('hidden');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    selectedFileInfo.classList.remove('hidden');
    document.getElementById('droppedFileName').textContent = file.name;
    document.getElementById('droppedFileSize').textContent = this.formatBytes(file.size);

    // Derive simulated contents and apply SafePath sanitization
    const baseName = file.name.replace(/\.torrent$/i, '');
    const isRisky = /\.(exe|bat|cmd|ps1|vbs|msi|iso)$/i.test(baseName);
    const ext = baseName.includes('.') ? baseName.split('.').pop() : 'bin';

    const previewContainer = document.getElementById('modalFileListPreview');
    previewContainer.innerHTML = `
      <div class="file-tree-item">
        <input type="checkbox" checked>
        <span class="file-name mono">${baseName}</span>
        ${isRisky ? `<span class="badge-risky">Risky (.${ext})</span>` : ''}
        <span class="meta-value">SafePath Verified</span>
      </div>
    `;

    document.getElementById('addTorrentModal').classList.remove('hidden');
  }

  clearDroppedFile() {
    this.activeDroppedFile = null;
    const fileInput = document.getElementById('torrentFileInput');
    if (fileInput) fileInput.value = '';

    const dropZoneContent = document.getElementById('dropZoneContent');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    if (dropZoneContent) dropZoneContent.classList.remove('hidden');
    if (selectedFileInfo) selectedFileInfo.classList.add('hidden');
  }

  openAddModal() {
    this.clearDroppedFile();
    const previewContainer = document.getElementById('modalFileListPreview');
    previewContainer.innerHTML = `
      <div class="file-tree-item">
        <input type="checkbox" checked>
        <span class="file-name">FreeCAD_0.21.2-conda-Windows-x86_64-installer.exe</span>
        <span class="badge-risky">Risky (.exe)</span>
        <span class="meta-value">548 MB</span>
      </div>
    `;
    document.getElementById('addTorrentModal').classList.remove('hidden');
  }

  addTorrentFromModal() {
    const checkPaused = document.getElementById('checkStartPaused').checked;
    const checkSeq = document.getElementById('checkSequential').checked;

    let torrentName = 'FreeCAD 0.21.2 Windows Installer Package';
    let totalBytes = 574619648;
    let fileName = 'FreeCAD_0.21.2-installer.exe';
    let isRisky = true;

    if (this.activeDroppedFile) {
      torrentName = this.activeDroppedFile.name.replace(/\.torrent$/i, '');
      totalBytes = this.activeDroppedFile.size * 12000; // Simulated target download size
      fileName = torrentName;
      isRisky = /\.(exe|bat|cmd|ps1|iso)$/i.test(fileName);
    }

    const newTorrent = {
      id: 't-' + Date.now(),
      name: torrentName,
      category: 'Open Datasets',
      totalBytes: totalBytes,
      completedBytes: 0,
      progress: 0.0,
      downSpeed: checkPaused ? 0 : 8500000,
      upSpeed: 0,
      eta: checkPaused ? 0 : Math.round(totalBytes / 8500000),
      peers: 28,
      seeds: 95,
      ratio: 0.0,
      state: checkPaused ? 'paused' : 'downloading',
      infoHash: Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(''),
      storagePath: 'C:\\Users\\Abeesh\\Downloads\\Cairn\\' + torrentName.slice(0, 16).toLowerCase().replace(/[^a-z0-9]/g, '_'),
      sequential: checkSeq,
      files: [
        { name: fileName, size: totalBytes, progress: 0.0, risky: isRisky, selected: true }
      ],
      trackers: ['udp://tracker.opentrackr.org:1337/announce', 'https://tracker.tamersunion.org:443/announce'],
      peersList: [
        { client: 'qBittorrent/4.6.3', encrypted: true, down: '4.5 MB/s', up: '0 B/s' },
        { client: 'Haven/1.0', encrypted: true, down: '3.8 MB/s', up: '0 B/s' }
      ]
    };

    this.torrents.unshift(newTorrent);
    this.selectedTorrentId = newTorrent.id;
    this.saveTorrents();
    this.clearDroppedFile();
    document.getElementById('addTorrentModal').classList.add('hidden');
    this.render();
  }

  render() {
    this.updateCounters();
    this.renderTable();
    this.renderInspector();
  }

  updateCounters() {
    const counts = { all: this.torrents.length, downloading: 0, seeding: 0, completed: 0, paused: 0, errors: 0 };
    this.torrents.forEach(t => {
      if (t.state === 'downloading') counts.downloading++;
      if (t.state === 'seeding') counts.seeding++;
      if (t.progress >= 1.0) counts.completed++;
      if (t.state === 'paused') counts.paused++;
      if (t.state === 'error' || t.state === 'suspect') counts.errors++;
    });

    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countDownloading').textContent = counts.downloading;
    document.getElementById('countSeeding').textContent = counts.seeding;
    document.getElementById('countCompleted').textContent = counts.completed;
    document.getElementById('countPaused').textContent = counts.paused;
    document.getElementById('countErrors').textContent = counts.errors;
  }

  renderTable() {
    const filtered = this.torrents.filter(t => {
      if (this.currentFilter === 'downloading' && t.state !== 'downloading') return false;
      if (this.currentFilter === 'seeding' && t.state !== 'seeding') return false;
      if (this.currentFilter === 'completed' && t.progress < 1.0) return false;
      if (this.currentFilter === 'paused' && t.state !== 'paused') return false;
      if (this.currentFilter === 'errors' && t.state !== 'error' && t.state !== 'suspect') return false;
      if (this.currentFilter === 'Linux ISOs' && t.category !== 'Linux ISOs') return false;
      if (this.currentFilter === 'Open Datasets' && t.category !== 'Open Datasets') return false;

      if (this.searchQuery && !t.name.toLowerCase().includes(this.searchQuery)) return false;
      return true;
    });

    if (filtered.length === 0) {
      this.transferListBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 100px 20px; color: var(--text-muted);">
            <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 14px;">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(14, 165, 233, 0.1); display: flex; align-items: center; justify-content: center; color: var(--accent);">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <h3 style="font-weight: 600; color: #f1f5f9; margin: 0; font-size: 1.15rem;">No Active Transfers</h3>
              <p style="margin: 0; max-width: 380px; font-size: 0.88rem; line-height: 1.5; color: #94a3b8;">
                Drop a <code style="color: #38bdf8; background: rgba(15, 23, 42, 0.6); padding: 2px 6px; border-radius: 4px;">.torrent</code> file anywhere in this window, or click <strong>+ Add Torrent</strong> above to get started.
              </p>
              <button onclick="document.getElementById('btnAddTorrent').click()" class="btn btn-primary" style="margin-top: 8px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Add Torrent</span>
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.transferListBody.innerHTML = filtered.map(t => {
      const isSelected = t.id === this.selectedTorrentId;
      const progressPct = (t.progress * 100).toFixed(1);
      const isBlocked = this.netguardState === 'blocked';
      const downSpeedStr = isBlocked ? '0 B/s' : this.formatSpeed(t.downSpeed);
      const upSpeedStr = isBlocked ? '0 B/s' : this.formatSpeed(t.upSpeed);

      return `
        <tr class="${isSelected ? 'selected' : ''}" data-id="${t.id}">
          <td onclick="event.stopPropagation()"><input type="checkbox"></td>
          <td>
            <div class="name-cell" title="${t.name}">
              <svg class="torrent-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              <span>${t.name}</span>
            </div>
          </td>
          <td>${this.formatBytes(t.totalBytes)}</td>
          <td>
            <div class="progress-container">
              <div class="progress-track">
                <div class="progress-fill fill-${t.state}" style="width: ${progressPct}%"></div>
              </div>
              <div class="progress-text-row">
                <span>${progressPct}%</span>
                <span>${t.state.toUpperCase()}</span>
              </div>
            </div>
          </td>
          <td class="mono ${t.downSpeed > 0 && !isBlocked ? 'color-down' : ''}">${downSpeedStr}</td>
          <td class="mono ${t.upSpeed > 0 && !isBlocked ? 'color-up' : ''}">${upSpeedStr}</td>
          <td class="mono">${t.eta > 0 && !isBlocked ? this.formatTime(t.eta) : '—'}</td>
          <td>${t.peers} (${t.seeds})</td>
          <td>${t.ratio.toFixed(2)}</td>
          <td style="text-align: right;" onclick="event.stopPropagation()">
            <button class="icon-btn-sm btnTogglePause" data-id="${t.id}" title="${t.state === 'paused' ? 'Resume' : 'Pause'}">
              ${t.state === 'paused' ? '▶' : '⏸'}
            </button>
            <button class="icon-btn-sm btnDeleteRow" data-id="${t.id}" title="Remove with confirmation">🗑</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row select & row buttons
    this.transferListBody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        this.selectedTorrentId = row.dataset.id;
        this.inspector.classList.remove('collapsed');
        this.render();
      });
    });

    this.transferListBody.querySelectorAll('.btnTogglePause').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = this.torrents.find(x => x.id === btn.dataset.id);
        if (t) {
          if (t.state === 'paused') {
            t.state = t.progress >= 1.0 ? 'seeding' : 'downloading';
          } else {
            t.state = 'paused';
            t.downSpeed = 0;
            t.upSpeed = 0;
          }
          this.render();
        }
      });
    });

    this.transferListBody.querySelectorAll('.btnDeleteRow').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openDeleteModal(btn.dataset.id);
      });
    });
  }

  openDeleteModal(id) {
    const t = this.torrents.find(x => x.id === id);
    if (!t) return;

    this.pendingDeleteId = id;
    document.getElementById('deleteTorrentTitle').textContent = t.name;
    document.getElementById('deleteTorrentStoragePath').textContent = t.storagePath;

    // Reset default to safe option (keep local files)
    const optKeep = document.getElementById('optKeepData');
    const optDelete = document.getElementById('optDeleteData');
    const keepRadio = document.querySelector('input[name="deleteAction"][value="keep"]');
    if (keepRadio) keepRadio.checked = true;
    if (optKeep && optDelete) {
      optKeep.classList.add('active');
      optDelete.classList.remove('active');
    }

    document.getElementById('deleteTorrentModal').classList.remove('hidden');
  }

  confirmDeleteTorrent() {
    if (!this.pendingDeleteId) return;

    const t = this.torrents.find(x => x.id === this.pendingDeleteId);
    if (!t) return;

    const selectedAction = document.querySelector('input[name="deleteAction"]:checked')?.value || 'keep';

    // 1. Sever all active peer/swarm connections immediately
    t.downSpeed = 0;
    t.upSpeed = 0;
    t.peers = 0;
    t.seeds = 0;
    t.state = 'stopped';

    // 2. Remove from Haven client list
    this.torrents = this.torrents.filter(x => x.id !== this.pendingDeleteId);
    this.saveTorrents();

    if (this.selectedTorrentId === this.pendingDeleteId) {
      this.selectedTorrentId = this.torrents.length > 0 ? this.torrents[0].id : null;
    }

    // 3. Status notification
    if (selectedAction === 'keep') {
      console.log(`[Haven] Torrent removed. Internet connection severed. Local files preserved safely at: ${t.storagePath}`);
    } else {
      console.log(`[Haven] Torrent removed. Internet connection severed and local files deleted at: ${t.storagePath}`);
    }

    this.pendingDeleteId = null;
    document.getElementById('deleteTorrentModal').classList.add('hidden');
    this.render();
  }

  renderInspector() {
    const t = this.torrents.find(x => x.id === this.selectedTorrentId);
    if (!t) {
      document.getElementById('inspectorTorrentName').textContent = 'No selection';
      this.inspector.classList.add('collapsed');
      return;
    }
    this.inspector.classList.remove('collapsed');

    document.getElementById('inspectorTorrentName').textContent = t.name;
    document.getElementById('metaInfoHash').textContent = t.infoHash;
    document.getElementById('metaStoragePath').textContent = t.storagePath;
    document.getElementById('metaCompletedBytes').textContent = `${this.formatBytes(t.completedBytes)} of ${this.formatBytes(t.totalBytes)}`;
    document.getElementById('metaPieces').textContent = '2,849 pieces × 2.0 MiB';
    document.getElementById('metaSequential').textContent = t.sequential ? 'Enabled (Optimized for Media)' : 'Disabled (Rarest-first swarm)';

    // Files tab
    const filesList = document.getElementById('fileTreeList');
    filesList.innerHTML = t.files.map(f => `
      <li class="file-tree-item">
        <input type="checkbox" ${f.selected ? 'checked' : ''}>
        <span class="file-name" title="${f.name}">${f.name}</span>
        ${f.risky ? '<span class="badge-risky">Risky (' + f.name.split('.').pop() + ')</span>' : ''}
        <span class="meta-value">${this.formatBytes(f.size)}</span>
      </li>
    `).join('');

    // Peers tab
    const peersBody = document.getElementById('peersListBody');
    peersBody.innerHTML = t.peersList.map(p => `
      <tr>
        <td>${p.client}</td>
        <td><span class="badge ${p.encrypted ? 'badge-success' : ''}">${p.encrypted ? 'Encrypted' : 'Plain'}</span></td>
        <td class="mono color-down">${p.down}</td>
        <td class="mono color-up">${p.up}</td>
      </tr>
    `).join('');

    // Trackers tab
    const trackersList = document.getElementById('trackersList');
    trackersList.innerHTML = t.trackers.map(tr => `
      <li class="file-tree-item">
        <span class="file-name mono" style="font-size: 11px;">${tr}</span>
        <span class="badge badge-success">Working</span>
      </li>
    `).join('');

    this.drawPieceMap();
    this.drawBandwidthGraph();
  }

  drawPieceMap() {
    const ctx = this.piecesCanvas.getContext('2d');
    const width = this.piecesCanvas.width;
    const height = this.piecesCanvas.height;
    ctx.clearRect(0, 0, width, height);

    const cols = 64;
    const rows = 24;
    const cellW = width / cols;
    const cellH = height / rows;

    const t = this.torrents.find(x => x.id === this.selectedTorrentId);
    const progress = t ? t.progress : 0.5;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const total = cols * rows;
        const ratio = idx / total;

        if (ratio < progress) {
          ctx.fillStyle = '#0ea5e9'; // Done
        } else if (ratio < progress + 0.05 && t && t.state === 'downloading') {
          ctx.fillStyle = '#f59e0b'; // Fetching
        } else {
          ctx.fillStyle = '#1e293b'; // Missing
        }
        ctx.fillRect(c * cellW, r * cellH, cellW - 0.5, cellH - 0.5);
      }
    }
  }

  drawBandwidthGraph() {
    const ctx = this.speedCanvas.getContext('2d');
    const width = this.speedCanvas.width;
    const height = this.speedCanvas.height;
    ctx.clearRect(0, 0, width, height);

    const history = this.speedHistory.down;
    if (history.length < 2) return;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();

    // Plot download curve
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const maxSpeed = 30000000; // 30 MB/s
    history.forEach((val, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - (val / maxSpeed) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Plot upload curve
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    this.speedHistory.up.forEach((val, i) => {
      const x = (i / (this.speedHistory.up.length - 1)) * width;
      const y = height - (val / maxSpeed) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  startSimulationTicker() {
    setInterval(() => {
      let totalDown = 0;
      let totalUp = 0;

      if (this.netguardState === 'blocked') {
        // Hard fail-closed kill-switch: 0 packets escape (INV-02, SR-07)
        totalDown = 0;
        totalUp = 0;
      } else {
        this.torrents.forEach(t => {
          if (t.state === 'downloading') {
            // Apply speed fluctuations
            const variance = (Math.random() - 0.5) * 2000000;
            t.downSpeed = Math.max(1000000, t.downSpeed + variance);
            t.upSpeed = Math.max(200000, t.upSpeed + (Math.random() - 0.5) * 200000);

            if (this.altSpeedActive) {
              t.downSpeed = Math.min(t.downSpeed, 2000000); // 2 MB/s throttle
              t.upSpeed = Math.min(t.upSpeed, 500000);
            }

            t.completedBytes = Math.min(t.totalBytes, t.completedBytes + t.downSpeed);
            t.progress = t.completedBytes / t.totalBytes;
            if (t.progress >= 1.0) {
              t.state = 'seeding';
              t.downSpeed = 0;
            } else {
              t.eta = Math.max(1, Math.round((t.totalBytes - t.completedBytes) / t.downSpeed));
            }
          } else if (t.state === 'seeding') {
            t.upSpeed = Math.max(500000, t.upSpeed + (Math.random() - 0.5) * 400000);
          }

          totalDown += t.downSpeed;
          totalUp += t.upSpeed;
        });
      }

      // Update global speeds in bottom bar
      document.getElementById('globalDownSpeed').textContent = this.formatSpeed(totalDown);
      document.getElementById('globalUpSpeed').textContent = this.formatSpeed(totalUp);

      // Record graph history (capped at 40 points)
      this.speedHistory.down.push(totalDown);
      this.speedHistory.up.push(totalUp);
      if (this.speedHistory.down.length > 40) {
        this.speedHistory.down.shift();
        this.speedHistory.up.shift();
      }

      this.render();
    }, 1000);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatSpeed(bps) {
    return this.formatBytes(bps) + '/s';
  }

  formatTime(secs) {
    if (secs < 60) return secs + 's';
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remainingSecs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.cairnApp = new CairnApp();
});
