const commonEventSigs = [
  "event Borrow(address indexed _reserve,address indexed _user,uint256 _amount,uint256 _borrowRateMode,uint256 _borrowRate,uint256 _originationFee,uint256 _borrowBalanceIncrease,uint16 indexed _referral,uint256 _timestamp)",
  "event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Mint(address minter, uint256 mintAmount, uint256 mintTokens)",
];

module.exports = {
  bucketBlockSize: 5,
  commonEventSigs,
  limitTracked: 10000,
  aggregationTimePeriod: 1,
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
