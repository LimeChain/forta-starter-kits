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
const ARIMA = require("arima");
class TimeAnomalyDetection {
  constructor(
    addressTracked,
    aggregationTimePeriod,
    bucketBlockSize,
    ARIMA_CONFIG
  ) {
    this.addressTracked = addressTracked;
    this.startTimestampMints = 0;
    this.startTimestampBorrows = 0;
    this.aggregationTimePeriod = aggregationTimePeriod;
    this.mintBucket = new ARIMA(ARIMA_CONFIG);
    this.borrowBucket = new ARIMA(ARIMA_CONFIG);
    this.totalAssetsMinted = [];
    this.totalAssetsBorrowed = [];
    this.totalBorrowsForRange = 0;
    this.totalMintsForRange = 0;
    this.trackingMints = [];
    this.trackingBorrows = [];
    this.maxTracked = bucketBlockSize;
    this.isTrainedMints = false;
    this.isTrainedBorrows = false;
  }

  addMintTx(tx, totalMinted) {
    if (this.startTimestampMints == 0) {
      this.startTimestampMints = tx.block.timestamp;
      this.totalAssetsMinted.push(totalMinted);
      this.addToMints(tx.to, tx.from, tx.transaction.hash, totalMinted);
      return;
    }
    if (
      tx.block.timestamp - this.startTimestampMints <=
        this.aggregationTimePeriod &&
      !this.isTrainedMints
    ) {
      this.trainMints();
      this.addToMints(tx.to, tx.from, tx.transaction.hash, totalMinted);
      this.startTimestampMints = tx.block.timestamp;
    } else {
      this.totalAssetsMinted.push(totalMinted);
      this.addToMints(tx.to, tx.from, tx.transaction.hash, totalMinted);
    }
  }

  addBorrowTx(tx, totalBorrowed) {
    if (this.startTimestampBorrows == 0) {
      this.startTimestampBorrows = tx.block.timestamp;
      this.totalAssetsBorrowed.push(totalBorrowed);
      this.addToBorrows(tx.to, tx.from, tx.transaction.hash);
      return;
    }
    if (
      tx.block.timestamp - this.startTimestampBorrows <=
        this.aggregationTimePeriod &&
      !this.isTrainedBorrows
    ) {
      this.trainBorrows();
      this.addToBorrows(tx.to, tx.from, tx.transaction.hash, totalBorrowed);
      this.startTimestampBorrows = tx.block.timestamp;
    } else {
      this.totalAssetsBorrowed.push(totalBorrowed);
      this.addToBorrows(tx.to, tx.from, tx.transaction.hash, totalBorrowed);
    }
  }

  addToMints(
    mintedAssetAccount,
    minterAccount,
    txHash,

    totalMinted
  ) {
    this.totalMintsForRange++;

    if (this.trackingMints.length > this.maxTracked) {
      this.trackingMints.shift();
    }
    const found = this.trackingMints.findIndex(
      (t) => t.mintedAssetAccount == mintedAssetAccount
    );
    if (found == -1) {
      const trackingObject = {
        mintedAssetAccount,
        minterAccount,
        totalMinted,
        txHash,
      };
      this.trackingMints.push(trackingObject);
    } else {
      this.trackingMints[found].totalMinted = totalMinted;
    }
  }

  addToBorrows(
    borrowedAssetAccount,
    borrowerAccount,
    txHash,

    totalBorrowed
  ) {
    this.totalBorrowsForRange++;
    const found = this.trackingBorrows.findIndex(
      (t) => t.borrowedAssetAccount == borrowedAssetAccount
    );
    if (found == -1) {
      const trackingObject = {
        borrowedAssetAccount,
        borrowerAccount,
        totalBorrowed,
        txHash,
      };
      this.trackingBorrows.push(trackingObject);
    } else {
      this.trackingBorrows[found].totalBorrowed = totalBorrowed;
    }
    if (this.trackingBorrows.length > this.maxTracked) {
      this.trackingBorrows.shift();
    }
  }

  trainMints() {
    this.mintBucket.train(this.totalAssetsMinted);
    this.isTrainedMints = true;
  }

  trainBorrows() {
    this.borrowBucket.train(this.totalAssetsBorrowed);
    this.isTrainedBorrows = true;
  }

  getHighAndPredMints() {
    const [pred, error] = this.mintBucket.predict(1);

    return [pred[0] + 1.96 * Math.sqrt(error[0]), pred[0]];
  }

  getHighAndPredBorrows() {
    const [pred, error] = this.borrowBucket.predict(1);
    return [pred[0] + 1.96 * Math.sqrt(error[0]), pred[0]];
  }

  getCurrentMintedCount() {
    return this.trackingMints[this.trackingMints.length - 1].totalMinted;
  }

  getCurrentBorrowedCount() {
    return this.trackingBorrows[this.trackingBorrows.length - 1].totalBorrowed;
  }

  getMintsForFlag() {
    return {
      from_address: this.addressTracked,
      mintedAssetAccount:
        this.trackingMints[this.trackingMints.length - 1].mintedAssetAccount,
      numberOfAssets:
        this.trackingMints[this.trackingMints.length - 1].totalMinted,
      firstTxHash: this.trackingMints[0].txHash,
      lastTxHash: this.trackingMints[this.trackingMints.length - 1].txHash,
    };
  }

  getBorrowsForFlag() {
    return {
      from_address: this.addressTracked,
      borrowedAssetAccount:
        this.trackingBorrows[this.trackingBorrows.length - 1]
          .borrowedAssetAccount,
      numberOfAssets:
        this.trackingBorrows[this.trackingBorrows.length - 1].totalBorrowed,
      firstTxHash: this.trackingBorrows[0].txHash,
      lastTxHash: this.trackingBorrows[this.trackingBorrows.length - 1].txHash,
    };
  }

  reset() {
    this.trackingMints = [];
    this.trackingBorrows = [];
    this.totalAssetsBorrowed = [];
    this.totalAssetsMinted = [];
    this.totalMintsForRange = 0;
    this.totalBorrowsForRange = 0;
    this.isTrainedMints = false;
    this.isTrainedBorrows = false;
  }
}

module.exports = TimeAnomalyDetection;
