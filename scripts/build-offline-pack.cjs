#!/usr/bin/env node
// Build the optional starter pack entirely from the installed WordNet database.
// Edit this list to change the downloadable pack; never put API keys here.
const fs = require('node:fs/promises');
const path = require('node:path');
const { vietnameseGloss } = require('../lib/vietnamese');
const { teachingCollocations } = require('../lib/collocations');

const words = [
  ['intermediate'], ['experiment', 'thí nghiệm; cuộc thử nghiệm; thử nghiệm'],
  ['borrow', 'vay, mượn; vay mượn (ý tưởng, từ ngữ)'],
  ['happy', 'vui vẻ, hạnh phúc; hài lòng'], ['sad', 'buồn; đáng buồn'],
  ['good', 'tốt; điều tốt, lợi ích'], ['bad', 'xấu, tệ; có hại'],
  ['book', 'sách; đặt trước, đặt chỗ'], ['school', 'trường học; dạy, rèn luyện'],
  ['friend', 'bạn; người ủng hộ'], ['work', 'công việc; làm việc; tác phẩm'],
  ['learn', 'học; biết được, tìm hiểu được'], ['hello', 'xin chào; lời chào'],
  ['world', 'thế giới; lĩnh vực, giới'], ['water', 'nước; tưới nước'],
  ['food', 'thức ăn, thực phẩm'], ['home', 'nhà, nơi ở; về nhà'],
  ['day', 'ngày; ban ngày'], ['time', 'thời gian; lần; tính giờ'],
  ['language', 'ngôn ngữ; cách diễn đạt'],
  // Short English words that can otherwise be confused with Vietnamese text.
  ['loan'], ['bank'], ['can'], ['may'], ['do'], ['go'], ['song'], ['son'],
  ['chin'], ['long'], ['man'], ['tan'], ['fan'], ['mine'], ['rose'], ['name'],
  ['tin'], ['ham'], ['dam'], ['ram'], ['mom'], ['dad'], ['sun'], ['ten'],
  ['den'], ['ton'], ['gun'], ['van'], ['bin'], ['pan']
];

async function buildOfflinePack() {
  const lexicon = require('../lib/lexicon');
  try {
    const licensePath = path.join(path.dirname(require.resolve('wordnet-db/package.json')), 'LICENSE');
    const license = await fs.readFile(licensePath, 'utf8');
    const entries = [];
    for (const [word, customGloss] of words) {
      const gloss = customGloss || vietnameseGloss(word);
      const meanings = await lexicon.wordnetMeanings(word);
      if (!gloss || !meanings.length) throw new Error(`Missing starter-pack data for ${word}`);
      entries.push({
        word,
        gloss,
        result: {
          query: word,
          word,
          from: 'en',
          entries: [{
            word,
            ipa: '',
            source: 'Princeton WordNet',
            meanings,
            collocations: { teaching: teachingCollocations(word), corpus: [], pending: false }
          }],
          enriching: false
        }
      });
    }
    return { version: 1, source: 'Princeton WordNet', license, entries };
  } finally {
    lexicon.close();
  }
}

async function main() {
  const pack = await buildOfflinePack();
  const contents = `${JSON.stringify(pack)}\n`;
  const bytes = Buffer.byteLength(contents);
  if (pack.entries.length > 100 || bytes > 750000) throw new Error('Offline pack exceeds the app download limit');
  const assets = path.resolve(__dirname, '../public/assets');
  await fs.mkdir(assets, { recursive: true });
  await fs.writeFile(path.join(assets, 'offline-basics.json'), contents);
  await fs.writeFile(path.join(assets, 'wordnet-license.txt'), pack.license);
  process.stdout.write(`Built ${pack.entries.length} offline words (${bytes} bytes).\n`);
}

if (require.main === module) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
module.exports = { buildOfflinePack };
