const contractAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const eventABI =
  "event Transfer(address indexed src, address indexed dst, uint wad)";

module.exports = {
  timeSeriesGranularity: 5,
  SensitivityHighNumberSuccessfulTx: 0.92,
  SensitivityHighNumberSuccessfulInternalTx: 0.87,
  SensitivityHighNumberFailedTx: 0.12,
  SensitivityHighNumberFailedInternalTx: 0.3,
  contractAddress,
  eventABI,
};
