import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const srcRoot = new URL('../src/', import.meta.url);

const USER_FACING_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'content',
  'label',
  'placeholder',
  'title',
]);

// Product/technology names, protocols, measurement units, and code fragments are intentionally
// language-neutral. Rules template bodies are declarations in AiRadarView rather than JSX text.
const LANGUAGE_NEUTRAL_TEXT = new Set([
  '$PATH',
  '(PID:',
  '(v',
  '/ W:',
  '/etc/hosts ·',
  '24F74',
  'B',
  'AI',
  'API',
  'Apple Safari',
  'BPF',
  'CPU',
  'CPU %',
  'DNS',
  'GPU',
  'Git',
  'HTTP',
  'HTTPS',
  'LLM',
  'MB',
  'MB/s',
  'Mbps',
  'PID',
  'Q4',
  'R:',
  'RX',
  'TCP',
  'TX',
  'UDP',
  'UP',
  'U',
  'URL',
  'WebSocket',
  'en0',
  'github.com/',
  'https',
  'localhost',
  'macOS',
  'main',
  'ms',
  'ollama serve & ollama run deepseek-r1:8b',
  'pmset',
  'v',
  'vim',
  '~/.gitconfig',
]);

const hasLanguageText = (value: string) => /[\p{L}]/u.test(value);

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const isLanguageNeutral = (value: string) => {
  const rawNormalized = normalizeText(value);
  const normalized = rawNormalized.replace(/^[.:]+|[.:]+$/g, '').trim();
  return (
    !hasLanguageText(normalized) ||
    LANGUAGE_NEUTRAL_TEXT.has(rawNormalized) ||
    LANGUAGE_NEUTRAL_TEXT.has(normalized) ||
    /^(?:HTTP\s*)?\d{3}\s+OK$/.test(normalized) ||
    /^export\s+$/.test(value)
  );
};

const collectTsxFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(path);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : [];
  });

const isControlFlowLiteral = (node: ts.StringLiteralLike) => {
  const parent = node.parent;
  if (ts.isCaseClause(parent)) return true;
  if (
    ts.isBinaryExpression(parent) &&
    [
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.LessThanToken,
      ts.SyntaxKind.LessThanEqualsToken,
      ts.SyntaxKind.GreaterThanToken,
      ts.SyntaxKind.GreaterThanEqualsToken,
    ].includes(parent.operatorToken.kind)
  ) {
    return true;
  }
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression;
    if (
      ts.isPropertyAccessExpression(callee) &&
      ['endsWith', 'includes', 'localeCompare', 'startsWith'].includes(callee.name.text)
    ) {
      return true;
    }
  }
  return false;
};

const getLiteralText = (node: ts.Node): string | undefined => {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression)) {
    return node.expression.text;
  }
  return undefined;
};

type Finding = { file: string; line: number; text: string; kind: string };

const auditFile = (file: string): Finding[] => {
  const sourceText = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];

  const addFinding = (node: ts.Node, text: string, kind: string) => {
    if (isLanguageNeutral(text)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push({
      file: relative(srcRoot.pathname, file),
      line: line + 1,
      text: normalizeText(text),
      kind,
    });
  };

  const inspectRenderedExpression = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) && !isControlFlowLiteral(node)) {
      addFinding(node, node.text, 'rendered expression');
      return;
    }
    if (ts.isTemplateExpression(node)) {
      addFinding(node.head, node.head.text, 'rendered template');
      for (const span of node.templateSpans) {
        inspectRenderedExpression(span.expression);
        addFinding(span.literal, span.literal.text, 'rendered template');
      }
      return;
    }
    if (ts.isConditionalExpression(node)) {
      inspectRenderedExpression(node.whenTrue);
      inspectRenderedExpression(node.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      if (
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      ) {
        inspectRenderedExpression(node.left);
        inspectRenderedExpression(node.right);
      } else if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        inspectRenderedExpression(node.right);
      }
      return;
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      inspectRenderedExpression(node.expression);
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      addFinding(node, node.text, 'JSX text');
    } else if (ts.isJsxAttribute(node) && USER_FACING_ATTRIBUTES.has(node.name.getText(source))) {
      if (node.initializer) {
        const text = getLiteralText(node.initializer);
        if (text !== undefined) {
          addFinding(node.initializer, text, `${node.name.getText(source)} attribute`);
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          inspectRenderedExpression(node.initializer.expression);
        }
      }
    } else if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) {
      inspectRenderedExpression(node.expression);
    } else if (ts.isJsxExpression(node) && node.expression && ts.isJsxFragment(node.parent)) {
      inspectRenderedExpression(node.expression);
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callName = node.expression.text;
      const userTextArgument =
        callName === 'copyToClipboard'
          ? node.arguments[1]
          : ['addToast', 'showToast', 'toast'].includes(callName)
            ? node.arguments[0]
            : undefined;
      if (userTextArgument && ts.isStringLiteralLike(userTextArgument)) {
        addFinding(userTextArgument, userTextArgument.text, `${callName} argument`);
      } else if (userTextArgument) {
        inspectRenderedExpression(userTextArgument);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return findings;
};

test('TSX user-facing prose is sourced from the bilingual dictionaries', () => {
  const findings = collectTsxFiles(srcRoot.pathname).flatMap(auditFile);
  const report = findings
    .map(({ file, line, kind, text }) => `${file}:${line} [${kind}] ${JSON.stringify(text)}`)
    .join('\n');

  assert.equal(findings.length, 0, report);
});
