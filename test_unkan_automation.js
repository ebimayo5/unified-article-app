const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=path.join(__dirname,'unified_article_app');
const c={console};vm.createContext(c);
for(const f of ['config.gs','automation.gs','article.gs','wordpress.gs','keyword_discovery.gs','pre_publish_check.gs'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c);
assert.equal(c.uaGetAutomationColumn_('unkan'),5);
assert.equal(c.uaGetAutomationColumn_('home'),3);
assert.equal(c.uaGetAutomationColumn_('drive'),2);
assert.equal(c.uaGetAutomationDailyHandler_('unkan'),'uaStartAutomaticPostingUnkanDaily_');
const cells={E1:'',B2:'ON',C2:'ON'},writes=[];
const range=(row,col,height=1,width=1)=>{
 const start=typeof row==='string'?row:String.fromCharCode(64+col)+row;
 const match=start.match(/^([A-Z]+)(\d+)/),letter=match[1],num=Number(match[2]);
 const obj={getDisplayValue:()=>cells[start]||'',getDisplayValues:()=>Array.from({length:height},(_,i)=>[cells[letter+(num+i)]||'']),setValues:values=>{writes.push(start);values.forEach((v,i)=>cells[letter+(num+i)]=v[0]);return obj;}};
 for(const f of ['setDataValidation','setBackground','setFontWeight','setFontColor'])obj[f]=()=>obj;
 return obj;
};
const sheet={getMaxColumns:()=>5,getRange:range,setColumnWidth:()=>{}};
const validation={requireValueInList(){return this;},requireNumberBetween(){return this;},setAllowInvalid(){return this;},build(){return {};}};
c.SpreadsheetApp={newDataValidation:()=>validation};c.uaGetDefaultAutomaticPostingNotificationEmail_=()=> 'owner@example.test';
c.uaEnsureUnkanAutomaticPostingColumn_(sheet);
assert.equal(cells.E2,'OFF');assert.equal(cells.E6,'下書きまで');assert.equal(cells.B2,'ON');assert.equal(cells.C2,'ON');
cells.E2='ON';c.uaEnsureUnkanAutomaticPostingColumn_(sheet);assert.equal(cells.E2,'ON');assert.equal(writes.length,1);
c.uaEnsureAutomaticPostingSheet_=()=>sheet;
// Even a manually altered sheet cannot make Unkan publish automatically.
cells.E6='公開まで';assert.equal(c.uaReadAutomaticPostingSettings_('unkan').publishMode,'下書きまで');
const installs=[],deletes=[];
c.uaDeleteAutomaticPostingTriggers_=handler=>deletes.push(handler);
c.uaInstallAutomaticPostingTrigger_=key=>installs.push(key);
c.uaWriteAutomaticPostingStatus_=()=>{};
c.uaGetAutomaticPostingSettingsForPanel=()=>({});
c.uaAssertUnkanOperator_=()=>{};
c.uaSaveAutomaticPostingSettingsFromPanel({appType:'unkan',enabled:true,hour:7,dailyLimit:2,includeImages:false,publishMode:'下書きまで',notificationEnabled:true,notificationEmail:'owner@example.test'});
assert.equal(cells.E2,'ON');assert.equal(cells.E3,7);assert.equal(cells.E4,2);assert.equal(cells.E5,'なし');assert.deepEqual(installs,['unkan']);
assert.equal(cells.B2,'ON');assert.equal(cells.C2,'ON');
assert(!deletes.includes('uaStartAutomaticPostingDriveDaily'));assert(!deletes.includes('uaStartAutomaticPostingHomeDaily'));
let ownerChecks=0;c.uaAssertUnkanOperator_=()=>ownerChecks++;
assert.throws(()=>c.uaSaveAutomaticPostingSettingsFromPanel({appType:'unkan',publishMode:'公開まで'}),/下書きまで/);
assert.equal(ownerChecks,1);
assert.throws(()=>c.uaPublishWpPostFromAutomation_({appType:'運行管理者試験対策'}),/自動公開/);
// Unkan must not enter the product-commerce pipeline.
c.uaGetSheetForData_=()=>({getActiveCell:()=>({getRow:()=>2})});
c.uaGetRakutenRowContext_=()=>({appConfig:{key:'unkan',useCommerce:false},body:'本文'});
c.uaBuildRowData_=()=>({body:'本文'});c.uaGetExistingProductLinkAssessment_=()=>{throw Error('Commerce invoked');};
assert.equal(c.uaEnsureAutomaticProductLinksForData_({row:2}).body,'本文');
// Keyword evaluation uses the exam SERP path, deduplicates, and checks article overlap.
c.uaScoreTreasureKeywordSerp_=()=>({score:100,level:'弱い',weakUrls:[]});
c.uaCheckTreasureKeywordCannibalization_=()=>({'運管 過去問':{cannibalizes:true,matchedExisting:'既存記事'}});
const results=c.uaEvaluateUnkanTreasureKeywords_({key:'unkan'},['運管 独学','運管 教材','運管 過去問','車 洗車'],{'運管 教材':true},['既存記事']);
assert.equal(results[0].kept,true);assert.equal(results[1].kept,false);assert.equal(results[2].kept,false);assert.equal(results[3].kept,false);
console.log('PASS Unkan automation: isolated defaults, persisted ON, draft-only enforcement, no commerce, keyword deduplication and overlap guard.');

// Run the actual draft writer without a human review; it may only write drafts.
const draft={row:2,appType:'運行管理者試験対策',body:'<p>本文</p>',titleIdeas:'タイトル',wpPostId:0};
const wpWrites=[];
const draftSheet={getRange:()=>({setValue:()=>{}})};
Object.assign(c,{
 uaSaveActiveRowData:()=>{},uaGetSheetForData_:()=>draftSheet,uaBuildRowData_:()=>({...draft}),
 uaGetAppConfigByLabel_:()=>({key:'unkan',useWordPress:true}),uaIsUnkan_:()=>true,
 uaAssertUnkanReview_:()=>{throw Error('Draft should not require publish review');},
 uaUnkanContentIssues_:()=>[],uaGetWpConfig_:()=>({siteUrl:'https://unkan-genba.com'}),
 uaExtractProductPlan_:()=>null,uaStripProductPlanMarker_:s=>s,uaBuildPrePublishRuleCheck_:()=>({critical:[]}),
 uaPickWpTitle_:s=>s,uaCleanWpSlug_:()=>'',uaEnsureWpTagIds_:()=>[],uaResolveWpCategoryIds_:()=>[],
 uaFetchWpPostForEdit_:()=>({id:42,status:'publish'}),
 uaCallWordPressApi_:(cfg,route,method,payload)=>{wpWrites.push(payload);return {id:42,status:'draft'};},
 uaSyncWpMetaDescription_:()=>{},uaBuildWpEditUrl_:()=>''
});
c.uaCreateWpDraftFromPanel(draft);
assert.equal(wpWrites.length,1);assert.equal(wpWrites[0].status,'draft');
draft.wpPostId=42;
assert.throws(()=>c.uaCreateWpDraftFromPanel(draft),/公開済み・予約済み/);
assert.equal(wpWrites.length,1);
console.log('PASS actual draft writer: unreviewed new draft allowed; published post overwrite refused.');
