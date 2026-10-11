<?php
/**
 * Plugin Name: Article Compass SEO Bridge
 * Description: アーコンとSEO SIMPLE PACKの説明文を連携。手動設定した説明文を保持します。
 * Version: 1.0.0
 * Author: Article Compass System
 */
if (!defined('ABSPATH')) { exit; }
final class Article_Compass_SEO_Bridge {
    const REST_NAMESPACE = 'article-compass/v1';
    const COCOON_DESCRIPTION_META_KEY = 'the_page_meta_description';
    const SWELL_DESCRIPTION_META_KEY = 'ssp_meta_description';
    const DESCRIPTION_HASH_META_KEY = 'article_compass_description_hash';
    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
    }
    public static function register_routes() {
        register_rest_route(self::REST_NAMESPACE, '/post-seo-meta', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array(__CLASS__, 'update_post_seo_meta'),
            'permission_callback' => array(__CLASS__, 'can_edit_target_post'),
        ));
        register_rest_route(self::REST_NAMESPACE, '/seo-status', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array(__CLASS__, 'status'),
            'permission_callback' => function () { return current_user_can('edit_posts'); },
        ));
    }
    public static function status() {
        return rest_ensure_response(array('ok' => true, 'bridge_version' => '1.0.0',
            'seo_meta_supported' => true, 'seo_meta_key' => self::get_description_meta_key()));
    }
    public static function can_edit_target_post(WP_REST_Request $request) {
        $post_id = absint($request->get_param('post_id'));
        return $post_id > 0 && current_user_can('edit_post', $post_id);
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

}
Article_Compass_SEO_Bridge::init();
