const makerFlashloanSig = 'event FlashLoan(address indexed receiver, address token, uint256 amount, uint256 fee)';

module.exports = {
  getMakerFlashloan: (txEvent) => {
    const flashloans = [];
    const events = txEvent.filterLog(makerFlashloanSig);

    events.forEach((event) => {
      const { token, amount, receiver } = event.args;
      flashloans.push({
        asset: token.toLowerCase(),
        amount,
        account: receiver.toLowerCase(),
      });
    });
    return flashloans;
  },
};
