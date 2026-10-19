# 升级已安装的采集插件（删除 profile 里的旧副本 → 用客户端自带 pnpm 重装 → 校验版本）
# 用法:
#   powershell -ExecutionPolicy Bypass -File scripts\upgrade.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\upgrade.ps1 -Profile "C:\Users\me\.dsh\profiles\desktop" -DshRoot "D:\dsh"
param(
    [string]$Profile = (Join-Path $env:USERPROFILE ".dsh\profiles\desktop"),
    [string]$DshRoot = "D:\dsh"
)
$ErrorActionPreference = "Stop"

$Repo = Split-Path -Parent $PSScriptRoot
$pkgJson = Join-Path $Repo "package.json"
if (-not (Test-Path $pkgJson)) { throw "找不到 $pkgJson" }
$pkg = [System.IO.File]::ReadAllText($pkgJson, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$Name = $pkg.name

$Node = Join-Path $DshRoot "resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
$Pnpm = Join-Path $DshRoot "resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs"
if (-not (Test-Path $Node)) { throw "找不到客户端运行时: $Node （用 -DshRoot 指定 DSH 安装目录）" }
if (-not (Test-Path (Join-Path $Profile "package.json"))) { throw "找不到 profile: $Profile" }

# profile 里没有登记过这个插件时，提示先按 README 安装
$profilePkg = [System.IO.File]::ReadAllText((Join-Path $Profile "package.json"), [System.Text.Encoding]::UTF8)
if ($profilePkg -notmatch [regex]::Escape($Name)) {
    throw "profile 的 package.json 里没有 $Name，请先按 README 的安装步骤登记依赖与 bundle"
}

Write-Host "插件: $Name@$($pkg.version)"
$target = Join-Path $Profile "node_modules\$Name"
if (Test-Path $target) {
    Write-Host "删除旧副本: $target"
    Remove-Item $target -Recurse -Force
}

Push-Location $Profile
try {
    & $Node $Pnpm install --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败（退出码 $LASTEXITCODE）" }
} finally {
    Pop-Location
}

$installed = Join-Path $target "package.json"
if (-not (Test-Path $installed)) { throw "重装失败：$installed 不存在" }
$newPkg = [System.IO.File]::ReadAllText($installed, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
Write-Host "已安装 $($newPkg.name)@$($newPkg.version)"
Write-Host "请重启 DSH 客户端，让新的插件 bundle 生效。"
