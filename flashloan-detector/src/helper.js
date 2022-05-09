const { ethers, getEthersProvider } = require('forta-agent');
const { Contract, Provider } = require('ethers-multicall');
const axios = require('axios').default;

const zero = ethers.constants.Zero;
const ABI = ['function decimals() external view returns (uint8)'];

const ethcallProvider = new Provider(getEthersProvider());

const tokenDecimals = {};

let cachedPrices = {};

function getTokenPrice(chain, asset) {
  return `https://api.coingecko.com/api/v3/simple/token_price/${chain}?contract_addresses=${asset}&vs_currencies=usd`;
}

function getNativeTokenPrice(chain) {
  return `https://api.coingecko.com/api/v3/simple/price?ids=${chain}&vs_currencies=usd`;
}

function getChainByChainId(chainId) {
  switch (chainId) {
    case 1: return 'ethereum';
    case 10: return 'optimistic-ethereum';
    case 56: return 'binance-smart-chain';
    case 137: return 'polygon-pos';
    case 250: return 'fantom';
    case 42161: return 'arbitrum-one';
    case 43114: return 'avalanche';
    default: return null;
  }
}

module.exports = {
  zero,
  async init() {
    // Init the ethcall Provider and return a chain based on the chainId
    await ethcallProvider.init();
    const { chainId } = await getEthersProvider().getNetwork();
    return getChainByChainId(chainId);
  },
  getChainByChainId,
  calculateTokenProfits(events, account) {
    const profits = {};

    events.forEach((event) => {
      const { src: s, dst: d, wad } = event.args;
      const { address } = event;

      // Convert the source and destination addresses to lower case
      const src = s.toLowerCase();
      const dst = d.toLowerCase();

      // Set the profit to 0 if it's undefined
      if (!profits[address]) {
        profits[address] = zero;
      }

      if (src === account) {
        profits[address] = profits[address].sub(wad);
      }
      if (dst === account) {
        profits[address] = profits[address].add(wad);
      }
    });

    return profits;
  },
  calculateNativeProfit(traces, account) {
    let nativeProfit = zero;

    traces.forEach((trace) => {
      const {
        from,
        to,
        value,
        callType,
        balance,
        refundAddress,
      } = trace.action;

      let val;

      if (value && value !== '0x0' && callType === 'call') {
        // If the trace is a call with non-zero value use the value
        val = ethers.BigNumber.from(value);
      } else if (balance && refundAddress) {
        // If there is a refund address and a balance property use the balance
        val = ethers.BigNumber.from(balance);
        if (refundAddress === account) {
          nativeProfit = nativeProfit.add(val);
        }
      } else {
        return;
      }

      if (from === account) {
        nativeProfit = nativeProfit.sub(val);
      }
      if (to === account) {
        nativeProfit = nativeProfit.add(val);
      }
    });

    return nativeProfit;
  },
  async calculateTokensUsdProfit(tokenProfits, chain) {
    // Remove all zero profits
    const nonZeroProfits = Object.entries(tokenProfits)
      .filter(([, profit]) => !profit.isZero())
      .reduce((obj, [key, value]) => Object.assign(obj, { [key]: value }), {});

    // Get the decimals for all tokens that are not cached
    const newTokens = Object.keys(nonZeroProfits)
      .filter((address) => !tokenDecimals[address]);

    const decimalCalls = newTokens.map((address) => {
      const contract = new Contract(address, ABI);
      return contract.decimals();
    });

    if (decimalCalls.length > 0) {
      const decimals = await ethcallProvider.all(decimalCalls);

      newTokens.forEach((address, index) => {
        tokenDecimals[address] = decimals[index];
      });
    }

    // Calculate the usd profit based on the amount and the price
    const usdTokenProfits = await Promise.all(Object.entries(nonZeroProfits)
      .map(async ([address, profit]) => {
        const response = await axios.get(getTokenPrice(chain, address));
        if (!response.data[address]) return 0;

        const usdPrice = response.data[address].usd;

        // We cache the price for all assets so we can use it when calculating the borrowed value
        cachedPrices[address] = usdPrice;

        const tokenAmount = ethers.utils.formatUnits(profit, tokenDecimals[address]);
        return tokenAmount * usdPrice;
      }));

    const totalTokensProfit = usdTokenProfits
      .reduce((sum, profit) => sum + profit, 0);

    return totalTokensProfit;
  },
  async calculateNativeUsdProfit(amount, chain) {
    const response = await axios.get(getNativeTokenPrice(chain));
    const usdPrice = response.data[chain].usd;

    // Does every chain has 18 decimals?
    const tokenAmount = ethers.utils.formatEther(amount);
    return tokenAmount * usdPrice;
  },
  async calculateBorrowedAmount(asset, amount, chain) {
    let usdPrice = cachedPrices[asset];

    // Fetch the price from CoinGecko if it isn't cached
    if (!usdPrice) {
      const response = await axios.get(getTokenPrice(chain, asset));
      usdPrice = response.data[asset].usd;
      cachedPrices[asset] = usdPrice;
    }
    const tokenAmount = ethers.utils.formatUnits(amount, tokenDecimals[asset]);

    return tokenAmount * usdPrice;
  },
  clearCachedPrices() {
    cachedPrices = {};
  },
};
