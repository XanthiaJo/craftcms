<?php
/**
 * GenerateBuildInfo.php — Cross-platform build info generator.
 *
 * Mirrors the logic of GenerateBuildInfo.ps1:
 *   - Reads git tags and commit history
 *   - Derives a version from conventional commit messages (feat:, fix:, BREAKING CHANGE)
 *   - Non-feat/fix commits increment the revision (4th number)
 *   - Outputs a JS file (window.BUILD_INFO) or C# class
 *
 * Usage:
 *   php scripts/GenerateBuildInfo.php --root=. --output=web/js/buildInfo.js --format=js
 *   php scripts/GenerateBuildInfo.php --root=. --output=BuildInfo.cs --format=csharp
 *
 * Parameters:
 *   --root     Repository root path (required)
 *   --output   Output file path (required)
 *   --format   Output format: "js" or "csharp" (default: csharp)
 */

$options = getopt('', ['root:', 'output:', 'format:']);

$root = $options['root'] ?? null;
$outputPath = $options['output'] ?? null;
$format = $options['format'] ?? 'csharp';

if (!$root || !$outputPath) {
    fwrite(STDERR, "Usage: php scripts/GenerateBuildInfo.php --root=. --output=web/js/buildInfo.js --format=js\n");
    exit(1);
}

$root = realpath($root);
if (!$root || !is_dir($root)) {
    fwrite(STDERR, "Repository root not found: $root\n");
    exit(1);
}

function findGit(): string {
    // Check if git is already in PATH
    $testOutput = [];
    $testExit = 0;
    exec('git --version 2>&1', $testOutput, $testExit);
    if ($testExit === 0) {
        return 'git';
    }
    // Try common locations
    $candidates = ['/usr/local/bin/git', '/usr/bin/git', '/bin/git', '/usr/local/git/bin/git', '/opt/git/bin/git'];
    foreach ($candidates as $path) {
        if (file_exists($path) && is_executable($path)) {
            return $path;
        }
    }
    throw new RuntimeException('git binary not found in PATH or common locations');
}

function git(string $root, string ...$args): array {
    static $gitBin = null;
    if ($gitBin === null) {
        $gitBin = findGit();
    }
    $escapedRoot = escapeshellarg($root);
    $escapedArgs = array_map('escapeshellarg', $args);
    $cmd = "$gitBin -C $escapedRoot " . implode(' ', $escapedArgs) . ' 2>&1';
    $output = [];
    $exitCode = 0;
    exec($cmd, $output, $exitCode);
    if ($exitCode !== 0) {
        throw new RuntimeException("git " . implode(' ', $args) . " failed (exit $exitCode): " . implode("\n", $output));
    }
    return $output;
}

function parseVersion(string $tagName): array {
    $raw = ltrim(trim($tagName), 'vV');
    $parts = explode('.', $raw);
    if (count($parts) < 3) {
        throw new RuntimeException("Tag '$tagName' is not a valid version");
    }
    return array_map('intval', $parts);
}

function formatVersion(array $version, int $revision = 0): string {
    if ($revision > 0) {
        return sprintf('v%d.%d.%d.%d', $version[0], $version[1], $version[2], $revision);
    }
    return sprintf('v%d.%d.%d', $version[0], $version[1], $version[2]);
}

function tryParseTaggedVersion(string $tagName): ?array {
    $raw = ltrim(trim($tagName), 'vV');
    $parts = explode('.', $raw);
    if (count($parts) < 3) {
        return null;
    }
    foreach ($parts as $p) {
        if (!ctype_digit($p)) {
            return null;
        }
    }
    $version = array_map('intval', $parts);
    if (count($version) === 3) {
        $version[] = 0;
    }
    return $version;
}

function getCommitType(string $subject): string {
    if (preg_match('/BREAKING CHANGE|!:/', $subject)) {
        return 'major';
    }
    if (preg_match('/^feat(\([^)]+\))?:/', $subject)) {
        return 'minor';
    }
    if (preg_match('/^fix(\([^)]+\))?:/', $subject)) {
        return 'patch';
    }
    return 'none';
}

// Commit count
$commitCountOutput = git($root, 'rev-list', '--count', 'HEAD');
$commitCount = (int)trim($commitCountOutput[0] ?? '0');

// Tags with object hashes
$tagOutput = git($root, 'tag', '--format=%(objectname)|%(refname:short)');
$taggedVersions = [];
foreach ($tagOutput as $line) {
    if (trim($line) === '') continue;
    $parts = explode('|', $line, 2);
    if (count($parts) !== 2) continue;
    $version = tryParseTaggedVersion($parts[1]);
    if ($version !== null) {
        $taggedVersions[$parts[0]] = $version;
    }
}

// Commit log (oldest first)
$logOutput = git($root, 'log', '--pretty=format:%H|%s', '--reverse', '--', '.');
$resolvedVersion = [1, 0, 0, 0];
$revision = 0;

foreach ($logOutput as $line) {
    if (trim($line) === '') continue;
    $parts = explode('|', $line, 2);
    if (count($parts) !== 2) continue;

    [$sha, $subject] = $parts;

    if (isset($taggedVersions[$sha])) {
        $resolvedVersion = $taggedVersions[$sha];
        if (count($resolvedVersion) < 4) {
            $resolvedVersion[] = 0;
        }
        $revision = 0;
        continue;
    }

    $commitType = getCommitType($subject);
    switch ($commitType) {
        case 'major':
            $resolvedVersion = [$resolvedVersion[0] + 1, 0, 0, 0];
            $revision = 0;
            break;
        case 'minor':
            $resolvedVersion = [$resolvedVersion[0], $resolvedVersion[1] + 1, 0, 0];
            $revision = 0;
            break;
        case 'patch':
            $resolvedVersion = [$resolvedVersion[0], $resolvedVersion[1], $resolvedVersion[2] + 1, 0];
            $revision = 0;
            break;
        default:
            $revision++;
            break;
    }
}

$displayVersion = formatVersion($resolvedVersion, $revision);

// Latest tag for production version
$latestTag = null;
try {
    $tagList = git($root, 'tag', '--list', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=-v:refname');
    $latestTag = trim($tagList[0] ?? '');
} catch (Throwable $e) {
    $latestTag = '';
}

$productionVersion = $latestTag !== '' ? formatVersion(parseVersion($latestTag)) : $displayVersion;

// Short SHA
$shaOutput = git($root, 'rev-parse', '--short', 'HEAD');
$shortSha = trim($shaOutput[0] ?? '');

// Generate output
if ($format === 'js') {
    $content = <<<JS
window.BUILD_INFO = {
  version: "$displayVersion",
  productionVersion: "$productionVersion",
  commit: "$shortSha",
  commitCount: "$commitCount"
};
JS;
} else {
    $namespace = 'Mudblazer.Build';
    $content = <<<CS
namespace $namespace;

public static class BuildInfo
{
    public const string Version = "$displayVersion";
    public const string ProductionVersion = "$productionVersion";
    public const string Commit = "$shortSha";
    public const string CommitCount = "$commitCount";
}
CS;
}

// Write output
$outputDir = dirname($outputPath);
if ($outputDir !== '' && !is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

file_put_contents($outputPath, $content);
fwrite(STDOUT, "Generated $outputPath ($format) — version $displayVersion, commit $shortSha\n");

