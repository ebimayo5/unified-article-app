const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(articleSource, context);

const uaSelectCtaPhraseTemplate_ = vm.runInContext('uaSelectCtaPhraseTemplate_', context);
const uaNormalizeManagedAffiliateCtaText_ = vm.runInContext('uaNormalizeManagedAffiliateCtaText_', context);
const UA_CTA_PHRASE_TEMPLATES = vm.runInContext('UA_CTA_PHRASE_TEMPLATES', context);

// 1) Deterministic: the same seed always picks the same phrase (so re-generating
// the same article, or re-reading a stored row, doesn't shuffle its CTA text).
{
  const first = uaSelectCtaPhraseTemplate_('フィアット パンダ 買って 後悔');
  const second = uaSelectCtaPhraseTemplate_('フィアット パンダ 買って 後悔');
  assert.strictEqual(first, second, '同じシードなら常に同じ文言を選ぶ');
  assert.ok(UA_CTA_PHRASE_TEMPLATES.indexOf(first) !== -1, '選ばれる文言はテンプレート集合の中から');
}

// 2) Variety: different article topics (the realistic seed -- mainInput) must not
// all collapse onto the same phrase. This is the actual bug being fixed: DRIVE
// BASE articles converging on near-identical CTA wording.
{
  const sampleKeywords = [
    'フィアット パンダ 買って 後悔',
    'セレナ e-power 買って 後悔',
    'ヴェゼル 貧乏人',
    'マツダ ロゴ ダサい',
    'カーナビ 走行中 解除 オート',
    'オートバックス カーナビ 工賃',
    'カーナビテレビ見れない',
    'テールゲートスポイラー いらない',
    'ステップワゴン 後席モニター',
    'フリード hdmi どこ'
  ];
  const chosen = sampleKeywords.map(uaSelectCtaPhraseTemplate_);
  const distinctCount = new Set(chosen).size;
  assert.ok(distinctCount >= 3, '10記事分のキーワードに対して、CTA文言が3種類未満に収束していない（実際: ' + distinctCount + '種類）');
}

// 3) uaNormalizeManagedAffiliateCtaText_: when the AI's CTA text is vague/rejected,
// the fallback now rotates by seed instead of always being "対応内容を確認する".
{
  const fallbackA = uaNormalizeManagedAffiliateCtaText_('詳しくはこちら', 'ナビ男くん', 'カーナビ 走行中 解除 オート');
  const fallbackB = uaNormalizeManagedAffiliateCtaText_('詳しくはこちら', 'ナビ男くん', 'テールゲートスポイラー いらない');
  assert.ok(fallbackA.indexOf('ナビ男くん') === 0, '案件名で始まる（旧仕様を維持）');
  assert.ok(fallbackA !== fallbackB, '異なる記事シードなら、フォールバック文言も変わりうる（両方が同じ = 実質固定文言のまま）');
}

// 4) uaNormalizeManagedAffiliateCtaText_: valid, on-topic AI-provided text is still
// preserved as-is (rotation only kicks in for vague/rejected text -- this must not
// regress the existing accept-good-text behavior).
{
  const kept = uaNormalizeManagedAffiliateCtaText_('ナビ男くんで対応車種と純正機能の相性を確認する', 'ナビ男くん', 'seed');
  assert.strictEqual(kept, 'ナビ男くんで対応車種と純正機能の相性を確認する', 'AIが妥当な文言を出した場合はそのまま使う');
}

console.log('CTA phrase rotation: OK');
