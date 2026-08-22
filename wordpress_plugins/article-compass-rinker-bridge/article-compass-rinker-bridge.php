<?php
/**
 * Plugin Name: Article Compass Rinker Bridge
 * Description: Article Compass SystemからRinker商品リンクを安全に作成・再利用します。
 * Version: 1.2.6
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
    const DESCRIPTION_HASH_META_KEY = 'article_compass_description_hash';

    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
        add_action('enqueue_block_editor_assets', array(__CLASS__, 'enqueue_rinker_editor_compat'));
        add_action('enqueue_block_assets', array(__CLASS__, 'enqueue_rinker_editor_compat_in_canvas'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue_rinker_media_compat'));
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
            '1.2.6',
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
            'bridge_version' => '1.2.6',
            'seo_meta_supported' => true,
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

        $current = (string) get_post_meta($post_id, self::COCOON_DESCRIPTION_META_KEY, true);
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

        update_post_meta($post_id, self::COCOON_DESCRIPTION_META_KEY, $description);
        update_post_meta($post_id, self::DESCRIPTION_HASH_META_KEY, hash('sha256', $description));

        return rest_ensure_response(array(
            'ok' => true,
            'updated' => true,
            'preserved' => false,
            'reason' => $current === '' ? 'inserted' : 'managed_value_updated',
            'length' => mb_strlen($description),
        ));
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
