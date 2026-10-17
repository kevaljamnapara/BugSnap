#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve(new URL('.', import.meta.url).pathname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const RELEASE_DIR = join(ROOT_DIR, 'release');

console.log('📦 BugSnap Release Packaging Script');
console.log('------------------------------------');

// 1. Read manifest to determine version and name
const manifestPath = join(ROOT_DIR, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('❌ Root manifest.json not found');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '0.1.0';
const name = (manifest.name || 'bugsnap').toLowerCase().replace(/\s+/g, '-');
const zipFilename = `${name}-v${version}.zip`;
const zipPath = join(RELEASE_DIR, zipFilename);

console.log(`Target: ${zipFilename} (v${version})`);

// 2. Clean previous build and release artifacts
console.log('\n🧹 Cleaning previous dist/ and old package...');
rmSync(DIST_DIR, { recursive: true, force: true });
if (!existsSync(RELEASE_DIR)) {
  mkdirSync(RELEASE_DIR, { recursive: true });
}
if (existsSync(zipPath)) {
  rmSync(zipPath, { force: true });
}

// 3. Run production build
console.log('⚙️  Running production build (tsc --noEmit && vite build)...');
try {
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
} catch {
  console.error('❌ Build failed. Aborting packaging.');
  process.exit(1);
}

// 4. Verify dist and manifest
const distManifestPath = join(DIST_DIR, 'manifest.json');
if (!existsSync(distManifestPath)) {
  console.error('❌ dist/manifest.json not found after build.');
  process.exit(1);
}

const distManifest = JSON.parse(readFileSync(distManifestPath, 'utf8'));
if (distManifest.manifest_version !== 3) {
  console.error(`❌ Expected manifest_version 3, got: ${distManifest.manifest_version}`);
  process.exit(1);
}

// 5. Verify essential entry points and icons exist in dist/
const requiredFiles = [
  distManifest.background?.service_worker,
  distManifest.action?.default_popup,
  'editor.html',
  ...Object.values(distManifest.icons || {}),
].filter(Boolean);

for (const relPath of requiredFiles) {
  const fullPath = join(DIST_DIR, relPath);
  if (!existsSync(fullPath)) {
    console.error(`❌ Required asset missing in dist/: ${relPath}`);
    process.exit(1);
  }
}
console.log(`✅ All ${requiredFiles.length} manifest entry points and icons verified in dist/.`);

// 6. Create clean release ZIP from dist/
console.log('\n🗜️  Creating release ZIP archive...');
try {
  // Zip from within dist/ so manifest.json is at the root of the ZIP
  execSync(`cd "${DIST_DIR}" && zip -r -q -X "${zipPath}" .`, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Failed to create zip file:', err);
  process.exit(1);
}

// 7. Verify ZIP integrity and structure
console.log('🔍 Verifying ZIP archive integrity...');
try {
  const zipListing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf8' });
  if (!zipListing.includes('manifest.json')) {
    console.error('❌ manifest.json is not in the root of the ZIP archive!');
    process.exit(1);
  }
  execSync(`unzip -t -q "${zipPath}"`, { stdio: 'inherit' });
  console.log('✅ Archive integrity check passed.');
} catch (err) {
  console.error('❌ Archive integrity test failed:', err);
  process.exit(1);
}

// 8. Stats
const stats = statSync(zipPath);
const sizeKb = (stats.size / 1024).toFixed(1);
console.log('\n====================================');
console.log(`🎉 Package successfully created:`);
console.log(`   Path: ${zipPath}`);
console.log(`   Size: ${sizeKb} KB`);
console.log('====================================\n');
