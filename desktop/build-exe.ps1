# Gera dist\UnifiedPlayer\UnifiedPlayer.exe (pasta portátil, não precisa de Node instalado).
# Uso:  powershell -ExecutionPolicy Bypass -File desktop\build-exe.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> next build"
npm run build
if ($LASTEXITCODE -ne 0) { throw "next build falhou" }

$out = Join-Path $root "dist\UnifiedPlayer"
$app = Join-Path $out "app"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $app | Out-Null

Write-Host "==> copiando servidor standalone"
Copy-Item -Recurse -Force ".next\standalone\*" $app
New-Item -ItemType Directory -Force (Join-Path $app ".next") | Out-Null
Copy-Item -Recurse -Force ".next\static" (Join-Path $app ".next\static")
if (Test-Path "public") { Copy-Item -Recurse -Force "public" (Join-Path $app "public") }
# O standalone copia o .env.local; as variáveis NEXT_PUBLIC_ já estão embutidas no build.
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $app ".env*")

Write-Host "==> copiando node.exe"
Copy-Item -Force (Get-Command node).Source (Join-Path $app "node.exe")

Write-Host "==> compilando launcher"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /optimize+ /codepage:65001 /out:"$out\UnifiedPlayer.exe" `
    /r:System.Windows.Forms.dll "$PSScriptRoot\Launcher.cs"
if ($LASTEXITCODE -ne 0) { throw "falha ao compilar o launcher" }

Write-Host "`nPronto: $out\UnifiedPlayer.exe"
