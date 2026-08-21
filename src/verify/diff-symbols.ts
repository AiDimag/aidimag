/**
 * Extract function/class/method/variable names from a unified diff.
 *
 * Used by `dim context --diff` to tighten memory matching: instead of
 * searching by file path only, we also search by the symbols that were
 * actually changed in the diff.
 */

import { execFileSync } from "node:child_process";

const SYMBOL_PATTERNS = [
  // Function declarations: function foo, async function foo
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
  // Arrow/const functions: const foo = ..., let foo = ...
  /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/g,
  // Class declarations: class Foo
  /(?:export\s+)?class\s+(\w+)/g,
  // Method definitions: foo() { or foo(...args) {
  /^\s+(?:public|private|protected|static|async\s+)*(\w+)\s*\(/gm,
  // TypeScript interface: interface Foo
  /(?:export\s+)?interface\s+(\w+)/g,
  // TypeScript type: type Foo = ...
  /(?:export\s+)?type\s+(\w+)\s*=/g,
  // Python: def foo(
  /\bdef\s+(\w+)\s*\(/g,
  // Python: class Foo
  /\bclass\s+(\w+)\b/g,
  // Go: func foo(
  /\bfunc\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/g,
  // Rust: fn foo(
  /\bfn\s+(\w+)\s*[\(<]/g,
];

const STOP_SYMBOLS = new Set([
  "if", "else", "for", "while", "switch", "case", "return", "throw",
  "try", "catch", "finally", "new", "delete", "typeof", "instanceof",
  "import", "export", "default", "from", "const", "let", "var", "function",
  "class", "interface", "type", "enum", "namespace", "module", "require",
  "constructor", "get", "set", "async", "await", "yield", "static",
  "public", "private", "protected", "readonly", "abstract", "extends",
  "implements", "this", "super", "void", "null", "undefined", "true",
  "false", "def", "func", "fn", "end", "do", "then", "begin",
]);

/**
 * Extract symbol names from added lines in a unified diff.
 * Returns unique, deduplicated symbol names (lowercased for matching).
 */
export function extractDiffSymbols(diff: string): string[] {
  const symbols = new Set<string>();

  for (const line of diff.split("\n")) {
    // Only look at added lines
    if (!line.startsWith("+") || line.startsWith("+++")) continue;

    const addedLine = line.slice(1);

    for (const pattern of SYMBOL_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(addedLine)) !== null) {
        const name = match[1];
        if (name && name.length > 1 && !STOP_SYMBOLS.has(name.toLowerCase())) {
          symbols.add(name);
        }
      }
    }
  }

  return Array.from(symbols);
}

/**
 * Extract symbols from a git diff between refs.
 */
export function gitDiffSymbols(repoRoot: string, base?: string, staged = false): string[] {
  const args = base
    ? ["diff", "--unified=0", `${base}`, "--"]
    : staged
      ? ["diff", "--cached", "--unified=0", "--"]
      : ["diff", "--unified=0", "--"];
  try {
    const diff = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return extractDiffSymbols(diff);
  } catch {
    return [];
  }
}
