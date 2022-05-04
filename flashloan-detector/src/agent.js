const {
  // Finding,
  // FindingSeverity,
  // FindingType,
  ethers,
} = require('forta-agent');
const { getFlashloans } = require('./flashloan-detector');

const zero = ethers.constants.Zero;
const transferEventSig = 'event Transfer(address indexed src, address indexed dst, uint wad)';

const handleTransaction = async (txEvent) => {
  const findings = [];
  const initiator = txEvent.from;

  // const traces = require('./test-traces-cream');
  const { traces } = txEvent;

  const flashloanProtocols = await getFlashloans(txEvent);
  if (flashloanProtocols.length === 0) return findings;

  const transferEvents = txEvent.filterLog(transferEventSig);

  flashloanProtocols.forEach((flashloan) => {
    const { asset, amount, account } = flashloan;

    const profits = {};

    transferEvents.forEach((event) => {
      const { src: s, dst: d, wad } = event.args;
      const { address } = event;

      // Convert the source and destination addresses to lower case
      const src = s.toLowerCase();
      const dst = d.toLowerCase();

      if (!profits[address]) {
        profits[address] = zero;
      }

      if (src === account || src === initiator) {
        console.log('removing', ethers.utils.formatEther(wad));
        profits[address] = profits[address].sub(wad);
      }
      if (dst === account || dst === initiator) {
        console.log('adding', ethers.utils.formatEther(wad));
        profits[address] = profits[address].add(wad);
      }
    });

    let nativeProfit = zero;
    traces.forEach((trace) => {
      const {
        from,
        to,
        value,
        callType,
        balance,
        refundAddress,
      } = trace.action;

      let val;

      if (value && value !== '0x0' && callType === 'call') {
        val = ethers.BigNumber.from(value);
      } else if (balance && refundAddress) {
        val = ethers.BigNumber.from(balance);
        if (refundAddress === account || refundAddress === initiator) {
          console.log('adding native', ethers.utils.formatEther(val));
          nativeProfit = nativeProfit.add(val);
        }
      } else {
        return;
      }

      if (from === account || from === initiator) {
        console.log('removing native', ethers.utils.formatEther(val));
        nativeProfit = nativeProfit.sub(val);
      }
      if (to === account || to === initiator) {
        console.log('adding native', ethers.utils.formatEther(val));
        nativeProfit = nativeProfit.add(val);
      }
    });

    console.log('native', ethers.utils.formatEther(nativeProfit));
    Object.entries(profits).forEach(([address, profit]) => {
      console.log(address, ethers.utils.formatEther(profit));
    });

    // Calculate prices in USD (chainlink or coingecko)
    // Check if profit > threshold
    // Alert
  });

  return findings;
};

module.exports = {
  handleTransaction,
};
