<?php
/**
 * Plugin Name: Article Compass Rinker Bridge
 * Description: Article Compass SystemからRinker商品リンクを安全に作成・再利用し、SWELL移行後も既存Cocoon装飾を保ちます。
 * Version: 1.3.1
 * Author: Article Compass System
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Article_Compass_Rinker_Bridge {
    const REST_NAMESPACE = 'article-compass/v1';
    const RINKER_POST_TYPE = 'yyi_rinker';
    const META_KEY = 'article_compass_rinker_key';
    const COCOON_DESCRIPTION_META_KEY = 'the_page_meta_description';
    const SWELL_DESCRIPTION_META_KEY = 'ssp_meta_description';
    const DESCRIPTION_HASH_META_KEY = 'article_compass_description_hash';

    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
        add_action('enqueue_block_editor_assets', array(__CLASS__, 'enqueue_rinker_editor_compat'));
        add_action('enqueue_block_assets', array(__CLASS__, 'enqueue_rinker_editor_compat_in_canvas'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue_rinker_media_compat'));
        add_action('enqueue_block_assets', array(__CLASS__, 'enqueue_swell_compat_styles'));
        add_filter('the_content', array(__CLASS__, 'render_cocoon_blogcards_for_swell'), 8);
    }

    /**
     * Rinker 1.13.0 still returns a selected item by searching the parent
     * document for the block input. WordPress 7.1 renders the post canvas in
     * an iframe, so that lookup no longer reaches the selected block. The
     * compatibility script relays the generated shortcode to the block-editor
     * data store without modifying Rinker itself.
     */
    public static function enqueue_rinker_editor_compat() {
        self::enqueue_rinker_compat_script();
    }

    public static function enqueue_rinker_editor_compat_in_canvas() {
        if (is_admin()) {
            self::enqueue_rinker_compat_script();
        }
    }

    public static function enqueue_rinker_media_compat($hook_suffix) {
        $page = isset($GLOBALS['pagenow']) ? (string) $GLOBALS['pagenow'] : '';
        if ($hook_suffix === 'media-upload.php' || $page === 'media-upload.php') {
            self::enqueue_rinker_compat_script();
        }
    }

    private static function enqueue_rinker_compat_script() {
        $handle = 'article-compass-rinker-editor-compat';
        wp_enqueue_script(
            $handle,
            plugin_dir_url(__FILE__) . 'assets/rinker-editor-compat.js',
            array('jquery'),
            '1.3.1',
            true
        );
        wp_localize_script($handle, 'ArticleCompassRinkerCompat', array(
            'mediaUploadUrl' => admin_url('media-upload.php'),
            'origin' => wp_parse_url(home_url('/'), PHP_URL_SCHEME) . '://' . wp_parse_url(home_url('/'), PHP_URL_HOST),
        ));
    }

    public static function register_routes() {
        register_rest_route(self::REST_NAMESPACE, '/rinker-status', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array(__CLASS__, 'status'),
            'permission_callback' => array(__CLASS__, 'can_edit_posts'),
        ));

        register_rest_route(self::REST_NAMESPACE, '/rinker-items', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array(__CLASS__, 'upsert_items'),
            'permission_callback' => array(__CLASS__, 'can_edit_posts'),
        ));

        register_rest_route(self::REST_NAMESPACE, '/post-seo-meta', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array(__CLASS__, 'update_post_seo_meta'),
            'permission_callback' => array(__CLASS__, 'can_edit_target_post'),
        ));
    }

    public static function can_edit_posts() {
        return current_user_can('edit_posts');
    }

    public static function can_edit_target_post(WP_REST_Request $request) {
        $post_id = absint($request->get_param('post_id'));
        return $post_id > 0 && current_user_can('edit_post', $post_id);
    }

    public static function status() {
        return rest_ensure_response(array(
            'ok' => true,
            'rinker_active' => post_type_exists(self::RINKER_POST_TYPE),
            'bridge_version' => '1.3.1',
            'seo_meta_supported' => true,
            'seo_meta_key' => self::get_description_meta_key(),
        ));
    }

    public static function update_post_seo_meta(WP_REST_Request $request) {
        $post_id = absint($request->get_param('post_id'));
        $description = sanitize_textarea_field((string) $request->get_param('meta_description'));

        if ($post_id <= 0 || get_post_type($post_id) !== 'post') {
            return new WP_Error('invalid_post', '対象の投稿が見つかりません。', array('status' => 404));
        }
        if ($description === '') {
            return rest_ensure_response(array(
                'ok' => true,
                'updated' => false,
                'preserved' => true,
                'reason' => 'empty_input',
            ));
        }

        $meta_key = self::get_description_meta_key();
        $current = (string) get_post_meta($post_id, $meta_key, true);
        $managed_hash = (string) get_post_meta($post_id, self::DESCRIPTION_HASH_META_KEY, true);
        $current_hash = $current !== '' ? hash('sha256', $current) : '';
        $is_managed_value = $current !== '' && $managed_hash !== '' && hash_equals($managed_hash, $current_hash);

        if ($current !== '' && !$is_managed_value) {
            return rest_ensure_response(array(
                'ok' => true,
                'updated' => false,
                'preserved' => true,
                'reason' => 'manual_value_preserved',
                'length' => mb_strlen($current),
            ));
        }

        update_post_meta($post_id, $meta_key, $description);
        update_post_meta($post_id, self::DESCRIPTION_HASH_META_KEY, hash('sha256', $description));

        return rest_ensure_response(array(
            'ok' => true,
            'updated' => true,
            'preserved' => false,
            'reason' => $current === '' ? 'inserted' : 'managed_value_updated',
            'length' => mb_strlen($description),
        ));
    }

    private static function get_description_meta_key() {
        $theme = wp_get_theme();
        $template = strtolower((string) $theme->get_template());
        $stylesheet = strtolower((string) $theme->get_stylesheet());
        if (strpos($template, 'swell') !== false || strpos($stylesheet, 'swell') !== false) {
            return self::SWELL_DESCRIPTION_META_KEY;
        }
        return self::COCOON_DESCRIPTION_META_KEY;
    }

    public static function enqueue_swell_compat_styles() {
        wp_register_style('article-compass-swell-compat', false, array(), '1.3.1');
        wp_enqueue_style('article-compass-swell-compat');
        wp_add_inline_style('article-compass-swell-compat', self::get_swell_compat_css());
    }

    private static function get_swell_compat_css() {
        return <<<'CSS'
/* Article Compass: Cocoon content compatibility on SWELL */
.post_content .tab-caption-box,
.post_content .wp-block-cocoon-blocks-tab-caption-box-1 {
  position: relative;
  margin: 2.4em 0 1.8em;
  padding: 1.65em 1.25em 1em;
  border: 2px solid var(--cocoon-custom-border-color, #e60033) !important;
  border-radius: 8px;
  background: #fff;
}
.post_content .tab-caption-box > .tab-caption-box-label,
.post_content .wp-block-cocoon-blocks-tab-caption-box-1 > .tab-caption-box-label {
  position: absolute;
  top: 0;
  left: 1em;
  max-width: calc(100% - 2em);
  transform: translateY(-50%);
  padding: .35em .9em;
  border-radius: 999px;
  background: var(--cocoon-custom-border-color, #e60033);
  color: #fff;
  font-weight: 700;
  line-height: 1.4;
}
.post_content .tab-caption-box > .tab-caption-box-content,
.post_content .wp-block-cocoon-blocks-tab-caption-box-1 > .tab-caption-box-content {
  margin: 0;
  padding: 0;
}
.post_content .tab-caption-box-content > :first-child { margin-top: 0; }
.post_content .tab-caption-box-content > :last-child { margin-bottom: 0; }
.post_content .wp-block-cocoon-blocks-info-box,
.post_content .information-box,
.post_content .question-box,
.post_content .alert-box,
.post_content .memo-box,
.post_content .comment-box,
.post_content .ok-box,
.post_content .good-box,
.post_content .ng-box,
.post_content .bad-box,
.post_content .profile-box {
  margin: 1.8em 0;
  padding: 1.15em 1.25em;
  border: 1px solid #d7e1e8;
  border-left: 5px solid #0f9d8a;
  border-radius: 8px;
  background: #f7fbfa;
}
.post_content .wp-block-cocoon-blocks-info-box.danger-box,
.post_content .danger-box {
  border-color: #f3b3b3;
  border-left-color: #d93025;
  background: #fff6f6;
}
.post_content .wp-block-cocoon-blocks-info-box.warning-box,
.post_content .warning-box {
  border-color: #f0cf85;
  border-left-color: #d89a00;
  background: #fffaf0;
}
.post_content .marker,
.post_content .marker-yellow { background: linear-gradient(transparent 62%, #ffe78a 62%); }
.post_content .marker-red { background: linear-gradient(transparent 62%, #ffb6b6 62%); }
.post_content .marker-blue { background: linear-gradient(transparent 62%, #a9ddff 62%); }
.post_content .marker-under { background: linear-gradient(transparent 72%, #ffe78a 72%); }
.post_content .article-compass-point-box {
  margin: 2em 0;
  padding: 1.15em 1.3em;
  border: 2px solid #0f9d8a;
  border-radius: 10px;
  background: #f5fbf9;
}
.post_content .article-compass-point-box > :first-child { margin-top: 0; }
.post_content .article-compass-point-box > :last-child { margin-bottom: 0; }
.post_content .article-compass-notice-box {
  margin: 1.8em 0;
  padding: 1.1em 1.25em;
  border-radius: 9px;
}
.post_content .article-compass-notice-danger {
  border: 1px solid #efb2b2;
  border-left: 5px solid #d93025;
  background: #fff6f6;
}
.post_content .article-compass-affiliate-cta {
  width: min(100%, 680px);
  margin: 1.8em auto;
  text-align: center;
}
.post_content .article-compass-affiliate-cta .wp-block-button,
.post_content .article-compass-affiliate-cta .wp-block-button__link { width: 100%; }
.post_content .article-compass-affiliate-cta .wp-block-button__link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: .9em 1.35em;
  border-radius: 999px;
  background: var(--color_main, #0f9d8a);
  color: #fff !important;
  font-weight: 700;
  text-decoration: none !important;
}
.post_content .article-compass-internal-link > a {
  display: block;
  padding: 1em 1.15em;
  border: 1px solid #d7e1e8;
  border-left: 5px solid var(--color_main, #0f9d8a);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(20,45,60,.08);
  color: inherit;
  font-weight: 700;
  text-decoration: none;
}
.post_content .btn-wrap,
.post_content .wp-block-cocoon-blocks-button-wrap-1 {
  position: relative;
  display: block;
  width: min(100%, 680px);
  margin: 1.8em auto;
  background: transparent !important;
  text-align: center;
}
.post_content .cocoon-block-button__width-75 { width: min(75%, 680px); }
.post_content .cocoon-block-button__width-100 { width: 100%; }
.post_content .btn-wrap > a,
.post_content .wp-block-cocoon-blocks-button-wrap-1 > a {
  display: flex !important;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: .9em 1.35em;
  border: 0 !important;
  border-radius: 999px !important;
  background: #0f9d8a !important;
  box-shadow: 0 4px 0 #087466;
  color: #fff !important;
  font-weight: 700;
  line-height: 1.5;
  text-decoration: none !important;
  transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
}
.post_content .has-blue-background-color > a { background: #1176d4 !important; box-shadow: 0 4px 0 #0b559a; }
.post_content .has-red-background-color > a { background: #d93025 !important; box-shadow: 0 4px 0 #a5231b; }
.post_content .has-orange-background-color > a { background: #e67e22 !important; box-shadow: 0 4px 0 #ad5a15; }
.post_content .btn-wrap > a:hover,
.post_content .wp-block-cocoon-blocks-button-wrap-1 > a:hover {
  filter: brightness(1.06);
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(0,0,0,.28);
}
.post_content .article-compass-swell-blogcard { margin: 1.3em 0 1.8em; }
.post_content .article-compass-swell-blogcard__link {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 14px;
  border: 1px solid #d7e1e8;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(20,45,60,.08);
  color: inherit !important;
  text-decoration: none !important;
}
.post_content .article-compass-swell-blogcard__thumb { flex: 0 0 150px; }
.post_content .article-compass-swell-blogcard__thumb img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  object-fit: cover;
}
.post_content .article-compass-swell-blogcard__body { min-width: 0; }
.post_content .article-compass-swell-blogcard__label {
  display: block;
  margin-bottom: .25em;
  color: #0f766e;
  font-size: .78em;
  font-weight: 700;
}
.post_content .article-compass-swell-blogcard__title { display: block; font-weight: 700; line-height: 1.55; }
.post_content .article-compass-swell-blogcard__excerpt {
  display: block;
  margin-top: .35em;
  color: #64727b;
  font-size: .84em;
  line-height: 1.55;
}
@media (max-width: 600px) {
  .post_content .cocoon-block-button__width-75 { width: 100%; }
  .post_content .article-compass-swell-blogcard__link { align-items: flex-start; gap: 11px; padding: 11px; }
  .post_content .article-compass-swell-blogcard__thumb { flex-basis: 104px; }
  .post_content .article-compass-swell-blogcard__excerpt { display: none; }
}
CSS;
    }

    public static function render_cocoon_blogcards_for_swell($content) {
        if (is_admin() || stripos($content, 'wp-block-cocoon-blocks-blogcard') === false) {
            return $content;
        }

        $pattern = '#<div\\b[^>]*class=(["\'])([^"\']*\\bwp-block-cocoon-blocks-blogcard\\b[^"\']*)\\1[^>]*>\\s*(?:<a\\b[^>]*href=(["\'])([^"\']+)\\3[^>]*>[\\s\\S]*?</a>|(https?://[^\\s<]+))\\s*</div>#i';

        return preg_replace_callback($pattern, function ($matches) {
            $url = isset($matches[4]) && $matches[4] !== '' ? $matches[4] : (isset($matches[5]) ? $matches[5] : '');
            return self::build_swell_blogcard($url);
        }, $content);
    }

    private static function build_swell_blogcard($url) {
        $url = esc_url_raw(html_entity_decode(trim($url), ENT_QUOTES, get_bloginfo('charset')));
        if ($url === '') {
            return '';
        }

        $post_id = url_to_postid($url);
        $title = $post_id ? get_the_title($post_id) : wp_parse_url($url, PHP_URL_HOST);
        $title = $title ? $title : $url;
        $excerpt = '';
        $thumb = '';

        if ($post_id) {
            $post = get_post($post_id);
            if ($post) {
                $excerpt = has_excerpt($post_id) ? get_the_excerpt($post_id) : wp_trim_words(wp_strip_all_tags(strip_shortcodes($post->post_content)), 38, '…');
            }
            if (has_post_thumbnail($post_id)) {
                $thumb = get_the_post_thumbnail($post_id, 'medium', array('loading' => 'lazy'));
            }
        }

        $thumb_html = $thumb !== ''
            ? '<span class="article-compass-swell-blogcard__thumb">' . $thumb . '</span>'
            : '';
        $excerpt_html = $excerpt !== ''
            ? '<span class="article-compass-swell-blogcard__excerpt">' . esc_html($excerpt) . '</span>'
            : '';

        return '<div class="article-compass-swell-blogcard">'
            . '<a class="article-compass-swell-blogcard__link" href="' . esc_url($url) . '">'
            . $thumb_html
            . '<span class="article-compass-swell-blogcard__body">'
            . '<span class="article-compass-swell-blogcard__label">あわせて読みたい</span>'
            . '<span class="article-compass-swell-blogcard__title">' . esc_html(wp_strip_all_tags($title)) . '</span>'
            . $excerpt_html
            . '</span></a></div>';
    }

    public static function upsert_items(WP_REST_Request $request) {
        if (!post_type_exists(self::RINKER_POST_TYPE)) {
            return new WP_Error('rinker_not_active', 'Rinkerが有効ではありません。', array('status' => 409));
        }

        $items = $request->get_param('items');
        if (!is_array($items) || empty($items)) {
            return new WP_Error('items_required', '商品情報がありません。', array('status' => 400));
        }

        $results = array();
        foreach (array_slice($items, 0, 3) as $item) {
            $result = self::upsert_item(is_array($item) ? $item : array());
            if (is_wp_error($result)) {
                return $result;
            }
            $results[] = $result;
        }

        return rest_ensure_response(array('ok' => true, 'items' => $results));
    }

    private static function upsert_item(array $item) {
        $title = sanitize_text_field(isset($item['title']) ? $item['title'] : '');
        $keyword = sanitize_text_field(isset($item['keyword']) ? $item['keyword'] : $title);
        $item_code = sanitize_text_field(isset($item['rakuten_itemcode']) ? $item['rakuten_itemcode'] : '');
        $rakuten_title_url = esc_url_raw(isset($item['rakuten_title_url']) ? $item['rakuten_title_url'] : '');

        if ($title === '' || $rakuten_title_url === '') {
            return new WP_Error('invalid_item', '商品名または楽天商品URLが不足しています。', array('status' => 400));
        }

        $identity_source = $item_code !== '' ? $item_code : $rakuten_title_url;
        $identity = hash('sha256', $identity_source);
        $existing = get_posts(array(
            'post_type' => self::RINKER_POST_TYPE,
            'post_status' => array('publish', 'draft', 'private'),
            'posts_per_page' => 1,
            'fields' => 'ids',
            'meta_key' => self::META_KEY,
            'meta_value' => $identity,
        ));

        $post_id = !empty($existing) ? (int) $existing[0] : 0;
        $post_data = array(
            'post_title' => $title,
            'post_name' => sanitize_title($title),
            'post_status' => 'publish',
            'post_type' => self::RINKER_POST_TYPE,
            'ping_status' => 'closed',
        );

        if ($post_id > 0) {
            $post_data['ID'] = $post_id;
            $post_id = wp_update_post(wp_slash($post_data), true);
        } else {
            $post_id = wp_insert_post(wp_slash($post_data), true);
        }

        if (is_wp_error($post_id)) {
            return $post_id;
        }

        $amazon_url = esc_url_raw(isset($item['amazon_url']) ? $item['amazon_url'] : '');
        $rakuten_url = esc_url_raw(isset($item['rakuten_url']) ? $item['rakuten_url'] : '');
        $image_url = esc_url_raw(isset($item['image_url']) ? $item['image_url'] : '');
        $price = max(0, (int) (isset($item['price']) ? $item['price'] : 0));

        $meta = array(
            self::META_KEY => $identity,
            'yyi_rinker_search_shop_value' => 21,
            'yyi_rinker_title' => $title,
            'yyi_rinker_keyword' => $keyword,
            'yyi_rinker_rakuten_itemcode' => $item_code,
            'yyi_rinker_rakuten_title_url' => $rakuten_title_url,
            'yyi_rinker_rakuten_url' => $rakuten_url,
            'yyi_rinker_amazon_url' => $amazon_url,
            'yyi_rinker_s_image_url' => $image_url,
            'yyi_rinker_m_image_url' => $image_url,
            'yyi_rinker_l_image_url' => $image_url,
            'yyi_rinker_price' => $price > 0 ? (string) $price : '',
            'yyi_rinker_price_at' => current_time('Y/m/d H:i:s'),
            'yyi_rinker_no_renew' => 1,
        );

        foreach ($meta as $key => $value) {
            if ($value === '' && $key !== 'yyi_rinker_price') {
                delete_post_meta($post_id, $key);
            } else {
                update_post_meta($post_id, $key, $value);
            }
        }

        delete_transient('yyi_rinker_itemlink_' . $post_id);

        return array(
            'post_id' => (int) $post_id,
            'shortcode' => '[itemlink post_id="' . (int) $post_id . '"]',
            'created' => empty($existing),
        );
    }
}

Article_Compass_Rinker_Bridge::init();
