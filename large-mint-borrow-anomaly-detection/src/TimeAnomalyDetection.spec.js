const TimeAnomalyDetection = require("./TimeAnomalyDetection");
const ARIMA_CONFIG = {
  p: 2,
  d: 1,
  q: 2,
  P: 1,
  D: 0,
  Q: 1,
  s: 5,
  verbose: false,
};
describe("Time Anomaly Detection", () => {
  let TimeAnomalyDetectionTemp = new TimeAnomalyDetection(
    "0x0",
    3,
    3,
    ARIMA_CONFIG
  );

  beforeEach(() => {
    TimeAnomalyDetectionTemp = new TimeAnomalyDetection(
      "0x0",
      3,
      3,
      ARIMA_CONFIG
    );
    TimeAnomalyDetectionTemp.startTimestampMints = 1;
    TimeAnomalyDetectionTemp.startTimestampBorrows = 1;
  });

  it("Should successfully create an instance of the TimeAnomalyDetection object", () => {
    expect(TimeAnomalyDetectionTemp).not.toBe(null);
  });

  it("Should successfully add a mint tx to the TAD object", () => {
    const mintTxMock = {
      block: {
        number: 1,
        timestamp: 10,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addMintTx(mintTxMock, 1);
    expect(TimeAnomalyDetectionTemp.totalAssetsMinted).toStrictEqual([1]);
    expect(TimeAnomalyDetectionTemp.isTrainedMints).toBe(false);
    expect(TimeAnomalyDetectionTemp.totalMintsForRange).toBe(1);
  });

  it("Should successfully add a borrow tx to the TAD object", () => {
    const borrowTxMock = {
      block: {
        number: 1,
        timestamp: 10,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMock, 1);
    expect(TimeAnomalyDetectionTemp.totalAssetsBorrowed).toStrictEqual([1]);
    expect(TimeAnomalyDetectionTemp.totalBorrowsForRange).toBe(1);
    expect(TimeAnomalyDetectionTemp.isTrainedBorrows).toBeFalsy();
  });

  it("Should increase block number if its changed from tx", () => {
    const borrowTxMock = {
      block: {
        number: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };
    const borrowTxMockTwo = {
      block: {
        number: 2,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMock, 1);
    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMockTwo, 1);

    expect(TimeAnomalyDetectionTemp.totalAssetsBorrowed).toStrictEqual([1, 1]);
    expect(TimeAnomalyDetectionTemp.totalBorrowsForRange).toBe(2);
    expect(TimeAnomalyDetectionTemp.isTrainedBorrows).toBeFalsy();
  });

  it("Should successfully train for mint tx", () => {
    const mintTxMock = {
      block: {
        number: 1,
        timestamp: 10,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockTwo = {
      block: {
        number: 2,
        timestamp: 10,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockThree = {
      block: {
        number: 3,
        timestamp: 10,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockFour = {
      block: {
        number: 4,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockFive = {
      block: {
        number: 4,
        timestamp: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addMintTx(mintTxMock, 1);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockTwo, 5);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockThree, 7);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockFour, 3);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockFive, 2);
    expect(TimeAnomalyDetectionTemp.isTrainedMints).toBeTruthy();
  });

  it("Should successfully train for borrow tx", () => {
    const borrowTxMock = {
      block: {
        number: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const borrowTxMockTwo = {
      block: {
        number: 2,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const borrowTxMockThree = {
      block: {
        number: 3,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const borrowTxMockFour = {
      block: {
        number: 4,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const borrowTxMockFive = {
      block: {
        number: 4,
        timestamp: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMock, 4);

    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMockTwo, 7);

    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMockThree, 10);

    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMockFour, 7);
    TimeAnomalyDetectionTemp.addBorrowTx(borrowTxMockFive, 7);

    expect(TimeAnomalyDetectionTemp.isTrainedBorrows).toBeTruthy();
  });

  it("Should successfully return low and high for mint tx", () => {
    const mintTxMock = {
      block: {
        number: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockTwo = {
      block: {
        number: 2,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockThree = {
      block: {
        number: 3,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockFour = {
      block: {
        number: 4,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };
    const mintTxMockFive = {
      block: {
        number: 5,
        timestamp: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addMintTx(mintTxMock, 10);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockTwo, 12);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockThree, 7);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockFour, 5);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockFive, 12);

    expect(TimeAnomalyDetectionTemp.getHighAndPredMints()).toStrictEqual([
      12.347856160270762, 6.17800686657624,
    ]);
  });

  it("Should successfully return low and high for borrow tx", () => {
    const mintTxMock = {
      block: {
        number: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockTwo = {
      block: {
        number: 2,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockThree = {
      block: {
        number: 3,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockFour = {
      block: {
        number: 4,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };
    const mintTxMockFive = {
      block: {
        number: 5,
        timestamp: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMock, 10);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockTwo, 15);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockThree, 17);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockFour, 13);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockFive, 10);

    expect(TimeAnomalyDetectionTemp.getHighAndPredBorrows()).toStrictEqual([
      9.001195523894124, 9.000482633381713,
    ]);
  });

  it("Should successfully return flag object for mint tx", () => {
    const mintTxMock = {
      block: {
        number: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockTwo = {
      block: {
        number: 2,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockThree = {
      block: {
        number: 3,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockFour = {
      block: {
        number: 4,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };
    const mintTxMockFive = {
      block: {
        number: 5,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addMintTx(mintTxMock, 1);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockTwo, 1);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockThree, 1);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockFour, 1);

    TimeAnomalyDetectionTemp.addMintTx(mintTxMockFive, 1);

    expect(TimeAnomalyDetectionTemp.getMintsForFlag()).toStrictEqual({
      firstTxHash: "0xx0",
      from_address: "0x0",
      lastTxHash: "0xx0",
      mintedAssetAccount: "0x123",
      numberOfAssets: 1,
    });
  });

  it("Should successfully return flag object for borrow tx", () => {
    const mintTxMock = {
      block: {
        number: 1,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockTwo = {
      block: {
        number: 2,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockThree = {
      block: {
        number: 3,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    const mintTxMockFour = {
      block: {
        number: 4,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };
    const mintTxMockFive = {
      block: {
        number: 5,
      },
      to: "0x123",
      from: "0x1234",
      transaction: {
        hash: "0xx0",
      },
    };

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMock, 1);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockTwo, 1);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockThree, 1);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockFour, 1);

    TimeAnomalyDetectionTemp.addBorrowTx(mintTxMockFive, 1);

    expect(TimeAnomalyDetectionTemp.getBorrowsForFlag()).toStrictEqual({
      firstTxHash: "0xx0",
      from_address: "0x0",
      lastTxHash: "0xx0",
      borrowedAssetAccount: "0x123",
      numberOfAssets: 1,
    });
  });
});
