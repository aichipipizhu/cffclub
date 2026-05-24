#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RepoUrl = "https://github.com/aichipipizhu/cffclub.git",
  [string]$Branch = "main",
  [string]$AppDir = "C:\sites\cffclub",
  [string]$AppName = "kabuda",
  [int]$Port = 3000,
  [string]$DatabaseUrl = "",
  [string]$AuthSecret = "",
  [switch]$Seed,
  [switch]$SkipStartup
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-NodeVersion {
  $raw = (& node --version).Trim()
  if ($raw -notmatch "^v(\d+)\.(\d+)\.(\d+)$") {
    throw "Cannot parse Node.js version: $raw"
  }

  $major = [int]$Matches[1]
  $minor = [int]$Matches[2]
  if ($major -lt 18 -or ($major -eq 18 -and $minor -lt 18)) {
    throw "Node.js 18.18+ is required. Node.js 20 LTS or 22 LTS is recommended. Current: $raw"
  }
}

function Ensure-Pm2 {
  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Step "Installing PM2"
    & npm install -g pm2
  }

  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    $prefix = (& npm config get prefix).Trim()
    $env:Path = "$prefix;$prefix\node_modules\.bin;$env:Path"
  }

  Ensure-Command "pm2" "Run: npm install -g pm2"
}

function Ensure-Pm2Startup {
  if (Get-Command pm2-startup -ErrorAction SilentlyContinue) {
    return
  }

  Write-Step "Installing PM2 Windows startup helper"
  & npm install -g pm2-windows-startup

  if (-not (Get-Command pm2-startup -ErrorAction SilentlyContinue)) {
    $prefix = (& npm config get prefix).Trim()
    $env:Path = "$prefix;$prefix\node_modules\.bin;$env:Path"
  }
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return
  }

  $escaped = $Value.Replace('"', '\"')
  $line = "$Key=`"$escaped`""
  $content = ""
  if (Test-Path $Path) {
    $content = Get-Content $Path -Raw
  }

  if ($content -match "(?m)^$([regex]::Escape($Key))=") {
    $content = [regex]::Replace($content, "(?m)^$([regex]::Escape($Key))=.*$", $line)
  } else {
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
      $content += "`r`n"
    }
    $content += "$line`r`n"
  }

  Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Ensure-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    $examplePath = Join-Path (Split-Path $Path -Parent) ".env.example"
    if (Test-Path $examplePath) {
      Copy-Item $examplePath $Path
    } else {
      New-Item -Path $Path -ItemType File -Force | Out-Null
    }
  }

  Set-EnvValue -Path $Path -Key "DATABASE_URL" -Value $DatabaseUrl
  Set-EnvValue -Path $Path -Key "AUTH_SECRET" -Value $AuthSecret

  $envContent = Get-Content $Path -Raw
  if ($envContent -notmatch '(?m)^DATABASE_URL="mysql://.+?"' -or
      $envContent -match 'kabuda_user:kabuda_password' -or
      $envContent -notmatch '(?m)^AUTH_SECRET=".{24,}"' -or
      $envContent -match 'replace-with-a-long-random-secret') {
    throw "Update $Path with a real DATABASE_URL and a long AUTH_SECRET, or pass -DatabaseUrl and -AuthSecret."
  }
}

function Get-Pm2Process {
  param([string]$Name)

  try {
    $json = & pm2 jlist
    if ([string]::IsNullOrWhiteSpace($json)) {
      return $null
    }
    return ($json | ConvertFrom-Json | Where-Object { $_.name -eq $Name } | Select-Object -First 1)
  } catch {
    return $null
  }
}

Write-Step "Checking required tools"
Ensure-Command "git" "Install Git for Windows from https://git-scm.com/download/win"
Ensure-Command "node" "Install Node.js 20 LTS or 22 LTS from https://nodejs.org/"
Ensure-Command "npm" "Install Node.js 20 LTS or 22 LTS from https://nodejs.org/"
Ensure-NodeVersion
Ensure-Pm2

Write-Step "Preparing application directory"
$parentDir = Split-Path $AppDir -Parent
if (-not (Test-Path $parentDir)) {
  New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
}

if (Test-Path (Join-Path $AppDir ".git")) {
  Set-Location $AppDir
  & git fetch origin
  & git checkout $Branch
  & git pull --ff-only origin $Branch
} elseif (Test-Path $AppDir) {
  $existing = Get-ChildItem -LiteralPath $AppDir -Force | Select-Object -First 1
  if ($existing) {
    throw "$AppDir exists but is not a Git checkout. Move it away or pass a different -AppDir."
  }
  & git clone --branch $Branch $RepoUrl $AppDir
  Set-Location $AppDir
} else {
  & git clone --branch $Branch $RepoUrl $AppDir
  Set-Location $AppDir
}

Write-Step "Checking production environment variables"
Ensure-EnvFile -Path (Join-Path $AppDir ".env")

Write-Step "Installing project dependencies"
& npm ci

Write-Step "Applying database migrations"
& npx prisma migrate deploy

if ($Seed) {
  Write-Step "Seeding initial data"
  & npm run seed
}

Write-Step "Building Next.js application"
& npm run build

Write-Step "Starting or restarting PM2 process"
$env:NODE_ENV = "production"
$env:PORT = "$Port"
$process = Get-Pm2Process -Name $AppName
if ($process) {
  & pm2 restart $AppName --update-env
} else {
  & pm2 start ecosystem.config.cjs --only $AppName
}
& pm2 save

if (-not $SkipStartup) {
  Write-Step "Configuring PM2 startup"
  Ensure-Pm2Startup
  if (Test-IsAdmin) {
    & pm2-startup install
    & pm2 save
  } else {
    Write-Warning "Run this script once as Administrator to enable startup persistence, or rerun with -SkipStartup."
  }
}

Write-Host ""
Write-Host "Deployment finished." -ForegroundColor Green
Write-Host "App:      $AppName"
Write-Host "Path:     $AppDir"
Write-Host "Branch:   $Branch"
Write-Host "URL:      http://127.0.0.1:$Port"
