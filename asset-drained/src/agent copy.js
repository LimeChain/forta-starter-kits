const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} = require('forta-agent');
const LRU = require('lru-cache');

const AddressType = require('./address-type');

const ZERO = ethers.constants.Zero;
const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from, address indexed to, uint256 value)';
const TOKEN_ABI = [
  'function balanceOf(address) public view returns (uint256)',
  'function symbol() external view returns (string memory)',
];

const provider = getEthersProvider();

const cachedAddresses = new LRU({ max: 100_000 });
const cachedAssetSymbols = new LRU({ max: 100_000 });

async function getAddressType(address) {
  if (cachedAddresses.has(address)) {
    return cachedAddresses.get(address);
  }

  const code = await provider.getCode(address);
  const type = (code === '0x') ? AddressType.Eoa : AddressType.Contract;
  cachedAddresses.set(address, type);
  return type;
}

async function getAssetSymbol(contract) {
  const { address } = contract;
  if (cachedAssetSymbols.has(address)) {
    return cachedAssetSymbols.get(address);
  }

  const symbol = await contract.symbol();
  cachedAssetSymbols.set(address, symbol);
  return symbol;
}

// On the rollups every tx is counted as a new block
// so it isn't possible to get the balance 10 mins ago
// we hardcode 1000 to get an older balance
function getBlocksIn10Minutes(network) {
  switch (network) {
    case '1': return 50; // 12 seconds per block
    case '10': return 1000; // rollup
    case '56': return 120; // 5 seconds per block
    case '137': return 260; // 2.3 seconds per block
    case '250': return 500; // 1.2 seconds per block
    case '42161': return 1000; // rollup
    case '43114': return 200; // 3 seconds per block
    default: return 1000;
  }
}

const handleTransaction = async (txEvent) => {
  const { blockNumber, network } = txEvent;

  const events = txEvent.filterLog(ERC20_TRANSFER_EVENT);

  let findings = await Promise.all(events.map(async (event) => {
    const { address } = event;
    const { from, value } = event.args;

    // check if from is contract
    const type = await getAddressType(from);
    if (type !== AddressType.Contract) return null;

    // get it's balance from the last block
    const contract = new ethers.Contract(address, TOKEN_ABI, provider);

    const oldBalance = await contract.balanceOf(from, { blockTag: blockNumber - 1 });

    // Skip if address received all of its assets in the same block
    if (oldBalance.eq(ZERO)) return null;

    if (oldBalance.eq(value)) {
      // Get the balance from 10 minutes ago
      // If it is zero then the address is probably a forwarder
      const block10MinsAgo = blockNumber - getBlocksIn10Minutes(network);
      const balance10MinsAgo = await contract.balanceOf(from, { blockTag: block10MinsAgo });

      if (balance10MinsAgo.eq(ZERO)) {
        console.log(`${from} is probably a forwarder; ignoring`);
        cachedAddresses.set(from, AddressType.Ignored);
        return null;
      }

      const symbol = await getAssetSymbol(contract);
      return Finding.fromObject({
        name: 'Asset drained',
        description: `All ${symbol} tokens were drained from ${from}`,
        alertId: 'ASSET-DRAINED',
        severity: FindingSeverity.High,
        type: FindingType.Exploit,
        metadata: {
          contract: from,
          asset: address,
        },
      });
    }

    return null;
  }));

  // Remove null elements
  findings = findings.filter((f) => !!f);

  return findings;
};

let lastCheck = 0;
const ONE_MONTH = 60 * 60 * 24 * 30;

const handleBlock = async (blockEvent) => {
  const { timestamp, number } = blockEvent.block;
  console.log(`Handling block ${number} at ${new Date()}`);

  // Clear the ignored contracts every month
  if (timestamp - lastCheck > ONE_MONTH) {
    cachedAddresses.entries(([address, type]) => {
      if (type === AddressType.Ignored) cachedAddresses.delete(address);
    });

    lastCheck = timestamp;
  }

  return [];
};

module.exports = {
  handleTransaction,
  handleBlock,
};
