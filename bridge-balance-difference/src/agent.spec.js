const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
} = require('forta-agent');
const {
  provideInitialize,
  provideHandleBlock,
  resetLastTimestamp,
} = require('./agent');

const contract1 = {
  address: '0x1',
  rpcUrl: 'url',
};

const contract2 = {
  address: '0x2',
  rpcUrl: 'url',
};

const tokens = [
  {
    address1: '0xtoken1',
    address2: '0xtoken2',
  },
];

const tokenData = {
  timeSeries: [],
  decimals: 18,
  tokenContract1: {
    balanceOf: jest.fn(),
    decimals: () => 18,
  },
  tokenContract2: {
    balanceOf: jest.fn(),
    decimals: () => 18,
  },
};

const tokensData = [tokenData];

const oneHundred = ethers.utils.parseEther('100');
const twoHundred = ethers.utils.parseEther('200');

const chainId1 = 1;
const chainId2 = 2;

const provider1 = { getNetwork: () => ({ chainId: chainId1 }) };
const provider2 = { getNetwork: () => ({ chainId: chainId2 }) };

// Mock the config file
jest.mock('../bot-config.json', () => ({
  contract1,
  contract2,
  tokens,
}), { virtual: true });

describe('bridge balance difference bot', () => {
  let initialize;
  let handleBlock;

  describe('handleBlock', () => {
    beforeAll(async () => {
      initialize = provideInitialize(provider1, provider2, tokensData);
      handleBlock = provideHandleBlock(tokensData);

      await initialize();
    });

    beforeEach(() => {
      tokenData.tokenContract1.balanceOf.mockReset();
      tokenData.tokenContract2.balanceOf.mockReset();
      tokenData.timeSeries = [];
      resetLastTimestamp();
    });

    it('should return empty findings if not enough time has passed', async () => {
      const mockBlockEvent = { block: { timestamp: 1000 } };
      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([]);
    });

    it('should return empty findings if there is not enough data', async () => {
      const mockBlockEvent = { block: { timestamp: 4000 } };

      tokenData.tokenContract1.balanceOf.mockResolvedValueOnce(oneHundred);
      tokenData.tokenContract2.balanceOf.mockResolvedValueOnce(oneHundred);

      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([]);
      expect(tokenData.tokenContract1.balanceOf).toHaveBeenCalledTimes(1);
      expect(tokenData.tokenContract2.balanceOf).toHaveBeenCalledTimes(1);
      expect(tokenData.tokenContract1.balanceOf).toHaveBeenCalledWith(contract1.address);
      expect(tokenData.tokenContract2.balanceOf).toHaveBeenCalledWith(contract2.address);
    });

    it('should return empty findings if the difference is not significant', async () => {
      const mockBlockEvent = { block: { timestamp: 4000 } };

      // Add 11 entries with balance diff = 10
      tokenData.timeSeries = Array(11).fill().map(() => 10);

      // The current diff is 100 - 100 = 0 so it is not significant
      tokenData.tokenContract1.balanceOf.mockResolvedValueOnce(oneHundred);
      tokenData.tokenContract2.balanceOf.mockResolvedValueOnce(oneHundred);

      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([]);
      expect(tokenData.tokenContract1.balanceOf).toHaveBeenCalledTimes(1);
      expect(tokenData.tokenContract2.balanceOf).toHaveBeenCalledTimes(1);
      expect(tokenData.tokenContract1.balanceOf).toHaveBeenCalledWith(contract1.address);
      expect(tokenData.tokenContract2.balanceOf).toHaveBeenCalledWith(contract2.address);
    });

    it('should return findings if the difference is significant', async () => {
      const mockBlockEvent = { block: { timestamp: 4000 } };

      // Add 11 entries with balance diff = 10
      tokenData.timeSeries = Array(11).fill().map(() => 10);

      // The current diff is 200 - 100 = 100 so it is significant
      tokenData.tokenContract1.balanceOf.mockResolvedValueOnce(twoHundred);
      tokenData.tokenContract2.balanceOf.mockResolvedValueOnce(oneHundred);

      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([Finding.fromObject({
        name: 'Bridge Balance Difference Bot',
        description: `${contract1.address} (Chain: 1) shows statistically significant difference to the other side of the bridge ${contract2.address} (Chain: 2)`,
        alertId: 'BRIDGE-BALANCE-DIFFERENCE',
        severity: FindingSeverity.High,
        type: FindingType.Suspicious,
      })]);
      expect(tokenData.tokenContract1.balanceOf).toHaveBeenCalledTimes(1);
      expect(tokenData.tokenContract2.balanceOf).toHaveBeenCalledTimes(1);
      expect(tokenData.tokenContract1.balanceOf).toHaveBeenCalledWith(contract1.address);
      expect(tokenData.tokenContract2.balanceOf).toHaveBeenCalledWith(contract2.address);
    });
  });
});
