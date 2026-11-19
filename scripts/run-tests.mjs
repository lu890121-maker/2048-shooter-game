import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const tmpDir = path.join(rootDir, '.test-build');

function splitTopLevelParams(str) {
  const parts = [];
  let depth = 0;
  let angle = 0;
  let cur = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === '<') angle++;
    else if (ch === '>' && str[i - 1] !== '=') angle = Math.max(0, angle - 1);
    if (ch === ',' && depth === 0 && angle === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) parts.push(cur);
  return parts;
}

function stripParamType(param) {
  let depth = 0;
  let angle = 0;
  let colonIdx = -1;
  let eqIdx = -1;
  for (let i = 0; i < param.length; i++) {
    const ch = param[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === '<') angle++;
    else if (ch === '>' && param[i - 1] !== '=') angle = Math.max(0, angle - 1);
    else if (ch === ':' && depth === 0 && angle === 0 && colonIdx === -1) colonIdx = i;
    else if (ch === '=' && param[i + 1] !== '>' && depth === 0 && angle === 0 && eqIdx === -1) eqIdx = i;
  }
  if (colonIdx === -1) return param;
  const namePart = param.slice(0, colonIdx).replace(/\?\s*$/, '');
  const defaultPart = eqIdx !== -1 ? ' ' + param.slice(eqIdx) : '';
  return namePart + defaultPart;
}

function stripTypeScript(code) {
  let out = code;

  // Convert `export enum Name { A = 'A', ... }` into `export const Name = { A: 'A', ... };`
  out = out.replace(/export\s+enum\s+(\w+)\s*\{([\s\S]*?)\}/g, (_, name, body) => {
    const mapped = body
      .split('\n')
      .map((line) => line.replace(/^\s*(\w+)\s*=\s*([^,]+),?\s*$/, '  $1: $2,'))
      .join('\n');
    return `export const ${name} = {\n${mapped}\n};`;
  });

  // Remove `export interface ... { ... }` and `interface ... { ... }`
  out = out.replace(/^(?:export\s+)?interface\s+\w+(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?^\}/gm, '');

  // Remove `export type ... = ...;`
  out = out.replace(/^(?:export\s+)?type\s+\w+(?:<[^>]+>)?\s*=[\s\S]*?;\s*$/gm, '');

  // Remove `import type ...` and type-only named imports
  const typeNames = new Set(["GameBoard", "Position", "Tile", "TileMove", "PlacedTile", "MergeEvent", "ShotResult", "SpawnConfig", "TileStyle", "ScoreSnapshot", "GameManagerOptions", "MergeGroup", "ChainResolutionResult"]);
  out = out.replace(/^import\s*\{([^}]+)\}\s*from\s*([^;]+);\s*$/gm, (_, names, fromSpec) => {
    const kept = names.split(",").map(n => n.trim()).filter(n => n && !typeNames.has(n));
    return kept.length ? `import { ${kept.join(", ")} } from ${fromSpec};` : "";
  });
  out = out.replace(/^import\s+type\s+.*$/gm, '');

  // Rewrite relative imports to include .mjs
  out = out.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, p1, spec, p3) => {
    return `${p1}${spec.endsWith('.mjs') ? spec : spec + '.mjs'}${p3}`;
  });

  // Remove `as const`, `as TypeName[]`, `as readonly TypeName[]`
  out = out.replace(/\s+as\s+(?:const|readonly\s+[\w.<>\[\]]+|[\w.<>\[\]]+)/g, '');

  // Class field visibility & readonly modifiers
  out = out.replace(/^(\s*)(?:public|private|protected)\s+(?:readonly\s+)?/gm, '$1');
  out = out.replace(/^(\s*)readonly\s+/gm, '$1');

  // Remove return type annotations on methods/functions `): ReturnType {` or `): ReturnType =>`
  out = out.replace(/\)\s*:\s*(?:\(\)\s*=>\s*\w+|Array<\{[^}]+\}>|\{[^}]+\}|(?:readonly\s+)?[\w.<>\[\]|&\s,?]+)(?=\s*(?:\{|=>))/g, ')');

  // Strip parameter lists on constructors, functions, methods, and arrow functions
  const stripParams = (paramsStr) => splitTopLevelParams(paramsStr).map(stripParamType).join(',');

  // Match `function name(...)` or `constructor(...)` or `methodName(...) {`
  out = out.replace(/(^|\n)(\s*(?:export\s+)?(?:async\s+)?(?:static\s+)?(?:function\s+\w+|constructor|\w+))\s*\(/gm, (full, nl, head) => {
    if (/^\s*(if|for|while|switch|catch|return|new)\b/.test(head)) return full;
    return `${nl}${head}(`;
  });

  // Scan for parameter lists followed by `{` or `=>`
  let res = '';
  let i = 0;
  while (i < out.length) {
    if (out[i] === '(') {
      // Check if preceded by identifier or `=` or `,` or start of arrow
      const prev = out.slice(Math.max(0, i - 30), i);
      const isCallOrCond = /\b(if|for|while|switch|catch)\s*$/.test(prev);
      if (!isCallOrCond) {
        let depth = 1;
        let j = i + 1;
        while (j < out.length && depth > 0) {
          if (out[j] === '(') depth++;
          else if (out[j] === ')') depth--;
          j++;
        }
        if (depth === 0) {
          const after = out.slice(j, j + 10);
          if (/^\s*(?:\{|=>)/.test(after)) {
            const inner = out.slice(i + 1, j - 1);
            res += `(${stripParams(inner)})`;
            i = j;
            continue;
          }
        }
      }
    }
    res += out[i];
    i++;
  }
  out = res;

  // Variable type annotations `const x: Type =` or `let x: Type =` or `let x: Type;`
  out = out.replace(
    /\b(const|let|var)\s+(\w+)\s*:\s*(?:readonly\s+)?(?:Array<[^>]+>|Set<[^>]+>|Record<[^>]+>|[\w.{}<>\[\]|&\s]+?)(?=\s*[=;])/g,
    '$1 $2'
  );

  // Class property declarations with initializer
  out = out.replace(/^(\s*)(\w+)\s*:\s*[\w.<>\[\]|&]+(?:\s*[|&]\s*[\w.<>\[\]|&]+)*\s*=(?!=)/gm, '$1$2 =');

  // Class property declarations without initializer like `board: GameBoard;`
  out = out.replace(/^(\s*)(\w+)\s*:\s*(?:\(\)\s*=>\s*\w+|[\w.<>\[\]|&\s]+);\s*$/gm, '$1$2;');

  // Generic type arguments on constructors/calls like `new Set<number>()`
  out = out.replace(/\b(Set|Map|Array)<[^>()]+>\(/g, '$1(');

  // Non-null assertions `!.` or `)!`
  out = out.replace(/!\./g, '.');
  out = out.replace(/(\w+\([^)]*\))!/g, '$1');

  return out;
}

function compileDir(srcRel) {
  const srcAbs = path.join(rootDir, srcRel);
  const dstAbs = path.join(tmpDir, srcRel);
  fs.mkdirSync(dstAbs, { recursive: true });
  for (const entry of fs.readdirSync(srcAbs, { withFileTypes: true })) {
    const s = path.join(srcAbs, entry.name);
    const d = path.join(dstAbs, entry.name);
    if (entry.isDirectory()) {
      compileDir(path.join(srcRel, entry.name));
    } else if (entry.name.endsWith('.ts')) {
      const tsCode = fs.readFileSync(s, 'utf8');
      const jsCode = stripTypeScript(tsCode);
      fs.writeFileSync(d.replace(/\.ts$/, '.mjs'), jsCode, 'utf8');
    }
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });
compileDir('src/config');
compileDir('src/core');
compileDir('tests');

const testEntry = pathToFileURL(path.join(tmpDir, 'tests/core.test.mjs')).href;
await import(testEntry);
