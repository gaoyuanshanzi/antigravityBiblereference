/* global process */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const KRV_URL = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/ko/KorRV/KorRV.json';
const GREEK_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/el_greek.json';
const CUV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/zh_cuv.json';
const KOUGO_URL = 'https://bolls.life/static/translations/JPKJV.json';

function fetchJson(url) {
  return new Promise((resolve) => {
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
        } catch {
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
      text = text.replace(/<[^>]+>/g, '').trim(); 
      chapterMap[item.verse] = text; 
    });
  }
  bollsCache[cacheKey] = chapterMap;
  return chapterMap;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function processBibles() {
  console.log('Downloading Base Bible datasets...');
  try {
    const [kjvData, krvDataRes, greekData, cuvData, kougoDataRes] = await Promise.all([
      fetchJson(KJV_URL),
      fetchJson(KRV_URL),
      fetchJson(GREEK_URL),
      fetchJson(CUV_URL),
      fetchJson(KOUGO_URL)
    ]);
    
    // KRV is wrapped in { books: [...] }
    const krvData = krvDataRes && krvDataRes.books ? krvDataRes.books : [];

    // Build a map for JPKJV verses: bookNum-chapterNum-verseNum -> text
    const kougoMap = {};
    if (Array.isArray(kougoDataRes)) {
      kougoDataRes.forEach(item => {
        kougoMap[`${item.book}-${item.chapter}-${item.verse}`] = item.text;
      });
    }

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
      const bookCuv = cuvData[b] || { chapters: [] };

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

        const chapterKjv = bookKjv.chapters[c] || [];
        const chapterKrv = bookKrv.chapters[c]; // This is an object in scrollmapper format
        const chapterGreek = bookGreek.chapters[c] || [];
        const chapterCuv = bookCuv.chapters[c] || [];
        
        const verses = Object.keys(netChapterMap).map(Number).sort((a,b)=>a-b);
        const maxVerse = verses.length > 0 ? Math.max(...verses) : chapterKjv.length;
        
        function mapWlcVersification(bNum, cNum, vNum) {
          if (bNum === 23 && cNum === 9) { // Isaiah 9
            if (vNum === 1) return { mappedChapter: 8, mappedVerse: 23 };
            return { mappedChapter: 9, mappedVerse: vNum - 1 };
          }
          return { mappedChapter: cNum, mappedVerse: vNum };
        }
        
        for (let v = 1; v <= maxVerse; v++) {
          const verseNet = netChapterMap[v] || '';
          if (!verseNet && !verses.includes(v)) continue;

          const verseWeb = webChapterMap[v] || '';
          
          let verseWlc = 'Not Available (NT)';
          if (isOT) {
            const { mappedChapter, mappedVerse } = mapWlcVersification(bookNum, chapterNum, v);
            const wlcMap = wlcChapters[mappedChapter - 1] || {};
            verseWlc = wlcMap[mappedVerse] || '';
          }
          
          const verseKjv = chapterKjv[v - 1] || '';
          const verseGreek = chapterGreek[v - 1] || '';
          const verseCuv = chapterCuv[v - 1] || '';
          
          let verseKrv = '';
          if (chapterKrv && chapterKrv.verses) {
            const vObj = chapterKrv.verses.find(vo => String(vo.verse) === String(v));
            if (vObj) {
              verseKrv = vObj.text;
            } else if (chapterKrv.verses[v - 1]) {
              verseKrv = chapterKrv.verses[v - 1].text || '';
            }
          }
          
          let verseKougo = '';
          const kougoKey = `${bookNum}-${chapterNum}-${v}`;
          if (kougoMap[kougoKey]) {
            let text = kougoMap[kougoKey];
            // Remove rubi tags first
            text = text.replace(/<sup>.*?<\/sup>/g, '');
            // Strip other HTML tags
            text = text.replace(/<[^>]+>/g, '').trim();
            verseKougo = text;
          }

          unifiedData.push({
            id: `${bookKjv.abbrev || bookName.substring(0,3)}-${chapterNum}-${v}`,
            index: `${bookName} ${chapterNum}:${v}`,
            net: verseNet,
            web: verseWeb,
            kjv: verseKjv,
            krv: verseKrv,
            cuv: verseCuv,
            kougo: verseKougo,
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
