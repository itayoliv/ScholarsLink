import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://localhost:5174';

async function loginAndShot(browser, { email, password, name, pathAfter }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${base}/login`, { waitUntil: 'networkidle0' });

  await page.waitForSelector('form input[type="email"]');
  await page.type('form input[type="email"]', email);
  await page.type('form input[type="password"]', password);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    page.click('form button[type="submit"]'),
  ]);

  if (pathAfter) {
    await page.goto(`${base}${pathAfter}`, { waitUntil: 'networkidle0' }).catch(() => {});
  }

  await page.waitForSelector('h1, .summary-card, .panel', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));

  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file, 'url=', page.url());
  await context.close();
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--window-size=1440,900'],
  defaultViewport: null,
});

try {
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${base}/login`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    const file = path.join(outDir, 'login.png');
    await page.screenshot({ path: file, fullPage: false });
    console.log('saved', file);
    await page.close();
  }

  await loginAndShot(browser, {
    email: 'admin@scholarslink.demo',
    password: 'demo1234',
    name: 'admin-dashboard',
  });

  await loginAndShot(browser, {
    email: 'supervisor@scholarslink.demo',
    password: 'demo1234',
    name: 'supervisor-dashboard',
  });

  await loginAndShot(browser, {
    email: 'student@scholarslink.demo',
    password: 'demo1234',
    name: 'student-dashboard',
  });
} finally {
  await browser.close();
}
