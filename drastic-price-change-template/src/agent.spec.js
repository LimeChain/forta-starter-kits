/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const {
  FindingType,
  FindingSeverity,
  Finding,
} = require('forta-agent');
const { provideHandleBlock, resetLastTimestamp } = require('./agent');
const { asset } = require('./agent.config');

describe('drastic price change bot', () => {
  describe('handleBlock', () => {
    let handleBlock;
    const mockGetChainlinkPrice = jest.fn();
    const mockGetCoingeckoPrice = jest.fn();
    const mockGetTopTokenHolders = jest.fn();

    beforeAll(() => {
      handleBlock = provideHandleBlock(
        mockGetChainlinkPrice,
        mockGetCoingeckoPrice,
        mockGetTopTokenHolders,
      );
    });

    beforeEach(() => {
      mockGetChainlinkPrice.mockReset();
      mockGetCoingeckoPrice.mockReset();
      mockGetTopTokenHolders.mockReset();
      resetLastTimestamp();
    });

    it('should return empty findings if there are no price discrepancies', async () => {
      const blockEvent = { block: { timestamp: 10_000 } };
      mockGetChainlinkPrice.mockResolvedValueOnce(100);
      mockGetCoingeckoPrice.mockResolvedValueOnce(100);

      const findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([]);
      expect(mockGetChainlinkPrice).toHaveBeenCalledTimes(1);
      expect(mockGetCoingeckoPrice).toHaveBeenCalledTimes(1);
      expect(mockGetTopTokenHolders).toHaveBeenCalledTimes(0);
    });

    it('should return findings if there is price discrepancy', async () => {
      const blockEvent = { block: { timestamp: 10_000 } };
      const chainlinkPrice = 100;
      const coingeckoPrice = 200;
      const addresses = ['0xaddr1', '0xaddr2'];

      mockGetChainlinkPrice.mockResolvedValueOnce(chainlinkPrice);
      mockGetCoingeckoPrice.mockResolvedValueOnce(coingeckoPrice);
      mockGetTopTokenHolders.mockResolvedValueOnce(addresses);

      const findings = await handleBlock(blockEvent);

      expect(findings).toStrictEqual([Finding.fromObject({
        name: 'Price discrepancies',
        description: `Assets ${asset.contract} price information deviates significantly `
        + 'from Chainlink and CoinGecko with a price of '
        + `${chainlinkPrice} and ${coingeckoPrice} respectively`,
        alertId: 'PRICE-DISCREPANCIES',
        severity: FindingSeverity.High,
        type: FindingType.Suspicious,
        addresses,
      })]);
      expect(mockGetChainlinkPrice).toHaveBeenCalledTimes(1);
      expect(mockGetCoingeckoPrice).toHaveBeenCalledTimes(1);
      expect(mockGetTopTokenHolders).toHaveBeenCalledTimes(1);
    });

    it('should return empty findings if there is no anomaly', async () => {
      // Add 20 entries to the timeseries array
      for (let i = 1; i <= 20; i++) {
        const blockEvent = { block: { timestamp: 10_000 * i } }; // 10K, 20K, 30K
        const price = 100 + i * 10; // 110, 120, 130
        mockGetChainlinkPrice.mockResolvedValueOnce(price);
        mockGetCoingeckoPrice.mockResolvedValueOnce(price);

        const findings = await handleBlock(blockEvent);
        expect(findings).toStrictEqual([]);
      }

      const blockEvent = { block: { timestamp: 210_000 } };
      const addresses = ['0xaddr1', '0xaddr2'];
      const price = 1000; // Last 3 prices are 280, 290, 300

      mockGetChainlinkPrice.mockResolvedValueOnce(price);
      mockGetCoingeckoPrice.mockResolvedValueOnce(price);
      mockGetTopTokenHolders.mockResolvedValueOnce(addresses);

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
      expect(mockGetCoingeckoPrice).toHaveBeenCalledTimes(21);
      expect(mockGetTopTokenHolders).toHaveBeenCalledTimes(1);
    });
  });
});
