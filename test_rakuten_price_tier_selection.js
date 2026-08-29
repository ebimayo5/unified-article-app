const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const linksSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'links.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(linksSource, context);
vm.runInContext(articleSource, context);

const uaSelectDiverseRakutenItems_ = vm.runInContext('uaSelectDiverseRakutenItems_', context);
const uaPickPriceTierAwarePrimaryItem_ = vm.runInContext('uaPickPriceTierAwarePrimaryItem_', context);

// 1) Clear single winner: when only one candidate is within the tie tolerance
// of the top score, it wins regardless of price -- this must never override a
// genuinely stronger relevance match.
{
  const candidates = [
    { name: '本命商品', url: 'https://example.com/best', price: 3000, reviewCount: 50, relevanceScore: 100 },
    { name: '関連性が弱い商品', url: 'https://example.com/weak', price: 500, reviewCount: 5000, relevanceScore: 60 }
  ];
  const result = uaSelectDiverseRakutenItems_(candidates, 1, 'seed-clear-winner');
  assert.strictEqual(result.length, 1, '1件だけ返す');
  assert.strictEqual(result[0].url, 'https://example.com/best', '関連性が明確に高い商品が、価格やレビュー数に関係なく選ばれる');
}

// 2) Near-tie band: several candidates within tolerance of the top score, at
// different price points. Different article seeds must be able to land on
// different price tiers (not always collapse onto the single most-reviewed
// item), while every pick stays within the near-tie band (never picks the
// clearly-weaker candidate outside the band).
{
  const candidates = [
    { name: '定番モデル', url: 'https://example.com/mid', price: 2000, reviewCount: 800, relevanceScore: 100 },
    { name: '廉価モデル', url: 'https://example.com/cheap', price: 900, reviewCount: 300, relevanceScore: 98 },
    { name: '上位モデル', url: 'https://example.com/premium', price: 4500, reviewCount: 120, relevanceScore: 97 },
    { name: '関連性が弱い商品', url: 'https://example.com/weak', price: 100, reviewCount: 9999, relevanceScore: 50 }
  ];
  const withinBand = new Set(['https://example.com/mid', 'https://example.com/cheap', 'https://example.com/premium']);
  const picks = new Set();
  for (let i = 0; i < 30; i++) {
    const result = uaSelectDiverseRakutenItems_(candidates, 1, 'seed-' + i);
    assert.strictEqual(result.length, 1);
    assert.ok(withinBand.has(result[0].url), '近い関連性の候補以外（明確に弱い商品）は絶対に選ばれない: ' + result[0].url);
    picks.add(result[0].url);
  }
  assert.ok(picks.size >= 2, '複数のシード（記事）にわたって、価格帯の異なる候補が選ばれることがある（実際: ' + picks.size + '種類）');
}

// 3) Determinism: the same seed always yields the same pick (so regenerating
// or re-reading the same article row doesn't change which product it shows).
{
  const candidates = [
    { name: 'A', url: 'https://example.com/a', price: 1000, reviewCount: 100, relevanceScore: 100 },
    { name: 'B', url: 'https://example.com/b', price: 3000, reviewCount: 90, relevanceScore: 99 }
  ];
  const first = uaSelectDiverseRakutenItems_(candidates, 1, 'stable-seed')[0].url;
  const second = uaSelectDiverseRakutenItems_(candidates, 1, 'stable-seed')[0].url;
  assert.strictEqual(first, second, '同じシードなら常に同じ商品が選ばれる');
}

// 4) uaPickPriceTierAwarePrimaryItem_ directly: with a single candidate, or all
// candidates identical in relevance, it never throws and returns a valid item.
{
  const single = [{ name: 'Only', url: 'https://example.com/only', price: 1000, reviewCount: 10, relevanceScore: 80 }];
  assert.strictEqual(uaPickPriceTierAwarePrimaryItem_(single, 'seed').url, 'https://example.com/only');
}

// 5) Multi-item requests (limit > 1) are completely unaffected -- reuses the
// same fixture as the existing GAS-side uaTestDiverseRakutenItemSelection to
// guard against this change leaking into the multi-item diversity path.
{
  const candidates = [
    { name: '2倍巻き トイレットペーパー ダブル 8ロール', url: 'https://example.com/a', price: 980, reviewCount: 300, relevanceScore: 100 },
    { name: '2倍巻き トイレットペーパー ダブル 8ロール 送料無料', url: 'https://example.com/b', price: 1000, reviewCount: 900, relevanceScore: 99 },
    { name: '2倍巻き トイレットペーパー ダブル 6ロール コンパクト', url: 'https://example.com/c', price: 760, reviewCount: 180, relevanceScore: 96 },
    { name: '2倍巻き トイレットペーパー ダブル 12ロール 大容量', url: 'https://example.com/d', price: 1480, reviewCount: 240, relevanceScore: 94 }
  ];
  const selected = uaSelectDiverseRakutenItems_(candidates, 3, 'diversity-test');
  const urls = selected.map(function(item) { return item.url; });
  assert.strictEqual(selected.length, 3, '複数件リクエスト時の件数は変わらない');
  assert.ok(urls.indexOf('https://example.com/a') !== -1, '複数件選定時は、最も強い関連候補が必ず含まれる（今回の変更の影響を受けない）');
}

console.log('Rakuten price-tier primary item selection: OK');
