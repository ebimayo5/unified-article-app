const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'wordpress.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const parse = context.uaParseWpTitleCandidates_;
const pick = context.uaPickWpTitle_;
const weakReason = context.uaFindWeakWpTitleReason_;

const cases = [
  {
    name: 'label then slash format',
    input: '案1 / ハリアーのテレビキャンセラー選び｜適合とタイプ比較で後悔を防ぐ / 案2 / ハリアーのテレビキャンセラーは必要？ナビ操作の注意点 / 案3 / ハリアーのテレビキャンセラーを安全に選ぶ3つの確認項目',
    expectedCount: 3
  },
  {
    name: 'label and title format',
    input: '案1 カーナビ画面が映らない原因と確認手順 / 案2 音は出るのに画面が真っ暗なときは故障？ / 案3 修理か交換か迷ったときの見分け方',
    expectedCount: 3
  },
  {
    name: 'colon and newline format',
    input: '案1：乾太くんで後悔する家庭は？\n案2：乾太くんは必要？容量と動線で判断\n案3：乾太くんを付ける前に知りたい費用差',
    expectedCount: 3
  },
  {
    name: 'unlabelled slash format',
    input: 'トイレブラシはいらない？代替方法 / ブラシなしで清潔を保てる？ / 家庭に合う掃除方法を選ぶ',
    expectedCount: 3
  }
];

cases.forEach((testCase) => {
  const candidates = parse(testCase.input);
  assert.strictEqual(candidates.length, testCase.expectedCount, testCase.name);
  candidates.forEach((candidate) => {
    assert.ok(!/^案\s*[1-3１-３一二三]/.test(candidate), testCase.name + ': label remained');
    assert.ok(!/[\/／]\s*案\s*[1-3１-３一二三]/.test(candidate), testCase.name + ': multiple ideas remained');
  });
});

const brokenFormat = cases[0].input;
const selectedBroken = pick(brokenFormat, 'ハリアー テレビキャンセラー', '');
assert.ok(selectedBroken.length < 60, 'broken format must never become the full WordPress title');
assert.ok(!/案\s*[1-3１-３一二三]/.test(selectedBroken), 'selected title must not include idea labels');

const qualityCandidates = [
  '案1：CX-8のテレビキャンセラー選び｜適合・費用・施工の判断基準',
  '案2：CX-8のテレビキャンセラーは付けられる？年式別の注意点',
  '案3：CX-8テレビキャンセラーで後悔する前に知りたい保証条件'
].join('\n');
const selectedQuality = pick(qualityCandidates, 'cx-8 テレビキャンセラー', '');
assert.notStrictEqual(
  selectedQuality,
  'CX-8のテレビキャンセラー選び｜適合・費用・施工の判断基準',
  'a concrete reader question should beat a bland generic title'
);
assert.ok(/[？?]|後悔/.test(selectedQuality), 'selected title should carry a reader-facing hook');

assert.ok(
  weakReason('CX-8のテレビキャンセラー選び｜適合・施工の判断基準'),
  'generic abstract ending should be flagged'
);
assert.strictEqual(
  weakReason('CX-8のテレビキャンセラーは付けられる？年式別の注意点'),
  '',
  'reader-facing question should not be flagged'
);

assert.strictEqual(
  pick('浴室の髪の毛掃除を楽にする方法｜毎日1分でためない仕組み', '浴室 髪の毛 掃除 楽', ''),
  '浴室の髪の毛掃除を楽にする方法｜毎日1分でためない仕組み',
  'single selected title should remain unchanged'
);

console.log('title selection tests: OK (' + (cases.length + 5) + ' checks)');
