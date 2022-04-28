/*
1)Create a time series tracker for each finding type
2)Add all info based on data to the time series tracker
3)Check for std and std failed
4)Return data
*/
const { default: BigNumber } = require("bignumber.js");
const RollingMath = require("rolling-math");

class TimeSeriesAnalysis {
  constructor(contractAddress, blockSize) {
    this.contract = contractAddress;
    this.blockSize = blockSize;
    this.buckets = [];
    this.timeline = 5; //the time in minutes we need to track to check for unusual counts
    this.currentBlock = 0;
    this.lastBlock = 0;
    this.total = 0; //total transactions that complete our requirements
    this.createBucket();
  }

  //Creates a new bucket after it finished collecting data for the last one
  createBucket() {
    this.buckets.push(new RollingMath(this.blockSize));
  }

  //Here we change the active block number so we know if we need to keep track of txs
  updateBlock(blockNumber) {
    if (this.currentBlock != blockNumber) {
      this.lastBlock = this.currentBlock;
      this.currentBlock = blockNumber;
    }
  }

  AddTransaction(tx) {
    if (tx.block.number != this.currentBlock && this.currentBlock != 0) {
      this.updateBlock(tx.block.number);
      this.AddToBucket(this.total);
      if (this.buckets.length != 0) {
        this.createBucket();
      }
      this.total = 0;
    } else if (tx.block.number == this.currentBlock || this.currentBlock == 0) {
      this.total++;
    }
  }

  //Adds data to the latest bucket and remove the first element if buckets length = timeline
  AddToBucket(data) {
    this.RemoveFirstBucketIfNeccesary(); //Remove the first bucket if the dataset is larger than the predefined timeline
    if (this.buckets.length != 0) {
      this.buckets[this.buckets.length - 1].addElement(new BigNumber(data)); // add the data (tx count) to the bucket
    } else if (this.buckets.length == 0) {
      this.createBucket();
      this.buckets[this.buckets.length - 1].addElement(new BigNumber(data));
    }
  }

  RemoveFirstBucketIfNeccesary() {
    const length = this.buckets.length;
    if (length == this.timeline) {
      this.buckets.shift();
    }
  }

  GetStdAvgForAllData() {
    let stdAvg = 0;
    for (let bucket of this.buckets) {
      const std = bucket.getStandardDeviation().toNumber();
      stdAvg + std;
    }

    stdAvg = stdAvg / this.buckets.length;

    return stdAvg;
  }

  IsFull() {
    return this.buckets.length == this.timeline;
  }
}

module.exports = TimeSeriesAnalysis;
