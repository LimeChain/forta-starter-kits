const aaveFlashloanSig = 'event FlashLoan(address indexed target, address indexed initiator, address indexed asset, uint256 amount, uint256 premium, uint16 referralCode)';

module.exports = {
  getAaveFlashloan: (txEvent) => {
    const flashloans = [];
    const events = txEvent.filterLog(aaveFlashloanSig);

    events.forEach((event) => {
      const { asset, amount, target } = event.args;
      flashloans.push({
        asset: asset.toLowerCase(),
        amount,
        account: target.toLowerCase(),
      });
    });
    return flashloans;
  },
};
