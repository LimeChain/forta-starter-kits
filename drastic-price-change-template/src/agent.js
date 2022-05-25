const {
  Finding,
  FindingSeverity,
  FindingType,
} = require('forta-agent');
const ARIMA = require('arima');

const { priceDiscrepancyThreshold, asset } = require('./agent.config');
const {
  getChainlinkPrice,
  getCoingeckoPrice,
  getTopTokenHolders,
  getChainlinkContract,
  calculatePercentage,
} = require('./helper');

const INTERVAL = 3600; // 1 hour
const timeSeries = [];

let lastTimestamp = 0;
let chainlinkContract;
let assetDecimals;

// Parameters chosen by finding the model with lowest error and fastest time
// using the hourly uniswap price from coingecko
const arima = new ARIMA({
  p: 5,
  d: 1,
  q: 5,
  verbose: false,
});

function provideInitialize(getChainlinkContractFn) {
  return async function initialize() {
    if (!asset.chainlinkFeedAddress) throw new Error('You need to provide chainlink oracle address');
    if (!asset.coingeckoId) throw new Error('You need to provide coingecko id');

    // Get asset decimals
    chainlinkContract = getChainlinkContractFn(asset.chainlinkFeedAddress);
    assetDecimals = await chainlinkContract.decimals();
  };
}

function provideHandleBlock(
  getChainlinkPriceFn,
  getCoingeckoPriceFn,
  getTopTokenHoldersFn,
) {
  return async function handleBlock(blockEvent) {
    const findings = [];
    const { timestamp } = blockEvent.block;

    // Check the price once every INTERVAL
    if (timestamp < lastTimestamp + INTERVAL) return findings;

    const [chainlinkPrice, coingeckoPrice] = await Promise.all([
      getChainlinkPriceFn(chainlinkContract, assetDecimals),
      getCoingeckoPriceFn(asset.coingeckoId),
    ]);

    if (calculatePercentage(chainlinkPrice, coingeckoPrice) >= priceDiscrepancyThreshold) {
      const addresses = await getTopTokenHoldersFn(asset.contract);
      findings.push(Finding.fromObject({
        name: 'Price discrepancies',
        description: `Assets ${asset.contract} price information deviates significantly `
        + 'from Chainlink and CoinGecko with a price of '
        + `${chainlinkPrice} and ${coingeckoPrice} respectively`,
        alertId: 'PRICE-DISCREPANCIES',
        severity: FindingSeverity.High,
        type: FindingType.Suspicious,
        addresses,
      }));
    }

    if (timeSeries.length > 10) {
      arima.train(timeSeries);
      const [pred, err] = arima.predict(1).flat();

      const [low, high] = [pred - 1.96 * Math.sqrt(err), pred + 1.96 * Math.sqrt(err)];

      if (chainlinkPrice < low || chainlinkPrice > high) {
        const addresses = await getTopTokenHoldersFn(asset.contract);
        findings.push(Finding.fromObject({
          name: 'Significant price fluctuation',
          description: `Assets ${asset.contract} price has experienced significant price fluctuations`,
          alertId: 'PRICE-FLUCTUATIONS',
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          addresses,
        }));
      }
    }

    // Only keep the data for the last ~1 year
    if (timeSeries.length > 8760) timeSeries.shift();

    timeSeries.push(chainlinkPrice);
    lastTimestamp = timestamp;
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(getChainlinkContract),
  provideHandleBlock,
  handleBlock: provideHandleBlock(getChainlinkPrice, getCoingeckoPrice, getTopTokenHolders),
  resetLastTimestamp: () => { lastTimestamp = 0; }, // Exported for unit tests
};
