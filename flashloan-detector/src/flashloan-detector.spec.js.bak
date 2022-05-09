const { ethers } = require('forta-agent');
const FlashloanDetector = require('./flashloan-detector');

const amount = ethers.utils.parseUnits('100', 18);

// Event information is not important if we mock 'filterLog'
const mockAaveEvent = {};

const mockDydxWithdrawEvent = {
  args: {
    market: ethers.constants.Zero,
    update: {
      deltaWei: {
        sign: false,
        value: ethers.BigNumber.from(10),
      },
    },
  },
};

const mockDydxDepositEvent = {
  args: {
    market: ethers.constants.Zero,
    update: {
      deltaWei: {
        sign: true,
        value: ethers.BigNumber.from(12),
      },
    },
  },
};

const mockEulerBorrowEvent = {
  name: 'Borrow',
  args: {
    amount,
    underlying: '0xunderlying',
  },
};

const mockEulerRepayEvent = {
  name: 'Repay',
  args: {
    amount,
    underlying: '0xunderlying',
  },
};

// Event information is not important if we mock 'filterLog'
const mockIronBankEvent = {};

// Event information is not important if we mock 'filterLog'
const mockMakerEvent = {};

describe('FlashloanDetector library', () => {
  let flashloanDetector;
  const mockTxEvent = { filterLog: jest.fn() };

  beforeEach(() => {
    mockTxEvent.filterLog.mockReset();
  });

  describe('getFlashloans', () => {
    it('should return empty array if there are no flashloans', () => {
      flashloanDetector = new FlashloanDetector();

      // Don't mock
      mockTxEvent.filterLog.mockReturnValue([]);
      const flashloans = flashloanDetector.getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual([]);
    });

    it('should return the "Aave" protocol if there is a flashloan from Aave', () => {
      // Detect flashloans only for Aave so we don't have to mock
      // the filterLog calls for the other protocols
      flashloanDetector = new FlashloanDetector(['aave']);

      mockTxEvent.filterLog.mockReturnValueOnce([mockAaveEvent]);
      const flashloans = flashloanDetector.getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual(['Aave']);
    });

    it('should return the "dYdX" protocol if there is a flashloan from dYdX', () => {
      flashloanDetector = new FlashloanDetector(['dydx']);

      mockTxEvent.filterLog.mockReturnValueOnce([mockDydxWithdrawEvent, mockDydxDepositEvent]);
      const flashloans = flashloanDetector.getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual(['dYdX']);
    });

    it('should return the "Euler" protocol if there is a flashloan from Euler', () => {
      flashloanDetector = new FlashloanDetector(['euler']);

      mockTxEvent.filterLog.mockReturnValueOnce([mockEulerBorrowEvent, mockEulerRepayEvent]);
      const flashloans = flashloanDetector.getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual(['Euler']);
    });

    it('should return the "Iron Bank" protocol if there is a flashloan from Iron Bank', () => {
      flashloanDetector = new FlashloanDetector(['ironBank']);

      mockTxEvent.filterLog.mockReturnValueOnce([mockIronBankEvent]);
      const flashloans = flashloanDetector.getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual(['Iron Bank']);
    });

    it('should return the "MakerDAO" protocol if there is a flashloan from MakerDAO', () => {
      flashloanDetector = new FlashloanDetector(['maker']);

      mockTxEvent.filterLog.mockReturnValueOnce([mockMakerEvent]);
      const flashloans = flashloanDetector.getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual(['MakerDAO']);
    });

    it('should return the all protocols if there is a flashloan from all', () => {
      flashloanDetector = new FlashloanDetector();

      mockTxEvent.filterLog.mockReturnValueOnce([mockAaveEvent]);
      mockTxEvent.filterLog.mockReturnValueOnce([mockDydxWithdrawEvent, mockDydxDepositEvent]);
      mockTxEvent.filterLog.mockReturnValueOnce([mockEulerBorrowEvent, mockEulerRepayEvent]);
      mockTxEvent.filterLog.mockReturnValueOnce([mockIronBankEvent]);
      mockTxEvent.filterLog.mockReturnValueOnce([mockMakerEvent]);
      const flashloans = flashloanDetector.getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual(['Aave', 'dYdX', 'Euler', 'Iron Bank', 'MakerDAO']);
    });
  });
});
