<?php
/**
 * GitHub webhook listener — VPS pulls from GitHub on push notification.
 *
 * Setup:
 *   1. Set GITHUB_WEBHOOK_SECRET in .env on the VPS
 *   2. In GitHub repo settings → Webhooks → Add webhook:
 *      - Payload URL: https://yourdomain.com/webhook.php
 *      - Content type: application/json
 *      - Secret: same value as GITHUB_WEBHOOK_SECRET
 *      - Events: Just the push event
 *   3. Ensure the VPS repo has the GitHub remote configured and SSH keys set up
 */

// Load .env manually (don't bootstrap full Craft for a webhook)
$envPath = dirname(__DIR__) . '/.env';
if (!file_exists($envPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'No .env file found']);
    exit;
}

$envVars = [];
foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with($line, '#')) continue;
    $eqPos = strpos($line, '=');
    if ($eqPos === false) continue;
    $key = trim(substr($line, 0, $eqPos));
    $val = trim(substr($line, $eqPos + 1), '"\'');
    $envVars[$key] = $val;
}

$secret = $envVars['GITHUB_WEBHOOK_SECRET'] ?? '';
if ($secret === '') {
    http_response_code(500);
    echo json_encode(['error' => 'GITHUB_WEBHOOK_SECRET not set in .env']);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get payload and verify signature
$payload = file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

if ($signatureHeader === '') {
    http_response_code(401);
    echo json_encode(['error' => 'Missing signature header']);
    exit;
}

$expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $secret);
if (!hash_equals($expectedSignature, $signatureHeader)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

// Parse payload to check branch
$data = json_decode($payload, true);
if ($data === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

// Only deploy on master branch
$ref = $data['ref'] ?? '';
if ($ref !== 'refs/heads/master') {
    http_response_code(200);
    echo json_encode(['status' => 'ignored', 'reason' => 'not master branch']);
    exit;
}

// Run deploy commands
$repoRoot = dirname(__DIR__);
// Ensure common binary paths are in PATH for PHP exec()
$extraPaths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/local/git/bin', '/opt/git/bin'];
$envPath = getenv('PATH');
foreach ($extraPaths as $p) {
    if (is_dir($p) && strpos($envPath, $p) === false) {
        $envPath .= ':' . $p;
    }
}
putenv('PATH=' . $envPath);

$commands = [
    'git checkout -- web/js/buildInfo.js 2>&1',
    'git pull origin master 2>&1',
    'composer install --no-dev --optimize-autoloader 2>&1',
];

$output = [];
$exitCode = 0;
foreach ($commands as $cmd) {
    $cmdOutput = [];
    $cmdExit = 0;
    exec('cd ' . escapeshellarg($repoRoot) . ' && ' . $cmd, $cmdOutput, $cmdExit);
    $output[] = '$ ' . $cmd;
    $output = array_merge($output, $cmdOutput);
    if ($cmdExit !== 0) {
        $exitCode = $cmdExit;
        break;
    }
}

header('Content-Type: application/json');
if ($exitCode === 0) {
    http_response_code(200);
    echo json_encode(['status' => 'deployed', 'output' => $output], JSON_PRETTY_PRINT);
} else {
    http_response_code(500);
    echo json_encode(['status' => 'failed', 'exitCode' => $exitCode, 'output' => $output], JSON_PRETTY_PRINT);
}
