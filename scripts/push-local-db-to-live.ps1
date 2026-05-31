[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RemoteHost = $env:LIVE_DB_HOST,

    [Parameter(Mandatory = $false)]
    [string]$RemoteUser = $env:LIVE_DB_USER,

    [Parameter(Mandatory = $false)]
    [int]$RemotePort = $(if ($env:LIVE_DB_SSH_PORT) { [int]$env:LIVE_DB_SSH_PORT } else { 22 }),

    [Parameter(Mandatory = $false)]
    [string]$RemoteDatabaseName = $env:LIVE_DB_NAME,

    [Parameter(Mandatory = $false)]
    [string]$RemoteDumpDir = $(if ($env:LIVE_DB_DUMP_DIR) { $env:LIVE_DB_DUMP_DIR } else { '~/tmp' }),

    [Parameter(Mandatory = $false)]
    [string]$RemoteCraftPath = $env:LIVE_CRAFT_PATH,

    [Parameter(Mandatory = $false)]
    [switch]$SkipRemoteBackup,

    [Parameter(Mandatory = $false)]
    [switch]$ApplyProjectConfig,

    [Parameter(Mandatory = $false)]
    [switch]$RunMigrations
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

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

foreach ($tool in @('ddev', 'ssh', 'scp')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $tool"
    }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$syncDir = Join-Path $projectRoot '.db-sync'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$localDump = Join-Path $syncDir "craft-local-$timestamp.sql.gz"
$remoteFile = Split-Path -Leaf $localDump
$remoteSpec = "$RemoteUser@$RemoteHost"
$remoteBackupFile = "craft-live-backup-$timestamp.sql.gz"

New-Item -ItemType Directory -Force -Path $syncDir | Out-Null

Push-Location $projectRoot
function Pause-OnExit {
    param([string]$Message)

    Write-Host ''
    Write-Host $Message
    Write-Host 'Press Enter to close...'
    [void](Read-Host)
}

try {
    Write-Host "Exporting local database to $localDump"
    Invoke-NativeCommand -FilePath 'ddev' -Arguments @('export-db', "--file=$localDump")

    Write-Host ("Copying dump to {0}:{1}/{2}" -f $remoteSpec, $RemoteDumpDir, $remoteFile)
    Invoke-NativeCommand -FilePath 'scp' -Arguments @('-P', "$RemotePort", $localDump, "$remoteSpec`:$RemoteDumpDir/$remoteFile")

    $remoteCommands = New-Object System.Collections.Generic.List[string]
    $remoteCommands.Add("cd $RemoteDumpDir")

    if (-not $SkipRemoteBackup) {
        $remoteCommands.Add("clpctl db:export --databaseName=$(Escape-BashSingleQuoted $RemoteDatabaseName) --file=$(Escape-BashSingleQuoted $remoteBackupFile)")
    }

    $remoteCommands.Add("clpctl db:import --databaseName=$(Escape-BashSingleQuoted $RemoteDatabaseName) --file=$(Escape-BashSingleQuoted $remoteFile)")

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

    $remoteCommand = "bash -lc " + (Escape-BashSingleQuoted (($remoteCommands -join ' && ')))

    Write-Host "Importing dump on live via CloudPanel"
    Invoke-NativeCommand -FilePath 'ssh' -Arguments @('-p', "$RemotePort", $remoteSpec, $remoteCommand)

    Write-Host "Done."
}
catch {
    Write-Host ''
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ScriptStackTrace) {
        Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    }
    Pause-OnExit -Message 'The database push failed.'
    exit 1
}
finally {
    Pop-Location
    if (Test-Path -LiteralPath $localDump) {
        Remove-Item -LiteralPath $localDump -Force
    }
}
