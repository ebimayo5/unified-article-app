const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  }
};

const context = {
  console,
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

console.log('complementary affiliate tests: OK (8 checks)');
