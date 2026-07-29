# 《雾村：逃离》Git 迁移与 README 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将固定源提交中的《雾村：逃离》提取为外层项目库的顶级项目，保留可追溯 Git 历史，补齐详细 README、参考来源和第三方声明，并把验证通过的迁移分支推送到项目库远端。

**Architecture:** 使用 `git subtree split` 从内层研究仓库的固定提交中生成只包含 `rural-mutation-escape/` 的过滤历史，再以非 squash `git subtree add` 导入外层隔离 worktree。导入后以项目级 README、独立来源文档和第三方声明建立文档边界，并用 Node 元数据测试、Git 树对象校验、项目测试和构建共同验证结果。

**Tech Stack:** Git subtree、PowerShell、Node.js 内置测试运行器、Three.js 0.180.0、Vite 7.3.6、Playwright 1.62.0、Web Audio API、可选 FFmpeg/FFprobe。

## Global Constraints

- 所有外层仓库写入只在 `D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration` 和分支 `codex/rural-mutation-escape-migration` 中进行。
- 源仓库固定为 `D:\codex_project_work\0728_some_github\claude-of-duty-research`，源分支为 `codex/rural-dynamic-bgm`，源提交为 `3f7041737d1d6ba09435e622a14482de7b5c7818`。
- 源前缀和目标前缀都固定为 `rural-mutation-escape/`；目标目录不得包含 `.git/` 或 gitfile。
- 固定源提交中的项目树哈希为 `e8058b3abe1049d202f0ef2e714dedf8a41e8125`，跟踪文件数为 68，项目相关源历史为 67 个提交。
- 使用非 squash subtree 导入；不得退化为文件复制、单次快照提交或 Git 子模块。
- 不修改或删除内层研究克隆的工作树、对象库、refs、远端地址或未跟踪试听草稿；split 只在 `C:\tmp` 的无硬链接临时克隆中执行。
- 不混入外层主工作区已有的 `README.md` 修改、`.superpowers/`、`test-results/` 或其他未提交内容。
- 不导入上游 FPS 根目录、武器、角色、关卡、纹理、音频或商业游戏素材。
- 不提交 `node_modules/`、`dist/`、Playwright 临时输出、本地缓存或本机工具路径。
- 不提交未完成真人试听的 `docs/superpowers/validation/2026-07-29-rural-mutation-escape-dynamic-bgm-listening.md` 草稿。
- README 必须明确区分当前可运行原型与尚未实现的核心逃生闭环，不得把失败、检查点、感知 AI、动态南门或完成后停机写成已完成功能。
- 上游研究对象固定为 `https://github.com/mshumer/Claude-of-Duty`，基准提交为 `d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853`，上游许可证为 MIT。
- 本次迁移不替《雾村：逃离》选择整体许可证；第三方声明只记录已核实依赖和参考来源。
- 验证通过后只推送 `codex/rural-mutation-escape-migration`，不直接覆盖或合并 `main`。

---

## File Responsibility Map

- `rural-mutation-escape/`: subtree 导入后的普通项目目录；承载固定源提交的 68 个文件和过滤历史。
- `C:\tmp\rural-mutation-escape-export-3f704173\`: 只在迁移期间存在的本地临时克隆；承载 split 对象和 export ref，避免写入内层研究仓库。
- `rural-mutation-escape/README.md`: 面向开发者和研究者的完整入口；准确说明现状、操作、命令、架构、来源、限制和路线。
- `rural-mutation-escape/docs/REFERENCES.md`: 固定上游参考、实际借鉴方法、独立实现边界和素材来源。
- `rural-mutation-escape/docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md`: 明确记录核心闭环尚未实施和当前验证证据边界，提供 README 可解析的验证状态链接。
- `rural-mutation-escape/THIRD_PARTY_NOTICES.md`: 列出研究参考、运行依赖、开发工具和可选离线工具的许可证事实。
- `rural-mutation-escape/.gitignore`: 只排除项目本地依赖、构建和临时输出，不排除已选择提交的音频源和浏览器证据。
- `tests/rural-mutation-escape-migration.test.mjs`: 自动检查迁移目录、README 完整性、来源事实、第三方声明、链接和忽略规则。
- `README.md`: 将《雾村：逃离》登记为第 06 个顶级案例，并提供项目入口、来源说明和运行命令。
- `.gitignore`: 将根级 `artifacts/` 收窄为 `/artifacts/`，并忽略本地研究克隆 `/claude-of-duty-research/`。

---

### Task 1: 提取并非 squash 导入固定项目历史

**Files:**
- Create through subtree import: `rural-mutation-escape/` and its 68 tracked source files
- Create temporarily outside the repository: `C:\tmp\rural-mutation-escape-export-3f704173\`
- Preserve unchanged: `D:\codex_project_work\0728_some_github\claude-of-duty-research\`
- Preserve unchanged: `D:\codex_project_work\0728_some_github\README.md` in the main worktree

**Interfaces:**
- Consumes: source commit `3f7041737d1d6ba09435e622a14482de7b5c7818`, prefix `rural-mutation-escape/`, expected tree `e8058b3abe1049d202f0ef2e714dedf8a41e8125`.
- Produces: temporary-clone ref `refs/heads/codex/rural-mutation-escape-export-3f704173`, a reachable 67-commit filtered history, and target prefix `rural-mutation-escape/` whose imported tree initially equals the fixed source tree.

- [ ] **Step 1: Verify both Git contexts before writing refs**

Run from the outer migration worktree:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
$SourceWorktree = 'D:\codex_project_work\0728_some_github\claude-of-duty-research\.worktrees\dynamic-bgm'
$SourceSafe = 'D:/codex_project_work/0728_some_github/claude-of-duty-research/.worktrees/dynamic-bgm'
$MainWorktree = 'D:\codex_project_work\0728_some_github'
$MainSafe = 'D:/codex_project_work/0728_some_github'
$ExportRepository = 'C:\tmp\rural-mutation-escape-export-3f704173'
$SourceCommit = '3f7041737d1d6ba09435e622a14482de7b5c7818'
$Prefix = 'rural-mutation-escape'
$GitExecutable = (Get-Command git -ErrorAction Stop).Source
$GitRoot = Split-Path (Split-Path $GitExecutable -Parent) -Parent
$GitBash = Join-Path $GitRoot 'bin\bash.exe'
$SnapshotDirectory = Join-Path $env:TEMP 'rural-mutation-escape-migration'

if (-not (Test-Path -LiteralPath $GitBash -PathType Leaf)) {
  throw "Git Bash not found at $GitBash"
}

$TargetBranch = git -c "safe.directory=$TargetSafe" -C $TargetWorktree branch --show-current
$TargetStatus = @(git -c "safe.directory=$TargetSafe" -C $TargetWorktree status --porcelain=v1 -uall)
$TargetRemote = git -c "safe.directory=$TargetSafe" -C $TargetWorktree remote get-url origin
$SourceBranch = git -c "safe.directory=$SourceSafe" -C $SourceWorktree branch --show-current
$SourceHead = git -c "safe.directory=$SourceSafe" -C $SourceWorktree rev-parse HEAD
$SourceStatus = @(git -c "safe.directory=$SourceSafe" -C $SourceWorktree status --porcelain=v1 -uall)
$ExpectedSourceStatus = @(
  '?? rural-mutation-escape/docs/superpowers/validation/2026-07-29-rural-mutation-escape-dynamic-bgm-listening.md'
)

if ($TargetBranch -ne 'codex/rural-mutation-escape-migration') {
  throw "Unexpected target branch: $TargetBranch"
}
if ($TargetStatus.Count -ne 0) {
  throw "Target worktree is dirty:`n$($TargetStatus -join "`n")"
}
if ($TargetRemote -ne 'https://github.com/yydshly/0728_practical-skill-notebook.git') {
  throw "Unexpected target origin: $TargetRemote"
}
if ($SourceBranch -ne 'codex/rural-dynamic-bgm' -or $SourceHead -ne $SourceCommit) {
  throw "Unexpected source state: $SourceBranch at $SourceHead"
}
if (@(Compare-Object $ExpectedSourceStatus $SourceStatus).Count -ne 0) {
  throw "Unexpected source worktree status:`n$($SourceStatus -join "`n")"
}
if (Test-Path -LiteralPath "$TargetWorktree\$Prefix") {
  throw "Target prefix already exists: $Prefix"
}
if (Test-Path -LiteralPath $ExportRepository) {
  throw "Temporary export repository already exists: $ExportRepository"
}

New-Item -ItemType Directory -Force -Path $SnapshotDirectory | Out-Null
$MainHeadBefore = git -c "safe.directory=$MainSafe" -C $MainWorktree rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'could not snapshot main HEAD' }
$MainStatusBefore = @(
  git -c "safe.directory=$MainSafe" -C $MainWorktree status --porcelain=v1 -uall
)
if ($LASTEXITCODE -ne 0) { throw 'could not snapshot main status' }
$SourceHeadBefore = git -c "safe.directory=$SourceSafe" -C $SourceWorktree rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'could not snapshot source HEAD' }
$SourceStatusBefore = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree status --porcelain=v1 -uall
)
if ($LASTEXITCODE -ne 0) { throw 'could not snapshot source status' }
$SourceRefsBefore = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
    for-each-ref --format='%(refname)%09%(objectname)' |
    Sort-Object
)
if ($LASTEXITCODE -ne 0) { throw 'could not snapshot source refs' }

$MainHeadBefore | Set-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\main-head-before.txt"
$MainStatusBefore | Set-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\main-status-before.txt"
$SourceHeadBefore | Set-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\source-head-before.txt"
$SourceStatusBefore | Set-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\source-status-before.txt"
$SourceRefsBefore | Set-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\source-refs-before.txt"
```

Expected:

- target branch is `codex/rural-mutation-escape-migration`;
- target status is clean before the import;
- target `origin` is `https://github.com/yydshly/0728_practical-skill-notebook.git`;
- source branch is `codex/rural-dynamic-bgm` and source HEAD is the fixed commit;
- source tracked and staged diffs are empty;
- the only source status entry is the exact untracked dynamic-BGM listening validation file;
- target prefix does not exist;
- the dedicated temporary export path does not exist;
- the separate dirty main worktree's HEAD/status and the source worktree's HEAD/status/ref map are saved under the system temporary directory for the final isolation check.

If the tracked source, target branch, remote, or fixed commit differs, stop without changing either repository. The known untracked listening draft is acceptable because every extraction command below reads the fixed commit object, not the working tree.

- [ ] **Step 2: Verify the fixed source tree contract**

Run:

```powershell
$SourceWorktree = 'D:\codex_project_work\0728_some_github\claude-of-duty-research\.worktrees\dynamic-bgm'
$SourceSafe = 'D:/codex_project_work/0728_some_github/claude-of-duty-research/.worktrees/dynamic-bgm'
$SourceCommit = '3f7041737d1d6ba09435e622a14482de7b5c7818'
$Prefix = 'rural-mutation-escape'
$ExpectedTree = 'e8058b3abe1049d202f0ef2e714dedf8a41e8125'
$ActualTree = git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
  rev-parse "${SourceCommit}:$Prefix"
$SourcePaths = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
    ls-tree -r --name-only $SourceCommit -- $Prefix
)
$SourceEntries = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
    ls-tree -r $SourceCommit -- $Prefix
)
$DraftInCommit = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
    ls-tree -r --name-only $SourceCommit -- `
    "$Prefix/docs/superpowers/validation/2026-07-29-rural-mutation-escape-dynamic-bgm-listening.md"
)

if ($ActualTree -ne $ExpectedTree) {
  throw "Unexpected source tree: $ActualTree"
}
if ($SourcePaths.Count -ne 68) {
  throw "Expected 68 tracked source files, got $($SourcePaths.Count)"
}
if ($DraftInCommit.Count -ne 0) {
  throw 'The unreviewed listening draft is present in the fixed source commit'
}
if ($SourceEntries -match '^160000 ') {
  throw 'The fixed source tree contains a gitlink'
}
if ($SourcePaths -match '(^|/)(\.git|node_modules|dist)(/|$)') {
  throw 'The fixed source tree contains a forbidden path'
}
```

Expected: no exception. This proves the extraction input contains 68 ordinary files and excludes gitlinks, `.git`, `node_modules/`, `dist/` and the untracked listening draft.

- [ ] **Step 3: Create the filtered split commit and export ref**

Clone the source repository locally without hardlinks so new objects and refs cannot mutate the research clone:

```powershell
$SourceRepository = 'D:\codex_project_work\0728_some_github\claude-of-duty-research'
$ExportRepository = 'C:\tmp\rural-mutation-escape-export-3f704173'
$ExportSafe = 'C:/tmp/rural-mutation-escape-export-3f704173'
$ExportPosix = '/c/tmp/rural-mutation-escape-export-3f704173'
$SourceCommit = '3f7041737d1d6ba09435e622a14482de7b5c7818'
$Prefix = 'rural-mutation-escape'
$ExportRef = 'refs/heads/codex/rural-mutation-escape-export-3f704173'
$GitExecutable = (Get-Command git -ErrorAction Stop).Source
$GitRoot = Split-Path (Split-Path $GitExecutable -Parent) -Parent
$GitBash = Join-Path $GitRoot 'bin\bash.exe'

git clone --no-hardlinks --no-checkout $SourceRepository $ExportRepository
if ($LASTEXITCODE -ne 0) {
  throw 'Could not create the isolated export clone'
}
git -c "safe.directory=$ExportSafe" -C $ExportRepository `
  cat-file -e "${SourceCommit}^{commit}"
if ($LASTEXITCODE -ne 0) {
  throw 'The fixed source commit is missing from the export clone'
}

# The installed git-subtree checks that --prefix exists in the temporary
# clone's working tree before it processes the supplied commit.  The clone is
# intentionally created with --no-checkout, so populate only the isolated
# clone at the fixed commit; do not check out or otherwise alter the source
# worktree.
git -c "safe.directory=$ExportSafe" -C $ExportRepository `
  checkout --detach $SourceCommit
if ($LASTEXITCODE -ne 0) {
  throw 'Could not check out the fixed source commit in the isolated export clone'
}
```

The current Windows installation does not launch `git subtree` correctly from PowerShell's `git.exe` wrapper. Invoke the verified Git Bash executable with `GIT_EXEC_PATH`, validate the returned commit, and create the export ref only inside the temporary clone:

```powershell
$ExportRepository = 'C:\tmp\rural-mutation-escape-export-3f704173'
$ExportSafe = 'C:/tmp/rural-mutation-escape-export-3f704173'
$ExportPosix = '/c/tmp/rural-mutation-escape-export-3f704173'
$SourceCommit = '3f7041737d1d6ba09435e622a14482de7b5c7818'
$Prefix = 'rural-mutation-escape'
$ExportRef = 'refs/heads/codex/rural-mutation-escape-export-3f704173'
$GitExecutable = (Get-Command git -ErrorAction Stop).Source
$GitRoot = Split-Path (Split-Path $GitExecutable -Parent) -Parent
$GitBash = Join-Path $GitRoot 'bin\bash.exe'
$SplitLines = & $GitBash -lc @"
GIT_EXEC_PATH=/mingw64/libexec/git-core \
git -c safe.directory=$ExportSafe \
-C $ExportPosix \
subtree split \
--prefix=$Prefix \
$SourceCommit
"@
if ($LASTEXITCODE -ne 0) {
  throw 'git subtree split failed'
}

$SplitCommit = @($SplitLines)[-1].Trim()
if ($SplitCommit -notmatch '^[0-9a-f]{40}$') {
  throw "Unexpected split commit: $SplitCommit"
}

$ExistingExport = git -c "safe.directory=$ExportSafe" -C $ExportRepository `
  rev-parse --verify --quiet "${ExportRef}^{commit}"
if ($LASTEXITCODE -eq 0) {
  if ($ExistingExport -ne $SplitCommit) {
    throw "Export ref exists at a different commit: $ExistingExport"
  }
} else {
  git -c "safe.directory=$ExportSafe" -C $ExportRepository update-ref `
    $ExportRef `
    $SplitCommit `
    '0000000000000000000000000000000000000000'
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not create export ref atomically'
  }
}
```

Do not use `subtree split -b`, `branch -f` or `update-ref` without the all-zero expected old object. The only persistent changes are inside the temporary clone; the source working tree, object database, refs and remotes remain untouched.

- [ ] **Step 4: Verify the filtered history before import**

Run:

```powershell
$SourceWorktree = 'D:\codex_project_work\0728_some_github\claude-of-duty-research\.worktrees\dynamic-bgm'
$SourceSafe = 'D:/codex_project_work/0728_some_github/claude-of-duty-research/.worktrees/dynamic-bgm'
$ExportRepository = 'C:\tmp\rural-mutation-escape-export-3f704173'
$ExportSafe = 'C:/tmp/rural-mutation-escape-export-3f704173'
$SourceCommit = '3f7041737d1d6ba09435e622a14482de7b5c7818'
$Prefix = 'rural-mutation-escape'
$ExportRef = 'refs/heads/codex/rural-mutation-escape-export-3f704173'
$ExpectedTree = 'e8058b3abe1049d202f0ef2e714dedf8a41e8125'
$SplitCommit = git -c "safe.directory=$ExportSafe" -C $ExportRepository `
  rev-parse "${ExportRef}^{commit}"
$SplitTree = git -c "safe.directory=$ExportSafe" -C $ExportRepository `
  rev-parse "${SplitCommit}^{tree}"
$SplitPaths = @(
  git -c "safe.directory=$ExportSafe" -C $ExportRepository `
    ls-tree -r --name-only $SplitCommit
)
$SplitEntries = @(
  git -c "safe.directory=$ExportSafe" -C $ExportRepository `
    ls-tree -r $SplitCommit
)
$SplitHistoryCount = [int](
  git -c "safe.directory=$ExportSafe" -C $ExportRepository `
    rev-list --count $SplitCommit
)
$SourceEntries = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
    ls-tree -r $SourceCommit -- $Prefix
)
$PrefixPattern = [regex]::Escape("`t$Prefix/")
$NormalizedSourceEntries = @(
  $SourceEntries |
    ForEach-Object { $_ -replace $PrefixPattern, "`t" } |
    Sort-Object
)
$NormalizedSplitEntries = @($SplitEntries | Sort-Object)
$EntryDelta = @(Compare-Object $NormalizedSourceEntries $NormalizedSplitEntries)

if ($SplitTree -ne $ExpectedTree) {
  throw "Split tree mismatch: $SplitTree"
}
if ($SplitPaths.Count -ne 68) {
  throw "Expected 68 split files, got $($SplitPaths.Count)"
}
if ($SplitHistoryCount -ne 67) {
  throw "Expected 67 filtered commits, got $SplitHistoryCount"
}
if ($EntryDelta.Count -ne 0) {
  throw 'Split mode/type/blob/path manifest differs from the fixed source subtree'
}
if ($SplitEntries -match '^160000 ') {
  throw 'Split history contains a gitlink'
}
if ($SplitPaths -match '(^|/)(\.git|node_modules|dist)(/|$)') {
  throw 'Split history contains a forbidden path'
}
if ($SplitPaths -match '^rural-mutation-escape/') {
  throw 'Split paths still contain the source prefix'
}
if ($SplitPaths -contains 'docs/superpowers/validation/2026-07-29-rural-mutation-escape-dynamic-bgm-listening.md') {
  throw 'Split history contains the unreviewed listening draft'
}
```

Expected: no exception. The split root begins with files such as `package.json`, `src/main.js`, `tests/unit.mjs`; its full mode/type/blob/path manifest equals the fixed source subtree and contains no upstream FPS root path.

- [ ] **Step 5: Add the split history as a non-squash subtree**

Use the same verified Git Bash route for the target linked worktree:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
$TargetPosix = '/d/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
$ExportRepositoryPosix = '/c/tmp/rural-mutation-escape-export-3f704173'
$ExportRef = 'refs/heads/codex/rural-mutation-escape-export-3f704173'
$Prefix = 'rural-mutation-escape'
$GitExecutable = (Get-Command git -ErrorAction Stop).Source
$GitRoot = Split-Path (Split-Path $GitExecutable -Parent) -Parent
$GitBash = Join-Path $GitRoot 'bin\bash.exe'
& $GitBash -lc @"
GIT_EXEC_PATH=/mingw64/libexec/git-core \
git -c safe.directory=$TargetSafe \
-C $TargetPosix \
subtree add \
--prefix=$Prefix \
--message="chore: import rural mutation escape history" \
$ExportRepositoryPosix \
$ExportRef
"@
if ($LASTEXITCODE -ne 0) {
  throw 'git subtree add failed'
}
```

Expected: Git creates one subtree merge commit. The command must not contain `--squash` and must not add a persistent remote.

- [ ] **Step 6: Prove the imported merge and tree**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
$SourceWorktree = 'D:\codex_project_work\0728_some_github\claude-of-duty-research\.worktrees\dynamic-bgm'
$SourceSafe = 'D:/codex_project_work/0728_some_github/claude-of-duty-research/.worktrees/dynamic-bgm'
$ExportRepository = 'C:\tmp\rural-mutation-escape-export-3f704173'
$ExportSafe = 'C:/tmp/rural-mutation-escape-export-3f704173'
$ExportRef = 'refs/heads/codex/rural-mutation-escape-export-3f704173'
$SourceCommit = '3f7041737d1d6ba09435e622a14482de7b5c7818'
$Prefix = 'rural-mutation-escape'
$ExpectedTree = 'e8058b3abe1049d202f0ef2e714dedf8a41e8125'
$PrefixPattern = [regex]::Escape("`t$Prefix/")
$SourceEntries = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
    ls-tree -r $SourceCommit -- $Prefix
)
$NormalizedSourceEntries = @(
  $SourceEntries |
    ForEach-Object { $_ -replace $PrefixPattern, "`t" } |
    Sort-Object
)
$SplitCommit = git -c "safe.directory=$ExportSafe" -C $ExportRepository `
  rev-parse "${ExportRef}^{commit}"
$ImportCommit = git -c "safe.directory=$TargetSafe" -C $TargetWorktree rev-parse HEAD
$ImportedTree = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  rev-parse "${ImportCommit}:$Prefix"
$ImportedPaths = @(
  git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
    ls-tree -r --name-only $ImportCommit -- $Prefix
)
$ImportedEntries = @(
  git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
    ls-tree -r $ImportCommit -- $Prefix
)
$ImportParents = (
  git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
    rev-list --parents -n 1 $ImportCommit
).Split(' ')
$ImportedSplitParent = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  rev-parse "${ImportCommit}^2"
$ImportBody = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  show -s --format='%B' $ImportCommit
$NormalizedImportedEntries = @(
  $ImportedEntries |
    ForEach-Object { $_ -replace $PrefixPattern, "`t" } |
    Sort-Object
)
$ImportDelta = @(Compare-Object $NormalizedSourceEntries $NormalizedImportedEntries)

if ($ImportedTree -ne $ExpectedTree) {
  throw "Imported tree mismatch: $ImportedTree"
}
if ($ImportedPaths.Count -ne 68) {
  throw "Expected 68 imported files, got $($ImportedPaths.Count)"
}
if ($ImportParents.Count -ne 3) {
  throw 'The subtree import is not a two-parent merge commit'
}
if ($ImportedSplitParent -ne $SplitCommit) {
  throw 'The import second parent is not the verified split commit'
}
if ($ImportDelta.Count -ne 0) {
  throw 'Imported mode/type/blob/path manifest differs from the fixed source subtree'
}
if ($ImportBody -notcontains "git-subtree-dir: $Prefix") {
  throw 'Import commit is missing git-subtree-dir metadata'
}
if ($ImportBody -notcontains "git-subtree-split: $SplitCommit") {
  throw 'Import commit is missing git-subtree-split metadata'
}
if (Test-Path "$TargetWorktree\rural-mutation-escape\.git") {
  throw 'Nested Git metadata was imported'
}
```

Expected: tree hash `e8058b3abe1049d202f0ef2e714dedf8a41e8125`, 68 identical mode/type/blob/path entries, a two-parent subtree merge whose second parent is the split commit, both subtree metadata trailers and no nested `.git`.

The imported historical commits are rooted at the split project root, so `git log -- rural-mutation-escape` is not a valid count of all 67 old commits. Use the verified second parent with `git log --oneline $ImportedSplitParent`.

---

### Task 2: Add detailed project documentation and executable metadata checks

**Files:**
- Create: `tests/rural-mutation-escape-migration.test.mjs`
- Create: `rural-mutation-escape/README.md`
- Create: `rural-mutation-escape/docs/REFERENCES.md`
- Create: `rural-mutation-escape/docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md`
- Create: `rural-mutation-escape/THIRD_PARTY_NOTICES.md`
- Create: `rural-mutation-escape/.gitignore`

**Interfaces:**
- Consumes: imported project files, package scripts, current four-objective runtime, existing core-loop design and plan.
- Produces: a self-contained project entry point, pinned provenance facts, license notices, safe local ignore rules and `node --test tests/rural-mutation-escape-migration.test.mjs`.

- [ ] **Step 1: Write the failing project-documentation test**

Create `tests/rural-mutation-escape-migration.test.mjs`:

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const projectRoot = path.join(repoRoot, "rural-mutation-escape");

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing: ${value}`);
  }
}

async function assertLocalLinksResolve(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const markdown = await readFile(absolutePath, "utf8");
  const links = [...markdown.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/g)];
  for (const [, target] of links) {
    await access(path.resolve(path.dirname(absolutePath), target));
  }
}

test("subtree target is an ordinary runnable project directory", async () => {
  await access(path.join(projectRoot, "package.json"));
  await access(path.join(projectRoot, "src", "main.js"));
  await access(path.join(projectRoot, "audio-source", "manifest.json"));
  await assert.rejects(
    access(path.join(projectRoot, ".git")),
    (error) => error?.code === "ENOENT",
  );
});

test("project README is complete and distinguishes shipped from planned behavior", async () => {
  const readme = await read("rural-mutation-escape/README.md");
  assertIncludesAll(readme, [
    "# 《雾村：逃离》",
    "## 当前状态",
    "## 当前可玩内容与尚未实现范围",
    "## 桌面操作",
    "## 安装与运行",
    "## 测试、音频与构建",
    "## 目录结构",
    "## 技术方案",
    "## 参考来源、原创性与许可边界",
    "## 已知限制",
    "## 核心闭环研究文档",
    "## 非官方声明",
    "W/A/S/D",
    "Shift",
    "鼠标左键",
    "C",
    "E",
    "声音按钮",
    "npm.cmd install",
    "npm.cmd ci",
    "npm.cmd run dev",
    "npm.cmd run test:unit",
    "npm.cmd run test:audio",
    "npm.cmd test",
    "npm.cmd run audio:verify",
    "npm.cmd run build",
    "数据驱动村庄",
    "共享角色碰撞",
    "第一/第三人称镜头",
    "目标、故事与引导",
    "追逐与危险反馈",
    "Web Audio 动态音乐",
    "Node 与 Playwright",
    "当前版本尚未实现",
    "| 领域 | 当前已经实现 | 当前未实现或本轮不包含 |",
    "失败/重试",
    "检查点",
    "视野与听觉感知 AI",
    "持续交互开启的南门",
    "核心闭环验证状态",
    "非官方",
  ], "project README");
  await assertLocalLinksResolve("rural-mutation-escape/README.md");
  const validationStatus = await read(
    "rural-mutation-escape/docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md",
  );
  assertIncludesAll(validationStatus, [
    "状态：尚未执行",
    "不是核心闭环已经完成的证据",
    "失败与重试",
    "检查点恢复",
    "感知 AI",
    "动态南门",
    "真实浏览器完整路线",
  ], "core-loop validation status");
});

test("reference document pins the upstream and the independent implementation boundary", async () => {
  const references = await read("rural-mutation-escape/docs/REFERENCES.md");
  assertIncludesAll(references, [
    "https://github.com/mshumer/Claude-of-Duty",
    "d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853",
    "MIT",
    "Three.js/WebGL",
    "程序化几何",
    "浏览器证据",
    "设计契约、测试与 Git 提交历史",
    "未复制",
    "武器",
    "纹理",
    "音频",
    "scripts/rural-score-core.mjs",
    "audio-source/manifest.json",
    "FFmpeg",
    "不随本项目分发",
  ], "reference document");
});

test("third-party notices state verified licenses without selecting a project license", async () => {
  const notices = await read("rural-mutation-escape/THIRD_PARTY_NOTICES.md");
  assertIncludesAll(notices, [
    "mshumer/Claude-of-Duty",
    "Three.js",
    "0.180.0",
    "Vite",
    "7.3.6",
    "Playwright",
    "1.62.0",
    "Apache-2.0",
    "FFmpeg/FFprobe",
    "不决定《雾村：逃离》的整体许可证",
  ], "third-party notices");
});

test("project ignore rules retain selected evidence and audio provenance", async () => {
  const lines = (await read("rural-mutation-escape/.gitignore"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const expected of [
    "node_modules/",
    "dist/",
    "playwright-report/",
    "test-results/",
    ".tmp/",
    ".cache/",
  ]) {
    assert.ok(lines.includes(expected), `.gitignore is missing ${expected}`);
  }
  assert.ok(!lines.includes("artifacts/"), "project artifacts must remain trackable");
  assert.ok(!lines.includes("audio-source/"), "audio provenance must remain trackable");
});
```

- [ ] **Step 2: Run the test and verify the documentation contract fails**

Run from the outer migration worktree:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
Push-Location $TargetWorktree -ErrorAction Stop
try {
  & node --test tests/rural-mutation-escape-migration.test.mjs
  $ExpectedFailureExit = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($ExpectedFailureExit -eq 0) {
  throw 'Documentation contract unexpectedly passed before the documents existed'
}
```

Expected: FAIL because the project README, validation status, reference document, third-party notices and project `.gitignore` do not yet exist. A syntax error in the test is not the expected failure and must be corrected before continuing.

- [ ] **Step 3: Create the detailed project README**

Create `rural-mutation-escape/README.md` with this content:

````markdown
# 《雾村：逃离》

一个以黄昏农村、居民躲藏和突发变异为背景的桌面浏览器第三人称逃生序章原型；当前版本可完成一条四步线性调查路线，但还不是包含失败与重试的完整游戏。

## 当前状态

项目用于研究“从地图定义、场景搭建、角色与碰撞，到任务、追逐、引导和动态音乐”的可复现 Web 游戏开发流程。运行时使用 Three.js 和原生 JavaScript，角色、建筑、道路、植被、道具与灯光均由项目代码程序化构建。

当前固定版本可以从主角家出发，调查收音机、寻找躲藏的邻居、取得粮仓旁的手电，并抵达南门完成序章。它更接近一段可玩的垂直切片，而非内容完整的商业游戏。

## 当前可玩内容与尚未实现范围

| 领域 | 当前已经实现 | 当前未实现或本轮不包含 |
| --- | --- | --- |
| 故事流程 | 收音机 → 邻居 → 手电 → 南门出口圈的四步线性目标与字幕 | 核心闭环已规划正式变异揭示、失败恢复和重复游玩；分支叙事不在本轮范围 |
| 玩家 | WASD 移动、冲刺、交互、第一/第三人称切换、程序化步行动画 | 战斗、武器、血量和背包不在本轮范围；手柄和移动端触控尚未支持 |
| 敌人 | 单个变异体巡逻；基于距离的 `patrol/chase/threaten/lost` 状态；共享静态碰撞 | 核心闭环已规划视野/听觉、遮挡、记忆、攻击前摇和捕获；不规划敌人死亡系统 |
| 地图与碰撞 | 数据驱动的村庄边界、建筑、院墙、路障和路灯杆；玩家与追逐者共用 box/circle 碰撞 | 导航图寻路、动态门碰撞、玩家与敌人的实体互斥 |
| 南门 | 目标锚点、静态门景物和进入出口半径后的章节完成 | 需要持续交互开启的南门、开门动画、门外单向结算线和最终追逐 |
| UI 与引导 | 任务卡、罗盘与距离、世界/屏幕标记、靠近提示、顺序教程、危险反馈、声音按钮 | 核心闭环已规划失败层、确定性检查点重试、常驻结算层和重新游玩；开始/暂停菜单与检查点选择器不在本轮范围 |
| 音频 | 探索循环、危险层、揭示/逃离短句、交互提示和心跳；手势解锁、静音与页面生命周期 | 捕获、重试和动态开门流程对应的新语义音频 |

核心闭环规划中的失败/重试、三个检查点、视野与听觉感知 AI、真实捕获流程、持续交互开启的南门、动态门碰撞、穿门结算和完成后停机，当前版本尚未实现。设计与实施计划存在不代表运行时代码已经完成。

## 桌面操作

| 输入 | 作用 |
| --- | --- |
| `W/A/S/D` | 按镜头方向移动 |
| `Shift` | 冲刺 |
| 鼠标左键按住游戏画面并移动 | 环顾；浏览器允许时会尝试锁定指针，否则保持拖动回退 |
| `C` | 切换第一/第三人称镜头 |
| 靠近当前目标后按 `E` | 调查收音机、询问邻居或拾取手电 |
| 右上角声音按钮 | 解锁、开启或静音游戏声音 |

只移动鼠标而不按住画面不会旋转镜头。`Esc` 只可能由浏览器用于释放指针锁定；当前游戏没有暂停菜单。

## 安装与运行

需要近期 Node.js/npm 和支持 WebGL、Web Audio 的桌面浏览器。

```powershell
cd rural-mutation-escape
npm.cmd install
npm.cmd run dev
```

打开 Vite 输出的本地地址。声音受浏览器自动播放策略限制，首次进入后按任意游戏键、点击画面或点击声音按钮完成可信手势解锁。

自动化或发布验收需要严格使用锁文件时，使用 `npm.cmd ci` 代替 `npm.cmd install`。

## 测试、音频与构建

```powershell
npm.cmd run test:unit
npm.cmd run test:audio
npm.cmd test
npm.cmd run build
```

- `test:unit`：碰撞、相机、目标、引导、敌人状态、音频状态等 Node 单元测试。
- `test:audio`：校验音频 manifest、文件元数据和内容哈希。
- `test`：依次运行单元测试、音频测试和 Playwright 浏览器 smoke。首次运行浏览器测试的环境若没有 Chromium，可执行 `npx.cmd playwright install chromium`。
- `build`：生成 Vite 生产构建到本地 `dist/`；该目录不提交。

动态音乐的离线流水线：

```powershell
npm.cmd run audio:render
npm.cmd run audio:encode
npm.cmd run audio:build
npm.cmd run audio:verify
```

`audio:render` 使用确定性脚本生成 WAV 母带和 manifest；编码与验证需要用户自行安装的 FFmpeg/FFprobe。可通过 `RURAL_SCORE_FFMPEG` 和 `RURAL_SCORE_FFPROBE` 指向可执行文件。项目不分发 FFmpeg。

## 目录结构

```text
rural-mutation-escape/
├─ index.html                     # 游戏页面和 HUD 容器
├─ package.json                   # 运行、测试、音频与构建脚本
├─ src/
│  ├─ main.js                     # 浏览器装配、输入与逐帧循环
│  ├─ level-data.js               # 地图边界、锚点、区域、碰撞体和导航点
│  ├─ level.js                    # 场景构建与地图对象汇总
│  ├─ world/                      # 建筑、材质和农村道具
│  ├─ player.js                   # 玩家移动
│  ├─ characters.js               # 程序化拟人角色与变异体
│  ├─ collision.js                # box/circle 共享碰撞求解
│  ├─ camera*.js                  # 第一/第三人称、遮挡和指针输入
│  ├─ story.js / objectives.js    # 线性故事状态与目标定义
│  ├─ guidance.js / ui.js         # 导航、提示、HUD 与声音控件
│  ├─ pursuer.js / danger.js      # 距离追逐和危险反馈
│  ├─ audio-*.js                  # Web Audio 反馈与生命周期
│  ├─ music-director.js           # 动态音乐层和叙事短句调度
│  └─ assets/audio/               # 运行时 OGG/MP3
├─ scripts/                       # 原创配乐生成、编码和验证
├─ audio-source/                  # WAV 母带和可追溯 manifest
├─ tests/                         # Node、音频和 Playwright 验证
├─ artifacts/                     # 选定提交的浏览器视觉证据
└─ docs/                          # 设计、计划、来源和验证记录
```

## 技术方案

### 数据驱动村庄

`src/level-data.js` 集中定义地图边界、故事锚点、区域、建筑、道路、灯光、道具碰撞体和巡逻节点；`src/level.js` 与 `src/world/` 将这些数据构造成 Three.js 场景。地图布局和渲染生成分离，便于以后替换地图而不重写任务和碰撞入口。

### 共享角色碰撞

`src/collision.js` 提供 box/circle 碰撞和滑动求解，`src/player.js` 与 `src/pursuer.js` 使用同一组由关卡数据生成的 actor colliders。建筑、院墙、路障和路灯杆会阻挡人物，镜头遮挡则只读取标记为 `blocksCamera` 的碰撞体。

### 第一/第三人称镜头

`src/camera.js`、`src/camera-math.js` 和 `src/camera-pointer-input.js` 负责跟随、视角切换、俯仰/偏航限制、第三人称墙体收缩和 pointer-lock/拖动回退。移动方向与相机偏航一致。

### 目标、故事与引导

`src/objectives.js` 定义四个目标及锚点，`src/story.js` 只处理顺序 flag 和目标转换；`src/guidance.js`、`src/world-marker.js`、`src/tutorial.js` 与 `src/ui.js` 派生任务卡、罗盘、距离、世界标记、交互提示和教程。

### 追逐与危险反馈

`src/pursuer.js` 当前是单敌人的距离状态机，并沿少量导航点巡逻；`src/danger.js` 根据追逐状态和距离输出危险标签、画面强度与心跳速度。它不是带遮挡、听觉和记忆的完整感知 AI。

### Web Audio 动态音乐

`src/music-director.js` 同步探索与危险循环并调度揭示/逃离短句；`src/audio-feedback.js` 合成交互提示与心跳；`src/audio-lifecycle.js` 处理可信手势、静音、页面隐藏和卸载。运行时优先 OGG、回退 MP3。

### Node 与 Playwright 验证

`tests/unit.mjs` 覆盖纯逻辑与状态，`tests/audio-assets.mjs` 校验音频资产，`tests/smoke.mjs` 在真实 Chromium 页面中验证控制、UI、镜头、碰撞、音频回退、视口和浏览器证据。

## 参考来源、原创性与许可边界

本项目研究参考了 [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty) 在固定提交 `d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853` 的工程组织方法；上游使用 MIT 许可证。借鉴范围限于模块化 Three.js/WebGL 结构、程序化几何可行性、可重复浏览器证据/性能基线，以及用设计契约、测试和 Git 历史驱动 AI 协作。

《雾村：逃离》的玩法、农村地图、故事、镜头、拟人角色、UI、碰撞和音频流水线为本项目独立实现。项目未复制上游 FPS 的武器、角色、关卡、纹理、音频或商业游戏素材，也不是上游的官方版本或续作。详细边界见 [参考来源说明](./docs/REFERENCES.md) 和 [第三方声明](./THIRD_PARTY_NOTICES.md)。

当前角色、建筑、道路、植被和道具由 Three.js 代码程序化生成。动态音乐由 `scripts/rural-score-core.mjs` 确定性创作；`audio-source/manifest.json` 记录生成参数、编码器信息、响度、文件大小和 SHA-256。若以后引入外部模型、纹理或音效，必须先更新本 README、参考来源说明和第三方声明。

本次迁移只记录第三方事实，不为《雾村：逃离》选择整体许可证。

## 已知限制

- 当前是桌面浏览器原型；窄屏只做界面显示验证，不代表移动端可玩。
- 敌人按距离发现玩家，可能被复杂障碍卡住；没有视线、声音、记忆或攻击系统。
- 进入南门出口半径会直接完成，门本身没有交互、动画和动态碰撞。
- 没有失败状态、检查点、可靠重试、暂停菜单或完成后冻结；章节完成后主循环仍继续运行。
- 玩家和敌人分别与静态世界碰撞，但彼此没有完整的实体碰撞响应。
- 程序化低多边形角色和场景用于验证流程，不代表最终美术品质。
- 音频需要可信用户手势；FFmpeg 只用于可选离线生成和测量。

## 核心闭环研究文档

- [核心闭环设计](./docs/superpowers/specs/2026-07-30-rural-mutation-escape-core-loop-design.md)
- [核心闭环实施计划](./docs/superpowers/plans/2026-07-30-rural-mutation-escape-core-loop.md)
- [核心闭环验证状态](./docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md)

设计与计划描述尚未落地的 2–4 分钟逃生闭环；验证状态文件明确记录当前证据边界。最终验收报告只会在计划的浏览器验收任务真正执行后生成于 `docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop.md`，不应将计划清单或“尚未执行”状态页视为完成功能。

其他实现历史可在 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 中查看，包括初始原型、视觉升级、共享电杆碰撞、任务引导和原创动态音乐。

## 非官方声明

《雾村：逃离》是独立研究原型，与 Activision、Call of Duty 品牌、`mshumer/Claude-of-Duty` 的作者或其他商业游戏权利人没有官方关联、认可、赞助或授权关系。第三方名称和商标仅用于准确说明研究参考与权利归属，相关权利归各自所有者。
````

- [ ] **Step 4: Create an honest core-loop validation status document**

Create `rural-mutation-escape/docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md`:

```markdown
# 《雾村：逃离》核心闭环验证状态

日期：2026-07-30
状态：尚未执行

## 当前结论

固定源提交 `3f7041737d1d6ba09435e622a14482de7b5c7818` 已包含可运行的四步线性序章、单元测试、音频资产测试和 Playwright 浏览器 smoke；这些证据只覆盖当前原型，不是核心闭环已经完成的证据。

以下能力只存在于已确认设计和实施计划中，当前运行时代码尚未具备：

- 捕获后的失败与重试；
- `home_start`、`courtyard_warning`、`granary_ready` 检查点恢复；
- 带遮挡、听觉和短期记忆的感知 AI；
- 动态南门：持续交互、动画和动态碰撞组成的开门流程；
- 穿门结算、完成后冻结和重新游玩；
- 使用真实浏览器完整路线完成的 2–4 分钟验收。

## 关联文档

- [核心闭环设计](../specs/2026-07-30-rural-mutation-escape-core-loop-design.md)
- [核心闭环实施计划](../plans/2026-07-30-rural-mutation-escape-core-loop.md)

## 何时可以更新状态

只有在实施计划中的状态机、检查点、感知 AI、追逐捕获、动态南门、UI/音频集成和浏览器验收全部完成，并保存失败、揭示、开门、完成四类真实证据后，才能把状态改为“已验证”。最终结果记录使用 `2026-07-30-rural-mutation-escape-core-loop.md`，并写明测试输出、浏览器版本、视口、路线、性能和人工体验结论。
```

- [ ] **Step 5: Create the detailed reference document**

Create `rural-mutation-escape/docs/REFERENCES.md`:

```markdown
# 《雾村：逃离》参考来源与独立实现边界

## 目的

本文固定记录项目研究了什么、实际借鉴了哪些方法、没有复制哪些代码或资产，以及当前程序化场景和音频如何追溯。它不是整体项目许可证，也不替代第三方自己的许可证文本。

## 上游研究对象

- 仓库：<https://github.com/mshumer/Claude-of-Duty>
- 固定基准提交：`d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853`
- 上游许可证：MIT
- 本项目迁移源提交：`3f7041737d1d6ba09435e622a14482de7b5c7818`

固定提交让研究结论可以复核，避免上游后续变化改变本项目所描述的参考范围。

## 实际借鉴的方法

1. Three.js/WebGL 浏览器游戏按场景、角色、镜头、输入、UI 和运行时职责进行模块化拆分。
2. 以程序化几何、材质和灯光快速建立可游玩的视觉基线。
3. 保存可重复浏览器证据、截图回归和性能基线，而不是只凭文字声称效果完成。
4. 使用设计契约、测试与 Git 提交历史驱动 AI 辅助协作，并让决策和修复可追溯。

这些是工程方法参考，不是对上游 FPS 内容的移植。

## 与上游的差异

《雾村：逃离》围绕中国农村黄昏、居民躲藏、变异发现和逃出村庄构建第三人称叙事原型。它具有独立的农村地图数据、四步故事目标、第一/第三人称镜头、拟人程序化角色、共享碰撞、任务引导、追逐危险反馈和原创动态音乐流水线。

上游研究对象是不同主题和结构的 FPS 项目。本项目未复制或导入其：

- 武器、射击、命中或战斗子系统；
- 玩家、敌人或 NPC 模型与角色代码；
- 关卡布局、任务、剧情或 UI；
- 纹理、音频、徽标、品牌元素或其他商业游戏素材；
- 仓库根目录源代码和构建产物。

迁移只提取内层仓库中本项目自己的 `rural-mutation-escape/` 历史。

## 本项目内容来源

### 程序化视觉

当前人物、变异体、建筑、道路、围墙、路灯杆、植被和道具由 `src/` 中的 Three.js 代码程序化构建。已提交视觉证据位于 `artifacts/`，用于证明本项目版本的浏览器效果，不是上游资产副本。

### 文本与故事

《雾村：逃离》的项目名称、农村故事前提、目标文案、字幕和 UI 文本为本项目创作。它不使用《Call of Duty》或其他商业游戏的剧情、角色名称或品牌表达。

### 原创动态音乐

`scripts/rural-score-core.mjs` 以固定种子和确定性参数生成探索循环、危险层、变异揭示短句和南门逃离短句。`audio-source/manifest.json` 记录原创来源声明、生成器版本、采样参数、响度测量、编码器版本、文件大小和 SHA-256。`audio-source/masters/` 中的 WAV 与 `src/assets/audio/` 中的 OGG/MP3 来自同一流水线。

FFmpeg/FFprobe 只用于用户本地的离线编码和测量，不随本项目分发。其许可证取决于用户自行安装的具体构建。

## 第三方依赖

运行和开发依赖的版本与许可证摘要见项目根目录的 `THIRD_PARTY_NOTICES.md`。依赖声明不决定《雾村：逃离》的整体许可证。

## 更新规则

后续若引入外部模型、纹理、字体、音效、音乐或代码，必须先记录来源 URL、固定版本或提交、许可证、使用范围和本地文件，再提交相应资产；同时更新本文件、项目 README 和 `THIRD_PARTY_NOTICES.md`。

## 非关联声明

本项目不是 `mshumer/Claude-of-Duty`、Activision、Call of Duty 或其他商业游戏权利人的官方版本、续作、授权改编或受认可产品。名称和商标仅用于准确描述研究对象，相关权利归各自所有者。
```

- [ ] **Step 6: Create third-party notices without selecting an overall project license**

Create `rural-mutation-escape/THIRD_PARTY_NOTICES.md`:

```markdown
# Third-Party Notices

本文件记录《雾村：逃离》当前已核实的研究参考、运行依赖、开发工具和可选离线工具。它不替代各项目自己的许可证文本，也不决定《雾村：逃离》的整体许可证。

## mshumer/Claude-of-Duty

- 用途：工程方法研究参考，不作为运行时依赖。
- 仓库：<https://github.com/mshumer/Claude-of-Duty>
- 固定参考提交：`d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853`
- 许可证：MIT
- 边界：未复制上游 FPS 的武器、角色、关卡、纹理、音频或商业素材；详细说明见 `docs/REFERENCES.md`。

## Three.js 0.180.0

- 用途：WebGL 场景、几何、材质、灯光、相机和数学运行时。
- 项目：<https://github.com/mrdoob/three.js>
- 许可证：MIT

## Vite 7.3.6

- 用途：本地开发服务器和生产构建。
- 项目：<https://github.com/vitejs/vite>
- 许可证：MIT

## Playwright 1.62.0

- 用途：开发环境中的 Chromium 浏览器 smoke 和视觉/交互验收。
- 项目：<https://github.com/microsoft/playwright>
- 许可证：Apache-2.0

`package.json` 的范围为 `^1.61.1`，当前锁文件解析到 1.62.0；以 `package-lock.json` 为本次迁移的可复现版本依据。

## FFmpeg/FFprobe

- 用途：可选的离线 WAV 编码、OGG/MP3 生成、响度和媒体参数测量。
- 分发状态：本仓库不分发 FFmpeg 或 FFprobe 二进制文件。
- 许可证：取决于用户自行安装的具体构建及其启用组件；用户应查阅该构建随附的许可证信息。

## Overall project license

以上声明仅用于归属和合规追踪，不决定《雾村：逃离》的整体许可证。本次 Git 迁移不新增或推定项目级许可证。
```

- [ ] **Step 7: Add project-local ignore rules**

Create `rural-mutation-escape/.gitignore`:

```gitignore
node_modules/
dist/
playwright-report/
test-results/
.tmp/
.cache/
*.log
```

Do not add `artifacts/` or `audio-source/`; both contain selected, reviewable provenance/evidence files.

- [ ] **Step 8: Run focused documentation checks**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
Push-Location $TargetWorktree -ErrorAction Stop
try {
  & node --test tests/rural-mutation-escape-migration.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'project documentation tests failed' }
} finally {
  Pop-Location
}
git -c safe.directory='D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration' `
  -C 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration' `
  diff --check
if ($LASTEXITCODE -ne 0) { throw 'project documentation whitespace check failed' }
```

Expected: all five tests PASS and no whitespace errors. Every relative Markdown link must resolve; the not-yet-created core-loop validation path appears as code text, not a broken link.

- [ ] **Step 9: Commit project documentation**

Run:

```powershell
git -c safe.directory='D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration' `
  -C 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration' `
  add rural-mutation-escape/README.md `
  rural-mutation-escape/docs/REFERENCES.md `
  rural-mutation-escape/docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md `
  rural-mutation-escape/THIRD_PARTY_NOTICES.md `
  rural-mutation-escape/.gitignore `
  tests/rural-mutation-escape-migration.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'could not stage project documentation' }
git -c safe.directory='D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration' `
  -C 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration' `
  commit -m 'docs: document rural escape provenance'
if ($LASTEXITCODE -ne 0) { throw 'could not commit project documentation' }
```

Expected: one scoped commit containing only the five project documentation/status/ignore files and their metadata test.

---

### Task 3: Register the sixth top-level project and protect repository boundaries

**Files:**
- Modify: `tests/rural-mutation-escape-migration.test.mjs`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the project README and reference document from Task 2.
- Produces: the root project index entry, root run instructions, correct top-level links and outer ignore rules.

- [ ] **Step 1: Add a failing root-registration test**

Append to `tests/rural-mutation-escape-migration.test.mjs`:

```js
test("root repository registers the sixth project and narrows ignore scope", async () => {
  const rootReadme = await read("README.md");
  assertIncludesAll(rootReadme, [
    "| 06 | [《雾村：逃离》](./rural-mutation-escape/)",
    "## 06 · 《雾村：逃离》",
    "./rural-mutation-escape/README.md",
    "./rural-mutation-escape/docs/REFERENCES.md",
    "cd rural-mutation-escape",
    "npm.cmd install",
    "npm.cmd run dev",
  ], "root README");
  assert.ok(
    !rootReadme.includes("./claude-of-duty-research/"),
    "root README must not link the local research clone",
  );
  await assertLocalLinksResolve("README.md");

  const lines = (await read(".gitignore"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert.ok(lines.includes(".worktrees/"));
  assert.ok(lines.includes("/artifacts/"));
  assert.ok(lines.includes("/claude-of-duty-research/"));
  assert.ok(!lines.includes("artifacts/"));
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
Push-Location $TargetWorktree -ErrorAction Stop
try {
  & node --test tests/rural-mutation-escape-migration.test.mjs
  $ExpectedFailureExit = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($ExpectedFailureExit -eq 0) {
  throw 'Root registration contract unexpectedly passed before root files changed'
}
```

Expected: the five Task 2 tests pass and the new root-registration test fails because project 06 and the narrowed ignore rules do not exist yet.

- [ ] **Step 3: Add project 06 to the root index**

Add this row immediately after project 05 in the `README.md` demo table:

```markdown
| 06 | [《雾村：逃离》](./rural-mutation-escape/) | `rural-mutation-escape` | 第三人称农村变异逃生原型与 AI 辅助游戏开发研究。 |
```

Add this section immediately before “获取项目库代码”:

````markdown
## 06 · 《雾村：逃离》

这一项目研究一款农村变异逃生游戏从零到可玩的开发逻辑：用数据定义村庄地图和任务锚点，以程序化 Three.js 构建建筑、道路、拟人角色和变异体，再接入共享碰撞、第一/第三人称镜头、线性故事引导、追逐危险反馈与原创动态音乐。

当前版本是可运行的序章原型：玩家可调查收音机、找到躲藏的邻居、取得手电并抵达南门；失败、检查点、感知 AI 和动态开门仍属于已确认但未落地的核心闭环计划。项目从 `mshumer/Claude-of-Duty` 研究工程方法，但没有复制其 FPS 玩法、源码或商业素材。

- [项目 README：功能、操作、架构与限制](./rural-mutation-escape/README.md)
- [参考来源与独立实现边界](./rural-mutation-escape/docs/REFERENCES.md)

本地运行：

```powershell
cd rural-mutation-escape
npm.cmd install
npm.cmd run dev
```

验证：

```powershell
npm.cmd run test:unit
npm.cmd run test:audio
npm.cmd test
npm.cmd run build
```
````

Also add these two entries to “相关文档”:

```markdown
- [《雾村：逃离》项目 README](./rural-mutation-escape/README.md)
- [《雾村：逃离》参考来源说明](./rural-mutation-escape/docs/REFERENCES.md)
```

- [ ] **Step 4: Narrow the root artifact ignore and exclude only the local research clone**

Replace the complete outer `.gitignore` with:

```gitignore
.worktrees/
/artifacts/
/claude-of-duty-research/
```

The leading slash on `/artifacts/` is required so committed project evidence under `rural-mutation-escape/artifacts/` remains trackable.

- [ ] **Step 5: Run root registration and existing repository tests**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
Push-Location $TargetWorktree -ErrorAction Stop
try {
  & node --test tests/rural-mutation-escape-migration.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'migration metadata tests failed' }
  & node --test tests/fungarium-recording.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'existing Fungarium tests failed' }
} finally {
  Pop-Location
}
git -c safe.directory='D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration' `
  -C 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration' `
  diff --check
if ($LASTEXITCODE -ne 0) { throw 'root registration whitespace check failed' }
```

Expected: migration metadata tests PASS, all 5 existing Fungarium recording tests PASS and no whitespace errors.

- [ ] **Step 6: Commit root registration**

Run:

```powershell
git -c safe.directory='D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration' `
  -C 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration' `
  add README.md .gitignore tests/rural-mutation-escape-migration.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'could not stage root registration' }
git -c safe.directory='D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration' `
  -C 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration' `
  commit -m 'docs: register rural escape project'
if ($LASTEXITCODE -ne 0) { throw 'could not commit root registration' }
```

Expected: one scoped commit with the root index, root ignore rules and the root-registration assertion.

---

### Task 4: Verify imported history, runnable behavior and clean publication

**Files:**
- Verify without modifying: all files in the migration branch
- Generated but ignored: `rural-mutation-escape/node_modules/`
- Generated but ignored: `rural-mutation-escape/dist/`

**Interfaces:**
- Consumes: subtree merge, project documentation commit and root registration commit.
- Produces: a clean, tested branch pushed as `origin/codex/rural-mutation-escape-migration`; does not merge `main` or create a PR.

- [ ] **Step 1: Re-check the immutable import point after documentation commits**

Run from the outer migration worktree:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
$ExpectedTree = 'e8058b3abe1049d202f0ef2e714dedf8a41e8125'
$ImportCommit = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  rev-list --first-parent `
  --grep='^chore: import rural mutation escape history$' `
  -n 1 HEAD
if (-not $ImportCommit) {
  throw 'Subtree import commit not found'
}
$ImportedTree = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  rev-parse "${ImportCommit}:rural-mutation-escape"
if ($ImportedTree -ne $ExpectedTree) {
  throw "Imported tree changed: $ImportedTree"
}
$SplitCommit = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  rev-parse "${ImportCommit}^2"
git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  merge-base --is-ancestor $SplitCommit HEAD
if ($LASTEXITCODE -ne 0) {
  throw 'Filtered history is no longer reachable'
}
$SplitCount = [int](
  git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
    rev-list --count $SplitCommit
)
if ($SplitCount -ne 67) {
  throw 'Filtered history count is not 67'
}
```

Expected: no exception. Later README files legitimately change current project tree, so this check targets the subtree import commit rather than current `HEAD`.

- [ ] **Step 2: Prove representative design and implementation history remains reachable**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
$ImportCommit = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  rev-list --first-parent `
  --grep='^chore: import rural mutation escape history$' `
  -n 1 HEAD
$SplitCommit = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  rev-parse "${ImportCommit}^2"
$Subjects = git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  log --format='%s' $SplitCommit
$RequiredSubjects = @(
  'docs: add rural escape design and plan',
  'feat: add rural escape playable prologue',
  'feat: rebuild the rural village environment',
  'feat: apply shared colliders to pursuer',
  'feat: integrate guided escape feedback',
  'feat: wire trusted dynamic audio lifecycle',
  'docs: plan rural escape core loop'
)
foreach ($RequiredSubject in $RequiredSubjects) {
  if ($Subjects -notcontains $RequiredSubject) {
    throw "Missing filtered history subject: $RequiredSubject"
  }
}
```

Expected: all representative design, visual, collision, guidance, audio and core-loop planning subjects are present.

- [ ] **Step 3: Prove no nested repository, local clone, dependencies or build output are tracked**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
$Tracked = git -c "safe.directory=$TargetSafe" -C $TargetWorktree ls-files
$TrackedModes = git -c "safe.directory=$TargetSafe" -C $TargetWorktree ls-files --stage
$Forbidden = $Tracked | Where-Object {
  $_ -match '^claude-of-duty-research/' -or
  $_ -match '(^|/)node_modules/' -or
  $_ -match '(^|/)dist/' -or
  $_ -match '^rural-mutation-escape/\.git($|/)'
}
if ($Forbidden.Count -ne 0) {
  throw "Forbidden tracked paths:`n$($Forbidden -join "`n")"
}
if ($TrackedModes -match '^160000 ') {
  throw 'A gitlink is tracked in the outer repository'
}
if (Test-Path -LiteralPath "$TargetWorktree\rural-mutation-escape\.git") {
  throw 'Nested Git metadata exists on disk'
}
```

Expected: no exception. `rural-mutation-escape/artifacts/` and `rural-mutation-escape/audio-source/` remain tracked.

- [ ] **Step 4: Install exactly from the lock file and run project unit, audio and production checks**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$ProjectRoot = Join-Path $TargetWorktree 'rural-mutation-escape'
Push-Location $ProjectRoot -ErrorAction Stop
try {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
  & npm.cmd run test:unit
  if ($LASTEXITCODE -ne 0) { throw 'unit tests failed' }
  & npm.cmd run test:audio
  if ($LASTEXITCODE -ne 0) { throw 'audio tests failed' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'production build failed' }
} finally {
  Pop-Location
}
```

Expected:

- clean lock-file installation succeeds without changing `package.json` or `package-lock.json`;
- unit tests PASS;
- audio asset tests PASS;
- Vite production build succeeds;
- only the existing informational chunk-size warning is acceptable.

After returning to the repository root, run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  diff --exit-code -- `
  rural-mutation-escape/package.json `
  rural-mutation-escape/package-lock.json
if ($LASTEXITCODE -ne 0) {
  throw 'dependency installation changed package metadata'
}
```

Expected: no diff.

- [ ] **Step 5: Run Playwright browser smoke**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$ProjectRoot = Join-Path $TargetWorktree 'rural-mutation-escape'
Push-Location $ProjectRoot -ErrorAction Stop
try {
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'full game test failed' }
} finally {
  Pop-Location
}
```

Expected: unit, audio and Chromium smoke all PASS. If Playwright reports only a missing Chromium executable, install the package-matched browser and rerun:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$ProjectRoot = Join-Path $TargetWorktree 'rural-mutation-escape'
Push-Location $ProjectRoot -ErrorAction Stop
try {
  & npx.cmd playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw 'Playwright Chromium installation failed' }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'full game test failed after Chromium installation' }
} finally {
  Pop-Location
}
```

Network or browser-install permission failure is a publication blocker to report; do not mark browser verification complete from unit tests alone.

- [ ] **Step 6: Run optional FFmpeg source verification when both tools are available**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$ProjectRoot = Join-Path $TargetWorktree 'rural-mutation-escape'
$FfmpegFromEnvironment = $env:RURAL_SCORE_FFMPEG
$FfprobeFromEnvironment = $env:RURAL_SCORE_FFPROBE
if ($FfmpegFromEnvironment -and -not (Test-Path -LiteralPath $FfmpegFromEnvironment -PathType Leaf)) {
  throw "RURAL_SCORE_FFMPEG does not exist: $FfmpegFromEnvironment"
}
if ($FfprobeFromEnvironment -and -not (Test-Path -LiteralPath $FfprobeFromEnvironment -PathType Leaf)) {
  throw "RURAL_SCORE_FFPROBE does not exist: $FfprobeFromEnvironment"
}
$Ffmpeg = if ($FfmpegFromEnvironment) {
  Get-Item -LiteralPath $FfmpegFromEnvironment
} else {
  Get-Command ffmpeg -ErrorAction SilentlyContinue
}
$Ffprobe = if ($FfprobeFromEnvironment) {
  Get-Item -LiteralPath $FfprobeFromEnvironment
} else {
  Get-Command ffprobe -ErrorAction SilentlyContinue
}
if ($null -ne $Ffmpeg -and $null -ne $Ffprobe) {
  Push-Location $ProjectRoot -ErrorAction Stop
  try {
    & npm.cmd run audio:verify
    if ($LASTEXITCODE -ne 0) { throw 'audio source verification failed' }
  } finally {
    Pop-Location
  }
} else {
  Write-Output 'SKIP: FFmpeg/FFprobe are unavailable through both the configured environment variables and PATH; committed audio hashes remain covered by test:audio.'
}
```

Expected: `audio:verify` PASS when tools are available; otherwise one explicit optional-skip line.

- [ ] **Step 7: Run all outer checks and inspect the final branch**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
Push-Location $TargetWorktree -ErrorAction Stop
try {
  & node --test tests/fungarium-recording.test.mjs tests/rural-mutation-escape-migration.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'outer Node tests failed' }
} finally {
  Pop-Location
}
git -c "safe.directory=$TargetSafe" -C $TargetWorktree diff --check origin/main..HEAD
if ($LASTEXITCODE -ne 0) { throw 'branch whitespace check failed' }
$FinalStatus = @(
  git -c "safe.directory=$TargetSafe" -C $TargetWorktree status --porcelain=v1 -uall
)
if ($LASTEXITCODE -ne 0) { throw 'could not read final target status' }
if ($FinalStatus.Count -ne 0) {
  throw "Target worktree is dirty:`n$($FinalStatus -join "`n")"
}
git -c "safe.directory=$TargetSafe" -C $TargetWorktree log --oneline --decorate --graph --all -20
if ($LASTEXITCODE -ne 0) { throw 'could not inspect final history' }
$TargetRemote = git -c "safe.directory=$TargetSafe" -C $TargetWorktree remote get-url origin
if ($LASTEXITCODE -ne 0) { throw 'could not read target origin' }
if ($TargetRemote -ne 'https://github.com/yydshly/0728_practical-skill-notebook.git') {
  throw "Unexpected target origin: $TargetRemote"
}
```

Expected:

- all 11 outer tests PASS;
- no whitespace errors;
- target worktree status is clean because project dependencies and build output are ignored;
- history contains the prior migration design/plan commits, the non-squash subtree merge, `docs: document rural escape provenance`, and `docs: register rural escape project`;
- `origin` remains `https://github.com/yydshly/0728_practical-skill-notebook.git`.

Also inspect the separate main worktree read-only:

```powershell
$MainWorktree = 'D:\codex_project_work\0728_some_github'
$MainSafe = 'D:/codex_project_work/0728_some_github'
$SnapshotDirectory = Join-Path $env:TEMP 'rural-mutation-escape-migration'
$MainHeadBefore = (
  Get-Content -Raw -Encoding UTF8 -LiteralPath "$SnapshotDirectory\main-head-before.txt"
).Trim()
$MainStatusBefore = @(
  Get-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\main-status-before.txt"
)
$MainHeadAfter = git -c "safe.directory=$MainSafe" -C $MainWorktree rev-parse HEAD
$MainStatusAfter = @(
  git -c "safe.directory=$MainSafe" -C $MainWorktree status --porcelain=v1 -uall
)
if ($MainHeadAfter -ne $MainHeadBefore) {
  throw "Main worktree HEAD changed: $MainHeadBefore -> $MainHeadAfter"
}
if (@(Compare-Object $MainStatusBefore $MainStatusAfter).Count -ne 0) {
  throw 'The separate main worktree status changed during migration'
}

$SourceWorktree = 'D:\codex_project_work\0728_some_github\claude-of-duty-research\.worktrees\dynamic-bgm'
$SourceSafe = 'D:/codex_project_work/0728_some_github/claude-of-duty-research/.worktrees/dynamic-bgm'
$SourceHeadBefore = (
  Get-Content -Raw -Encoding UTF8 -LiteralPath "$SnapshotDirectory\source-head-before.txt"
).Trim()
$SourceStatusBefore = @(
  Get-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\source-status-before.txt"
)
$SourceRefsBefore = @(
  Get-Content -Encoding UTF8 -LiteralPath "$SnapshotDirectory\source-refs-before.txt"
)
$SourceHeadAfter = git -c "safe.directory=$SourceSafe" -C $SourceWorktree rev-parse HEAD
$SourceStatusAfter = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree status --porcelain=v1 -uall
)
$SourceRefsAfter = @(
  git -c "safe.directory=$SourceSafe" -C $SourceWorktree `
    for-each-ref --format='%(refname)%09%(objectname)' |
    Sort-Object
)
if ($SourceHeadAfter -ne $SourceHeadBefore) {
  throw "Source worktree HEAD changed: $SourceHeadBefore -> $SourceHeadAfter"
}
if (@(Compare-Object $SourceStatusBefore $SourceStatusAfter).Count -ne 0) {
  throw 'The source worktree status changed during migration'
}
if (@(Compare-Object $SourceRefsBefore $SourceRefsAfter).Count -ne 0) {
  throw 'The source repository ref map changed during migration'
}
```

Expected: the main worktree's HEAD and complete porcelain status exactly match the snapshots captured before migration, including its pre-existing `README.md`, `.superpowers/`, `claude-of-duty-research/` and `test-results/` state. The source worktree's HEAD, complete status and full ref map also match exactly, proving the temporary-clone split did not write source refs or working files.

- [ ] **Step 8: Remove only the verified temporary export clone**

After every history and functional check has passed, remove the temporary clone created by Task 1. Resolve both paths first and reject any broader target:

```powershell
$TemporaryRoot = (Resolve-Path -LiteralPath 'C:\tmp').Path
$ExportRepository = 'C:\tmp\rural-mutation-escape-export-3f704173'
$ResolvedExport = (Resolve-Path -LiteralPath $ExportRepository).Path
if ((Split-Path $ResolvedExport -Parent) -ne $TemporaryRoot) {
  throw "Export clone escaped the intended temporary root: $ResolvedExport"
}
if ((Split-Path $ResolvedExport -Leaf) -ne 'rural-mutation-escape-export-3f704173') {
  throw "Unexpected export clone leaf: $ResolvedExport"
}
if (-not (Test-Path -LiteralPath "$ResolvedExport\.git")) {
  throw 'Refusing to remove a path that is not the migration export clone'
}
Remove-Item -LiteralPath $ResolvedExport -Recurse -Force
if (Test-Path -LiteralPath $ResolvedExport) {
  throw 'Temporary export clone still exists after cleanup'
}
```

Expected: only `C:\tmp\rural-mutation-escape-export-3f704173` is removed. The source research clone and both outer worktrees remain untouched. If migration failed before full verification, keep the temporary clone for diagnosis and do not run this cleanup step.

- [ ] **Step 9: Push only the migration branch**

Run:

```powershell
$TargetWorktree = 'D:\codex_project_work\0728_some_github\.worktrees\rural-mutation-escape-migration'
$TargetSafe = 'D:/codex_project_work/0728_some_github/.worktrees/rural-mutation-escape-migration'
git -c "safe.directory=$TargetSafe" -C $TargetWorktree `
  push --set-upstream origin codex/rural-mutation-escape-migration
if ($LASTEXITCODE -ne 0) {
  throw 'Migration branch push failed'
}
```

Expected: `origin/codex/rural-mutation-escape-migration` is created or fast-forwarded and the local branch tracks it. Do not push `main`, merge `main`, delete the source clone or open a PR without a separate user request.
