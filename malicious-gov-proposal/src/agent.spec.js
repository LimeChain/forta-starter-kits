const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
} = require('forta-agent');
const {
  provideInitialize,
  handleTransaction,
} = require('./agent');

const from = '0xfrom';

const compParams = [
  {
    signature: 'enableFeeAmount(uint24 fee, int24 tickSpacing)',
    thresholds: [
      {
        name: 'fee',
        min: 10,
        max: 100,
      },
      {
        name: 'tickSpacing',
        min: 10,
        max: 100,
      },
    ],
  },
  {
    signature: 'transfer(address recipient, uint256 amount)',
    thresholds: [
      {
        name: 'amount',
        min: 0,
        max: 100,
        decimals: 18,
      },
    ],
  },
];

const aragonParams = [
  {
    string: 'burn * stETH',
    min: 40,
    max: 50,
  },
  {
    string: 'Fund _ with * stETH',
    min: 0,
    max: 1,
  },
];

describe('malicious governance proposal bot', () => {
  describe('handleTransaction for COMP governance', () => {
    let initialize;

    const mockTxEvent = {
      from,
      filterLog: jest.fn(),
    };

    beforeAll(() => {
      initialize = provideInitialize('comp', compParams);
      initialize();
    });

    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
    });

    it('should return empty findings if there are no new proposals', async () => {
      mockTxEvent.filterLog.mockReturnValue([]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('should return empty findings if there is a COMP proposal with params in range', async () => {
      const signatures = ['transfer(address,uint256)'];
      const calldatas = [
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256'],
          [ethers.constants.AddressZero, ethers.utils.parseEther('50')],
        ),
      ];
      const mockEvent = {
        args: {
          signatures,
          calldatas,
        },
      };
      mockTxEvent.filterLog.mockReturnValue([mockEvent]);
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('should return findings if there is a COMP proposal with params out of range', async () => {
      const signatures = ['enableFeeAmount(uint24 fee, int24 tickSpacing)'];
      const calldatas = [
        ethers.utils.defaultAbiCoder.encode(
          ['uint24', 'uint24'],
          [ethers.BigNumber.from(200), ethers.BigNumber.from(200)],
        ),
      ];
      const mockEvent = {
        args: {
          signatures,
          calldatas,
        },
      };
      mockTxEvent.filterLog.mockReturnValue([mockEvent]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Possible malicious governance proposal created',
          description: `${from} created a possible malicious governance proposal`,
          alertId: 'POSSIBLE-MALICIOUS-GOVT-PROPOSAL-CREATED',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
        }),
      ]);
    });

    it('should return findings if there is a COMP proposal with params out of range using decimals', async () => {
      const signatures = ['transfer(address,uint256)'];
      const calldatas = [
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256'],
          [ethers.constants.AddressZero, ethers.utils.parseEther('200')],
        ),
      ];
      const mockEvent = {
        args: {
          signatures,
          calldatas,
        },
      };
      mockTxEvent.filterLog.mockReturnValue([mockEvent]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Possible malicious governance proposal created',
          description: `${from} created a possible malicious governance proposal`,
          alertId: 'POSSIBLE-MALICIOUS-GOVT-PROPOSAL-CREATED',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
        }),
      ]);
    });
  });
  describe('handleTransaction for Aragon governance', () => {
    let initialize;

    const mockTxEvent = {
      from,
      filterLog: jest.fn(),
    };

    beforeAll(() => {
      initialize = provideInitialize('aragon', aragonParams);
      initialize();
    });

    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
    });

    it('should return empty findings if there are no new proposals', async () => {
      mockTxEvent.filterLog.mockReturnValue([]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('should return empty findings if there is a Aragon proposal with params in range', async () => {
      const mockEvent = {
        args: {
          metadata: 'Omnibus vote: 1) Burn 50 stETH shares on treasury address 0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c.',
        },
      };
      mockTxEvent.filterLog.mockReturnValue([mockEvent]);
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('should return findings if there is a Aragon proposal with params out of range', async () => {
      const mockEvent = {
        args: {
          metadata: 'Omnibus vote: 1) Burn 200 stETH shares on treasury address 0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c.',
        },
      };
      mockTxEvent.filterLog.mockReturnValue([mockEvent]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Possible malicious governance proposal created',
          description: `${from} created a possible malicious governance proposal`,
          alertId: 'POSSIBLE-MALICIOUS-GOVT-PROPOSAL-CREATED',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
        }),
      ]);
    });

    it('should return findings if there is a Aragon proposal with params out of range when param string includes _', async () => {
      const mockEvent = {
        args: {
          metadata: 'Omnibus vote: 1) Send 2,000,000 LDO to the Protocol Guild vesting contract '
          + '0xF29Ff96aaEa6C9A1fBa851f74737f3c069d4f1a9;2) Fund dedicated depositor'
          + 'multisig 0x5181d5D56Af4f823b96FE05f062D7a09761a5a53 with 200 stETH.',
        },
      };
      mockTxEvent.filterLog.mockReturnValue([mockEvent]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Possible malicious governance proposal created',
          description: `${from} created a possible malicious governance proposal`,
          alertId: 'POSSIBLE-MALICIOUS-GOVT-PROPOSAL-CREATED',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
        }),
      ]);
    });
  });
});
