const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, 'unified_article_app');
const context = { console };
vm.createContext(context);
['config.gs', 'utils.gs', 'links.gs', 'article.gs', 'wordpress.gs', 'pre_publish_check.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
});

assert.strictEqual(context.uaRequiresReliableEvidenceSource_('RAV4 HDMI どこ'), true, 'vehicle HDMI article must require a source');
assert.strictEqual(context.uaRequiresReliableEvidenceSource_('リビング横 トイレ 音 聞こえる'), false, 'subjective planning article must not be blocked without a verifiable claim');
assert.strictEqual(context.uaRequiresReliableEvidenceSource_('積水ハウス 値引き 交渉'), false, 'non-technical negotiation article must not be over-classified');
assert.strictEqual(context.uaRequiresReliableEvidenceSource_('電気毛布を洗濯して壊れたかも'), false, 'a home appliance terminal is not a vehicle specification');
assert.deepStrictEqual(
  Array.from(context.uaGetRequiredEvidenceSourceCategories_('旗竿地の手前の家は住みやすい？', '車の運転で通路を出入りするときは見通しを確認します。')),
  [],
  'a general driving mention without screen or phone use must not require the NPA screen-use source'
);
assert.strictEqual(context.uaIsKnownOfficialEvidenceHost_('https://toyota.jp/rav4/'), true, 'Toyota domain must be accepted as an official source');
assert.strictEqual(context.uaIsKnownOfficialEvidenceHost_('https://example.com/toyota/'), false, 'unrelated host must not be accepted');
assert.deepStrictEqual(
  Array.from(context.uaGetRequiredEvidenceSourceCategories_('RAV4 HDMI どこ', '走行中に画面を注視しないでください。')),
  ['vehicle_spec', 'driving_safety'],
  'vehicle specifications and driving safety must require distinct sources'
);
assert.deepStrictEqual(
  Array.from(context.uaGetRequiredEvidenceSourceCategories_('RAV4 HDMI どこ', '後付けは適合と施工品質を確認し、走行中の運転者による画面注視は避けます。')),
  ['vehicle_spec', 'driving_safety'],
  'the published wording about a driver watching the screen must require the NPA source'
);
assert.deepStrictEqual(
  Array.from(context.uaGetRequiredEvidenceSourceCategories_('RAV4 HDMI どこ', '運転者が画面を見るための機能ではありません。')),
  ['vehicle_spec', 'driving_safety'],
  'the published wording that the function is not for a driver to watch must require the NPA source'
);
assert.deepStrictEqual(
  Array.from(context.uaGetRequiredEvidenceSourceCategories_('リビング横 トイレ 音 聞こえる', '遮音等級とdBの数値は仕様書で確認します。')),
  ['home_construction'],
  'home source is required only for verifiable specifications'
);
assert.deepStrictEqual(
  Array.from(context.uaGetRequiredEvidenceSourceCategories_('クロス貼る前 狭く見える', '間取りの変更できる時期、追加費用、工期、保証への影響は物件ごとに違うため、契約図面・仕様書・保証書を施工会社へ確認してください。')),
  [],
  'individual contract and construction-company confirmation guidance must not require an unrelated external source'
);
assert.deepStrictEqual(
  Array.from(context.uaGetRequiredEvidenceSourceCategories_('クロス貼る前 狭く見える', "<p>間取りの不安は、契約図面と施工会社へ確認してください。</p><span style='background:linear-gradient(transparent 60%, #fff3a3 60%)'>見た目と実寸は別です。</span><p>壁、下地、断熱、配線に関わる変更は施主判断で進めず、保証への影響は住宅会社へ確認します。</p>")),
  [],
  'HTML style percentages and generic insulation-component guidance must not be classified as measurable construction specifications'
);
assert.strictEqual(
  context.uaIsIndividualHomeConfirmationGuidance_('変更できる時期、追加費用、工期、保証への影響は物件ごとに違うため、契約図面・仕様書・保証書を施工会社へ確認してください。'),
  true,
  'individual property guidance must not create an external-link warning'
);
assert.deepStrictEqual(
  Array.from(context.uaFindPrePublishReliabilityClaims_('<p>変更できる時期、追加費用、工期、保証への影響は物件ごとに違うため、契約図面・仕様書・保証書を施工会社へ確認してください。</p>')),
  [],
  'individual property guidance must not produce an external-link warning from cost wording alone'
);
assert.strictEqual(
  context.uaIsIndividualHomeConfirmationGuidance_('断熱等性能等級5の住宅は、契約図面で確認してください。'),
  false,
  'specific performance facts still need evidence even when readers are told to check their documents'
);
assert.strictEqual(
  context.uaGetMandatoryEvidenceFallbackSources_(['driving_safety'])[0].url,
  'https://www.npa.go.jp/bureau/traffic/keitai/info.html',
  'driving-safety claim must receive the relevant NPA source even when sheet scoring has no keyword match'
);
assert.strictEqual(
  context.uaGetMandatoryEvidenceFallbackSources_(['vehicle_spec']).length,
  0,
  'vehicle specification must not receive an unrelated shared fallback URL'
);

const base = { mainInput: 'RAV4 HDMI どこ', titleIdeas: '案1：RAV4のHDMI端子を確認する', affiliateUrl: 'https://px.a8.net/example' };
const missing = context.uaCheckCurrentOfficialSourceRequirement_(base, '<p>年式と装着オーディオを確認します。</p><a href="https://px.a8.net/example">案件CTA</a>');
assert.strictEqual(missing.critical, true, 'affiliate-only vehicle article must fail');
assert.ok(missing.message.includes('車種・端子仕様'), 'failure must name the required evidence category');
const official = context.uaCheckCurrentOfficialSourceRequirement_(base, '<p><a href="https://toyota.jp/rav4/">トヨタ公式のRAV4装備情報</a>で確認します。</p>');
assert.strictEqual(official.critical, false, 'official manufacturer source must pass');
assert.ok(official.message.includes('必要な仕様'), 'pass result must identify evidence coverage');

const drivingMissing = context.uaCheckCurrentOfficialSourceRequirement_(base, '<p>走行中は画面を注視しないでください。</p><a href="https://toyota.jp/rav4/">トヨタ公式のRAV4装備情報</a>');
assert.strictEqual(drivingMissing.critical, true, 'manufacturer specification link must not substitute for driving-safety evidence');
assert.ok(drivingMissing.message.includes('警察庁'), 'missing category must name the appropriate source');
const drivingCovered = context.uaCheckCurrentOfficialSourceRequirement_(base, '<p>走行中は画面を注視しないでください。</p><a href="https://toyota.jp/rav4/">トヨタ公式のRAV4装備情報</a><a href="https://www.npa.go.jp/bureau/traffic/keitai/info.html">警察庁のながら運転に関する案内</a>');
assert.strictEqual(drivingCovered.critical, false, 'vehicle and safety evidence must pass only when both are present');

console.log('reliable evidence source guard: OK');
