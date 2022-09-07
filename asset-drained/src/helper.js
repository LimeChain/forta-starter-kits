/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
const { ethers, getEthersProvider } = require('forta-agent');
const AddressType = require('./address-type');

const TOKEN_ABI = [
  'function balanceOf(address) public view returns (uint256)',
  'function symbol() external view returns (string memory)',
];

// On the rollups every tx is counted as a new block
// so it isn't possible to get the balance 10 mins ago
// we hardcode 1000 to get an older balance
function getBlocksIn10Minutes(network) {
  switch (network) {
    case 1: return 50; // 12 seconds per block
    case 10: return 1000; // rollup
    case 56: return 120; // 5 seconds per block
    case 137: return 260; // 2.3 seconds per block
    case 250: return 500; // 1.2 seconds per block
    case 42161: return 1000; // rollup
    case 43114: return 200; // 3 seconds per block
    default: return 1000;
  }
}

function hashCode(address, asset) {
  const str = address + asset;
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash; // Convert to 32bit integer
  }
  return hash;
}

async function getAddressType(address, cachedAddresses) {
  if (cachedAddresses.has(address)) {
    return cachedAddresses.get(address);
  }

  const code = await getEthersProvider().getCode(address);
  const type = (code === '0x') ? AddressType.Eoa : AddressType.Contract;
  cachedAddresses.set(address, type);
  return type;
}

async function getAssetSymbol(address, cachedAssetSymbols) {
  if (address === 'native') return 'native';

  const contract = new ethers.Contract(address, TOKEN_ABI, getEthersProvider());
  if (cachedAssetSymbols.has(address)) {
    return cachedAssetSymbols.get(address);
  }

  const symbol = await contract.symbol();
  cachedAssetSymbols.set(address, symbol);
  return symbol;
}

module.exports = {
  getBlocksIn10Minutes,
  hashCode,
  getAddressType,
  getAssetSymbol,
};
