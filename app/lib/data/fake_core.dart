import 'dart:async';

enum TorrentState {
  addedPending,
  metadataFetch,
  awaitingConfirm,
  allocating,
  checking,
  downloading,
  paused,
  completing,
  seeding,
  stopped,
  rejected,
  timedOut,
  cancelled,
  diskError,
  suspect,
}

enum NetworkGuardState {
  standby,
  waitingForIface,
  guardedOk,
  blocked,
  override,
}

class FakeTorrentFile {
  final int index;
  final String name;
  final int sizeBytes;
  final bool isRisky;
  bool selected;
  double progress;

  FakeTorrentFile({
    required this.index,
    required this.name,
    required this.sizeBytes,
    required this.isRisky,
    this.selected = true,
    this.progress = 0.0,
  });
}

class FakeTorrent {
  final String id;
  final String name;
  final String infoHash;
  final int totalBytes;
  int completedBytes;
  double progress;
  int downloadSpeedBps;
  int uploadSpeedBps;
  int etaSeconds;
  int peers;
  int seeds;
  double ratio;
  TorrentState state;
  final List<FakeTorrentFile> files;

  FakeTorrent({
    required this.id,
    required this.name,
    required this.infoHash,
    required this.totalBytes,
    this.completedBytes = 0,
    this.progress = 0.0,
    this.downloadSpeedBps = 0,
    this.uploadSpeedBps = 0,
    this.etaSeconds = 0,
    this.peers = 0,
    this.seeds = 0,
    this.ratio = 0.0,
    this.state = TorrentState.paused,
    required this.files,
  });
}

/// In-memory Fake Core server adhering to Section 25.4 for UI development and testing.
class FakeCoreServer {
  final List<FakeTorrent> _torrents = [];
  NetworkGuardState _netguardState = NetworkGuardState.guardedOk;
  Timer? _ticker;
  final StreamController<List<FakeTorrent>> _torrentStreamController =
      StreamController<List<FakeTorrent>>.broadcast();

  FakeCoreServer() {
    _initSampleData();
    _startSimulationTicker();
  }

  NetworkGuardState get netguardState => _netguardState;
  List<FakeTorrent> get torrents => List.unmodifiable(_torrents);
  Stream<List<FakeTorrent>> get torrentStream => _torrentStreamController.stream;

  void _initSampleData() {
    _torrents.addAll([
      FakeTorrent(
        id: 't-001',
        name: 'ubuntu-24.04-desktop-amd64.iso',
        infoHash: '5a4b3c2d1e0f8a7b6c5d4e3f2a1b0c9d8e7f6a5b',
        totalBytes: 5976883200, // 5.56 GiB
        completedBytes: 3586129920,
        progress: 0.60,
        downloadSpeedBps: 18450000, // ~18.4 MB/s
        uploadSpeedBps: 2100000,
        etaSeconds: 130,
        peers: 42,
        seeds: 180,
        ratio: 0.35,
        state: TorrentState.downloading,
        files: [
          FakeTorrentFile(
            index: 0,
            name: 'ubuntu-24.04-desktop-amd64.iso',
            sizeBytes: 5976883200,
            isRisky: true, // .iso is flagged as risky (INV-05)
            progress: 0.60,
          ),
        ],
      ),
      FakeTorrent(
        id: 't-002',
        name: 'Debian 12 NetInst (x86_64)',
        infoHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
        totalBytes: 654311424,
        completedBytes: 654311424,
        progress: 1.0,
        downloadSpeedBps: 0,
        uploadSpeedBps: 4500000,
        etaSeconds: 0,
        peers: 15,
        seeds: 85,
        ratio: 2.14,
        state: TorrentState.seeding,
        files: [
          FakeTorrentFile(
            index: 0,
            name: 'debian-12.0.0-amd64-netinst.iso',
            sizeBytes: 654311424,
            isRisky: true,
            progress: 1.0,
          ),
        ],
      ),
      FakeTorrent(
        id: 't-003',
        name: 'Arch Linux 2026.10-x86_64.iso',
        infoHash: '1f2e3d4c5b6a708192a3b4c5d6e7f8a9b0c1d2e3',
        totalBytes: 1120000000,
        completedBytes: 250000000,
        progress: 0.22,
        downloadSpeedBps: 0,
        uploadSpeedBps: 0,
        etaSeconds: 0,
        peers: 0,
        seeds: 0,
        ratio: 0.05,
        state: TorrentState.paused,
        files: [
          FakeTorrentFile(
            index: 0,
            name: 'archlinux-2026.10.iso',
            sizeBytes: 1120000000,
            isRisky: true,
            progress: 0.22,
          ),
        ],
      ),
    ]);
  }

  void _startSimulationTicker() {
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_netguardState == NetworkGuardState.blocked) {
        // When Network Guard blocks, all transfer speeds zero out immediately (INV-02)
        for (final t in _torrents) {
          t.downloadSpeedBps = 0;
          t.uploadSpeedBps = 0;
        }
      } else {
        for (final t in _torrents) {
          if (t.state == TorrentState.downloading) {
            t.completedBytes += t.downloadSpeedBps;
            if (t.completedBytes >= t.totalBytes) {
              t.completedBytes = t.totalBytes;
              t.progress = 1.0;
              t.state = TorrentState.seeding;
              t.downloadSpeedBps = 0;
            } else {
              t.progress = t.completedBytes / t.totalBytes;
              final remaining = t.totalBytes - t.completedBytes;
              t.etaSeconds = (remaining / t.downloadSpeedBps).round();
            }
          }
        }
      }
      _torrentStreamController.add(List.unmodifiable(_torrents));
    });
  }

  // Control Actions
  void pauseTorrent(String id) {
    final t = _torrents.firstWhere((item) => item.id == id);
    t.state = TorrentState.paused;
    t.downloadSpeedBps = 0;
    t.uploadSpeedBps = 0;
    _torrentStreamController.add(List.unmodifiable(_torrents));
  }

  void resumeTorrent(String id) {
    final t = _torrents.firstWhere((item) => item.id == id);
    if (t.progress >= 1.0) {
      t.state = TorrentState.seeding;
      t.uploadSpeedBps = 3500000;
    } else {
      t.state = TorrentState.downloading;
      t.downloadSpeedBps = 15000000;
    }
    _torrentStreamController.add(List.unmodifiable(_torrents));
  }

  void toggleNetworkGuardDrop(bool simulateVpnDrop) {
    _netguardState = simulateVpnDrop ? NetworkGuardState.blocked : NetworkGuardState.guardedOk;
    _torrentStreamController.add(List.unmodifiable(_torrents));
  }

  void dispose() {
    _ticker?.cancel();
    _torrentStreamController.close();
  }
}
