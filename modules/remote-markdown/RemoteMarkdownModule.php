<?php

namespace app\modules\remoteMarkdown;

use Craft;
use yii\base\Module;

class RemoteMarkdownModule extends Module
{
    public function init(): void
    {
        parent::init();

        Craft::$app->getView()->registerSiteTwigExtension(new RemoteMarkdownTwigExtension());
    }
}
