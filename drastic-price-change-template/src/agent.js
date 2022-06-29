const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} = require("forta-agent");
const ARIMA = require("arima");

const { priceDiscrepancyThreshold, asset } = require("../bot-config.json");
const {
  getChainlinkPrice,
  getUniswapPrice,
  getCoingeckoPrice,
  getChainlinkContract,
  getUniswapParams,
  calculatePercentage,
} = require("./helper");

const ABI = [
  "function balanceOf(address account) external view returns (uint256)",
];
const transferEventSig =
  "event Transfer(address indexed from, address indexed to, uint256 value)";
const assetContract = new ethers.Contract(
  asset.contract,
  ABI,
  getEthersProvider()
);

const INTERVAL = 3600; // 1 hour
const timeSeries = [];

const MAX_TOKEN_HOLDERS = 10000;
const tokenHolders = {};

let lastTimestamp = 0;
let chainlinkContract;
let uniswapContract;
let uniswapExponent;
let assetDecimals;

// Parameters chosen by finding the model with lowest error and fastest time
// using the hourly uniswap price from coingecko
const arima = new ARIMA({
  p: 5,
  d: 1,
  q: 5,
  verbose: false,
});

function provideInitialize(getChainlinkContractFn, getUniswapParamsFn) {
  return async function initialize() {
    if (
      !priceDiscrepancyThreshold ||
      !asset ||
      !asset.chainlinkFeedAddress ||
      !asset.coingeckoId ||
      !asset.contract
    ) {
      throw new Error("You need to provide valid config file");
    }

    // Get asset decimals
    chainlinkContract = getChainlinkContractFn(asset.chainlinkFeedAddress);
    assetDecimals = await chainlinkContract.decimals();

    if (asset.uniswapV3Pool) {
      [uniswapContract, uniswapExponent] = await getUniswapParamsFn(
        asset.uniswapV3Pool
      );
    }
  };
}

// Listen for transfer events to get the token holders
function provideHandleTransaction(contract) {
  return async function handleTransaction(txEvent) {
    const transfers = txEvent.filterLog(transferEventSig, asset.contract);

    if (transfers.length === 0) return [];

    let uniqueAddresses = transfers
      .map((event) => [event.args.from, event.args.to])
      .flat();
    uniqueAddresses = [...new Set(uniqueAddresses)];

    // Get the last block balance for every address that is not tracked
    await Promise.all(
      uniqueAddresses.map(async (address) => {
        if (!tokenHolders[address]) {
          const balance = await contract.balanceOf(address, {
            blockTag: txEvent.blockNumber - 1,
          });
          const balanceNormalized = Number(
            ethers.utils.formatUnits(balance, assetDecimals)
          );
          tokenHolders[address] = balanceNormalized;
        }
      })
    );

    // Update the address balances
    transfers.forEach((event) => {
      const { from, to, value } = event.args;
      const valueNormalized = Number(
        ethers.utils.formatUnits(value, assetDecimals)
      );
      tokenHolders[from] -= valueNormalized;
      tokenHolders[to] += valueNormalized;
    });

    // Always return empty findings
    return [];
  };
}

function provideHandleBlock(
  getChainlinkPriceFn,
  getUniswapPriceFn,
  getCoingeckoPriceFn
) {
  return async function handleBlock(blockEvent) {
    const findings = [];
    const { timestamp } = blockEvent.block;

    // Check the price once every INTERVAL
    if (timestamp < lastTimestamp + INTERVAL) return findings;

    // Get the price from chainlink and coingecko
    const [chainlinkPrice, uniswapPrice, coingeckoPrice] = await Promise.all([
      getChainlinkPriceFn(chainlinkContract, assetDecimals),
      getUniswapPriceFn(uniswapContract, uniswapExponent, INTERVAL),
      getCoingeckoPriceFn(asset.coingeckoId),
    ]);

    console.log(
      "Chainlink Price: ",
      chainlinkPrice,
      "Uniswap Price: ",
      uniswapPrice,
      "Coingecko Price: ",
      coingeckoPrice,
      "Should alert Chainlink and Coingecko: ",
      calculatePercentage(chainlinkPrice, coingeckoPrice) >=
        priceDiscrepancyThreshold,
      "Should alert Chainlink and Uniswap: ",
      calculatePercentage(chainlinkPrice, uniswapPrice) >=
        priceDiscrepancyThreshold
    );
    const addresses = Object.keys(tokenHolders);

    if (
      calculatePercentage(chainlinkPrice, coingeckoPrice) >=
      priceDiscrepancyThreshold
    ) {
      findings.push(
        Finding.fromObject({
          name: "Price discrepancies",
          description:
            `Assets ${asset.contract} price information deviates significantly ` +
            "from Chainlink and CoinGecko with a price of " +
            `${chainlinkPrice} and ${coingeckoPrice} respectively`,
          alertId: "PRICE-DISCREPANCIES",
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          addresses,
        })
      );
    }

    // Only calculate the percentage if the uniswap price is not null
    if (
      uniswapPrice &&
      calculatePercentage(chainlinkPrice, uniswapPrice) >=
        priceDiscrepancyThreshold
    ) {
      findings.push(
        Finding.fromObject({
          name: "Price discrepancies",
          description:
            `Assets ${asset.contract} price information deviates significantly ` +
            "from Chainlink and Uniswap with a price of " +
            `${chainlinkPrice} and ${uniswapPrice} respectively`,
          alertId: "PRICE-DISCREPANCIES",
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          addresses,
        })
      );
    }

    // Only check for anomaly if we have enough data
    if (timeSeries.length > 10) {
      arima.train(timeSeries);
      const [pred, err] = arima.predict(1).flat();

      // Calculate the 95% confidence interval
      const [low, high] = [
        pred - 1.96 * Math.sqrt(err),
        pred + 1.96 * Math.sqrt(err),
      ];

      if (chainlinkPrice < low || chainlinkPrice > high) {
        findings.push(
          Finding.fromObject({
            name: "Significant price fluctuation",
            description: `Assets ${asset.contract} price has experienced significant price fluctuations`,
            alertId: "PRICE-FLUCTUATIONS",
            severity: FindingSeverity.Low,
            type: FindingType.Suspicious,
            addresses,
          })
        );
      }
    }

    // Keep the data for the last ~1 year
    if (timeSeries.length > 8760) timeSeries.shift();

    if (addresses.length > MAX_TOKEN_HOLDERS) {
      const entries = Object.entries(tokenHolders);

      // Sort the holders by their tokens in ascending order
      entries.sort((a, b) => a[1] - b[1]);

      // Delete 10% of the holders based on their balance
      for (let i = 0; i < MAX_TOKEN_HOLDERS / 10; i += 1) {
        delete tokenHolders[entries[i][0]];
      }
    }

    timeSeries.push(chainlinkPrice);
    lastTimestamp = timestamp;
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(getChainlinkContract, getUniswapParams),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(assetContract),
  provideHandleBlock,
  handleBlock: provideHandleBlock(
    getChainlinkPrice,
    getUniswapPrice,
    getCoingeckoPrice
  ),
  getTokenHolders: () => tokenHolders, // Exported for unit tests
  resetLastTimestamp: () => {
    lastTimestamp = 0;
  }, // Exported for unit tests
};
