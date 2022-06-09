const config = require("./bot.config.json");

module.exports = {
  bucketBlockSize: 1000,
  getMinBucketBlockSizeByChainId: (chainId) => {
    switch (chainId) {
      case 1:
        return 1000;
      case 56:
        return 5000;
      case 137:
        return 6000;
      case 43114:
        return 5000;
      case 10:
        return 1200;
      case 42161:
        return 1000;
      case 250:
        return 12000;
    }
  },
  globalSensitivity: 1, // Default is 1, Greater than 1 will increase detections, lower than 1 will decrease detections
  getContractsByChainId: (chainId) => {
    switch (chainId) {
      case 1:
        let addressesForEth = [];
        config.bots.map((b) => {
          const objectValues = Object.values(b.contracts);
          const objectsFiltered = objectValues.filter((o) => o.chainId == 1);
          addressesForEth = objectsFiltered;
        });
        return addressesForEth;
      case 56:
        let addressesForBSC = [];
        config.bots.map((b) => {
          const objectValues = Object.values(b.contracts);
          const objectsFiltered = objectValues.filter((o) => o.chainId == 56);
          addressesForBSC = objectsFiltered;
        });
        return addressesForBSC;
      case 10:
        let addressesForOptimism = [];
        config.bots.map((b) => {
          const objectValues = Object.values(b.contracts);
          const objectsFiltered = objectValues.filter((o) => o.chainId == 10);
          addressesForOptimism = objectsFiltered;
        });
        return addressesForOptimism;
      case 137:
        let addressesForPolygon = [];
        config.bots.map((b) => {
          const objectValues = Object.values(b.contracts);
          const objectsFiltered = objectValues.filter((o) => o.chainId == 137);
          addressesForPolygon = objectsFiltered;
        });
        return addressesForPolygon;
      case 42161:
        let addressesForChain = [];
        config.bots.map((b) => {
          const objectValues = Object.values(b.contracts);
          const objectsFiltered = objectValues.filter(
            (o) => o.chainId == 42161
          );
          addressesForChain = objectsFiltered;
        });
        return addressesForChain;
      case 250:
        let addressesForFTM = [];
        config.bots.map((b) => {
          const objectValues = Object.values(b.contracts);
          const objectsFiltered = objectValues.filter((o) => o.chainId == 250);
          addressesForFTM = objectsFiltered;
        });
        return addressesForFTM;
      case 43114:
        let addressesForArbitrum = [];
        config.bots.map((b) => {
          const objectValues = Object.values(b.contracts);
          const objectsFiltered = objectValues.filter(
            (o) => o.chainId == 43114
          );
          addressesForArbitrum = objectsFiltered;
        });
        return addressesForArbitrum;
    }
  },
  getBlocktimeByChainId: (chainId) => {
    switch (chainId) {
      case 1:
        return 14;
      case 137:
        return 2.7;
      case 43114:
        return 3;
      case 56:
        return 3;
      case 10:
        return 13;
      case 42161:
        return 15;
      case 250:
        return 1.2;
    }
  },
};
