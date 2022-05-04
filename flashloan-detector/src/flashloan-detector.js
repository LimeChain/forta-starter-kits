const { getAaveFlashloan } = require('./detectors/aave-detector');
const { getDydxFlashloan } = require('./detectors/dydx-detector');
const { getEulerFlashloan } = require('./detectors/euler-detector');
const { getIronBankFlashloan } = require('./detectors/iron-bank-detector');
const { getMakerFlashloan } = require('./detectors/maker-detector');

module.exports = {
  // Returns an array of protocols from which a flashloan was taken
  async getFlashloans(txEvent) {
    const flashloanProtocols = [];
    const aaveFlashloans = getAaveFlashloan(txEvent);
    const dydxFlashloans = await getDydxFlashloan(txEvent);
    const eulerFlashloans = getEulerFlashloan(txEvent);
    const ironBankFlashloans = await getIronBankFlashloan(txEvent);
    const makerFlashloans = getMakerFlashloan(txEvent);

    flashloanProtocols.push(
      ...aaveFlashloans,
      ...dydxFlashloans,
      ...eulerFlashloans,
      ...ironBankFlashloans,
      ...makerFlashloans,
    );

    return flashloanProtocols;
  },
};
