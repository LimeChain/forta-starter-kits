const commonEventSigs = [
  "event Transfer(address indexed from, address indexed to, uint value)",
  "event Borrow(address indexed _reserve,address indexed _user,uint256 _amount,uint256 _borrowRateMode,uint256 _borrowRate,uint256 _originationFee,uint256 _borrowBalanceIncrease,uint16 indexed _referral,uint256 _timestamp)",
  "event Mint(address minter, uint mintAmount, uint mintTokens)",
  "event Borrow(address borrower, uint borrowAmount, uint accountBorrows, uint totalBorrows)",
];

module.exports = {
  bucketBlockSize: 5,
  commonEventSigs,
  limitTracked: 10000,
};
