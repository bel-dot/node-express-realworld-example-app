const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function getAllTsFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('dist')) {
        getAllTsFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.test.ts')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

function analyzeSourceCode(code) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, code);
  const operators = new Set();
  const operands = new Set();
  let N1 = 0;
  let N2 = 0;

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    const text = scanner.getTokenText();

    if (
      token === ts.SyntaxKind.Identifier ||
      token === ts.SyntaxKind.NumericLiteral ||
      token === ts.SyntaxKind.StringLiteral ||
      token === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
      token === ts.SyntaxKind.TrueKeyword ||
      token === ts.SyntaxKind.FalseKeyword ||
      token === ts.SyntaxKind.NullKeyword ||
      token === ts.SyntaxKind.UndefinedKeyword
    ) {
      operands.add(text);
      N2++;
    } else if (
      (token >= ts.SyntaxKind.FirstPunctuation && token <= ts.SyntaxKind.LastPunctuation) ||
      (token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword)
    ) {
      operators.add(text);
      N1++;
    }
    token = scanner.scan();
  }

  const n1 = operators.size;
  const n2 = operands.size;
  const n = n1 + n2;
  const N = N1 + N2;
  const V = n > 0 ? N * Math.log2(n) : 0;
  const D = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
  const E = V * D;
  const B = V / 3000;

  const lines = code.split(/\r?\n/).filter((l) => l.trim().length > 0).length;

  return {
    LOC: lines,
    n1,
    n2,
    N1,
    N2,
    n,
    N,
    V: Number(V.toFixed(2)),
    D: Number(D.toFixed(2)),
    E: Number(E.toFixed(2)),
    B: Number(B.toFixed(4)),
  };
}

const srcDir = path.join(process.cwd(), 'src');
const allFiles = getAllTsFiles(srcDir);

let globalCode = '';
allFiles.forEach((f) => {
  globalCode += '\n' + fs.readFileSync(f, 'utf8');
});

const globalMetrics = analyzeSourceCode(globalCode);

console.log('======================================================================');
console.log('       HALSTEAD COMPLEXITY SAST SCANNER (TypeScript AST Analyzer)     ');
console.log('======================================================================');
console.log('Scanned Production Files (src/):', allFiles.length);
console.log('\n--- [1] GLOBAL BASELINE SCAN (ENTIRE REPOSITORY) ---');
console.table([globalMetrics]);

const targetCandidates = [
  { role: '1. Core Domain', paths: ['src/app/routes/article/article.service.ts'] },
  { role: '2. Infrastructure/Auth', paths: ['src/app/routes/auth/auth.service.ts'] },
  {
    role: '3. Utility/DTO/Mapper',
    paths: [
      'src/app/routes/article/article.model.ts',
      'src/app/routes/article/article.mapper.ts',
      'src/app/routes/auth/user.model.ts',
    ],
  },
];

const fileResults = {};
targetCandidates.forEach((item) => {
  const existingPath = item.paths.find((p) => fs.existsSync(path.join(process.cwd(), p)));
  if (existingPath) {
    const content = fs.readFileSync(path.join(process.cwd(), existingPath), 'utf8');
    const m = analyzeSourceCode(content);
    fileResults[`${item.role} (${path.basename(existingPath)})`] = m;
  }
});

console.log('\n--- [2] ARCHITECTURAL LAYER COMPARISON (3 TARGET FILES) ---');
console.table(fileResults);
