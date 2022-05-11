const {
  Finding,
  FindingSeverity,
  FindingType,
  getTransactionReceipt,
  getEthersProvider,
} = require("forta-agent");

const {
  bucketBlockSize,
  getContractsByChainId,
  globalSensitivity,
} = require("./agent.config");

const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");
const contractBuckets = [];
let contractListLocal = [];
let isRunningJob = false;
let localFindings = [];
const provider = getEthersProvider();

//Here we init the buckets for all contracts that were predefined
const initialize = async () => {
  const { chainId } = await provider.getNetwork();
  const contractList = getContractsByChainId(chainId);

  contractListLocal = contractList;

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

//If a transaction occurs in a block that is compatible with our requirements add it to the TSA (TimeSeriesAnalysis)
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

      if (txEvent.traces) {
        if (txEvent.traces.length > 0) {
          for (let trace of txEvent.traces) {
            if (!trace.error) {
              TimeSeriesAnalysisForTx.successfulInternalTx.addTransaction(
                txEvent.block.number
              );
            } else if (trace.error) {
              TimeSeriesAnalysisForTx.failedInternalTx.addTransaction(
                txEvent.block.number
              );
            }
          }
        }
      } else {
        const { status } = await getTransactionReceipt(txEvent.hash);

        if (status) {
          TimeSeriesAnalysisForTx.successfulTx.addTransaction(
            txEvent.block.number
          );
        } else if (!status) {
          TimeSeriesAnalysisForTx.failedTx.addTransaction(txEvent.block.number);
        }
      }
    }

    return findings;
  };
}

//Here we do a check once per block if there is anything unusual per requirements
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

//Asynchronously check for findings - needed since there is a lot of evaluations happening in the background
async function runJob(blockEvent, contractBuckets) {
  isRunningJob = true;
  const findings = [];
  for (let TimeSeriesAnalysisBucket of contractBuckets) {
    const TimeSeriesAnalysisBuckets = Object.values(TimeSeriesAnalysisBucket);
    const TimeSeriesAnalysisSuccessfulTx =
      TimeSeriesAnalysisBuckets[0].successfulTx;
    const TimeSeriesAnalysisFailedTx = TimeSeriesAnalysisBuckets[0].failedTx;
    const TimeSeriesAnalysisSuccessfulInternalTx =
      TimeSeriesAnalysisBuckets[0].successfulInternalTx;

    const TimeSeriesAnalysisFailedInternalTx =
      TimeSeriesAnalysisBuckets[0].failedInternalTx;

    if (TimeSeriesAnalysisSuccessfulInternalTx.isFull()) {
      const std =
        TimeSeriesAnalysisSuccessfulInternalTx.getStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisSuccessfulInternalTx.getNormalMarginOfDifferences();

      if (Math.floor(std) * globalSensitivity > normalMargin) {
        const count =
          TimeSeriesAnalysisSuccessfulInternalTx.getTotalForLastBucket();

        const baseline =
          TimeSeriesAnalysisSuccessfulInternalTx.getBaselineForLastBucket();
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

    if (TimeSeriesAnalysisFailedInternalTx.isFull()) {
      const std = TimeSeriesAnalysisFailedInternalTx.getStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisFailedInternalTx.getNormalMarginOfDifferences();

      if (Math.floor(std) * globalSensitivity > normalMargin) {
        const count =
          TimeSeriesAnalysisFailedInternalTx.getTotalForLastBucket();

        const baseline =
          TimeSeriesAnalysisFailedInternalTx.getBaselineForLastBucket();
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

    if (TimeSeriesAnalysisFailedTx.isFull()) {
      const std = TimeSeriesAnalysisFailedTx.getStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisFailedTx.getNormalMarginOfDifferences();

      if (Math.floor(std) * globalSensitivity > normalMargin) {
        const count = TimeSeriesAnalysisFailedTx.getTotalForLastBucket();

        const baseline = TimeSeriesAnalysisFailedTx.getBaselineForLastBucket();
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
    if (TimeSeriesAnalysisSuccessfulTx.isFull()) {
      const std = TimeSeriesAnalysisSuccessfulTx.getStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisSuccessfulTx.getNormalMarginOfDifferences();

      if (Math.floor(std) * globalSensitivity > normalMargin) {
        const count = TimeSeriesAnalysisSuccessfulTx.getTotalForLastBucket();

        const baseline =
          TimeSeriesAnalysisSuccessfulTx.getBaselineForLastBucket();
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
