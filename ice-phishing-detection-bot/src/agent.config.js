module.exports = {
  getAPI: (chainId) => {
    switch (chainId) {
      case 1:
        return {
          APIKey: "API_KEY_HERE",
          API_URI:
            "https://api.etherscan.io/api?module=contract&action=getabi&address=",
        };
        break;
      case 137:
        return {
          APIKey: "API_KEY_HERE",
          API_URI:
            "https://api.polygonscan.com/api?module=contract&action=getabi&address=",
        };
        break;
      case 56:
        return {
          APIKey: "API_KEY_HERE",
          API_URI:
            "https://api.bscscan.com/api?module=contract&action=getabi&address=",
        };
        break;
      case 10:
        return {
          APIKey: "API_KEY_HERE",
          API_URI:
            "https://api-optimistic.etherscan.io/api?module=contract&action=getabi&address=",
        };
      case 42161:
        return {
          APIKey: "API_KEY_HERE",
          API_URI:
            "https://api.arbiscan.io/api?module=contract&action=getabi&address=",
        };
        break;
      case 250:
        return {
          APIKey: "API_KEY_HERE",
          API_URI:
            "https://api.ftmscan.com/api?module=contract&action=getabi&address=",
        };
        break;
    }
  },
  ApprovalThreshold: 20,
  ApprovalTimePeriod: 5 * 24 * 60 * 60, //Approval threshold in days in this case 5 in seconds
  maxTracked: 50_000,
};
