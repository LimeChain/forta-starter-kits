const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
  ethers,
} = require("forta-agent");

const {
  commonEventSigs,
  limitTracked,
  getMinBucketBlockSizeByChainId,
  getBlocktimeByChainId,
} = require("./agent.config");

let { bucketBlockSize, aggregationTimePeriod } = require("./agent.config");

const ARIMA_CONFIG = {
  p: 2,
  d: 1,
  q: 2,
  P: 1,
  D: 0,
  Q: 1,
  s: 5,
  verbose: false,
};
const ADDRESS_ZERO = ethers.constants.AddressZero;
const TimeAnomalyDetection = require("./TimeAnomalyDetection");
const trackerBuckets = [];
const provider = getEthersProvider();

let isRunningJob = false;
let localFindings = [];
let blockTime = 0;

const initialize = async () => {
  const { chainId } = await provider.getNetwork();
  const minBlockSize = getMinBucketBlockSizeByChainId(chainId);
  blockTime = getBlocktimeByChainId(chainId);
  if (bucketBlockSize < minBlockSize) {
    console.warn(
      `Min bucket block size for chainId: ${chainId} is ${minBlockSize}, setting it to that value`
    );
    bucketBlockSize = minBlockSize;
  }
  aggregationTimePeriod = bucketBlockSize * blockTime;
  const seasonality = 604_800 / aggregationTimePeriod; // Calculate the seasonality for a week based on the aggregation time period
  ARIMA_CONFIG.s = seasonality;
};

const createTrackerBucket = (address, trackerBuckets) => {
  if (trackerBuckets.length > limitTracked) {
    trackerBuckets.shift();
  }
  const timeSeriesTemp = new TimeAnomalyDetection(
    address,
    aggregationTimePeriod,
    bucketBlockSize,
    ARIMA_CONFIG
  );

  trackerBuckets.push(timeSeriesTemp);
};

const alreadyTracked = (address, trackerBuckets) => {
  const found = trackerBuckets.findIndex((c) => c.addressTracked == address);
  return found;
};

//If a tranaction occurs in a block that is compatable with out requirements add it to the TSA (TimeSeriesAnalysis)
function provideHandleTransaction(trackerBuckets) {
  return async function handleTransaction(txEvent) {
    const findings = [];
    const filtered = txEvent.filterLog(commonEventSigs);

    for (let tx of filtered) {
      const { from, to, value } = tx.args; // These are for the base mint sig which is from the transfer event
      const { _reserve, _user, _amount } = tx.args; // These are for the Lender Pool borrow tx
      const { minter, mintTokens } = tx.args; // These are for a generic mint event
      const { borrower, borrowAmount } = tx.args; //These are for a generic borrow event
      if (from) {
        if (from == ADDRESS_ZERO) {
          const index = alreadyTracked(to, trackerBuckets);

          if (index != -1) {
            const TimeSeriesAnalysisForTX = trackerBuckets[index];
            TimeSeriesAnalysisForTX.addMintTx(txEvent, value);
          } else if (index == -1) {
            createTrackerBucket(to, trackerBuckets);
            const TimeSeriesAnalysisForTX =
              trackerBuckets[trackerBuckets.length - 1];
            TimeSeriesAnalysisForTX.addMintTx(txEvent, value);
          }
        }
      } else if (_reserve) {
        const index = alreadyTracked(_user, trackerBuckets);

        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.addBorrowTx(txEvent, _amount);
        } else if (index == -1) {
          createTrackerBucket(_user, trackerBuckets);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.addBorrowTx(txEvent, _amount);
        }
      } else if (minter) {
        const index = alreadyTracked(minter, trackerBuckets);
        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.addMintTx(txEvent, mintTokens);
        } else if (index == -1) {
          createTrackerBucket(minter, trackerBuckets);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.addMintTx(txEvent, mintTokens);
        }
      } else if (borrower) {
        const index = alreadyTracked(borrower, trackerBuckets);
        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.addBorrowTx(txEvent, borrowAmount);
        } else if (index == -1) {
          createTrackerBucket(borrower, trackerBuckets);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.addBorrowTx(txEvent, borrowAmount);
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
      runJob(trackerBuckets);
    }

    if (localFindings.length > 0) {
      findings = localFindings;
      localFindings = [];
    }

    return findings;
  };
}

//Asynchronously check for findings - needed since there is a lot of evaluations happening in the background
async function runJob(trackerBuckets) {
  isRunningJob = true;
  const findings = [];

  for (let tracker of trackerBuckets) {
    console.log("Current tracked address:", tracker.addressTracked);
    if (tracker.isTrainedMints) {
      const count = tracker.getCurrentMintedCount();
      const [high, pred] = tracker.getHighAndPredMints();
      console.log("Current minted count:", count);
      console.log("Current predicted max value:", high);
      console.log("Should alert high mints:", count > high);
      if (count > high) {
        const findingData = tracker.getMintsForFlag();
        findings.push(
          Finding.fromObject({
            name: "Large mint volume",
            description: `${findingData.from_address} minted an unusually high number of ${findingData.numberOfAssets} assets ${findingData.mintedAssetAccount}`,
            alertId: "HIGH-MINT-VALUE",
            severity: FindingSeverity.Medium,
            type: FindingType.Exploit,
            metadata: {
              FIRST_TRANSACTION_HASH: findingData.firstTxHash,
              LAST_TRANSACTION_HASH: findingData.lastTxHash,
              ASSET_IMPACTED: findingData.mintedAssetAccount,
              BASELINE_VOLUME: Math.floor(pred),
            },
          })
        );
        tracker.reset();
      }
    }
    if (tracker.isTrainedBorrows) {
      const count = tracker.getCurrentBorrowedCount();
      const [high, pred] = tracker.getHighAndPredBorrows();
      console.log("Current borrow count:", count);
      console.log("Current max predicted borrows:", high);
      console.log("Should alert borrows:", count > high);
      if (count > high) {
        const findingData = tracker.getBorrowsForFlag();
        findings.push(
          Finding.fromObject({
            name: "Large borrow volume",
            description: `${findingData.from_address} borrowed an unusually high number of ${findingData.numberOfAssets} assets ${findingData.borrowedAssetAccount}`,
            alertId: "HIGH-BORROW-VALUE",
            severity: FindingSeverity.Medium,
            type: FindingType.Exploit,
            metadata: {
              FIRST_TRANSACTION_HASH: findingData.firstTxHash,
              LAST_TRANSACTION_HASH: findingData.lastTxHash,
              ASSET_IMPACTED: findingData.borrowedAssetAccount,
              BASELINE_VOLUME: Math.floor(pred),
            },
          })
        );
        tracker.reset();
      }
    }
  }

  isRunningJob = false;
  localFindings = findings;
}

module.exports = {
  initialize,
  handleTransaction: provideHandleTransaction(trackerBuckets),
  handleBlock: provideHandleBlock(trackerBuckets),
  provideHandleTransaction,
  provideHandleBlock,
};
