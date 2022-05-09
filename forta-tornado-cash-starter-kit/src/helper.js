const tornadoCashAddressesETHER = [
  "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", // 0.1 ETH
  "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936", // 1 ETH
  "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf", // 10 ETH
  "0xA160cdAB225685dA1d56aa342Ad8841c3b53f291", // 100 ETH
  "0xD4B88Df4D29F5CedD6857912842cff3b20C8Cfa3", //100 DAI
  "0xFD8610d20aA15b7B2E3Be39B396a1bC3516c7144", //1000 DAI
  "0x07687e702b410Fa43f4cB4Af7FA097918ffD2730", //10_000 DAI
  "0x23773E65ed146A459791799d01336DB287f25334", // 100_000 DAI
  "0x22aaA7720ddd5388A3c0A3333430953C68f1849b", // 5000 cDAI
  "0x03893a7c7463AE47D46bc7f091665f1893656003", // 50_000 cDAI
  "0x2717c5e28cf931547B621a5dddb772Ab6A35B701", // 500_000 cDAI
  "0xD21be7248e0197Ee08E0c20D4a96DEBdaC3D20Af", // 5_000_000 cDAI
  "0x4736dCf1b7A3d580672CcE6E7c65cd5cc9cFBa9D", // 100 USDC
  "0xd96f2B1c14Db8458374d9Aca76E26c3D18364307", // 1000 USDC
  "0x169AD27A470D064DEDE56a2D3ff727986b15D52B", // 100 USDT
  "0x0836222F2B2B24A3F36f98668Ed8F0B38D1a872f", // 1000 USDT
  "0x178169B423a011fff22B9e3F3abeA13414dDD0F1", // 0.1 WBTC
  "0xbB93e510BbCD0B7beb5A853875f9eC60275CF498", // 10 WBTC
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
  eventABI:
    "event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee)",
  addressLimit: 100000,
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
};
