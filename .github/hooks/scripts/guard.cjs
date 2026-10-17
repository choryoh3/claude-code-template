// PreToolUse フック: 破壊的な操作と秘密情報ファイルへのアクセスを、モデルの判断に頼らず機械的に止める。
const DENY_COMMANDS = [
  [/\bgit\s+push\b.*\s(--force|-f|--force-with-lease)\b/i, 'force push は禁止されています'],
  [/\bgit\s+reset\s+--hard\b/i, 'git reset --hard は禁止されています'],
  [/\bgit\s+clean\s+-\w*f/i, 'git clean -f は禁止されています'],
  [/--no-verify\b/i, 'Git フックの回避 (--no-verify) は禁止されています'],
  [/\brm\s+-\w*(rf|fr)\w*\b/i, 'rm -rf は禁止されています'],
  [/\b(drop|truncate)\s+(table|database|schema)\b/i, 'DROP / TRUNCATE は禁止されています'],
  [/\bdrizzle-kit\s+push\b|\bdb:push\b/i, 'マイグレーションを経由しない DB 変更 (push) は禁止されています'],
];

const ASK_COMMANDS = [
  [/\bgit\s+push\b/i, 'リモートへの push'],
  [/\bgit\s+(commit\s+--amend|rebase|branch\s+-D|restore|checkout\s+--)\b/i, '履歴や作業内容を書き換える Git 操作'],
  [/\bvercel\b/i, 'Vercel CLI の実行'],
  [/\bdb:migrate\b|\bdrizzle-kit\s+migrate\b/i, 'DB マイグレーションの適用 (本番 DB の可能性あり)'],
  [/\bRemove-Item\b.*-Recurse\b/i, '再帰的な削除'],
  [/\bpnpm\s+(add|remove|up|update)\b|\bnpm\s+(i|install|uninstall)\b/i, '依存パッケージの変更'],
];

// `.env` と `.env.local` 等に一致し、`.env.example` と `process.env` には一致しない。
const SECRET_FILE = /(^|[\s"'=\\/])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s"'\\/;|&)])/;
const PATH_KEY = /path|file|uri|dir|pattern|query/i;
const EDIT_TOOL = /create|edit|replace|write|delete|rename|move|insert/i;
const PROTECTED_PATH = /\.github[\\/]hooks[\\/]/;

function collectStrings(value, key = '', out = []) {
  if (typeof value === 'string') out.push({ key, value });
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, key, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, k, out);
  }
  return out;
}

function decision(permissionDecision, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      permissionDecisionReason: reason,
    },
  };
}

function evaluate(input) {
  const toolName = String(input?.tool_name ?? '');
  const strings = collectStrings(input?.tool_input ?? {});
  const commands = strings.filter((s) => s.key === 'command').map((s) => s.value);
  const paths = strings.filter((s) => PATH_KEY.test(s.key)).map((s) => s.value);

  for (const text of [...commands, ...paths]) {
    if (SECRET_FILE.test(text)) {
      return decision('deny', '秘密情報ファイル (.env) へのアクセスは禁止されています。.env.example を参照してください');
    }
  }
  for (const command of commands) {
    for (const [pattern, reason] of DENY_COMMANDS) {
      if (pattern.test(command)) return decision('deny', reason);
    }
  }
  for (const command of commands) {
    for (const [pattern, reason] of ASK_COMMANDS) {
      if (pattern.test(command)) return decision('ask', `確認が必要な操作です: ${reason}`);
    }
  }
  if (EDIT_TOOL.test(toolName) && paths.some((p) => PROTECTED_PATH.test(p))) {
    return decision('ask', 'フックのスクリプトを変更しようとしています');
  }
  return null;
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      // 入力が読めない場合は止めずに警告だけ出す (フックの不具合で作業全体が止まるのを防ぐ)。
      process.stdout.write(JSON.stringify({ systemMessage: 'guard フック: 入力を解析できませんでした' }));
      return;
    }
    const result = evaluate(input);
    if (result) process.stdout.write(JSON.stringify(result));
  });
}

if (require.main === module) main();

module.exports = { evaluate };
