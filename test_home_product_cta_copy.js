const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'wordpress.gs'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const generated = [
  '<!-- UA_RINKER_PRODUCTS_START -->',
  '<p>今使っているもので解決できるなら買い替えは不要です。購入前の人や同じ不便を繰り返したくない人は、ポップアップテントのサイズや仕様を比較してから選べます。条件に合わなければ、無理に購入する必要はありません。</p>',
  '[itemlink post_id="123"]',
  '<!-- UA_RINKER_PRODUCTS_END -->'
].join('\n');
const transformed = context.uaTransformHomeProductCtaCopy_(generated);
assert.strictEqual(transformed.replacements, 2);
assert.ok(transformed.changed);
assert.ok(transformed.html.includes('同じ不便を繰り返さず、使いやすいポップアップテントを選びたい方に向いています。'));
assert.ok(transformed.html.includes('自分の使い方や設置条件に合う候補を、価格と仕様で見比べてみてください。'));
assert.ok(!/(?:買い替えは不要|無理に購入する必要はありません)/.test(transformed.html));

const unrelated = '<p>大きめのボウルで代用すれば、洗い桶を買わなくても済みます。</p>';
const untouched = context.uaTransformHomeProductCtaCopy_(unrelated);
assert.strictEqual(untouched.changed, false, '本文中の代用品説明は変更しない');
assert.strictEqual(untouched.html, unrelated);

console.log('home product CTA copy tests passed');
