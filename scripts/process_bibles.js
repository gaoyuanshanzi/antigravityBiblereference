import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const KRV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/ko_ko.json';
const GREEK_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/el_greek.json';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          resolve([]); 
          return;
        }
        try {
          resolve(JSON.parse(data.replace(/^\uFEFF/, '')));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

const bollsCache = {};

async function fetchBollsChapter(translation, bookId, chapterId) {
  const cacheKey = `${translation}-${bookId}-${chapterId}`;
  if (bollsCache[cacheKey]) return bollsCache[cacheKey];
  
  const url = `https://bolls.life/get-chapter/${translation}/${bookId}/${chapterId}/`;
  const data = await fetchJson(url);
  
  const chapterMap = {};
  if (Array.isArray(data)) {
    data.forEach(item => {
      chapterMap[item.verse] = item.text.replace(/<[^>]+>/g, '').trim(); 
    });
  }
  bollsCache[cacheKey] = chapterMap;
  return chapterMap;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function processBibles() {
  console.log('Downloading Base Bible datasets (KJV, KRV, Greek)...');
  try {
    const [kjvData, krvData, greekData] = await Promise.all([
      fetchJson(KJV_URL),
      fetchJson(KRV_URL),
      fetchJson(GREEK_URL)
    ]);

    console.log('Processing and aligning data, fetching WLC (Hebrew) via API...');
    const unifiedData = [];
    
    for (let b = 0; b < kjvData.length; b++) {
      const bookKjv = kjvData[b];
      const bookKrv = krvData[b] || { chapters: [] };
      const bookGreek = greekData[b] || { chapters: [] };
      const bookName = bookKjv.name || bookKjv.abbrev.toUpperCase();
      const isOT = b < 39; 
      
      const bookNum = b + 1;

      process.stdout.write(`Processing Book ${bookNum}/${kjvData.length} (${bookName})...\r`);

      const chapterPromises = [];
      for (let c = 0; c < bookKjv.chapters.length; c++) {
        const chapterNum = c + 1;
        if (isOT) {
          chapterPromises.push(fetchBollsChapter('WLC', bookNum, chapterNum));
        } else {
          chapterPromises.push(Promise.resolve({}));
        }
      }

      const wlcChapters = await Promise.all(chapterPromises);

      for (let c = 0; c < bookKjv.chapters.length; c++) {
        const chapterKjv = bookKjv.chapters[c];
        const chapterKrv = bookKrv.chapters[c] || [];
        const chapterGreek = bookGreek.chapters[c] || [];
        const chapterNum = c + 1;

        const wlcChapterMap = wlcChapters[c];

        for (let v = 0; v < chapterKjv.length; v++) {
          const verseNum = v + 1;
          const verseKjv = chapterKjv[v];
          const verseKrv = chapterKrv[v] || '';
          const verseGreek = chapterGreek[v] || '';

          const verseWlc = isOT ? (wlcChapterMap[verseNum] || '') : 'Not Available (NT)';

          unifiedData.push({
            id: `${bookKjv.abbrev}-${chapterNum}-${verseNum}`,
            index: `${bookName} ${chapterNum}:${verseNum}`,
            kjv: verseKjv,
            krv: verseKrv,
            wlc: verseWlc,
            lxx: verseGreek
          });
        }
      }
    }
    console.log('\nProcessing complete!');
    const outputPath = path.join(__dirname, '../public/data/bible_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(unifiedData));
    console.log(`Successfully wrote ${unifiedData.length} verses to ${outputPath}`);

  } catch (error) {
    console.error('Error processing bibles:', error);
  }
}

processBibles();
