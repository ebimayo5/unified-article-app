const fs = require('fs');
const assert = require('assert');

const automation = fs.readFileSync('unified_article_app/automation.gs', 'utf8');
const outline = fs.readFileSync('unified_article_app/outline.gs', 'utf8');
const article = fs.readFileSync('unified_article_app/article.gs', 'utf8');
const web = fs.readFileSync('unified_article_app/ua_web_app.html', 'utf8');
const prompt = fs.readFileSync('unified_article_app/prompt.gs', 'utf8');
const api = fs.readFileSync('unified_article_app/api.gs', 'utf8');

new Function(automation);
new Function(outline);
new Function(article);
new Function(prompt);
new Function(api);

const completeStart = outline.indexOf('function uaCompleteTrefaiStructureJob_');
const completeEnd = outline.indexOf('function uaFindTrefaiJobRowById_', completeStart);
const completeBody = outline.slice(completeStart, completeEnd);

assert(completeStart >= 0 && completeEnd > completeStart, 'Trefai completion function not found');
assert(!completeBody.includes('uaGenerateArticleStructureForRow_('), 'Bridge callback must not generate an OpenAI structure');
assert(completeBody.includes("UA_TREFAI_STATUS_DONE"), 'Bridge callback must mark URL acquisition done');
assert(automation.includes("trefai.status === UA_TREFAI_STATUS_DONE"), 'Worker must handle a completed Trefai result');
assert(automation.includes('uaStartArticleStructureBackgroundForRow_('), 'Worker must start structure generation in background');
assert(automation.includes('uaContinueArticleStructureBackgroundForRow_('), 'Worker must retrieve the same structure response ID');
assert(!automation.includes('uaGenerateArticleStructureForRow_(articleSheet'), 'Automatic worker must not run synchronous OpenAI structure generation');
assert(outline.includes('responseId: String(response && response.id || \'\')'), 'Structure background state must persist the OpenAI response ID');
assert(outline.includes('competitorPages: uaNormalizeTrefaiPages_'), 'Worker must reuse competitor page content collected by the PC bridge');
assert(outline.includes('const suppliedPages = uaNormalizeTrefaiPages_'), 'Background structure generation must skip Apps Script page crawling when bridge pages exist');
assert(automation.includes('job.stepStartedAt'), 'Worker must keep a step-level timeout timestamp');
assert(!automation.includes('uaScheduleAutomaticPostingWorker_(120000)'), 'Automatic OpenAI result polling must not run every two minutes');
assert(automation.includes('uaScheduleAutomaticPostingWorker_(5 * 60 * 1000)'), 'Automatic OpenAI result polling must use five-minute intervals');
assert(automation.includes('uaMarkStaleAutomaticPostingJobError_(uaGetAutomaticPostingJob_())'), 'Worker must enforce stale-stop logic');
assert(automation.includes("Object.assign({}, data, { automaticPosting: true })"), 'Automatic article generation must carry the no-refetch flag');
assert(article.includes('rowData.automaticPosting = !!(data && data.automaticPosting)'), 'Article generation must preserve the automatic-posting flag');
assert(automation.includes('uaCancelAutomaticPostingBackgroundWork_(job);'), 'Pausing or stale-stopping must cancel background OpenAI work');
assert(automation.includes('uaClearArticleBackgroundState_(uaGetArticleBackgroundStateKey_'), 'Explicit resume must clear a cancelled article response before a deliberate new request');
assert(api.includes("'/cancel'"), 'OpenAI background cancellation endpoint must be implemented');
assert(web.includes('5 * 60 * 1000'), 'OpenAI background result checks must use a five-minute interval');
assert(!web.includes('20秒後に保存済みの処理ID'), '20-second OpenAI result polling must not remain');
assert(web.includes('uaCancelArticleBackgroundFromWeb(cancelData)'), 'The red stop button must cancel saved OpenAI background work server-side');
assert(article.includes('function uaCancelArticleBackgroundFromWeb(data)'), 'Server-side manual background cancellation endpoint is required');
assert(article.includes('function uaPrepareArticleBackgroundResumeFromWeb(data)'), 'Explicit resume must prepare a cancelled background request for one deliberate restart');
assert(web.includes('uaGetArticleRowForWeb(appType, row, true)'), 'The resume button must explicitly prepare a cancelled background request through the established row endpoint');
assert(article.includes('Date.now() - startedAtMs >= 20 * 60 * 1000'), 'Article background work must stop after twenty minutes');
const backgroundStart = article.indexOf('function uaCallOpenAiArticleBackgroundJson_');
const backgroundEnd = article.indexOf('function uaGetArticleBackgroundStateKey_', backgroundStart);
const backgroundBody = article.slice(backgroundStart, backgroundEnd);
const mismatchStart = backgroundBody.indexOf('if (state && state.fingerprint !== fingerprint)');
const mismatchEnd = backgroundBody.indexOf('\n  }', mismatchStart);
assert(mismatchStart >= 0, 'Background fingerprint mismatch guard must exist');
assert(!backgroundBody.slice(mismatchStart, mismatchEnd).includes('uaClearArticleBackgroundState_'), 'A prompt fingerprint change must never clear an in-flight response ID');
assert(backgroundBody.includes('state.promptChangedWhilePending = true'), 'Prompt changes must be recorded while the saved response ID is preserved');

const competitorStart = prompt.indexOf('function uaBuildCompetitorPrompt_');
const competitorEnd = prompt.indexOf('function uaBuildReaderMindUsageRules_', competitorStart);
const competitorBody = prompt.slice(competitorStart, competitorEnd);
assert(competitorStart >= 0 && competitorEnd > competitorStart, 'Competitor prompt function not found');
assert(competitorBody.indexOf('preparedStructure || rowData && rowData.automaticPosting') < competitorBody.indexOf('uaFetchCompetitorPageInfo_'), 'Saved structure analysis must bypass live competitor refetch before any page fetch');

const promptModule = { exports: null };
new Function('module', prompt + '\nmodule.exports = uaBuildCompetitorPrompt_;')(promptModule);
const savedAnalysisPrompt = promptModule.exports({
  competitorUrl1: 'https://example.com/one',
  competitorUrl2: 'https://example.com/two',
  structureMemo: '【競合・参考URLから拾った材料】保存済み分析'
});
assert(savedAnalysisPrompt.includes('記事構成工程で取得・分析済み'), 'Saved analysis must be reused in the article prompt');
assert(savedAnalysisPrompt.includes('https://example.com/one'), 'Saved competitor URL must remain available as context');

console.log('Trefai flow guard tests passed.');
