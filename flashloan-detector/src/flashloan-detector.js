const { getAaveFlashloan } = require('./detectors/aave-detector');
const { getDydxFlashloan } = require('./detectors/dydx-detector');
const { getEulerFlashloan } = require('./detectors/euler-detector');
const { getIronBankFlashloan } = require('./detectors/iron-bank-detector');
const { getMakerFlashloan } = require('./detectors/maker-detector');
const { getUniswapV2Flashloan } = require('./detectors/uniswap-v2-detector');
const { getUniswapV3Flashloan } = require('./detectors/uniswap-v3-detector');

module.exports = {
  // Returns an array of protocols from which a flashloan was taken
  async getFlashloans(txEvent) {
    const flashloanProtocols = [];
    const aaveFlashloans = getAaveFlashloan(txEvent);
    const dydxFlashloans = await getDydxFlashloan(txEvent);
    const eulerFlashloans = getEulerFlashloan(txEvent);
    const ironBankFlashloans = await getIronBankFlashloan(txEvent);
    const makerFlashloans = getMakerFlashloan(txEvent);
    const uniswapV2Flashloans = await getUniswapV2Flashloan(txEvent);
    const uniswapV3Flashloans = await getUniswapV3Flashloan(txEvent);

    flashloanProtocols.push(
      ...aaveFlashloans,
      ...dydxFlashloans,
      ...eulerFlashloans,
      ...ironBankFlashloans,
      ...makerFlashloans,
      ...uniswapV2Flashloans,
      ...uniswapV3Flashloans,
    );

    return flashloanProtocols;
  },
};
