param(
  [Parameter(Mandatory=$true)] [string] $KeyPath,
  [Parameter(Mandatory=$true)] [string] $EC2Host,
  [string] $RemoteDir = "/home/ubuntu/vision/dashboard",
  [string] $User = "ubuntu"
)

$ErrorActionPreference = "Stop"
$ec2 = "$User@$EC2Host"

if (-not (Test-Path .next)) { throw "Run npm run build first - .next not found in $(Get-Location)" }
if (-not (Test-Path .env.production)) { Write-Warning ".env.production not found - skipping that file" }

Write-Host "==> Stopping dashboard service on EC2" -ForegroundColor Cyan
ssh -i $KeyPath $ec2 "sudo systemctl stop vision-dashboard || true"

Write-Host "==> Removing old .next on EC2" -ForegroundColor Cyan
ssh -i $KeyPath $ec2 "rm -rf $RemoteDir/.next"

Write-Host "==> Copying .next (this is the big one)" -ForegroundColor Cyan
scp -i $KeyPath -r .next "${ec2}:$RemoteDir/"

if (Test-Path .env.production) {
  Write-Host "==> Copying .env.production" -ForegroundColor Cyan
  scp -i $KeyPath .env.production "${ec2}:$RemoteDir/"
}
if (Test-Path package.json)      { scp -i $KeyPath package.json      "${ec2}:$RemoteDir/" }
if (Test-Path package-lock.json) { scp -i $KeyPath package-lock.json "${ec2}:$RemoteDir/" }

Write-Host "==> Verifying on EC2" -ForegroundColor Cyan
ssh -i $KeyPath $ec2 "ls $RemoteDir/.next/BUILD_ID && head -3 $RemoteDir/.env.production 2>/dev/null"

Write-Host "==> Starting service" -ForegroundColor Cyan
ssh -i $KeyPath $ec2 "sudo systemctl start vision-dashboard"
Start-Sleep -Seconds 3
ssh -i $KeyPath $ec2 "sudo systemctl status vision-dashboard --no-pager | head -15"

Write-Host ""
Write-Host "Done. Test: https://orionalerts.io/login" -ForegroundColor Green
