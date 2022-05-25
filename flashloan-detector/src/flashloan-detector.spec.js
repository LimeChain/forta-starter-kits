/* eslint-disable no-plusplus */
const { ethers } = require('forta-agent');
const { getFlashloans } = require('./flashloan-detector');

const asset = '0xasset';
const amount = ethers.utils.parseUnits('100', 18);
const account = '0xaccount';
const market = '0xmarket';

// Event information is not important if we mock 'filterLog'
const mockAaveEvent = {
  args: { asset, amount, target: account },
};

const mockEulerBorrowEvent = {
  name: 'Borrow',
  address: market,
  args: {
    amount,
    underlying: asset,
    account,
  },
};

const mockEulerRepayEvent = {
  name: 'Repay',
  address: market,
  args: {
    amount,
    underlying: asset,
    account,
  },
};

// Event information is not important if we mock 'filterLog'
const mockMakerEvent = {
  args: { token: asset, amount, receiver: account },
};

describe('FlashloanDetector library', () => {
  const mockTxEvent = { filterLog: jest.fn() };

  beforeEach(() => {
    mockTxEvent.filterLog.mockReset();
  });

  describe('getFlashloans', () => {
    it('should return empty array if there are no flashloans', async () => {
      // Don't mock
      mockTxEvent.filterLog.mockReturnValue([]);
      const flashloans = await getFlashloans(mockTxEvent);

      expect(flashloans).toStrictEqual([]);
    });

    it('should return the all protocols if there is a flashloan from all', async () => {
      mockTxEvent.filterLog.mockReturnValueOnce([mockAaveEvent]);
      mockTxEvent.filterLog.mockReturnValueOnce([]); // Cannot test because of the RPC call
      mockTxEvent.filterLog.mockReturnValueOnce([mockEulerBorrowEvent, mockEulerRepayEvent]);
      mockTxEvent.filterLog.mockReturnValueOnce([]); // Cannot test because of the RPC call
      mockTxEvent.filterLog.mockReturnValueOnce([mockMakerEvent]);
      const flashloans = await getFlashloans(mockTxEvent);

      const expectedFlashloanData = { account, amount, asset };
      const expectedArray = [];

      // 3 flashloans: aave, euler, maker
      for (let i = 0; i < 3; i++) {
        expectedArray.push(expectedFlashloanData);
      }

      expect(flashloans).toStrictEqual(expectedArray);
    });
  });
});
