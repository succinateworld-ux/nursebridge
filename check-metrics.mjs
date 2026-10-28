// Isolated checks work with the workspace TypeScript compiler even when npm is offline.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const ts = require('typescript');
await mkdir('.metrics-check', { recursive: true });
await writeFile('.metrics-check/package.json', '{"type":"module"}');
for (const file of ['analytics', 'metrics-database']) {
  const source = await readFile(`server/${file}.ts`, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  await writeFile(`.metrics-check/${file}.js`, result.outputText);
  const check = (await readFile(`server/${file}.check.mjs`, 'utf8')).replace("'./analytics.ts'", "'./analytics.js'");
  await writeFile(`.metrics-check/${file}.check.mjs`, check);
}
const result = spawnSync(process.execPath, ['--test', '.metrics-check/analytics.check.mjs', '.metrics-check/metrics-database.check.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
