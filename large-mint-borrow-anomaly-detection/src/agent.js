const {
  Finding,
  FindingSeverity,
  FindingType,

  ethers,
} = require("forta-agent");

const {
  bucketBlockSize,
  commonEventSigs,
  globalSensitivity,
} = require("./agent.config");

const ADDRESS_ZERO = ethers.constants.AddressZero;
const TimeAnomalyDetection = require("./TimeAnomalyDetection");
const trackerBuckets = [];
let isRunningJob = false;
let localFindings = [];

const initialize = () => {
  createTrackerBucket("0xcE4de6ACDC4a039b9F756FD8fE6a8b3799e773eD");
};

const createTrackerBucket = (address) => {
  trackerBuckets.push(new TimeAnomalyDetection(address, bucketBlockSize));
};

const alreadyTracked = (address) => {
  const trackerKeys = [];
  for (let bucket of trackerBuckets) {
    const addressTracked = bucket.addressTracked;
    trackerKeys.push(addressTracked);
  }

  const found = trackerKeys.findIndex((c) => c == address);

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
      const { minter } = tx.args; // These are for a generic mint event
      const { borrower } = tx.args; //These are for a generic borrow event
      if (from) {
        if (from == ADDRESS_ZERO) {
          const index = alreadyTracked(to);

          if (index != -1) {
            const TimeSeriesAnalysisForTX = trackerBuckets[index];
            TimeSeriesAnalysisForTX.AddMintTx(txEvent);
          } else if (index == -1) {
            createTrackerBucket(to);
            const TimeSeriesAnalysisForTX =
              trackerBuckets[trackerBuckets.length - 1];
            TimeSeriesAnalysisForTX.AddMintTx(txEvent);
          }
        }
      } else if (_reserve) {
        const index = alreadyTracked(_user);

        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent);
        } else if (index == -1) {
          createTrackerBucket(_user);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent);
        }
      } else if (minter) {
        const index = alreadyTracked(minter);
        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.AddMintTx(txEvent);
        } else if (index == -1) {
          createTrackerBucket(minter);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.AddMintTx(txEvent);
        }
      } else if (borrower) {
        const index = alreadyTracked(borrower);
        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent);
        } else if (index == -1) {
          createTrackerBucket(borrower);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent);
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
    const mintSTD = tracker.GetSTDLatestForMintBucket();
    const borrowSTD = tracker.GetSTDLatestForBorrowBucket();

    const normalMarginForMints = tracker.GetMarginForMintBucket();
    const normalMarginForBorrows = tracker.GetMarginForBorrowBucket();

    if (Math.floor(mintSTD) > normalMarginForMints) {
      const findingData = tracker.GetMintsForFlag();
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
            BASELINE_VOLUME: findingData.baseline,
          },
        })
      );
    }

    if (Math.floor(borrowSTD) > normalMarginForBorrows) {
      const findingData = tracker.GetBorrowsForFlag();
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
            ASSET_IMPACTED: findingData.mintedAssetAccount,
            BASELINE_VOLUME: findingData.baseline,
          },
        })
      );
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
