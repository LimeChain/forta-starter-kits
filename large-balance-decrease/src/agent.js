const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
  ethers,
} = require('forta-agent');
const ARIMA = require('arima');
const {
  aggregationTimePeriod,
  address: a,
} = require('../bot-config.json');

const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from, address indexed to, uint256 value)';
const ABI = ['function balanceOf(address account) external view returns (uint)'];

const contractAddress = a.toLowerCase();
const zero = ethers.constants.Zero;

const secondsPerYear = 60 * 60 * 24 * 365;
const periodsPerYear = Math.floor(secondsPerYear / aggregationTimePeriod);

// Find best params
const arima = new ARIMA({
  p: 1,
  d: 0,
  q: 1,
  verbose: false,
});

let lastTimestamp = Date.now();

// Store the balance and time series for all tokens
const contractAssets = {};

// Store the withdrawn amount and withdraw txs for the current period for all assets
const currentPeriodDecreaseAmounts = {};
const currentPeriodTxs = {};

const handleTransaction = async (txEvent) => {
  const findings = [];

  // Get the events that are from/to the contractAddress
  const events = txEvent
    .filterLog(ERC20_TRANSFER_EVENT)
    .filter((event) => {
      const { from, to } = event.args;
      return (contractAddress === from.toLowerCase() || contractAddress === to.toLowerCase());
    });

  // First check if there are assets with unknown balance
  await Promise.all(events.map(async (event) => {
    const { address: asset } = event;

    // If the asset isn't tracked, set it's balance based on the previous block
    if (!contractAssets[asset]) {
      const contract = new ethers.Contract(asset, ABI, getEthersProvider());
      const balance = await contract.balanceOf(
        contractAddress,
        { blockTag: txEvent.blockNumber - 1 },
      );

      // Mock the prev balance (REMOVE!!!)
      // const balance = ethers.BigNumber.from('156629158238930877722356');

      contractAssets[asset] = {
        balance,
        timeSeries: [],
      };
      currentPeriodDecreaseAmounts[asset] = zero;
      currentPeriodTxs[asset] = [];
    }
  }));

  events.forEach(async (event) => {
    const { address: asset } = event;
    const { from, value } = event.args;

    const isSender = (contractAddress === from.toLowerCase());

    if (isSender) {
      currentPeriodTxs[asset].push(txEvent.hash);
      currentPeriodDecreaseAmounts[asset] = currentPeriodDecreaseAmounts[asset].add(value);
      contractAssets[asset].balance = contractAssets[asset].balance.sub(value);

      // Alert if all tokens are withdrawn
      if (contractAssets[asset].balance.eq(zero)) {
        findings.push(Finding.fromObject({
          name: 'Assets removed',
          description: `All ${asset} tokens have been removed from ${contractAddress}.`,
          alertId: 'BALANCE-DECREASE-ASSETS-ALL-REMOVED',
          severity: FindingSeverity.Critical,
          type: FindingType.Exploit,
          metadata: {
            firstTxHash: currentPeriodTxs[asset][0],
            lastTxHash: txEvent.hash,
            assetImpacted: asset,
          },
        }));
      }
    } else {
      contractAssets[asset].balance = contractAssets[asset].balance.add(value);
    }
  });

  return findings;
};

const handleBlock = async (blockEvent) => {
  const findings = [];
  const { timestamp } = blockEvent.block;

  if (timestamp - lastTimestamp < aggregationTimePeriod) return findings;

  Object.entries(contractAssets).forEach(([asset, data]) => {
    const { timeSeries, balance } = data;
    if (timeSeries.length > 10) {
      arima.train(timeSeries);
      const [pred, err] = arima.predict(1).flat();

      // Calculate the 95% confidence interval
      const threshold = pred + 1.96 * Math.sqrt(err);

      if (currentPeriodDecreaseAmounts[asset] > threshold) {
        const decreaseAmount = ethers.utils.formatEther(currentPeriodDecreaseAmounts[asset]);
        const balanceAmount = ethers.utils.formatEther(balance);
        const percentage = (decreaseAmount / balanceAmount) * 100;

        findings.push(Finding.fromObject({
          name: 'Assets significantly decreased',
          description: `A significant amount ${asset} tokens have been removed from ${contractAddress}.`,
          alertId: 'BALANCE-DECREASE-ASSETS-PORTION-REMOVED',
          severity: FindingSeverity.Medium,
          type: FindingType.Exploit,
          metadata: {
            firstTxHash: currentPeriodTxs[asset][0],
            lastTxHash: currentPeriodTxs[asset][currentPeriodTxs[asset].length - 1],
            assetImpacted: asset,
            assetVolumeDecreasePercentage: percentage,
          },
        }));
      }
    }

    // Add the decrease of this period to the time series and reset it
    timeSeries.push(currentPeriodDecreaseAmounts[asset]);
    currentPeriodDecreaseAmounts[asset] = zero;
    currentPeriodTxs[asset] = [];

    // Only keep data for the last 1 year
    if (timeSeries.length > periodsPerYear) timeSeries.shift();
  });

  lastTimestamp = timestamp;

  return findings;
};

module.exports = {
  handleTransaction,
  handleBlock,
};
