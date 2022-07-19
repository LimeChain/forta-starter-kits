module.exports = {
  maxTracked: 100000,
  accumulationMonitoringPeriod: 7 * 60 * 60 * 24,
  distributionMonitoringPeriod: 2 * 60 * 60 * 24,
  threshholdOfAditionalVotingPowerAccumulated: 1, // 1%
  threshholdOfAditionalVotingPowerDistributed: 80, //80%
  eventSigs: [
    "event Voted(uint indexed proposalID, bool position, address indexed voter)",
    "event Vote(uint indexed proposalId, address indexed voter, bool approve, uint weight)",
    "event CastVote(uint256 indexed voteId, address indexed voter, bool supports, uint256 stake)",
  ],
  tokenDefaultABI: [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() public view returns (uint8)",
    "function totalSupply() public view returns (uint256)",
  ],
};
