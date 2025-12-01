# PowerShell script to declare all contracts using StarkNet CLI
# This script will declare all contracts, then you can run npm run deploy

param(
    [string]$Account = "",
    [string]$Network = "sepolia"
)

if ([string]::IsNullOrEmpty($Account)) {
    Write-Host "❌ Error: Account name required" -ForegroundColor Red
    Write-Host "Usage: .\scripts\declare_all.ps1 -Account <account_name> [-Network sepolia]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "First, create an account:" -ForegroundColor Cyan
    Write-Host "  starknet new_account --account <name>" -ForegroundColor White
    exit 1
}

Write-Host "🔨 Declaring all contracts via StarkNet CLI..." -ForegroundColor Cyan
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

$failed = @()

foreach ($contract in $contracts) {
    Write-Host "📦 Declaring $contract..." -ForegroundColor Cyan
    
    $contractPath = "target/dev/pump_fun_${contract}.contract_class.json"
    
    if (-not (Test-Path $contractPath)) {
        Write-Host "❌ Contract file not found: $contractPath" -ForegroundColor Red
        Write-Host "   Run 'scarb build' first" -ForegroundColor Yellow
        $failed += $contract
        continue
    }
    
    try {
        starknet declare `
            --contract $contractPath `
            --account $Account `
            --network $Network
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $contract declared successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to declare $contract" -ForegroundColor Red
            $failed += $contract
        }
    } catch {
        Write-Host "❌ Error declaring $contract : $_" -ForegroundColor Red
        $failed += $contract
    }
    Write-Host ""
}

if ($failed.Count -eq 0) {
    Write-Host "✅ All contracts declared successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step: Run 'npm run deploy' to deploy contract instances" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Some contracts failed to declare:" -ForegroundColor Yellow
    foreach ($contract in $failed) {
        Write-Host "  - $contract" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Fix the errors above, then run this script again." -ForegroundColor Yellow
}

