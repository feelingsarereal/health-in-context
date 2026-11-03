/** K13: semantic versions — the core pins the pack exactly, the app pins both, and every release is in its CHANGELOG. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const json = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const core = json('packages/sdoh-loops-core/package.json');
const pack = json('packages/sdoh-loops-pack/package.json');
const pin = json('packages/sdoh-loops-pack/pin.json');
const app = json('package.json');
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const section = (file: string, v: string) => {
  const md = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const at = md.indexOf(`## [${v}]`);
  if (at < 0) return null;
  const end = md.indexOf('\n## [', at + 1);
  return md.slice(at, end < 0 ? undefined : end);
};

describe('versions', () => {
  it('both packages carry a semantic version', () => {
    expect(core.version).toMatch(SEMVER);
    expect(pack.version).toMatch(SEMVER);
  });
  it('the core pins the pack exactly, and the app pins both', () => {
    expect(core.peerDependencies['@feelingsarereal/sdoh-loops-pack']).toBe(pack.version);
    expect(app.dependencies['@feelingsarereal/sdoh-loops-core']).toBe(core.version);
    expect(app.dependencies['@feelingsarereal/sdoh-loops-pack']).toBe(pack.version);
  });
  it('both packages publish to GitHub Packages under the feelingsarereal scope', () => {
    for (const p of [core, pack]) {
      expect(p.name.startsWith('@feelingsarereal/')).toBe(true);
      expect(p.publishConfig).toEqual({ registry: 'https://npm.pkg.github.com' });
      expect(p.repository.url).toBe('git+https://github.com/feelingsarereal/sdoh-loops.git');
    }
    expect(app.private).toBe(true);
  });
  it('pin.json names the pack version', () => {
    expect(pin).toMatchObject({ pack: 'sdoh-loops', version: pack.version });
    expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('each current version has a CHANGELOG entry, and the core names the pack it was tested with', () => {
    expect(section('packages/sdoh-loops-core/CHANGELOG.md', core.version)).toContain(`Pack: \`${pack.version}\``);
    expect(section('packages/sdoh-loops-pack/CHANGELOG.md', pack.version)).not.toBeNull();
  });
  it('the built pack data is the release in the CHANGELOG — a data change needs a new pack version', () => {
    expect(section('packages/sdoh-loops-pack/CHANGELOG.md', pack.version), 'bump the pack version and record the new sha256').toContain(pin.sha256);
  });
});
