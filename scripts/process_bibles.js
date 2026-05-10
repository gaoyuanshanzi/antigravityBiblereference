import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const KRV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/ko_ko.json';

// Bolls Life API mapping
// KJV Book Index (1-indexed) to LXX Book Index (1-indexed)
const KJV_TO_LXX = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14,
  15: 15, // Ezra
  16: 15, // Nehemiah (mapped to Ezra in LXX, though verses won't align perfectly)
  17: 16, // Esther
  18: 17, // Job
  19: 18, // Psalms
  20: 19, // Proverbs
  21: 20, // Ecclesiastes
  22: 21, // Song of Solomon
  23: 22, // Isaiah
  24: 23, // Jeremiah
  25: 24, // Lamentations
  26: 25, // Ezekiel
  27: 26, // Daniel
  28: 27, // Hosea
  29: 28, // Joel
  30: 29, // Amos
  31: 30, // Obadiah
  32: 31, // Jonah
  33: 32, // Micah
  34: 33, // Nahum
  35: 34, // Habakkuk
  36: 35, // Zephaniah
  37: 36, // Haggai
  38: 37, // Zechariah
  39: 38  // Malachi
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          resolve([]); // Silently fail for 404s
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

// Global cache for fetched chapters to avoid re-fetching Nehemiah/Ezra etc.
const bollsCache = {};

async function fetchBollsChapter(translation, bookId, chapterId) {
  const cacheKey = `${translation}-${bookId}-${chapterId}`;
  if (bollsCache[cacheKey]) return bollsCache[cacheKey];
  
  const url = `https://bolls.life/get-chapter/${translation}/${bookId}/${chapterId}/`;
  const data = await fetchJson(url);
  
  // Format into a map of verse -> text
  const chapterMap = {};
  if (Array.isArray(data)) {
    data.forEach(item => {
      chapterMap[item.verse] = item.text.replace(/<[^>]+>/g, '').trim(); // strip html if any
    });
  }
  bollsCache[cacheKey] = chapterMap;
  return chapterMap;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function processBibles() {
  console.log('Downloading Base Bible datasets (KJV & KRV)...');
  try {
    const [kjvData, krvData] = await Promise.all([
      fetchJson(KJV_URL),
      fetchJson(KRV_URL)
    ]);

    console.log('Processing and aligning data, fetching WLC and LXX via API...');
    const unifiedData = [];
    
    // We will batch our API requests to not overwhelm the server
    for (let b = 0; b < kjvData.length; b++) {
      const bookKjv = kjvData[b];
      const bookKrv = krvData[b] || { chapters: [] };
      const bookName = bookKjv.name || bookKjv.abbrev.toUpperCase();
      const isOT = b < 39; // First 39 books are Old Testament
      
      const bookNum = b + 1;
      const lxxBookNum = KJV_TO_LXX[bookNum];

      process.stdout.write(`Processing Book ${bookNum}/${kjvData.length} (${bookName})...\r`);

      for (let c = 0; c < bookKjv.chapters.length; c++) {
        const chapterKjv = bookKjv.chapters[c];
        const chapterKrv = bookKrv.chapters[c] || [];
        const chapterNum = c + 1;

        let wlcChapterMap = {};
        let lxxChapterMap = {};

        if (isOT) {
          // Fetch WLC and LXX in parallel
          const [wlcResult, lxxResult] = await Promise.all([
            fetchBollsChapter('WLC', bookNum, chapterNum),
            lxxBookNum ? fetchBollsChapter('LXX', lxxBookNum, chapterNum) : Promise.resolve({})
          ]);
          wlcChapterMap = wlcResult;
          lxxChapterMap = lxxResult;
          await delay(20); // Small delay to prevent rate limit
        }

        for (let v = 0; v < chapterKjv.length; v++) {
          const verseNum = v + 1;
          const verseKjv = chapterKjv[v];
          const verseKrv = chapterKrv[v] || '';

          // Match verse by number. For Nehemiah/Ezra or Psalms, numbering might be slightly off.
          // This is a best-effort alignment for a free client-side tool.
          const verseWlc = isOT ? (wlcChapterMap[verseNum] || '') : 'OT Only';
          const verseLxx = isOT ? (lxxChapterMap[verseNum] || '') : 'OT Only';

          unifiedData.push({
            id: `${bookKjv.abbrev}-${chapterNum}-${verseNum}`,
            index: `${bookName} ${chapterNum}:${verseNum}`,
            kjv: verseKjv,
            krv: verseKrv,
            wlc: verseWlc,
            lxx: verseLxx
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
