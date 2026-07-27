// koyu の VS Code 拡張 — 色は文法 (syntaxes/) が、赤は CLI が持つ (ADR-0031)。
// ここは翻訳しかしない: `koyu check --json` の Diagnostic[] を VS Code の診断に写す。
// パーサも規則もこの拡張には無い — 門番は一つである (掟1)。
// 依存ゼロ・ビルド無しの素の CommonJS。

const vscode = require("vscode");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/** entry ごとに、前回どの URI へ診断を置いたか (次の実行で消すため) */
const owned = new Map();
let collection;
let output;
let warnedMissingCli = false;

function activate(context) {
  collection = vscode.languages.createDiagnosticCollection("koyu");
  output = vscode.window.createOutputChannel("koyu");
  context.subscriptions.push(collection, output);

  context.subscriptions.push(
    vscode.commands.registerCommand("koyu.check", () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc) runCheck(doc, true);
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => runCheck(doc)),
    vscode.workspace.onDidOpenTextDocument((doc) => runCheck(doc)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.languageId === "koyu" && doc.uri.scheme === "file") collection.delete(doc.uri);
    }),
  );

  for (const doc of vscode.workspace.textDocuments) runCheck(doc);
}

function deactivate() {
  owned.clear();
}

/** 開いている層から、合成の起点 (entry) を決める */
function resolveEntry(docPath) {
  const configured = vscode.workspace.getConfiguration("koyu").get("entry", "").trim();
  if (configured) {
    if (path.isAbsolute(configured)) return configured;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) return path.resolve(root, configured);
    return path.resolve(path.dirname(docPath), configured);
  }
  // 層を単体で check すると grid も level も見えない — 同じディレクトリの main.muro を起点にする
  const main = path.join(path.dirname(docPath), "main.muro");
  if (path.basename(docPath) !== "main.muro" && fs.existsSync(main)) return main;
  return docPath;
}

/** CLI の場所。設定 → ワークスペースの node_modules/.bin → 開発中の dist/cli.js → PATH */
function resolveCli(fromDir) {
  const configured = vscode.workspace.getConfiguration("koyu").get("cliPath", "").trim();
  if (configured) {
    return configured.endsWith(".js")
      ? { command: process.execPath, args: [configured] }
      : { command: configured, args: [] };
  }
  let dir = fromDir;
  for (;;) {
    const bin = path.join(dir, "node_modules", ".bin", "koyu");
    if (fs.existsSync(bin)) return { command: bin, args: [] };
    const built = path.join(dir, "dist", "cli.js");
    if (fs.existsSync(built) && fs.existsSync(path.join(dir, "src", "parse.ts"))) {
      return { command: process.execPath, args: [built] };
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return { command: "koyu", args: [] };
}

function runCheck(doc, force = false) {
  if (doc.languageId !== "koyu" || doc.uri.scheme !== "file") return;
  if (!force && !vscode.workspace.getConfiguration("koyu").get("check.enabled", true)) return;

  const entry = resolveEntry(doc.uri.fsPath);
  const cwd = path.dirname(entry);
  const { command, args } = resolveCli(cwd);

  cp.execFile(
    command,
    [...args, "check", entry, "--json"],
    { cwd, timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err && err.code === "ENOENT") return reportMissingCli(command);
      let diags;
      try {
        diags = JSON.parse(stdout);
      } catch {
        // 終了コード2 (使い方) や想定外の落ち方 — 黙って緑にしない
        output.appendLine(`koyu check ${entry}`);
        output.appendLine(String(stderr || err?.message || stdout).trim());
        vscode.window.setStatusBarMessage("koyu: check が走りませんでした (出力パネル: koyu)", 5000);
        return;
      }
      apply(entry, diags);
    },
  );
}

/** Diagnostic[] を、出所 (file) ごとに VS Code の診断へ写す */
function apply(entry, diags) {
  const byFile = new Map();
  for (const d of diags) {
    // 位置を持たない診断 (モデル全体に関わるもの) は entry の1行目に置く
    const file = d.file ? path.resolve(path.dirname(entry), d.file) : entry;
    const line = Math.max(0, (d.line ?? 1) - 1);
    const diag = new vscode.Diagnostic(
      new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
      d.message,
      d.severity === "warning"
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Error,
    );
    diag.code = d.code;
    diag.source = "koyu";
    if (d.path?.length) diag.message = `${d.message}  [${d.path.join(" | ")}]`;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(diag);
  }

  // 前回この entry が置いた診断のうち、今回消えたものを取り下げる
  for (const file of owned.get(entry) ?? []) {
    if (!byFile.has(file)) collection.delete(vscode.Uri.file(file));
  }
  for (const [file, list] of byFile) collection.set(vscode.Uri.file(file), list);
  owned.set(entry, [...byFile.keys()]);
}

function reportMissingCli(command) {
  if (warnedMissingCli) return;
  warnedMissingCli = true;
  vscode.window
    .showWarningMessage(
      `koyu CLI が見つかりません (${command})。色は出ますが、整合の検査は走りません。`,
      "設定を開く",
    )
    .then((pick) => {
      if (pick) vscode.commands.executeCommand("workbench.action.openSettings", "koyu.cliPath");
    });
}

module.exports = { activate, deactivate };
