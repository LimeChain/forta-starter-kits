const tornadoCashAddressesETHER = [
  "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", // 0.1 ETH
  "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936", // 1 ETH
  "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf", // 10 ETH
  "0xA160cdAB225685dA1d56aa342Ad8841c3b53f291", // 100 ETH
];

const tornadoCashAddressesBSC = [
  "0x84443cfd09a48af6ef360c6976c5392ac5023a1f", // 0.1 BNB
  "0xd47438c816c9e7f2e2888e060936a499af9582b3", // 1 BNB
  "0x330bdFADE01eE9bF63C209Ee33102DD334618e0a", // 10 BNB
  "0x1e34a77868e19a6647b1f2f47b51ed72dede95dd", // 100 BNB
];

const tornadoCashAddressesOPTIMISM = [
  "0x84443CFd09A48AF6eF360C6976C5392aC5023a1F", // 0.1 ETH
  "0xd47438C816c9E7f2E2888E060936a499Af9582b3", // 1 ETH
  "0x330bdFADE01eE9bF63C209Ee33102DD334618e0a", // 10 ETH
  "0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD", // 100 ETH
];

const tornadoCashAddressesPolygon = [
  "0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD", // 100 MATIC
  "0xdf231d99Ff8b6c6CBF4E9B9a945CBAcEF9339178", // 1000 MATIC
  "0xaf4c0B70B2Ea9FB7487C7CbB37aDa259579fe040", // 10_000 MATIC
  "0xa5C2254e4253490C54cef0a4347fddb8f75A4998", // 100_000 MATIC
];

const tornadoCashAddressesARBITRUM = [
  "0x84443CFd09A48AF6eF360C6976C5392aC5023a1F", // 0.1 ETH
  "0xd47438C816c9E7f2E2888E060936a499Af9582b3", // 1 ETH
  "0x330bdFADE01eE9bF63C209Ee33102DD334618e0a", // 10 ETH
  "0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD", // 100 ETH
];

module.exports = {
  // 5 per minute * 60 minutes * 24 hours => ~1 day
  timeFrameBlocks: 5 * 60 * 24,
  getContractsByChainId: (chainId) => {
    switch (chainId) {
      case 1:
        return tornadoCashAddressesETHER;
      case 56:
        return tornadoCashAddressesBSC;
      case 10:
        return tornadoCashAddressesOPTIMISM;
      case 137:
        return tornadoCashAddressesPolygon;
      case 42161:
        return tornadoCashAddressesARBITRUM;
    }
  },
  getInitialFundedByTornadoCash: (chainId) => {
    switch (chainId) {
      case 1:
        return new Set(["0x58f970044273705ab3b0e87828e71123a7f95c9d"]);
      case 56:
        return new Set(["0x0f3470ed99f835c353be12ce0f82f68c1cf8e411"]);
      case 10:
        return new Set(["0x933ea7bd9de556dcaa85b775f67afe4ebd3591d4"]);
      case 137:
        return new Set(["0x08a83ca9fd882e1ed1477927dee00c2e50320a0a"]);
      case 42161:
        return new Set(["0x543c25dc5e3154fabede4d4a669312f187d56383"]);
    }
  },
  getAPIURL: (chainId) => {
    switch (chainId) {
      case 1:
        return "api.etherscan.io";
      case 56:
        return "api.bscscan.com";
      case 10:
        return "api-optimistic.etherscan.io";
      case 137:
        return "api.polygonscan.com";
      case 42161:
        return "api.arbiscan.io";
    }
  },
};
