/*
Here's a brief explanation of how this class works:
- In the agent we detect a transaction and determine if its a mint or borrow one
- Based on that input we either handle it here as a mint or borrow 
- If its a mint we:
    - Add tx-hash
    - Add asset minted 
    - Add asset minted count
    - Add asset contract address
    - Increment mintsForRange
    - Increment total assets minted only if its not duplicate
    - Add standardDeviation to MintStandardDeviationsForRange
- If its a borrow we do the same as mint but to the correct fields
*/

const { default: BigNumber } = require("bignumber.js");
const RollingMath = require("rolling-math");

class TimeAnomalyDetection {
  constructor(addressTracked, aggregationTimePeriod) {
    this.addressTracked = addressTracked;
    this.aggregationTimePeriod = aggregationTimePeriod;
    this.mintBucket = new RollingMath(aggregationTimePeriod);
    this.borrowBucket = new RollingMath(aggregationTimePeriod);
    this.totalMintTransactions = 0;
    this.totalBorrowTransactions = 0;
    this.MintStandardDeviationsForRange = [];
    this.BorrowStandardDeviationsForRange = [];
    this.mintsForRange = 0;
    this.borrowsForRange = 0;
    this.totalAssetsMinted = 0;
    this.totalAssetsBorrowed = 0;
    this.trackingMints = [];
    this.trackingBorrows = [];
    this.lastBlock = 0;
    this.currentBlock = 0;
  }

  AddMintTx(tx) {
    if (tx.block.number != this.currentBlock && this.currentBlock != 0) {
      this.UpdateBlock(tx.block.number);
      this.AddToMintBucket();
      this.totalMintTransactions++;
    } else if (tx.block.number == this.currentBlock) {
      this.totalMintTransactions++;
    } else if (this.currentBlock == 0) {
      this.totalMintTransactions++;
      this.UpdateCurrentBlock(tx.block.number);
    }
    this.AddToMints(tx.to, tx.from, tx.transaction.hash);
  }

  AddBorrowTx(tx) {
    if (tx.block.number != this.currentBlock && this.currentBlock != 0) {
      this.UpdateBlock(tx.block.number);
      this.AddToBorrowBucket();
      this.totalBorrowTransactions++;
    } else if (tx.block.number == this.currentBlock) {
      this.totalBorrowTransactions++;
    } else if (this.currentBlock == 0) {
      this.totalBorrowTransactions++;

      this.UpdateCurrentBlock(tx.block.number);
    }
    this.AddToBorrows(tx.to, tx.from, tx.transaction.hash);
  }

  AddToMints(mintedAssetAccount, minterAccount, txHash, blockNumber) {
    this.mintsForRange++;
    const found = this.trackingMints.find(
      (t) => t.mintedAssetAccount == mintedAssetAccount
    );
    if (!found) {
      this.totalAssetsMinted++;
    }

    const trackingObject = {
      mintedAssetAccount,
      minterAccount,
      txHash,
      blockNumber,
    };
    this.trackingMints.push(trackingObject);
    this.CheckForPassedThresholdMints();
  }

  AddToBorrows(borrowedAssetAccount, borrowerAccount, txHash, blockNumber) {
    this.borrowsForRange++;
    const found = this.trackingBorrows.find(
      (t) => t.borrowedAssetAccount == borrowedAssetAccount
    );
    if (!found) {
      this.totalAssetsBorrowed++;
    }

    const trackingObject = {
      borrowedAssetAccount,
      borrowerAccount,
      txHash,
      blockNumber,
    };
    this.trackingBorrows.push(trackingObject);
    this.CheckForPassedThresholdBorrows();
  }

  CheckForPassedThresholdMints() {
    const trackedToRemove = [];
    let totalMintsRemoved = [];
    for (let t of this.trackingMints) {
      if (this.currentBlock + this.aggregationTimePeriod > t.blockNumber) {
        trackedToRemove.push(t);
      }
    }
    totalMintsRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });
    this.trackingMints = this.trackingMints.filter(
      (t) => !trackedToRemove.includes(t)
    );

    //Decrease total mints for range by the amount of removed approvals that expired
    this.totalAssetsMinted = this.totalAssetsMinted - totalMintsRemoved.length;

    //Decrease the total count of assets minted by the amount removed that expired
    // this. =
    this.mintsForRange = this.mintsForRange - trackedToRemove.length;
  }

  CheckForPassedThresholdBorrows() {
    const trackedToRemove = [];
    let totalBorrowsRemoved = [];
    for (let t of this.trackingBorrows) {
      if (this.currentBlock + this.aggregationTimePeriod > t.blockNumber) {
        trackedToRemove.push(t);
      }
    }
    totalBorrowsRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });
    this.trackingBorrows = this.trackingBorrows.filter(
      (t) => !trackedToRemove.includes(t)
    );

    //Decrease total mints for range by the amount of removed approvals that expired
    this.totalAssetsBorrowed =
      this.totalAssetsBorrowed - totalBorrowsRemoved.length;

    //Decrease the total count of assets minted by the amount removed that expired
    // this. =
    this.borrowsForRange = this.borrowsForRange - trackedToRemove.length;
  }

  AddToMintBucket() {
    this.mintBucket.addElement(new BigNumber(this.totalMintTransactions));
    if (
      this.MintStandardDeviationsForRange.length > this.aggregationTimePeriod
    ) {
      this.MintStandardDeviationsForRange.shift();
    }

    if (
      this.MintStandardDeviationsForRange.length > this.aggregationTimePeriod
    ) {
      this.MintStandardDeviationsForRange.shift();
    }

    this.MintStandardDeviationsForRange.push(
      this.mintBucket.getStandardDeviation().toNumber()
    );

    this.totalMintTransactions = 0;
  }

  AddToBorrowBucket() {
    this.borrowBucket.addElement(new BigNumber(this.totalBorrowTransactions));
    if (
      this.BorrowStandardDeviationsForRange.length > this.aggregationTimePeriod
    ) {
      this.BorrowStandardDeviationsForRange.shift();
    }

    if (
      this.BorrowStandardDeviationsForRange.length > this.aggregationTimePeriod
    ) {
      this.BorrowStandardDeviationsForRange.shift();
    }

    this.BorrowStandardDeviationsForRange.push(
      this.borrowBucket.getStandardDeviation().toNumber()
    );

    this.totalBorrowTransactions = 0;
  }

  UpdateBlock(blockNumber) {
    if (this.currentBlock != this.lastBlock) {
      this.lastBlock = this.currentBlock;
      this.currentBlock = blockNumber;
    }
  }

  UpdateCurrentBlock(blockNumber) {
    this.currentBlock = blockNumber;
  }

  GetSTDLatestForMintBucket() {
    return this.mintBucket.getStandardDeviation().toNumber();
  }

  GetSTDLatestForBorrowBucket() {
    return this.borrowBucket.getStandardDeviation().toNumber();
  }

  GetTotalForLastMintBucket() {
    return this.mintBucket.getSum().toNumber();
  }

  GetTotalForLastBorrowBucket() {
    return this.borrowBucket.getSum().toNumber();
  }

  GetBaselineForLastMintBucket() {
    return this.mintBucket.getAverage().toNumber();
  }

  GetBaselineForLastBorrowBucket() {
    return this.borrowBucket.getAverage().toNumber();
  }

  //We need the SMA to calculate the EMA for all transactions
  SimpleMovingAverage(prices, window, n = Infinity) {
    let index = window - 1;
    const length = prices.length + 1;

    const simpleMovingAverages = [];

    let numberOfSMAsCalculated = 0;

    while (++index < length && numberOfSMAsCalculated++ < n) {
      const windowSlice = prices.slice(index - window, index);
      const sum = windowSlice.reduce((prev, curr) => prev + curr, 0);
      simpleMovingAverages.push(sum / window);
    }

    return simpleMovingAverages;
  }

  GetNormalMarginOfDifferences(stdForAll) {
    let marginCurrent = 0;

    let index = this.aggregationTimePeriod - 1;
    const length = stdForAll.length;
    let previousEmaIndex = 0;
    const smoothingFactor = 2 / (this.aggregationTimePeriod + 1);
    const exponentialMovingAvg = [];
    const [sma] = this.SimpleMovingAverage(
      stdForAll,
      this.aggregationTimePeriod,
      1
    );
    exponentialMovingAvg.push(sma);
    while (++index < length) {
      const value = stdForAll[index];
      const previousEma = exponentialMovingAvg[previousEmaIndex++];
      const currentEma = (value - previousEma) * smoothingFactor + previousEma;
      exponentialMovingAvg.push(currentEma);
    }

    marginCurrent =
      (exponentialMovingAvg[exponentialMovingAvg.length - 1] -
        exponentialMovingAvg[0]) /
        exponentialMovingAvg.length -
      1;

    return Math.abs(marginCurrent);
  }

  GetMarginForMintBucket() {
    return this.GetNormalMarginOfDifferences(
      this.MintStandardDeviationsForRange
    );
  }

  GetMarginForBorrowBucket() {
    return this.GetNormalMarginOfDifferences(
      this.BorrowStandardDeviationsForRange
    );
  }

  GetIsFullMintBucket() {
    return this.mintBucket.getNumElements() == this.aggregationTimePeriod;
  }

  GetIsFullBorrowBucket() {
    return this.borrowBucket.getNumElements() == this.aggregationTimePeriod;
  }

  GetMintsForFlag() {
    return {
      from_address: this.addressTracked,
      mintedAssetAccount: this.trackingMints[0].mintedAssetAccount,
      numberOfAssets: this.totalAssetsMinted,
      firstTxHash: this.trackingMints[0].txHash,
      lastTxHash: this.trackingMints[this.trackingMints.length - 1].txHash,
      baseline: this.GetBaselineForLastMintBucket(),
    };
  }

  GetBorrowsForFlag() {
    return {
      from_address: this.addressTracked,
      borrowedAssetAccount: this.trackingBorrows[0].borrowedAssetAccount,
      numberOfAssets: this.totalAssetsBorrowed,
      firstTxHash: this.trackingBorrows[0].txHash,
      lastTxHash: this.trackingBorrows[this.trackingBorrows.length - 1].txHash,
      baseline: this.GetBaselineForLastBorrowBucket(),
    };
  }
}

module.exports = TimeAnomalyDetection;
