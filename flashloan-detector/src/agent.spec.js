const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
} = require('forta-agent');
const { provideHandleTransaction, provideInitialize } = require('./agent');

const asset = '0xasset';
const initiator = '0xfrom';
const chain = 'ethereum';

const amount = ethers.utils.parseEther('100');
const tokenProfit = ethers.utils.parseEther('10');
const nativeProfit = ethers.utils.parseEther('1');

const tokenUsdProfit = 1000;
const nativeUsdProfit = 1000;

const flashloan = {
  asset,
  amount,
  account: initiator,
};

const mockGetFlashloans = jest.fn();
const mockHelper = {
  zero: ethers.constants.Zero,
  getTransactionReceipt: jest.fn(),
  init: () => chain,
  calculateBorrowedAmount: jest.fn(),
  calculateTokenProfits: jest.fn(),
  calculateNativeProfit: jest.fn(),
  calculateTokensUsdProfit: jest.fn(),
  calculateNativeUsdProfit: jest.fn(),
  clear: () => {},
};

describe('flashloan detector agent', () => {
  describe('handleTransaction', () => {
    let initialize;
    let handleTransaction;

    const mockTxEvent = {
      from: initiator,
      traces: [],
      filterLog: jest.fn(),
      transaction: { gasPrice: 0 },
    };

    beforeAll(async () => {
      initialize = provideInitialize(mockHelper);
      await initialize();
      handleTransaction = provideHandleTransaction(mockHelper, mockGetFlashloans);
    });

    it('returns empty findings if there are no flashloans', async () => {
      mockGetFlashloans.mockResolvedValueOnce([]);
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if there is a flashloan', async () => {
      mockGetFlashloans.mockResolvedValueOnce([flashloan]);
      mockTxEvent.filterLog.mockReturnValueOnce([]); // Mock transfers
      mockHelper.calculateBorrowedAmount.mockResolvedValueOnce(10000);
      mockHelper.calculateTokenProfits.mockReturnValueOnce({ [asset]: tokenProfit });
      mockHelper.calculateNativeProfit.mockReturnValueOnce(nativeProfit);
      mockHelper.getTransactionReceipt.mockResolvedValueOnce({ gasUsed: 0 });
      mockHelper.calculateTokensUsdProfit.mockResolvedValueOnce(tokenUsdProfit);
      mockHelper.calculateNativeUsdProfit.mockResolvedValueOnce(nativeUsdProfit);
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Flashloan detected',
          description: `${initiator} launched flash loan attack`,
          alertId: 'FLASHLOAN-ATTACK',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
          metadata: {
            profit: tokenUsdProfit + nativeUsdProfit,
            tokens: [asset],
          },
        }),
      ]);

      expect(mockHelper.calculateBorrowedAmount).toHaveBeenCalledWith(asset, amount, chain);
      expect(mockHelper.calculateTokenProfits).toHaveBeenCalledWith([], initiator);
      expect(mockHelper.calculateNativeProfit).toHaveBeenCalledWith([], initiator);
      expect(mockHelper.calculateTokensUsdProfit).toHaveBeenCalledWith({
        [asset]: tokenProfit,
      }, chain);
      expect(mockHelper.calculateNativeUsdProfit).toHaveBeenCalledWith(nativeProfit, chain);
    });
  });
});
