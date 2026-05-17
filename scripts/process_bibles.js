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
          resolve(Array.isArray(url.match(/get-chapter/)) ? [] : null);
          return;
        }
        try {
          resolve(JSON.parse(data.replace(/^\uFEFF/, '')));
        } catch (e) {
          resolve(Array.isArray(url.match(/get-chapter/)) ? [] : null);
        }
      });
    }).on('error', () => resolve(Array.isArray(url.match(/get-chapter/)) ? [] : null));
  });
}

const bollsCache = {};

async function fetchBollsChapter(translation, bookId, chapterId) {
  const cacheKey = `${translation}-${bookId}-${chapterId}`;
  if (bollsCache[cacheKey]) return bollsCache[cacheKey];
  
  const url = `https://bolls.life/get-chapter/${translation}/${bookId}/${chapterId}/`;
  
  let data = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    data = await fetchJson(url);
    if (Array.isArray(data) && data.length > 0) {
      break;
    }
    console.log(`\nRetry ${attempt} for ${translation} ${bookId}:${chapterId}`);
    await delay(500 * attempt);
  }

  const chapterMap = {};
  if (Array.isArray(data)) {
    data.forEach(item => {
      let text = item.text || '';
      // Remove html tags, commonly used in NET for footnotes/formatting
      text = text.replace(/<[^>]+>/g, '').trim(); 
      chapterMap[item.verse] = text; 
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

    console.log('Fetching NET book list...');
    const netBooks = await fetchJson('https://bolls.life/get-books/NET/');
    if (!netBooks || netBooks.length === 0) {
      throw new Error('Failed to fetch NET books');
    }

    console.log('Processing and aligning data using NET as standard...');
    const unifiedData = [];
    
    for (let b = 0; b < netBooks.length; b++) {
      const bookNet = netBooks[b];
      const bookNum = bookNet.bookid;
      const bookName = bookNet.name;
      const isOT = bookNum <= 39; 
      
      const bookKjv = kjvData[b] || { chapters: [], abbrev: bookName };
      const bookKrv = krvData[b] || { chapters: [] };
      const bookGreek = greekData[b] || { chapters: [] };

      process.stdout.write(`Processing Book ${bookNum}/${netBooks.length} (${bookName})...\r`);

      const wlcChapters = [];
      const netChapters = [];
      const webChapters = [];
      const batchSize = 10;
      
      for (let i = 0; i < bookNet.chapters; i += batchSize) {
        const netBatch = [];
        const webBatch = [];
        const wlcBatch = [];
        for (let j = 0; j < batchSize && (i + j) < bookNet.chapters; j++) {
          const chapterNum = i + j + 1;
          netBatch.push(fetchBollsChapter('NET', bookNum, chapterNum));
          webBatch.push(fetchBollsChapter('WEB', bookNum, chapterNum));
          if (isOT) {
            wlcBatch.push(fetchBollsChapter('WLC', bookNum, chapterNum));
          } else {
            wlcBatch.push(Promise.resolve({}));
          }
        }
        const [netRes, webRes, wlcRes] = await Promise.all([
          Promise.all(netBatch),
          Promise.all(webBatch),
          Promise.all(wlcBatch)
        ]);
        
        netChapters.push(...netRes);
        webChapters.push(...webRes);
        wlcChapters.push(...wlcRes);
        await delay(50); // slight delay to avoid rate limiting
      }

      for (let c = 0; c < bookNet.chapters; c++) {
        const chapterNum = c + 1;
        const netChapterMap = netChapters[c] || {};
        const webChapterMap = webChapters[c] || {};
        const wlcChapterMap = wlcChapters[c] || {};

        const chapterKjv = bookKjv.chapters[c] || [];
        const chapterKrv = bookKrv.chapters[c] || [];
        const chapterGreek = bookGreek.chapters[c] || [];

        // NET defines the verses
        const verses = Object.keys(netChapterMap).map(Number).sort((a,b)=>a-b);
        const maxVerse = verses.length > 0 ? Math.max(...verses) : chapterKjv.length;
        
        for (let v = 1; v <= maxVerse; v++) {
          const verseNet = netChapterMap[v] || '';
          // If NET has no verse here, we skip it because NET is the standard.
          // Wait, sometimes a verse is empty in some translations but exists in standard.
          // To be safe, if verseNet is empty and it's outside the keys, we might still include it if others have it?
          // The user said: "성경장절 기준은 NET로 해줘" (Standardize based on NET)
          if (!verseNet && !verses.includes(v)) continue;

          const verseWeb = webChapterMap[v] || '';
          const verseWlc = isOT ? (wlcChapterMap[v] || '') : 'Not Available (NT)';
          
          const verseKjv = chapterKjv[v - 1] || '';
          const verseKrv = chapterKrv[v - 1] || '';
          const verseGreek = chapterGreek[v - 1] || '';

          unifiedData.push({
            id: `${bookKjv.abbrev || bookName.substring(0,3)}-${chapterNum}-${v}`,
            index: `${bookName} ${chapterNum}:${v}`,
            net: verseNet,
            web: verseWeb,
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
