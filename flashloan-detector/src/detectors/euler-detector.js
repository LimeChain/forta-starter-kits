/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
const { ethers } = require('forta-agent');

const eulerEventSigs = [
  'event Borrow(address indexed underlying, address indexed account, uint amount)',
  'event Repay(address indexed underlying, address indexed account, uint amount)',
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
      const isBorrow = (event.name === 'Borrow');
      const { address } = event;
      const { underlying, amount, account } = event.args;

      const id = hashCode(address, underlying, account);

      if (!markets[id]) {
        markets[id] = {
          underlying,
          account,
          deposited: zero,
          withdrawn: zero,
        };
      }

      if (isBorrow) {
        markets[id].withdrawn = markets[id].withdrawn.add(amount);
      } else {
        markets[id].deposited = markets[id].deposited.add(amount);
      }
    });

    Object.values(markets).forEach((market) => {
      const {
        underlying,
        account,
        deposited,
        withdrawn,
      } = market;
      if (deposited.eq(withdrawn)) {
        flashloans.push({
          asset: underlying.toLowerCase(),
          amount: withdrawn,
          account: account.toLowerCase(),
        });
      }
    });
    // Check if the balance difference for a market is equal to 0
    return flashloans;
  },
};
