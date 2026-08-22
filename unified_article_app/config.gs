const UA_APP_NAME = 'Article Compass System';
const UA_ARTICLE_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm/exec';

const UA_ARTICLE_PROVIDER_PROPERTY = 'ARTICLE_PROVIDER';
const UA_READER_MIND_PROVIDER_PROPERTY = 'READER_MIND_PROVIDER';
const UA_IMAGE_PROVIDER_PROPERTY = 'IMAGE_PROVIDER';

const UA_GEMINI_MODELS = [
  'models/gemini-3.5-flash',
  'models/gemini-2.5-pro'
];

const UA_DEFAULT_OPENAI_MODEL = 'gpt-5.2';
const UA_DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2';
const UA_OPENAI_TEXT_MODEL_OPTIONS = [
  { value: 'gpt-5.2', label: 'GPT-5.2（現在の安定設定）' },
  { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra（推奨・品質とコストのバランス）' },
  { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol（最高品質）' },
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna（コスト重視）' }
];
const UA_OPENAI_IMAGE_MODEL_OPTIONS = [
  { value: 'gpt-image-2', label: 'GPT Image 2' }
];
const UA_DEFAULT_GEMINI_IMAGE_MODEL = 'models/gemini-3-pro-image-preview';
const UA_GEMINI_IMAGE_MODEL_OPTIONS = [
  { value: 'models/gemini-3-pro-image-preview', label: 'Gemini Nano Banana Pro' },
  { value: 'models/gemini-2.5-flash-image-preview', label: 'Gemini Nano Banana' }
];
const UA_DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

const UA_STATUS_GENERATING = '記事生成中';
const UA_STATUS_DONE = '記事生成済み';
const UA_STATUS_STOPPED = '記事生成停止';
const UA_STATUS_WP_DRAFTED = 'WP下書き済み';
const UA_STATUS_POSTED = '投稿済み';

const UA_CANDIDATE_STATUS_WRITE = '書く';
const UA_CANDIDATE_STATUS_SENT = '転送済み';
const UA_CANDIDATE_STATUS_HOLD = '保留';
const UA_CANDIDATE_LEGACY_STATUS_SENT = '記事化済み';
const UA_NO_AFFILIATE_NAME = '案件無し';

const UA_CANDIDATE_COLUMNS = {
  status: 1,
  affiliateName: 2,
  keyword: 3,
  volume: 4
};

const UA_CANDIDATE_HEADERS = [
  '状態',
  '案件名',
  'キーワード',
  '検索ボリューム'
];

const UA_AFFILIATE_SHEET_NAME = '案件管理';
const UA_AFFILIATE_COLUMNS = {
  name: 1,
  url: 2,
  shortcode: 3,
  notes: 4
};
const UA_AFFILIATE_HEADERS = [
  '案件名',
  'アフィリエイトURL / A8リンクHTML',
  'ショートコード',
  '案件注意点'
];

const UA_READER_MIND_MAX_RESULTS = 6;
const UA_INTERNAL_LINK_SHEET_NAME = '内部リンク';
const UA_INTERNAL_LINK_MAX_URLS = 200;
const UA_INTERNAL_LINK_INTRO_LENGTH = 260;
const UA_INTERNAL_LINK_MAX_CANDIDATES = 8;
const UA_COMPETITOR_URL_TEXT_LENGTH = 12000;
const UA_COMPETITOR_URL_MAX_HEADINGS = 40;
const UA_EXTERNAL_SOURCE_SHEET_NAME = '外部出典';
const UA_EXTERNAL_SOURCE_MAX_CANDIDATES = 6;
const UA_GENERATED_IMAGE_MAX_ITEMS = 5;

const UA_APP_TYPES = {
  drive: {
    key: 'drive',
    label: 'DRIVE BASE',
    articleSheetName: 'DRIVE BASE',
    candidateSheetName: 'DRIVE BASE_キーワード候補',
    theme: 'green',
    inputLabel: 'メインキーワード',
    useVolume: true,
    useInternalLinks: true,
    useExternalSources: true,
    useWordPress: true,
    wpEditorTheme: 'swell',
    promptType: 'drive'
  },
  home: {
    key: 'home',
    label: 'たくみパパ',
    articleSheetName: 'たくみパパ',
    candidateSheetName: 'たくみパパ_キーワード候補',
    theme: 'brown',
    inputLabel: 'メインキーワード',
    useVolume: true,
    useInternalLinks: true,
    useExternalSources: true,
    useWordPress: true,
    wpEditorTheme: 'swell',
    promptType: 'home'
  },
  general: {
    key: 'general',
    label: '汎用記事',
    articleSheetName: '汎用記事',
    candidateSheetName: '',
    theme: 'blue',
    inputLabel: '案件指示書',
    useVolume: false,
    useInternalLinks: false,
    useExternalSources: true,
    useWordPress: false,
    wpEditorTheme: 'core',
    promptType: 'general'
  }
};

function uaGetWpEditorTheme_(appConfig) {
  const theme = String(appConfig && appConfig.wpEditorTheme || '').trim().toLowerCase();
  return theme === 'swell' || theme === 'cocoon' ? theme : 'core';
}

function uaUsesSwellBlocks_(appConfig) {
  return uaGetWpEditorTheme_(appConfig) === 'swell';
}

const UA_COLUMNS = {
  appType: 1,
  mainInput: 2,
  volume: 3,
  affiliateName: 4,
  affiliateUrl: 5,
  affiliateNotes: 6,
  competitorUrl1: 7,
  competitorUrl2: 8,
  competitorUrl3: 9,
  readerMindMemo: 10,
  status: 11,
  createdAt: 12,
  generationModel: 13,
  body: 14,
  titleIdeas: 15,
  tags: 16,
  metaDescription: 17,
  permalink: 18,
  factCheckPoints: 19,
  wpPostId: 20,
  wpEditUrl: 21,
  wpDraftedAt: 22,
  structureMemo: 23
};

const UA_ARTICLE_COLUMN_COUNT = UA_COLUMNS.structureMemo;

const UA_HEADERS = [
  '記事タイプ',
  'メインキーワード / 案件指示書',
  '検索ボリューム',
  'メイン案件名',
  'メインアフィリエイトURL',
  '案件注意点 / その他制約事項',
  '競合URL1',
  '競合URL2',
  '競合URL3',
  '読者心理メモ',
  '状態',
  '作成日時',
  '使用モデル',
  '本文',
  'タイトル案',
  '関連タグ',
  'メタディスクリプション',
  'パーマリンク',
  '要確認ポイント',
  'WP投稿ID',
  'WP編集URL',
  'WP入稿日時',
  '構成メモ'
];
