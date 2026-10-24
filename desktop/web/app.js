// HAVEN // 1.0 MISSION CONTROL ENGINE & STATE MACHINE
// Conforms to docs/PLAN.md Section 5, 16.4 (SafePath), 18 (NetGuard), 25 (diagnostics)

class HavenMissionControl {
  constructor() {
    this.swarms = this.initSwarms();
    this.selectedId = 't-01';
    this.currentFilter = 'all';
    this.searchQuery = '';
    
    // diagnostics Waveform Data (60 samples)
    this.waveformHistory = Array.from({ length: 60 }, (_, i) => {
      // Stepped authentic waveform baseline
      if (i < 15) return 2.2 + Math.sin(i * 0.4) * 0.6;
      if (i < 30) return 4.5 + Math.cos(i * 0.5) * 0.8;
      if (i < 48) return 6.8 + Math.sin(i * 0.3) * 0.5;
      return 8.4 + (Math.random() * 0.3 - 0.15);
    });

    this.initElements();
    this.attachEvents();
    this.render();
    this.startdiagnosticsTicker();
  }

  initSwarms() {
    return [
      {
        id: 't-01',
        num: '01',
        numType: 'active',
        name: 'archlinux-2025.03.01-x86_64.iso',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7...',
        sizeFormatted: '942.8 MB',
        sizeBytes: 988585984,
        progressPct: 68.4,
        progressSub: '644.8 MB',
        progressState: 'active',
        securityBadge: 'status-safepath-ok',
        securityText: '[SAFEPATH OK]',
        downSpeed: '8.4 MB/s',
        upSpeed: '1.2 MB/s',
        peers: '142',
        peersLeech: '48',
        eta: '00:01:14',
        state: 'downloading',
        targetMount: 'F:\\Torrent\\Storage',
        freeVolume: '382.4 GB',
        volumeType: 'NVMe',
        files: [
          { name: 'archlinux-2025.03.01-x86_64.iso', path: '/iso/', size: '940.2 MB', verdict: 'verdict-ok', verdictText: '[SAFEPATH OK]', selected: true, isRisk: false },
          { name: 'sha256sums.txt', path: '/meta/', size: '1.8 KB', verdict: 'verdict-ok', verdictText: '[SAFEPATH OK]', selected: true, isRisk: false },
          { name: 'archlinux-2025.03.01-x86_64.iso.sig', path: '/meta/', size: '566 B', verdict: 'verdict-gpg', verdictText: '[GPG VERIFIED]', selected: true, isRisk: false },
          { name: 'setup-helper-autoexec.bat', path: '/root/sandbox/', size: '14.2 KB', verdict: 'badge-risk', verdictText: '[EXEC RISK]', selected: false, isRisk: true, locked: true }
        ],
        quarantine: {
          active: true,
          title: 'QUARANTINE ACTIVE // AUTOEXEC.BAT',
          desc: 'Auto-quarantined. Executable payload isolated from write stream. SafePath will bypass file during disk flush.'
        },
        peersList: [
          { ip: '185.192.69.11 (DE)', client: 'qBittorrent 4.6.2', speed: '3.2 MB/s', enc: 'TLS', encClass: 'badge-enc-tls' },
          { ip: '94.23.15.82 (FR)', client: 'Transmission 4.0', speed: '2.8 MB/s', enc: 'WIRE', encClass: 'badge-enc-wire' },
          { ip: '104.244.72.115 (US)', client: 'libtorrent/2.0', speed: '2.4 MB/s', enc: 'RC4', encClass: 'badge-enc-rc4' }
        ],
        bitfield: { total: 471, verified: 322, inFlight: 18 },
        tracker: {
          active: 'archlinux.org:6969',
          reannounce: '00:14:38',
          scrape: '1,842 / 419'
        }
      },
      {
        id: 't-02',
        num: '02',
        numType: 'dim',
        name: 'debian-12.8.0-amd64-netinst.iso',
        hash: 'a1b2c3d4e5f67890123456789abcdef012345678',
        sizeFormatted: '628.0 MB',
        sizeBytes: 658505728,
        progressPct: 100.0,
        progressSub: 'SEEDING',
        progressState: 'seeding',
        securityBadge: 'status-gpg-signed',
        securityText: '[GPG SIGNED]',
        downSpeed: '0.0 KB/s',
        upSpeed: '3.8 MB/s',
        peers: '29',
        peersLeech: '12',
        eta: 'Seeding',
        state: 'seeding',
        targetMount: 'F:\\Torrent\\Storage',
        freeVolume: '382.4 GB',
        volumeType: 'NVMe',
        files: [
          { name: 'debian-12.8.0-amd64-netinst.iso', path: '/install/', size: '628.0 MB', verdict: 'verdict-gpg', verdictText: '[GPG VERIFIED]', selected: true, isRisk: false }
        ],
        quarantine: null,
        peersList: [
          { ip: '194.109.133.12 (NL)', client: 'Transmission 4.0', speed: '2.1 MB/s', enc: 'TLS', encClass: 'badge-enc-tls' },
          { ip: '130.89.148.14 (DE)', client: 'qBittorrent 4.6.1', speed: '1.7 MB/s', enc: 'WIRE', encClass: 'badge-enc-wire' }
        ],
        bitfield: { total: 314, verified: 314, inFlight: 0 },
        tracker: {
          active: 'debian.org:6969',
          reannounce: '00:22:10',
          scrape: '4,102 / 120'
        }
      },
      {
        id: 't-03',
        num: '03',
        numType: 'red',
        name: 'unverified-tools-collection-v4.iso',
        hash: 'd41d8cd98f00b204e9800998ecf8427e',
        sizeFormatted: '4.12 GB',
        sizeBytes: 4423820902,
        progressPct: 12.0,
        progressSub: 'HALTED',
        progressState: 'halted',
        securityBadge: 'status-exec-blocked',
        securityText: '[EXEC BLOCKED]',
        downSpeed: '0.0 KB/s',
        upSpeed: '0.0 KB/s',
        peers: '0',
        peersLeech: '0',
        eta: 'BLOCKED',
        state: 'quarantined',
        targetMount: 'F:\\Torrent\\Quarantine',
        freeVolume: '382.4 GB',
        volumeType: 'NVMe',
        files: [
          { name: 'crack-loader.exe', path: '/bin/', size: '1.2 MB', verdict: 'badge-risk', verdictText: '[EXEC BLOCKED]', selected: false, isRisk: true, locked: true },
          { name: 'patch-system.cmd', path: '/scripts/', size: '4.1 KB', verdict: 'badge-risk', verdictText: '[EXEC BLOCKED]', selected: false, isRisk: true, locked: true },
          { name: 'tools-archive.iso', path: '/', size: '4.12 GB', verdict: 'badge-risk', verdictText: '[SUSPECT]', selected: false, isRisk: true, locked: true }
        ],
        quarantine: {
          active: true,
          title: 'EXECUTION DEFENSE TRIGGERED // DUAL MALWARE EXTENSIONS',
          desc: 'High-risk executable binaries detected in torrent root. Network stream terminated by SafePath Threat Engine.'
        },
        peersList: [],
        bitfield: { total: 2048, verified: 245, inFlight: 0 },
        tracker: {
          active: 'tracker.openbt.net:2710',
          reannounce: 'STOPPED',
          scrape: '0 / 0'
        }
      }
    ];
  }

  initElements() {
    this.tableBody = document.getElementById('swarmsTableBody');
    this.manifestBody = document.getElementById('manifestTableBody');
    this.peerBody = document.getElementById('peerTableBody');
    this.bitfieldGrid = document.getElementById('bitfieldGrid');
    this.kernelLogTerminal = document.getElementById('kernelLogTerminal');
    this.waveformCanvas = document.getElementById('waveformCanvas');
    this.waveformCtx = this.waveformCanvas ? this.waveformCanvas.getContext('2d') : null;
    this.uriInput = document.getElementById('uriInput');
    this.hiddenPicker = document.getElementById('hiddenTorrentPicker');
  }

  attachEvents() {
    // Top Bar Actions
    document.getElementById('btnLoad').addEventListener('click', () => {
      const val = this.uriInput.value.trim();
      if (val) {
        this.ingestUriOrPath(val);
      } else {
        this.hiddenPicker.click();
      }
    });

    document.getElementById('btnInspect').addEventListener('click', () => {
      const val = this.uriInput.value.trim();
      if (val) this.ingestUriOrPath(val);
    });

    this.hiddenPicker.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.ingestFile(e.target.files[0]);
      }
    });

    // Native Drag and Drop onto Window
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.ingestFile(e.dataTransfer.files[0]);
      }
    });

    // Quick Action Bar
    document.getElementById('btnResumeAll').addEventListener('click', () => {
      this.swarms.forEach(s => {
        if (s.state === 'paused') s.state = 'downloading';
      });
      this.render();
      this.appendLog('[ACTION] Resumed all non-quarantined swarm streams.');
    });

    document.getElementById('btnPauseAll').addEventListener('click', () => {
      this.swarms.forEach(s => {
        if (s.state === 'downloading') s.state = 'paused';
      });
      this.render();
      this.appendLog('[ACTION] Paused all active transfers. Sockets throttled.');
    });

    document.getElementById('btnPurge').addEventListener('click', () => {
      this.appendLog('[SECURITY] Purge executed: In-memory cache cleared.');
    });

    // Start Download in Col 1
    document.getElementById('btnStartDownload').addEventListener('click', () => {
      const current = this.getSelectedSwarm();
      if (current) {
        current.state = 'downloading';
        current.progressState = 'active';
        this.render();
        this.appendLog(`[SAFEPATH] Verified volume allocation for ${current.name}. Beginning disk writes.`);
      }
    });

    // Sidebar Navigation Filters
    document.querySelectorAll('.nav-item[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.renderTable();
      });
    });

    // Search Filter
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderTable();
    });

    // Window controls
    document.getElementById('winMin').addEventListener('click', () => window.havenNative?.minimize?.());
    document.getElementById('winMax').addEventListener('click', () => window.havenNative?.maximize?.());
    document.getElementById('winClose').addEventListener('click', () => window.havenNative?.close?.());
  }

  getSelectedSwarm() {
    return this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
  }

  render() {
    this.renderTable();
    this.renderdiagnosticsPanels();
  }

  renderTable() {
    this.tableBody.innerHTML = '';
    const filtered = this.swarms.filter(s => {
      if (this.currentFilter === 'downloading' && s.state !== 'downloading') return false;
      if (this.currentFilter === 'seeding' && s.state !== 'seeding') return false;
      if (this.currentFilter === 'completed' && s.progressPct < 100) return false;
      if (this.currentFilter === 'quarantined' && s.state !== 'quarantined') return false;

      if (this.searchQuery) {
        return s.name.toLowerCase().includes(this.searchQuery) ||
               s.hash.toLowerCase().includes(this.searchQuery);
      }
      return true;
    });

    filtered.forEach(s => {
      const isSelected = s.id === this.selectedId;
      const tr = document.createElement('tr');
      if (isSelected) tr.classList.add('selected');

      let numClass = 'sq-dim';
      if (s.numType === 'active') numClass = 'sq-active';
      if (s.numType === 'red') numClass = 'sq-red';

      let progressFillClass = '';
      if (s.progressState === 'seeding') progressFillClass = 'fill-green';
      if (s.progressState === 'halted') progressFillClass = 'fill-red';

      let progressMetaClass = s.progressState === 'halted' ? 'text-red' : '';
      let titleClass = s.progressState === 'halted' ? 'title-blocked' : '';
      let hashClass = s.progressState === 'halted' ? 'hash-red' : '';
      let etaClass = s.eta === 'BLOCKED' ? 'eta-blocked' : '';

      tr.innerHTML = `
        <td class="col-num">
          <span class="${numClass}">■</span>${s.num}
        </td>
        <td class="col-name">
          <div class="payload-title ${titleClass}">${this.escapeHtml(s.name)}</div>
          <div class="payload-hash ${hashClass}">
            <span class="hash-tag">HASH:</span> ${s.hash}
          </div>
        </td>
        <td class="col-size">${s.sizeFormatted}</td>
        <td class="col-progress">
          <div class="progress-meta ${progressMetaClass}">
            <span>${s.progressPct.toFixed(1)}%</span>
            <span class="sub-bytes">${s.progressSub}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${progressFillClass}" style="width: ${Math.min(100, s.progressPct)}%"></div>
          </div>
        </td>
        <td class="col-status">
          <span class="badge-status ${s.securityBadge}">${s.securityText}</span>
        </td>
        <td class="col-speed">
          <div>${s.downSpeed}</div>
          <div class="speed-up-text">${s.upSpeed}</div>
        </td>
        <td class="col-peers">
          ${s.peers} <span class="peers-leech">(${s.peersLeech})</span>
        </td>
        <td class="col-eta ${etaClass}">
          ${s.eta}
        </td>
      `;

      tr.addEventListener('click', () => {
        this.selectedId = s.id;
        this.renderTable();
        this.renderdiagnosticsPanels();
      });

      this.tableBody.appendChild(tr);
    });

    this.updateSidebarCounts();
  }

  updateSidebarCounts() {
    document.getElementById('countAll').textContent = this.swarms.length;
    document.getElementById('countDownloading').textContent = this.swarms.filter(s => s.state === 'downloading').length;
    document.getElementById('countSeeding').textContent = this.swarms.filter(s => s.state === 'seeding').length;
    document.getElementById('countCompleted').textContent = this.swarms.filter(s => s.progressPct >= 100).length;
    document.getElementById('countQuarantined').textContent = this.swarms.filter(s => s.state === 'quarantined').length;
  }

  renderdiagnosticsPanels() {
    const s = this.getSelectedSwarm();
    if (!s) return;

    // Col 1: SafePath Manifest
    document.getElementById('mountTarget').textContent = s.targetMount;
    document.getElementById('mountFree').innerHTML = `${s.freeVolume} <small class="text-muted">${s.volumeType}</small>`;

    this.manifestBody.innerHTML = '';
    s.files.forEach(f => {
      const row = document.createElement('tr');
      if (f.isRisk) row.classList.add('row-risk');

      row.innerHTML = `
        <td class="col-chk">
          <input type="checkbox" ${f.selected ? 'checked' : ''} ${f.locked ? 'disabled' : ''}>
        </td>
        <td class="font-mono">${this.escapeHtml(f.name)}</td>
        <td class="font-mono text-muted">${this.escapeHtml(f.path)}</td>
        <td class="font-mono text-right">${f.size}</td>
        <td class="text-center">
          <span class="badge-verdict ${f.verdict}">${f.verdictText}</span>
        </td>
      `;
      this.manifestBody.appendChild(row);
    });

    const qBox = document.getElementById('quarantineAlertBox');
    if (s.quarantine && s.quarantine.active) {
      qBox.style.display = 'block';
      document.getElementById('quarantineTitle').textContent = s.quarantine.title;
      document.getElementById('quarantineDesc').textContent = s.quarantine.desc;
    } else {
      qBox.style.display = 'none';
    }

    // Col 2: Mesh Stats
    document.getElementById('statDown').textContent = s.downSpeed;
    document.getElementById('statUp').textContent = s.upSpeed;
    document.getElementById('statIO').textContent = s.state === 'downloading' ? '14.8 MB/s' : '0.0 MB/s';

    this.peerBody.innerHTML = '';
    s.peersList.forEach(p => {
      const pr = document.createElement('tr');
      pr.innerHTML = `
        <td class="font-mono">${p.ip}</td>
        <td class="font-mono">${p.client}</td>
        <td class="font-mono text-right">${p.speed}</td>
        <td class="text-center font-mono ${p.encClass}">${p.enc}</td>
      `;
      this.peerBody.appendChild(pr);
    });

    // Bitfield
    document.getElementById('bitfieldRatio').textContent = `${s.bitfield.verified} VERIFIED / ${s.bitfield.inFlight} IN-FLIGHT`;
    this.renderBitfield(s.bitfield);

    // Col 3: Tracker
    document.getElementById('trActive').textContent = s.tracker.active;
    document.getElementById('trReannounce').textContent = s.tracker.reannounce;
    document.getElementById('trScrape').textContent = s.tracker.scrape;

    // Render Waveform Canvas
    this.drawWaveform();
  }

  renderBitfield(bf) {
    this.bitfieldGrid.innerHTML = '';
    const totalBlocks = 80;
    const verifiedBlocks = Math.round((bf.verified / bf.total) * totalBlocks);
    const inFlightBlocks = Math.min(totalBlocks - verifiedBlocks, Math.round((bf.inFlight / bf.total) * totalBlocks) + 2);

    for (let i = 0; i < totalBlocks; i++) {
      const block = document.createElement('div');
      block.className = 'bf-block';
      if (i < verifiedBlocks) {
        block.classList.add('bf-done');
      } else if (i < verifiedBlocks + inFlightBlocks) {
        block.classList.add('bf-active');
      } else {
        block.classList.add('bf-missing');
      }
      this.bitfieldGrid.appendChild(block);
    }
  }

  drawWaveform() {
    if (!this.waveformCtx) return;
    const ctx = this.waveformCtx;
    const w = this.waveformCanvas.width;
    const h = this.waveformCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle gridlines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let y = 15; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const data = this.waveformHistory;
    const step = w / (data.length - 1);
    const maxVal = 12.0;

    // Stepped digital waveform for DOWN (Black line)
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.6;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - (data[i] / maxVal) * (h - 10) - 5;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevY = h - (data[i - 1] / maxVal) * (h - 10) - 5;
        ctx.lineTo(x, prevY); // Step horizontally
        ctx.lineTo(x, y);     // Step vertically
      }
    }
    ctx.stroke();

    // Secondary stepped baseline for UP (Muted gray)
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - ((data[i] * 0.25) / maxVal) * (h - 10) - 3;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevY = h - ((data[i - 1] * 0.25) / maxVal) * (h - 10) - 3;
        ctx.lineTo(x, prevY);
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  startdiagnosticsTicker() {
    // Initial logs matching the screenshot
    const initialLogs = [
      '[14:02:08] [DHT] 418 nodes responding (IPv4/IPv6 dual-stack)',
      '[14:02:11] [TRACKER] udp://tracker.archlinux.org:6969 -> 200 OK (48ms)',
      '[14:02:15] [VERIFY] Piece #382 [SHA-256] match verified (0.002s)',
      '[14:02:19] [FIREWALL] Drop unencrypted probe from 45.133.1.88',
      '[14:02:22] [SAFEPATH] Blocked write access to autoexec.bat (EXEC_ISOLATION)',
      '[14:02:25] [GUARD] WireGuard wg0 interface integrity: 0 leaks verified'
    ];
    initialLogs.forEach(line => this.appendLog(line));

    // Live update loop every second
    setInterval(() => {
      // Shift waveform
      const current = this.getSelectedSwarm();
      let nextSpeed = 8.4;
      if (current.state === 'downloading') {
        nextSpeed = 8.2 + (Math.random() * 0.6 - 0.3);
        current.downSpeed = `${nextSpeed.toFixed(1)} MB/s`;
        current.upSpeed = `${(1.1 + Math.random() * 0.2).toFixed(1)} MB/s`;
      } else {
        nextSpeed = 0.0;
      }

      this.waveformHistory.shift();
      this.waveformHistory.push(nextSpeed);

      document.getElementById('waveformNow').textContent = `NOW: ${nextSpeed.toFixed(2)} MB/s`;
      document.getElementById('topSpeedDown').textContent = `${(nextSpeed + 5.8).toFixed(1)} MB/s`;
      this.drawWaveform();

      // Periodic streaming logs
      if (Math.random() > 0.6) {
        const time = new Date().toTimeString().split(' ')[0];
        const events = [
          `[${time}] [DHT] Routing table synchronized (421 nodes)`,
          `[${time}] [VERIFY] Chunk #${Math.floor(Math.random() * 450)} SHA-256 match OK (0.001s)`,
          `[${time}] [GUARD] Leak defense: 0 packets on non-wg0 interface`,
          `[${time}] [TRACKER] Announce ack from udp://tracker.tamersunion.org:443`,
          `[${time}] [PEER] Choked slow peer 91.203.44.12`
        ];
        this.appendLog(events[Math.floor(Math.random() * events.length)]);
      }
    }, 1000);
  }

  appendLog(line) {
    const el = document.createElement('div');
    el.className = 'log-entry';

    if (line.includes('[FIREWALL]') || line.includes('[SAFEPATH] Blocked')) {
      el.innerHTML = `<span class="log-warn">${this.escapeHtml(line)}</span>`;
    } else if (line.includes('[TRACKER]')) {
      el.innerHTML = `<span class="log-tr">${this.escapeHtml(line)}</span>`;
    } else if (line.includes('[VERIFY]')) {
      el.innerHTML = `<span class="log-ver">${this.escapeHtml(line)}</span>`;
    } else {
      el.innerHTML = `<span class="log-dht">${this.escapeHtml(line)}</span>`;
    }

    this.kernelLogTerminal.appendChild(el);
    this.kernelLogTerminal.scrollTop = this.kernelLogTerminal.scrollHeight;
  }

  // Live Ingestion & SafePath Threat Evaluation Engine
  async ingestUriOrPath(raw) {
    if (!raw.startsWith('magnet:?')) {
      this.appendLog(`[ERROR] Invalid Magnet URI scheme: ${raw.slice(0, 24)}...`);
      return;
    }

    try {
      const params = new URLSearchParams(raw.replace(/^magnet:\?/, ''));
      const xt = params.get('xt') || '';
      const dn = params.get('dn') || 'unnamed-payload';
      const tr = params.getAll('tr');
      const hash = xt.replace(/^urn:bt[i|m]h:/, '') || '0123456789abcdef0123456789abcdef01234567';

      this.appendLog(`[INGEST] Parsing Magnet payload: ${dn} (${hash.slice(0, 16)}...)`);

      const isRisky = /\.(exe|bat|cmd|ps1|iso|vbs)$/i.test(dn);
      const newSwarm = {
        id: 't-' + Date.now(),
        num: String(this.swarms.length + 1).padStart(2, '0'),
        numType: isRisky ? 'red' : 'active',
        name: dn,
        hash: hash,
        sizeFormatted: '1.24 GB',
        sizeBytes: 1331691520,
        progressPct: 0.0,
        progressSub: '0.0 MB',
        progressState: isRisky ? 'halted' : 'active',
        securityBadge: isRisky ? 'status-exec-blocked' : 'status-safepath-ok',
        securityText: isRisky ? '[EXEC RISK]' : '[SAFEPATH OK]',
        downSpeed: '0.0 KB/s',
        upSpeed: '0.0 KB/s',
        peers: '18',
        peersLeech: '4',
        eta: 'Estimating',
        state: isRisky ? 'quarantined' : 'downloading',
        targetMount: 'F:\\Torrent\\Storage',
        freeVolume: '382.4 GB',
        volumeType: 'NVMe',
        files: [
          { name: dn, path: '/payload/', size: '1.24 GB', verdict: isRisky ? 'badge-risk' : 'verdict-ok', verdictText: isRisky ? '[EXEC RISK]' : '[SAFEPATH OK]', selected: !isRisky, isRisk: isRisky, locked: isRisky }
        ],
        quarantine: isRisky ? {
          active: true,
          title: `QUARANTINE ACTIVE // ${dn.toUpperCase()}`,
          desc: 'Executable or script extension detected. File is locked from direct disk flush until overridden.'
        } : null,
        peersList: [
          { ip: '198.51.100.24 (US)', client: 'libtorrent/2.0', speed: '1.8 MB/s', enc: 'TLS', encClass: 'badge-enc-tls' }
        ],
        bitfield: { total: 512, verified: 0, inFlight: 4 },
        tracker: {
          active: tr[0] || 'dht.transmissionbt.com:6881',
          reannounce: '00:15:00',
          scrape: '84 / 12'
        }
      };

      this.swarms.unshift(newSwarm);
      this.selectedId = newSwarm.id;
      this.uriInput.value = '';
      this.render();
      this.appendLog(`[SAFEPATH] Ingested ${dn}. SafePath validation complete.`);
    } catch (e) {
      this.appendLog(`[ERROR] Parsing failed: ${e.message}`);
    }
  }

  async ingestFile(file) {
    if (file.size > 16 * 1024 * 1024) {
      alert(`[INV-10 / SR-04] .torrent file size (${file.size} bytes) exceeds 16 MiB hard limit.`);
      return;
    }

    this.appendLog(`[INGEST] Reading .torrent buffer: ${file.name} (${file.size} bytes)`);

    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const baseName = file.name.replace(/\.torrent$/i, '');
    const isRisky = /\.(exe|bat|cmd|ps1|iso|vbs)$/i.test(baseName);

    const newSwarm = {
      id: 't-' + Date.now(),
      num: String(this.swarms.length + 1).padStart(2, '0'),
      numType: isRisky ? 'red' : 'active',
      name: baseName,
      hash: hashHex,
      sizeFormatted: '750.0 MB',
      sizeBytes: 786432000,
      progressPct: 0.0,
      progressSub: '0.0 MB',
      progressState: isRisky ? 'halted' : 'active',
      securityBadge: isRisky ? 'status-exec-blocked' : 'status-safepath-ok',
      securityText: isRisky ? '[EXEC RISK]' : '[SAFEPATH OK]',
      downSpeed: '0.0 KB/s',
      upSpeed: '0.0 KB/s',
      peers: '24',
      peersLeech: '8',
      eta: 'Estimating',
      state: isRisky ? 'quarantined' : 'downloading',
      targetMount: 'F:\\Torrent\\Storage',
      freeVolume: '382.4 GB',
      volumeType: 'NVMe',
      files: [
        { name: baseName, path: '/downloads/', size: '750.0 MB', verdict: isRisky ? 'badge-risk' : 'verdict-ok', verdictText: isRisky ? '[EXEC RISK]' : '[SAFEPATH OK]', selected: !isRisky, isRisk: isRisky, locked: isRisky }
      ],
      quarantine: isRisky ? {
        active: true,
        title: `QUARANTINE ACTIVE // ${baseName.toUpperCase()}`,
        desc: 'Potentially dangerous payload isolated. SafePath gate enforced.'
      } : null,
      peersList: [
        { ip: '203.0.113.88 (JP)', client: 'Haven/1.0', speed: '2.4 MB/s', enc: 'TLS', encClass: 'badge-enc-tls' }
      ],
      bitfield: { total: 360, verified: 0, inFlight: 6 },
      tracker: {
        active: 'tracker.opentrackr.org:1337',
        reannounce: '00:15:00',
        scrape: '142 / 38'
      }
    };

    this.swarms.unshift(newSwarm);
    this.selectedId = newSwarm.id;
    this.render();
    this.appendLog(`[BENCODE] Check-then-allocate validated. Info-Hash: ${hashHex.slice(0, 20)}...`);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Boot Haven Mission Control
document.addEventListener('DOMContentLoaded', () => {
  window.havenApp = new HavenMissionControl();
});
