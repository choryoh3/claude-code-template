// SessionStart フック: ブランチと作業ツリーの状態を最初にエージェントへ渡す。
const { execFileSync } = require('node:child_process');

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) || '(不明)';
const changed = git(['status', '--porcelain']).split('\n').filter(Boolean).length;
const lastCommit = git(['log', '-1', '--format=%h %s']) || '(なし)';

const context = [
  `ブランチ: ${branch}`,
  `未コミットの変更: ${changed} ファイル`,
  `直近のコミット: ${lastCommit}`,
  `Node: ${process.version}`,
  branch === 'main' ? '注意: main ブランチ上です。作業は feature ブランチで行ってください。' : '',
]
  .filter(Boolean)
  .join(' | ');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }),
);
