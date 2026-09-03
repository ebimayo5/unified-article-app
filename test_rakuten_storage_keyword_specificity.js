const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Real case, 2026-09-02: kurashi-ie.com/yabugarashi-kujo/ (a weed-removal
// article) ended up recommending storage boxes ("収納ボックス 住宅") to
// readers. The article never mentions "収納" or "収納ボックス" anywhere --
// confirmed live via a position-based diagnostic (uaInvestigateYabugarashi
// IrrelevantProduct20260902_Positions in wordpress.gs): both words occur
// zero times outside the already-inserted product block itself. The only
// real match was the word "片付け" (used in the sense of "cleaning up after
// removing weeds"), which was one of uaHomeRakutenProductCandidates_'s
// trigger keywords for this candidate. uaPrioritizedRakutenQueriesFromBody_
// (a separate, earlier-checked candidate list) didn't match this article's
// text at all, so uaSelectRakutenProductQuery_ fell through to
// uaHomeRakutenProductCandidates_, where "片付け" alone was enough to score
// >= minScore (1) and select this candidate. "片付け" is too generic to
// imply genuine interest in storage products, so it must not trigger this
// candidate on its own -- this test exercises the exact scoring logic
// uaSelectRakutenProductQuery_ uses over uaHomeRakutenProductCandidates_.

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

const uaHomeRakutenProductCandidates_ = vm.runInContext('uaHomeRakutenProductCandidates_', context);
const uaRakutenTextContains_ = vm.runInContext('uaRakutenTextContains_', context);

function bestCandidateQuery(text) {
  const candidates = uaHomeRakutenProductCandidates_();
  let best = null;
  candidates.forEach(function (candidate) {
    const score = candidate.keywords.reduce(function (total, keyword) {
      return total + (uaRakutenTextContains_(text, keyword) ? 1 : 0);
    }, 0);
    const minScore = Number(candidate.minScore) || 1;
    if (score >= minScore && (!best || score > best.score)) {
      best = { query: candidate.query, score: score };
    }
  });
  return best ? best.query : '';
}

// The storage box candidate's keyword list must no longer contain the
// overly generic "片付け".
const storageCandidate = uaHomeRakutenProductCandidates_().find(function (c) {
  return c.query === '収納ボックス 住宅';
});
assert.ok(storageCandidate, 'storage box candidate must still exist');
assert.ok(
  storageCandidate.keywords.indexOf('片付け') === -1,
  'storage box candidate must no longer list the generic word "片付け" as a trigger'
);
assert.ok(
  storageCandidate.keywords.indexOf('収納') !== -1 && storageCandidate.keywords.indexOf('収納ボックス') !== -1,
  'storage box candidate must still trigger on genuine "収納"/"収納ボックス" mentions'
);

// "片付け" alone (as in "後片付け" after weeding) must not select the
// storage box candidate via the real scoring path.
const weedRemovalText = 'ヤブガラシ駆除 処理したつるや根の断片は、そのまま庭に置かないよう片付けます。';
assert.notStrictEqual(
  bestCandidateQuery(weedRemovalText),
  '収納ボックス 住宅',
  '"片付け" alone must not select the storage box candidate'
);

// A genuine mention of storage boxes must still select this candidate when
// nothing else scores higher.
const storageText = '玄関まわりの収納ボックスを探している方向けの記事です。収納ボックスの選び方を解説します。';
assert.strictEqual(
  bestCandidateQuery(storageText),
  '収納ボックス 住宅',
  '"収納ボックス" must still select the storage box candidate'
);

console.log('rakuten storage-keyword specificity tests passed.');
