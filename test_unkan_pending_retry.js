const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const repo = process.argv[2] || __dirname;
const html = fs.readFileSync(path.join(repo, 'unified_article_app/ua_web_app.html'), 'utf8');
const start = html.indexOf('function refreshPendingFullWorkflowStep(');
const end = html.indexOf('function schedulePendingPrePublishRevisionRetry(', start);
assert(start > 0 && end > start);
let success, failure, requested, executed, filled, failed;
const flow = {steps: [{label:'本文生成'}]};
const runner = {
  withSuccessHandler(fn) { success=fn; return this; },
  withFailureHandler(fn) { failure=fn; return this; },
  uaGetArticleRowForWeb(appType,row) { requested={appType,row}; }
};
const context = {
  window:{uaFullWorkflow:flow,uaFullWorkflowCancelled:false},
  google:{script:{run:runner}},
  readForm:()=>{throw Error('must use explicit pending row');},
  fillForm:data=>{filled=data;},
  runFullArticleWorkflowStep:(index,data)=>{executed={index,data};},
  failFullArticleWorkflow:(error,label)=>{failed={error,label};}
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
const stale={appType:'運行管理者試験対策',row:4,rowVersion:'old',body:'old body'};
const fresh={...stale,rowVersion:'current',status:'記事生成中'};
context.refreshPendingFullWorkflowStep(flow,0,stale);
assert.deepEqual(requested,{appType:stale.appType,row:4});
assert.equal(executed,undefined);
success(fresh);
assert.equal(filled,fresh);
assert.equal(executed.data,fresh);
assert.equal(flow.steps[0].alwaysRun,true);
executed=undefined;
context.window.uaFullWorkflowCancelled=true;
success(fresh);
assert.equal(executed,undefined);
context.window.uaFullWorkflowCancelled=false;
failure(Error('read failed'));
assert.equal(failed.label,'本文生成');
requested=undefined;
const other={appType:'DRIVE BASE',row:4};
context.refreshPendingFullWorkflowStep(flow,0,other);
assert.equal(requested,undefined);
assert.equal(executed.data,other);
console.log('Unkan pending retry uses fresh row, honors cancellation, preserves other sites: PASS');
