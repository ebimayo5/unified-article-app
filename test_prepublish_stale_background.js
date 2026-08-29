const assert = require('assert');
const fs = require('fs');

const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');

new Function(prePublish);

// 1) uaIsExpiredPrePublishBackgroundState_ itself: pure staleness check.
{
  const moduleBox = { exports: {} };
  new Function('module', prePublish + '\nmodule.exports = { isExpired: uaIsExpiredPrePublishBackgroundState_ };')(moduleBox);
  const isExpired = moduleBox.exports.isExpired;

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();

  assert.strictEqual(isExpired({ startedAt: tenMinutesAgo }), true, 'A background request started 10 minutes ago must count as expired');
  assert.strictEqual(isExpired({ startedAt: oneMinuteAgo }), false, 'A background request started 1 minute ago must not count as expired');
  assert.strictEqual(isExpired({ startedAt: '' }), false, 'A missing startedAt must not be treated as expired');
  assert.strictEqual(isExpired(null), false, 'A null state must not be treated as expired');
}

// 2) The stale-state check must actually be wired into the resume flow, before it ever
//    tries to retrieve the old response — otherwise a genuinely abandoned OpenAI request
//    leaves the user re-clicking "続きから再開" forever with no way out (the same failure
//    shape as the wait_trefai bug fixed earlier this session).
{
  const resumeStart = prePublish.indexOf('function uaApplyPrePublishFixesOnceFromPanel');
  const resumeEnd = prePublish.indexOf('function uaGetPrePublishRevisionProvider_', resumeStart);
  const resumeBody = prePublish.slice(resumeStart, resumeEnd);

  assert(resumeStart >= 0 && resumeEnd > resumeStart, 'uaApplyPrePublishFixesOnceFromPanel not found');

  const expiryCheckIndex = resumeBody.indexOf('uaIsExpiredPrePublishBackgroundState_(backgroundState)');
  const retrieveIndex = resumeBody.indexOf('uaRetrieveOpenAiBackgroundJson_(backgroundState.responseId)');

  assert(expiryCheckIndex >= 0, 'The resume flow must call uaIsExpiredPrePublishBackgroundState_ on the loaded background state');
  assert(retrieveIndex >= 0, 'The resume flow must still attempt to retrieve a non-expired background response');
  assert(
    expiryCheckIndex < retrieveIndex,
    'The staleness check must run before retrieving the old response, so an abandoned request is cleared instead of polled forever'
  );
  assert(
    resumeBody.slice(expiryCheckIndex, retrieveIndex).indexOf('uaClearPrePublishBackgroundState_(backgroundStateKey)') !== -1,
    'An expired background state must be cleared so the next click can start a fresh request'
  );
}

console.log('Pre-publish stale-background-state tests passed.');
