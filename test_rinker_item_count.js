const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'article.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const originalSingleFetch = context.uaFetchRakutenItems_;
const originalMultiFetch = context.uaFetchRakutenItemsByQueries_;

context.uaFetchRakutenItems_ = (query, count) => Array.from({ length: count }, (_, index) => ({
  itemCode: query + '-' + (index + 1),
  url: 'https://example.com/' + encodeURIComponent(query) + '/' + (index + 1),
  name: query + ' 候補' + (index + 1)
}));

let singleQueryItems = context.uaFetchRakutenItemsAcrossQueries_(
  ['遮光カーテン'],
  3,
  '遮光カーテン やめた',
  null
);
assert.strictEqual(singleQueryItems.length, 3, '1つの検索語からも3商品を取得する');

context.uaFetchRakutenItemsByQueries_ = () => [
  { itemCode: 'shared-1', url: 'https://example.com/shared-1', name: '主候補' }
];
context.uaFetchRakutenItems_ = (query) => [
  { itemCode: 'shared-1', url: 'https://example.com/shared-1', name: '主候補' },
  { itemCode: 'extra-2', url: 'https://example.com/extra-2', name: query + ' 候補2' },
  { itemCode: 'extra-3', url: 'https://example.com/extra-3', name: query + ' 候補3' }
];

const backfilledItems = context.uaFetchRakutenItemsAcrossQueries_(
  ['遮光カーテン', '遮光カーテン 1級'],
  3,
  '遮光カーテン やめた',
  null
);
assert.deepStrictEqual(
  backfilledItems.map(item => item.itemCode),
  ['shared-1', 'extra-2', 'extra-3'],
  '複数検索でも不足分を重複なしで補充する'
);

context.uaFetchRakutenItems_ = originalSingleFetch;
context.uaFetchRakutenItemsByQueries_ = originalMultiFetch;

console.log('Rinker item count tests: OK (2 checks)');
