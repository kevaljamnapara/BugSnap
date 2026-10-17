import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Chrome Web Store Release Manifest Audit', () => {
  const rootDir = resolve(__dirname, '../..');
  const manifestPath = resolve(rootDir, 'manifest.json');

  it('has a valid manifest.json with manifest_version 3', () => {
    expect(existsSync(manifestPath)).toBe(true);
    const content = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(content.manifest_version).toBe(3);
    expect(content.name).toBe('BugSnap');
    expect(typeof content.version).toBe('string');
    expect(content.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has a description within Chrome Web Store 132-character limit', () => {
    const content = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(content.description).toBeDefined();
    expect(content.description.length).toBeGreaterThan(0);
    expect(content.description.length).toBeLessThanOrEqual(132);
  });

  it('requests only approved, necessary permissions', () => {
    const content = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const approvedPermissions = ['activeTab', 'storage', 'scripting'];

    expect(content.permissions).toEqual(expect.arrayContaining(approvedPermissions));
    expect(content.permissions.length).toBe(approvedPermissions.length);
    expect(content.host_permissions).toBeUndefined();
    expect(content.optional_permissions).toBeUndefined();
  });

  it('references existing icons for all required sizes (16, 32, 48, 128)', () => {
    const content = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const requiredSizes = ['16', '32', '48', '128'];

    for (const size of requiredSizes) {
      expect(content.icons?.[size]).toBeDefined();
      const iconPath = resolve(rootDir, 'public', content.icons[size]);
      expect(existsSync(iconPath)).toBe(true);

      expect(content.action?.default_icon?.[size]).toBeDefined();
    }
  });

  it('has valid entry points without dev-only configuration', () => {
    const content = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(content.action?.default_popup).toBe('popup.html');
    expect(existsSync(resolve(rootDir, 'popup.html'))).toBe(true);
    expect(existsSync(resolve(rootDir, 'editor.html'))).toBe(true);

    expect(content.background?.service_worker).toBe('src/background/index.ts');
    expect(existsSync(resolve(rootDir, 'src/background/index.ts'))).toBe(true);
  });
});
