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
const nativeToken = 'ethereum';

const amount = ethers.utils.parseEther('100');
const tokenProfit = ethers.utils.parseEther('10');
const nativeProfit = ethers.utils.parseEther('1');

const tokenUsdProfit = 100_000;
const nativeUsdProfit = 100_000;

const highNativeUsdProfit = 1_000_000;

const flashloan = {
  asset,
  amount,
  account: initiator,
};

const mockGetFlashloans = jest.fn();
const mockHelper = {
  zero: ethers.constants.Zero,
  getTransactionReceipt: jest.fn(),
  init: () => ({ chain, nativeToken }),
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

    it('returns a finding if there is a flashloan with high profit', async () => {
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
          description: `${initiator} launched flash loan attack and made profit > $100000`,
          alertId: 'FLASHLOAN-ATTACK-WITH-HIGH-PROFIT',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
          metadata: {
            profit: (tokenUsdProfit + nativeUsdProfit).toFixed(2),
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

    it('returns a finding if there is a flashloan with low profit', async () => {
      mockGetFlashloans.mockResolvedValueOnce([flashloan]);
      mockTxEvent.filterLog.mockReturnValueOnce([]); // Mock transfers
      mockHelper.calculateBorrowedAmount.mockResolvedValueOnce(10000);
      mockHelper.calculateTokenProfits.mockReturnValueOnce({ [asset]: tokenProfit });
      mockHelper.calculateNativeProfit.mockReturnValueOnce(nativeProfit);
      mockHelper.getTransactionReceipt.mockResolvedValueOnce({ gasUsed: 0 });
      mockHelper.calculateTokensUsdProfit.mockResolvedValueOnce(1000);
      mockHelper.calculateNativeUsdProfit.mockResolvedValueOnce(1000);
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Flashloan detected',
          description: `${initiator} launched flash loan attack`,
          alertId: 'FLASHLOAN-ATTACK',
          severity: FindingSeverity.Low,
          type: FindingType.Exploit,
          metadata: {
            profit: (2000).toFixed(2),
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

    it('returns a finding if there is a flashloan with high profit and low percentage', async () => {
      mockGetFlashloans.mockResolvedValueOnce([flashloan]);
      mockTxEvent.filterLog.mockReturnValueOnce([]); // Mock transfers
      mockHelper.calculateBorrowedAmount.mockResolvedValueOnce(100_000_000);
      mockHelper.calculateTokenProfits.mockReturnValueOnce({ [asset]: tokenProfit });
      mockHelper.calculateNativeProfit.mockReturnValueOnce(nativeProfit);
      mockHelper.getTransactionReceipt.mockResolvedValueOnce({ gasUsed: 0 });
      mockHelper.calculateTokensUsdProfit.mockResolvedValueOnce(tokenUsdProfit);
      mockHelper.calculateNativeUsdProfit.mockResolvedValueOnce(highNativeUsdProfit);
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Flashloan detected',
          description: `${initiator} launched flash loan attack and made profit > $500000`,
          alertId: 'FLASHLOAN-ATTACK-WITH-HIGH-PROFIT',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
          metadata: {
            profit: (tokenUsdProfit + highNativeUsdProfit).toFixed(2),
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
