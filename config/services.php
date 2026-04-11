<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'whatsapp' => [
        'enabled' => env('WHATSAPP_ENABLED', false),
        'api_url' => env('WHATSAPP_API_URL'),
        'token' => env('WHATSAPP_TOKEN'),
        'timeout' => (int) env('WHATSAPP_TIMEOUT', 10),
        'verify_ssl' => filter_var(env('WHATSAPP_VERIFY_SSL', true), FILTER_VALIDATE_BOOL),
        'auth_mode' => env('WHATSAPP_AUTH_MODE', 'header'),
        'auth_header' => env('WHATSAPP_AUTH_HEADER', 'Authorization'),
        'field_phone' => env('WHATSAPP_FIELD_PHONE', 'target'),
        'field_message' => env('WHATSAPP_FIELD_MESSAGE', 'message'),
        'field_file' => env('WHATSAPP_FIELD_FILE', 'file'),
        'field_token' => env('WHATSAPP_FIELD_TOKEN', 'token'),
        'rental_reminder_lead_hours' => (int) env('WHATSAPP_RENTAL_REMINDER_LEAD_HOURS', 6),
    ],

    'pdf_renderer' => [
        'browser_binary' => env('PDF_BROWSER_BINARY'),
        'timeout' => (int) env('PDF_RENDER_TIMEOUT', 30),
    ],

    'midtrans' => [
        'client_key' => env('MIDTRANS_CLIENT_KEY'),
        'server_key' => env('MIDTRANS_SERVER_KEY'),
        'is_production' => filter_var(env('MIDTRANS_IS_PRODUCTION', false), FILTER_VALIDATE_BOOL),
    ],

];
