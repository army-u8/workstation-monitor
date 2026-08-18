import { zh } from '../src/i18n/dict/zh';
import { en } from '../src/i18n/dict/en';

function extractKeysAndPlaceholders(obj: any, prefix = ''): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = extractKeysAndPlaceholders(val, fullKey);
      for (const [k, v] of nested) {
        map.set(k, v);
      }
    } else if (typeof val === 'string') {
      const matches = val.match(/\{[a-zA-Z0-9_]+\}/g) || [];
      map.set(fullKey, matches.sort());
    }
  }
  return map;
}

const zhMap = extractKeysAndPlaceholders(zh);
const enMap = extractKeysAndPlaceholders(en);

let errors = 0;

// 1. Check for keys in zh missing in en
for (const key of zhMap.keys()) {
  if (!enMap.has(key)) {
    console.error(`❌ [i18n Error] Missing English key for: "${key}"`);
    errors++;
  }
}

// 2. Check for keys in en missing in zh
for (const key of enMap.keys()) {
  if (!zhMap.has(key)) {
    console.error(`❌ [i18n Error] Extra English key not in Chinese: "${key}"`);
    errors++;
  }
}

// 3. Check placeholder token parity
for (const [key, zhPlaceholders] of zhMap) {
  const enPlaceholders = enMap.get(key);
  if (enPlaceholders) {
    const zhStr = zhPlaceholders.join(',');
    const enStr = enPlaceholders.join(',');
    if (zhStr !== enStr) {
      console.warn(
        `⚠️ [i18n Warning] Placeholder mismatch for "${key}": ZH=[${zhStr}] vs EN=[${enStr}]`,
      );
    }
  }
}

if (errors > 0) {
  console.error(`\n💥 Total i18n dictionary errors: ${errors}`);
  process.exit(1);
} else {
  console.log(`✅ All ${zhMap.size} i18n keys are 100% synchronized across ZH & EN!`);
}
