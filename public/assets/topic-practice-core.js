(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelenTopicPracticeCore = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  // Original Helen prompts inspired by IELTS task formats, not copied exam papers.
  const curriculum = {
    education: [
      'Some people believe that online courses can replace classroom teaching. To what extent do you agree or disagree?',
      'Describe a useful skill you learned outside school.',
      [
        'what the skill was',
        'how you learned and practised it',
        'why learning it was important to you',
      ],
    ],
    work: [
      'Some people think employers should offer a four-day working week. Do the advantages of this approach outweigh the disadvantages?',
      'Describe a job you would like to do in the future.',
      [
        'what the job involves',
        'what skills or qualifications it requires',
        'why this job would suit you',
      ],
    ],
    business: [
      'Some people think small local businesses should receive government support, while others believe that businesses should compete without help. Discuss both views and give your own opinion.',
      'Describe a small business you know well.',
      [
        'what it sells or provides',
        'how you first heard about it',
        'why you think people choose this business',
      ],
    ],
    money: [
      'Some people believe schools should teach financial skills as a compulsory subject. To what extent do you agree or disagree?',
      'Describe something important you saved money to buy.',
      ['what you wanted to buy', 'how you saved the money', 'how you felt when you bought it'],
    ],
    travel: [
      'International tourism brings economic benefits but can damage local cultures and the environment. Do the advantages of international tourism outweigh the disadvantages?',
      'Describe a place you would like to visit.',
      [
        'where it is',
        'what you would do there',
        'why visiting this place would be meaningful to you',
      ],
    ],
    transport: [
      'Some people think governments should invest more in public transport than in building new roads. To what extent do you agree or disagree?',
      'Describe a journey you remember well.',
      [
        'where you went and how you travelled',
        'what happened during the journey',
        'why you still remember it',
      ],
    ],
    housing: [
      'Housing has become unaffordable for many young adults in large cities. What are the causes of this problem, and what solutions could help?',
      'Describe a neighbourhood you would like to live in.',
      [
        'where it is',
        'what facilities and housing it has',
        'why it would be a good place for you to live',
      ],
    ],
    health: [
      'Some people think governments should spend more on preventing illness than on treating it. To what extent do you agree or disagree?',
      'Describe a healthy habit you have developed.',
      ['what the habit is', 'how you started it', 'how it has affected your daily life'],
    ],
    environment: [
      'Some people believe that individuals can do little to protect the environment, while others think individual action is essential. Discuss both views and give your own opinion.',
      'Describe an environmental improvement you would like to see in your area.',
      ['what needs to change', 'who could help make the change', 'how local people would benefit'],
    ],
    science: [
      'Some people believe scientific research should focus on solving immediate problems rather than exploring new ideas. Discuss both views and give your own opinion.',
      'Describe an invention that has made everyday life easier.',
      ['what the invention is', 'how people use it', 'why you consider it important'],
    ],
    technology: [
      'Artificial intelligence is being used to carry out more tasks at work. Do the advantages of this development outweigh the disadvantages?',
      'Describe a piece of technology that helps you learn.',
      ['what it is', 'how you use it', 'why it is useful compared with other ways of learning'],
    ],
    communication: [
      'Some people believe social media helps people build relationships, while others think it makes communication less meaningful. Discuss both views and give your own opinion.',
      'Describe a conversation that changed your mind about something.',
      ['who you spoke with', 'what you discussed', 'why the conversation influenced your opinion'],
    ],
    society: [
      'Some people think young adults should be required to do unpaid community work. To what extent do you agree or disagree?',
      'Describe a time when you helped someone in your community.',
      ['who needed help', 'what you did', 'what you learned from the experience'],
    ],
    relationships: [
      'In many countries, people spend less time with their families than in the past. What are the reasons for this, and what effects does it have?',
      'Describe a family member who has influenced you positively.',
      ['who the person is', 'what they have done', 'how their influence has changed you'],
    ],
    food: [
      'Some people believe governments should tax unhealthy food to improve public health. To what extent do you agree or disagree?',
      'Describe a meal that was special to you.',
      ['what you ate and where', 'who you shared it with', 'why it was memorable'],
    ],
    culture: [
      'Some people think public money should be spent on essential services rather than the arts. Discuss both views and give your own opinion.',
      'Describe a cultural event you enjoyed.',
      [
        'what the event was',
        'what you did or saw there',
        'why it was important or enjoyable for you',
      ],
    ],
    shopping: [
      'Online shopping is replacing many physical shops. Do the advantages of this development outweigh the disadvantages?',
      'Describe a product you bought that was particularly useful.',
      ['what the product was', 'how you chose it', 'why it has been useful in your life'],
    ],
    sports: [
      'Some people believe schools should focus on competitive sports, while others think participation should be the priority. Discuss both views and give your own opinion.',
      'Describe a sport or physical activity you would like to try.',
      [
        'what the activity is',
        'how you would start learning it',
        'why you would like to take part',
      ],
    ],
    agriculture: [
      'Some people think countries should produce most of their own food rather than depend on imports. Do the advantages of this approach outweigh the disadvantages?',
      'Describe a place where you saw food being grown or produced.',
      [
        'where the place was',
        'what you saw people doing',
        'what you learned about food production',
      ],
    ],
    personal: [
      'Some people believe success depends mainly on natural ability, while others think effort and persistence are more important. Discuss both views and give your own opinion.',
      'Describe a difficult goal you achieved.',
      [
        'what the goal was',
        'what challenges you faced',
        'how you overcame them and felt afterwards',
      ],
    ],
  };
  const KEY = 'helen-topic-practice-v1',
    MODE = 'helen-topic-practice-mode-v1',
    modes = ['writing', 'speaking'];
  function task(topic, mode) {
    const row =
      typeof topic === 'string' && Object.hasOwn(curriculum, topic) ? curriculum[topic] : null;
    if (!row || !modes.includes(mode)) return null;
    return {
      id: `${topic}:${mode}:v1`,
      topic,
      mode,
      title: mode === 'writing' ? 'IELTS Writing · Task 2' : 'IELTS Speaking · Part 2',
      question: row[mode === 'writing' ? 0 : 1],
      bullets: mode === 'writing' ? [] : [...row[2]],
      minimumWords: mode === 'writing' ? 250 : 80,
    };
  }
  const words = (text) =>
    (String(text || '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  const normalized = (text) =>
    String(text)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[’]/g, "'")
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  function usedWords(text, vocabulary) {
    const source = ` ${normalized(text)} `;
    return vocabulary.filter((word) => source.includes(` ${normalized(word)} `));
  }
  const score = (value) =>
    value === null ||
    (Number.isFinite(value) && value >= 0 && value <= 9 && Number.isInteger(value * 2));
  const string = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;
  const criterionKeys = (mode) =>
    mode === 'writing'
      ? ['task', 'coherence', 'vocabulary', 'grammar']
      : ['fluency', 'vocabulary', 'grammar', 'pronunciation'];
  function validReport(report, entry) {
    if (
      !report ||
      report.stage !== 'topic-assess' ||
      report.taskId !== task(entry.topic, entry.mode)?.id ||
      report.answer !== entry.text.trim() ||
      !score(report.overall) ||
      !string(report.summary, 900) ||
      !string(report.notice, 2000) ||
      !Array.isArray(report.nextSteps) ||
      !report.nextSteps.length ||
      report.nextSteps.length > 3 ||
      !report.nextSteps.every((x) => string(x, 400))
    )
      return false;
    const keys = criterionKeys(entry.mode);
    if (
      !keys.every((key) => {
        const item = report.criteria?.[key];
        return (
          item &&
          score(item.band) &&
          string(item.feedback, 1200) &&
          typeof item.quote === 'string' &&
          item.quote.length <= 1000 &&
          (!item.quote || report.answer.includes(item.quote))
        );
      })
    )
      return false;
    if (
      report.overall !== null &&
      (keys.some((key) => report.criteria[key].band === null) ||
        (entry.mode === 'writing' && words(report.answer) < 250) ||
        (entry.mode === 'speaking' &&
          (!entry.speechReceipt ||
            report.coverage?.allSpoken !== true ||
            report.coverage?.allAcoustic !== true ||
            report.coverage?.assessedAudioSeconds < 30)))
    )
      return false;
    if (
      !Array.isArray(report.corrections) ||
      report.corrections.length > 4 ||
      !report.corrections.every(
        (item) =>
          string(item.original, 160) &&
          report.answer.includes(item.original) &&
          typeof item.replacement === 'string' &&
          item.replacement.length <= 160 &&
          string(item.reason, 300),
      )
    )
      return false;
    return (
      Array.isArray(report.collocations) &&
      report.collocations.length <= 3 &&
      report.collocations.every(
        (item) =>
          string(item.text, 150) && string(item.translation, 300) && string(item.example, 350),
      )
    );
  }
  function sanitize(value) {
    const drafts = {};
    if (value?.version === 1 && value.drafts && typeof value.drafts === 'object')
      for (const [key, item] of Object.entries(value.drafts).slice(0, 40)) {
        const [topic, mode, ...rest] = key.split(':');
        if (
          rest.length ||
          !task(topic, mode) ||
          typeof item?.text !== 'string' ||
          item.text.length > 8000 ||
          !Number.isFinite(item.at)
        )
          continue;
        const entry = {
          topic,
          mode,
          text: item.text,
          at: item.at,
          ...(mode === 'speaking' &&
          typeof item.speechReceipt === 'string' &&
          item.speechReceipt.length <= 18000
            ? { speechReceipt: item.speechReceipt }
            : {}),
          ...(typeof item.interfaceLanguage === 'string'
            ? { interfaceLanguage: item.interfaceLanguage }
            : {}),
        };
        if (validReport(item.report, entry)) entry.report = item.report;
        drafts[key] = entry;
      }
    return { version: 1, drafts };
  }
  function read(storage) {
    try {
      return sanitize(JSON.parse(storage?.getItem(KEY) || 'null'));
    } catch {
      return sanitize(null);
    }
  }
  return { KEY, MODE, modes, task, words, usedWords, criterionKeys, validReport, sanitize, read };
});
