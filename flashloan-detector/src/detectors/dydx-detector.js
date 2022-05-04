/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
const { ethers, getEthersProvider } = require('forta-agent');

const dydxSoloMarginAddress = '0x1e0447b19bb6ecfdae1e4ae1694b0c3659614e4e';
const dydxEventSigs = [
  'event LogDeposit(address indexed accountOwner, uint256 accountNumber, uint256 market, ((bool sign, uint256 value) deltaWei, tuple(bool sign, uint128 value) newPar) update, address from)',
  'event LogWithdraw(address indexed accountOwner, uint256 accountNumber, uint256 market, ((bool sign, uint256 value) deltaWei, tuple(bool sign, uint128 value) newPar) update, address from)',
];

const ABI = ['function getMarket(uint256 marketId) public view returns (tuple(address token, tuple(uint128 borrow, uint128 supply) totalPar, tuple(uint96 borrow, uint96 supply, uint32 lastUpdate) index, address priceOracle, address interestSetter, tuple(uint256 value) marginPremium, tuple(uint256 value) spreadPremium, bool isClosing) memory)'];

const zero = ethers.constants.Zero;
const two = ethers.BigNumber.from(2);

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

// DyDx doesn't natively support "flashloan" feature.
// However you can achieve a similar behavior by executing a series of operations on
// the SoloMargin contract. In order to mimic an Aave flashloan on DyDx, you would need to:
//  1. Borrow x amount of tokens. (Withdraw)
//  2. Call a function (i.e. Logic to handle flashloaned funds). (Call)
//  3. Deposit back x (+2 wei) amount of tokens. (Deposit)
module.exports = {
  getDydxFlashloan: async (txEvent) => {
    // Store the balance difference for each market seperately
    const markets = {};

    const events = txEvent.filterLog(dydxEventSigs, dydxSoloMarginAddress);

    // Increase the balanceDiff for the specific market on every deposit
    // and decrease it on every withdraw
    for (const event of events) {
      const market = event.args.market.toNumber();
      const { address } = event;
      const { accountOwner, from } = event.args;
      const { value, sign } = event.args.update.deltaWei;

      const id = hashCode(address, market, accountOwner);

      if (!markets[id]) {
        const contract = new ethers.Contract(address, ABI, getEthersProvider());
        const [asset] = await contract.getMarket(market);

        markets[id] = {
          asset,
          account: from,
          deposited: zero,
          withdrawn: zero,
        };
      }

      if (sign) {
        markets[id].deposited = markets[id].deposited.add(value);
      } else {
        markets[id].withdrawn = markets[id].withdrawn.add(value);
      }
    }
    const flashloans = [];

    // For each market check if deposited - withdrawn is equal to 2
    Object.values(markets).forEach((market) => {
      const {
        asset,
        account,
        deposited,
        withdrawn,
      } = market;

      if (deposited.sub(withdrawn).eq(two)) {
        flashloans.push({
          asset: asset.toLowerCase(),
          amount: withdrawn,
          account: account.toLowerCase(),
        });
      }
    });
    return flashloans;
  },
};
