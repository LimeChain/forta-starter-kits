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
  }

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

  //Logic for adding a transaction to the bucket
  AddTransaction(tx) {
    if (tx.block.number != this.currentBlock && this.currentBlock != 0) {
      this.updateBlock(tx.block.number);
      this.AddToBucket(this.total);

      this.total++;
    } else if (tx.block.number == this.currentBlock) {
      this.total++;
    } else if (this.currentBlock == 0) {
      this.total++;
      this.updateCurrentBlock(tx.block.number);
    }
  }

  AddToBucket(data) {
    this.bucket.addElement(new BigNumber(data));
    this.stdForAll.push(this.bucket.getStandardDeviation().toNumber());
    this.total = 0;
  }

  GetStdForLatestBucket() {
    return this.bucket.getStandardDeviation().toNumber();
  }

  GetTotalForLastBucket() {
    return this.bucket.getSum().toNumber();
  }

  GetBaselineForLastBucket() {
    return this.bucket.getAverage().toNumber();
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

  /*
    Here we calculate the EMA of the standard deviation and we use this to determine the marginal difference 
    between the EMA which is used to determin the normal margin that is used to decide if there are unusual amounts of transactions
    that happen
  */
  GetNormalMarginOfDifferences() {
    let marginCurrent = 0;

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

  //Check to see if we have enough data to make calculations
  IsFull() {
    return this.bucket.getNumElements() == this.timeline;
  }
}

module.exports = TimeSeriesAnalysis;
