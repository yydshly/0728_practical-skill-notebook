[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $env:USERPROFILE ".codex\skills\.system\skill-installer\scripts\install-skill-from-github.py"
$installRoot = Join-Path $env:USERPROFILE ".codex\skills"
$selectionPath = Join-Path $projectRoot "config\selected-skills.json"

if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  Write-Error "Official Skill Installer not found: $installer"
  exit 1
}

Push-Location $projectRoot
try {
  $selection = Get-Content -LiteralPath $selectionPath -Raw | ConvertFrom-Json
  $missingSourcePaths = @()
  $blockedNames = @()

  foreach ($skill in $selection.skills) {
    $skillDirectory = Join-Path $installRoot $skill.name
    $skillManifest = Join-Path $skillDirectory "SKILL.md"

    if (Test-Path -LiteralPath $skillManifest -PathType Leaf) {
      Write-Host "Existing skill preserved without overwrite: $($skill.name)"
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
    Write-Host "Installing $($missingSourcePaths.Count) missing skills with the official installer."
    & python $installer --repo MengTo/Skills --ref main --path $missingSourcePaths
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } else {
    Write-Host "All selected skills already contain SKILL.md; no existing directory was overwritten."
  }

  & node scripts/check-selected-skills.mjs
  if ($LASTEXITCODE -ne 0 -or $blockedNames.Count -gt 0) {
    exit 1
  }
} finally {
  Pop-Location
}
