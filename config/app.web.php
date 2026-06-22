<?php
/**
 * Yii Application Config for web requests
 */

use app\modules\remoteMarkdown\RemoteMarkdownModule;

return [
    'modules' => [
        'remote-markdown' => [
            'class' => RemoteMarkdownModule::class,
        ],
    ],
    'bootstrap' => [
        'remote-markdown',
    ],
];
