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
  contractAddress: a,
} = require('../bot-config.json');

const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from, address indexed to, uint256 value)';
const ABI = [
  'function balanceOf(address account) external view returns (uint)',
  'function decimals() external view returns (uint8)',
];

const contractAddress = a.toLowerCase();
const zero = ethers.constants.Zero;

const secondsPerYear = 60 * 60 * 24 * 365;
const periodsPerYear = Math.floor(secondsPerYear / aggregationTimePeriod);

const arima = new ARIMA({
  p: 1,
  d: 0,
  q: 1,
  verbose: false,
});

let lastTimestamp = 0;

// Store the balance and time series for all tokens
const contractAssets = {};

// Store the withdrawn amount and withdraw txs for the current period for all assets
const currentPeriodDecreaseAmounts = {};
const currentPeriodTxs = {};

const handleTransaction = async (txEvent) => {
  const findings = [];
  const balanceChanges = {};

  // Get the events that are from/to the contractAddress
  const events = txEvent
    .filterLog(ERC20_TRANSFER_EVENT)
    .filter((event) => {
      const { address } = event;
      const { from, to } = event.args;

      // Remove the event if it isn't from/to the contractAddress
      if (contractAddress !== from.toLowerCase() && contractAddress !== to.toLowerCase()) {
        return false;
      }

      // Remove the event if it is from the contractAddress
      if (contractAddress === address) {
        return false;
      }

      return true;
    });

  // First check if there are assets with unknown balance
  await Promise.all(events.map(async (event) => {
    const { address: asset } = event;

    // If the asset isn't tracked, set it's balance based on the previous block
    if (!contractAssets[asset]) {
      const contract = new ethers.Contract(asset, ABI, getEthersProvider());
      const decimals = await contract.decimals();
      const balance = await contract.balanceOf(
        contractAddress,
        { blockTag: txEvent.blockNumber - 1 },
      );

      contractAssets[asset] = {
        balance,
        decimals,
        timeSeries: [],
      };
      currentPeriodDecreaseAmounts[asset] = zero;
      currentPeriodTxs[asset] = [];
    }
  }));

  events.forEach((event) => {
    const { address: asset } = event;
    const { from, value } = event.args;

    if (contractAddress === from.toLowerCase()) {
      // Update the balance for the asset and the data for the current period
      currentPeriodTxs[asset].push(txEvent.hash);
      currentPeriodDecreaseAmounts[asset] = currentPeriodDecreaseAmounts[asset].add(value);

      balanceChanges[asset] = (balanceChanges[asset])
        ? balanceChanges[asset].sub(value)
        : value.mul(-1);
    } else {
      // Update the balance for the asset
      balanceChanges[asset] = (balanceChanges[asset])
        ? balanceChanges[asset].add(value)
        : value;
    }
  });

  // Handle native transfers
  if (!contractAssets.native) {
    const balance = await getEthersProvider().getBalance(
      contractAddress,
      txEvent.blockNumber - 1,
    );
    contractAssets.native = {
      balance,
      decimals: 18,
      timeSeries: [],
    };
    currentPeriodDecreaseAmounts.native = zero;
    currentPeriodTxs.native = [];
  }

  txEvent.traces.forEach((trace) => {
    const {
      from,
      to,
      value,
      callType,
    } = trace.action;

    if (value && value !== '0x0' && callType === 'call') {
      // If the trace is a call with non-zero value use the value
      const val = ethers.BigNumber.from(value);

      if (contractAddress === from) {
        currentPeriodTxs.native.push(txEvent.hash);

        balanceChanges.native = (balanceChanges.native)
          ? balanceChanges.native.sub(val)
          : val.mul(-1);
      }
      if (contractAddress === to) {
        balanceChanges.native = (balanceChanges.native)
          ? balanceChanges.native.sub(val)
          : val;
      }
    }
  });

  Object.entries(balanceChanges).forEach(([asset, balanceChange]) => {
    contractAssets[asset].balance = contractAssets[asset].balance.add(balanceChange);

    // Only alert if the current balance is zero and there is a balance change
    if (contractAssets[asset].balance.eq(zero) && !balanceChange.eq(zero)) {
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
  });

  return findings;
};

const handleBlock = async (blockEvent) => {
  const findings = [];
  const { timestamp } = blockEvent.block;

  if (timestamp - lastTimestamp < aggregationTimePeriod) return findings;

  Object.entries(contractAssets).forEach(([asset, data]) => {
    const { timeSeries, balance, decimals } = data;

    const decrease = ethers.utils.formatUnits(
      currentPeriodDecreaseAmounts[asset],
      decimals,
    );

    // Only train if we have enough data
    if (timeSeries.length > 10) {
      arima.train(timeSeries);
      const [pred, err] = arima.predict(1).flat();

      // Calculate the 95% confidence interval
      const threshold = pred + 1.96 * Math.sqrt(err);

      console.log(`Balance decrease for the period: ${decrease}`);
      console.log(`Balance decrease threshold     : ${threshold}`);

      if (decrease > threshold) {
        // Calculate the percentage
        const balanceAmount = ethers.utils.formatUnits(balance, decimals);

        // Return maximum 100%
        const percentage = Math.min((decrease / balanceAmount) * 100, 100);

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
    } else {
      console.log(`Not enough data. ${timeSeries.length}/10 training periods have passed.`);
    }

    // Add the decrease of this period to the time series and reset it
    timeSeries.push(decrease);
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
  getContractAssets: () => contractAssets, // Used in the unit tests
  resetLastTimestamp: () => { lastTimestamp = 0; }, // Used in the unit tests
};
