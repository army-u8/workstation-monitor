import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/typescript';
import prettier from 'eslint-config-prettier';

const noHardcodedChineseRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded Chinese text in UI components (enforce t() i18n usage)',
    },
    schema: [],
    messages: {
      hardcodedChinese:
        "Hardcoded Chinese text '{{text}}' found. Please use t() i18n dictionary instead.",
    },
  },
  create(context) {
    const filename = (context.filename || context.getFilename?.() || '').replace(/\\/g, '/');
    // Ignore dictionary files, i18n core, test files, and node_modules
    if (
      filename.includes('/src/i18n/') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('/scripts/')
    ) {
      return {};
    }

    const chineseRegex = /[\u4e00-\u9fa5]/;

    return {
      JSXText(node) {
        const text = node.value.trim();
        if (text && chineseRegex.test(text)) {
          context.report({
            node,
            messageId: 'hardcodedChinese',
            data: { text },
          });
        }
      },
      JSXAttribute(node) {
        if (node.value && node.value.type === 'Literal') {
          const val = String(node.value.value || '').trim();
          if (val && chineseRegex.test(val)) {
            context.report({
              node: node.value,
              messageId: 'hardcodedChinese',
              data: { text: val },
            });
          }
        }
      },
      Literal(node) {
        if (typeof node.value === 'string' && chineseRegex.test(node.value)) {
          if (node.parent?.type === 'ImportDeclaration') return;
          if (node.parent?.type === 'JSXAttribute') return; // Handled by JSXAttribute
          if (node.parent?.type === 'JSXText') return; // Handled by JSXText
          const text = node.value.trim();
          if (text) {
            context.report({
              node,
              messageId: 'hardcodedChinese',
              data: { text },
            });
          }
        }
      },
      TemplateElement(node) {
        const raw = (node.value?.raw || '').trim();
        if (raw && chineseRegex.test(raw)) {
          context.report({
            node,
            messageId: 'hardcodedChinese',
            data: { text: raw },
          });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.vite/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  solid,
  prettier,
  {
    plugins: {
      'custom-i18n': {
        rules: {
          'no-hardcoded-chinese': noHardcodedChineseRule,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'custom-i18n/no-hardcoded-chinese': 'error',
    },
  },
);
