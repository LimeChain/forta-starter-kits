/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
const { ethers } = require('forta-agent');

const eulerEventSigs = [
  'event Borrow(address indexed underlying, address indexed account, uint amount)',
  'event Repay(address indexed underlying, address indexed account, uint amount)',
  'event RequestBorrow(address indexed account, uint amount)',
];

const zero = ethers.constants.Zero;

// Generate unique id from the protocol, asset and account
function hashCode(protocol, asset, account) {
  const str = protocol + asset + account;
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash; // Convert to 32bit integer
  }
  return hash;
}

module.exports = {
  getEulerFlashloan: (txEvent) => {
    const flashloans = [];
    // Euler doesn't support flashloans natively so we have to sum
    // the borrows and the repays in a tx. If they are equal then
    // the transaction probably contains flashloan
    const events = txEvent.filterLog(eulerEventSigs);
    if (events.length === 0) return flashloans;

    // Store the borrowed and repayed amount for each protocol
    // and each underlying asset seperately to prevent false positives.
    // e.g. user flashloans 100 USDC from Euler and repays a loan on a Euler fork.
    const markets = {};

    events.forEach((event) => {
      const { address, name } = event;
      const { underlying, amount, account } = event.args;

      // We process the RequestBorrow events later
      if (name === 'RequestBorrow') return;

      const id = hashCode(address, underlying, account);

      if (!markets[id]) {
        markets[id] = {
          address,
          underlying,
          account,
          deposited: zero,
          withdrawn: zero,
        };
      }

      if (name === 'Borrow') {
        markets[id].withdrawn = markets[id].withdrawn.add(amount);
      } else {
        markets[id].deposited = markets[id].deposited.add(amount);
      }
    });

    Object.values(markets).forEach((market) => {
      const {
        address,
        underlying,
        account,
        deposited,
        withdrawn,
      } = market;

      // The Borrow event always return the amount with 18 decimals which leads
      // to wrong usd profits so we need to get the corresponding RequestBorrow
      // borrow event and calculate the decimal difference
      const amount = events
        .filter((event) => event.name === 'RequestBorrow')
        .filter((event) => event.args.account === account && event.address === address)
        .map((event) => event.args.amount)
        .filter((a) => withdrawn.toString().startsWith(a.toString()))[0];

      if (!amount) return;

      const decimalsDiff = withdrawn.div(amount);
      if (deposited.eq(withdrawn)) {
        flashloans.push({
          asset: underlying.toLowerCase(),
          amount: withdrawn.div(decimalsDiff),
          account: account.toLowerCase(),
        });
      }
    });
    // Check if the balance difference for a market is equal to 0
    return flashloans;
  },
};
