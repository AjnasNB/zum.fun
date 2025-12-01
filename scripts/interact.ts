import { Account, Contract, RpcProvider, json } from "starknet";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const NETWORK = process.env.NETWORK || "sepolia";
const RPC_URL = process.env.RPC_URL || `https://starknet-sepolia.publicnode.com`;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS || "";

async function loadDeployments(): Promise<any> {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${NETWORK}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found at ${deploymentPath}`);
  }
  return json.parse(fs.readFileSync(deploymentPath).toString("ascii"));
}

async function loadContractABI(contractName: string): Promise<any> {
  const abiPath = path.join(
    __dirname,
    "..",
    "target",
    "dev",
    `${contractName}.sierra.json`
  );
  if (!fs.existsSync(abiPath)) {
    throw new Error(`ABI not found at ${abiPath}. Run 'scarb build' first.`);
  }
  const compiled = json.parse(fs.readFileSync(abiPath).toString("ascii"));
  return compiled.abi;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: ts-node scripts/interact.ts <contract> <action> [args...]");
    console.log("\nExamples:");
    console.log("  ts-node scripts/interact.ts factory total_launches");
    console.log("  ts-node scripts/interact.ts factory get_launch 0");
    console.log("  ts-node scripts/interact.ts pool get_current_price <pool_address>");
    process.exit(1);
  }

  const contractName = args[0];
  const action = args[1];

  if (!PRIVATE_KEY || !ACCOUNT_ADDRESS) {
    throw new Error("PRIVATE_KEY and ACCOUNT_ADDRESS must be set in .env");
  }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

  try {
    const deployments = await loadDeployments();
    let contractAddress: string;
    let abiContractName: string;

    switch (contractName) {
      case "factory":
        contractAddress = deployments.contracts.PumpFactory.address;
        abiContractName = "PumpFactory";
        break;
      case "config":
        contractAddress = deployments.contracts.ProtocolConfig.address;
        abiContractName = "ProtocolConfig";
        break;
      case "migration":
        contractAddress = deployments.contracts.LiquidityMigration.address;
        abiContractName = "LiquidityMigration";
        break;
      case "pool":
        if (!args[2]) {
          throw new Error("Pool address required as third argument");
        }
        contractAddress = args[2];
        abiContractName = "BondingCurvePool";
        break;
      case "token":
        if (!args[2]) {
          throw new Error("Token address required as third argument");
        }
        contractAddress = args[2];
        abiContractName = "MemecoinToken";
        break;
      default:
        throw new Error(`Unknown contract: ${contractName}`);
    }

    const abi = await loadContractABI(abiContractName);
    const contract = new Contract(abi, contractAddress, provider);
    contract.connect(account);

    console.log(`\n📞 Calling ${action} on ${contractName} (${contractAddress})`);

    // Handle different actions
    if (action === "total_launches") {
      const result = await contract.total_launches();
      console.log(`Total launches: ${result}`);
    } else if (action === "get_launch") {
      const launchId = args[2] || "0";
      const result = await contract.get_launch(launchId);
      console.log(`Launch ${launchId}:`, result);
    } else if (action === "get_current_price") {
      const result = await contract.get_current_price();
      console.log(`Current price: ${result}`);
    } else if (action === "get_state") {
      const result = await contract.get_state();
      console.log(`Pool state:`, result);
    } else if (action === "get_fee_config") {
      const result = await contract.get_fee_config();
      console.log(`Fee config:`, result);
    } else {
      // Generic call
      const callArgs = args.slice(2);
      const result = await contract[action](...callArgs);
      console.log(`Result:`, result);
    }
  } catch (error) {
    console.error("\n❌ Interaction failed:", error);
    process.exit(1);
  }
}

main();

