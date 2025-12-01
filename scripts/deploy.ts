import { Account, Contract, RpcProvider, json, CallData, hash } from "starknet";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

dotenv.config();

// Network configuration
const NETWORK = process.env.NETWORK || "sepolia";
// Use working RPC endpoint - update in .env if needed
// Options: https://starknet-sepolia.publicnode.com or Alchemy/Infura
const RPC_URL = process.env.RPC_URL || `https://starknet-sepolia.publicnode.com`;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS || "";

interface DeploymentResult {
  contractName: string;
  address: string;
  txHash: string;
}

async function deployContract(
  provider: RpcProvider,
  account: Account,
  contractName: string,
  constructorCalldata: any[]
): Promise<DeploymentResult> {
  console.log(`\n📦 Deploying ${contractName}...`);

  // Read compiled contract (Scarb generates pump_fun_ContractName.contract_class.json)
  const contractPath = path.join(
    __dirname,
    "..",
    "target",
    "dev",
    `pump_fun_${contractName}.contract_class.json`
  );

  // Also check for compiled_contract_class.json (contains CASM bytecode)
  const compiledContractPath = path.join(
    __dirname,
    "..",
    "target",
    "dev",
    `pump_fun_${contractName}.compiled_contract_class.json`
  );

  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract not found at ${contractPath}. Run 'scarb build' first.`);
  }

  const contractClass = json.parse(
    fs.readFileSync(contractPath).toString("ascii")
  );

  // Try to read compiled contract class (contains CASM bytecode for Cairo 2.x)
  let compiledContractClass: any = null;
  if (fs.existsSync(compiledContractPath)) {
    compiledContractClass = json.parse(
      fs.readFileSync(compiledContractPath).toString("ascii")
    );
  }

  // Scarb generates contract_class.json - use it directly for v2 contracts
  // For Cairo 2.x, we need to declare the class first (requires CASM)
  // This script will attempt to use declareIfNot, but if CASM is missing,
  // you'll need to declare via CLI first
  console.log(`  Declaring class for ${contractName}...`);
  
  let declareResponse: { class_hash: string; transaction_hash?: string };
  
  try {
    // For Cairo 2.x, we need to use declare() directly with contract class + CASM
    // declareIfNot tries to use legacy format which doesn't work for Cairo 2.x
    // First, compute class hash to check if already declared
    const classHash = hash.computeContractClassHash(contractClass);
    
    // Check if class is already declared
    try {
      await provider.getClassByHash(classHash);
      console.log(`  ✅ Class already declared: ${classHash}`);
      declareResponse = { class_hash: classHash };
    } catch {
      // Class not declared - declare it with CASM
      if (!compiledContractClass) {
        throw new Error(`CASM required for declaration. Run 'scarb build' to generate compiled_contract_class.json`);
      }
      
      console.log(`  📦 Declaring new class...`);
      
      // For accounts that aren't deployed yet, we need to specify Cairo version explicitly
      // Try to declare with Cairo 2.x (default for Scarb builds)
      let result;
      try {
        result = await account.declare({
          contract: contractClass,
          casm: {
            bytecode: compiledContractClass.bytecode,
            bytecode_segment_lengths: compiledContractClass.bytecode_segment_lengths,
            hints: compiledContractClass.hints,
            prime: compiledContractClass.prime,
            compiler_version: compiledContractClass.compiler_version,
            entry_points_by_type: compiledContractClass.entry_points_by_type
          }
        });
      } catch (declareError: any) {
        // If account contract not found, try with explicit Cairo version
        if (declareError.message?.includes("Contract not found") || 
            declareError.message?.includes("20")) {
          console.log(`  ⚠️  Account contract not found. Using Cairo 2.x explicitly...`);
          
          // Create a new account instance with explicit Cairo version
          const accountWithVersion = new Account({
            address: ACCOUNT_ADDRESS,
            signer: PRIVATE_KEY,
            provider: provider,
            cairoVersion: "2" as any
          });
          
          result = await accountWithVersion.declare({
            contract: contractClass,
            casm: {
              bytecode: compiledContractClass.bytecode,
              bytecode_segment_lengths: compiledContractClass.bytecode_segment_lengths,
              hints: compiledContractClass.hints,
              prime: compiledContractClass.prime,
              compiler_version: compiledContractClass.compiler_version,
              entry_points_by_type: compiledContractClass.entry_points_by_type
            }
          });
        } else {
          throw declareError;
        }
      }
      
      await provider.waitForTransaction(result.transaction_hash);
      console.log(`  ✅ Class declared: ${result.class_hash}`);
      declareResponse = { class_hash: result.class_hash, transaction_hash: result.transaction_hash };
    }
  } catch (error: any) {
    // If declareIfNot fails due to missing CASM, compute class hash and check if declared
    if (error.message?.includes("casm") || error.message?.includes("CASM") || 
        error.message?.includes("compiledClassHash")) {
      console.log(`  ⚠️  CASM not available, computing class hash...`);
      
      try {
        // For Cairo 2.x, try to compute class hash
        // The class hash is computed from the contract class structure
        let classHash: string | undefined;
        
        // For Cairo 2.x contracts, we can use the RPC to compute class hash
        // or check if there's a compiled_class_hash in the contract class
        try {
          // Check if contract class has compiled_class_hash (some tools add this)
          if (contractClass.compiled_class_hash) {
            classHash = contractClass.compiled_class_hash;
            console.log(`  📋 Found compiled_class_hash in contract class`);
          } else {
            // Compute class hash for Cairo 2.x contracts using starknet.js utility
            try {
              // Use computeContractClassHash from hash namespace
              classHash = hash.computeContractClassHash(contractClass);
              console.log(`  📋 Computed class hash: ${classHash}`);
            } catch (hashError: any) {
              console.log(`  ⚠️  Hash computation failed: ${hashError.message}`);
              throw new Error(`Could not compute class hash: ${hashError.message}`);
            }
          }
        } catch (hashError: any) {
          console.log(`  ⚠️  Hash computation failed: ${hashError.message}`);
        }
        
        if (!classHash) {
          // Cannot compute hash - need CASM or manual declaration
          console.log(`  ❌ Cannot compute class hash automatically`);
          console.log(`  💡 You need to declare the contract class first using StarkNet CLI`);
          console.log(`     Install: https://docs.starknet.io/documentation/getting_started/installation/`);
          console.log(`     Then run: starknet declare --contract "${contractPath}" --account <account> --network ${NETWORK}`);
          throw new Error(
            `Cannot compute class hash. CASM required for declaration. ` +
            `Please declare the contract class first using StarkNet CLI.`
          );
        }
        
        console.log(`  📋 Class hash: ${classHash}`);
        
        // Check if class is already declared
        try {
          await provider.getClassByHash(classHash);
          console.log(`  ✅ Class already declared on-chain`);
          declareResponse = { class_hash: classHash };
        } catch {
          // Class not declared - try to declare using RPC (might work for Cairo 2.x)
          console.log(`  📦 Class not declared, attempting declaration via RPC...`);
          try {
            // Try to declare using account.declare with just contract class
            // Some RPCs might support this for Cairo 2.x
            const declareResult = await account.declare({
              contract: contractClass,
              // Don't provide CASM - let RPC handle it if possible
            } as any);
            
            await provider.waitForTransaction(declareResult.transaction_hash);
            console.log(`  ✅ Class declared via RPC: ${declareResult.class_hash}`);
            declareResponse = { class_hash: declareResult.class_hash, transaction_hash: declareResult.transaction_hash };
          } catch (declareError: any) {
            // Declaration failed - need CASM
            if (declareError.message?.includes("casm") || declareError.message?.includes("CASM") || 
                declareError.message?.includes("compiledClassHash")) {
              console.log(`  ❌ CASM required for declaration`);
              console.log(`\n  💡 To declare the class, you need CASM files. Options:`);
              console.log(`     1. Install StarkNet CLI: https://docs.starknet.io/documentation/getting_started/installation/`);
              console.log(`        Then run: starknet declare --contract "${contractPath}" --account <account> --network ${NETWORK}`);
              console.log(`     2. Use Starknet Foundry (snforge) or Hardhat for deployment`);
              console.log(`     3. Generate CASM using starknet-compile tool`);
              console.log(`\n  📋 Class hash (for reference): ${classHash}`);
              throw new Error(
                `Class not declared. CASM required for declaration. ` +
                `Install StarkNet CLI and run: starknet declare --contract "${contractPath}" --account <account> --network ${NETWORK}`
              );
            } else {
              throw declareError;
            }
          }
        }
      } catch (fallbackError: any) {
        throw fallbackError;
      }
    } else {
      // Other errors (network, etc.)
      throw error;
    }
  }

  // Deploy the contract
  console.log(`  Deploying instance...`);
  const deployResponse = await account.deployContract({
    classHash: declareResponse.class_hash,
    constructorCalldata: constructorCalldata,
  });

  await provider.waitForTransaction(deployResponse.transaction_hash);
  console.log(`  ✅ Contract deployed at: ${deployResponse.contract_address}`);
  console.log(`  📝 Transaction: ${deployResponse.transaction_hash}`);

  return {
    contractName,
    address: deployResponse.contract_address,
    txHash: deployResponse.transaction_hash,
  };
}

async function main() {
  console.log("🚀 Starting Pump.fun Deployment");
  console.log(`📍 Network: ${NETWORK}`);
  console.log(`🔗 RPC: ${RPC_URL}`);

  if (!PRIVATE_KEY || !ACCOUNT_ADDRESS) {
    throw new Error("PRIVATE_KEY and ACCOUNT_ADDRESS must be set in .env");
  }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  
  // Create account with explicit Cairo 2.x version (works even if account not deployed yet)
  // When account is not deployed, starknet.js needs explicit Cairo version
  const account = new Account({
    address: ACCOUNT_ADDRESS,
    signer: PRIVATE_KEY,
    provider: provider,
    cairoVersion: "2" as any
  });

  console.log(`👤 Account: ${ACCOUNT_ADDRESS}`);
  
  // Check account balance using ETH contract
  // ETH contract address on StarkNet Sepolia: 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
  // STRK contract address on StarkNet Sepolia: 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
  try {
    const ETH_ADDRESS = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
    const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
    
    // Check ETH balance
    const ethBalanceCall = {
      contractAddress: ETH_ADDRESS,
      entrypoint: "balanceOf",
      calldata: CallData.compile([ACCOUNT_ADDRESS])
    };
    const ethBalanceResult = await provider.callContract(ethBalanceCall);
    const ethBalance = BigInt(ethBalanceResult[0] || "0");
    
    // Check STRK balance
    const strkBalanceCall = {
      contractAddress: STRK_ADDRESS,
      entrypoint: "balanceOf",
      calldata: CallData.compile([ACCOUNT_ADDRESS])
    };
    const strkBalanceResult = await provider.callContract(strkBalanceCall);
    const strkBalance = BigInt(strkBalanceResult[0] || "0");
    
    console.log(`💰 ETH Balance: ${ethBalance.toString()} wei`);
    console.log(`💰 STRK Balance: ${strkBalance.toString()} wei`);
    
    if (ethBalance === BigInt(0) && strkBalance > BigInt(0)) {
      console.log(`\n⚠️  WARNING: You have STRK but need ETH for gas fees!`);
      console.log(`\n💡 Swap STRK to ETH:`);
      console.log(`   1. Visit a DEX on StarkNet Sepolia:`);
      console.log(`      - JediSwap: https://app.jediswap.xyz/`);
      console.log(`      - Ekubo: https://app.ekubo.org/`);
      console.log(`      - 10KSwap: https://10kswap.com/`);
      console.log(`\n   2. Connect your wallet (ArgentX/Braavos)`);
      console.log(`   3. Swap STRK → ETH`);
      console.log(`   4. Wait for confirmation`);
      console.log(`   5. Run this script again\n`);
      throw new Error("Account has STRK but needs ETH for gas fees. Please swap STRK to ETH first.");
    }
    
    if (ethBalance === BigInt(0)) {
      console.log(`\n⚠️  WARNING: Account has 0 ETH balance!`);
      console.log(`\n💡 You need to fund your account with ETH on StarkNet Sepolia:`);
      console.log(`   1. Get Sepolia ETH from a faucet:`);
      console.log(`      - https://starknet-faucet.vercel.app/`);
      console.log(`      - https://faucet.quicknode.com/starknet/sepolia`);
      console.log(`      - Or bridge from Ethereum Sepolia`);
      console.log(`\n   2. Send ETH to your account address:`);
      console.log(`      ${ACCOUNT_ADDRESS}`);
      console.log(`\n   3. Wait for the transaction to confirm`);
      console.log(`   4. Run this script again\n`);
      throw new Error("Account balance is 0. Please fund your account with ETH first.");
    }
  } catch (error: any) {
    if (error.message?.includes("balance is 0") || error.message?.includes("needs ETH")) {
      throw error;
    }
    // If balance check fails for other reasons, continue (might be account not deployed)
    console.log(`⚠️  Could not check balance: ${error.message}`);
    console.log(`   Continuing anyway - the transaction will fail if balance is insufficient`);
  }

  const deployments: DeploymentResult[] = [];

  try {
    // 1. Deploy ProtocolConfig
    const protocolOwner = ACCOUNT_ADDRESS; // Use deployer as owner
    const feeBps = 300; // 3%
    const feeReceiver = ACCOUNT_ADDRESS; // Use deployer as fee receiver

    const protocolConfig = await deployContract(
      provider,
      account,
      "ProtocolConfig",
      CallData.compile([protocolOwner, feeBps, feeReceiver])
    );
    deployments.push(protocolConfig);

    // 2. Deploy PumpFactory
    const factoryOwner = ACCOUNT_ADDRESS;
    const pumpFactory = await deployContract(provider, account, "PumpFactory", [
      factoryOwner,
    ]);
    deployments.push(pumpFactory);

    // 3. Deploy LiquidityMigration
    const migrationOwner = ACCOUNT_ADDRESS;
    const liquidityMigration = await deployContract(
      provider,
      account,
      "LiquidityMigration",
      CallData.compile([migrationOwner, pumpFactory.address])
    );
    deployments.push(liquidityMigration);

    // 4. Deploy PrivacyRelayer (ZK-Shielded transactions)
    const privacyOwner = ACCOUNT_ADDRESS;
    const privacyRelayer = await deployContract(
      provider,
      account,
      "PrivacyRelayer",
      CallData.compile([privacyOwner])
    );
    deployments.push(privacyRelayer);

    // 5. Deploy ZkDexHook (Liquidity protection)
    const dexRouter = process.env.DEX_ROUTER || "0x0000000000000000000000000000000000000000"; // Placeholder
    const zkDexHook = await deployContract(
      provider,
      account,
      "ZkDexHook",
      CallData.compile([privacyOwner, dexRouter])
    );
    deployments.push(zkDexHook);

    // Save deployment addresses
    const deploymentData = {
      network: NETWORK,
      timestamp: new Date().toISOString(),
      account: ACCOUNT_ADDRESS,
      contracts: deployments.reduce((acc, dep) => {
        acc[dep.contractName] = {
          address: dep.address,
          txHash: dep.txHash,
        };
        return acc;
      }, {} as Record<string, { address: string; txHash: string }>),
    };

    const deploymentPath = path.join(__dirname, "..", "deployments", `${NETWORK}.json`);
    const deploymentDir = path.dirname(deploymentPath);
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    console.log(`\n💾 Deployment data saved to: ${deploymentPath}`);

    console.log("\n✅ Deployment Complete!");
    console.log("\n📋 Deployment Summary:");
    deployments.forEach((dep) => {
      console.log(`  ${dep.contractName}: ${dep.address}`);
    });

    console.log("\n⚠️  Note: MemecoinToken and BondingCurvePool are deployed per-launch.");
    console.log("   Use create_launch.ts script to create new launches.");
    console.log("\n🔒 Privacy Features Deployed:");
    console.log("   ✅ PrivacyRelayer - ZK-Shielded Bonding Curve");
    console.log("   ✅ ZkDexHook - Liquidity Protection & MEV Resistance");
    console.log("\n💡 To enable privacy on a launch:");
    console.log("   1. Call pool.set_privacy_relayer(PrivacyRelayer address)");
    console.log("   2. Use PrivacyRelayer.execute_private_buy() for shielded trades");
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

main();

