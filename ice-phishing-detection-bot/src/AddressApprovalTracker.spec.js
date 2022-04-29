const AddressApprovalTracker = require("./AddressApprovalTracker");

describe("Address Approval Tracker", () => {
  const AddressApprovalTrackerTemp = new AddressApprovalTracker("0x123", 1);
  it("Should successfully create an object of type AddressApprovalTracker", () => {
    expect(AddressApprovalTrackerTemp).not.toBe(null);
  });

  it("Should successfully add to approvals", () => {
    AddressApprovalTrackerTemp.AddToApprovals("0x123", "0x123", "0x123");
    expect(AddressApprovalTrackerTemp.trackingApprovals.length).toBe(1);
  });

  it("Should successfully add to transfers", () => {
    AddressApprovalTrackerTemp.AddToTransfers("0x123", "0x123", "0x123");
    expect(AddressApprovalTrackerTemp.trackingTransfers.length).toBe(1);
  });

  it("Should get approval count", () => {
    expect(AddressApprovalTrackerTemp.GetApprovalCount()).not.toBe(null);
  });

  it("Should return false for IsPastThreshold", () => {
    expect(AddressApprovalTrackerTemp.IsPastThreshold()).toBe(false);
  });

  it("Should return an object from get approved for flag", () => {
    expect(AddressApprovalTrackerTemp.GetApprovedForFlag()).not.toBe(null);
  });

  it("Should return an object from get approved transfered for flag ", () => {
    expect(AddressApprovalTrackerTemp.GetApprovedTransferedForFlag()).not.toBe(
      null
    );
  });
});
