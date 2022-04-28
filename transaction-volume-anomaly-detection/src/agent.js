const {
  Finding,
  FindingSeverity,
  FindingType,
  getTransactionReceipt,
  ethers,
} = require("forta-agent");

const { bucketBlockSize, contractList } = require("./agent.config");
const compoundContracts = require("./contracts/compound.json");
const makerContracts = require("./contracts/maker.json");
const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");
const contractBuckets = [];
let contractListLocal = [];
let isRunningJob = false;
let localFindings = [];

//Here we init the buckets for all contracts that were predefined
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

//If a tranaction occurs in a block that is compatable with out requirements add it to the TSA (TimeSeriesAnalysis)
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
            const { status } = await getTransactionReceipt(
              trace.transactionHash
            );
            if (status) {
              TimeSeriesAnalysisForTx.successfulInternalTx.AddTransaction(
                txEvent
              );
            } else if (!status) {
              TimeSeriesAnalysisForTx.failedInternalTx.AddTransaction(txEvent);
            }
          }
        }
      } else {
        const { status } = await getTransactionReceipt(txEvent.hash);

        if (status) {
          TimeSeriesAnalysisForTx.successfulTx.AddTransaction(txEvent);
        } else if (!status) {
          TimeSeriesAnalysisForTx.failedTx.AddTransaction(txEvent);
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

    if (TimeSeriesAnalysisSuccessfulInternalTx.IsFull()) {
      const std =
        TimeSeriesAnalysisSuccessfulInternalTx.GetStdForLatestBucket();

      const normalMargin =
        TimeSeriesAnalysisSuccessfulInternalTx.GetNormalMarginOfDifferences();

      if (Math.floor(std) > normalMargin) {
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

      if (Math.floor(std) > normalMargin) {
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
