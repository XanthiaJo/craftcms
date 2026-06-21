param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $false)]
    [ValidateSet("csharp", "js")]
    [string]$Format = "csharp"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & git -C $RepositoryRoot @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }

    return $output
}

function Parse-Version {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TagName
    )

    $raw = $TagName.Trim()
    if ($raw.StartsWith('v', [System.StringComparison]::OrdinalIgnoreCase)) {
        $raw = $raw.Substring(1)
    }

    $parsed = $null
    if (-not [System.Version]::TryParse($raw, [ref]$parsed)) {
        throw "Latest tag '$TagName' is not a valid semantic version tag."
    }

    return [System.Version]::Parse($raw)
}

function Format-Version {
    param(
        [Parameter(Mandatory = $true)]
        [System.Version]$Version,
        [int]$Revision = 0
    )

    if ($Revision -gt 0) {
        return ('v{0}.{1}.{2}.{3}' -f $Version.Major, $Version.Minor, $Version.Build, $Revision)
    }

    return ('v{0}.{1}.{2}' -f $Version.Major, $Version.Minor, $Version.Build)
}

function Increment-Version {
    param(
        [Parameter(Mandatory = $true)]
        [System.Version]$Version,
        [Parameter(Mandatory = $true)]
        [string]$Bump
    )

    switch ($Bump) {
        'major' { return [System.Version]::new($Version.Major + 1, 0, 0) }
        'minor' { return [System.Version]::new($Version.Major, $Version.Minor + 1, 0) }
        default { return [System.Version]::new($Version.Major, $Version.Minor, [Math]::Max(0, $Version.Build + 1)) }
    }
}

function TryParseTaggedVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TagName,
        [Parameter(Mandatory = $true)]
        [ref]$Version
    )

    $Version.Value = $null
    $raw = $TagName.Trim()
    if ($raw.StartsWith('v', [System.StringComparison]::OrdinalIgnoreCase)) {
        $raw = $raw.Substring(1)
    }

    $parts = $raw.Split('.', [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($parts.Length -lt 3) {
        return $false
    }

    $major = 0
    $minor = 0
    $patch = 0
    $revision = 0

    if (-not [int]::TryParse($parts[0], [ref]$major) -or
        -not [int]::TryParse($parts[1], [ref]$minor) -or
        -not [int]::TryParse($parts[2], [ref]$patch)) {
        return $false
    }

    if ($parts.Length -gt 3 -and -not [int]::TryParse($parts[3], [ref]$revision)) {
        return $false
    }

    if ($parts.Length -gt 3) {
        $Version.Value = [System.Version]::new($major, $minor, $patch, $revision)
    } else {
        $Version.Value = [System.Version]::new($major, $minor, $patch)
    }
    return $true
}

function Get-CommitType {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Subject
    )

    if ($Subject -match 'BREAKING CHANGE|!:') {
        return 'major'
    }

    if ($Subject -match '^feat(\([^)]+\))?:') {
        return 'minor'
    }

    if ($Subject -match '^fix(\([^)]+\))?:') {
        return 'patch'
    }

    return 'none'
}

$commitCount = [int]((Invoke-Git -Arguments @('rev-list', '--count', 'HEAD')).Trim())

$tagOutput = @(Invoke-Git -Arguments @('tag', '--format=%(objectname)|%(refname:short)'))
$taggedVersions = @{}
foreach ($line in $tagOutput) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $parts = $line.Split('|', 2, [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($parts.Length -ne 2) {
        continue
    }

    $version = $null
    if (-not (TryParseTaggedVersion -TagName $parts[1] -Version ([ref]$version))) {
        continue
    }

    $taggedVersions[$parts[0]] = $version
}

$logOutput = @(Invoke-Git -Arguments @('log', '--date=iso-strict', '--pretty=format:%H|%s', '--reverse', '--', '.'))
$resolvedVersion = [System.Version]::new(1, 0, 0)
$revision = 0
foreach ($line in $logOutput) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $parts = $line.Split('|', 2)
    if ($parts.Length -ne 2) {
        continue
    }

    $sha = $parts[0]
    $subject = $parts[1]

    if ($taggedVersions.ContainsKey($sha)) {
        $resolvedVersion = $taggedVersions[$sha]
        $revision = 0
        continue
    }

    $commitType = Get-CommitType -Subject $subject
    switch ($commitType) {
        'major' {
            $resolvedVersion = [System.Version]::new($resolvedVersion.Major + 1, 0, 0)
            $revision = 0
        }
        'minor' {
            $resolvedVersion = [System.Version]::new($resolvedVersion.Major, $resolvedVersion.Minor + 1, 0)
            $revision = 0
        }
        'patch' {
            $resolvedVersion = [System.Version]::new($resolvedVersion.Major, $resolvedVersion.Minor, [Math]::Max(0, $resolvedVersion.Build + 1))
            $revision = 0
        }
        default {
            $revision += 1
        }
    }
}

$displayVersion = Format-Version -Version $resolvedVersion -Revision $revision
$latestTag = $null
try {
    $latestTag = (Invoke-Git -Arguments @('tag', '--list', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=-v:refname') | Select-Object -First 1)
} catch {
    $latestTag = $null
}

$productionVersion = if ([string]::IsNullOrWhiteSpace($latestTag)) {
    $displayVersion
} else {
    Format-Version -Version (Parse-Version -TagName $latestTag)
}
$shortSha = (Invoke-Git -Arguments @('rev-parse', '--short', 'HEAD')).Trim()

if ($Format -eq 'js') {
    $content = @"
window.BUILD_INFO = {
  version: "$displayVersion",
  productionVersion: "$productionVersion",
  commit: "$shortSha",
  commitCount: "$commitCount"
};
"@
} else {
    $namespace = 'Mudblazer.Build'
    $content = @"
namespace $namespace;

public static class BuildInfo
{
    public const string Version = "$displayVersion";
    public const string ProductionVersion = "$productionVersion";
    public const string Commit = "$shortSha";
    public const string CommitCount = "$commitCount";
}
"@
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

Set-Content -Path $OutputPath -Value $content -Encoding UTF8
