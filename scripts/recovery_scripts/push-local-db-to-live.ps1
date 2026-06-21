[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RemoteHost,

    [Parameter(Mandatory = $false)]
    [string]$RemoteUser,

    [Parameter(Mandatory = $false)]
    [int]$RemotePort,

    [Parameter(Mandatory = $false)]
    [string]$RemoteDatabaseName,

    [Parameter(Mandatory = $false)]
    [string]$RemoteDumpDir,

    [Parameter(Mandatory = $false)]
    [string]$RemoteCraftPath,

    [Parameter(Mandatory = $false)]
    [string]$RemotePassword,

    [Parameter(Mandatory = $false)]
    [switch]$SkipRemoteBackup,

    [Parameter(Mandatory = $false)]
    [switch]$ApplyProjectConfig,

    [Parameter(Mandatory = $false)]
    [switch]$RunMigrations
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    Get-Content -LiteralPath $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) {
            return
        }

        $pair = $line -split '=', 2
        if ($pair.Count -ne 2) {
            return
        }

        $name = $pair[0].Trim()
        $value = $pair[1].Trim()
        if ($value.Length -ge 2) {
            $first = $value[0]
            $last = $value[$value.Length - 1]
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        Set-Item -Path "Env:$name" -Value $value
    }
}

if (-not $RemoteHost) { $RemoteHost = $env:LIVE_DB_HOST }
if (-not $RemoteUser) { $RemoteUser = $env:LIVE_DB_USER }
if (-not $RemoteDatabaseName) { $RemoteDatabaseName = $env:LIVE_DB_NAME }
if (-not $RemoteDumpDir) { $RemoteDumpDir = if ($env:LIVE_DB_DUMP_DIR) { $env:LIVE_DB_DUMP_DIR } else { '/tmp' } }
if (-not $RemoteCraftPath) { $RemoteCraftPath = $env:LIVE_CRAFT_PATH }
if (-not $RemotePassword) { $RemotePassword = $env:LIVE_DB_PASSWORD }
if (-not $RemotePort) { $RemotePort = if ($env:LIVE_DB_SSH_PORT) { [int]$env:LIVE_DB_SSH_PORT } else { 22 } }

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

function Escape-BashSingleQuoted {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $replacement = "'" + '"' + "'" + '"' + "'"
    return "'" + ($Value -replace "'", $replacement) + "'"
}

function Assert-RequiredValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing required value for $Name. Pass it as a parameter or set the matching LIVE_* environment variable."
    }
}

Assert-RequiredValue -Value $RemoteHost -Name 'RemoteHost'
Assert-RequiredValue -Value $RemoteUser -Name 'RemoteUser'
Assert-RequiredValue -Value $RemoteDatabaseName -Name 'RemoteDatabaseName'

foreach ($tool in @('ddev')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $tool"
    }
}

$usePasswordAuth = -not [string]::IsNullOrWhiteSpace($RemotePassword)
if ($usePasswordAuth) {
    foreach ($tool in @('plink', 'pscp')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Password auth requested, but required command not found: $tool (install PuTTY tools or use SSH keys instead)."
        }
    }
}
else {
    foreach ($tool in @('ssh', 'scp')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Required command not found: $tool"
        }
    }
}

$ddevPath = (Get-Command ddev).Source
$sshPath = $null
$scpPath = $null
$plinkPath = $null
$pscpPath = $null

if ($usePasswordAuth) {
    $plinkPath = (Get-Command plink).Source
    $pscpPath = (Get-Command pscp).Source
}
else {
    $sshPath = (Get-Command ssh).Source
    $scpPath = (Get-Command scp).Source
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$syncDir = Join-Path $projectRoot '.db-sync'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$localDump = Join-Path $syncDir "craft-local-$timestamp.sql.gz"
$remoteFile = Split-Path -Leaf $localDump
$remoteSpec = "$RemoteUser@$RemoteHost"
$remoteBackupFile = "craft-live-backup-$timestamp.sql.gz"
$script:ExitCode = 0
$script:FailureMessage = $null

New-Item -ItemType Directory -Force -Path $syncDir | Out-Null

Push-Location $projectRoot
function Pause-OnExit {
    param([string]$Message)

    Write-Host ''
    Write-Host $Message
    Write-Host 'Press Enter to close...'
    [void](Read-Host)
}

function Normalize-RemotePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $trimmed = $Path.Trim()
    if ($trimmed.StartsWith('~/')) {
        return "/home/$RemoteUser/$($trimmed.Substring(2))"
    }

    return $trimmed
}

$RemoteDumpDir = Normalize-RemotePath -Path $RemoteDumpDir
$RemoteDumpDir = $RemoteDumpDir.TrimEnd('/')

try {
    Write-Host "Exporting local database to $localDump"
    Invoke-NativeCommand -FilePath $ddevPath -Arguments @('export-db', "--file=$localDump")

    $mkdirCommand = "mkdir -p $(Escape-BashSingleQuoted $RemoteDumpDir)"
    if ($usePasswordAuth) {
        Invoke-NativeCommand -FilePath $plinkPath -Arguments @('-ssh', '-P', "$RemotePort", '-pw', $RemotePassword, $remoteSpec, $mkdirCommand)
    }
    else {
        Invoke-NativeCommand -FilePath $sshPath -Arguments @('-p', "$RemotePort", $remoteSpec, $mkdirCommand)
    }

    Write-Host ("Copying dump to {0}:{1}/{2}" -f $remoteSpec, $RemoteDumpDir, $remoteFile)
    if ($usePasswordAuth) {
        Invoke-NativeCommand -FilePath $pscpPath -Arguments @('-P', "$RemotePort", '-pw', $RemotePassword, $localDump, "$remoteSpec`:$RemoteDumpDir/$remoteFile")
    }
    else {
        Invoke-NativeCommand -FilePath $scpPath -Arguments @('-P', "$RemotePort", $localDump, "$remoteSpec`:$RemoteDumpDir/$remoteFile")
    }

    $remoteCommands = New-Object System.Collections.Generic.List[string]
    $remoteCommands.Add("cd $RemoteDumpDir")

    if (-not $SkipRemoteBackup) {
        $remoteCommands.Add("clpctl db:export --databaseName=$(Escape-BashSingleQuoted $RemoteDatabaseName) --file=$(Escape-BashSingleQuoted $remoteBackupFile)")
    }

    $remoteCommands.Add("clpctl db:import --databaseName=$(Escape-BashSingleQuoted $RemoteDatabaseName) --file=$(Escape-BashSingleQuoted $remoteFile)")

    $remoteCommands.Add("rm -f $(Escape-BashSingleQuoted "$RemoteDumpDir/$remoteFile")")

    if ($ApplyProjectConfig -or $RunMigrations) {
        if ([string]::IsNullOrWhiteSpace($RemoteCraftPath)) {
            throw "Set LIVE_CRAFT_PATH or pass -RemoteCraftPath if you want to run Craft commands after the import."
        }

        $remoteCommands.Add("cd $(Escape-BashSingleQuoted $RemoteCraftPath)")

        if ($ApplyProjectConfig) {
            $remoteCommands.Add('php craft project-config/apply')
        }

        if ($RunMigrations) {
            $remoteCommands.Add('php craft migrate/all')
        }
    }

    if (-not $SkipRemoteBackup) {
        $remoteCommands.Add("rm -f $(Escape-BashSingleQuoted "$RemoteDumpDir/$remoteBackupFile")")
    }

    $remoteCommand = "bash -lc " + (Escape-BashSingleQuoted (($remoteCommands -join ' && ')))

    Write-Host "Importing dump on live via CloudPanel"
    if ($usePasswordAuth) {
        Invoke-NativeCommand -FilePath $plinkPath -Arguments @('-ssh', '-P', "$RemotePort", '-pw', $RemotePassword, $remoteSpec, $remoteCommand)
    }
    else {
        Invoke-NativeCommand -FilePath $sshPath -Arguments @('-p', "$RemotePort", $remoteSpec, $remoteCommand)
    }

    Write-Host "Done."
}
catch {
    $script:ExitCode = 1
    $script:FailureMessage = "ERROR: $($_.Exception.Message)"
    Write-Host ''
    Write-Host $script:FailureMessage -ForegroundColor Red
    if ($_.ScriptStackTrace) {
        Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    }
}
finally {
    Pop-Location
    if (Test-Path -LiteralPath $localDump) {
        Remove-Item -LiteralPath $localDump -Force
    }

    Pause-OnExit -Message $(if ($script:ExitCode -eq 0) { 'The database push finished successfully.' } else { 'The database push failed.' })
    exit $script:ExitCode
}
