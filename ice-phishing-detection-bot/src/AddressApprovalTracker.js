class AddressApprovalTracker {
  constructor(address, days) {
    this.addressTracked = address;
    this.totalApprovalsForRange = 0;
    this.totalAssetsApproved = 0;
    this.daysTracked = days;
    this.trackingApprovals = [];
    this.trackingTransfers = [];
    this.totalAssetsTransfered = 0;
    this.totalAccountsTransferedFrom = 0;
  }

  AddToApprovals(approvedAssetAccount, accountApproved, txHash) {
    this.totalApprovalsForRange++;
    const found = this.trackingApprovals.find(
      (t) => t.approvedAssetAccount == approvedAssetAccount
    );
    if (!found) {
      this.totalAssetsApproved++;
    }
    const approvalDate = new Date();
    const trackingObject = {
      approvedAssetAccount,
      accountApproved,
      approvalDate,
      txHash,
    };
    this.trackingApprovals.push(trackingObject);
    this.CheckForPassedThresholdApprovals();
  }

  AddToTransfers(assetTransfered, accountTransferedFrom, txHash) {
    const foundAssetTransfered = this.trackingTransfers.find(
      (t) => t.assetTransfered == assetTransfered
    );
    if (!foundAssetTransfered) {
      this.totalAssetsTransfered++;
    }

    const foundAccountTransferedFrom = this.trackingTransfers.find(
      (t) => t.accountTransferedFrom == accountTransferedFrom
    );

    if (!foundAccountTransferedFrom) {
      this.totalAccountsTransferedFrom++;
    }

    const transferedDate = new Date();
    const trackingObject = {
      assetTransfered,
      accountTransferedFrom,
      transferedDate,
      txHash,
    };

    this.trackingTransfers.push(trackingObject);
    this.CheckForPassedThresholdTransfers();
  }

  CheckForPassedThresholdApprovals() {
    const trackedToRemove = [];
    let totalAssetsApprovedRemoved = [];
    for (let t of this.trackingApprovals) {
      const dateAdded = t.approvalDate;
      const dateNow = new Date();
      const timeDiff = (dateNow - dateAdded) / 1000; //strip the ms
      const seconds = Math.round(timeDiff);
      if (seconds > this.daysTracked) {
        trackedToRemove.push(t);
      }
    }
    totalAssetsApprovedRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });
    this.trackingApprovals = this.trackingApprovals.filter(
      (t) => !trackedToRemove.includes(t)
    );

    //Decrease total approvals for range by the amount of removed approvals that expired
    this.totalApprovalsForRange =
      this.totalApprovalsForRange - trackedToRemove.length;

    //Decrease the total count of assets approved by the amount removed that expired
    this.totalAssetsApproved =
      this.totalAssetsApproved - totalAssetsApprovedRemoved.length;
  }

  CheckForPassedThresholdTransfers() {
    const trackedToRemove = [];
    let totalAssetsTransferedRemoved = [];
    let totalAccountsTransferedRemoved = [];
    for (let t of this.trackingTransfers) {
      const dateAdded = t.transferedDate;
      const dateNow = new Date();
      const timeDiff = (dateNow - dateAdded) / 1000; //strip the ms
      const seconds = Math.round(timeDiff);
      if (seconds > this.daysTracked) {
        trackedToRemove.push(t);
      }
    }

    totalAssetsTransferedRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });
    totalAccountsTransferedRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });

    this.trackingTransfers = this.trackingTransfers.filter(
      (t) => !trackedToRemove.includes(t)
    );

    //Decrease total approvals for range by the amount of removed approvals that expired
    this.totalAccountsTransferedFrom =
      this.totalAccountsTransferedFrom - totalAccountsTransferedRemoved.length;

    //Decrease the total count of assets approved by the amount removed that expired
    this.totalAssetsTransfered =
      this.totalAssetsTransfered - totalAssetsTransferedRemoved.length;
  }

  GetApprovalCount() {
    return this.trackingApprovals.length;
  }

  IsPastThreshold() {
    const FirstTransfer = this.trackingTransfers[0];
    if (!FirstTransfer) {
      return false;
    }
    const DateAdded = FirstTransfer.transferedDate;
    const DateNow = new Date();
    const timeDiff = (DateNow - DateAdded) / 1000;
    const seconds = Math.round(timeDiff);

    if (seconds >= this.daysTracked) {
      return true;
    }
    return false;
  }

  GetApprovedForFlag() {
    const finalObject = {
      toAddress: this.addressTracked,
      startHash: this.trackingApprovals[0].txHash,
      endHash: this.trackingApprovals[this.trackingApprovals.length - 1].txHash,
      assetsImpacted: this.totalAssetsApproved,
      accountApproved: this.totalApprovalsForRange,
    };

    return finalObject;
  }

  GetApprovedTransferedForFlag() {
    const finalObject = {
      toAddress: this.addressTracked,
      startHash: this.trackingTransfers[0].txHash,
      endHash: this.trackingTransfers[this.trackingTransfers.length - 1].txHash,
      assetsImpacted: this.totalAssetsTransfered,
      accountsImpacted: this.totalAccountsTransferedFrom,
    };

    return finalObject;
  }
}

module.exports = AddressApprovalTracker;
