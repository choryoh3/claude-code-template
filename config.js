const dbPassword = "P@ssw0rd-demo-1234";
function runCode(code) {
  return eval(code);
}
console.log("debug:", dbPassword);
module.exports = { dbPassword, runCode };
