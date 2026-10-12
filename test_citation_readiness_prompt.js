const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console });
for (const file of ['prompt.gs', 'outline.gs', 'pre_publish_check.gs', 'unkan_arcon.gs']) {
  vm.runInContext(fs.readFileSync('unified_article_app/' + file, 'utf8'), context, { filename: file });
}
// Run real entry points, stub unrelated source retrieval and provider-dependent policy.
Object.assign(context, {
  UA_APP_TYPES: { unkan: { key: 'unkan' } },
  uaBuildExternalSourcesPrompt_: () => 'SOURCE', uaBuildInternalLinksPrompt_: () => 'LINK',
  uaBuildAffiliatePrompt_: () => 'AFFILIATE', uaBuildCompetitorPrompt_: () => 'COMPETITOR',
  uaBuildPreparedStructurePrompt_: () => 'STRUCTURE', uaBuildAutomaticArticlePolicyPrompt_: () => 'AUTO',
  uaBuildWpEditorThemePrompt_: () => 'THEME', uaCommonOutputRules_: () => 'OUTPUT',
  uaUnkanPolicy_: () => 'LEGAL_GATE', uaUnkanPublicNotes_: value => String(value || '').replace('PRIVATE', ''),
  uaGetAppConfigByLabel_: label => ({ key: label === '運行管理者試験対策' ? 'unkan' : label }),
  uaBuildArticleStructurePrompt_UnkanBase_: () => 'BASE_OUTLINE',
  uaBuildPrePublishEditorPrompt_UnkanBase_: () => 'BASE_REVIEW',
  uaBuildPrePublishPatchPrompt_UnkanBase_: () => 'BASE_PATCH'
});
const marker = '【回答の材料として使いやすくする共通編集基準】';
for (const key of ['drive', 'home', 'general']) {
  context['uaBuild' + ({ drive: 'Drive', home: 'Home', general: 'General' }[key]) + 'ArticlePrompt_'] = () => 'BASE_' + key;
  const data = { mainInput: 'test', appType: key };
  const article = context.uaBuildArticlePrompt_(data, { key });
  assert(article.includes(marker), key + ' article route missing criteria');
  assert(article.includes('THEME') && article.includes('AUTO'), 'existing output/policy retained');
  assert(context.uaBuildArticleStructurePrompt_(data, { key }, []).includes('答える問い／条件分岐'));
  assert(context.uaBuildPrePublishEditorPrompt_(data, {}).includes('引用確率や未確認の掲載実績を点数化しません'));
  assert(context.uaBuildPrePublishPatchPrompt_(data, '', '', '').includes('形式を揃えるための全文再生成'));
}
const unkan = { mainInput: '講習', appType: '運行管理者試験対策', affiliateNotes: 'PRIVATE' };
const article = context.uaBuildArticlePrompt_(unkan, { key: 'unkan' });
assert(article.includes(marker) && article.includes('LEGAL_GATE'));
assert(article.includes('試験区分・対象者・義務主体') && !article.includes('PRIVATE'));
assert.equal(article.split(marker).length - 1, 1, 'Unkan route must not append criteria twice');
assert(context.uaBuildArticleStructurePrompt_(unkan, { key: 'unkan' }, []).includes('LEGAL_GATE'));
assert(context.uaBuildPrePublishEditorPrompt_(unkan, {}).includes('LEGAL_GATE'));
assert(context.uaBuildPrePublishPatchPrompt_(unkan, '', '', '').includes('LEGAL_GATE'));
assert(context.uaBuildCitationReadinessPrompt_({ key: 'drive' }, 'write').includes('年式・搭載ナビ型番'));
assert(context.uaBuildCitationReadinessPrompt_({ key: 'home' }, 'write').includes('素材・設置環境・利用習慣'));
console.log('citation readiness: all article/outline/review/patch routes and Unkan policy pass');
