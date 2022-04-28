/*
1)Create a time series tracker for each finding type
2)Add all info based on data to the time series tracker
3)Check for std and std failed
4)Return data
*/

/*
  Per block we have x amount of transactions that will get added to the obj
  So RollinMath should add the transactions per block for the blockSize we want to look up to -> for example 5 blocks
  So we add the number to the bucket and we dont need to generate extra buckets per block, instead we need to have 1 rolling math object for the range and it will
  update accordingly when a new block is added 
*/
const { default: BigNumber } = require("bignumber.js");
const RollingMath = require("rolling-math");

class TimeSeriesAnalysis {
  constructor(contractAddress, blockSize) {
    this.contract = contractAddress;
    this.blockSize = blockSize;
    this.bucket = new RollingMath(blockSize);
    this.stdForAll = [];
    this.timeline = 5; //the time in minutes we need to track to check for unusual counts
    this.currentBlock = 0;
    this.lastBlock = 0;
    this.total = 0; //total transactions that complete our requirements
    // this.createBucket();
  }

  //Creates a new bucket after it finished collecting data for the last one
  // createBucket() {
  //   this.buckets.push(new RollingMath(this.blockSize));
  // }

  //Here we change the active block number so we know if we need to keep track of txs
  updateBlock(blockNumber) {
    if (this.currentBlock != blockNumber) {
      this.lastBlock = this.currentBlock;
      this.currentBlock = blockNumber;
    }
  }

  updateCurrentBlock(blockNumber) {
    this.currentBlock = blockNumber;
  }

  AddTransaction(tx) {
    if (tx.block.number != this.currentBlock && this.currentBlock != 0) {
      this.updateBlock(tx.block.number);
      this.AddToBucket(this.total);
      // if (this.buckets.length != 0) {
      //   this.createBucket();
      // }
      this.total++;
    } else if (tx.block.number == this.currentBlock) {
      this.total++;
    } else if (this.currentBlock == 0) {
      this.total++;
      this.updateCurrentBlock(tx.block.number);
    }
  }

  //Adds data to the latest bucket and remove the first element if buckets length = timeline
  AddToBucket(data) {
    // this.RemoveFirstBucketIfNeccesary(); //Remove the first bucket if the dataset is larger than the predefined timeline
    // if (this.buckets.length != 0) {
    //   this.total = 0;
    //   this.buckets[this.buckets.length - 1].addElement(new BigNumber(data)); // add the data (tx count) to the bucket
    // } else if (this.buckets.length == 0) {
    //   this.createBucket();
    //   this.total = 0;
    //   this.buckets[this.buckets.length - 1].addElement(new BigNumber(data));
    // }
    this.bucket.addElement(new BigNumber(data));
    this.stdForAll.push(this.bucket.getStandardDeviation().toNumber());
    this.total = 0;
  }

  // RemoveFirstBucketIfNeccesary() {
  //   const length = this.buckets.length;
  //   if (length == this.timeline) {
  //     this.buckets.shift();
  //   }
  // }

  // GetStdAvgForAllData() {
  //   let stdAvg = 0;
  //   for (let bucket of this.buckets) {
  //     const std = bucket.getStandardDeviation().toNumber();
  //     stdAvg + std;
  //     console.log(std);
  //   }

  //   stdAvg = stdAvg / this.buckets.length;

  //   return stdAvg;
  // }

  GetStdForLatestBucket() {
    return this.bucket.getStandardDeviation().toNumber();
  }

  GetTotalForLastBucket() {
    return this.bucket.getSum().toNumber();
  }

  GetBaselineForLastBucket() {
    return this.bucket.getAverage().toNumber();
  }

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

  GetNormalMarginOfDifferences() {
    let marginCurrent = 0;
    // const length = this.stdForAll.length;
    // const threePointMovingAvg = [];
    // for (let i = 0; i < length; i++) {
    //   const first = this.stdForAll[i];
    //   const second = this.stdForAll[i + 1];
    //   const third = this.stdForAll[i + 2];

    //   let calc =
    //     (this.stdForAll[i] + this.stdForAll[i + 1] + this.stdForAll[i + 2]) / 3;
    //   console.log(calc);
    //   threePointMovingAvg.push(calc);
    // }

    // marginCurrent =
    //   (threePointMovingAvg[length - 1] - threePointMovingAvg[0]) /
    //     threePointMovingAvg.length -
    //   1;
    // marginCurrent = Math.abs(marginCurrent);

    let index = this.blockSize - 1;
    const length = this.stdForAll.length;
    let previousEmaIndex = 0;
    const smoothingFactor = 2 / (this.blockSize + 1);
    const exponentialMovingAvg = [];
    const [sma] = this.SimpleMovingAverage(this.stdForAll, this.blockSize, 1);
    exponentialMovingAvg.push(sma);
    while (++index < length) {
      const value = this.stdForAll[index];
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

  IsFull() {
    return this.bucket.getNumElements() == this.timeline;
  }
}

module.exports = TimeSeriesAnalysis;
