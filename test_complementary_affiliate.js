const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'config.gs'),
  'utf8'
);
const utilsSource = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'utils.gs'),
  'utf8'
);
const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'article.gs'),
  'utf8'
);

const projects = {
  'ガリバー中古車ご提案サービス': {
    name: 'ガリバー中古車ご提案サービス',
    url: 'https://px.example/gulliver',
    linkInput: '<a href="https://px.example/gulliver" rel="nofollow">＜自由テキスト02＞</a><img src="https://track.example/gulliver" width="1" height="1">'
  },
  'カーネクスト': {
    name: 'カーネクスト',
    url: 'https://t.example/carnext',
    linkInput: '<a href="https://t.example/carnext" rel="nofollow">自由テキスト</a><img src="https://track.example/carnext" width="1" height="1">'
  },
  'ナビ男くん': {
    name: 'ナビ男くん',
    url: 'https://px.example/naviokun',
    linkInput: '<a href="https://px.example/naviokun" rel="nofollow">ナビ男くん</a>'
  },
  // Real production data (2026-08-30): ナビ男くんの案件管理シートの実際の値は
  // linkInput===url の裸URLで、<a>タグではなかった。
  'ナビ男くんBareUrl': {
    name: 'ナビ男くん',
    url: 'https://px.example/naviokun-bare',
    linkInput: 'https://px.example/naviokun-bare'
  },
  'ottocast': {
    name: 'ottocast',
    url: 'https://t.example/ottocast',
    linkInput: '<a href="https://t.example/ottocast" rel="nofollow">自由テキスト</a><img src="https://track.example/ottocast" width="1" height="1">'
  }
};

const context = {
  console,
  uaUsesSwellBlocks_: () => true,
  uaGetSwellButtonColor_: (appConfig) => appConfig && appConfig.key === 'home' ? 'orange' : 'green',
  uaRelocateManagedAffiliateTokenByContext_: (body) => String(body || ''),
  uaNormalizeAffiliateName_: (value) => String(value || '').trim(),
  uaNormalizeAffiliateCodeInput_: (value) => String(value || '').trim(),
  uaExtractUrlsFromAffiliateCode_: (value) => {
    const urls = [];
    const text = String(value || '');
    const regex = /\b(?:href|src)=["'](https?:\/\/.*?)["']/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!urls.includes(match[1])) urls.push(match[1]);
    }
    if (!urls.length && /^https?:\/\//i.test(text)) urls.push(text);
    return urls;
  },
  uaReadAffiliateProjectByName_: (name) => projects[name] || null,
  uaGetManagedAffiliateCtaSpec_: (rowData) => {
    const project = projects[rowData.affiliateName];
    return project ? { type: 'html', name: project.name, url: project.url, content: project.linkInput } : null;
  }
};
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(source, context);

const mainBlock = (url) => [
  '<!-- wp:cocoon-blocks/button-wrap-1 {"tag":"test"} -->',
  '<div><a href="' + url + '">main</a></div>',
  '<!-- /wp:cocoon-blocks/button-wrap-1 -->'
].join('\n');

const drive = { key: 'drive' };
const gulliverBody = '<p>今の車から乗り換える条件を整理します。</p>\n' + mainBlock(projects['ガリバー中古車ご提案サービス'].url) + '\n<h2>まとめ</h2>';
const gulliverResult = context.uaApplyManagedAffiliateCta_(gulliverBody, {
  appType: 'DRIVE BASE',
  mainInput: '中古車 乗り換え',
  affiliateName: 'ガリバー中古車ご提案サービス'
}, drive);
assert.ok(gulliverResult.includes('UA_SUB_AFFILIATE_START'), 'sub marker must be inserted');
assert.ok(gulliverResult.includes('カーネクストで今の車の査定条件を確認する'), 'Carnext must be the text-link sub offer');
assert.ok(gulliverResult.indexOf('UA_SUB_AFFILIATE_START') > gulliverResult.indexOf('wp:cocoon-blocks/button-wrap-1'), 'sub link must follow the main button');
assert.ok(/href="https:\/\/t\.example\/carnext" rel="nofollow sponsored noopener"/.test(gulliverResult), 'Carnext sub-affiliate link must gain rel="sponsored" from nofollow-only source HTML');

const idempotent = context.uaApplyManagedAffiliateCta_(gulliverResult, {
  appType: 'DRIVE BASE',
  mainInput: '中古車 乗り換え',
  affiliateName: 'ガリバー中古車ご提案サービス'
}, drive);
assert.strictEqual((idempotent.match(/UA_SUB_AFFILIATE_START/g) || []).length, 1, 'sub link must not duplicate');

const unrelatedBody = '<p>購入前に故障傾向を確認します。</p>\n' + mainBlock(projects['ガリバー中古車ご提案サービス'].url) + '\n<h2>まとめ</h2>';
const unrelatedResult = context.uaApplyManagedAffiliateCta_(unrelatedBody, {
  appType: 'DRIVE BASE',
  mainInput: 'アウディ 故障 多い',
  affiliateName: 'ガリバー中古車ご提案サービス'
}, drive);
assert.ok(!unrelatedResult.includes('UA_SUB_AFFILIATE_START'), 'unrelated purchase research must not receive a sub offer');

const carnextBody = '<p>売却後は次の車も比較します。</p>\n' + mainBlock(projects['カーネクスト'].url) + '\n<h2>まとめ</h2>';
const carnextResult = context.uaApplyManagedAffiliateCta_(carnextBody, {
  appType: 'DRIVE BASE',
  mainInput: '車 買取 乗り換え',
  affiliateName: 'カーネクスト'
}, drive);
assert.ok(carnextResult.includes('ガリバーで希望に合う中古車の提案を確認する'), 'Gulliver must be the text-link sub offer');
assert.ok(!/cocoon-blocks\/button-wrap-1[\s\S]*ガリバーで/.test(carnextResult.split('UA_SUB_AFFILIATE_START')[1] || ''), 'sub offer must not become a button');

const naviBody = '<p>有線CarPlay対応車でAI Boxを使う方法と、HDMI施工が必要な場合を比較します。</p>\n' + mainBlock(projects['ナビ男くん'].url) + '\n<h2>まとめ</h2>';
const naviResult = context.uaApplyManagedAffiliateCta_(naviBody, {
  appType: 'DRIVE BASE',
  mainInput: 'ステップワゴン hdmi どこ',
  affiliateName: 'ナビ男くん'
}, drive);
assert.ok(naviResult.includes('UA_OTTOCAST_AFFILIATE_START'), 'Ottocast marker must be inserted for an AI Box article');
assert.ok(naviResult.includes('OttocastでCarPlay AI Boxの対応機種を確認する'), 'Ottocast free text must be replaced with the contextual CTA');
assert.ok(naviResult.includes('https://track.example/ottocast'), 'Ottocast tracking pixel must be preserved');
assert.ok(naviResult.indexOf('UA_OTTOCAST_AFFILIATE_START') < naviResult.indexOf('wp:cocoon-blocks/button-wrap-1'), 'Ottocast branch must appear before the Naviokun button');
// The ASP's own boilerplate for this product only ever supplies rel="nofollow"
// (confirmed against afb's real ad-code page for this product), so the
// fixture matches that real-world input. "sponsored" must be added even
// though the source HTML never had it.
assert.ok(/href="https:\/\/t\.example\/ottocast" rel="nofollow sponsored noopener"/.test(naviResult), 'Ottocast link must gain rel="sponsored" even though the ASP-supplied code only has nofollow');

const naviIdempotent = context.uaApplyManagedAffiliateCta_(naviResult, {
  appType: 'DRIVE BASE',
  mainInput: 'ステップワゴン hdmi どこ',
  affiliateName: 'ナビ男くん'
}, drive);
assert.strictEqual((naviIdempotent.match(/UA_OTTOCAST_AFFILIATE_START/g) || []).length, 1, 'Ottocast branch must not duplicate');

const genericNaviBody = '<p>ナビの工賃と取付キットを確認します。</p>\n' + mainBlock(projects['ナビ男くん'].url) + '\n<h2>まとめ</h2>';
const genericNaviResult = context.uaApplyManagedAffiliateCta_(genericNaviBody, {
  appType: 'DRIVE BASE',
  mainInput: 'オートバックス カーナビ 工賃',
  affiliateName: 'ナビ男くん'
}, drive);
assert.ok(!genericNaviResult.includes('UA_OTTOCAST_AFFILIATE_START'), 'generic navigation articles must not receive Ottocast');

// Real 2026-08-30 case: the row's own affiliateName IS "ottocast" (not a
// ナビ男くん sub-offer) -- this exercises uaBuildManagedAffiliateCtaBlock_'s
// 'html' branch directly, the same rel="nofollow"-only source as the afb ASP
// page confirmed.
const ottocastMainBody = '<p>ディスプレイオーディオの接続方法を比較します。</p>\n[UA_AFFILIATE_CTA: Ottocastで対応機種を確認する]\n<h2>まとめ</h2>';
const ottocastMainResult = context.uaApplyManagedAffiliateCta_(ottocastMainBody, {
  appType: 'DRIVE BASE',
  mainInput: 'ディスプレイオーディオ 後悔',
  affiliateName: 'ottocast'
}, drive);
assert.ok(/href="https:\/\/t\.example\/ottocast" rel="nofollow sponsored noopener"/.test(ottocastMainResult), 'Ottocast as the MAIN affiliate CTA must also gain rel="sponsored"');

// Reverse direction of the ナビ男くん→Ottocast sub-offer: when Ottocast is the
// MAIN affiliate and the article's topic needs more than a wired adapter can
// give (HDMI addition, rear-seat monitor wiring, a full nav swap), ナビ男くん
// must appear as the second touchpoint. This closes the gap found on
// display-audio-regret-guide, whose only CTA was the single Ottocast link.
const ottocastToNaviBody = '<p>純正機能を残したままHDMI増設や後席モニター連携をしたい場合を比較します。</p>\n' + mainBlock(projects['ottocast'].url) + '\n<h2>まとめ</h2>';
const ottocastToNaviResult = context.uaApplyManagedAffiliateCta_(ottocastToNaviBody, {
  appType: 'DRIVE BASE',
  mainInput: 'ディスプレイオーディオ 後席モニター',
  affiliateName: 'ottocast'
}, drive);
assert.ok(ottocastToNaviResult.includes('UA_NAVIOKUN_SUB_START'), 'ナビ男くん sub marker must be inserted when Ottocast alone cannot cover the need');
assert.ok(/href="https:\/\/px\.example\/naviokun" rel="nofollow sponsored noopener"/.test(ottocastToNaviResult), 'ナビ男くん sub link must carry rel="sponsored" too');
assert.ok(ottocastToNaviResult.indexOf('UA_NAVIOKUN_SUB_START') > ottocastToNaviResult.indexOf('wp:cocoon-blocks/button-wrap-1'), 'ナビ男くん sub-offer must follow the main Ottocast button');

const naviSubIdempotent = context.uaApplyManagedAffiliateCta_(ottocastToNaviResult, {
  appType: 'DRIVE BASE',
  mainInput: 'ディスプレイオーディオ 後席モニター',
  affiliateName: 'ottocast'
}, drive);
assert.strictEqual((naviSubIdempotent.match(/UA_NAVIOKUN_SUB_START/g) || []).length, 1, 'ナビ男くん sub-offer must not duplicate');

const ottocastOnlyBody = '<p>有線接続だけで完結させたい人向けの比較です。</p>\n' + mainBlock(projects['ottocast'].url) + '\n<h2>まとめ</h2>';
const ottocastOnlyResult = context.uaApplyManagedAffiliateCta_(ottocastOnlyBody, {
  appType: 'DRIVE BASE',
  mainInput: 'CarPlay AI Box おすすめ',
  affiliateName: 'ottocast'
}, drive);
assert.ok(!ottocastOnlyResult.includes('UA_NAVIOKUN_SUB_START'), 'articles with no installation need must not receive a ナビ男くん sub offer');

// Placement must follow the reader's actual point of interest, not just
// "somewhere after the main CTA" or "near the end". With two distinct H2
// sections -- an early one about wired connection (where the main CTA sits)
// and a later, unrelated-to-the-main-CTA section that actually discusses
// HDMI増設/後席モニター -- the sub-offer must land at that second section,
// not immediately after the main button.
const spreadBody = [
  '<h2>有線接続の比較</h2>',
  '<p>USB接続だけで完結させたい場合を比較します。</p>',
  mainBlock(projects['ottocast'].url),
  '<h2>関係のない話題</h2>',
  '<p>本題とは関係のない話です。</p>',
  '<h2>後席モニターとHDMI増設の検討</h2>',
  '<p>純正機能を残したままHDMI増設や後席モニター連携をしたい場合の配線施工を検討します。</p>',
  '<h2>まとめ</h2>'
].join('\n');
const spreadResult = context.uaApplyManagedAffiliateCta_(spreadBody, {
  appType: 'DRIVE BASE',
  mainInput: 'ディスプレイオーディオ 後席モニター',
  affiliateName: 'ottocast'
}, drive);
const subIndex = spreadResult.indexOf('UA_NAVIOKUN_SUB_START');
const relevantSectionIndex = spreadResult.indexOf('後席モニターとHDMI増設の検討');
const unrelatedSectionIndex = spreadResult.indexOf('関係のない話題');
assert.ok(subIndex > relevantSectionIndex, 'ナビ男くん sub-offer must land inside/after the section that actually discusses HDMI/後席モニター');
assert.ok(subIndex > unrelatedSectionIndex, 'sub-offer must be spread away from the main CTA, past the unrelated section in between');

// Real 2026-08-30 bug: ナビ男くんの実際の案件管理データはlinkInput===url の裸URLで、
// <a>タグではなかった。uaBuildManagedNaviokunSubBlock_'s anchor-tag regex found
// nothing and silently produced no sub-offer at all on a real, live article
// (display-audio-regret-guide) despite every relevance check passing. Fixed
// with the same bare-URL fallback uaBuildManagedSubAffiliateBlock_ already had.
const bareUrlOriginalReader = context.uaReadAffiliateProjectByName_;
context.uaReadAffiliateProjectByName_ = function(name) {
  if (name === 'ナビ男くん') return projects['ナビ男くんBareUrl'];
  return projects[name] || null;
};
const bareUrlBody = '<p>純正機能を残したままHDMI増設や後席モニター連携をしたい場合を比較します。</p>\n' + mainBlock(projects['ottocast'].url) + '\n<h2>まとめ</h2>';
const bareUrlResult = context.uaApplyManagedAffiliateCta_(bareUrlBody, {
  appType: 'DRIVE BASE',
  mainInput: 'ディスプレイオーディオ 後席モニター',
  affiliateName: 'ottocast'
}, drive);
context.uaReadAffiliateProjectByName_ = bareUrlOriginalReader;
assert.ok(bareUrlResult.includes('UA_NAVIOKUN_SUB_START'), 'bare-URL linkInput (real production shape) must still produce a ナビ男くん sub-offer, not silently nothing');
assert.ok(/href="https:\/\/px\.example\/naviokun-bare" target="_blank" rel="nofollow sponsored noopener">ナビ男くんで施工内容と対応車種を確認する<\/a>/.test(bareUrlResult), 'bare-URL fallback must build a proper anchor with the custom CTA text and rel="sponsored"');

console.log('complementary affiliate tests: OK (27 checks)');
