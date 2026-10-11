const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=path.join(__dirname,'unified_article_app');
let actor='',writes=0,job={appType:'運行管理者試験対策',status:'error',step:'article'};
const c={console,Session:{getActiveUser:()=>({getEmail:()=>actor}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'})}};
vm.createContext(c);
for(const f of ['config.gs','automation.gs','unkan_arcon.gs','image.gs'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c);
c.uaGetAppConfigByLabel_=label=>vm.runInContext('UA_APP_TYPES.unkan',c);
c.uaGetAutomaticPostingJob_=()=>job;
for(const name of ['uaEnsureAutomaticPostingSheet_','uaMarkStaleAutomaticPostingJobError_','uaDeleteAutomaticPostingTriggers_','uaSaveAutomaticPostingManualBatch_','uaStartAutomaticPostingForSite_','uaSaveAutomaticPostingJob_','uaSkipAutomaticPostingJob_'])c[name]=()=>{writes++;throw Error('Side effect before authorization: '+name);};
const calls=[
 ()=>c.uaGetAutomaticPostingSettingsForPanel('unkan'),
 ()=>c.uaSaveAutomaticPostingSettingsFromPanel({appType:'unkan',enabled:true}),
 ()=>c.uaStartAutomaticPostingNowFromPanel('unkan',1),
 ()=>c.uaResumeAutomaticPostingFromPanel('unkan'),
 ()=>c.uaSkipAutomaticPostingFromPanel('unkan'),
 ()=>c.uaGetActiveAutomaticPostingArticleFromPanel('unkan')
];
for(actor of ['', 'other@example.test'])for(const call of calls)assert.throws(call,/所有者/);
assert.equal(writes,0,'Unauthenticated callers must not mutate sheets, jobs or triggers');
actor='owner@example.test';c.uaAssertUnkanOperator_();
assert.equal(c.uaGetAutomationDailyHandler_('unkan'),'uaStartAutomaticPostingUnkanDaily_');
assert.equal(c.uaResolveImageStylePreset_({appType:'運行管理者試験対策'}),'unkanFlat');
assert.equal(c.uaResolveImageStylePreset_({appType:'運行管理者試験対策',imageStylePreset:'softFree'}),'softFree');
assert(c.uaBuildImagePromptPlanStyle_({appType:'運行管理者試験対策'}).includes('#0d3049'));
assert(c.uaBuildGeneratedImageStyleInstruction_({appType:'運行管理者試験対策'}).includes('#f5a623'));
console.log('PASS Unkan authorization precedes all side effects; private trigger; navy/orange defaults with explicit style override.');
