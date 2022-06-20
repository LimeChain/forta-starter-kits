/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
} = require('forta-agent');
const {
  provideHandleBlock,
  provideHandleTransaction,
  getTokenHolders,
  resetLastTimestamp,
} = require('./agent');

const asset = { contract: '0xcontract' };
jest.mock('../bot-config.json', () => ({
  asset,
  priceDiscrepancyThreshold: 10,
}), { virtual: true });

describe('drastic price change bot', () => {
  describe('handleBlock', () => {
    let handleBlock;
    const mockGetChainlinkPrice = jest.fn();
    const mockGetUniswapPrice = jest.fn();
    const mockGetCoingeckoPrice = jest.fn();

    beforeAll(() => {
      handleBlock = provideHandleBlock(
        mockGetChainlinkPrice,
        mockGetUniswapPrice,
        mockGetCoingeckoPrice,
      );
    });

    beforeEach(() => {
      mockGetChainlinkPrice.mockReset();
      mockGetUniswapPrice.mockReset();
      mockGetCoingeckoPrice.mockReset();
      resetLastTimestamp();

      // Reset the tokenHolders
      Object.keys(getTokenHolders())
        .forEach((address) => delete getTokenHolders()[address]);
    });

    it('should return empty findings if there are no price discrepancies', async () => {
      const blockEvent = { block: { timestamp: 10_000 } };
      mockGetChainlinkPrice.mockResolvedValueOnce(100);
      mockGetUniswapPrice.mockResolvedValueOnce(100);
      mockGetCoingeckoPrice.mockResolvedValueOnce(100);

      const findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([]);
      expect(mockGetChainlinkPrice).toHaveBeenCalledTimes(1);
      expect(mockGetUniswapPrice).toHaveBeenCalledTimes(1);
      expect(mockGetCoingeckoPrice).toHaveBeenCalledTimes(1);
    });

    it('should return findings if there is price discrepancy', async () => {
      const blockEvent = { block: { timestamp: 10_000 } };
      const chainlinkPrice = 100;
      const uniswapPrice = 200;
      const coingeckoPrice = 300;
      const addresses = ['0xaddr1', '0xaddr2'];

      // Set the tokenHolders
      addresses.forEach((address) => { getTokenHolders()[address] = 100; });

      mockGetChainlinkPrice.mockResolvedValueOnce(chainlinkPrice);
      mockGetUniswapPrice.mockResolvedValueOnce(uniswapPrice);
      mockGetCoingeckoPrice.mockResolvedValueOnce(coingeckoPrice);

      const findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Price discrepancies',
          description: `Assets ${asset.contract} price information deviates significantly `
          + 'from Chainlink and CoinGecko with a price of '
          + `${chainlinkPrice} and ${coingeckoPrice} respectively`,
          alertId: 'PRICE-DISCREPANCIES',
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          addresses,
        }),
        Finding.fromObject({
          name: 'Price discrepancies',
          description: `Assets ${asset.contract} price information deviates significantly `
          + 'from Chainlink and Uniswap with a price of '
          + `${chainlinkPrice} and ${uniswapPrice} respectively`,
          alertId: 'PRICE-DISCREPANCIES',
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          addresses,
        }),
      ]);
      expect(mockGetChainlinkPrice).toHaveBeenCalledTimes(1);
      expect(mockGetUniswapPrice).toHaveBeenCalledTimes(1);
      expect(mockGetCoingeckoPrice).toHaveBeenCalledTimes(1);
    });

    it('should return empty findings if there is no anomaly', async () => {
      // Add 20 entries to the timeseries array
      for (let i = 1; i <= 20; i++) {
        const blockEvent = { block: { timestamp: 10_000 * i } }; // 10K, 20K, 30K
        const price = 100 + i * 10; // 110, 120, 130
        mockGetChainlinkPrice.mockResolvedValueOnce(price);
        mockGetUniswapPrice.mockResolvedValueOnce(price);
        mockGetCoingeckoPrice.mockResolvedValueOnce(price);

        const findings = await handleBlock(blockEvent);
        expect(findings).toStrictEqual([]);
      }

      const blockEvent = { block: { timestamp: 210_000 } };
      const addresses = ['0xaddr1', '0xaddr2'];
      const price = 1000; // Last 3 prices are 280, 290, 300

      // Set the tokenHolders
      addresses.forEach((address) => { getTokenHolders()[address] = 100; });

      mockGetChainlinkPrice.mockResolvedValueOnce(price);
      mockGetUniswapPrice.mockResolvedValueOnce(price);
      mockGetCoingeckoPrice.mockResolvedValueOnce(price);

      const findings = await handleBlock(blockEvent);
      expect(findings).toStrictEqual([Finding.fromObject({
        name: 'Significant price fluctuation',
        description: `Assets ${asset.contract} price has experienced significant price fluctuations`,
        alertId: 'PRICE-FLUCTUATIONS',
        severity: FindingSeverity.Low,
        type: FindingType.Suspicious,
        addresses,
      })]);

      expect(mockGetChainlinkPrice).toHaveBeenCalledTimes(21);
      expect(mockGetUniswapPrice).toHaveBeenCalledTimes(21);
      expect(mockGetCoingeckoPrice).toHaveBeenCalledTimes(21);
    });
  });

  describe('handleTransaction', () => {
    let handleTransaction;
    const mockContract = { balanceOf: jest.fn() };
    const mockTxEvent = { filterLog: jest.fn() };

    beforeAll(() => {
      handleTransaction = provideHandleTransaction(mockContract);
    });

    beforeEach(() => {
      mockContract.balanceOf.mockReset();
      mockTxEvent.filterLog.mockReset();

      // Reset the tokenHolders
      Object.keys(getTokenHolders())
        .forEach((address) => delete getTokenHolders()[address]);
    });

    it('should not update the tokenHolders object if there are not transfer events', async () => {
      mockTxEvent.filterLog.mockReturnValueOnce([]);

      await handleTransaction(mockTxEvent);

      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(1);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(0);
      expect(getTokenHolders()).toStrictEqual({});
    });

    it('should return empty findings if there are no transfer events', async () => {
      const tranferEvent = {
        args:
        {
          from: 'addr1',
          to: 'addr2',
          value: ethers.utils.parseEther('50'),
        },
      };
      mockTxEvent.filterLog.mockReturnValueOnce([tranferEvent]);
      mockContract.balanceOf.mockResolvedValueOnce(ethers.utils.parseEther('100'));
      mockContract.balanceOf.mockResolvedValueOnce(ethers.utils.parseEther('100'));

      await handleTransaction(mockTxEvent);

      // The transfer is for 50 tokens so addr1 now has 50 and addr2 has 150
      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(1);
      expect(mockContract.balanceOf).toHaveBeenCalledTimes(2);
      expect(getTokenHolders()).toStrictEqual({
        addr1: 50,
        addr2: 150,
      });
    });
  });
});
