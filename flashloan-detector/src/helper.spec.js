const { ethers, getEthersProvider } = require('forta-agent');
const helper = require('./helper');

// Mock the getEthersProvider function of the forta-agent module
jest.mock('forta-agent', () => {
  const original = jest.requireActual('forta-agent');
  return {
    ...original,
    getEthersProvider: jest.fn(),
  };
});

// Mock the getEthersProvider impl to return
// getNetworkMock and _isSigner (needed for the Contract creation)
const mockGetNetwork = jest.fn();
getEthersProvider.mockImplementation(() => ({ getNetwork: mockGetNetwork, _isSigner: true }));

// Mock the init() and all() functions of the ethers-multicall module
jest.mock('ethers-multicall', () => ({
  Provider: jest.fn().mockImplementation(() => ({ init: () => {}, all: jest.fn() })),
}));

const asset = '0xasset';
const amount = ethers.utils.parseUnits('100', 18);
const from = '0xfrom';
const to = '0xto';

const tokenProfitsEvents = [
  {
    address: asset,
    args: { src: from, dst: to, wad: amount },
  },
];

const traces = [
  {
    action: {
      from,
      to,
      value: '0xa',
      callType: 'call',
    },
  },
  {
    action: {
      from,
      to,
      value: '0x0',
      callType: 'call',
    },
  },
  {
    action: {
      balance: '0xa',
      refundAddress: to,
    },
  },
];

// TODO
// Add tests for calculateTokensUsdProfit, calculateNativeUsdProfit and calculateBorrowedAmount
describe('helper module', () => {
  const mockTxEvent = { filterLog: jest.fn() };

  beforeEach(() => {
    mockTxEvent.filterLog.mockReset();
  });

  describe('init', () => {
    it('should call getNetwork', async () => {
      mockGetNetwork.mockResolvedValueOnce({ chainId: '1' });
      await helper.init();

      expect(mockGetNetwork).toHaveBeenCalledTimes(1);
    });
  });
  describe('calculateTokenProfits', () => {
    it('should calculate 0 profits if there are no transactions from/to the address', async () => {
      const profits = helper.calculateTokenProfits(tokenProfitsEvents, '0xotherAddress');

      expect(profits).toStrictEqual({ [asset]: helper.zero });
    });
    it('should calculate positive profits', async () => {
      const profits = helper.calculateTokenProfits(tokenProfitsEvents, to);

      expect(profits).toStrictEqual({ [asset]: amount });
    });
    it('should calculate negative profits', async () => {
      const profits = helper.calculateTokenProfits(tokenProfitsEvents, from);

      expect(profits).toStrictEqual({ [asset]: amount.mul(-1) });
    });
  });
  describe('calculateNativeProfits', () => {
    it('should calculate 0 profits if there are no transactions from/to the address', async () => {
      const profits = helper.calculateNativeProfit(traces, '0xotherAddress');

      expect(profits).toStrictEqual(helper.zero);
    });
    it('should calculate positive profits', async () => {
      const profits = helper.calculateNativeProfit(traces, to);

      // 0xa = 10; 1 transfer of 10 + 1 refund of 10 = 20
      const expectedProfit = ethers.BigNumber.from(20);

      expect(profits).toStrictEqual(expectedProfit);
    });
    it('should calculate negative profits', async () => {
      const profits = helper.calculateNativeProfit(traces, from);

      // 0xa = 10; 1 transfer of 10
      const expectedProfit = ethers.BigNumber.from(-10);

      expect(profits).toStrictEqual(expectedProfit);
    });
  });
});
