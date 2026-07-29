[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $env:USERPROFILE ".codex\skills\.system\skill-installer\scripts\install-skill-from-github.py"
$installRoot = Join-Path $env:USERPROFILE ".codex\skills"
$selectionPath = Join-Path $projectRoot "config\selected-skills.json"
$lockPath = Join-Path $projectRoot "config\skill-source-lock.json"
$sourceRoot = Join-Path $projectRoot "skills-source\MengTo-Skills"

function Get-ChildRelativePath {
  param(
    [Parameter(Mandatory = $true)][string]$Parent,
    [Parameter(Mandatory = $true)][string]$Child
  )

  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd("\", "/")
  $childFull = [System.IO.Path]::GetFullPath($Child)
  if (
    $childFull.Length -le $parentFull.Length -or
    -not $childFull.StartsWith(
      "$parentFull\",
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "Path is not a child of the approved root: $childFull"
  }
  return $childFull.Substring($parentFull.Length + 1)
}

function Get-DirectoryFingerprint {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    return $null
  }

  $records = Get-ChildItem -LiteralPath $Path -File -Recurse |
    Sort-Object FullName |
    ForEach-Object {
      $relative = (Get-ChildRelativePath -Parent $Path -Child $_.FullName).Replace("\", "/")
      $hash = Get-CanonicalFileHash -Path $_.FullName
      "$relative`:$hash"
    }
  $payload = [System.Text.Encoding]::UTF8.GetBytes(($records -join "`n"))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($payload))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-CanonicalFileHash {
  param([Parameter(Mandatory = $true)][string]$Path)

  [byte[]]$bytes = [System.IO.File]::ReadAllBytes($Path)
  $textExtensions = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
  )
  foreach ($extension in @(
    ".bat", ".cjs", ".cmd", ".css", ".csv", ".htm", ".html",
    ".ini", ".js", ".json", ".jsx", ".md", ".mjs", ".ps1",
    ".psm1", ".py", ".sh", ".svg", ".toml", ".ts", ".tsx",
    ".txt", ".xml", ".yaml", ".yml"
  )) {
    [void]$textExtensions.Add($extension)
  }

  if ($textExtensions.Contains([System.IO.Path]::GetExtension($Path))) {
    try {
      $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
      $text = $strictUtf8.GetString($bytes)
      $canonicalText = $text.Replace("`r`n", "`n").Replace("`r", "`n")
      $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($canonicalText)
    } catch [System.Text.DecoderFallbackException] {
      # A file with a text-looking extension but invalid UTF-8 remains binary.
    }
  }

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  Write-Error "Official Skill Installer not found: $installer"
  exit 1
}

Push-Location $projectRoot
try {
  $selection = Get-Content -LiteralPath $selectionPath -Raw | ConvertFrom-Json
  $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
  if (
    $lock.repository -ne "https://github.com/MengTo/Skills.git" -or
    $lock.commit -notmatch "^[0-9a-f]{40}$"
  ) {
    Write-Error "Skill source lock is invalid: $lockPath"
    exit 1
  }
  if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    Write-Error "Pinned skill source checkout is missing: $sourceRoot"
    exit 1
  }

  $actualCommit = (& git -C $sourceRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $actualCommit -ne $lock.commit) {
    Write-Error "Pinned skill source HEAD drifted: actual $actualCommit; locked $($lock.commit)"
    exit 1
  }
  $sourceStatus = @(
    & git -C $sourceRoot status --porcelain=v1 --untracked-files=all
  )
  $sourceStatusExit = $LASTEXITCODE
  if (
    $sourceStatusExit -ne 0 -or
    ($sourceStatus | Where-Object { $_.Trim().Length -gt 0 }).Count -gt 0
  ) {
    Write-Error "Pinned skill source checkout is dirty; installation requires the clean locked commit."
    exit 1
  }
  $repositoryRoot = (& git -C $projectRoot rev-parse --show-toplevel).Trim()
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Unable to resolve the repository root for gitlink validation."
    exit 1
  }
  $gitlinkPath = (
    Get-ChildRelativePath -Parent $repositoryRoot -Child $sourceRoot
  ).Replace("\", "/")
  $gitlinkEntry = (& git -C $repositoryRoot ls-tree HEAD -- $gitlinkPath).Trim()
  $gitlinkMatch = [regex]::Match(
    $gitlinkEntry,
    "^160000 commit ([0-9a-f]{40})`t"
  )
  if (-not $gitlinkMatch.Success -or $gitlinkMatch.Groups[1].Value -ne $lock.commit) {
    $actualGitlink = if ($gitlinkMatch.Success) {
      $gitlinkMatch.Groups[1].Value
    } else {
      "missing"
    }
    Write-Error "Pinned skill source gitlink drifted: actual $actualGitlink; locked $($lock.commit)"
    exit 1
  }

  $missingSourcePaths = @()
  $blockedNames = @()
  $driftedNames = [System.Collections.Generic.HashSet[string]]::new()

  foreach ($skill in $selection.skills) {
    $sourceDirectory = Join-Path $sourceRoot $skill.sourcePath
    $sourceManifest = Join-Path $sourceDirectory "SKILL.md"
    if (-not (Test-Path -LiteralPath $sourceManifest -PathType Leaf)) {
      Write-Error "Approved pinned skill source is incomplete: $sourceDirectory"
      $blockedNames += $skill.name
      continue
    }

    $skillDirectory = Join-Path $installRoot $skill.name
    $skillManifest = Join-Path $skillDirectory "SKILL.md"

    if (Test-Path -LiteralPath $skillManifest -PathType Leaf) {
      if (
        (Get-DirectoryFingerprint -Path $sourceDirectory) -ne
        (Get-DirectoryFingerprint -Path $skillDirectory)
      ) {
        [void]$driftedNames.Add($skill.name)
        Write-Warning "Installed skill drift detected: $($skill.name). Existing copy preserved without overwrite."
      } else {
        Write-Host "Installed skill matches the pinned source: $($skill.name)"
      }
      continue
    }

    if (Test-Path -LiteralPath $skillDirectory) {
      Write-Error "Refusing to overwrite incomplete existing skill directory: $skillDirectory"
      $blockedNames += $skill.name
      continue
    }

    $missingSourcePaths += $skill.sourcePath
  }

  if ($missingSourcePaths.Count -gt 0) {
    Write-Host "Installing $($missingSourcePaths.Count) missing skills from locked commit $($lock.commit)."
    & python $installer --repo MengTo/Skills --ref $lock.commit --path $missingSourcePaths
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } else {
    Write-Host "All selected skills already contain SKILL.md; no existing directory was overwritten."
  }

  foreach ($skill in $selection.skills) {
    $sourceDirectory = Join-Path $sourceRoot $skill.sourcePath
    $skillDirectory = Join-Path $installRoot $skill.name
    $skillManifest = Join-Path $skillDirectory "SKILL.md"
    if (-not (Test-Path -LiteralPath $skillManifest -PathType Leaf)) {
      Write-Error "Installed skill is missing SKILL.md: $($skill.name)"
      $blockedNames += $skill.name
      continue
    }
    if (
      (Get-DirectoryFingerprint -Path $sourceDirectory) -ne
      (Get-DirectoryFingerprint -Path $skillDirectory)
    ) {
      if ($driftedNames.Add($skill.name)) {
        Write-Warning "Installed skill drift detected: $($skill.name). Existing copy preserved without overwrite."
      }
    }
  }

  & node scripts/check-selected-skills.mjs
  if (
    $LASTEXITCODE -ne 0 -or
    $blockedNames.Count -gt 0 -or
    $driftedNames.Count -gt 0
  ) {
    exit 1
  }
} finally {
  Pop-Location
}
