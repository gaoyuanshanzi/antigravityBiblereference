import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const KRV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/ko_ko.json';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data.replace(/^\uFEFF/, '')));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function processBibles() {
  console.log('Downloading Bible datasets...');
  try {
    const [kjvData, krvData] = await Promise.all([
      fetchJson(KJV_URL),
      fetchJson(KRV_URL)
    ]);

    console.log('Processing and aligning data...');
    const unifiedData = [];

    // Iterate over KJV books
    for (let b = 0; b < kjvData.length; b++) {
      const bookKjv = kjvData[b];
      const bookKrv = krvData[b] || { chapters: [] };
      const bookName = bookKjv.name || bookKjv.abbrev.toUpperCase();

      for (let c = 0; c < bookKjv.chapters.length; c++) {
        const chapterKjv = bookKjv.chapters[c];
        const chapterKrv = bookKrv.chapters[c] || [];

        for (let v = 0; v < chapterKjv.length; v++) {
          const verseKjv = chapterKjv[v];
          const verseKrv = chapterKrv[v] || '';

          // For WLC and LXX, we simulate data as perfectly aligned datasets are hard to find in simple JSON arrays.
          // A real dataset would require mapping Hebrew/Greek verses to English/Korean ones.
          const verseWlc = bookKjv.abbrev.match(/gn|ex|lv|nm|dt|js|jg|rt|sm|kg|ch|er|ne|et|jb|ps|pr|ec|ca|is|jr|lm|ez|dn|hs|jl|am|ob|jn|mi|na|hk|zp|hg|zc|ml/i) 
                            ? `בְּרֵאשִׁ֖ית (Mock WLC - ${bookName} ${c+1}:${v+1})` : ''; // WLC is OT only usually
          const verseLxx = `Ἐν ἀρχῇ (Mock LXX - ${bookName} ${c+1}:${v+1})`;

          unifiedData.push({
            id: `${bookKjv.abbrev}-${c + 1}-${v + 1}`,
            index: `${bookName} ${c + 1}:${v + 1}`,
            kjv: verseKjv,
            krv: verseKrv,
            wlc: verseWlc,
            lxx: verseLxx
          });
        }
      }
    }

    const outputPath = path.join(__dirname, '../public/data/bible_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(unifiedData));
    console.log(`Successfully wrote ${unifiedData.length} verses to ${outputPath}`);

  } catch (error) {
    console.error('Error processing bibles:', error);
  }
}

processBibles();
