const assert = require("assert");
const { add } = require("./index");

assert.strictEqual(add(1, 2), 3, "add(1, 2) は 3 のはず");
console.log("✅ テスト成功");
