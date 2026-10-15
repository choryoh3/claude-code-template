// =============================================================================
// pr-review.js のテスト (外部ライブラリ不要。Node.js 標準の assert のみ)
// 実行: node .github/scripts/pr-review.test.js
// GitHub API は「モック (偽物)」に差し替えているので、ネットワークも権限も不要。
// =============================================================================
'use strict';

const assert = require('assert');
const run = require('./pr-review');
const { parseAddedLines, analyzeFiles, SUMMARY_MARKER, BOT_LABEL } = run;

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✅ ${name}`);
}

// 「検出されるべき偽シークレット」。このファイル自身が検出されないよう、文字列を分割して組み立てる。
const FAKE_AWS_KEY = 'AKI' + 'A' + 'ABCDEFGHIJKLMNOP';

// テスト用の変更ファイルを作るヘルパー
const makeFile = (filename, addedLines, extra = {}) => ({
  filename,
  status: 'modified',
  additions: addedLines.length,
  deletions: 0,
  patch: `@@ -0,0 +1,${addedLines.length} @@\n` + addedLines.map((l) => `+${l}`).join('\n'),
  ...extra,
});

// GitHub API のモック。呼ばれた書き込み系 API を calls に記録する。
function makeMocks({ files, issues = [], comments = [], fork = false, actor = 'octocat' }) {
  const calls = { createIssue: [], createComment: [], updateComment: [], createLabel: [] };
  const logs = { error: [], warning: [], notice: [], failed: [] };
  const outputs = {};

  const github = {
    // paginate(関数, 引数) -> その関数の data を返すだけの簡易版
    paginate: async (fn, params) => (await fn(params)).data,
    rest: {
      pulls: { listFiles: async () => ({ data: files }) },
      issues: {
        listComments: async () => ({ data: comments }),
        listForRepo: async () => ({ data: issues }),
        getLabel: async () => {
          throw Object.assign(new Error('Not Found'), { status: 404 });
        },
        createLabel: async (p) => calls.createLabel.push(p),
        createComment: async (p) => calls.createComment.push(p),
        updateComment: async (p) => calls.updateComment.push(p),
        create: async (p) => {
          calls.createIssue.push(p);
          return { data: { number: 100 + calls.createIssue.length } };
        },
      },
    },
  };

  const context = {
    repo: { owner: 'me', repo: 'demo' },
    actor,
    payload: {
      repository: { full_name: 'me/demo' },
      pull_request: {
        number: 7,
        html_url: 'https://github.com/me/demo/pull/7',
        head: { repo: { full_name: fork ? 'someone/demo' : 'me/demo' } },
      },
    },
  };

  const core = {
    info: () => {},
    error: (m) => logs.error.push(m),
    warning: (m) => logs.warning.push(m),
    notice: (m) => logs.notice.push(m),
    setFailed: (m) => logs.failed.push(m),
    setOutput: (k, v) => (outputs[k] = v),
    summary: { addRaw() { return this; }, write: async () => {} },
  };

  return { github, context, core, calls, logs, outputs };
}

(async () => {
  console.log('pr-review.js のテスト');

  // ---------- parseAddedLines ----------
  await test('parseAddedLines: 追加行の行番号を新ファイル基準で数える', () => {
    const patch = ['@@ -1,3 +10,4 @@', ' 変更なし(10)', '-削除', '+追加A', ' 変更なし(12)', '+追加B'].join('\n');
    assert.deepStrictEqual(parseAddedLines(patch), [
      { line: 11, text: '追加A' },
      { line: 13, text: '追加B' },
    ]);
  });

  await test('parseAddedLines: patch が無い (バイナリ等) ときは空配列', () => {
    assert.deepStrictEqual(parseAddedLines(undefined), []);
  });

  // ---------- analyzeFiles ----------
  await test('シークレットを high で検出し、メッセージに値を含めない', () => {
    const findings = analyzeFiles([makeFile('src/config.js', ['const a = 1;', `const key = "${FAKE_AWS_KEY}";`])]);
    const secret = findings.find((f) => f.ruleId === 'hardcoded-secret');
    assert.ok(secret, 'シークレットが検出されること');
    assert.strictEqual(secret.severity, 'high');
    assert.strictEqual(secret.line, 2);
    assert.ok(!JSON.stringify(secret).includes(FAKE_AWS_KEY), '値そのものは出力しない');
  });

  await test('eval を high で検出する', () => {
    const findings = analyzeFiles([makeFile('src/a.js', ['eval(input);'])]);
    assert.ok(findings.some((f) => f.ruleId === 'eval-usage' && f.severity === 'high'));
  });

  await test('console.log は src では low、テストと .github/ では検出しない', () => {
    const src = analyzeFiles([makeFile('src/a.js', ['console.log(1);'])]);
    assert.ok(src.some((f) => f.ruleId === 'debug-statement' && f.severity === 'low'));

    const test_ = analyzeFiles([makeFile('src/a.test.js', ['console.log(1);'])]);
    assert.ok(!test_.some((f) => f.ruleId === 'debug-statement'));

    const ci = analyzeFiles([makeFile('.github/scripts/x.js', ['console.log(1);'])]);
    assert.ok(!ci.some((f) => f.ruleId === 'debug-statement'));
  });

  await test('ソースだけ変更してテスト変更なしだと missing-tests、テストも変更すれば出ない', () => {
    const only = analyzeFiles([makeFile('src/a.js', ['const x = 1;'])]);
    assert.ok(only.some((f) => f.ruleId === 'missing-tests'));

    const both = analyzeFiles([makeFile('src/a.js', ['const x = 1;']), makeFile('src/a.test.js', ['// t'])]);
    assert.ok(!both.some((f) => f.ruleId === 'missing-tests'));
  });

  await test('変更行数が閾値を超えると large-pr', () => {
    const big = makeFile('docs/big.md', ['x'], { additions: 450 });
    assert.ok(analyzeFiles([big]).some((f) => f.ruleId === 'large-pr'));
  });

  await test('package-lock.json は検査対象外', () => {
    const lock = makeFile('package-lock.json', [`"token": "${'x'.repeat(20)}"`], { additions: 9999 });
    assert.deepStrictEqual(analyzeFiles([lock]), []);
  });

  // ---------- run (エントリーポイント) ----------
  await test('run: 初回は ラベル作成 + コメント作成 + Issue 作成 を行う', async () => {
    const m = makeMocks({ files: [makeFile('src/config.js', [`const key = "${FAKE_AWS_KEY}";`])] });
    await run(m);
    assert.strictEqual(m.calls.createLabel.length, 1);
    assert.strictEqual(m.calls.createComment.length, 1);
    assert.strictEqual(m.calls.createIssue.length, 1);
    assert.deepStrictEqual(m.calls.createIssue[0].labels, [BOT_LABEL]);
    assert.ok(!m.calls.createIssue[0].body.includes(FAKE_AWS_KEY), 'Issue 本文に値を載せない');
    assert.strictEqual(m.outputs.high_count, '1');
    assert.strictEqual(m.logs.error.length, 1);
  });

  await test('run: 2 回目以降は コメントを更新し、Issue は重複作成しない', async () => {
    const files = [makeFile('src/config.js', [`const key = "${FAKE_AWS_KEY}";`])];
    const marker = '<!-- pr-review-bot:issue pr=7 rule=hardcoded-secret file=src/config.js -->';
    const m = makeMocks({
      files,
      issues: [{ number: 5, body: marker + '\n...' }], // closed でも一覧に含まれる想定
      comments: [{ id: 99, body: SUMMARY_MARKER + '\n古い内容' }],
    });
    await run(m);
    assert.strictEqual(m.calls.createComment.length, 0);
    assert.strictEqual(m.calls.updateComment.length, 1);
    assert.strictEqual(m.calls.updateComment[0].comment_id, 99);
    assert.strictEqual(m.calls.createIssue.length, 0);
  });

  await test('run: 同じファイルで複数行ヒットしても Issue は 1 件', async () => {
    const m = makeMocks({
      files: [makeFile('src/config.js', [`const a = "${FAKE_AWS_KEY}";`, `const b = "${FAKE_AWS_KEY}";`])],
    });
    await run(m);
    assert.strictEqual(m.calls.createIssue.length, 1);
  });

  await test('run: fork の PR では書き込みをしない', async () => {
    const m = makeMocks({ fork: true, files: [makeFile('src/config.js', [`const key = "${FAKE_AWS_KEY}";`])] });
    await run(m);
    assert.strictEqual(m.calls.createComment.length, 0);
    assert.strictEqual(m.calls.createIssue.length, 0);
    assert.ok(m.logs.warning.some((w) => w.includes('fork')));
  });

  await test('run: FAIL_ON_HIGH=true なら重大な指摘でジョブを失敗させる', async () => {
    process.env.FAIL_ON_HIGH = 'true';
    try {
      const m = makeMocks({ files: [makeFile('src/config.js', [`const key = "${FAKE_AWS_KEY}";`])] });
      await run(m);
      assert.strictEqual(m.logs.failed.length, 1);
    } finally {
      delete process.env.FAIL_ON_HIGH;
    }
  });

  console.log(`\n✅ ${passed} 件すべて成功`);
})().catch((error) => {
  console.error('❌ テスト失敗');
  console.error(error);
  process.exit(1);
});
