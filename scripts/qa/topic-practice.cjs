'use strict';
// UI/provider fixtures: no paid generations and no claim of physical-device audio QA.
const { spawn } = require('node:child_process'),
  net = require('node:net'),
  path = require('node:path'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const { chromium } = require('playwright'),
  core = require('../../public/assets/topic-practice-core');
const root = path.join(__dirname, '../..'),
  answer =
    'International tourism can support local communities when visitors choose responsible travel. However, protecting local cultures is important because overcrowding can damage historic places. Governments should invest in sustainable tourism and public transport rather than simply attract more visitors. For example, entrance fees can help local residents maintain cultural sites. '
      .repeat(6)
      .trim();
function report(body) {
  return {
    stage: 'topic-assess',
    taskId: core.task(body.topic, body.mode).id,
    answer: body.text,
    mode: body.mode,
    topic: body.topic,
    estimated: true,
    overall: body.mode === 'writing' && core.words(body.text) >= 250 ? 6.5 : null,
    summary: 'Bạn đã nêu quan điểm rõ ràng. Hãy phát triển ví dụ cụ thể hơn.',
    notice: 'Điểm AI ước lượng cho một bài luyện, không phải kết quả IELTS chính thức.',
    underlength: body.mode === 'writing' && core.words(body.text) < 250,
    criteria: Object.fromEntries(
      core
        .criterionKeys(body.mode)
        .map((key) => [
          key,
          {
            band: ['fluency', 'pronunciation'].includes(key) ? null : 6.5,
            feedback: 'Quan điểm rõ, cần giải thích ví dụ sâu hơn.',
            quote: ['fluency', 'pronunciation'].includes(key) ? '' : body.text.split(/(?<=\.) /)[0],
          },
        ]),
    ),
    nextSteps: ['Thêm một ví dụ cụ thể.'],
    corrections: [
      {
        original: 'can support',
        replacement: 'can benefit',
        reason: 'Gợi ý diễn đạt trong fixture.',
      },
    ],
    collocations: [
      {
        text: 'preserve cultural heritage',
        translation: 'bảo tồn di sản văn hóa',
        example: 'Local guides help preserve cultural heritage.',
      },
    ],
    coverage: {
      words: core.words(body.text),
      allSpoken: false,
      allAcoustic: false,
      assessedAudioSeconds: 0,
    },
  };
}
(async () => {
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      DATABASE_URL: '',
      MYSQL_HOST: '',
      GEMINI_API_KEY: '',
      ELEVENLABS_API_KEY: '',
      HELEN_DISABLE_WORDNET: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve);
      server.once('exit', (code) => reject(Error(`server exited ${code}`)));
    });
    server.stdout.resume();
    server.stderr.resume();
    browser = await chromium.launch({
      executablePath: process.env.HELEN_CHROMIUM_PATH || '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox'],
    });
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: 'vi-VN',
        serviceWorkers: 'allow',
      });
      if (process.env.HELEN_AXE_PATH)
        await context.addInitScript({ path: process.env.HELEN_AXE_PATH });
      const page = await context.newPage(),
        errors = [],
        calls = [];
      let fail = false,
        held = false,
        release;
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/practical', async (route) => {
        const body = route.request().postDataJSON();
        calls.push(body);
        if (held) await new Promise((resolve) => (release = resolve));
        if (fail)
          return route.fulfill({ status: 503, json: { code: 'PRACTICAL_BUSY', error: 'AI busy' } });
        if (body.stage === 'transcribe')
          return route.fulfill({
            json: {
              stage: 'transcribe',
              transcript: answer,
              uncertain: false,
              speechReceipt: 'fixture-receipt',
            },
          });
        return route.fulfill({ json: report(body) }).catch(() => {});
      });
      await page.route('**/api/pronunciation**', (route) =>
        route.fulfill({ json: { pronunciation: [] } }),
      );
      await page.goto(`http://127.0.0.1:${port}/topics`);
      await page.locator('[data-topic="travel"]').click();
      if (!(await page.locator('#topic-prompts').evaluate((e) => e.open)))
        await page.locator('#topic-prompts>summary').click();
      assert.match(
        await page.locator('#topic-practice-question').textContent(),
        /International tourism/,
      );
      assert.equal(await page.locator('#topic-practice-submit').isDisabled(), true);
      assert.equal(calls.length, 0);
      await page.fill('#topic-practice-answer', answer);
      assert.equal(await page.locator('#topic-practice-submit').isEnabled(), true);
      await page.locator('#topic-practice-submit').click();
      await page.waitForFunction(() => !document.querySelector('#topic-practice-report').hidden);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].stage, 'topic-assess');
      assert.equal(await page.locator('.topic-practice-criterion').count(), 4);
      assert.match(await page.locator('#topic-practice-report h3').textContent(), /6.5/);
      assert.equal(
        await page.locator('#topic-practice-report').evaluate((e) => e === document.activeElement),
        true,
      );
      await page.locator('[data-lesson="1"]').click();
      assert.equal(await page.locator('#topic-practice-answer').inputValue(), answer);
      await page.locator('#topic-back').click();
      await page.locator('[data-topic="education"]').click();
      await page.fill('#topic-practice-answer', 'An education draft.');
      await page.locator('#topic-back').click();
      await page.locator('[data-topic="travel"]').click();
      assert.equal(await page.locator('#topic-practice-answer').inputValue(), answer);
      await page.selectOption('#topic-practice-mode', 'speaking');
      assert.equal(await page.locator('#topic-practice-answer').inputValue(), '');
      assert.equal(await page.locator('#topic-practice-bullets li').count(), 3);
      await page.fill('#topic-practice-answer', answer);
      await page.locator('#topic-practice-submit').click();
      await page.waitForFunction(() => !document.querySelector('#topic-practice-report').hidden);
      assert.match(await page.locator('#topic-practice-report h3').textContent(), /từng phần/);
      assert.equal(
        await page
          .locator('.topic-practice-criterion h4 strong')
          .allTextContents()
          .then((a) => a.filter((x) => x === 'Chưa chấm').length),
        2,
      );
      await page.selectOption('#topic-practice-mode', 'writing');
      assert.equal(await page.locator('#topic-practice-answer').inputValue(), answer);
      await page.fill('#topic-practice-answer', answer + ' More detail.');
      assert.equal(await page.locator('#topic-practice-report').isHidden(), true);
      fail = true;
      await page.locator('#topic-practice-submit').click();
      await page.waitForFunction(
        () => document.querySelector('#topic-practice-status').getAttribute('role') === 'alert',
      );
      assert.equal(
        await page.locator('#topic-practice-answer').inputValue(),
        answer + ' More detail.',
      );
      fail = false;
      held = true;
      await page.locator('#topic-practice-submit').click();
      await page.waitForFunction(() => !document.querySelector('#topic-practice-cancel').hidden);
      await page.locator('#topic-practice-cancel').click();
      for (let i = 0; i < 100 && !release; i++) await page.waitForTimeout(10);
      assert.ok(release);
      release();
      held = false;
      await page.waitForTimeout(50);
      assert.equal(await page.locator('#topic-practice-report').isHidden(), true);
      await page.locator('#topic-practice-submit').click();
      await page.waitForFunction(() => !document.querySelector('#topic-practice-report').hidden);
      if (process.env.HELEN_AXE_PATH)
        for (const theme of ['light', 'dark']) {
          await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
          await page.waitForTimeout(250);
          const result = await page.evaluate(() =>
            axe.run(document.getElementById('topic-prompts'), {
              runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
            }),
          );
          assert.deepEqual(
            result.violations.map((x) => ({
              id: x.id,
              targets: x.nodes.map((n) => ({
                target: n.target,
                detail: n.any.map((a) => a.message),
              })),
            })),
            [],
            `${width}:${theme}`,
          );
        }
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `overflow ${width}`,
      );
      fs.mkdirSync('/tmp/helen-topic-practice-qa', { recursive: true });
      await page
        .locator('#topic-prompts')
        .screenshot({ path: `/tmp/helen-topic-practice-qa/${width}-report.png` });
      // Wait for the actual downloaded pack; a click alone does not finish Cache.put.
      await page.locator('#download-topic').click();
      await page.waitForFunction(
        async () =>
          !!(await (
            await caches.open('helen-topic-packs-v1')
          ).match('/assets/topics/v2/travel.json')),
      );
      await page.evaluate(() => navigator.serviceWorker.ready);
      await context.setOffline(true);
      await page.reload();
      // Chromium restores navigator.onLine on reload even while context networking
      // stays offline. Reapply protocol emulation to test the offline controls too.
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0,
      });
      await page.locator('[data-topic="travel"]').click();
      if (!(await page.locator('#topic-prompts').evaluate((e) => e.open)))
        await page.locator('#topic-prompts>summary').click();
      assert.equal(
        await page.locator('#topic-practice-answer').inputValue(),
        answer + ' More detail.',
      );
      assert.equal(
        await page.locator('#topic-practice-report').isVisible(),
        true,
        'offline report visible',
      );
      assert.equal(
        await page.locator('#topic-practice-submit').isDisabled(),
        true,
        'offline marking disabled',
      );
      assert.equal(
        await page.locator('#topic-practice-offline').isVisible(),
        true,
        'offline notice visible',
      );
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      await cdp.detach();
      await context.setOffline(false);
      await page.selectOption('#topic-practice-mode', 'speaking');
      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('#topic-practice-discard').click();
      await page.evaluate((answer) => {
        let resolve, options;
        window.HelenVoiceRecorder = {
          available: () => true,
          start(value) {
            options = value;
            options.onState({ state: 'recording', elapsedMs: 100 });
            return new Promise((done) => (resolve = done));
          },
          async stop() {
            options.onState({ state: 'transcribing' });
            const data = await options.submit(
              { audio: 'fixture-audio', mimeType: 'audio/webm', durationMs: 179000 },
              { signal: new AbortController().signal },
            );
            resolve(data);
          },
          cancel() {
            resolve?.({});
          },
        };
        window.dispatchEvent(new Event('helen:speech-ready'));
      }, answer);
      await page.locator('#topic-practice-mic').click();
      assert.equal(await page.locator('#topic-practice-mic').getAttribute('aria-pressed'), 'true');
      await page.locator('#topic-practice-mic').click();
      await page.waitForFunction(
        () => document.querySelector('#topic-practice-answer').value.length > 100,
      );
      assert.equal(await page.locator('#topic-practice-answer').inputValue(), answer);
      assert.match(await page.locator('#topic-practice-status').textContent(), /Kiểm tra/);
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          width,
          writing: true,
          speakingText: true,
          recordingFlow: 'fixture',
          perTopicDrafts: true,
          cancel: true,
          offlineReload: true,
          axe: Boolean(process.env.HELEN_AXE_PATH),
        }),
      );
      await context.close();
    }
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
