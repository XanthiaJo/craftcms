<?php

namespace app\modules\remoteMarkdown;

use Craft;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class RemoteMarkdownTwigExtension extends AbstractExtension
{
    public function getFunctions(): array
    {
        return [
            new TwigFunction('githubMarkdownSource', [$this, 'fetchMarkdownSource']),
        ];
    }

    public function fetchMarkdownSource(?string $url): string
    {
        $normalizedUrl = $this->normalizeGithubMarkdownUrl($url);

        if ($normalizedUrl === null) {
            return '';
        }

        $cacheKey = 'github-markdown-source:' . sha1($normalizedUrl);

        return (string)Craft::$app->getCache()->getOrSet($cacheKey, function () use ($normalizedUrl) {
            try {
                $client = Craft::createGuzzleClient([
                    'connect_timeout' => 5,
                    'timeout' => 10,
                    'http_errors' => false,
                    'headers' => [
                        'Accept' => 'text/markdown,text/plain;q=0.9,*/*;q=0.8',
                    ],
                ]);

                $response = $client->request('GET', $normalizedUrl);

                if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
                    Craft::warning("Markdown fetch returned HTTP {$response->getStatusCode()} for {$normalizedUrl}", __METHOD__);
                    return '';
                }

                return (string)$response->getBody();
            } catch (\Throwable $e) {
                Craft::warning("Failed to fetch markdown from {$normalizedUrl}: {$e->getMessage()}", __METHOD__);
                return '';
            }
        }, 300);
    }

    private function normalizeGithubMarkdownUrl(?string $url): ?string
    {
        $url = trim((string)$url);

        if ($url === '') {
            return null;
        }

        $parts = parse_url($url);
        if ($parts === false || empty($parts['host'])) {
            return null;
        }

        $host = strtolower(preg_replace('/^www\./', '', $parts['host']));
        $path = trim($parts['path'] ?? '', '/');

        if ($host === 'raw.githubusercontent.com') {
            return $url;
        }

        if ($host !== 'github.com') {
            return null;
        }

        $segments = array_values(array_filter(explode('/', $path), static fn ($segment) => $segment !== ''));
        if (count($segments) < 5) {
            return null;
        }

        $sourceType = $segments[2] ?? null;
        if (!in_array($sourceType, ['blob', 'raw'], true)) {
            return null;
        }

        $owner = rawurlencode($segments[0]);
        $repo = rawurlencode($segments[1]);
        $ref = rawurlencode($segments[3]);
        $filePath = implode('/', array_map('rawurlencode', array_slice($segments, 4)));

        if ($filePath === '') {
            return null;
        }

        return sprintf('https://raw.githubusercontent.com/%s/%s/%s/%s', $owner, $repo, $ref, $filePath);
    }
}
