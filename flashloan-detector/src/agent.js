const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
} = require('forta-agent');
const { getFlashloans: getFlashloansFn } = require('./flashloan-detector');
const helperModule = require('./helper');

let chain;
const PERCENTAGE_THRESHOLD = 2;

function provideInitialize(helper) {
  return async function initialize() {
    chain = await helper.init();
  };
}

const transferEventSigs = [
  'event Transfer(address indexed src, address indexed dst, uint wad)',
  'event Withdrawal(address indexed src, uint256 wad)',
];

function provideHandleTransaction(helper, getFlashloans) {
  return async function handleTransaction(txEvent) {
    const findings = [];
    const initiator = txEvent.from;

    const flashloans = await getFlashloans(txEvent);
    if (flashloans.length === 0) return findings;

    const transferEvents = txEvent.filterLog(transferEventSigs);
    const { traces } = txEvent;

    // For each flashloan calculate the token profits and the borrowed amount
    const flashloansData = await Promise.all(flashloans.map(async (flashloan) => {
      const { asset, amount, account } = flashloan;

      let tokenProfits = {};
      let nativeProfit = helper.zero;

      if (account !== initiator) {
        tokenProfits = helper.calculateTokenProfits(transferEvents, account);
        nativeProfit = helper.calculateNativeProfit(traces, account);
      }

      const borrowedAmountUsd = await helper.calculateBorrowedAmount(asset, amount, chain);
      return { tokenProfits, nativeProfit, borrowedAmountUsd };
    }));

    // Set the initial total profit to the initiator's profit
    const totalTokenProfits = helper.calculateTokenProfits(transferEvents, initiator);
    let totalNativeProfit = helper.calculateNativeProfit(traces, initiator);
    let totalBorrowed = 0;

    // Subtract the tx fee
    const { gasUsed } = await helper.getTransactionReceipt(txEvent.hash);
    const { gasPrice } = txEvent.transaction;
    const txFee = ethers.BigNumber.from(gasUsed).mul(ethers.BigNumber.from(gasPrice));
    totalNativeProfit = totalNativeProfit.sub(txFee);

    flashloansData.forEach((flashloan) => {
      const { tokenProfits, nativeProfit, borrowedAmountUsd } = flashloan;

      // Set initial value and add the profit for the asset to the total
      Object.entries(tokenProfits).forEach(([address, profit]) => {
        if (!totalTokenProfits[address]) totalTokenProfits[address] = helper.zero;
        totalTokenProfits[address] = totalTokenProfits[address].add(profit);
      });

      totalNativeProfit = totalNativeProfit.add(nativeProfit);
      totalBorrowed += borrowedAmountUsd;
    });

    let tokensUsdProfit = 0;
    let nativeUsdProfit = 0;

    const tokensArray = Object.keys(totalTokenProfits);

    if (tokensArray.length !== 0) {
      tokensUsdProfit = await helper.calculateTokensUsdProfit(totalTokenProfits, chain);
    }

    if (!totalNativeProfit.isZero()) {
      nativeUsdProfit = await helper.calculateNativeUsdProfit(totalNativeProfit, chain);
    }

    const totalProfit = tokensUsdProfit + nativeUsdProfit;

    if ((totalProfit / totalBorrowed) * 100 > PERCENTAGE_THRESHOLD) {
      findings.push(Finding.fromObject({
        name: 'Flashloan detected',
        description: `${initiator} launched flash loan attack`,
        alertId: 'FLASHLOAN-ATTACK',
        severity: FindingSeverity.High,
        type: FindingType.Exploit,
        metadata: {
          profit: totalProfit,
          tokens: tokensArray,
        },
      }));
    }

    // Clear all cached prices and delete token decimals if the object is too large
    helper.clear();

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(helperModule),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(helperModule, getFlashloansFn),
};
