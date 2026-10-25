/**
 * HAVEN // ALPINE TORRENT LIVE WEB EXPERIENCE SIMULATOR
 * Interactive In-Browser Demo (docs/PLAN.md, MPL-2.0)
 */

class HavenExperienceApp {
  constructor() {
    this.swarms = this.initSwarms();
    this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.activeInspectorTab = 'speed';

    // 60-second rolling history buffers for smooth spline chart
    this.inflowHistory = [
      2.1, 2.3, 2.5, 2.7, 3.0, 3.2, 3.5, 3.8, 4.2, 4.6,
      4.9, 5.1, 5.3, 5.5, 5.8, 6.0, 5.9, 5.7, 5.4, 5.0,
      4.5, 4.2, 3.8, 3.5, 3.6, 3.9, 4.3, 4.8, 5.5, 6.2,
      7.0, 7.5, 7.8, 8.1, 8.3, 8.4, 8.2, 8.0, 7.8, 7.7,
      7.6, 7.6, 7.7, 7.9, 8.0, 8.1, 8.0, 7.8, 7.7, 7.6,
      7.5, 7.6, 7.7, 7.8, 7.9, 8.0, 7.9, 7.8, 7.7, 7.6
    ];
    this.outflowHistory = [
      0.8, 0.8, 0.9, 0.9, 1.0, 1.0, 1.1, 1.1, 1.2, 1.2,
      1.1, 1.1, 1.0, 1.0, 0.9, 0.9, 0.9, 1.0, 1.0, 1.1,
      1.1, 1.2, 1.2, 1.1, 1.1, 1.0, 1.0, 1.1, 1.1, 1.2,
      1.2, 1.3, 1.3, 1.4, 1.4, 1.3, 1.3, 1.2, 1.2, 1.2,
      1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2,
      1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2
    ];

    this.downloadDir = 'F:\\Torrent\\Sanctuary';
    this.pendingDeleteId = null;
    this.activeView = 'transfers';

    this.initElements();
    this.attachEvents();
    this.initSettingsEvents();
    this.loadSavedSettings();
    this.initChart();
    this.startTicker();
    this.render();
  }

  initSwarms() {
    try {
      const saved = localStorage.getItem('haven_alpine_swarms');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].files && parsed[0].files.length >= 3) {
          return parsed;
        }
      }
    } catch (_) {}

    return [
      {
        id: 'swarm-arch-2025',
        name: 'Arch Linux 2025 (x86_64)',
        category: 'iso',
        sizeFormatted: '1.38 GB',
        sizeBytes: 1481763840,
        downloadedFormatted: '942 MB',
        progressPct: 68,
        state: 'downloading',
        downSpeed: '8.4 MB/s',
        upSpeed: '1.2 MB/s',
        rawDownSpeed: 8400000,
        rawUpSpeed: 1200000,
        peakSpeed: '11.2 MB/s',
        meanSpeed: '8.1 MB/s',
        eta: 'Est. 52s remaining',
        peers: 142,
        seedingPeers: 48,
        totalChunks: 471,
        ratio: 0.42,
        hash: 'e5a1b2c3d4f60718293a4b5c6d7e8f9012345678',
        targetMount: 'F:\\Torrent\\Sanctuary',
        files: [
          {
            name: 'archlinux-2025.03.01-x86_64.iso',
            size: 1481761431,
            sizeFormatted: '1.38 GB',
            downloaded: '940.2 MB',
            progress: 68.1,
            priority: 'high',
            checked: true,
            safepath: true
          },
          {
            name: 'sha256sums.txt',
            badge: 'Verified',
            size: 1843,
            sizeFormatted: '1.8 KB',
            downloaded: '1.8 KB',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          },
          {
            name: 'archlinux-2025.03.01-x86_64.iso.sig',
            badge: 'GPG Valid',
            size: 566,
            sizeFormatted: '566 B',
            downloaded: '566 B',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          }
        ],
        peerNodes: [
          { cc: 'DE', city: 'Frankfurt, Germany', client: 'Haven Node 2.4', type: 'Direct Peer', latency: '19ms', security: 'TLS 1.3', rate: '2.4 MB/s' },
          { cc: 'SE', city: 'Stockholm, Sweden', client: 'Libtorrent 1.28', type: 'Alpine Mesh Relay', latency: '28ms', security: 'TLS 1.3', rate: '1.9 MB/s' },
          { cc: 'US', city: 'Seattle, WA', client: 'Transmission 4.0', type: 'DHT Lookup', latency: '72ms', security: 'TLS 1.3', rate: '1.6 MB/s' },
          { cc: 'JP', city: 'Tokyo, Japan', client: 'Haven Node 2.2', type: 'Seeding Node', latency: '114ms', security: 'TLS 1.3', rate: '1.1 MB/s' }
        ],
        trackers: [
          { host: 'tracker.archlinux.org:6969', latency: '< 28ms', status: 'OK • 92 seeds, 34 leechers', resync: 'Re-sync in 14m' },
          { host: 'torrent.swarms.is:443', latency: '< 32ms', status: 'OK • 31 seeds, 18 leechers', resync: 'Re-sync in 8m' },
          { host: 'Mainline DHT Routing Table', latency: '< 14ms', status: 'Nodes known: 1,482 • Bucket health 100%', resync: 'Continual auto-refresh' }
        ]
      },
      {
        id: 'swarm-cosmos-4k',
        name: 'Cosmos Nature Documentary (4K HDR)',
        category: 'video',
        sizeFormatted: '8.4 GB',
        sizeBytes: 9019431321,
        downloadedFormatted: '8.4 GB',
        progressPct: 100,
        state: 'seeding',
        downSpeed: '0.0 KB/s',
        upSpeed: '3.4 MB/s',
        rawDownSpeed: 0,
        rawUpSpeed: 3400000,
        peakSpeed: '4.8 MB/s',
        meanSpeed: '3.1 MB/s',
        ratio: 2.4,
        eta: 'Seeding • Ratio 2.4',
        peers: 48,
        seedingPeers: 18,
        totalChunks: 2867,
        hash: 'b2c3d4e5f60718293a4b5c6d7e8f90123456789a',
        targetMount: 'F:\\Torrent\\Sanctuary',
        files: [
          {
            name: 'Cosmos.Nature.Documentary.2160p.HDR.mkv',
            size: 9015114137,
            sizeFormatted: '8.4 GB',
            downloaded: '8.4 GB',
            progress: 100,
            priority: 'high',
            checked: true,
            safepath: true
          },
          {
            name: 'Cosmos.Nature.Documentary.English.srt',
            badge: 'Verified',
            size: 122880,
            sizeFormatted: '120 KB',
            downloaded: '120 KB',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          },
          {
            name: 'Cover.Artwork.png',
            badge: 'Asset OK',
            size: 4194304,
            sizeFormatted: '4.0 MB',
            downloaded: '4.0 MB',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          }
        ],
        peerNodes: [
          { cc: 'GB', city: 'London, UK', client: 'Haven Node 2.4', type: 'Direct Peer', latency: '22ms', security: 'TLS 1.3', rate: '1.4 MB/s' },
          { cc: 'CA', city: 'Toronto, Canada', client: 'qBittorrent 4.6', type: 'Mesh Relay', latency: '45ms', security: 'TLS 1.3', rate: '1.2 MB/s' },
          { cc: 'NL', city: 'Amsterdam, Netherlands', client: 'Transmission 4.0', type: 'Direct Peer', latency: '18ms', security: 'TLS 1.3', rate: '0.8 MB/s' }
        ],
        trackers: [
          { host: 'tracker.opentrackr.org:1337', latency: '< 21ms', status: 'OK • 140 seeds, 52 leechers', resync: 'Re-sync in 18m' },
          { host: 'explodie.org:6969', latency: '< 29ms', status: 'OK • 84 seeds, 22 leechers', resync: 'Re-sync in 11m' },
          { host: 'Mainline DHT Routing Table', latency: '< 12ms', status: 'Nodes known: 1,840 • Bucket health 100%', resync: 'Continual auto-refresh' }
        ]
      },
      {
        id: 'swarm-alpine-photos',
        name: 'Alpine Photo Assets Collection',
        category: 'asset',
        sizeFormatted: '3.2 GB',
        sizeBytes: 3435973836,
        downloadedFormatted: '1.34 GB',
        progressPct: 42,
        state: 'downloading',
        downSpeed: '4.1 MB/s',
        upSpeed: '0.8 MB/s',
        rawDownSpeed: 4100000,
        rawUpSpeed: 800000,
        peakSpeed: '5.6 MB/s',
        meanSpeed: '3.8 MB/s',
        ratio: 0.28,
        eta: '4m 20s remaining',
        peers: 56,
        seedingPeers: 19,
        totalChunks: 1092,
        hash: 'c3d4e5f60718293a4b5c6d7e8f90123456789ab1',
        targetMount: 'F:\\Torrent\\Sanctuary',
        files: [
          {
            name: 'Alpine_RAW_Assets_Archive_01.tar',
            size: 1717986918,
            sizeFormatted: '1.6 GB',
            downloaded: '858 MB',
            progress: 50.0,
            priority: 'high',
            checked: true,
            safepath: true
          },
          {
            name: 'Alpine_RAW_Assets_Archive_02.tar',
            size: 1717986918,
            sizeFormatted: '1.6 GB',
            downloaded: '584 MB',
            progress: 34.0,
            priority: 'normal',
            checked: true,
            safepath: true
          },
          {
            name: 'Manifest_Checksums.sha512',
            badge: 'Verified',
            size: 1024,
            sizeFormatted: '1.0 KB',
            downloaded: '1.0 KB',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          }
        ],
        peerNodes: [
          { cc: 'CH', city: 'Zurich, Switzerland', client: 'Haven Node 2.4', type: 'Direct Peer', latency: '14ms', security: 'TLS 1.3', rate: '2.1 MB/s' },
          { cc: 'FR', city: 'Paris, France', client: 'Libtorrent 1.28', type: 'Alpine Mesh Relay', latency: '24ms', security: 'TLS 1.3', rate: '1.2 MB/s' },
          { cc: 'AT', city: 'Vienna, Austria', client: 'Haven Node 2.3', type: 'Direct Peer', latency: '31ms', security: 'TLS 1.3', rate: '0.8 MB/s' }
        ],
        trackers: [
          { host: 'tracker.alpine-community.org:8443', latency: '< 16ms', status: 'OK • 64 seeds, 19 leechers', resync: 'Re-sync in 9m' },
          { host: 'Mainline DHT Routing Table', latency: '< 15ms', status: 'Nodes known: 1,320 • Bucket health 100%', resync: 'Continual auto-refresh' }
        ]
      },
      {
        id: 'swarm-debian-12',
        name: 'Debian 12 Net-Installer',
        category: 'iso',
        sizeFormatted: '620 MB',
        sizeBytes: 650117120,
        downloadedFormatted: '620 MB',
        progressPct: 100,
        state: 'completed',
        downSpeed: '0.0 KB/s',
        upSpeed: '0.0 KB/s',
        rawDownSpeed: 0,
        rawUpSpeed: 0,
        peakSpeed: '8.0 MB/s',
        meanSpeed: '4.5 MB/s',
        ratio: 1.05,
        eta: 'Preserved locally',
        peers: 0,
        seedingPeers: 0,
        totalChunks: 207,
        hash: 'd4e5f60718293a4b5c6d7e8f90123456789ab1c2',
        targetMount: 'F:\\Torrent\\Sanctuary',
        files: [
          {
            name: 'debian-12.8.0-amd64-netinst.iso',
            size: 650114239,
            sizeFormatted: '620 MB',
            downloaded: '620 MB',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          },
          {
            name: 'SHA512SUMS',
            badge: 'Verified',
            size: 2048,
            sizeFormatted: '2.0 KB',
            downloaded: '2.0 KB',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          },
          {
            name: 'SHA512SUMS.sign',
            badge: 'GPG Valid',
            size: 833,
            sizeFormatted: '833 B',
            downloaded: '833 B',
            progress: 100,
            priority: 'normal',
            checked: true,
            safepath: true
          }
        ],
        peerNodes: [],
        trackers: [
          { host: 'bttracker.debian.org:6969', latency: '< 35ms', status: 'Completed • Standby', resync: 'Idle' }
        ]
      }
    ];
  }

  initElements() {
    this.transfersListContainer = document.getElementById('transfersListContainer');
    this.activeCountBadge = document.getElementById('activeCountBadge');
    this.searchInput = document.getElementById('searchInput');

    this.sidebarSessionDown = document.getElementById('sidebarSessionDown') || document.getElementById('sidebarSpeedDown');
    this.sidebarSessionUp = document.getElementById('sidebarSessionUp') || document.getElementById('sidebarSpeedUp');
    this.sidebarSpeedDown = this.sidebarSessionDown;
    this.sidebarSpeedUp = this.sidebarSessionUp;

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

    this.filterButtons = document.querySelectorAll('.filter-segmented-pill .filter-pill-btn');

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

    this.deleteSwarmModal = document.getElementById('deleteSwarmModal');
    this.deleteSwarmTitle = document.getElementById('deleteSwarmTitle');
    this.btnCloseDeleteModal = document.getElementById('btnCloseDeleteModal');
    this.btnCancelDelete = document.getElementById('btnCancelDelete');
    this.btnConfirmDelete = document.getElementById('btnConfirmDelete');
    this.optKeepData = document.getElementById('optKeepData');
    this.optDeleteData = document.getElementById('optDeleteData');

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

    this.netguardModal = document.getElementById('netguardModal');
    this.btnNetguardIndicator = document.getElementById('btnNetguardIndicator');
    this.btnCloseNetguardModal = document.getElementById('btnCloseNetguardModal');
    this.btnCloseNetguard = document.getElementById('btnCloseNetguard');
    this.btnSimulateVpnDrop = document.getElementById('btnSimulateVpnDrop');
    this.btnRunLeakTest = document.getElementById('btnRunLeakTest');
    this.leakTestBanner = document.getElementById('leakTestBanner');

    this.dragDropOverlay = document.getElementById('dragDropOverlay');

    // Sanctuary Settings elements
    this.transfersView = document.getElementById('transfersView');
    this.settingsView = document.getElementById('settingsView');

    // Deep Inspect Studio Elements
    this.inspectView = document.getElementById("inspectView");
    this.btnBackFromInspect = document.getElementById("btnBackFromInspect");
    this.inspectCatIcon = document.getElementById("inspectCatIcon");
    this.inspectTorrentName = document.getElementById("inspectTorrentName");
    this.inspectStatusBadge = document.getElementById("inspectStatusBadge");
    this.inspectTorrentSub = document.getElementById("inspectTorrentSub");
    this.btnInspectPause = document.getElementById("btnInspectPause");
    this.inspectPauseText = document.getElementById("inspectPauseText");
    this.btnInspectFolder = document.getElementById("btnInspectFolder");
    this.btnInspectMore = document.getElementById("btnInspectMore");

    this.inspectActivePeers = document.getElementById("inspectActivePeers");
    this.inspectPeersTrend = document.getElementById("inspectPeersTrend");
    this.inspectInflowVal = document.getElementById("inspectInflowVal");
    this.inspectInflowPeak = document.getElementById("inspectInflowPeak");
    this.inspectOutflowVal = document.getElementById("inspectOutflowVal");
    this.inspectShareRatio = document.getElementById("inspectShareRatio");

    this.inspectPeersList = document.getElementById("inspectPeersList");
    this.inspectTrackersList = document.getElementById("inspectTrackersList");
    this.inspectTrackersCount = document.getElementById("inspectTrackersCount");

    this.inspectLegendDown = document.getElementById("inspectLegendDown");
    this.inspectLegendUp = document.getElementById("inspectLegendUp");
    this.waveformPeak = document.getElementById("waveformPeak");
    this.waveformMean = document.getElementById("waveformMean");
    this.waveformNowTick = document.getElementById("waveformNowTick");
    this.inspectWaveformCanvas = document.getElementById("inspectWaveformCanvas");
    this.inspectWaveformCtx = this.inspectWaveformCanvas ? this.inspectWaveformCanvas.getContext("2d") : null;

    this.inspectPieceStatsText = document.getElementById("inspectPieceStatsText");
    this.btnSequentialPriority = document.getElementById("btnSequentialPriority");
    this.pieceMatrixGrid = document.getElementById("pieceMatrixGrid");
    this.countVerifiedPieces = document.getElementById("countVerifiedPieces");
    this.countInflightPieces = document.getElementById("countInflightPieces");
    this.countPendingPieces = document.getElementById("countPendingPieces");

    this.inspectFilesHeaderCount = document.getElementById("inspectFilesHeaderCount");
    this.inspectManifestList = document.getElementById("inspectManifestList");

    this.navTransfers = document.getElementById('navTransfers');
    this.navDeepInspect = document.getElementById('navDeepInspect');
    this.navSettingsStudio = document.getElementById('navSettingsStudio');
    this.btnBackToTransfers = document.getElementById('btnBackToTransfers');
    this.btnOpenSettingsBottom = document.getElementById('btnOpenSettingsBottom');
    this.havenToast = document.getElementById('havenToast');

    // Mobile Navigation & Speed Widgets
    this.navMobileTransfers = document.getElementById('navMobileTransfers');
    this.navMobileInspect = document.getElementById('navMobileInspect');
    this.navMobileSettings = document.getElementById('navMobileSettings');
    this.navMobileAdd = document.getElementById('navMobileAdd');
    this.mobileSpeedDown = document.getElementById('mobileSpeedDown');
    this.mobileSpeedUp = document.getElementById('mobileSpeedUp');

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

    this.settingsSearchInput = document.getElementById('settingsSearchInput');
    this.anchorPills = document.querySelectorAll('.anchor-pill-btn');
    this.themeCards = document.querySelectorAll('.theme-card');
    this.chkDaylightSync = document.getElementById('chkDaylightSync');
    this.densityButtons = document.querySelectorAll('.density-btn');
    this.sliderDiffusion = document.getElementById('sliderDiffusion');
    this.diffusionValLabel = document.getElementById('diffusionValLabel');

    this.settingsVaultPath = document.getElementById('settingsVaultPath');
    this.btnChangeVaultDir = document.getElementById('btnChangeVaultDir');
    this.vaultCapacityFill = document.getElementById('vaultCapacityFill');
    this.vaultAvailableText = document.getElementById('vaultAvailableText');
    this.stagingPathDesc = document.getElementById('stagingPathDesc');
    this.chkQuarantineStaging = document.getElementById('chkQuarantineStaging');
    this.chkSafePathLock = document.getElementById('chkSafePathLock');
    this.chkPreallocate = document.getElementById('chkPreallocate');
    this.chkAutoOrganize = document.getElementById('chkAutoOrganize');
    this.chkMoveCompleted = document.getElementById('chkMoveCompleted');

    this.qosSettingsCards = document.querySelectorAll('.qos-card');
    this.settingsDownSlider = document.getElementById('settingsDownSlider');
    this.settingsUpSlider = document.getElementById('settingsUpSlider');
    this.settingsDownVal = document.getElementById('settingsDownVal');
    this.settingsUpVal = document.getElementById('settingsUpVal');
    this.chkCircadian = document.getElementById('chkCircadian');
    this.selSeedRatio = document.getElementById('selSeedRatio');
    this.selSeedTime = document.getElementById('selSeedTime');

    this.encPills = document.querySelectorAll('.enc-pill-btn');
    this.chkDht = document.getElementById('chkDht');
    this.chkPex = document.getElementById('chkPex');
    this.chkLpd = document.getElementById('chkLpd');
    this.chkUtp = document.getElementById('chkUtp');
    this.inputListeningPort = document.getElementById('inputListeningPort');
    this.btnRandomizePort = document.getElementById('btnRandomizePort');
    this.chkUpnp = document.getElementById('chkUpnp');

    this.chkLaunchLogin = document.getElementById('chkLaunchLogin');
    this.chkMinimizeTray = document.getElementById('chkMinimizeTray');
    this.chkProtocols = document.getElementById('chkProtocols');
    this.chkPreventSleep = document.getElementById('chkPreventSleep');
    this.btnClearCache = document.getElementById('btnClearCache');
    this.btnResetDefaults = document.getElementById('btnResetDefaults');
    this.btnExportConfig = document.getElementById('btnExportConfig');
    this.btnSavePreferences = document.getElementById('btnSavePreferences');
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

    // Mobile Bottom Nav Events
    this.navMobileTransfers?.addEventListener('click', () => this.switchView('transfers'));
    this.navMobileInspect?.addEventListener('click', () => this.switchView('inspect'));
    this.navMobileSettings?.addEventListener('click', () => this.switchView('settings'));
    this.navMobileAdd?.addEventListener('click', () => this.openAddModal());

    this.btnOpenAddModal?.addEventListener('click', () => this.openAddModal());
    this.btnCloseAddModal?.addEventListener('click', () => this.closeAddModal());
    this.btnCancelAddModal?.addEventListener('click', () => this.closeAddModal());
    this.addDownloadModal?.addEventListener('click', (e) => {
      if (e.target === this.addDownloadModal) this.closeAddModal();
    });

    this.typeMagnetTab?.addEventListener('click', () => this.setAddModalTab('magnet'));
    this.typeTorrentTab?.addEventListener('click', () => this.setAddModalTab('torrent'));

    this.btnPasteClipboard?.addEventListener('click', () => {
      if (this.modalMagnetUri) {
        this.modalMagnetUri.value = 'magnet:?xt=urn:btih:e5a1b2c3d4f60718293a4b5c6d7e8f9012345678&dn=Ubuntu+24.04+LTS';
      }
    });

    this.btnBrowseMagnetPath?.addEventListener('click', () => {
      const newPath = prompt('Choose download directory:', this.downloadDir);
      if (newPath) {
        this.downloadDir = newPath;
        if (this.modalDestPath) this.modalDestPath.textContent = this.formatDisplayPath(newPath);
      }
    });

    this.dropZoneModal?.addEventListener('click', () => this.modalFileInput?.click());
    this.btnBrowseTorrentFile?.addEventListener('click', () => this.modalFileInput?.click());
    this.modalFileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (this.selectedTorrentFileName) this.selectedTorrentFileName.textContent = file.name;
        if (this.selectedTorrentFileSize) this.selectedTorrentFileSize.textContent = `${this.formatBytes(file.size)} • SafePath verified`;
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

    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setFilter(btn.dataset.filter || 'all');
      });
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      if (e.key === 'Escape') {
        this.hideContextMenu();
        this.closeAddModal();
        this.deleteSwarmModal?.classList.add('hidden');
        this.trafficThrottleModal?.classList.add('hidden');
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

      if (isInput) return;

      const targetId = this.selectedId || (this.swarms.length > 0 ? this.swarms[0].id : null);
      if (!targetId) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.togglePauseSwarm(targetId);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        this.selectedId = targetId;
        this.switchView('inspect');
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        this.openTorrentFolder(targetId);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const selText = window.getSelection()?.toString();
        if (!selText) {
          e.preventDefault();
          this.copyTorrentMagnet(targetId);
        }
        return;
      }

      if (e.shiftKey && (e.key === 'Delete' || e.code === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        this.promptDeleteWithFiles(targetId);
        return;
      }
    });

    // Floating Context Menu Actions
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#swarmContextMenu')) {
        this.hideContextMenu();
      }
    });

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
      this.trafficThrottleModal?.classList.remove('hidden');
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

    this.menuActionCopyMagnet?.addEventListener('click', () => {
      if (this.contextSwarmId) this.copyTorrentMagnet(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionCopyInfoHash?.addEventListener('click', () => {
      if (this.contextSwarmId) this.copyTorrentInfoHash(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionRemoveSwarm?.addEventListener('click', () => {
      if (this.contextSwarmId) this.removeSwarmKeepFiles(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.menuActionDeleteFiles?.addEventListener('click', () => {
      if (this.contextSwarmId) this.promptDeleteWithFiles(this.contextSwarmId);
      this.hideContextMenu();
    });

    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    this.btnTabFiles?.addEventListener('click', () => this.switchInspectorTab('files'));
    this.btnTabSpeed?.addEventListener('click', () => this.switchInspectorTab('speed'));

    this.btnThrottle?.addEventListener('click', () => this.trafficThrottleModal?.classList.remove('hidden'));
    this.btnCloseThrottleModal?.addEventListener('click', () => this.trafficThrottleModal?.classList.add('hidden'));
    this.btnResetThrottle?.addEventListener('click', () => this.trafficThrottleModal?.classList.add('hidden'));
    this.btnApplyThrottle?.addEventListener('click', () => this.trafficThrottleModal?.classList.add('hidden'));

    this.btnCloseDeleteModal?.addEventListener('click', () => this.deleteSwarmModal?.classList.add('hidden'));
    this.btnCancelDelete?.addEventListener('click', () => this.deleteSwarmModal?.classList.add('hidden'));
    this.optKeepData?.addEventListener('click', () => {
      this.optKeepData.classList.add('active');
      this.optDeleteData.classList.remove('active');
    });
    this.optDeleteData?.addEventListener('click', () => {
      this.optDeleteData.classList.add('active');
      this.optKeepData.classList.remove('active');
    });
    this.btnConfirmDelete?.addEventListener('click', () => this.confirmDelete());

    // Network Guard Simulator Modal
    this.btnNetguardIndicator?.addEventListener('click', () => this.netguardModal?.classList.remove('hidden'));
    this.btnCloseNetguardModal?.addEventListener('click', () => this.netguardModal?.classList.add('hidden'));
    this.btnCloseNetguard?.addEventListener('click', () => this.netguardModal?.classList.add('hidden'));

    this.btnSimulateVpnDrop?.addEventListener('click', () => {
      if (this.leakTestBanner) {
        this.leakTestBanner.innerHTML = '⚠️ <strong>VPN INTERFACE DROPPED:</strong> Fail-closed killswitch triggered in 0.12s! All swarm sockets terminated. Zero packets leaked.';
        this.leakTestBanner.style.background = '#fef2f2';
        this.leakTestBanner.style.color = '#dc2626';
      }
    });

    this.btnRunLeakTest?.addEventListener('click', () => {
      if (this.leakTestBanner) {
        this.leakTestBanner.innerHTML = '✅ <strong>LEAK TEST PASSED:</strong> 0 WebRTC leaks, 0 DNS leaks. External IP matches Mullvad VPN.';
        this.leakTestBanner.style.background = '#e6f4ea';
        this.leakTestBanner.style.color = '#1e4d3e';
      }
    });
  }

  openAddModal() {
    this.addDownloadModal?.classList.remove('hidden');
    this.modalMagnetUri?.focus();
  }

  closeAddModal() {
    this.addDownloadModal?.classList.add('hidden');
    if (this.modalMagnetUri) this.modalMagnetUri.value = '';
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

  handleStartDownload() {
    const magnetVal = this.modalMagnetUri?.value.trim() || 'Ubuntu 24.10 Desktop';
    const newSwarm = {
      id: `swarm-${Date.now()}`,
      name: magnetVal.startsWith('magnet') ? 'Ubuntu 24.10 Desktop (x86_64)' : magnetVal,
      category: 'iso',
      sizeFormatted: '4.8 GB',
      sizeBytes: 5153960755,
      progressPct: 1,
      state: 'downloading',
      downSpeed: '9.2 MB/s',
      upSpeed: '420 KB/s',
      rawDownSpeed: 9200000,
      rawUpSpeed: 420000,
      eta: '8m 45s remaining',
      peers: 38,
      hash: 'f60718293a4b5c6d7e8f90123456789a1b2c3d4e',
      targetMount: this.downloadDir,
      files: [
        { name: 'ubuntu-24.10-desktop-amd64.iso', size: 5153960755, sizeFormatted: '4.8 GB', progress: 1, safepath: true }
      ]
    };

    this.swarms.unshift(newSwarm);
    this.selectedId = newSwarm.id;
    this.closeAddModal();
    this.render();
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

    this.transfersListContainer.innerHTML = '';

    if (filtered.length === 0) {
      this.transfersListContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 0; color: #9ca3af; font-size: 14px;">
          No transfers found in this view. Click "Add Torrent" to start a download.
        </div>
      `;
    } else {
      filtered.forEach(swarm => {
        const card = document.createElement('div');
        const isSelected = swarm.id === this.selectedId;
        card.className = `transfer-card ${isSelected ? 'selected' : ''}`;
        card.dataset.id = swarm.id;

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
          metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Seeding <span class="meta-bullet">•</span> Ratio ${swarm.ratio || '2.4'}`;
        } else {
          metaText = `${swarm.sizeFormatted} <span class="meta-bullet">•</span> Completed <span class="meta-bullet">•</span> Preserved locally`;
        }

        const isFinished = swarm.progressPct >= 100 || isCompleted || isSeeding;
        const actionBtnHtml = isSeeding ? `
          <button class="card-action-btn btn-completed btn-seeding" title="Seeding active">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        ` : (isCompleted ? `
          <button class="card-action-btn btn-completed btn-finished" title="Completed / Preserved">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        ` : `
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
        `);

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
            ${actionBtnHtml}
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

        const pauseBtn = card.querySelector('.btn-pause-toggle');
        pauseBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (swarm.state === 'downloading') {
            this.pauseSwarm(swarm.id);
          } else {
            this.resumeSwarm(swarm.id);
          }
        });

        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showContextMenu(e.clientX, e.clientY, swarm.id);
        });

        this.transfersListContainer.appendChild(card);
      });
    }

    this.updateInspector();
  }

  /* -------------------------------------------------------------------------
     INSPECTOR
     ------------------------------------------------------------------------- */
  updateInspector() {
    const selected = this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
    if (!selected) return;

    if (this.inspectorTargetName) this.inspectorTargetName.textContent = selected.name;
    if (this.inspectorCurrentSpeed) this.inspectorCurrentSpeed.textContent = selected.state === 'downloading' ? selected.downSpeed : (selected.state === 'seeding' ? selected.upSpeed : '0.0 MB/s');

    if (this.activeInspectorTab === 'files' && this.filesManifestList) {
      const files = selected.files && selected.files.length > 0 ? selected.files : [
        { name: selected.name, sizeFormatted: selected.sizeFormatted }
      ];
      if (this.manifestFilesCount) this.manifestFilesCount.textContent = files.length;
      if (this.manifestTotalSize) this.manifestTotalSize.textContent = selected.sizeFormatted;

      this.filesManifestList.innerHTML = files.map(f => `
        <div class="manifest-file-item">
          <div class="manifest-file-left">
            <span>📄</span>
            <span style="font-weight: 500;">${f.name}</span>
            <span style="color: #6b7280; font-size: 12px;">(${f.sizeFormatted || '942 MB'})</span>
          </div>
          <span class="manifest-badge-ok">SafePath OK</span>
        </div>
      `).join('');
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
    }
    this.updateInspector();
  }

  initChart() {
    this.drawChart();
    window.addEventListener('resize', () => this.drawChart());
  }

  drawChart() {
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

    // 4. Peak Marker Dot with Ring
    const peakIdx = points.indexOf(Math.max(...points));
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

  startTicker() {
    setInterval(() => {
      let totalDown = 0;
      let totalUp = 0;

      this.swarms.forEach(s => {
        if (s.state === 'downloading') {
          totalDown += (s.rawDownSpeed || 0);
          totalUp += (s.rawUpSpeed || 0);
        } else if (s.state === 'seeding') {
          totalUp += (s.rawUpSpeed || 0);
        }
      });

      if (totalDown === 0) totalDown = 14200000;
      if (totalUp === 0) totalUp = 2800000;

      const downMB = totalDown / (1024 * 1024);
      const upMB = totalUp / (1024 * 1024);

      if (this.sidebarSessionDown) this.sidebarSessionDown.textContent = `${downMB.toFixed(1)} MB/s`;
      if (this.sidebarSessionUp) this.sidebarSessionUp.textContent = `${upMB.toFixed(1)} MB/s`;
      if (this.mobileSpeedDown) this.mobileSpeedDown.textContent = `${downMB.toFixed(1)} MB/s`;
      if (this.mobileSpeedUp) this.mobileSpeedUp.textContent = `${upMB.toFixed(1)} MB/s`;

      this.inflowHistory.shift();
      this.inflowHistory.push(Math.max(1.0, downMB * (0.95 + Math.random() * 0.1)));

      this.outflowHistory.shift();
      this.outflowHistory.push(Math.max(0.5, upMB * (0.95 + Math.random() * 0.1)));

      this.drawChart();

      if (this.activeView === 'inspect') {
        this.drawInspectMountainWaveform();
        const selectedSwarm = this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
        if (selectedSwarm && selectedSwarm.state === 'downloading') {
          const currentInflow = (this.inflowHistory[this.inflowHistory.length - 1]).toFixed(1);
          const currentOutflow = (this.outflowHistory[this.outflowHistory.length - 1]).toFixed(1);
          if (this.inspectInflowVal) this.inspectInflowVal.textContent = `${currentInflow} MB/s`;
          if (this.inspectOutflowVal) this.inspectOutflowVal.textContent = `${currentOutflow} MB/s`;
          if (this.inspectLegendDown) this.inspectLegendDown.textContent = `${currentInflow} MB/s`;
          if (this.inspectLegendUp) this.inspectLegendUp.textContent = `${currentOutflow} MB/s`;
          if (this.waveformNowTick) this.waveformNowTick.textContent = `Now (${currentInflow} MB/s)`;
        }
      }
    }, 1000);
  }

  confirmDelete() {
    if (!this.pendingDeleteId) return;
    this.swarms = this.swarms.filter(s => s.id !== this.pendingDeleteId);
    this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
    this.deleteSwarmModal?.classList.add('hidden');
    this.render();
  }

  syncSidebarNav(filter) {
    this.navItems.forEach(n => {
      if (n.dataset.filter === filter) n.classList.add('active');
      else n.classList.remove('active');
    });
  }

  syncFilterPill(filter) {
    this.filterButtons.forEach(b => {
      if (b.dataset.filter === filter) b.classList.add('active');
      else b.classList.remove('active');
    });
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

    if (posX + menuWidth > winWidth - 10) {
      posX = Math.max(10, winWidth - menuWidth - 10);
    }
    if (posY + menuHeight > winHeight - 10) {
      posY = Math.max(10, posY - menuHeight);
    }

    this.swarmContextMenu.style.left = `${posX}px`;
    this.swarmContextMenu.style.top = `${posY}px`;

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

  pauseSwarm(id) {
    const s = this.swarms.find(item => item.id === id);
    if (s) {
      s.state = 'paused';
      this.render();
      this.showToast(`Transfer paused: ${s.name}`);
    }
  }

  resumeSwarm(id) {
    const s = this.swarms.find(item => item.id === id);
    if (s) {
      s.state = 'downloading';
      this.render();
      this.showToast(`Transfer resumed: ${s.name}`);
    }
  }

  forceStartSwarm(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.forceStarted = true;
    s.state = 'downloading';
    this.render();
    this.showToast(`Force Start engaged (bypassing queue): ${s.name}`);
  }

  openTorrentFolder(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    const dir = s.targetMount || this.downloadDir;
    const fullPath = s.name ? `${dir}\\${s.name}` : dir;
    this.showToast(`Vault Directory: ${fullPath}`);
  }

  toggleSequentialStream(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.sequential = !s.sequential;
    this.render();
    this.showToast(s.sequential ? 'Sequential Stream Active (Media ready to stream)' : 'Normal Rarest-First Stream Active');
  }

  changeTorrentVault(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    const newPath = prompt('Select new save directory:', s.targetMount || this.downloadDir);
    if (newPath) {
      s.targetMount = newPath;
      this.render();
      this.showToast(`Save Vault relocated to: ${newPath}`);
    }
  }

  setFlowPriority(id, priority) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    s.flowPriority = priority;
    const label = priority === 'high' ? 'High Priority (Top)' : (priority === 'eco' ? 'Eco / Background' : 'Normal Flow (1.0x)');
    this.showToast(`Flow priority set to ${label} for ${s.name}`);
  }

  verifyLocalChunks(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    this.showToast(`Verifying piece hash integrity for: ${s.name}`);
  }

  refreshSwarmTrackers(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
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

  removeSwarmKeepFiles(id) {
    const s = this.swarms.find(item => item.id === id);
    if (!s) return;
    this.swarms = this.swarms.filter(item => item.id !== id);
    if (this.selectedId === id) {
      this.selectedId = this.swarms.length > 0 ? this.swarms[0].id : null;
    }
    this.render();
    this.showToast(`Removed from Sanctuary (files kept on disk): ${s.name}`);
  }

  promptDeleteWithFiles(id) {
    this.pendingDeleteId = id;
    const swarm = this.swarms.find(s => s.id === id);
    if (this.deleteSwarmTitle) {
      this.deleteSwarmTitle.textContent = swarm ? `Remove & Purge "${swarm.name}"?` : 'Delete Swarm';
    }
    this.deleteSwarmModal?.classList.remove('hidden');
  }

  formatDisplayPath(fullPath) {
    const parts = (fullPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length >= 2) return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
    return fullPath;
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0.0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  detectCategory(name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('iso') || lower.includes('linux') || lower.includes('debian') || lower.includes('arch')) return 'iso';
    if (lower.includes('4k') || lower.includes('hdr') || lower.includes('nature') || lower.includes('video')) return 'video';
    if (lower.includes('photo') || lower.includes('asset') || lower.includes('zip')) return 'asset';
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

  switchView(viewName) {
    this.activeView = viewName;

    // Sidebar active item update
    this.navTransfers?.classList.toggle('active', viewName === 'transfers');
    this.navDeepInspect?.classList.toggle('active', viewName === 'inspect');
    this.navSettingsStudio?.classList.toggle('active', viewName === 'settings');

    // Mobile Bottom Nav active item update
    this.navMobileTransfers?.classList.toggle('active', viewName === 'transfers');
    this.navMobileInspect?.classList.toggle('active', viewName === 'inspect');
    this.navMobileSettings?.classList.toggle('active', viewName === 'settings');

    if (viewName === 'settings') {
      this.transfersView?.classList.add('hidden');
      this.inspectView?.classList.add('hidden');
      this.settingsView?.classList.remove('hidden');
      this.settingsSearchInput?.focus();
    } else if (viewName === 'inspect') {
      this.transfersView?.classList.add('hidden');
      this.settingsView?.classList.add('hidden');
      this.inspectView?.classList.remove('hidden');
      this.renderDeepInspect();
      this.drawInspectMountainWaveform();
    } else {
      this.inspectView?.classList.add('hidden');
      this.settingsView?.classList.add('hidden');
      this.transfersView?.classList.remove('hidden');
      this.render();
    }
  }

  /* -------------------------------------------------------------------------
     DEEP INSPECT STUDIO RENDERER
     ------------------------------------------------------------------------- */
  renderDeepInspect() {
    const swarm = this.swarms.find(s => s.id === this.selectedId) || this.swarms[0];
    if (!swarm) return;

    const isDownloading = swarm.state === 'downloading';
    const isSeeding = swarm.state === 'seeding';
    const isCompleted = swarm.state === 'completed';
    const pct = isSeeding || isCompleted ? 100 : (swarm.progressPct || 0);

    // 1. Top Bar Swarm Header
    if (this.inspectTorrentName) this.inspectTorrentName.textContent = swarm.name;
    if (this.inspectCatIcon) {
      this.inspectCatIcon.className = `inspect-cat-squircle ${this.getCategoryClass(swarm.category, swarm.name)}`;
      this.inspectCatIcon.innerHTML = this.getCategorySvg(swarm.category, swarm.name);
    }
    if (this.inspectStatusBadge) {
      if (isDownloading) {
        this.inspectStatusBadge.className = 'inspect-status-badge badge-mint';
        this.inspectStatusBadge.textContent = '● Downloading Active';
      } else if (isSeeding) {
        this.inspectStatusBadge.className = 'inspect-status-badge badge-blue';
        this.inspectStatusBadge.textContent = `● Seeding • Ratio ${swarm.ratio || '2.4'}`;
      } else if (swarm.state === 'paused') {
        this.inspectStatusBadge.className = 'inspect-status-badge badge-subtle';
        this.inspectStatusBadge.textContent = '⏸ Paused';
      } else {
        this.inspectStatusBadge.className = 'inspect-status-badge badge-subtle';
        this.inspectStatusBadge.textContent = '● Completed';
      }
    }
    if (this.inspectTorrentSub) {
      this.inspectTorrentSub.textContent = `${swarm.sizeFormatted} • ${swarm.state.toUpperCase()} • ${swarm.files ? swarm.files.length : 1} files • SafePath Confined`;
    }
    if (this.inspectPauseText) {
      this.inspectPauseText.textContent = isDownloading ? 'Pause Transfer' : (isSeeding ? 'Pause Seeding' : 'Resume Transfer');
    }

    // 2. Swarm Overview Grid
    if (this.inspectActivePeers) {
      this.inspectActivePeers.textContent = `${swarm.peers || 142} (${swarm.seedingPeers || 48} Seeding)`;
    }
    if (this.inspectInflowVal) {
      this.inspectInflowVal.textContent = isDownloading ? (swarm.downSpeed || '8.4 MB/s') : '0.0 KB/s';
    }
    if (this.inspectInflowPeak) {
      this.inspectInflowPeak.textContent = `↓ Peak ${swarm.peakSpeed || '11.2 MB/s'}`;
    }
    if (this.inspectOutflowVal) {
      this.inspectOutflowVal.textContent = swarm.upSpeed || '1.2 MB/s';
    }
    if (this.inspectShareRatio) {
      this.inspectShareRatio.textContent = `↑ Share ratio ${swarm.ratio || '0.42'}`;
    }

    // 3. Connected Peers List
    if (this.inspectPeersList) {
      const peers = swarm.peerNodes && swarm.peerNodes.length > 0 ? swarm.peerNodes : [
        { cc: 'DE', city: 'Frankfurt, Germany', client: 'Haven Node 2.4', type: 'Direct Peer', latency: '19ms', security: 'TLS 1.3', rate: '2.4 MB/s' },
        { cc: 'SE', city: 'Stockholm, Sweden', client: 'Libtorrent 1.28', type: 'Alpine Mesh Relay', latency: '28ms', security: 'TLS 1.3', rate: '1.9 MB/s' },
        { cc: 'US', city: 'Seattle, WA', client: 'Transmission 4.0', type: 'DHT Lookup', latency: '72ms', security: 'TLS 1.3', rate: '1.6 MB/s' },
        { cc: 'JP', city: 'Tokyo, Japan', client: 'Haven Node 2.2', type: 'Seeding Node', latency: '114ms', security: 'TLS 1.3', rate: '1.1 MB/s' }
      ];

      this.inspectPeersList.innerHTML = peers.map(p => `
        <div class="peer-node-row">
          <div class="peer-node-left">
            <div class="peer-flag-squircle">${this.escapeHtml(p.cc || 'P2P')}</div>
            <div class="peer-info-col">
              <span class="peer-location-title">${this.escapeHtml(p.city || 'BitTorrent Peer')} • <span style="font-weight: 500; opacity: 0.8;">${this.escapeHtml(p.client || 'Haven Node')}</span></span>
              <span class="peer-meta-desc">${this.escapeHtml(p.type || 'Direct Peer')} • Ping ${this.escapeHtml(p.latency || '< 30ms')}</span>
            </div>
          </div>
          <div class="peer-node-right">
            <span class="peer-tls-tag">🛡️ ${this.escapeHtml(p.security || 'TLS 1.3')}</span>
            <span class="peer-speed-badge">⚡ ${this.escapeHtml(p.rate || '1.8 MB/s')}</span>
          </div>
        </div>
      `).join('');
    }

    // 4. Trackers List
    if (this.inspectTrackersList) {
      const trackers = swarm.trackers && swarm.trackers.length > 0 ? swarm.trackers : [
        { host: 'tracker.archlinux.org:6969', latency: '< 28ms', status: 'OK • 92 seeds, 34 leechers', resync: 'Re-sync in 14m' },
        { host: 'torrent.swarms.is:443', latency: '< 32ms', status: 'OK • 31 seeds, 18 leechers', resync: 'Re-sync in 8m' },
        { host: 'Mainline DHT Routing Table', latency: '< 14ms', status: 'Nodes known: 1,482 • Bucket health 100%', resync: 'Continual auto-refresh' }
      ];

      if (this.inspectTrackersCount) {
        this.inspectTrackersCount.textContent = `${trackers.length} Connected`;
      }

      this.inspectTrackersList.innerHTML = trackers.map(t => `
        <div class="tracker-row">
          <div class="tracker-left-col">
            <span class="tracker-url-title">${this.escapeHtml(t.host)}</span>
            <span class="tracker-status-sub">${this.escapeHtml(t.status)}</span>
          </div>
          <div class="tracker-right-col">
            <span class="tracker-latency-pill">${this.escapeHtml(t.latency)}</span>
            <span class="tracker-resync-text">${this.escapeHtml(t.resync)}</span>
          </div>
        </div>
      `).join('');
    }

    // 5. Piece Matrix Grid
    if (this.pieceMatrixGrid) {
      const totalPills = 96;
      const verifiedCount = Math.round(totalPills * (pct / 100));
      const inflightCount = isDownloading ? Math.min(4, totalPills - verifiedCount) : 0;

      if (this.countVerifiedPieces) this.countVerifiedPieces.textContent = Math.round((swarm.totalChunks || 471) * (pct / 100));
      if (this.countInflightPieces) this.countInflightPieces.textContent = inflightCount > 0 ? 14 : 0;
      if (this.countPendingPieces) this.countPendingPieces.textContent = Math.max(0, (swarm.totalChunks || 471) - Math.round((swarm.totalChunks || 471) * (pct / 100)) - (inflightCount > 0 ? 14 : 0));

      if (this.inspectPieceStatsText) {
        this.inspectPieceStatsText.textContent = `${Math.round((swarm.totalChunks || 471) * (pct / 100))} of ${swarm.totalChunks || 471} chunks verified (${pct}%) • Chunk size: 3.0 MB`;
      }

      let pillsHtml = '';
      for (let i = 0; i < totalPills; i++) {
        let pillClass = 'chunk-pending';
        let stateLabel = 'Pending';
        if (i < verifiedCount) {
          pillClass = 'chunk-verified';
          stateLabel = 'Verified SHA-256 chunk';
        } else if (i < verifiedCount + inflightCount) {
          pillClass = 'chunk-inflight';
          stateLabel = 'In-flight wire transfer';
        }
        pillsHtml += `<div class="piece-chunk-pill ${pillClass}" title="Chunk #${i + 1} • ${stateLabel}"></div>`;
      }
      this.pieceMatrixGrid.innerHTML = pillsHtml;
    }

    // 6. File Manifest & Content Plan
    if (this.inspectManifestList) {
      const files = swarm.files && swarm.files.length > 0 ? swarm.files : [
        { name: swarm.name, sizeFormatted: swarm.sizeFormatted, progress: pct, priority: 'high' }
      ];

      if (this.inspectFilesHeaderCount) {
        this.inspectFilesHeaderCount.textContent = `${files.length} items • ${swarm.sizeFormatted}`;
      }

      this.inspectManifestList.innerHTML = files.map((file, idx) => {
        const filePct = file.progress !== undefined ? file.progress : pct;
        const isHigh = file.priority === 'high';
        return `
          <div class="manifest-file-card">
            <div class="manifest-file-left">
              <div class="manifest-file-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              </div>
              <div class="manifest-file-meta">
                <span class="manifest-file-name" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</span>
                <span class="manifest-file-sub">${file.sizeFormatted || '1.38 GB'} • ${filePct}% verified</span>
              </div>
            </div>
            <div class="manifest-file-center-bar" title="${filePct}% completed">
              <div style="height: 100%; width: ${filePct}%; background-color: var(--pine-primary); border-radius: 3px;"></div>
            </div>
            <button class="manifest-prio-btn ${isHigh ? 'prio-high' : 'prio-normal'}" data-file-index="${idx}" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-card); cursor: pointer;">
              ${isHigh ? '⚡ High Priority' : 'Normal'}
            </button>
          </div>
        `;
      }).join('');

      this.inspectManifestList.querySelectorAll('.manifest-prio-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const fIdx = parseInt(btn.dataset.fileIndex, 10);
          if (files[fIdx]) {
            files[fIdx].priority = files[fIdx].priority === 'high' ? 'normal' : 'high';
            this.renderDeepInspect();
            this.showToast(`Set priority: ${files[fIdx].name} → ${files[fIdx].priority === 'high' ? 'High' : 'Normal'}`);
          }
        });
      });
    }

    // 7. Mountain Waveform
    this.drawInspectMountainWaveform();
  }

  /* -------------------------------------------------------------------------
     MOUNTAIN WAVEFORM SPLINE RENDERER
     ------------------------------------------------------------------------- */
  drawInspectMountainWaveform() {
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

    const points = this.inflowHistory;
    const outflowPoints = this.outflowHistory;
    const maxVal = Math.max(12.0, ...points, ...outflowPoints);
    const stepX = width / (points.length - 1);
    const paddingBottom = 20;
    const chartHeight = height - paddingBottom - 12;

    const getY = (val) => height - paddingBottom - (val / maxVal) * chartHeight;

    // 1. Inflow Gradient Mountain Fill
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
    gradient.addColorStop(0, 'rgba(35, 79, 62, 0.28)');
    gradient.addColorStop(1, 'rgba(35, 79, 62, 0.01)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 2. Inflow Solid Mountain Line
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

    // 3. Outflow Dashed Line
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
    this.btnChangeVaultDir?.addEventListener('click', () => {
      const input = prompt('Enter new storage vault path:', this.settingsVaultPath?.value || this.downloadDir);
      if (input && input.trim()) {
        this.setVaultDirectory(input.trim());
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
      const randPort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
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
    this.btnClearCache?.addEventListener('click', () => {
      if (this.btnClearCache) {
        this.btnClearCache.textContent = 'Cache Cleared (0 KB)';
      }
      this.showToast('✓ InfoHash cache cleared successfully (42.1 MB freed).');
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
  }

  saveSanctuaryPreferences() {
    const config = this.collectSanctuarySettings();
    localStorage.setItem('haven_sanctuary_settings', JSON.stringify(config));
    localStorage.setItem('haven_download_dir', config.vault);
    localStorage.setItem('haven_theme', config.theme);
    localStorage.setItem('haven_density', config.density);
    this.showToast('✓ Sanctuary preferences saved & applied across engine.');
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

  loadSavedSettings() {
    let saved = null;
    try {
      const raw = localStorage.getItem('haven_sanctuary_settings');
      if (raw) saved = JSON.parse(raw);
    } catch (_) {}

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
}

window.addEventListener('DOMContentLoaded', () => {
  window.havenExperience = new HavenExperienceApp();
});
