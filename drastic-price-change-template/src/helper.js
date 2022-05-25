const { getEthersProvider, ethers } = require('forta-agent');
const { default: axios } = require('axios');

const ABI = [
  'function decimals() external view returns (uint8)',
  'function latestAnswer() public view returns (int256 answer)',
];

async function getChainlinkPrice(contract, decimals) {
  const answer = await contract.latestAnswer();
  const price = ethers.utils.formatUnits(answer, decimals);
  return +parseFloat(price).toFixed(2);
}

async function getCoingeckoPrice(id) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
  const response = await axios.get(url);
  return response.data[id].usd;
}

// Ethplorer only supports ETH
// If we want to support more chains maybe we should keep a
// list with the last X addresses that transfered the token
async function getTopTokenHolders(address) {
  const url = `https://api.ethplorer.io/getTopTokenHolders/${address}?apiKey=freekey&limit=100`;
  const response = await axios.get(url);
  const addresses = response.data.holders.map((e) => e.address);
  return addresses;
}

function getChainlinkContract(address) {
  return new ethers.Contract(address, ABI, getEthersProvider());
}

function calculatePercentage(price1, price2) {
  const percentage = (1 - (price1 / price2)) * 100;
  return +Math.abs(percentage).toFixed(2);
}

module.exports = {
  getChainlinkPrice,
  getCoingeckoPrice,
  getTopTokenHolders,
  getChainlinkContract,
  calculatePercentage,
};
