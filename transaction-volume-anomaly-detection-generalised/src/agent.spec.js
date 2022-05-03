const { FindingType, FindingSeverity, Finding } = require("forta-agent");
const { provideHandleTransaction, provideHandleBlock } = require("./agent");
const moduleTest = require("./agent.config");
const TimeSeriesAnalysis = require("./TimeSeriesDeviationTracker");

jest.mock("./agent.config.js", () => {
  const defaultModule = jest.requireActual("./agent.config.js");
  return {
    ...defaultModule,
    globalSensitivity: 1,
  };
});

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
    const mockTraces = [
      {
        action: {
          callType: "call",
          from: "0xd14d0f48164766bcb8637c0a37bcbbd7dd69de6c",
          gas: "0x6da1",
          input: "0x18e06e82",
          to: "0xf5e6b39203652d08839dadded95a26d7fd12a842",
          value: "0x0",
        },
        blockHash:
          "0x8218404d9ace44044368027d2c5f6f260b8c83112c17f75ee4b5f16aed742e94",
        blockNumber: 14666405,
        result: {
          gasUsed: "0x24dc",
          output: "0x",
        },
        subtraces: 1,
        traceAddress: [],
        transactionHash:
          "0x16047d236914fc646f23d288b705d64ec1dd0edf84500a71d5f26b492400adb4",
        transactionPosition: 18,
        type: "call",
      },
      {
        action: {
          callType: "call",
          from: "0xf5e6b39203652d08839dadded95a26d7fd12a842",
          gas: "0x8fc",
          input: "0x",
          to: "0xd14d0f48164766bcb8637c0a37bcbbd7dd69de6c",
          value: "0x48dbbf2f2ecd0000",
        },
        blockHash:
          "0x8218404d9ace44044368027d2c5f6f260b8c83112c17f75ee4b5f16aed742e94",
        blockNumber: 14666405,
        result: {
          gasUsed: "0x0",
          output: "0x",
        },
        subtraces: 0,
        traceAddress: [0],
        transactionHash:
          "0x16047d236914fc646f23d288b705d64ec1dd0edf84500a71d5f26b492400adb4",
        transactionPosition: 18,
        type: "call",
      },
    ];
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
            successfulInternalTx: new TimeSeriesAnalysis("0x123", 5),
            failedInternalTx: new TimeSeriesAnalysis("0x123", 5),
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

    it("should not return any findings if there are no tx anomalies for successful internal tx", async () => {
      const mockTxEventWithTraces = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventWithTracesTwo = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventWithTracesThree = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventWithTracesFour = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      const mockTxEventWithTracesFive = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1238",
        },
      };
      const mockTxEventWithTracesSix = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1239",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: true });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTraces);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventWithTracesTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTracesFour);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTracesFive);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesSix);
      }
      mockBlockEvent.blockNumber = "1239";
      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([]);
      expect(
        mockContractBuckets[0]["0x123"].successfulInternalTx.IsFull()
      ).toBe(true);
    });

    it("should not return any findings if there are no tx anomalies for failed internal tx", async () => {
      const mockTxEventWithTraces = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventWithTracesTwo = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventWithTracesThree = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventWithTracesFour = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      const mockTxEventWithTracesFive = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1238",
        },
      };
      const mockTxEventWithTracesSix = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1239",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: false });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTraces);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventWithTracesTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTracesFour);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTracesFive);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesSix);
      }
      mockBlockEvent.blockNumber = "1239";
      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([]);
      expect(mockContractBuckets[0]["0x123"].failedInternalTx.IsFull()).toBe(
        true
      );
    });

    it("should return a finding if there are  tx anomalies for successful internal tx", async () => {
      const mockTxEventWithTraces = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventWithTracesTwo = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventWithTracesThree = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventWithTracesFour = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      const mockTxEventWithTracesFive = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1238",
        },
      };
      const mockTxEventWithTracesSix = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1239",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: true });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTraces);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventWithTracesTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTracesFour);
      }
      for (let i = 0; i < 500; i++) {
        await handleTransaction(mockTxEventWithTracesFive);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesSix);
      }
      mockBlockEvent.blockNumber = "1239";
      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Unusually high number of successful internal transactions",
          description: `Significant increase of successful internal transactions have been observed from ${
            mockBlockEvent.blockNumber - 5
          } to ${mockBlockEvent.blockNumber}`,
          alertId: "SUCCESSFUL-INTERNAL-TRANSACTION-VOL-INCREASE",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            COUNT: 1040,
            EXPECTED_BASELINE: 208,
          },
        }),
      ]);
      expect(
        mockContractBuckets[0]["0x123"].successfulInternalTx.IsFull()
      ).toBe(true);
    });

    it("should return a findings if there are tx anomalies for failed internal tx", async () => {
      const mockTxEventWithTraces = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1234",
        },
      };
      const mockTxEventWithTracesTwo = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1235",
        },
      };
      const mockTxEventWithTracesThree = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1236",
        },
      };
      const mockTxEventWithTracesFour = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1237",
        },
      };
      const mockTxEventWithTracesFive = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1238",
        },
      };
      const mockTxEventWithTracesSix = {
        traces: mockTraces,
        to: "0x123",
        block: {
          number: "1239",
        },
      };
      mockGetTxReceipt.mockReturnValue({ status: false });
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTraces);
      }
      for (let i = 0; i < 4; i++) {
        await handleTransaction(mockTxEventWithTracesTwo);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesThree);
      }
      for (let i = 0; i < 5; i++) {
        await handleTransaction(mockTxEventWithTracesFour);
      }
      for (let i = 0; i < 500; i++) {
        await handleTransaction(mockTxEventWithTracesFive);
      }
      for (let i = 0; i < 6; i++) {
        await handleTransaction(mockTxEventWithTracesSix);
      }
      mockBlockEvent.blockNumber = "1239";
      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Unusually high number of failed internal transactions",
          description: `Significant increase of failed internal transactions have been observed from ${
            mockBlockEvent.blockNumber - 5
          } to ${mockBlockEvent.blockNumber}`,
          alertId: "FAILED-INTERNAL-TRANSACTION-VOL-INCREASE",
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            COUNT: 1040,
            EXPECTED_BASELINE: 208,
          },
        }),
      ]);
      expect(mockContractBuckets[0]["0x123"].failedInternalTx.IsFull()).toBe(
        true
      );
    });
  });
});
