// =============================================================================
// PR 自動レビュー・ロジック (03-pr-review.yml から actions/github-script 経由で呼ばれる)
// =============================================================================
// 【なぜ YAML に直接書かず、別ファイルにしているのか？】
//   1. ローカルで `node .github/scripts/pr-review.test.js` としてテストできる
//      (= push して Actions が動くのを待たずに、手元で素早く試行錯誤できる)
//   2. YAML の中に JS を埋め込むと、インデントや引用符でバグりやすい
//   3. ロジック (JS) と、実行の枠組み (YAML) の責務が分かれて読みやすい
//
// 【全体の流れ】
//   PR の変更ファイル一覧を取得
//     -> ルールで検査 (analyzeFiles)                  ... 純粋関数。API を呼ばない
//     -> アノテーション表示 / ジョブサマリー出力       ... 権限不要
//     -> PR にレビューコメント投稿 (毎回上書き)         ... 要 pull-requests: write
//     -> 重大な指摘だけ Issue を起票 (重複は作らない)    ... 要 issues: write
//
// 【将来の拡張】
//   後続のステップで、ここの「ルール検査」を Claude Code Action (AI) に置き換える。
//   その場合も「コメント投稿」「Issue 重複防止」の部品はそのまま流用できる。
// =============================================================================

'use strict';

// ----------------------------------------------------------------------------
// 定数
// ----------------------------------------------------------------------------

// このボットが作った Issue に付けるラベル。重複チェックの検索キーにも使う。
const BOT_LABEL = 'pr-review-bot';

// PR コメントを「更新」するための目印。
// HTML コメントは画面に表示されないので、人間には見えず、プログラムだけが目印にできる。
const SUMMARY_MARKER = '<!-- pr-review-bot:summary -->';

// 大きすぎる PR の閾値 (追加行 + 削除行)。レビューしづらくなる目安。
const LARGE_PR_LINES = 400;

// 検査の対象外にするファイル (自動生成物など。見ても意味がない)
const IGNORED_FILES = [/(^|\/)package-lock\.json$/, /\.min\.js$/, /(^|\/)node_modules\//];

// ファイル種別の判定用正規表現
const SOURCE_FILE = /\.[cm]?[jt]sx?$/; // .js .mjs .cjs .ts .jsx .tsx
const TEST_FILE = /(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test\.[cm]?[jt]s$/;

// 「シークレットっぽい文字列」のパターン。
// 誤検知 (false positive) はあり得るので、あくまで「気付きのきっかけ」として使う。
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/, // AWS アクセスキー ID
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, // 秘密鍵
  /ghp_[A-Za-z0-9]{36}/, // GitHub Personal Access Token
  /(?:api[_-]?key|secret|token|passw(?:or)?d)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, // key = "xxxxxxxx" 形式
];

// 深刻度の並び順 (サマリーで重い順に表示するため)
const SEVERITY_ORDER = ['high', 'medium', 'low'];
const SEVERITY_LABEL = { high: '🔴 重大', medium: '🟠 中', low: '🟡 軽微' };

// ----------------------------------------------------------------------------
// ファイル種別ヘルパー
// ----------------------------------------------------------------------------
const isSource = (path) => SOURCE_FILE.test(path) && !TEST_FILE.test(path);
const isTest = (path) => TEST_FILE.test(path);

// ----------------------------------------------------------------------------
// 1. diff (patch) の解析
// ----------------------------------------------------------------------------
// GitHub API が返す patch は、次のような unified diff 形式の文字列:
//
//   @@ -10,3 +10,4 @@        <- ハンクヘッダ。「新ファイルの 10 行目から 4 行」の意味
//    変更なし行 (先頭が半角スペース)
//   -削除行
//   +追加行
//
// 追加行が「新ファイルの何行目か」を知りたい。
// そうすれば、Files changed 画面の該当行にアノテーションを出せる。
function parseAddedLines(patch) {
  const added = [];
  if (!patch) return added; // バイナリや巨大ファイルは patch が無い

  let newLine = 0; // 新ファイル側の現在行番号
  for (const raw of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = Number(hunk[1]); // ハンクの開始行にリセット
      continue;
    }
    if (raw.startsWith('+')) {
      added.push({ line: newLine, text: raw.slice(1) });
      newLine++; // 追加行は新ファイルの行を 1 つ進める
    } else if (raw.startsWith('-') || raw.startsWith('\\')) {
      // 削除行 (新ファイルに存在しない) と "\ No newline at end of file" は行番号を進めない
    } else {
      newLine++; // 変更なし行は新ファイルの行を 1 つ進める
    }
  }
  return added;
}

// ----------------------------------------------------------------------------
// 2. ルール定義
// ----------------------------------------------------------------------------
// 「追加された 1 行」ごとに評価するルール。
//   appliesTo: そのファイルに適用するか
//   matches  : その行が違反かどうか
// ルールを増やしたいときは、この配列に 1 要素足すだけ。
const LINE_RULES = [
  {
    id: 'hardcoded-secret',
    severity: 'high',
    title: 'シークレットの混入の疑い',
    message: 'APIキーやパスワードらしき文字列が追加されています。コードに直接書かず、GitHub Secrets や環境変数を使ってください。',
    appliesTo: () => true,
    matches: (text) => SECRET_PATTERNS.some((re) => re.test(text)),
  },
  {
    id: 'eval-usage',
    severity: 'high',
    title: 'eval / new Function の使用',
    message: '任意コード実行の危険があります。JSON.parse や関数テーブルなど、安全な代替手段を検討してください。',
    appliesTo: isSource,
    matches: (text) => /\beval\s*\(|\bnew\s+Function\s*\(/.test(text),
  },
  {
    id: 'debug-statement',
    severity: 'low',
    title: 'デバッグ出力の消し忘れ',
    message: 'console.log / debugger が追加されています。意図したものでなければ削除してください。',
    // .github/ 配下 (CI 用スクリプト) は出力が目的なので除外
    appliesTo: (path) => isSource(path) && !path.startsWith('.github/'),
    matches: (text) => /\bconsole\.(log|debug)\s*\(|\bdebugger\b/.test(text),
  },
  {
    id: 'todo-comment',
    severity: 'low',
    title: 'TODO / FIXME の追加',
    message: '未対応事項が追加されています。Issue 化するか、この PR で解消できないか確認してください。',
    appliesTo: () => true,
    matches: (text) => /\b(TODO|FIXME|HACK)\b/.test(text),
  },
];

// ----------------------------------------------------------------------------
// 3. 検査本体 (純粋関数: 入力 -> 出力のみ。API 呼び出しや副作用なし)
// ----------------------------------------------------------------------------
// files: pulls.listFiles の戻り値 ({ filename, status, additions, deletions, patch })
// 戻り値: 指摘の配列 [{ ruleId, severity, title, message, file?, line? }]
//   ※ 指摘に「検出した文字列そのもの」は含めない
//      (シークレットを PR コメントや Issue に再掲して拡散させないため)
function analyzeFiles(files) {
  const findings = [];

  // 削除されたファイルと、対象外ファイルは検査しない
  const targets = files.filter(
    (f) => f.status !== 'removed' && !IGNORED_FILES.some((re) => re.test(f.filename)),
  );

  // --- 行単位のルール ---
  for (const file of targets) {
    const addedLines = parseAddedLines(file.patch);
    for (const rule of LINE_RULES) {
      if (!rule.appliesTo(file.filename)) continue;
      for (const { line, text } of addedLines) {
        if (rule.matches(text)) {
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            title: rule.title,
            message: rule.message,
            file: file.filename,
            line,
          });
        }
      }
    }
  }

  // --- PR 全体のルール ---
  const changedLines = targets.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  if (changedLines > LARGE_PR_LINES) {
    findings.push({
      ruleId: 'large-pr',
      severity: 'medium',
      title: 'PR が大きすぎます',
      message: `変更が ${changedLines} 行あります (目安: ${LARGE_PR_LINES} 行以下)。レビューしやすいよう分割を検討してください。`,
    });
  }

  const changedSources = targets.filter((f) => isSource(f.filename));
  const changedTests = targets.filter((f) => isTest(f.filename));
  if (changedSources.length > 0 && changedTests.length === 0) {
    findings.push({
      ruleId: 'missing-tests',
      severity: 'medium',
      title: 'テストの変更がありません',
      message: `ソースコード ${changedSources.length} 件が変更されていますが、テストファイルの変更がありません。`,
    });
  }

  return findings;
}

// ----------------------------------------------------------------------------
// 4. PR コメント (Markdown) の組み立て
// ----------------------------------------------------------------------------
function renderSummary(findings) {
  const lines = [SUMMARY_MARKER, '## 🤖 PR 自動レビュー結果', ''];

  if (findings.length === 0) {
    lines.push('✅ 指摘事項はありません。');
    return lines.join('\n');
  }

  for (const severity of SEVERITY_ORDER) {
    const group = findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;

    lines.push(`### ${SEVERITY_LABEL[severity]} (${group.length} 件)`, '');
    lines.push('| 内容 | 場所 | 詳細 |', '| --- | --- | --- |');
    for (const f of group) {
      const place = f.file ? `\`${f.file}${f.line ? `:${f.line}` : ''}\`` : 'PR 全体';
      lines.push(`| ${f.title} | ${place} | ${f.message} |`);
    }
    lines.push('');
  }

  lines.push('<sub>このコメントは push のたびに自動で更新されます。</sub>');
  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// 5. 書き込み系 API (PR コメント / Issue)
// ----------------------------------------------------------------------------

// 「スティッキーコメント」: 毎回新規投稿せず、同じコメントを更新し続ける。
// push のたびにコメントが増えるのを防ぐ定番テクニック。
async function upsertSummaryComment({ github, owner, repo, prNumber, body }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber, // PR は Issue の一種なので、コメント API は issues 側を使う
    per_page: 100,
  });
  const existing = comments.find((c) => c.body && c.body.includes(SUMMARY_MARKER));

  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    return 'updated';
  }
  await github.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
  return 'created';
}

// ラベルが無ければ作る (「あれば何もしない」= 冪等な処理にしておく)
async function ensureLabel({ github, owner, repo }) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name: BOT_LABEL });
  } catch (error) {
    if (error.status !== 404) throw error; // 404 以外 (権限エラー等) は本当の失敗
    await github.rest.issues.createLabel({
      owner,
      repo,
      name: BOT_LABEL,
      color: 'd73a4a',
      description: 'PR 自動レビューが起票した Issue',
    });
  }
}

// 重大な指摘を Issue にする。同じ PR・同じルール・同じファイルでは 1 度しか作らない。
async function createIssuesForHighFindings({ github, owner, repo, pr, findings, core }) {
  // 同じ (ルール, ファイル) の指摘を 1 つにまとめる (複数行ヒットしても Issue は 1 件)
  const groups = new Map();
  for (const f of findings.filter((x) => x.severity === 'high')) {
    const key = `${f.ruleId}|${f.file}`;
    if (!groups.has(key)) groups.set(key, { ...f, lines: [] });
    groups.get(key).lines.push(f.line);
  }
  if (groups.size === 0) return [];

  await ensureLabel({ github, owner, repo });

  // 重複防止: ボットが過去に作った Issue を「closed も含めて」取得する。
  // closed も含める理由: 人間が「対応済み / 対応しない」と閉じた指摘を、
  // 次の push で勝手に再起票しないため。
  const known = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    labels: BOT_LABEL,
    state: 'all',
    per_page: 100,
  });
  // listForRepo は PR も返すので除外する
  const knownBodies = known.filter((i) => !i.pull_request).map((i) => i.body || '');

  const created = [];
  for (const g of groups.values()) {
    // Issue 本文に埋め込む目印。これが既存 Issue にあれば「起票済み」とみなす。
    const marker = `<!-- pr-review-bot:issue pr=${pr.number} rule=${g.ruleId} file=${g.file} -->`;
    if (knownBodies.some((body) => body.includes(marker))) {
      core.info(`起票済みのためスキップ: ${g.ruleId} ${g.file}`);
      continue;
    }

    const body = [
      marker,
      `PR #${pr.number} (${pr.html_url}) の自動レビューで検出されました。`,
      '',
      `- **内容**: ${g.title}`,
      `- **ファイル**: \`${g.file}\``,
      `- **行**: ${g.lines.join(', ')}`,
      '',
      g.message,
      '',
      '> 検出した文字列そのものは、漏えい防止のためここには記載していません。',
    ].join('\n');

    const { data: issue } = await github.rest.issues.create({
      owner,
      repo,
      title: `[PR #${pr.number}] ${g.title}: ${g.file}`,
      body,
      labels: [BOT_LABEL],
    });
    core.info(`Issue を作成しました: #${issue.number}`);
    created.push(issue.number);
  }
  return created;
}

// ----------------------------------------------------------------------------
// 6. エントリーポイント (github-script から呼ばれる)
// ----------------------------------------------------------------------------
// github : 認証済みの Octokit クライアント (GITHUB_TOKEN 付き)
// context: イベント情報 (どの PR か、誰が起こしたか等)
// core   : ログ出力・アノテーション・出力値設定のためのツール
async function run({ github, context, core }) {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.info('pull_request イベントではないため何もしません。');
    return;
  }
  const { owner, repo } = context.repo;

  // 変更ファイル一覧を取得。paginate は全ページ (100 件ずつ) を自動で集めてくれる。
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  });
  core.info(`変更ファイル数: ${files.length}`);

  const findings = analyzeFiles(files);

  // --- (a) アノテーション: Files changed 画面の該当行にバッジが付く。書き込み権限は不要 ---
  // 注意: 1 ステップあたり表示件数に上限がある (error/warning/notice 各 10 件程度)
  for (const f of findings) {
    const props = { title: f.title };
    if (f.file) {
      props.file = f.file;
      props.startLine = f.line;
    }
    if (f.severity === 'high') core.error(f.message, props);
    else if (f.severity === 'medium') core.warning(f.message, props);
    else core.notice(f.message, props);
  }

  // --- (b) ジョブサマリー: Actions 実行画面に Markdown で表示される。書き込み権限は不要 ---
  const markdown = renderSummary(findings);
  await core.summary.addRaw(markdown, true).write();

  const highCount = findings.filter((f) => f.severity === 'high').length;
  core.setOutput('high_count', String(highCount)); // 後続ステップやジョブから参照できる値

  // --- (c) 書き込み系 (コメント・Issue) ---
  // fork からの PR や Dependabot の PR では GITHUB_TOKEN が読み取り専用になる。
  // その場合に書き込もうとすると 403 エラーでジョブが失敗するので、事前に判定してスキップする。
  const isFork = !pr.head.repo || pr.head.repo.full_name !== context.payload.repository.full_name;
  const isDependabot = context.actor === 'dependabot[bot]';
  if (isFork || isDependabot) {
    core.warning('fork / Dependabot の PR のため、コメント投稿と Issue 起票はスキップします (トークンが読み取り専用)。');
  } else {
    try {
      const result = await upsertSummaryComment({ github, owner, repo, prNumber: pr.number, body: markdown });
      core.info(`PR コメントを ${result} しました。`);
      await createIssuesForHighFindings({ github, owner, repo, pr, findings, core });
    } catch (error) {
      // 権限不足 (403) は「設定の問題」としてわかりやすく警告に留める。それ以外は本物のバグなので再 throw。
      if (error.status === 403) {
        core.warning(`書き込み権限が不足しています。workflow の permissions を確認してください: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  // --- (d) 重大な指摘があれば、ジョブを失敗させる (任意) ---
  // 環境変数 FAIL_ON_HIGH=true のときだけ有効。失敗させるとマージをブロックできる。
  if (process.env.FAIL_ON_HIGH === 'true' && highCount > 0) {
    core.setFailed(`重大な指摘が ${highCount} 件あります。`);
  }
}

module.exports = run;
// テストから個別の関数を呼べるように、関数をぶら下げて公開する
module.exports.parseAddedLines = parseAddedLines;
module.exports.analyzeFiles = analyzeFiles;
module.exports.renderSummary = renderSummary;
module.exports.SUMMARY_MARKER = SUMMARY_MARKER;
module.exports.BOT_LABEL = BOT_LABEL;
