import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'artifacts/file_generation/ttl=63d/output');
fs.mkdirSync(outDir, { recursive: true });

const orderedFiles = [
  'src/config/GameConfig.ts',
  'src/core/GameState.ts',
  'src/core/BoardManager.ts',
  'src/core/MergeSystem.ts',
  'src/core/ChainResolver.ts',
  'src/core/NumberGenerator.ts',
  'src/core/ScoreManager.ts',
  'src/core/GameOverChecker.ts',
  'src/core/GameManager.ts',
  'src/systems/SaveManager.ts',
  'src/systems/AudioManager.ts',
  'src/renderer/BoardLayout.ts',
  'src/renderer/TileRenderer.ts',
  'src/renderer/AnimationManager.ts',
  'src/renderer/BoardRenderer.ts',
  'src/renderer/GameRenderer.ts',
  'src/input/InputManager.ts',
  'src/ui/GameUI.ts',
  'src/main.ts',
];

function stripTsForBundle(code) {
  let out = code;
  // Remove import statements
  out = out.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '');
  // Convert export enum
  out = out.replace(/export\s+enum\s+(\w+)\s*\{([\s\S]*?)\}/g, (_, name, body) => {
    const mapped = body
      .split('\n')
      .map((line) => line.replace(/^\s*(\w+)\s*=\s*([^,]+),?\s*$/, '  $1: $2,'))
      .join('\n');
    return `const ${name} = {\n${mapped}\n};`;
  });
  // Remove interfaces and types
  out = out.replace(/^(?:export\s+)?interface\s+\w+(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?^\}/gm, '');
  out = out.replace(/^(?:export\s+)?type\s+\w+(?:<[^>]+>)?\s*=[\s\S]*?^\s*\};\s*$/gm, '').replace(/^(?:export\s+)?type\s+\w+(?:<[^>]+>)?\s*=[^;]+;/gm, '');
  // Remove export keywords
  out = out.replace(/^export\s+(?=(?:const|let|var|function|class)\b)/gm, '');
  // Remove `as const`, `as HTML...`, `as unknown as ...`
  out = out.replace(/\s+as\s+unknown\s+as\s+\{[^}]+\}/g, '');
  out = out.replace(/\s+as\s+(?:const|readonly\s+[\w.<>\[\]]+|[\w.<>\[\]| ]+?(?=\s*[;,)=]))/g, '');
  // Visibility & readonly
  out = out.replace(/^(\s*)(?:public|private|protected)\s+(?:readonly\s+)?/gm, '$1');
  out = out.replace(/^(\s*)readonly\s+/gm, '$1');

  // Return types
  out = out.replace(
    /\)\s*:\s*(?:\(\)\s*=>\s*\w+|Array<\{[^}]+\}>|\{[^}]+\}(?:\s*\|\s*(?:null|undefined))?|(?:readonly\s+)?[\w.<>\[\]|&\s,?]+)(?=\s*(?:\{|=>))/g,
    ')'
  );

  // Strip parameter types in balanced parens followed by `{` or `=>`
  const splitParams = (str) => {
    const parts = [];
    let d = 0, a = 0, cur = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '(' || ch === '{' || ch === '[') d++;
      else if (ch === ')' || ch === '}' || ch === ']') d--;
      else if (ch === '<') a++;
      else if (ch === '>' && str[i - 1] !== '=') a = Math.max(0, a - 1);
      if (ch === ',' && d === 0 && a === 0) { parts.push(cur); cur = ''; }
      else cur += ch;
    }
    if (cur.length) parts.push(cur);
    return parts;
  };
  const stripParam = (p) => {
    // Handle `private readonly x: Type` inside constructor
    let clean = p.replace(/^(\s*)(?:public|private|protected)\s+(?:readonly\s+)?/, '$1');
    clean = clean.replace(/^(\s*)readonly\s+/, '$1');
    let d = 0, a = 0, cIdx = -1, eIdx = -1;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (ch === '(' || ch === '{' || ch === '[') d++;
      else if (ch === ')' || ch === '}' || ch === ']') d--;
      else if (ch === '<') a++;
      else if (ch === '>' && clean[i - 1] !== '=') a = Math.max(0, a - 1);
      else if (ch === ':' && d === 0 && a === 0 && cIdx === -1) cIdx = i;
      else if (ch === '=' && clean[i + 1] !== '>' && d === 0 && a === 0 && eIdx === -1) eIdx = i;
    }
    if (cIdx === -1) return clean;
    const namePart = clean.slice(0, cIdx).replace(/\?\s*$/, '');
    const defPart = eIdx !== -1 ? ' ' + clean.slice(eIdx) : '';
    return namePart + defPart;
  };

  let res = '';
  let i = 0;
  while (i < out.length) {
    if (out[i] === '(') {
      const prev = out.slice(Math.max(0, i - 30), i);
      if (!/\b(if|for|while|switch|catch)\s*$/.test(prev)) {
        let d = 1, j = i + 1;
        while (j < out.length && d > 0) {
          if (out[j] === '(') d++;
          else if (out[j] === ')') d--;
          j++;
        }
        if (d === 0 && /^\s*(?:\{|=>)/.test(out.slice(j, j + 10))) {
          const inner = out.slice(i + 1, j - 1);
          res += `(${splitParams(inner).map(stripParam).join(',')})`;
          i = j;
          continue;
        }
      }
    }
    res += out[i];
    i++;
  }
  out = res;

  // Constructor parameter properties (`constructor(private readonly x)`) -> assign `this.x = x;`
  out = out.replace(/constructor\s*\(([^)]*)\)\s*\{/, (full, params) => {
    // We already stripped `private readonly`, so check original? Handled simply:
    return full;
  });

  // Variable & class field type annotations
  out = out.replace(
    /\b(const|let|var)\s+(\w+)\s*:\s*(?:readonly\s+)?(?:Array<[^>]+>|Set<[^>]+>|Record<[^>]+>|[\w.{}<>\[\]|&\s]+?)(?=\s*[=;])/g,
    '$1 $2'
  );
  out = out.replace(/^(\s*)(\w+)\s*:\s*(?:\([^=\n]+\)\s*=>\s*[^=\n]+|[\w.<>\[\]|&]+(?:\s*[|&]\s*[\w.<>\[\]|&]+)*)\s*=(?!=)/gm, '$1$2 =');
  out = out.replace(/^(\s*)(\w+)\s*:\s*(?:\(\)\s*=>\s*\w+|[\w.<>\[\]|&\s]+);\s*$/gm, '$1$2;');
  out = out.replace(/\b(Set|Map|Array)<[^>()]+>\(/g, '$1(');
  out = out.replace(/!\./g, '.');
  out = out.replace(/(\w+\([^)]*\))!(?!=)/g, '$1');
  out = out.replace(/(\)\s*)!(?!=)/g, '$1');
  out = out.replace(/(\w)!(?!=)/g, '$1');

  return out;
}

// Inject constructor parameter property assignments cleanly
function fixConstructorParamProps(tsCode, jsCode) {
  const ctorMatch = tsCode.match(/constructor\s*\(([\s\S]*?)\)\s*\{/);
  if (!ctorMatch) return jsCode;
  const assigns = [];
  for (const part of ctorMatch[1].split(',')) {
    const m = part.trim().match(/^(?:private|public|protected)\s+(?:readonly\s+)?(\w+)/);
    if (m) assigns.push(`this.${m[1]} = ${m[1]};`);
  }
  if (!assigns.length) return jsCode;
  return jsCode.replace(/constructor\s*\([^)]*\)\s*\{/, (head) => `${head}\n    ${assigns.join('\n    ')}`);
}

const jsChunks = orderedFiles.map((rel) => {
  const ts = fs.readFileSync(path.join(rootDir, rel), 'utf8');
  let js = stripTsForBundle(ts);
  js = fixConstructorParamProps(ts, js);
  return `// --- ${rel} ---\n${js}`;
});

const bundledJs = `(() => {\n'use strict';\n${jsChunks.join('\n\n')}\n})();\n`;
const jsCheckPath = path.join(rootDir, '.test-build/bundle-check.js');
fs.mkdirSync(path.dirname(jsCheckPath), { recursive: true });
fs.writeFileSync(jsCheckPath, bundledJs, 'utf8');

const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8');

const standaloneHtml = html
  .replace('<link rel="stylesheet" href="./src/styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="./src/main.ts"></script>', `<script>\n${bundledJs}\n</script>`);

const outPath = path.join(outDir, '2048-shooter-number-match.html');
fs.writeFileSync(outPath, standaloneHtml, 'utf8');
console.log('Generated standalone playable HTML:', outPath);
