// 公開記事の鮮度チェックの共通の核(全サイト共通・読み取り専用)。
// 記事の本文と更新日から、書き直しの優先度を機械的に付ける。内容の正誤を判断するものではない。
// サイトごとに変えるのは options.topicGroups(鮮度に影響しやすい話題の語)だけ。
// 例: { topicGroups: [{ re: /法令|告示/, w: 2, label: '法令の記載あり' }] }

function uaFreshnessText_(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|#160);/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function uaFreshnessScore_(input, now, options) {
  const opts = options || {};
  const text = uaFreshnessText_(input && input.raw);
  const today = now && typeof now.getTime === 'function' ? now : new Date();
  const jstNow = new Date(today.getTime() + 9 * 3600 * 1000);
  const curYear = jstNow.getUTCFullYear();
  const curMonthIndex = curYear * 12 + jstNow.getUTCMonth();
  const reasons = [];
  let score = 0;

  const years = [];
  (text.match(/(20\d{2})\s*年/g) || []).forEach(function(m) { years.push(Number(m.replace(/\D/g, '').slice(0, 4))); });
  (text.match(/令和\s*(\d{1,2})\s*年/g) || []).forEach(function(m) { years.push(2018 + Number(m.replace(/\D/g, ''))); });
  const maxYear = years.length ? Math.max.apply(null, years) : 0;
  if (maxYear && maxYear < curYear) {
    score += 3;
    reasons.push('本文の年の記載が最新で' + maxYear + '年(今年は' + curYear + '年)');
  }

  let oldestStated = null;
  (text.match(/20\d{2}\s*年\s*\d{1,2}\s*月\s*(?:時点|現在)/g) || []).forEach(function(m) {
    const n = m.match(/(20\d{2})\s*年\s*(\d{1,2})/);
    const idx = Number(n[1]) * 12 + (Number(n[2]) - 1);
    if (oldestStated === null || idx < oldestStated) oldestStated = idx;
  });
  if (oldestStated !== null && curMonthIndex - oldestStated >= 6) {
    score += 2;
    reasons.push('「時点」の記載が約' + (curMonthIndex - oldestStated) + 'か月前');
  }

  const touched = input && input.touched ? new Date(input.touched) : null;
  let ageDays = null;
  if (touched && !isNaN(touched.getTime())) {
    ageDays = Math.floor((today.getTime() - touched.getTime()) / 86400000);
    if (ageDays >= 180) { score += 2; reasons.push('最終更新から約' + ageDays + '日'); }
    else if (ageDays >= 90) { score += 1; reasons.push('最終更新から約' + ageDays + '日'); }
  }

  const hitLabels = [];
  (opts.topicGroups || []).forEach(function(g) {
    if (g && g.re && g.re.test(text)) { score += Number(g.w) || 0; hitLabels.push(g.label); }
  });
  if (hitLabels.length) reasons.push(hitLabels.join(' / '));

  const level = score >= 6 ? '高' : (score >= 3 ? '中' : '低');
  return { score: score, level: level, reasons: reasons, ageDays: ageDays, maxYear: maxYear };
}

// 優先度の高い順(同点は更新が古い順)に並べる。
function uaFreshnessSort_(items) {
  return (items || []).slice().sort(function(a, b) {
    return b.score - a.score || (b.ageDays || 0) - (a.ageDays || 0);
  });
}
