const {
  Finding,
  FindingSeverity,
  FindingType,
  getTransactionReceipt,
  getEthersProvider,
  ethers,
} = require("forta-agent");

const {
  bucketBlockSize,
  commonEventSigs,
  globalSensitivity,
} = require("./agent.config");

const ADDRESS_ZERO = ethers.constants.AddressZero;
const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");
const trackerBuckets = [];
let isRunningJob = false;
let localFindings = [];
const provider = getEthersProvider();

const initialize = () => {
  createTrackerBucket("0xcE4de6ACDC4a039b9F756FD8fE6a8b3799e773eD");
};

const createTrackerBucket = (address) => {
  const TimeSeriesAnalysisObj = {};
  TimeSeriesAnalysisObj[address] = {
    mintTx: new TimeSeriesAnalysis(address, bucketBlockSize),
    borrowTx: new TimeSeriesAnalysis(address, bucketBlockSize),
  };
  trackerBuckets.push(TimeSeriesAnalysisObj);
};

const alreadyTracked = (address) => {
  const trackerKeys = [];
  for (let bucket of trackerBuckets) {
    const bucketKeys = Object.keys(bucket);
    trackerKeys.push(...bucketKeys);
  }

  const found = trackerKeys.findIndex((c) => c == address);

  return found;
};

//If a tranaction occurs in a block that is compatable with out requirements add it to the TSA (TimeSeriesAnalysis)
function provideHandleTransaction(trackerBuckets, getTransactionReceipt) {
  return async function handleTransaction(txEvent) {
    const findings = [];
    const filtered = txEvent.filterLog(commonEventSigs);
    for (let tx of filtered) {
      const { from, to, value } = tx.args; // These are for the base mint sig which is from the transfer event

      if (from != ADDRESS_ZERO) {
        const index = alreadyTracked(to);

        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index][to];
          TimeSeriesAnalysisForTX.AddTransaction(txEvent);
        } else if (index == -1) {
          createTrackerBucket(to);
        }
      }
    }
    return findings;
  };
}

//Here we do a check once per block if there is anything unusual per requirements
function provideHandleBlock(trackerBuckets) {
  return async function handleBlock(blockEvent) {
    let findings = [];
    if (!isRunningJob) {
      runJob(blockEvent, trackerBuckets);
    }

    if (localFindings.length > 0) {
      findings = localFindings;
      localFindings = [];
    }

    return findings;
  };
}

//Asynchronously check for findings - needed since there is a lot of evaluations happening in the background
async function runJob(blockEvent, trackerBuckets) {
  isRunningJob = true;
  const findings = [];
  for (let TimeSeriesAnalysisBucket of trackerBuckets) {
    const TimeSeriesAnalysisBuckets = Object.values(TimeSeriesAnalysisBucket);
    const TimeSeriesAnalysisSuccessfulTx =
      TimeSeriesAnalysisBuckets[0].successfulTx;
    const TimeSeriesAnalysisFailedTx = TimeSeriesAnalysisBuckets[0].failedTx;
    const TimeSeriesAnalysisSuccessfulInternalTx =
      TimeSeriesAnalysisBuckets[0].successfulInternalTx;

    const TimeSeriesAnalysisFailedInternalTx =
      TimeSeriesAnalysisBuckets[0].failedInternalTx;

    if (TimeSeriesAnalysisSuccessfulInternalTx.IsFull()) {
      const std =
        TimeSeriesAnalysisSuccessfulInternalTx.GetStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisSuccessfulInternalTx.GetNormalMarginOfDifferences();

      if (Math.floor(std) * globalSensitivity > normalMargin) {
        const count =
          TimeSeriesAnalysisSuccessfulInternalTx.GetTotalForLastBucket();

        const baseline =
          TimeSeriesAnalysisSuccessfulInternalTx.GetBaselineForLastBucket();
        findings.push(
          Finding.fromObject({
            name: "Unusually high number of successful internal transactions",
            description: `Significant increase of successful internal transactions have been observed from ${
              blockEvent.blockNumber - bucketBlockSize
            } to ${blockEvent.blockNumber}`,
            alertId: "SUCCESSFUL-INTERNAL-TRANSACTION-VOL-INCREASE",
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

    if (TimeSeriesAnalysisFailedInternalTx.IsFull()) {
      const std = TimeSeriesAnalysisFailedInternalTx.GetStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisFailedInternalTx.GetNormalMarginOfDifferences();

      if (Math.floor(std) * globalSensitivity > normalMargin) {
        const count =
          TimeSeriesAnalysisFailedInternalTx.GetTotalForLastBucket();

        const baseline =
          TimeSeriesAnalysisFailedInternalTx.GetBaselineForLastBucket();
        findings.push(
          Finding.fromObject({
            name: "Unusually high number of failed internal transactions",
            description: `Significant increase of failed internal transactions have been observed from ${
              blockEvent.blockNumber - bucketBlockSize
            } to ${blockEvent.blockNumber}`,
            alertId: "FAILED-INTERNAL-TRANSACTION-VOL-INCREASE",
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {
              COUNT: count,
              EXPECTED_BASELINE: baseline,
            },
          })
        );
      }
    }

    if (TimeSeriesAnalysisFailedTx.IsFull()) {
      const std = TimeSeriesAnalysisFailedTx.GetStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisFailedTx.GetNormalMarginOfDifferences();

      if (Math.floor(std) * globalSensitivity > normalMargin) {
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

      if (Math.floor(std) * globalSensitivity > normalMargin) {
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
    trackerBuckets,
    getTransactionReceipt
  ),
  handleBlock: provideHandleBlock(trackerBuckets),
  provideHandleTransaction,
  provideHandleBlock,
  runJob,
};
