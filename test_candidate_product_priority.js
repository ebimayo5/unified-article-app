const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');
const automationSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'automation.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(articleSource, context);
vm.runInContext(automationSource, context);

const UA_APP_TYPES = vm.runInContext('UA_APP_TYPES', context);
const homeConfig = UA_APP_TYPES.home;
const driveConfig = UA_APP_TYPES.drive;
context.uaSelectNextCandidateIndex_ = vm.runInContext('uaSelectNextCandidateIndex_', context);

// UA_CANDIDATE_COLUMNS: status=1, affiliateName=2, keyword=3, volume=4 (1-indexed)
function row(status, keyword, volume) {
  return ['', '', '', ''].map(function(_, i) { return ''; })
    .map(function(_, i) {
      if (i === 0) return status;
      if (i === 1) return '';
      if (i === 2) return keyword;
      return volume || '';
    });
}

// 1) たくみパパ: a later, product-linked candidate ("冷蔵庫マット後悔" -- 冷蔵庫 matches
// the appliance product signal) must be picked ahead of an earlier candidate whose
// keyword has no sellable product ("二階洗面台後悔" -- pure layout/renovation topic).
{
  const values = [
    row('書く', '二階 洗面台 後悔'),
    row('書く', '冷蔵庫 マット 後悔'),
    row('書く', 'サンシェード 強風対策')
  ];
  const selected = context.uaSelectNextCandidateIndex_(values, homeConfig);
  assert.strictEqual(selected, 1, 'たくみパパでは商品にひも付く候補（冷蔵庫マット後悔）が、順番が後でも先に選ばれる');
}

// 2) たくみパパ: when NO candidate in the queue is product-linked, fall back to the
// original first-writable-row behavior (unchanged from before this feature).
{
  const values = [
    row('保留', '二階 洗面台 後悔'),
    row('書く', '一階 声 聞こえる'),
    row('書く', '玄関 収納 狭い')
  ];
  const selected = context.uaSelectNextCandidateIndex_(values, homeConfig);
  assert.strictEqual(selected, 1, '商品にひも付く候補が1件もない場合は、従来通り最初の「書く」行が選ばれる');
}

// 3) DRIVE BASE: behavior must be completely unchanged (always the first "書く" row,
// regardless of whether a later row happens to look product-related) -- this feature
// is scoped to たくみパパ's Rinker-first strategy only.
{
  const values = [
    row('書く', 'フィアット パンダ 買って 後悔'),
    row('書く', 'ドライブレコーダー おすすめ')
  ];
  const selected = context.uaSelectNextCandidateIndex_(values, driveConfig);
  assert.strictEqual(selected, 0, 'DRIVE BASEは商品リンク優先ロジックの対象外で、常に最初の「書く」行のまま');
}

// 4) Rows with an empty keyword or a non-書く status must still be skipped entirely,
// same as before.
{
  const values = [
    row('転送済み', '冷蔵庫 マット 後悔'),
    row('書く', ''),
    row('書く', 'ランドリー チェスト カビ')
  ];
  const selected = context.uaSelectNextCandidateIndex_(values, homeConfig);
  assert.strictEqual(selected, 2, '転送済み行・キーワード空欄行はスキップされる');
}

console.log('Candidate product-priority selection: OK');
