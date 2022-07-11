const { ethers, getEthersProvider } = require('forta-agent');

const functionSignature = 'function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data)';

const ABI = [
  'function token0() public view returns (address token)',
  'function token1() public view returns (address token)',
];

module.exports = {
  getUniswapV3Flashloan: async (txEvent) => {
    const flashWithdraws = txEvent.filterFunction(functionSignature);

    const flashloans = await Promise.all(flashWithdraws.map(async (withdraw) => {
      const {
        recipient,
        amount0,
        amount1,
      } = withdraw.args;
      const { address } = withdraw;

      // Get the correct amount and asset address
      const tokenIndex = (amount0.gt(ethers.constants.Zero)) ? 0 : 1;
      const amount = (tokenIndex === 0) ? amount0 : amount1;
      const tokenFnCall = (tokenIndex === 0) ? 'token0' : 'token1';

      const contract = new ethers.Contract(address, ABI, getEthersProvider());
      const asset = await contract[tokenFnCall]();

      return {
        asset: asset.toLowerCase(),
        amount,
        account: recipient.toLowerCase(),
      };
    }));

    return flashloans.filter((f) => !!f);
  },
};
