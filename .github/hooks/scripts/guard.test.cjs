// guard.cjs のテスト。`node .github/hooks/scripts/guard.test.cjs` で実行する。
const assert = require('node:assert/strict');
const { evaluate } = require('./guard.cjs');
const { parseArgs } = require('../../skills/verify/scripts/verify.cjs');

const terminal = (command) => ({ tool_name: 'run_in_terminal', tool_input: { command } });
const read = (filePath) => ({ tool_name: 'read_file', tool_input: { filePath } });
const decisionOf = (input) => evaluate(input)?.hookSpecificOutput.permissionDecision ?? 'none';

const cases = [
  ['force push を拒否', terminal('git push --force origin main'), 'deny'],
  ['-f の push を拒否', terminal('git push origin main -f'), 'deny'],
  ['reset --hard を拒否', terminal('git reset --hard HEAD~1'), 'deny'],
  ['--no-verify を拒否', terminal('git commit -m "x" --no-verify'), 'deny'],
  ['rm -rf を拒否', terminal('rm -rf node_modules'), 'deny'],
  ['DROP TABLE を拒否', terminal('psql -c "drop table todos"'), 'deny'],
  ['drizzle-kit push を拒否', terminal('pnpm drizzle-kit push'), 'deny'],
  ['通常の push は確認', terminal('git push -u origin feature/x'), 'ask'],
  ['db:migrate は確認', terminal('pnpm --filter @repo/db db:migrate'), 'ask'],
  ['依存追加は確認', terminal('pnpm add zod'), 'ask'],
  ['.env の読み取りを拒否', read('c:\\repo\\packages\\db\\.env'), 'deny'],
  ['.env.local の読み取りを拒否', read('apps/web/.env.local'), 'deny'],
  ['ターミナルでの .env 表示を拒否', terminal('Get-Content packages/db/.env'), 'deny'],
  ['.env.example は許可', read('apps/api/.env.example'), 'none'],
  ['process.env を含むコマンドは許可', terminal('node -e "console.log(process.env.PORT)"'), 'none'],
  ['テスト実行は許可', terminal('pnpm test'), 'none'],
  ['git status は許可', terminal('git status -sb'), 'none'],
  [
    'フックの編集は確認',
    { tool_name: 'replace_string_in_file', tool_input: { filePath: '.github/hooks/scripts/guard.cjs' } },
    'ask',
  ],
  [
    '本文に process.env を含む編集は許可',
    {
      tool_name: 'replace_string_in_file',
      tool_input: { filePath: 'apps/api/src/index.ts', newString: 'process.env.WEB_ORIGIN' },
    },
    'none',
  ],
  ['不正な入力でも落ちない', { tool_input: null }, 'none'],
];

let failed = 0;
for (const [name, input, expected] of cases) {
  try {
    assert.equal(decisionOf(input), expected);
    console.log(`  ✅ guard: ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ❌ guard: ${name}\n     ${error.message.split('\n')[0]}`);
  }
}

const argCases = [
  ['verify: 既定は build なし', () => assert.deepEqual(parseArgs([]).tasks, ['typecheck', 'lint', 'test'])],
  ['verify: --build で build を含む', () => assert.ok(parseArgs(['--build']).tasks.includes('build'))],
  ['verify: 不正なパッケージ名を拒否', () => assert.throws(() => parseArgs(['--filter', 'x; rm -rf /']))],
  ['verify: 不正なタスクを拒否', () => assert.throws(() => parseArgs(['--only', 'deploy']))],
];
for (const [name, fn] of argCases) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ❌ ${name}\n     ${error.message.split('\n')[0]}`);
  }
}

if (failed > 0) {
  console.log(`\n❌ ${failed} 件失敗`);
  process.exit(1);
}
console.log('\n✅ ハーネスのテストはすべて成功');
