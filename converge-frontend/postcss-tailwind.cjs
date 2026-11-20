'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { compile, optimize } = require('@tailwindcss/node');

const TAILWIND_AT_RULES = new Set([
  'import',
  'reference',
  'theme',
  'variant',
  'config',
  'plugin',
  'apply',
  'tailwind',
  'utility',
  'source',
]);

function canUseOxideScanner(srcDir) {
  try {
    const { Scanner } = require('@tailwindcss/oxide');
    const scanner = new Scanner({
      sources: [{ base: srcDir, pattern: '**/*', negated: false }],
    });
    return scanner.scan().length > 0;
  } catch {
    return false;
  }
}

function collectSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(html|ts|js|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function extractCandidates(text, outSet) {
  const tokenRegex = /[^\s'"`<>{};]+(?:\[[^\]]*\][^\s'"`<>{};]*)?/g;
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const raw = match[0];
    outSet.add(raw);
    const trimmed = raw.replace(/^[:(,]+|[:,)]+$/g, '');
    if (trimmed) outSet.add(trimmed);
  }
}

function createPureJsFallbackPlugin(options = {}) {
  const baseDir = options.base ? path.resolve(options.base) : __dirname;
  const srcDir = path.join(baseDir, 'src');

  return {
    postcssPlugin: 'tailwindcss-purejs-fallback',
    async Once(root, { result, postcss }) {
      let hasTailwindRules = false;
      root.walkAtRules((atRule) => {
        if (TAILWIND_AT_RULES.has(atRule.name)) {
          hasTailwindRules = true;
          return false;
        }
      });
      if (!hasTailwindRules) return;

      const from = result.opts.from
        ? path.resolve(result.opts.from)
        : path.join(srcDir, 'styles.css');
      const inputCss = root.source?.input?.css ?? root.toString();

      const deps = new Set();
      const compiler = await compile(inputCss, {
        base: path.dirname(from),
        from,
        onDependency: (depPath) => {
          deps.add(path.resolve(depPath));
        },
      });

      const files = collectSourceFiles(srcDir);
      const candidates = new Set();
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        extractCandidates(content, candidates);
        if (file !== from) {
          result.messages.push({
            type: 'dependency',
            plugin: 'tailwindcss-purejs-fallback',
            file,
            parent: from,
          });
        }
      }
      result.messages.push({
        type: 'dir-dependency',
        plugin: 'tailwindcss-purejs-fallback',
        dir: srcDir,
        glob: '**/*.{html,ts}',
        parent: from,
      });
      for (const dep of deps) {
        result.messages.push({
          type: 'dependency',
          plugin: 'tailwindcss-purejs-fallback',
          file: dep,
          parent: from,
        });
      }

      let outputCss = compiler.build([...candidates]);
      const minify =
        options.optimize !== undefined
          ? Boolean(options.optimize)
          : process.env.NODE_ENV === 'production';

      try {
        outputCss = optimize(outputCss, { file: from, minify }).code;
      } catch {
        // Keep unoptimized compiled CSS if lightningcss optimization isn't available
      }

      const parsed = postcss.parse(outputCss, { from });
      root.removeAll();
      root.append(parsed.nodes);
    },
  };
}

const useNativeOxide = canUseOxideScanner(path.join(__dirname, 'src'));

function tailwindPostcssPlugin(options = {}) {
  if (useNativeOxide) {
    const officialTailwindPostcss = require('@tailwindcss/postcss');
    return officialTailwindPostcss(options);
  }
  return createPureJsFallbackPlugin(options);
}

tailwindPostcssPlugin.postcss = true;
module.exports = tailwindPostcssPlugin;
