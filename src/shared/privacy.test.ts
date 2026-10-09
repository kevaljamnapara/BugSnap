import { describe, it, expect } from 'vitest';
import manifest from '../../manifest.json';

describe('Privacy and Permissions Invariants — Phase 5 Audit', () => {
  it('enforces manifest_version 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('restricts manifest permissions strictly to activeTab, storage, and scripting', () => {
    expect(manifest.permissions).toEqual(['activeTab', 'storage', 'scripting']);
  });

  it('does not request Chrome downloads permission (uses browser-native Blob downloads)', () => {
    expect(manifest.permissions).not.toContain('downloads');
  });

  it('does not request intrusive permissions (cookies, webRequest, tabs, nativeMessaging)', () => {
    const intrusivePermissions = [
      'cookies',
      'webRequest',
      'tabs',
      'nativeMessaging',
      'management',
      'privacy',
      'proxy',
      'history',
    ];
    intrusivePermissions.forEach((perm) => {
      expect(manifest.permissions).not.toContain(perm);
    });
  });

  it('does not define host permissions or remote origins', () => {
    expect((manifest as Record<string, unknown>).host_permissions).toBeUndefined();
    expect((manifest as Record<string, unknown>).optional_host_permissions).toBeUndefined();
  });

  it('does not include external content scripts or external script sources', () => {
    expect((manifest as Record<string, unknown>).content_scripts).toBeUndefined();
  });
});
