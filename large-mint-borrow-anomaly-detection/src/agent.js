const {
  Finding,
  FindingSeverity,
  FindingType,

  ethers,
} = require("forta-agent");

const { bucketBlockSize, commonEventSigs } = require("./agent.config");

const ADDRESS_ZERO = ethers.constants.AddressZero;
const TimeAnomalyDetection = require("./TimeAnomalyDetection");
const trackerBuckets = [];
let isRunningJob = false;
let localFindings = [];

const createTrackerBucket = (address, trackerBuckets) => {
  trackerBuckets.push(new TimeAnomalyDetection(address, bucketBlockSize));
};

const alreadyTracked = (address, trackerBuckets) => {
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
      const { minter, mintTokens } = tx.args; // These are for a generic mint event
      const { borrower, borrowAmount } = tx.args; //These are for a generic borrow event
      if (from) {
        if (from == ADDRESS_ZERO) {
          const index = alreadyTracked(to, trackerBuckets);

          if (index != -1) {
            const TimeSeriesAnalysisForTX = trackerBuckets[index];
            TimeSeriesAnalysisForTX.AddMintTx(txEvent, value);
          } else if (index == -1) {
            createTrackerBucket(to, trackerBuckets);
            const TimeSeriesAnalysisForTX =
              trackerBuckets[trackerBuckets.length - 1];
            TimeSeriesAnalysisForTX.AddMintTx(txEvent, value);
          }
        }
      } else if (_reserve) {
        const index = alreadyTracked(_user, trackerBuckets);

        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent, _amount);
        } else if (index == -1) {
          createTrackerBucket(_user, trackerBuckets);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent, _amount);
        }
      } else if (minter) {
        const index = alreadyTracked(minter, trackerBuckets);
        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.AddMintTx(txEvent, mintTokens);
        } else if (index == -1) {
          createTrackerBucket(minter, trackerBuckets);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.AddMintTx(txEvent, mintTokens);
        }
      } else if (borrower) {
        const index = alreadyTracked(borrower, trackerBuckets);
        if (index != -1) {
          const TimeSeriesAnalysisForTX = trackerBuckets[index];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent, borrowAmount);
        } else if (index == -1) {
          createTrackerBucket(borrower, trackerBuckets);
          const TimeSeriesAnalysisForTX =
            trackerBuckets[trackerBuckets.length - 1];
          TimeSeriesAnalysisForTX.AddBorrowTx(txEvent, borrowAmount);
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
    const isFullMintBucket = tracker.GetIsFullMintBucket();
    const isFullBorrowBucket = tracker.GetIsFullBorrowBucket();

    if (Math.floor(mintSTD) > normalMarginForMints && isFullMintBucket) {
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

    if (Math.floor(borrowSTD) > normalMarginForBorrows && isFullBorrowBucket) {
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
            ASSET_IMPACTED: findingData.borrowedAssetAccount,
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
  handleTransaction: provideHandleTransaction(trackerBuckets),
  handleBlock: provideHandleBlock(trackerBuckets),
  provideHandleTransaction,
  provideHandleBlock,
};
