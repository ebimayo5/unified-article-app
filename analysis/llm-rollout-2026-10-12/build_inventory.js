// Public WordPress posts only. No authentication, generation, or write requests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sites = [
  { key: 'drive', domain: 'ebimayo5.com', owner: 'Codex' },
  { key: 'home', domain: 'kurashi-ie.com', owner: 'Claude' },
  { key: 'unkan', domain: 'unkan-genba.com', owner: 'Claude' }
];
const root = __dirname;
const refresh = process.argv.includes('--refresh');
const text = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const csv = rows => rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\n') + '\n';
function inspect(post, site) {
  const body = post.content.rendered;
  const h2 = [...body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => text(m[1]));
  const links = [...body.matchAll(/<a\b[^>]*href=["']([^"']+)/gi)].map(m => m[1]);
  const flags = [];
  if (new Set(h2).size !== h2.length) flags.push('duplicate_h2');
  if (!links.some(url => /^https:\/\//.test(url) && !url.includes(site.domain) && !/a8\.net|amazon\.|rakuten\.|amzn\.to|valuecommerce\.|moshimo\./i.test(url))) flags.push('no_external_evidence_link_detected');
  if (/絶対|必ず合格|必ず映|100[%％]|法律上.{0,5}グレー/.test(text(body))) flags.push('absolute_or_legal_wording_review');
  if (text(body).length < 1200) flags.push('short_body_review');
  return { h2_count: h2.length, table_count: (body.match(/<table\b/gi) || []).length,
    image_count: (body.match(/<img\b/gi) || []).length, text_length: text(body).length,
    structural_flags: flags.join('|') };
}
async function collect(site) {
  const dir = path.join(root, 'snapshots', site.key);
  fs.mkdirSync(dir, { recursive: true });
  const cache = path.join(dir, 'public_posts.json');
  let result;
  if (!refresh && fs.existsSync(cache)) result = JSON.parse(fs.readFileSync(cache, 'utf8'));
  else {
    const posts = []; let total, pages;
    for (let page = 1; page <= (pages || 1); page++) {
      if (page > 100) throw Error('Public inventory page limit exceeded: ' + site.key);
      const url = `https://${site.domain}/wp-json/wp/v2/posts?status=publish&per_page=100&page=${page}&orderby=id&order=asc&_fields=id,link,slug,title,content,date_gmt,modified_gmt,status`;
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw Error(site.key + ': HTTP ' + response.status);
      const countHeader = response.headers.get('x-wp-total');
      const pagesHeader = response.headers.get('x-wp-totalpages');
      if (countHeader === null || pagesHeader === null) throw Error('Missing WP totals: ' + site.key);
      const currentTotal = Number(countHeader), currentPages = Number(pagesHeader);
      if (page > 1 && (currentTotal !== total || currentPages !== pages)) throw Error('Publication count changed during fetch: ' + site.key);
      total = currentTotal; pages = currentPages;
      const batch = await response.json();
      if (!Array.isArray(batch)) throw Error('Unexpected response: ' + site.key);
      posts.push(...batch);
    }
    if (posts.length !== total || new Set(posts.map(p => p.id)).size !== total) throw Error('Total/unique count mismatch: ' + site.key);
    result = { site: site.key, fetched_at: new Date().toISOString(), expected_total: total, fetched_total: posts.length,
      scope: 'Public WP posts; rendered content, NOT raw editable backup; fixed pages/drafts excluded', posts };
    fs.writeFileSync(cache, JSON.stringify(result, null, 2) + '\n');
  }
  if (result.fetched_total !== result.expected_total || result.posts.length !== result.expected_total) throw Error('Invalid cached inventory: ' + site.key);
  return { site, result };
}
(async () => {
  const outcomes = await Promise.allSettled(sites.map(collect));
  const rows = [['site','owner','post_id','url','title','published_gmt','modified_gmt','rendered_sha256','text_length','h2_count','table_count','image_count','structural_flags','review_status']];
  const summary = [];
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (outcome.status !== 'fulfilled') {
      summary.push({ site: sites[i].key, status: 'fetch_failed', error: String(outcome.reason) });
      continue;
    }
    const { site, result } = outcome.value;
    for (const post of result.posts) {
      const inspection = inspect(post, site);
      rows.push([site.key,site.owner,post.id,post.link,text(post.title.rendered),post.date_gmt,post.modified_gmt,
        crypto.createHash('sha256').update(post.content.rendered).digest('hex'),inspection.text_length,
        inspection.h2_count,inspection.table_count,inspection.image_count,inspection.structural_flags,'queued']);
    }
    summary.push({ site: site.key, owner: site.owner, status: 'inventory_complete_manual_review_pending',
      expected: result.expected_total, actual: result.posts.length, fetched_at: result.fetched_at });
  }
  fs.writeFileSync(path.join(root, 'inventory.csv'), csv(rows));
  fs.writeFileSync(path.join(root, 'inventory_summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary));
  if (summary.some(item => item.status === 'fetch_failed')) process.exitCode = 1;
})().catch(error => { console.error(String(error)); process.exitCode = 1; });
