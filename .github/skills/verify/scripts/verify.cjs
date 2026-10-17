// typecheck / lint / test (/ build) を順に実行し、失敗したタスクのログだけを表示する。
const { spawnSync } = require('node:child_process');

const PACKAGE_NAME = /^@repo\/[a-z0-9-]+$/;
const TASKS = ['typecheck', 'lint', 'test', 'build'];

function parseArgs(argv) {
  const filters = [];
  let build = false;
  let only = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--build') build = true;
    else if (arg === '--filter' || arg === '--only') {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} の値がありません`);
      if (arg === '--filter') filters.push(value);
      else only = value;
    } else throw new Error(`不明なオプション: ${arg}`);
  }
  // シェル経由で実行するため、値は許可した形式だけを通す。
  for (const f of filters) {
    if (!PACKAGE_NAME.test(f)) throw new Error(`不正なパッケージ名: ${f}`);
  }
  if (only && !TASKS.includes(only)) throw new Error(`不正なタスク: ${only}`);
  const tasks = only ? [only] : TASKS.filter((t) => t !== 'build' || build);
  return { filters, tasks };
}

function run(task, filters) {
  const args = ['turbo', 'run', task, '--output-logs=errors-only'];
  for (const f of filters) args.push(`--filter=${f}`);
  const started = Date.now();
  const result = spawnSync('pnpm', args, { encoding: 'utf8', shell: true });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { task, ok: result.status === 0, seconds, output };
}

function tail(text, lines) {
  return text.trimEnd().split(/\r?\n/).slice(-lines).join('\n');
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(2);
  }

  const results = options.tasks.map((task) => run(task, options.filters));

  for (const r of results.filter((r) => !r.ok)) {
    console.log(`\n===== ❌ ${r.task} のエラー (末尾 60 行) =====\n${tail(r.output, 60)}`);
  }

  const scope = options.filters.length ? options.filters.join(', ') : '全パッケージ';
  console.log(`\n検証結果 (${scope})`);
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.task} (${r.seconds}s)`);

  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

if (require.main === module) main();

module.exports = { parseArgs };
