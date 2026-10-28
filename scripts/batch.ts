// Simulação em lote pela linha de comando: `npm run batch -- 90`
import { runBatch } from '../src/core/batch';
import { BALANCE } from '../src/core/balance';

const n = Number(process.argv[2] ?? BALANCE.dev.batchRuns);
const t0 = Date.now();
const report = runBatch(n);
console.log(JSON.stringify(report, null, 2));
console.log(`(${n} runs em ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
