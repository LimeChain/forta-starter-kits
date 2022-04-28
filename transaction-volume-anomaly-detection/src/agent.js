const {
  Finding,
  FindingSeverity,
  FindingType,
  getTransactionReceipt,
  ethers,
} = require("forta-agent");
const RollingMath = require("rolling-math");
const BigNumber = require("bignumber.js");
const { bucketBlockSize, contractList } = require("./agent.config");
const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");
const contractBuckets = [];

const initialize = async () => {
  //Here we create the array containing all TimeSeriesAnalysisFields
  for (let contract of contractList) {
    const TimeSeriesAnalysisObj = {};
    TimeSeriesAnalysisObj[contract] = {
      successfulTx: new TimeSeriesAnalysis(contract, bucketBlockSize),
      failedTx: new TimeSeriesAnalysis(contract, bucketBlockSize),
      successfulInternalTx: new TimeSeriesAnalysis(contract, bucketBlockSize),
      failedInternalTx: new TimeSeriesAnalysis(contract, bucketBlockSize),
    };
    contractBuckets.push(TimeSeriesAnalysisObj);
  }
};

const handleTransaction = async (txEvent) => {
  const findings = [];
  const found = contractList.findIndex((c) => c == txEvent.to);
  if (found != -1) {
    const TimeSeriesAnalysisForTx = contractBuckets[found][contractList[found]];
    const { status } = await getTransactionReceipt(txEvent.hash);
    if (status) {
      TimeSeriesAnalysisForTx.successfulTx.AddTransaction(txEvent);
    } else if (!status) {
      TimeSeriesAnalysisForTx.failedTx.AddTransaction(txEvent);
    }
  }

  return findings;
};

const handleBlock = async (blockEvent) => {
  const findings = [];

  for (let TimeSeriesAnalysisBucket of contractBuckets) {
    const TimeSeriesAnalysisBuckets = Object.values(TimeSeriesAnalysisBucket);
    const TimeSeriesAnalysisSuccessfulTx =
      TimeSeriesAnalysisBuckets[0].successfulTx;
    const TimeSeriesAnalysisFailedTx = TimeSeriesAnalysisBuckets[0].failedTx;

    if (TimeSeriesAnalysisSuccessfulTx.IsFull()) {
      const std = TimeSeriesAnalysisSuccessfulTx.GetStdAvgForAllData();
      console.log(std);
    }
  }

  // if (totalCountInBucket == timeSeriesGranularity) {
  //   if (std > SensitivityHighNumberSuccessfulTx) {
  //     findings.push(
  //       Finding.fromObject({
  //         name: "Unusually high number of successful transactions",
  //         description: `Significant increase of successful transactions have been observed from ${
  //           blockEvent.blockNumber - timeSeriesGranularity
  //         } to ${blockEvent.blockNumber}`,
  //         alertId: "SUCCESSFUL-TRANSACTION-VOL-INCREASE",
  //         severity: FindingSeverity.Low,
  //         type: FindingType.Suspicious,
  //         metadata: {
  //           COUNT: std,
  //           EXPECTED_BASELINE: SensitivityHighNumberSuccessfulTx,
  //         },
  //       })
  //     );
  //   }
  // }

  // if (totalCountInBucketFailed == timeSeriesGranularity) {
  //   if (stdFailed > SensitivityHighNumberSuccessfulTx) {
  //     findings.push(
  //       Finding.fromObject({
  //         name: "Unusually high number of failed transactions",
  //         description: `Significant increase of failed transactions have been observed from  ${
  //           blockEvent.blockNumber - timeSeriesGranularity
  //         } to ${blockEvent.blockNumber}`,
  //         alertId: "FAILED-TRANSACTION-VOL-INCREASE",
  //         severity: FindingSeverity.High,
  //         type: FindingType.Exploit,
  //         metadata: {
  //           COUNT: stdFailed,
  //           EXPECTED_BASELINE: SensitivityHighNumberFailedTx,
  //         },
  //       })
  //     );
  //   }
  // }
  return findings;
};

// async function runJob(blockEvent) {
//   std = rollingMath.getStandardDeviation().toNumber();
//   totalCountInBucket = rollingMath.getNumElements();
//   stdFailed = rollingMathFailedTx.getStandardDeviation().toNumber();
//   totalCountInBucketFailed = rollingMathFailedTx.getNumElements();
//   let successfulTransactions = 0;
//   let failedTransactions = 0;
//   const transactions = blockEvent.block.transactions;
//   for (let tx of transactions) {
//     if (tx.to == contractAddress) {
//       console.log("Caught");
//       const { status } = await getTransactionReceipt(tx);
//       if (status) {
//         successfulTransactions++;
//       } else {
//         failedTransactions++;
//       }
//     }
//   }
//   rollingMath.addElement(new BigNumber(successfulTransactions));
//   rollingMathFailedTx.addElement(new BigNumber(failedTransactions));
//   successfulTransactions = 0;
//   failedTransactions = 0;
// }

module.exports = {
  initialize,
  handleTransaction,
  handleBlock,
};
