const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 2026-09-20: tagging had run away. kurashi-ie.com carried 696 tags across 90
// posts and 85% of them were used exactly once, so most of the ten tag links
// under an article led to an archive containing only that same article. Posts
// now take at most five tags, existing site tags win, and only one brand-new
// name is allowed through per post.
const context = { console };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, 'unified_article_app', 'wordpress.gs'), 'utf8'),
  context
);

const val = (expr) => vm.runInContext(expr, context);
assert.strictEqual(val('UA_MAX_WP_TAGS_PER_POST'), 5, '1記事あたりのタグ上限は5');
assert.strictEqual(val('UA_MAX_NEW_WP_TAGS_PER_POST'), 1, '新規作成は1記事につき1件まで');

// Stand in for the WordPress REST API: `existing` is the site's tag vocabulary.
function stubApi(existing) {
  const created = [];
  let nextId = 1000;
  const byName = new Map(existing.map((name, i) => [name, 100 + i]));
  context.uaCallWordPressApi_ = (wpConfig, pathname, method, payload) => {
    if (method === 'get') {
      const q = decodeURIComponent((pathname.match(/search=([^&]*)/) || [])[1] || '');
      const hit = [...byName.keys()].filter((n) => n.indexOf(q) !== -1);
      return hit.map((n) => ({ id: byName.get(n), name: n }));
    }
    const name = payload.name;
    created.push(name);
    byName.set(name, ++nextId);
    return { id: nextId, name };
  };
  return { created, idOf: (n) => byName.get(n) };
}

{
  // Every generated name already exists: take the first five, create nothing.
  const api = stubApi(['家づくり', '間取り', '収納', '防災', '後悔', '子育て']);
  const ids = context.uaEnsureWpTagIds_({}, '家づくり,間取り,収納,防災,後悔,子育て');
  assert.strictEqual(ids.length, 5, '上限5件で打ち切る');
  assert.deepStrictEqual(Array.from(ids), ['家づくり', '間取り', '収納', '防災', '後悔'].map(api.idOf),
    '関連度順の上位5件を採用する');
  assert.deepStrictEqual(api.created, [], '既存タグだけなら新規作成しない');
}

{
  // The real kurashi-ie.com case: two reusable tags plus a pile of one-off
  // product nouns. Only one of the new names may be created.
  const api = stubApi(['防災', '備蓄']);
  const ids = context.uaEnsureWpTagIds_(
    {},
    '防災,備蓄,カセットボンベ,ローリングストック,乾電池,保存水,非常用トイレ'
  );
  assert.strictEqual(ids.length, 3, '既存2件＋新規1件で3件になる');
  assert.strictEqual(api.created.length, 1, '新規タグは1件しか作らない');
  assert.strictEqual(api.created[0], 'カセットボンベ',
    '新規を1件だけ認める場合は、関連度が最も高いものを選ぶ');
}

{
  // Existing tags always outrank new ones, even when the new ones came first.
  const api = stubApi(['カーナビ', 'ディスプレイオーディオ']);
  const ids = context.uaEnsureWpTagIds_({}, '謎の新語A,謎の新語B,カーナビ,ディスプレイオーディオ');
  assert.deepStrictEqual(Array.from(ids).slice(0, 2), ['カーナビ', 'ディスプレイオーディオ'].map(api.idOf),
    '生成順が後でも既存タグを先に採用する');
  assert.strictEqual(api.created.length, 1, '残り枠があっても新規は1件まで');
}

{
  // A brand-new topic can still start exactly one tag of its own.
  const api = stubApi([]);
  const ids = context.uaEnsureWpTagIds_({}, '新ジャンルA,新ジャンルB,新ジャンルC');
  assert.strictEqual(ids.length, 1, '既存タグが1件もなくても、新規は1件までに留める');
  assert.deepStrictEqual(api.created, ['新ジャンルA']);
}

{
  // Partial matches must not be mistaken for the tag itself: the REST search is
  // a substring search, so "収納" would also return "収納ボックス".
  const api = stubApi(['収納ボックス']);
  const ids = context.uaEnsureWpTagIds_({}, '収納');
  assert.strictEqual(api.created.length, 1, '部分一致では既存タグ扱いにしない');
  assert.strictEqual(api.created[0], '収納');
  assert.strictEqual(ids.length, 1);
}

console.log('WordPress tag budget tests passed');
