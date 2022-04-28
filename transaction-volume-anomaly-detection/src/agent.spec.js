const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require("forta-agent");
const {
  provideHandleTransaction,
  provideHandleBlock,
  runJob,
} = require("./agent");

const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");

describe("Transaction Volume Anomaly Detection", () => {
  describe("handleTransaction", () => {
    const mockTxEvent = {
      to: "0x123",
      block: {
        number: "1234",
      },
    };

    const mockBlockEvent = {
      blockNumber: "1237",
    };

    const mockContractsList = ["0x123"];
    let mockContractBuckets;

    const mockGetTxReceipt = jest.fn();

    let handleTransaction;

    let handleBlock;

    beforeEach(() => {
      mockGetTxReceipt.mockReset();
      mockContractBuckets = [
        {
          "0x123": {
            successfulTx: new TimeSeriesAnalysis("0x123", 5),
            failedTx: new TimeSeriesAnalysis("0x123", 5),
          },
        },
      ];
      handleTransaction = provideHandleTransaction(
        mockContractsList,
        mockContractBuckets,
        mockGetTxReceipt
      );
      handleBlock = provideHandleBlock(mockContractBuckets);
    });

    it("successfully increments on successful transaction in the same block", async () => {
      mockGetTxReceipt.mockReturnValue({ status: true });
      await handleTransaction(mockTxEvent);
      await handleTransaction(mockTxEvent);

      expect(mockContractBuckets[0]["0x123"].successfulTx.total).toBe(2);
    });

    it("successfully increments on a failed transaction in the same block", async () => {
      mockGetTxReceipt.mockReturnValue({ status: false });
      await handleTransaction(mockTxEvent);
      await handleTransaction(mockTxEvent);

      expect(mockContractBuckets[0]["0x123"].failedTx.total).toBe(2);
    });

    it("should not return any findings if there are not tx anomalies for successful tx", async () => {
      const mockTxEventTwo = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventThree = {
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventFour = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventFive = {
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventSix = {
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: true });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEvent);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventFour);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventFive);
      }
      for (let i = 0; i < 500; i++) {
        await handleTransaction(mockTxEventSix);
      }

      //   console.log(
      //     mockContractBuckets[0][
      //       "0x123"
      //     ].successfulTx.GetNormalMarginOfDifferences()
      //   );
      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([]);
      expect(mockContractBuckets[0]["0x123"].successfulTx.IsFull()).toBe(true);
    });

    it("should not return any findings if there are not tx anomalies for failed tx", async () => {
      const mockTxEventTwo = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventThree = {
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventFour = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventFive = {
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventSix = {
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: false });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEvent);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventFour);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventFive);
      }
      for (let i = 0; i < 7; i++) {
        await handleTransaction(mockTxEventSix);
      }

      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([]);
      expect(mockContractBuckets[0]["0x123"].failedTx.IsFull()).toBe(true);
    });

    it("should return a finding if there are  tx anomalies for successful tx", async () => {
      const mockTxEventTwo = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventThree = {
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventFour = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventFive = {
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventSix = {
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: true });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEvent);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventFour);
      }
      for (let i = 0; i < 500; i++) {
        await handleTransaction(mockTxEventFive);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventSix);
      }

      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Unusually high number of successful transactions",
          description: `Significant increase of successful transactions have been observed from ${
            mockBlockEvent.blockNumber - 5
          } to ${mockBlockEvent.blockNumber}`,
          alertId: "SUCCESSFUL-TRANSACTION-VOL-INCREASE",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            COUNT: 520,
            EXPECTED_BASELINE: 104,
          },
        }),
      ]);
      expect(mockContractBuckets[0]["0x123"].successfulTx.IsFull()).toBe(true);
    });
    it("should return a finding if there are  tx anomalies for failed tx", async () => {
      const mockTxEventTwo = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventThree = {
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventFour = {
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventFive = {
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventSix = {
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: false });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEvent);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventFour);
      }
      for (let i = 0; i < 500; i++) {
        await handleTransaction(mockTxEventFive);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventSix);
      }

      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Unusually high number of failed transactions",
          description: `Significant increase of failed transactions have been observed from  ${
            mockBlockEvent.blockNumber - 5
          } to ${mockBlockEvent.blockNumber}`,
          alertId: "FAILED-TRANSACTION-VOL-INCREASE",
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
          metadata: {
            COUNT: 520,
            EXPECTED_BASELINE: 104,
          },
        }),
      ]);

      expect(mockContractBuckets[0]["0x123"].failedTx.IsFull()).toBe(true);
    });
  });
});
