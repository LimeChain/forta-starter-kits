const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
} = require("forta-agent");
const ARIMA = require("arima");
const { contract1, contract2, tokens: t } = require("../bot-config.json");

const INTERVAL = 3600; // 1 hour

const secondsPerYear = 60 * 60 * 24 * 365;
const periodsPerYear = Math.floor(secondsPerYear / INTERVAL);

const arima = new ARIMA({
  p: 1,
  d: 0,
  q: 1,
  verbose: false,
});

const ABI = [
  "function balanceOf(address) public view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const provider1 = new ethers.providers.JsonRpcProvider(contract1.rpcUrl);
const provider2 = new ethers.providers.JsonRpcProvider(contract2.rpcUrl);

// Each token has 2 contracts
const tokens = t.map((token) => ({
  timeSeries: [],
  decimals: 0,
  tokenContract1: new ethers.Contract(token.address1, ABI, provider1),
  tokenContract2: new ethers.Contract(token.address2, ABI, provider2),
}));

let chainId1;
let chainId2;
let lastTimestamp = 0;

function provideInitialize(prov1, prov2, tokensObj) {
  return async function initialize() {
    chainId1 = (await prov1.getNetwork()).chainId;
    chainId2 = (await prov2.getNetwork()).chainId;

    const decimals = await Promise.all(
      tokensObj.map(async (token) => token.tokenContract1.decimals())
    );

    decimals.forEach((dec, i) => {
      tokens[i].decimals = dec;
    });
  };
}

function provideHandleBlock(tokensData) {
  return async function handleBlock(blockEvent) {
    let findings = [];
    const { timestamp } = blockEvent.block;

    // Check the price once every INTERVAL
    if (timestamp < lastTimestamp + INTERVAL) return findings;

    findings = await Promise.all(
      tokensData.map(async (token) => {
        const { tokenContract1, tokenContract2, decimals, timeSeries } = token;
        let tempFinding = null;

        // Get the token balance for both bridge contracts
        const balance1 = await tokenContract1.balanceOf(contract1.address);
        const balance2 = await tokenContract2.balanceOf(contract2.address);

        // Keep only 2 decimals because ARIMA doesn't work well with a lot of decimals
        let difference = ethers.utils.formatUnits(
          balance1.sub(balance2),
          decimals
        );
        difference = parseFloat((+difference).toFixed(2));

        if (timeSeries.length > 10) {
          arima.train(timeSeries);
          const [pred, err] = arima.predict(1).flat();

          // Calculate the 95% confidence interval
          const high = pred + 1.96 * Math.sqrt(err);
          console.log(
            "Difference: ",
            difference,
            "High: ",
            high,
            "Should Alert: ",
            difference > high
          );
          if (difference > high) {
            tempFinding = Finding.fromObject({
              name: "Bridge Balance Difference Bot",
              description: `${contract1.address} (Chain: ${chainId1}) shows statistically significant difference to the other side of the bridge ${contract2.address} (Chain: ${chainId2})`,
              alertId: "BRIDGE-BALANCE-DIFFERENCE",
              severity: FindingSeverity.High,
              type: FindingType.Suspicious,
            });
          }
        }

        // Add the current diff to the time series
        timeSeries.push(difference);

        // Only keep data for the last 1 year
        if (timeSeries.length > periodsPerYear) timeSeries.shift();
        return tempFinding;
      })
    );

    lastTimestamp = timestamp;

    // Filter out null elements
    findings = findings.filter((f) => !!f);
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(provider1, provider2, tokens),
  provideHandleBlock,
  handleBlock: provideHandleBlock(tokens),
  resetLastTimestamp: () => {
    lastTimestamp = 0;
  }, // Used in unit tests
};
