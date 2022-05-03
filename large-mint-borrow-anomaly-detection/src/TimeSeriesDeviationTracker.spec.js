const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");

describe("Time Series Analysis", () => {
  let TimeSeriesAnalysisTemp;

  beforeEach(() => {
    TimeSeriesAnalysisTemp = new TimeSeriesAnalysis("0xabc", 5);
  });

  it("Should successfully create an instance of class ", () => {
    expect(TimeSeriesAnalysisTemp).not.toBe(undefined);
  });

  it("Should successfully add a test tx", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };

    TimeSeriesAnalysisTemp.AddTransaction(mockTx);

    expect(TimeSeriesAnalysisTemp.total).not.toBe(0);
  });

  it("Should successfully add a new bucket if new tx is with a different block number", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };
    const mockTxWithNewNumber = {
      block: {
        number: "1924",
      },
    };

    TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxWithNewNumber);

    expect(TimeSeriesAnalysisTemp.total).toBe(1);
  });

  it("Should successfully return incremented total if we add two transactions from the same block", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };

    TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    TimeSeriesAnalysisTemp.AddTransaction(mockTx);

    expect(TimeSeriesAnalysisTemp.total).toBe(2);
  });

  it("Should successfully return true if the we have a full timeline", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };
    const mockTxTwo = {
      block: {
        number: "1924",
      },
    };
    const mockTxThree = {
      block: {
        number: "1925",
      },
    };

    const mockTxFour = {
      block: {
        number: "1926",
      },
    };
    const mockTxFive = {
      block: {
        number: "1927",
      },
    };
    const mockTxSix = {
      block: {
        number: "1928",
      },
    };

    TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxTwo);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxThree);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxFour);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxFive);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxSix);

    expect(TimeSeriesAnalysisTemp.IsFull()).toBe(true);
  });

  it("Should successfully remove a Bucket if we add a new block and timeline is full", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };
    const mockTxTwo = {
      block: {
        number: "1924",
      },
    };
    const mockTxThree = {
      block: {
        number: "1925",
      },
    };

    const mockTxFour = {
      block: {
        number: "1926",
      },
    };
    const mockTxFive = {
      block: {
        number: "1927",
      },
    };
    const mockTxSix = {
      block: {
        number: "1928",
      },
    };

    TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxTwo);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxThree);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxFour);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxFive);
    TimeSeriesAnalysisTemp.AddTransaction(mockTxSix);

    expect(TimeSeriesAnalysisTemp.IsFull()).toBe(true);
  });

  it("Should add all items to buckets and return Std average for all data", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };
    const mockTxTwo = {
      block: {
        number: "1924",
      },
    };
    const mockTxThree = {
      block: {
        number: "1925",
      },
    };

    const mockTxFour = {
      block: {
        number: "1926",
      },
    };
    const mockTxFive = {
      block: {
        number: "1927",
      },
    };

    for (let i = 0; i < 10; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    }
    for (let i = 0; i < 15; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxTwo);
    }
    for (let i = 0; i < 9; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxThree);
    }
    for (let i = 0; i < 10; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFour);
    }
    for (let i = 0; i < 20; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFive);
    }

    expect(TimeSeriesAnalysisTemp.GetStdForLatestBucket()).not.toBe(0);
  });

  it("Should add all items to buckets and return Total for last bucket for all data", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };
    const mockTxTwo = {
      block: {
        number: "1924",
      },
    };
    const mockTxThree = {
      block: {
        number: "1925",
      },
    };

    const mockTxFour = {
      block: {
        number: "1926",
      },
    };
    const mockTxFive = {
      block: {
        number: "1927",
      },
    };

    for (let i = 0; i < 10; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    }
    for (let i = 0; i < 15; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxTwo);
    }
    for (let i = 0; i < 9; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxThree);
    }
    for (let i = 0; i < 10; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFour);
    }
    for (let i = 0; i < 20; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFive);
    }

    expect(TimeSeriesAnalysisTemp.GetTotalForLastBucket()).not.toBe(0);
  });

  it("Should add all items to buckets and return Baseline for all data", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };
    const mockTxTwo = {
      block: {
        number: "1924",
      },
    };
    const mockTxThree = {
      block: {
        number: "1925",
      },
    };

    const mockTxFour = {
      block: {
        number: "1926",
      },
    };
    const mockTxFive = {
      block: {
        number: "1927",
      },
    };

    for (let i = 0; i < 10; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    }
    for (let i = 0; i < 15; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxTwo);
    }
    for (let i = 0; i < 9; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxThree);
    }
    for (let i = 0; i < 10; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFour);
    }
    for (let i = 0; i < 20; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFive);
    }

    expect(TimeSeriesAnalysisTemp.GetBaselineForLastBucket()).not.toBe(0);
  });

  it("Should add all items to buckets and return Normal Marginal Difference for all data", () => {
    const mockTx = {
      block: {
        number: "1923",
      },
    };
    const mockTxTwo = {
      block: {
        number: "1924",
      },
    };
    const mockTxThree = {
      block: {
        number: "1925",
      },
    };

    const mockTxFour = {
      block: {
        number: "1926",
      },
    };
    const mockTxFive = {
      block: {
        number: "1927",
      },
    };

    for (let i = 0; i < 3; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTx);
    }
    for (let i = 0; i < 4; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxTwo);
    }
    for (let i = 0; i < 3; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxThree);
    }
    for (let i = 0; i < 5; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFour);
    }
    for (let i = 0; i < 6; i++) {
      TimeSeriesAnalysisTemp.AddTransaction(mockTxFive);
    }

    expect(TimeSeriesAnalysisTemp.GetNormalMarginOfDifferences()).not.toBe(0);
  });
});
