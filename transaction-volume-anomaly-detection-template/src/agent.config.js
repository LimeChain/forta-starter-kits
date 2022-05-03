const contractAddresses = ["YOUR_CONTRACT_ADDRESSES_HERE"];

module.exports = {
  bucketBlockSize: 5,
  globalSensitivity: 1, // Default is 1, Greater than 1 will increase detections, lower than 1 will decrease detections
  contractAddresses,
};
