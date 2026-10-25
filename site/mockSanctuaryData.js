/**
 * HAVEN // DEVELOPER SANDBOX MOCK DATA MODULE
 * Isolated mock transfers, simulated peer networks, and synthetic speed waveforms.
 * Strictly decoupled from production runtime state.
 * Conforms to docs/PLAN.md (Zero-Tracking, MPL-2.0)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MockSanctuaryData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const MOCK_SWARMS = [
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
      isMock: true,
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
      isMock: true,
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
      isMock: true,
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
      isMock: true,
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

  const MOCK_SPEED_HISTORY = {
    inflow: [
      2.1, 2.3, 2.5, 2.7, 3.0, 3.2, 3.5, 3.8, 4.2, 4.6,
      4.9, 5.1, 5.3, 5.5, 5.8, 6.0, 5.9, 5.7, 5.4, 5.0,
      4.5, 4.2, 3.8, 3.5, 3.6, 3.9, 4.3, 4.8, 5.5, 6.2,
      7.0, 7.5, 7.8, 8.1, 8.3, 8.4, 8.2, 8.0, 7.8, 7.7,
      7.6, 7.6, 7.7, 7.9, 8.0, 8.1, 8.0, 7.8, 7.7, 7.6,
      7.5, 7.6, 7.7, 7.8, 7.9, 8.0, 7.9, 7.8, 7.7, 7.6
    ],
    outflow: [
      0.8, 0.8, 0.9, 0.9, 1.0, 1.0, 1.1, 1.1, 1.2, 1.2,
      1.1, 1.1, 1.0, 1.0, 0.9, 0.9, 0.9, 1.0, 1.0, 1.1,
      1.1, 1.2, 1.2, 1.1, 1.1, 1.0, 1.0, 1.1, 1.1, 1.2,
      1.2, 1.3, 1.3, 1.4, 1.4, 1.3, 1.3, 1.2, 1.2, 1.2,
      1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2,
      1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2
    ]
  };

  const MOCK_PEER_NODES = [
    { cc: 'DE', city: 'Frankfurt, Germany', client: 'Haven Node 2.4', type: 'Direct Peer', latency: '19ms', security: 'TLS 1.3', rate: '2.8 MB/s' },
    { cc: 'JP', city: 'Tokyo, Japan', client: 'libtorrent 1.28', type: 'Alpine Mesh Relay', latency: '114ms', security: 'TLS 1.3', rate: '3.8 MB/s' },
    { cc: 'US', city: 'Seattle, WA', client: 'Transmission 4.0', type: 'DHT Lookup', latency: '72ms', security: 'TLS 1.3', rate: '1.4 MB/s' },
    { cc: 'SE', city: 'Stockholm, Sweden', client: 'Haven Core 2.2', type: 'Seeding Node', latency: '28ms', security: 'TLS 1.3', rate: '3.1 MB/s' }
  ];

  /**
   * Generates realistic fluctuating sine-wave throughput for UI benchmarking.
   * @param {number} tick - monotonic tick counter
   * @returns {{ downMB: number, upMB: number, rawDown: number, rawUp: number }}
   */
  function generateSimulatedThroughput(tick) {
    const t = tick || 0;
    const baseDown = 7.6 + Math.sin(t * 0.14) * 2.1 + Math.cos(t * 0.05) * 1.2;
    const noiseDown = (Math.random() * 0.6) - 0.3;
    const downMB = Math.max(0.4, Number((baseDown + noiseDown).toFixed(2)));

    const baseUp = 1.6 + Math.cos(t * 0.11) * 0.7;
    const noiseUp = (Math.random() * 0.25) - 0.12;
    const upMB = Math.max(0.1, Number((baseUp + noiseUp).toFixed(2)));

    return {
      downMB,
      upMB,
      rawDown: Math.round(downMB * 1024 * 1024),
      rawUp: Math.round(upMB * 1024 * 1024)
    };
  }

  return {
    MOCK_SWARMS,
    MOCK_SPEED_HISTORY,
    MOCK_PEER_NODES,
    generateSimulatedThroughput
  };
});
