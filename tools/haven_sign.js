#!/usr/bin/env node
/**
 * haven-sign: Offline Ed25519 Signing Tool for Haven Update Manifests
 * 
 * Enforces Section 22 and Section 39.2:
 * - Generates cryptographically secure Ed25519 keypairs via Node.js crypto CSPRNG.
 * - Computes deterministic canonical byte sequences for signing.
 * - Offline operation only: private key never leaves the maintainer's machine.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function printUsage() {
  console.log(`
haven-sign: Offline Ed25519 Signing Tool for Haven Update Manifests

Usage:
  node tools/haven_sign.js keygen --out-private <path> --out-public <path>
  node tools/haven_sign.js sign <manifest.json> --key <private_key_path> [--key-id <id>]
  node tools/haven_sign.js verify <manifest.json> --key <public_key_path_or_hex>

Commands:
  keygen    Generate a new Ed25519 keypair using OS CSPRNG.
  sign      Sign a manifest.json with an offline private key.
  verify    Verify a manifest.json against an Ed25519 public key.
`);
}

function canonicalizePayload(manifest) {
  let out = 'haven-manifest-v1\n';
  out += `app_id=${manifest.app_id}\n`;
  out += `channel=${manifest.channel}\n`;
  out += `version=${manifest.version}\n`;
  out += `min_supported_version=${manifest.min_supported_version}\n`;
  out += `published_at=${manifest.published_at}\n`;
  out += `valid_until=${manifest.valid_until}\n`;
  out += `release_notes_url=${manifest.release_notes_url}\n`;

  // Deterministically sort asset keys
  const assetKeys = Object.keys(manifest.assets || {}).sort();
  for (const target of assetKeys) {
    const asset = manifest.assets[target];
    out += `asset:${target}=${asset.filename}:${(asset.sha256 || '').toLowerCase()}:${asset.size_bytes}\n`;
  }

  return Buffer.from(out, 'utf8');
}

function handleKeygen(args) {
  let outPrivate = 'haven_root.priv';
  let outPublic = 'haven_root.pub';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out-private' && args[i + 1]) {
      outPrivate = args[i + 1];
      i++;
    } else if (args[i] === '--out-public' && args[i + 1]) {
      outPublic = args[i + 1];
      i++;
    }
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  // Export raw 32-byte keys from PKCS#8 / SPKI
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });

  // In PKCS#8 Ed25519, the 32-byte raw private seed is at the end (bytes 16..48)
  const rawPriv = privDer.subarray(privDer.length - 32);
  // In SPKI Ed25519, the 32-byte raw public key is the last 32 bytes
  const rawPub = pubDer.subarray(pubDer.length - 32);

  const privHex = rawPriv.toString('hex');
  const pubHex = rawPub.toString('hex');

  fs.writeFileSync(outPrivate, privHex + '\n', { mode: 0o600 });
  fs.writeFileSync(outPublic, pubHex + '\n');

  console.log('=======================================================');
  console.log('  Ed25519 Signing Keypair Generated Successfully!      ');
  console.log('=======================================================');
  console.log(`  Private Key: ${outPrivate} (Stored with 0600 permissions)`);
  console.log(`  Public Key:  ${outPublic}`);
  console.log(`  Public Key Hex: ${pubHex}`);
  console.log('');
  console.log('  [CRITICAL SECURITY NOTICE]');
  console.log('  Store the private key on an encrypted USB drive or');
  console.log('  in your password manager. NEVER commit it to git, and');
  console.log('  NEVER paste it into Antigravity or any chat.');
  console.log('  Only the public key goes in the repository.');
  console.log('=======================================================');
}

function handleSign(args) {
  if (args.length === 0) {
    console.error('Error: manifest.json path required');
    process.exit(1);
  }
  const manifestPath = args[0];
  let keyPath = null;
  let keyId = 'primary_root_2026';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--key' && args[i + 1]) {
      keyPath = args[i + 1];
      i++;
    } else if (args[i] === '--key-id' && args[i + 1]) {
      keyId = args[i + 1];
      i++;
    }
  }

  if (!keyPath) {
    console.error('Error: --key <path> required');
    process.exit(1);
  }

  const privHex = fs.readFileSync(keyPath, 'utf8').trim();
  const rawPriv = Buffer.from(privHex, 'hex');
  if (rawPriv.length !== 32) {
    console.error('Error: Private key must be 32 bytes (64 hex characters)');
    process.exit(1);
  }

  // Construct PKCS#8 DER header for Ed25519
  const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8Der = Buffer.concat([pkcs8Header, rawPriv]);
  const privateKey = crypto.createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' });
  const publicKey = crypto.createPublicKey(privateKey);
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  const rawPub = pubDer.subarray(pubDer.length - 32);
  const pubHex = rawPub.toString('hex');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const canonicalBytes = canonicalizePayload(manifest);
  const signature = crypto.sign(null, canonicalBytes, privateKey);
  const sigHex = signature.toString('hex');

  if (!manifest.signatures) {
    manifest.signatures = [];
  }
  // Replace or add signature
  manifest.signatures = manifest.signatures.filter((s) => s.key_id !== keyId);
  manifest.signatures.push({
    key_id: keyId,
    public_key: pubHex,
    signature: sigHex,
  });

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[SUCCESS] Manifest signed: ${manifestPath}`);
  console.log(`  Key ID:    ${keyId}`);
  console.log(`  Signature: ${sigHex}`);
}

function handleVerify(args) {
  if (args.length === 0) {
    console.error('Error: manifest.json path required');
    process.exit(1);
  }
  const manifestPath = args[0];
  let keyArg = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--key' && args[i + 1]) {
      keyArg = args[i + 1];
      i++;
    }
  }

  if (!keyArg) {
    console.error('Error: --key <path_or_hex> required');
    process.exit(1);
  }

  let pubHex = keyArg.trim();
  if (fs.existsSync(keyArg)) {
    pubHex = fs.readFileSync(keyArg, 'utf8').trim();
  }

  const rawPub = Buffer.from(pubHex, 'hex');
  if (rawPub.length !== 32) {
    console.error('Error: Public key must be 32 bytes (64 hex characters)');
    process.exit(1);
  }

  const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
  const spkiDer = Buffer.concat([spkiHeader, rawPub]);
  const publicKey = crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const canonicalBytes = canonicalizePayload(manifest);

  let verified = false;
  for (const s of manifest.signatures || []) {
    try {
      const sigBuf = Buffer.from(s.signature, 'hex');
      if (crypto.verify(null, canonicalBytes, publicKey, sigBuf)) {
        console.log(`[PASS] Valid signature verified for key_id: ${s.key_id}`);
        verified = true;
        break;
      }
    } catch (err) {
      // Signature check failed
    }
  }

  if (verified) {
    console.log('[SUCCESS] Manifest authenticity and integrity confirmed.');
  } else {
    console.error('[FAIL] No signature in manifest matches the provided public key!');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  printUsage();
  process.exit(1);
}

switch (args[0]) {
  case 'keygen':
    handleKeygen(args.slice(1));
    break;
  case 'sign':
    handleSign(args.slice(1));
    break;
  case 'verify':
    handleVerify(args.slice(1));
    break;
  default:
    console.error('Unknown command: ' + args[0]);
    printUsage();
    process.exit(1);
}
