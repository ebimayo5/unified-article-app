const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, 'unified_article_app');
const context = {
  console,
  uaRelocateManagedAffiliateTokenByContext_: (body) => String(body || ''),
  uaExtractUrlsFromAffiliateCode_: (value) => {
    const text = String(value || '');
    const matches = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
    return Array.from(new Set(matches));
  },
  uaGetManagedAffiliateCtaSpec_: (row) => ({
    type: 'url',
    name: String(row.affiliateName || ''),
    url: String(row.affiliateUrl || ''),
    content: String(row.affiliateUrl || '')
  })
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'config.gs'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'utils.gs'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'article.gs'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'wordpress.gs'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'links.gs'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'pre_publish_check.gs'), 'utf8'), context);

const row = {
  appType: 'たくみパパ',
  mainInput: '積水ハウス 値引き 限界',
  affiliateName: '積水ハウス',
  affiliateUrl: 'https://example.com/sekisui',
  affiliateNotes: '問い合わせの際、紹介コード欄に「GJ1997」をコピペで記入する必要がある。これを書かないと紹介が成立しない。記事内では必ずコードを明示し、「コード欄に入力する」ことまで書く。'
};
const appConfig = vm.runInContext('UA_APP_TYPES.home', context);
const spec = context.uaGetManagedAffiliateCtaSpec_(row);
const cta = context.uaBuildManagedAffiliateCtaBlock_(spec, '積水ハウスで見積もり条件を確認する', appConfig);
const existingCtaBody = '<p>見積もり前に条件を整理します。</p>\n\n' + cta + '\n\n<h2>まとめ</h2>';

// 回帰対象: CTAが既にある記事でも、紹介コードがCTA直前へ必ず補完される。
const repaired = context.uaApplyManagedAffiliateCta_(existingCtaBody, row, appConfig);
assert.ok(repaired.includes('UA_AFFILIATE_REFERRAL_CODE_START'), 'managed referral notice must be inserted');
assert.ok(repaired.includes('GJ1997'), 'referral code must be retained');
const repairedCtaBounds = context.uaFindManagedAffiliateCtaBounds_(repaired, spec);
assert.ok(repairedCtaBounds && repaired.indexOf('GJ1997') < repairedCtaBounds.start, 'code notice must precede CTA');
assert.ok(context.uaHasManagedAffiliateReferralCodeNotice_(repaired, row, spec), 'CTA-adjacent referral notice must validate');

// 再処理しても増殖しない。公開前修正・WordPress更新を何度通しても1つに保つ。
const rerun = context.uaApplyManagedAffiliateCta_(repaired, row, appConfig);
assert.strictEqual((rerun.match(/UA_AFFILIATE_REFERRAL_CODE_START/g) || []).length, 1, 'referral notice must be idempotent');
assert.strictEqual((rerun.match(/GJ1997/g) || []).length, 1, 'referral code must not duplicate');

// 本文の前半にしかコードがない場合は合格にせず、CTA直前へ補完する。
const distantCodeBody = '<p>紹介コード欄に「GJ1997」を入力します。</p>\n' +
  '<p>' + '補足。'.repeat(900) + '</p>\n' + cta;
assert.strictEqual(context.uaHasManagedAffiliateReferralCodeNotice_(distantCodeBody, row, spec), false, 'distant code mention must not pass CTA-adjacent validation');
const relocated = context.uaEnsureManagedAffiliateReferralCodeNotice_(distantCodeBody, row, spec);
assert.ok((relocated.match(/GJ1997/g) || []).length >= 2, 'existing distant mention is preserved while CTA notice is added');
assert.ok(context.uaHasManagedAffiliateReferralCodeNotice_(relocated, row, spec), 'added CTA-adjacent notice must pass');

// 公開前チェックも、CTAだけがありコードがない記事を止め、補完済みなら通す。
const prePublishMissing = context.uaBuildPrePublishRuleCheck_(Object.assign({}, row, {
  body: existingCtaBody,
  titleIdeas: '案1：積水ハウスの値引き交渉で確認する条件',
  metaDescription: '紹介コードと値引き交渉の条件を整理します。',
  tags: '積水ハウス',
  permalink: 'sekisui-referral-test'
}));
assert.ok(prePublishMissing.critical.some((item) => item.includes('GJ1997') && item.includes('CTA直前')), 'pre-publish check must stop a missing referral notice');
const prePublishRepaired = context.uaBuildPrePublishRuleCheck_(Object.assign({}, row, {
  body: repaired,
  titleIdeas: '案1：積水ハウスの値引き交渉で確認する条件',
  metaDescription: '紹介コードと値引き交渉の条件を整理します。',
  tags: '積水ハウス',
  permalink: 'sekisui-referral-test'
}));
assert.ok(prePublishRepaired.ok.some((item) => item.includes('GJ1997') && item.includes('CTA直前')), 'pre-publish check must accept a CTA-adjacent referral notice');

// 条件を明記していない案件には余計な案内を追加しない。
const ordinaryRow = Object.assign({}, row, { affiliateNotes: '紹介コードの有無は案件担当へ確認してください。' });
assert.strictEqual(context.uaGetManagedAffiliateReferralCodeRequirement_(ordinaryRow), null, 'non-mandatory note must not create a notice');

console.log('affiliate referral CTA guard: OK');

