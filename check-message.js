const fs = require("fs");

const message = fs.readFileSync(process.argv[2], "utf8").trim();

if (!/^(feat|fix|docs|chore): .+/.test(message)) {
  console.error("❌ コミットメッセージは 'feat: ' 'fix: ' 'docs: ' 'chore: ' で始めてください");
  console.error(`   あなたのメッセージ: "${message}"`);
  process.exit(1);
}
console.log("✅ コミットメッセージOK");
