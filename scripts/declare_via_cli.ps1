# PowerShell script to declare contracts via StarkNet CLI
# Usage: .\scripts\declare_via_cli.ps1 -Account <account_name> -Network <network>

param(
    [string]$Account = "deployer",
    [string]$Network = "sepolia"
)

Write-Host "🔨 Declaring contracts via StarkNet CLI..." -ForegroundColor Cyan
Write-Host "Account: $Account" -ForegroundColor Yellow
Write-Host "Network: $Network" -ForegroundColor Yellow
Write-Host ""

$contracts = @(
    "ProtocolConfig",
    "PumpFactory",
    "PrivacyRelayer",
    "ZkDexHook",
    "LiquidityMigration"
)

foreach ($contract in $contracts) {
    Write-Host "📦 Declaring $contract..." -ForegroundColor Cyan
    
    $contractPath = "target/dev/pump_fun_${contract}.contract_class.json"
    
    if (-not (Test-Path $contractPath)) {
        Write-Host "❌ Contract file not found: $contractPath" -ForegroundColor Red
        continue
    }
    
    starknet declare `
        --contract $contractPath `
        --account $Account `
        --network $Network
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $contract declared successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to declare $contract" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "✅ Declaration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Run 'npm run deploy' to deploy contract instances" -ForegroundColor Cyan

