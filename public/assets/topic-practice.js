(() => {
  'use strict';
  const core = window.HelenTopicPracticeCore;
  if (!core) return;
  const t = (key, params) => window.HelenI18n?.t(key, params) || key;
  let storage;
  try {
    storage = localStorage;
  } catch {}
  let saved = core.read(storage),
    context,
    mode = 'writing',
    draft,
    busy = false,
    phase = 'idle',
    run = 0,
    controller,
    live,
    recorded,
    edited = false;
  try {
    const selected = storage?.getItem(core.MODE);
    if (core.modes.includes(selected)) mode = selected;
  } catch {}
  const host = document.getElementById('topic-prompts'),
    $ = (id) => host.querySelector('#' + id),
    captions = window.HelenLiveTranscript?.create();
  function node(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function message(text, error = false, loading = false) {
    const e = $('topic-practice-status');
    if (!e) return;
    e.classList.toggle('error', error);
    e.setAttribute('role', error ? 'alert' : 'status');
    if (loading) window.showLoading(e, t(text));
    else {
      e.removeAttribute('aria-busy');
      e.textContent = t(text);
    }
  }
  function persist() {
    if (!draft) return;
    draft.at = Date.now();
    saved.drafts[`${draft.topic}:${draft.mode}`] = draft;
    try {
      storage.setItem(core.KEY, JSON.stringify(saved));
      return true;
    } catch {
      message('Device storage is full. Keep this tab open or copy your answer.', true);
      return false;
    }
  }
  function words() {
    const count = core.words(draft?.text);
    $('topic-practice-count').textContent = t(
      '{count} words · feedback from 80 words · maximum 900',
      { count },
    );
    const list = $('topic-practice-vocabulary');
    list.replaceChildren();
    for (const word of context.entries
      .filter((e) => e.kind === 'concept')
      .slice(0, 5)
      .map((e) => e.word)) {
      const item = node('span', word, 'topic-practice-term');
      item.lang = 'en';
      item.dataset.used = String(core.usedWords(draft?.text || '', [word]).length > 0);
      list.append(item);
    }
  }
  function controls() {
    if (!context || !$('topic-practice-answer')) return;
    const offline = navigator.onLine === false;
    $('topic-practice-submit').disabled =
      busy || offline || core.words(draft.text) < 80 || core.words(draft.text) > 900;
    $('topic-practice-answer').readOnly = busy && phase !== 'recording';
    $('topic-practice-mode').disabled = busy;
    $('topic-practice-discard').disabled = busy || !draft.text;
    $('topic-practice-cancel').hidden = !busy;
    const mic = $('topic-practice-mic');
    mic.hidden = mode !== 'speaking';
    mic.disabled =
      offline ||
      (busy && !['recording', 'requesting'].includes(phase)) ||
      !window.HelenVoiceRecorder?.available();
    mic.setAttribute('aria-pressed', String(['recording', 'requesting'].includes(phase)));
    mic.textContent = t(
      phase === 'recording'
        ? 'Stop recording'
        : phase === 'requesting'
          ? 'Cancel'
          : 'Record answer',
    );
    $('topic-practice-retry').hidden = !recorded;
    $('topic-practice-retry').disabled = busy || offline;
    $('topic-practice-offline').hidden = !offline;
  }
  function showReport() {
    const region = $('topic-practice-report'),
      report = draft?.report;
    region.replaceChildren();
    region.hidden = !report;
    if (!report) return;
    region.lang = draft.interfaceLanguage || window.HelenI18n?.locale || 'en';
    region.append(
      node(
        'h3',
        report.overall === null
          ? t('IELTS feedback · partial estimate')
          : t('Estimated band {band}', { band: report.overall.toFixed(1) }),
      ),
      node('p', report.notice, 'topic-practice-note'),
      node('p', report.summary),
    );
    if (report.underlength)
      region.append(
        node(
          'p',
          t(
            'This is a short practice answer. Write at least 250 words for a Task 2 overall estimate.',
          ),
          'topic-practice-note',
        ),
      );
    const labels = {
        task: 'Task Response',
        coherence: 'Coherence and Cohesion',
        fluency: 'Fluency and Coherence',
        vocabulary: 'Lexical Resource',
        grammar: 'Grammatical Range and Accuracy',
        pronunciation: 'Pronunciation',
      },
      grid = node('div', undefined, 'topic-practice-criteria');
    for (const key of core.criterionKeys(mode)) {
      const item = report.criteria[key],
        card = node('article', undefined, 'topic-practice-criterion'),
        heading = node('h4');
      heading.append(
        node('span', labels[key]),
        node('strong', item.band === null ? t('Not scored') : item.band.toFixed(1)),
      );
      card.append(heading, node('p', item.feedback));
      if (item.quote) {
        const quote = node('blockquote', item.quote);
        quote.lang = 'en';
        card.append(quote);
      }
      grid.append(card);
    }
    region.append(grid);
    if (report.corrections.length) {
      const details = node('details', undefined, 'topic-practice-feedback');
      details.append(node('summary', t('Grammar & word choice')));
      for (const edit of report.corrections) {
        const block = node('div', undefined, 'topic-practice-edit'),
          old = node('del', edit.original),
          next = node('ins', edit.replacement);
        old.lang = next.lang = 'en';
        block.append(old, node('span', ' → '), next, node('p', edit.reason));
        details.append(block);
      }
      region.append(details);
    }
    if (report.collocations.length) {
      const details = node('details', undefined, 'topic-practice-feedback');
      details.append(node('summary', t('Optional collocation upgrades')));
      for (const item of report.collocations) {
        const block = node('div', undefined, 'topic-practice-edit'),
          phrase = node('strong', item.text),
          example = node('p', item.example);
        phrase.lang = example.lang = 'en';
        block.append(phrase, node('p', item.translation), example);
        details.append(block);
      }
      region.append(details);
    }
    region.append(node('h4', t('What to practise next')));
    const steps = node('ol');
    report.nextSteps.forEach((text) => steps.append(node('li', text)));
    region.append(steps);
  }
  function loadDraft() {
    draft = saved.drafts[`${context.topic}:${mode}`] || {
      topic: context.topic,
      mode,
      text: '',
      at: Date.now(),
    };
    $('topic-practice-answer').value = draft.text;
    recorded = null;
    showReport();
    words();
    controls();
  }
  function drawTask() {
    const task = core.task(context.topic, mode);
    $('topic-practice-question').textContent = task.question;
    $('topic-practice-bullets').replaceChildren(...task.bullets.map((text) => node('li', text)));
    $('topic-practice-guide').textContent = t(
      mode === 'writing'
        ? 'Write at least 250 words. Allow about 40 minutes. Short practice answers of 80+ words receive feedback without an overall band.'
        : 'Prepare for one minute, then speak for 1–2 minutes. Record up to 3 minutes. Typed answers receive vocabulary and grammar feedback only.',
    );
    $('topic-practice-privacy').textContent = t(
      'AI marking needs Internet and shares your daily assessment allowance with Practical AI. Audio is sent for recognition, not stored by Helen. Drafts and feedback stay on this device.',
    );
  }
  function cancel(announce = true) {
    ++run;
    controller?.abort();
    controller = null;
    live?.cancel();
    live = null;
    if (['recording', 'requesting', 'transcribing'].includes(phase))
      window.HelenVoiceRecorder?.cancel();
    busy = false;
    phase = 'idle';
    persist();
    controls();
    if (announce) message('Stopped. Your answer is kept.');
  }
  async function request(content, signal) {
    const response = await window.apiFetch('/api/practical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Helen-Device': window.HelenPronunciation.device(),
      },
      body: JSON.stringify({
        ...content,
        interfaceLanguage: window.HelenI18n?.locale || 'en',
        translationLanguage: document.querySelector('#topic-target').value,
        requestId: crypto.randomUUID(),
      }),
      signal,
      timeoutMs: content.stage === 'transcribe' ? 35000 : 30000,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw window.HelenApiErrors.fromResponse(data, response);
    return data;
  }
  function acceptTranscript(data) {
    live?.cancel();
    live = null;
    recorded = null;
    if (!edited) {
      draft.text = data.transcript;
      $('topic-practice-answer').value = data.transcript;
      draft.speechReceipt = data.speechReceipt;
    } else delete draft.speechReceipt;
    delete draft.report;
    persist();
    showReport();
    words();
    message(
      edited
        ? 'Your edits are kept. Record again for pronunciation scoring.'
        : 'Review the transcript, then select Get IELTS feedback. Editing it removes acoustic scoring.',
    );
  }
  async function transcribe(value, signal) {
    recorded = value;
    return request(
      {
        ...value,
        stage: 'transcribe',
        scenario: 'free-talk',
        level: 'B2',
        history: [{ role: 'assistant', text: core.task(context.topic, mode).question }],
      },
      signal,
    );
  }
  function record() {
    if (busy) {
      if (phase === 'recording') window.HelenVoiceRecorder.stop();
      else if (phase === 'requesting') cancel();
      return;
    }
    if (draft.text.trim()) {
      message(
        'Clear the draft before recording a new answer. Your saved feedback will stay until you clear it.',
        true,
      );
      return;
    }
    const ticket = ++run;
    busy = true;
    phase = 'requesting';
    edited = false;
    window.HelenAudio?.stop();
    controls();
    const task = window.HelenVoiceRecorder.start({
      language: 'en-US',
      mode: 'conversation',
      submit: (value, { signal }) => transcribe(value, signal),
      onState: (info) => {
        if (ticket !== run) return;
        phase = info.state;
        if (phase === 'transcribing') {
          live?.stop();
          message('Transcribing your answer…', false, true);
        } else if (phase === 'recording')
          message(
            `${Math.floor((info.elapsedMs || 0) / 60000)}:${String(Math.floor((info.elapsedMs || 0) / 1000) % 60).padStart(2, '0')} / 3:00`,
          );
        else message(info.message);
        controls();
      },
    });
    live = captions?.start({
      language: 'en-US',
      onChange: (info) => {
        if (ticket !== run || edited || !info.text.trim()) return;
        draft.text = info.text;
        delete draft.speechReceipt;
        delete draft.report;
        $('topic-practice-answer').value = info.text;
        words();
        persist();
      },
    });
    task
      .then((data) => {
        if (ticket === run) acceptTranscript(data);
      })
      .catch((error) => {
        if (ticket === run)
          message(
            window.shortError(
              error,
              t(
                'Could not recognise the recording. Your draft is kept. Retry recording or type your answer.',
              ),
            ),
            true,
          );
      })
      .finally(() => {
        if (ticket === run) {
          live?.cancel();
          live = null;
          busy = false;
          phase = 'idle';
          controls();
        }
      });
  }
  async function assess(event) {
    event.preventDefault();
    if (busy || navigator.onLine === false) return;
    if (core.words(draft.text) < 80 || core.words(draft.text) > 900) return;
    const ticket = ++run,
      answer = draft.text.trim(),
      language = window.HelenI18n?.locale || 'en';
    busy = true;
    phase = 'assessing';
    controller = new AbortController();
    controls();
    message('Assessing your answer against the IELTS criteria…', false, true);
    try {
      const report = await request(
        {
          stage: 'topic-assess',
          topic: context.topic,
          mode,
          lesson: context.lesson,
          text: answer,
          ...(draft.speechReceipt ? { speechReceipt: draft.speechReceipt } : {}),
        },
        controller.signal,
      );
      if (ticket !== run) return;
      if (!core.validReport(report, { ...draft, text: answer }))
        throw Error(t('AI feedback is incomplete. Your answer is kept; try again.'));
      draft.text = answer;
      draft.report = report;
      draft.interfaceLanguage = language;
      persist();
      showReport();
      message('Feedback is ready. Edit your answer, then submit it again to practise.');
      $('topic-practice-report').focus({ preventScroll: true });
      $('topic-practice-report').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (error) {
      if (ticket === run)
        message(
          window.shortError(error, t('AI feedback is incomplete. Your answer is kept; try again.')),
          true,
        );
    } finally {
      if (ticket === run) {
        busy = false;
        phase = 'idle';
        controller = null;
        controls();
      }
    }
  }
  function mount(value) {
    if (!host) return;
    const same = context?.topic === value.topic;
    if (same) {
      context = value;
      words();
      return;
    }
    cancel(false);
    context = value;
    host.innerHTML =
      '<summary>IELTS Practice · Use it in context</summary><div class="topic-practice"><p id="topic-practice-intro"></p><label for="topic-practice-mode" id="topic-practice-mode-label"></label><select id="topic-practice-mode"><option value="writing">IELTS Writing · Task 2</option><option value="speaking">IELTS Speaking · Part 2</option></select><article class="topic-practice-task"><h3 id="topic-practice-question" lang="en"></h3><ul id="topic-practice-bullets" lang="en"></ul><p id="topic-practice-guide"></p></article><p id="topic-practice-vocabulary-label"></p><div id="topic-practice-vocabulary" class="topic-practice-vocabulary"></div><form id="topic-practice-form"><label for="topic-practice-answer" id="topic-practice-answer-label"></label><textarea id="topic-practice-answer" lang="en" rows="9" maxlength="8000" aria-describedby="topic-practice-count topic-practice-guide" spellcheck="true"></textarea><p id="topic-practice-count"></p><div class="topic-practice-actions"><button type="button" class="word-link" id="topic-practice-mic" hidden></button><button type="submit" class="word-link topic-practice-primary" id="topic-practice-submit"></button><button type="button" class="word-link" id="topic-practice-cancel" hidden></button><button type="button" class="text-action" id="topic-practice-discard"></button><button type="button" class="word-link" id="topic-practice-retry" hidden></button></div></form><p id="topic-practice-status" role="status"></p><p id="topic-practice-offline" class="topic-practice-note" hidden></p><p id="topic-practice-privacy" class="topic-practice-note"></p><section id="topic-practice-report" tabindex="-1" aria-label="IELTS feedback" hidden></section></div>';
    const labels = {
      intro: 'Original Helen tasks in IELTS format. This is practice, not an official test.',
      'mode-label': 'Choose your practice',
      'vocabulary-label':
        'Try 3–5 lesson terms naturally. Appropriate synonyms are welcome; keyword counts do not determine your band.',
      'answer-label': 'Your answer in English',
      submit: 'Get IELTS feedback',
      cancel: 'Cancel',
      discard: 'Clear draft',
      retry: 'Retry recording',
      offline:
        'You can write and view saved feedback offline. Connect to the Internet for AI marking.',
    };
    for (const [id, text] of Object.entries(labels))
      $('topic-practice-' + id).textContent = t(text);
    $('topic-practice-mode').value = mode;
    drawTask();
    loadDraft();
    $('topic-practice-mode').onchange = () => {
      cancel(false);
      mode = $('topic-practice-mode').value;
      try {
        storage?.setItem(core.MODE, mode);
      } catch {}
      drawTask();
      loadDraft();
      message('');
    };
    $('topic-practice-answer').oninput = () => {
      if (busy && phase !== 'recording') return;
      edited = true;
      draft.text = $('topic-practice-answer').value;
      delete draft.speechReceipt;
      delete draft.report;
      persist();
      showReport();
      words();
      controls();
    };
    $('topic-practice-form').onsubmit = assess;
    $('topic-practice-cancel').onclick = () => cancel();
    $('topic-practice-mic').onclick = record;
    $('topic-practice-discard').onclick = () => {
      if (!window.confirm(t('Clear this draft and its feedback? Other topics are kept.'))) return;
      draft = { topic: context.topic, mode, text: '', at: Date.now() };
      recorded = null;
      $('topic-practice-answer').value = '';
      persist();
      showReport();
      words();
      controls();
      message('');
      $('topic-practice-answer').focus();
    };
    $('topic-practice-retry').onclick = async () => {
      if (!recorded || busy) return;
      const ticket = ++run;
      busy = true;
      phase = 'transcribing';
      controller = new AbortController();
      message('Transcribing your answer…', false, true);
      controls();
      try {
        const data = await transcribe(recorded, controller.signal);
        if (ticket === run) acceptTranscript(data);
      } catch (error) {
        if (ticket === run) message(window.shortError(error), true);
      } finally {
        if (ticket === run) {
          busy = false;
          phase = 'idle';
          controller = null;
          controls();
        }
      }
    };
  }
  document.addEventListener('helen:page-change', (event) => {
    if (event.detail.page !== 'topics') cancel(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && busy) cancel(false);
  });
  window.addEventListener('pagehide', () => cancel(false));
  window.addEventListener('offline', () => {
    if (busy) cancel(false);
    controls();
  });
  window.addEventListener('online', controls);
  window.addEventListener('helen:speech-ready', controls);
  window.HelenTopicPractice = { mount, cancel };
})();
