const { getEthersProvider, ethers } = require('forta-agent');
const { default: axios } = require('axios');

const CHAINLINK_ABI = [
  'function decimals() external view returns (uint8)',
  'function latestAnswer() public view returns (int256 answer)',
];

const UNISWAP_ABI = [
  'function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)',
  'function token0() public view returns (address token)',
  'function token1() public view returns (address token)',
];

const TOKEN_ABI = ['function decimals() external view returns (uint8)'];

async function getChainlinkPrice(contract, decimals) {
  const answer = await contract.latestAnswer();
  const price = ethers.utils.formatUnits(answer, decimals);
  return parseFloat(price);
}

async function getUniswapPrice(contract, exponent, interval) {
  // return null if uniswap contract is not provided
  if (!contract) return null;

  // Sometimes the observe function fails with "OLD". In this case return null
  try {
    // Get the time-weighted average price for a interval
    const [tickCumulatives] = await contract.observe([interval, 0]);

    const tick = (tickCumulatives[1] - tickCumulatives[0]) / interval;
    const price = (1.0001 ** tick) * (10 ** exponent);
    return price;
  } catch {
    return null;
  }
}

async function getCoingeckoPrice(id) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
  const response = await axios.get(url);
  return response.data[id].usd;
}

function getChainlinkContract(address) {
  return new ethers.Contract(address, CHAINLINK_ABI, getEthersProvider());
}

// Returns the contract and the decimals diff between the 2 tokens
async function getUniswapParams(address) {
  const contract = new ethers.Contract(address, UNISWAP_ABI, getEthersProvider());

  const token0 = await contract.token0();
  const token1 = await contract.token1();

  const token0Contract = new ethers.Contract(token0, TOKEN_ABI, getEthersProvider());
  const token1Contract = new ethers.Contract(token1, TOKEN_ABI, getEthersProvider());

  const token0Decimals = await token0Contract.decimals();
  const token1Decimals = await token1Contract.decimals();

  const exponent = token0Decimals - token1Decimals;

  return [contract, exponent];
}

function calculatePercentage(price1, price2) {
  const percentage = (1 - (price1 / price2)) * 100;
  return +Math.abs(percentage).toFixed(2);
}

module.exports = {
  getChainlinkPrice,
  getUniswapPrice,
  getCoingeckoPrice,
  getChainlinkContract,
  getUniswapParams,
  calculatePercentage,
};
