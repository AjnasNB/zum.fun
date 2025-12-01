import { Account, Contract, RpcProvider, json } from "starknet";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Network configuration
const NETWORK = process.env.NETWORK || "sepolia";
const RPC_URL = process.env.RPC_URL || `https://starknet-sepolia.publicnode.com`;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS || "";

interface LaunchParams {
  name: string;
  symbol: string;
  basePrice: string; // in wei/units
  slope: string; // price increase per token
  maxSupply: string; // max tokens to mint
  quoteToken: string; // ETH token address (or other quote token)
}

async function deployContract(
  provider: RpcProvider,
  account: Account,
  contractName: string,
  constructorCalldata: any[]
): Promise<string> {
  console.log(`\n📦 Deploying ${contractName}...`);

  const contractPath = path.join(
    __dirname,
    "..",
    "target",
    "dev",
    `${contractName}.sierra.json`
  );

  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract not found at ${contractPath}. Run 'scarb build' first.`);
  }

  const compiledContract = json.parse(
    fs.readFileSync(contractPath).toString("ascii")
  );

  const casmPath = path.join(
    __dirname,
    "..",
    "target",
    "dev",
    `${contractName}.casm.json`
  );

  if (!fs.existsSync(casmPath)) {
    throw new Error(`CASM file not found at ${casmPath}. Run 'scarb build' first.`);
  }

  const compiledCasm = json.parse(
    fs.readFileSync(casmPath).toString("ascii")
  );

  const declareResponse = await account.declare({
    contract: compiledContract,
    casm: compiledCasm,
  });

  await provider.waitForTransaction(declareResponse.transaction_hash);
  console.log(`  ✅ Class declared: ${declareResponse.class_hash}`);

  const deployResponse = await account.deployContract({
    classHash: declareResponse.class_hash,
    constructorCalldata: constructorCalldata,
  });

  await provider.waitForTransaction(deployResponse.transaction_hash);
  console.log(`  ✅ Contract deployed at: ${deployResponse.contract_address}`);

  return deployResponse.contract_address;
}

async function loadDeployments(): Promise<any> {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${NETWORK}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `Deployment file not found. Run 'npm run deploy' first to deploy core contracts.`
    );
  }
  return json.parse(fs.readFileSync(deploymentPath).toString("ascii"));
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.log("Usage: npm run create-launch <name> <symbol> <basePrice> <slope> <maxSupply> [quoteToken]");
    console.log("\nExample:");
    console.log('  npm run create-launch "DogeCoin" "DOGE" "1000000000000000" "1000000000000" "1000000000000000000000000"');
    process.exit(1);
  }

  const params: LaunchParams = {
    name: args[0],
    symbol: args[1],
    basePrice: args[2],
    slope: args[3],
    maxSupply: args[4],
    quoteToken: args[5] || process.env.QUOTE_TOKEN || "", // Default quote token address
  };

  if (!params.quoteToken) {
    throw new Error("QUOTE_TOKEN must be set in .env or provided as argument");
  }

  console.log("🚀 Creating New Memecoin Launch");
  console.log(`📍 Network: ${NETWORK}`);
  console.log(`📝 Name: ${params.name}`);
  console.log(`🏷️  Symbol: ${params.symbol}`);
  console.log(`💰 Base Price: ${params.basePrice}`);
  console.log(`📈 Slope: ${params.slope}`);
  console.log(`🔢 Max Supply: ${params.maxSupply}`);

  if (!PRIVATE_KEY || !ACCOUNT_ADDRESS) {
    throw new Error("PRIVATE_KEY and ACCOUNT_ADDRESS must be set in .env");
  }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

  try {
    // Load existing deployments
    const deployments = await loadDeployments();
    const protocolConfigAddress = deployments.contracts.ProtocolConfig.address;
    const factoryAddress = deployments.contracts.PumpFactory.address;

    console.log(`\n📋 Using ProtocolConfig: ${protocolConfigAddress}`);
    console.log(`📋 Using PumpFactory: ${factoryAddress}`);

    // 1. Deploy MemecoinToken
    // First, we need to deploy the pool first to get its address for the token minter
    // Actually, we'll deploy token with a placeholder, then update minter after pool deployment
    // Or better: deploy pool first, then token with pool as minter

    // For now, let's deploy token with factory as temporary minter, then update after pool deploy
    const tempMinter = factoryAddress; // Temporary, will be updated

    const tokenAddress = await deployContract(
      provider,
      account,
      "MemecoinToken",
      [
        params.name,
        params.symbol,
        18,
        tempMinter,
      ]
    );

    // 2. Deploy BondingCurvePool
    const poolAddress = await deployContract(
      provider,
      account,
      "BondingCurvePool",
      [
        tokenAddress,
        params.quoteToken,
        ACCOUNT_ADDRESS,
        protocolConfigAddress,
        params.basePrice,
        params.slope,
        params.maxSupply,
      ]
    );

    // 3. Update token minter to pool
    console.log("\n🔄 Updating token minter to pool...");
    const tokenContract = new Contract(
      json.parse(
        fs
          .readFileSync(
            path.join(__dirname, "..", "target", "dev", "MemecoinToken.sierra.json")
          )
          .toString("ascii")
      ).abi,
      tokenAddress,
      provider
    );
    tokenContract.connect(account);

    const updateMinterTx = await tokenContract.update_minter(poolAddress);
    await provider.waitForTransaction(updateMinterTx.transaction_hash);
    console.log("  ✅ Token minter updated");

    // 4. Register launch in factory
    console.log("\n📝 Registering launch in factory...");
    const factoryContract = new Contract(
      json.parse(
        fs
          .readFileSync(
            path.join(__dirname, "..", "target", "dev", "PumpFactory.sierra.json")
          )
          .toString("ascii")
      ).abi,
      factoryAddress,
      provider
    );
    factoryContract.connect(account);

    const registerTx = await factoryContract.register_launch(
      tokenAddress,
      poolAddress,
      params.name,
      params.symbol,
      params.basePrice,
      params.slope,
      params.maxSupply
    );
    await provider.waitForTransaction(registerTx.transaction_hash);

    const launchId = await factoryContract.total_launches();
    console.log(`  ✅ Launch registered with ID: ${launchId}`);

    // 5. Enable privacy features (optional)
    const enablePrivacy = process.env.ENABLE_PRIVACY === "true";
    if (enablePrivacy) {
      console.log("\n🔒 Enabling privacy features...");
      const deployments = await loadDeployments();
      const privacyRelayerAddress = deployments.contracts.PrivacyRelayer.address;
      
      const poolContract = new Contract(
        json.parse(
          fs
            .readFileSync(
              path.join(__dirname, "..", "target", "dev", "BondingCurvePool.sierra.json")
            )
            .toString("ascii")
        ).abi,
        poolAddress,
        provider
      );
      poolContract.connect(account);
      
      const privacyTx = await poolContract.set_privacy_relayer(privacyRelayerAddress);
      await provider.waitForTransaction(privacyTx.transaction_hash);
      console.log(`  ✅ Privacy enabled - ZK-Shielded trades available`);
    }

    // Save launch info
    const launchData = {
      launchId: launchId.toString(),
      name: params.name,
      symbol: params.symbol,
      token: tokenAddress,
      pool: poolAddress,
      creator: ACCOUNT_ADDRESS,
      basePrice: params.basePrice,
      slope: params.slope,
      maxSupply: params.maxSupply,
      quoteToken: params.quoteToken,
      timestamp: new Date().toISOString(),
    };

    const launchesPath = path.join(__dirname, "..", "deployments", "launches.json");
    let launches: any[] = [];
    if (fs.existsSync(launchesPath)) {
      launches = json.parse(fs.readFileSync(launchesPath).toString("ascii"));
    }
    launches.push(launchData);
    fs.writeFileSync(launchesPath, JSON.stringify(launches, null, 2));

    console.log("\n✅ Launch Created Successfully!");
    console.log("\n📋 Launch Details:");
    console.log(`  Launch ID: ${launchId}`);
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Pool: ${poolAddress}`);
    console.log(`  Name: ${params.name} (${params.symbol})`);
  } catch (error) {
    console.error("\n❌ Launch creation failed:", error);
    process.exit(1);
  }
}

main();

