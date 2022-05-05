const TimeAnomalyDetection = require("./TimeAnomalyDetection");

describe("Time Anomaly Detection", () => {
  let TimeAnomalyDetectionTemp = new TimeAnomalyDetection("0x0", 3);

  beforeEach(() => {
    TimeAnomalyDetectionTemp = new TimeAnomalyDetection("0x0", 3);
  });

  it("Should successfully create an instance of the TimeAnomalyDetection object", () => {
    expect(TimeAnomalyDetectionTemp).not.toBe(null);
  });

  it("Should successfully add a mint tx to the TAD object", () => {
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

    TimeAnomalyDetectionTemp.AddMintTx(mintTxMock);
    expect(TimeAnomalyDetectionTemp.totalAssetsMinted).toBe(1);
    expect(TimeAnomalyDetectionTemp.mintsForRange).toBe(1);
    expect(TimeAnomalyDetectionTemp.mintBucket.getNumElements()).toBe(0);
    expect(TimeAnomalyDetectionTemp.currentBlock).toBe(1);
    expect(TimeAnomalyDetectionTemp.totalMintTransactions).toBe(1);
  });

  it("Should successfully add a borrow tx to the TAD object", () => {
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

    TimeAnomalyDetectionTemp.AddBorrowTx(borrowTxMock);
    expect(TimeAnomalyDetectionTemp.totalAssetsBorrowed).toBe(1);
    expect(TimeAnomalyDetectionTemp.borrowsForRange).toBe(1);
    expect(TimeAnomalyDetectionTemp.borrowBucket.getNumElements()).toBe(0);
    expect(TimeAnomalyDetectionTemp.currentBlock).toBe(1);
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

    TimeAnomalyDetectionTemp.AddBorrowTx(borrowTxMock);
    TimeAnomalyDetectionTemp.AddBorrowTx(borrowTxMockTwo);

    expect(TimeAnomalyDetectionTemp.totalAssetsBorrowed).toBe(1);
    expect(TimeAnomalyDetectionTemp.borrowsForRange).toBe(2);
    expect(TimeAnomalyDetectionTemp.totalBorrowTransactions).toBe(1);
    expect(TimeAnomalyDetectionTemp.borrowBucket.getNumElements()).toBe(1);
    expect(TimeAnomalyDetectionTemp.currentBlock).toBe(2);
  });

  it("Should successfully fill buckets for mint tx", () => {
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

    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMock);
    }
    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockTwo);
    }
    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockThree);
    }
    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockFour);
    }

    expect(TimeAnomalyDetectionTemp.GetIsFullMintBucket()).toBe(true);
  });

  it("Should successfully fill buckets for borrow tx", () => {
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

    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(borrowTxMock);
    }
    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(borrowTxMockTwo);
    }
    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(borrowTxMockThree);
    }
    for (let i = 0; i < 10; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(borrowTxMockFour);
    }

    expect(TimeAnomalyDetectionTemp.GetIsFullBorrowBucket()).toBe(true);
  });

  it("Should successfully return normal margin for mint tx", () => {
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

    for (let i = 0; i < 4; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMock);
    }
    for (let i = 0; i < 8; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockTwo);
    }
    for (let i = 0; i < 9; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockThree);
    }
    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockFour);
    }

    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockFive);
    }

    expect(TimeAnomalyDetectionTemp.GetMarginForMintBucket()).not.toBe(0);
  });

  it("Should successfully return normal margin for borrow tx", () => {
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

    for (let i = 0; i < 4; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMock);
    }
    for (let i = 0; i < 8; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockTwo);
    }
    for (let i = 0; i < 9; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockThree);
    }
    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockFour);
    }

    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockFive);
    }

    expect(TimeAnomalyDetectionTemp.GetMarginForBorrowBucket()).not.toBe(0);
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

    for (let i = 0; i < 4; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMock);
    }
    for (let i = 0; i < 8; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockTwo);
    }
    for (let i = 0; i < 9; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockThree);
    }
    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockFour);
    }

    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddMintTx(mintTxMockFive);
    }

    expect(TimeAnomalyDetectionTemp.GetMintsForFlag()).toStrictEqual({
      baseline: 10.666666666666666,
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

    for (let i = 0; i < 4; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMock);
    }
    for (let i = 0; i < 8; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockTwo);
    }
    for (let i = 0; i < 9; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockThree);
    }
    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockFour);
    }

    for (let i = 0; i < 15; i++) {
      TimeAnomalyDetectionTemp.AddBorrowTx(mintTxMockFive);
    }

    expect(TimeAnomalyDetectionTemp.GetBorrowsForFlag()).toStrictEqual({
      baseline: 10.666666666666666,
      firstTxHash: "0xx0",
      from_address: "0x0",
      lastTxHash: "0xx0",
      borrowedAssetAccount: "0x123",
      numberOfAssets: 1,
    });
  });
});
