// This entry point is deployed separately with access=MYSELF and
// executeAs=USER_ACCESSING. Every callable function also fails closed when
// invoked through the anonymous article-panel deployment.
const UA_ADMIN_SERPAPI_PROPERTY = 'UA_SERPAPI_API_KEY';
const UA_ADMIN_CODE_PREFIX = 'UA_ADMIN_SERPAPI_';

function uaAssertAdminOwner_() {
  const active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const owner = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!active || !owner || active !== owner) {
    throw new Error('APIキー管理は所有者のGoogleアカウントからのみ利用できます。');
  }
  return active;
}

function uaAdminSerpApiStatus() {
  uaAssertAdminOwner_();
  const value = String(PropertiesService.getScriptProperties().getProperty(UA_ADMIN_SERPAPI_PROPERTY) || '');
  return { configured: !!value, suffix: value ? value.slice(-4) : '' };
}

function uaAdminHash_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}

function uaAdminRequestSerpApiCode() {
  const email = uaAssertAdminOwner_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getUserProperties();
    const last = Number(props.getProperty(UA_ADMIN_CODE_PREFIX + 'LAST_SENT') || 0);
    if (Date.now() - last < 60000) throw new Error('確認コードの再送は1分後にできます。');
    const code = Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
    const nonce = Utilities.getUuid();
    const expires = Date.now() + 5 * 60 * 1000;
    MailApp.sendEmail({
      to: email,
      subject: 'アーコン APIキー変更の確認コード',
      body: 'SerpApi APIキー変更の確認コード: ' + code + '\n有効期間: 5分\nこの操作に心当たりがなければコードを入力しないでください。'
    });
    props.setProperties({
      [UA_ADMIN_CODE_PREFIX + 'HASH']: uaAdminHash_(nonce + ':' + code),
      [UA_ADMIN_CODE_PREFIX + 'NONCE']: nonce,
      [UA_ADMIN_CODE_PREFIX + 'EXPIRES']: String(expires),
      [UA_ADMIN_CODE_PREFIX + 'ATTEMPTS']: '0',
      [UA_ADMIN_CODE_PREFIX + 'LAST_SENT']: String(Date.now())
    });
    return { sent: true, expiresMinutes: 5 };
  } finally {
    lock.releaseLock();
  }
}

function uaAdminSaveSerpApiKey(key, code) {
  uaAssertAdminOwner_();
  const value = String(key || '').trim();
  const answer = String(code || '').trim().toUpperCase();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(value)) throw new Error('APIキーの形式を確認してください。空白は使えません。');
  if (!/^[A-F0-9]{10}$/.test(answer)) throw new Error('確認コードを確認してください。');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getUserProperties();
    const nonce = props.getProperty(UA_ADMIN_CODE_PREFIX + 'NONCE');
    const hash = props.getProperty(UA_ADMIN_CODE_PREFIX + 'HASH');
    const expires = Number(props.getProperty(UA_ADMIN_CODE_PREFIX + 'EXPIRES') || 0);
    const attempts = Number(props.getProperty(UA_ADMIN_CODE_PREFIX + 'ATTEMPTS') || 0);
    if (!nonce || !hash || Date.now() > expires || attempts >= 5) {
      throw new Error('確認コードは無効または期限切れです。新しいコードを取得してください。');
    }
    props.setProperty(UA_ADMIN_CODE_PREFIX + 'ATTEMPTS', String(attempts + 1));
    if (uaAdminHash_(nonce + ':' + answer) !== hash) throw new Error('確認コードが一致しません。');
    PropertiesService.getScriptProperties().setProperty(UA_ADMIN_SERPAPI_PROPERTY, value);
    [ 'HASH', 'NONCE', 'EXPIRES', 'ATTEMPTS' ].forEach(function(part) {
      props.deleteProperty(UA_ADMIN_CODE_PREFIX + part);
    });
    return { saved: true, suffix: value.slice(-4) };
  } finally {
    lock.releaseLock();
  }
}
