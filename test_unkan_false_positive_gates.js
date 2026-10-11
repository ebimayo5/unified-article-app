const fs = require('fs'), vm = require('vm'), assert = require('assert');
const root = __dirname + '/unified_article_app/';
const ctx = { console, UA_APP_TYPES: { unkan: { articleSheetName: '運管' } } };
vm.createContext(ctx);
['config.gs', 'utils.gs', 'links.gs', 'unkan_arcon.gs'].forEach((f) => vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx));

// 1) 運行管理者試験の科目名「道路交通法」だけでは、画面注視の資料を要求しない。
const exam = '<p>運行管理者試験の科目に道路交通法関係があります。</p>';
assert.deepStrictEqual(Array.from(ctx.uaGetRequiredEvidenceSourceCategories_('運行管理者 勉強方法', exam)), [], 'exam subject name must not require a driving-safety source');
// 試験記事でも、画面注視そのものを説明するなら従来どおり要求する。
assert.deepStrictEqual(Array.from(ctx.uaGetRequiredEvidenceSourceCategories_('運行管理者 勉強方法', '<p>運行管理者試験の話。走行中の運転者による画面注視は避けます。</p>')), ['driving_safety']);
// 試験以外の記事では、道路交通法の言及は従来どおり対象。
assert.deepStrictEqual(Array.from(ctx.uaGetRequiredEvidenceSourceCategories_('RAV4 HDMI どこ', '<p>道路交通法の注意を確認します。</p>')).indexOf('driving_safety') >= 0, true);

// 2) ユーキャンと「合格率」が離れた別ブロックにあるだけでは止めない。同じブロックなら止める。
const base = { titleIdeas: '勉強方法', metaDescription: '', tags: '' };
const apart = '<p>ユーキャンの講座を紹介します。</p><p><a href="/goukakuritsu/">合格率・難易度の記事</a></p>';
assert.deepStrictEqual(Array.from(ctx.uaUnkanContentIssues_({ ...base, body: apart })), []);
const same = '<p>ユーキャンは合格率が高い講座です。</p>';
assert.strictEqual(ctx.uaUnkanContentIssues_({ ...base, body: same }).length, 1);
const row = '<table><tr><td>ユーキャン</td><td>教育訓練給付の対象</td></tr></table>';
assert.strictEqual(ctx.uaUnkanContentIssues_({ ...base, body: row }).length, 1);
assert.strictEqual(ctx.uaUnkanContentIssues_({ ...base, body: 'ユーキャンの合格率' }).length, 1, 'untagged body falls back to whole text');
console.log('test_unkan_false_positive_gates OK');

// 3) タイトル案の「案1：」は確認対象にしない。数値を含む本当の主張は残す。
const claimsFor = (title) => Array.from(ctx.uaUnkanReviewClaims_({ body: '<p>本文</p>', titleIdeas: title, metaDescription: '', tags: '' }));
assert.deepStrictEqual(claimsFor('案1：運行管理者試験の勉強方法｜独学の進め方'), []);
assert.deepStrictEqual(claimsFor('案1：勉強方法 案2：進め方 案3：選び方'), []);
assert.strictEqual(claimsFor('案1：合格率は約38%を解説').length, 1);
console.log('title label gate OK');
