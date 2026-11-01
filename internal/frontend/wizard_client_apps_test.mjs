import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('www/js/wizards.js', import.meta.url), 'utf8');
const { wizardMethods: wizard } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const UA = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  macos: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

function withUserAgent(userAgent, fn) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent }, configurable: true });
  try {
    return fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
}

function context(protocol) {
  return { ...wizard, wizardVPN: { protocol } };
}

test('detects the client OS from the user agent', () => {
  for (const [os, ua] of Object.entries(UA)) {
    assert.equal(withUserAgent(ua, () => wizard.wizardClientOS()), os, ua);
  }
  assert.equal(withUserAgent('curl/8.0', () => wizard.wizardClientOS()), '');
});

test('AmneziaWG interfaces link to AmneziaWG apps, current device first', () => {
  const apps = withUserAgent(UA.android, () => context('amneziawg').wizardClientApps());
  assert.equal(apps.length, 5);
  assert.deepEqual(apps[0], {
    os: 'android',
    label: 'Android',
    url: 'https://play.google.com/store/apps/details?id=org.amnezia.awg',
    current: true,
  });
  assert.equal(apps.filter(a => a.current).length, 1);
  for (const app of apps) {
    assert.ok(!app.url.includes('wireguard.com') && !app.url.includes('com.wireguard'), app.url);
  }
  assert.equal(context('amneziawg').wizardClientAppsMoreUrl(), 'https://docs.amnezia.org/documentation/amnezia-wg/');
});

test('WireGuard interfaces link to WireGuard apps', () => {
  const apps = withUserAgent(UA.ios, () => context('wireguard').wizardClientApps());
  assert.equal(apps[0].os, 'ios');
  assert.equal(apps[0].url, 'https://apps.apple.com/app/wireguard/id1441195209');
  for (const app of apps) {
    assert.ok(!app.url.includes('amnezia'), app.url);
  }
  assert.equal(context('wireguard').wizardClientAppsMoreUrl(), 'https://www.wireguard.com/install/');
});

test('unknown OS keeps the default order with nothing highlighted', () => {
  const apps = withUserAgent('', () => context('amneziawg').wizardClientApps());
  assert.deepEqual(apps.map(a => a.os), ['windows', 'macos', 'linux', 'android', 'ios']);
  assert.ok(apps.every(a => !a.current));
});
