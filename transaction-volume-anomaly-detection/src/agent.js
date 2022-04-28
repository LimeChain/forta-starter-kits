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
const compoundContracts = require("./contracts/compound.json");
const makerContracts = require("./contracts/maker.json");
const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");
const contractBuckets = [];
let contractListLocal = [];
let isRunningJob = false;
let localFindings = [];

const initialize = async () => {
  const compoundContractValues = Object.values(compoundContracts);
  const makerContractValues = Object.values(makerContracts);
  const contractsFinal = [
    ...contractList,
    ...compoundContractValues,
    ...makerContractValues,
  ];
  contractListLocal = contractsFinal;

  //Here we create the array containing all TimeSeriesAnalysisFields
  for (let contract of contractListLocal) {
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

function provideHandleTransaction(
  contractList,
  contractBuckets,
  getTransactionReceipt
) {
  return async function handleTransaction(txEvent) {
    const findings = [];
    const found = contractList.findIndex((c) => c == txEvent.to);
    if (found != -1) {
      const TimeSeriesAnalysisForTx =
        contractBuckets[found][contractList[found]];
      const { status } = await getTransactionReceipt(txEvent.hash);

      if (status) {
        TimeSeriesAnalysisForTx.successfulTx.AddTransaction(txEvent);
      } else if (!status) {
        TimeSeriesAnalysisForTx.failedTx.AddTransaction(txEvent);
      }
    }

    return findings;
  };
}

function provideHandleBlock(contractBuckets) {
  return async function handleBlock(blockEvent) {
    let findings = [];
    if (!isRunningJob) {
      runJob(blockEvent, contractBuckets);
    }

    if (localFindings.length > 0) {
      findings = localFindings;
      localFindings = [];
    }

    return findings;
  };
}
async function runJob(blockEvent, contractBuckets) {
  isRunningJob = true;
  const findings = [];
  for (let TimeSeriesAnalysisBucket of contractBuckets) {
    const TimeSeriesAnalysisBuckets = Object.values(TimeSeriesAnalysisBucket);
    const TimeSeriesAnalysisSuccessfulTx =
      TimeSeriesAnalysisBuckets[0].successfulTx;
    const TimeSeriesAnalysisFailedTx = TimeSeriesAnalysisBuckets[0].failedTx;
    if (TimeSeriesAnalysisFailedTx.IsFull()) {
      const std = TimeSeriesAnalysisFailedTx.GetStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisFailedTx.GetNormalMarginOfDifferences();

      if (Math.floor(std) > normalMargin) {
        const count = TimeSeriesAnalysisFailedTx.GetTotalForLastBucket();

        const baseline = TimeSeriesAnalysisFailedTx.GetBaselineForLastBucket();
        findings.push(
          Finding.fromObject({
            name: "Unusually high number of failed transactions",
            description: `Significant increase of failed transactions have been observed from  ${
              blockEvent.blockNumber - bucketBlockSize
            } to ${blockEvent.blockNumber}`,
            alertId: "FAILED-TRANSACTION-VOL-INCREASE",
            severity: FindingSeverity.High,
            type: FindingType.Exploit,
            metadata: {
              COUNT: count,
              EXPECTED_BASELINE: baseline,
            },
          })
        );
      }
    }
    if (TimeSeriesAnalysisSuccessfulTx.IsFull()) {
      const std = TimeSeriesAnalysisSuccessfulTx.GetStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisSuccessfulTx.GetNormalMarginOfDifferences();

      if (Math.floor(std) > normalMargin) {
        const count = TimeSeriesAnalysisSuccessfulTx.GetTotalForLastBucket();

        const baseline =
          TimeSeriesAnalysisSuccessfulTx.GetBaselineForLastBucket();
        findings.push(
          Finding.fromObject({
            name: "Unusually high number of successful transactions",
            description: `Significant increase of successful transactions have been observed from ${
              blockEvent.blockNumber - bucketBlockSize
            } to ${blockEvent.blockNumber}`,
            alertId: "SUCCESSFUL-TRANSACTION-VOL-INCREASE",
            severity: FindingSeverity.Low,
            type: FindingType.Suspicious,
            metadata: {
              COUNT: count,
              EXPECTED_BASELINE: baseline,
            },
          })
        );
      }
    }
  }

  isRunningJob = false;
  localFindings = findings;
}

module.exports = {
  initialize,
  handleTransaction: provideHandleTransaction(
    contractListLocal,
    contractBuckets,
    getTransactionReceipt
  ),
  handleBlock: provideHandleBlock(contractBuckets),
  provideHandleTransaction,
  provideHandleBlock,
  runJob,
};
