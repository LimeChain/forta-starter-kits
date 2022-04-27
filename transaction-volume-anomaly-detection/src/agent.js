const {
  Finding,
  FindingSeverity,
  FindingType,
  getTransactionReceipt,
  ethers,
} = require("forta-agent");

const {
  timeSeriesGranularity,
  SensitivityHighNumberSuccessfulTx,
  SensitivityHighNumberSuccessfulInternalTx,
  SensitivityHighNumberFailedTx,
  SensitivityHighNumberFailedInternalTx,
  contractAddress,
  eventABI,
} = require("./agent.config");
const RollingMath = require("rolling-math");
const BigNumber = require("bignumber.js");
const rollingMath = new RollingMath(timeSeriesGranularity);
const rollingMathInternalTx = new RollingMath(timeSeriesGranularity);
const rollingMathFailedTx = new RollingMath(timeSeriesGranularity);
const rollingMathFailedInternalTx = new RollingMath(timeSeriesGranularity);

let isRunning = false;
let std;
let totalCountInBucket;
let totalCountInBucketFailed;
let stdFailed;
let successfulTransactions = 0;
let failedTransactions = 0;
const handleTransaction = async (txEvent) => {
  const findings = [];

  if (txEvent.to == contractAddress) {
    const { status } = await getTransactionReceipt(txEvent.hash);
    if (status) {
      successfulTransactions++;
    } else if (!status) {
      failedTransactions++;
    }
  }

  return findings;
};

const handleBlock = async (blockEvent) => {
  const findings = [];
  if (successfulTransactions != 0)
    rollingMath.addElement(new BigNumber(successfulTransactions));
  if (failedTransactions != 0)
    rollingMathFailedTx.addElement(new BigNumber(failedTransactions));
  successfulTransactions = 0;
  failedTransactions = 0;
  std = rollingMath.getStandardDeviation().toNumber();
  totalCountInBucket = rollingMath.getNumElements();
  stdFailed = rollingMathFailedTx.getStandardDeviation().toNumber();
  totalCountInBucketFailed = rollingMathFailedTx.getNumElements();

  console.log(std, totalCountInBucket);
  console.log(stdFailed, totalCountInBucketFailed);

  if (totalCountInBucket == timeSeriesGranularity) {
    if (std > SensitivityHighNumberSuccessfulTx) {
      findings.push(
        Finding.fromObject({
          name: "Unusually high number of successful transactions",
          description: `Significant increase of successful transactions have been observed from ${
            blockEvent.blockNumber - timeSeriesGranularity
          } to ${blockEvent.blockNumber}`,
          alertId: "SUCCESSFUL-TRANSACTION-VOL-INCREASE",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            COUNT: std,
            EXPECTED_BASELINE: SensitivityHighNumberSuccessfulTx,
          },
        })
      );
    }
  }

  if (totalCountInBucketFailed == timeSeriesGranularity) {
    if (stdFailed > SensitivityHighNumberSuccessfulTx) {
      findings.push(
        Finding.fromObject({
          name: "Unusually high number of failed transactions",
          description: `Significant increase of failed transactions have been observed from  ${
            blockEvent.blockNumber - timeSeriesGranularity
          } to ${blockEvent.blockNumber}`,
          alertId: "FAILED-TRANSACTION-VOL-INCREASE",
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
          metadata: {
            COUNT: stdFailed,
            EXPECTED_BASELINE: SensitivityHighNumberFailedTx,
          },
        })
      );
    }
  }
  return findings;
};

async function runJob(blockEvent) {
  std = rollingMath.getStandardDeviation().toNumber();
  totalCountInBucket = rollingMath.getNumElements();
  stdFailed = rollingMathFailedTx.getStandardDeviation().toNumber();
  totalCountInBucketFailed = rollingMathFailedTx.getNumElements();
  let successfulTransactions = 0;
  let failedTransactions = 0;
  const transactions = blockEvent.block.transactions;
  for (let tx of transactions) {
    if (tx.to == contractAddress) {
      console.log("Caught");
      const { status } = await getTransactionReceipt(tx);
      if (status) {
        successfulTransactions++;
      } else {
        failedTransactions++;
      }
    }
  }
  rollingMath.addElement(new BigNumber(successfulTransactions));
  rollingMathFailedTx.addElement(new BigNumber(failedTransactions));
  successfulTransactions = 0;
  failedTransactions = 0;
}

module.exports = {
  handleTransaction,
  handleBlock,
};
