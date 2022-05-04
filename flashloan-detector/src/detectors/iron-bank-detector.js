const { ethers, getEthersProvider } = require('forta-agent');

const ironBankFlashloanSig = 'event Flashloan(address indexed receiver, uint256 amount, uint256 totalFee, uint256 reservesFee)';
const ABI = ['function underlying() public view returns (address)'];

module.exports = {
  getIronBankFlashloan: async (txEvent) => {
    const flashloans = [];
    const events = txEvent.filterLog(ironBankFlashloanSig);

    await Promise.all(events.map(async (event) => {
      const { amount, receiver } = event.args;

      const contract = new ethers.Contract(event.address, ABI, getEthersProvider());
      const asset = await contract.underlying();

      flashloans.push({
        asset: asset.toLowerCase(),
        amount,
        account: receiver.toLowerCase(),
      });
    }));

    return flashloans;
  },
};
