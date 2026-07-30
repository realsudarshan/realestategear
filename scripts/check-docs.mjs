import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'generated',
  'node_modules',
]);
const scannableExtensions = new Set([
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.prisma',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const retiredReferences = [
  'TODO.md',
  'REALESTATEGEAR_OSS_ROADMAP.md',
  'SEO_GUIDE.md',
  'docs/mls-compliance.md',
  './mls-compliance.md',
  'docs/mlsgrid-implementation-plan.md',
  'docs/plans/',
];

async function collectScannableFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectScannableFiles(entryPath)));
    } else if (
      entry.isFile() &&
      (scannableExtensions.has(path.extname(entry.name)) || entry.name.endsWith('.example'))
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

const failures = [];
const scannableFiles = await collectScannableFiles(root);
const markdownFiles = scannableFiles.filter((file) => file.endsWith('.md'));
const docsDirectory = path.join(root, 'docs');
const docsIndex = await readFile(path.join(docsDirectory, 'README.md'), 'utf8');

for (const file of markdownFiles) {
  if (path.dirname(file) !== docsDirectory || path.basename(file) === 'README.md') continue;

  const expectedLink = `](./${path.basename(file)})`;
  if (!docsIndex.includes(expectedLink)) {
    failures.push(`docs/README.md: missing index entry for docs/${path.basename(file)}`);
  }
}

for (const file of scannableFiles) {
  const contents = await readFile(file, 'utf8');
  const relativeFile = path.relative(root, file);

  if (relativeFile !== 'scripts/check-docs.mjs') {
    for (const retiredReference of retiredReferences) {
      if (contents.includes(retiredReference)) {
        failures.push(`${relativeFile}: references retired file ${retiredReference}`);
      }
    }
  }

  if (!file.endsWith('.md')) continue;

  const links = contents.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g);
  for (const match of links) {
    const rawTarget = match[1].replace(/^<|>$/g, '');
    if (
      rawTarget.startsWith('#') ||
      rawTarget.startsWith('http://') ||
      rawTarget.startsWith('https://') ||
      rawTarget.startsWith('mailto:')
    ) {
      continue;
    }

    const pathname = decodeURIComponent(rawTarget.split(/[?#]/, 1)[0]);
    const resolvedTarget = path.resolve(path.dirname(file), pathname);
    if (!(await exists(resolvedTarget))) {
      failures.push(`${relativeFile}: broken link ${rawTarget}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Documentation check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed (${markdownFiles.length} Markdown files).`);
}
