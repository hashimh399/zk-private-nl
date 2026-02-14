import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("PriceFeed + MockPriceFeed (AggregatorV3 mock): e2e", function () {
  let admin: any;
  let dev: any;
  let alice: any;

  let priceFeed: any;
  let mockFeed: any;

  beforeEach(async () => {
    [admin, dev, alice] = await ethers.getSigners();

    // Deploy MockPriceFeed (AggregatorV3-style)
    const Mock = await ethers.getContractFactory("MockPriceFeed");
    mockFeed = await Mock.deploy(8, ethers.parseUnits("3000", 8)); // 3000e8
    await mockFeed.waitForDeployment?.();

    // Deploy PriceFeed wrapper (the contract that has getDataFeed(address))
    const PriceFeed = await ethers.getContractFactory("PriceFeed");
    priceFeed = await PriceFeed.deploy(
      60, // initialMaxAgeSeconds
      admin.address,
      dev.address
    );
    await priceFeed.waitForDeployment?.();
  });

  it("happy path: getDataFeed returns (answer, decimals, updatedAt) from aggregator", async () => {
    const [answer, dec, updatedAt] = await priceFeed.getDataFeed(mockFeed.target);

    expect(answer).to.equal(ethers.parseUnits("3000", 8));
    expect(dec).to.equal(8);
    expect(updatedAt).to.be.gt(0n);
  });

  it("happy path: updates propagate after mock updateAnswer()", async () => {
    await mockFeed.updateAnswer(ethers.parseUnits("1200", 8));

    const [answer] = await priceFeed.getDataFeed(mockFeed.target);
    expect(answer).to.equal(ethers.parseUnits("1200", 8));
  });

  it("happy path: decimals can change on mock and wrapper returns new decimals", async () => {
    await mockFeed.setDecimals(18);

    const [, dec] = await priceFeed.getDataFeed(mockFeed.target);
    expect(dec).to.equal(18);
  });

  it("reverts: tokenFeed is zero address", async () => {
    await expect(priceFeed.getDataFeed(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(priceFeed, "InvalidFeedAddress")
      .withArgs(ethers.ZeroAddress);
  });

  it("reverts: tokenFeed is not a contract (EOA)", async () => {
    await expect(priceFeed.getDataFeed(alice.address))
      .to.be.revertedWithCustomError(priceFeed, "InvalidAggregator")
      .withArgs(alice.address);
  });

  it("reverts: BadAnswer when answer <= 0 (from mock)", async () => {
    await mockFeed.updateAnswer(0);

    await expect(priceFeed.getDataFeed(mockFeed.target))
      .to.be.revertedWithCustomError(priceFeed, "BadAnswer")
      .withArgs(mockFeed.target, 0);
  });

  it("reverts: StaleAnswer when updatedAt too old and maxAgeSeconds != 0", async () => {
    // enforce max age = 60 (constructor value)
    expect(await priceFeed.maxAgeSeconds()).to.equal(60);

    const latestBlock = await ethers.provider.getBlock("latest");
    const oldTs = BigInt(latestBlock!.timestamp) - 120n; // 120s ago > 60s

    // Make the aggregator timestamp old (simulate stale feed)
    await mockFeed.setTimestamp(oldTs);

    await expect(priceFeed.getDataFeed(mockFeed.target))
      .to.be.revertedWithCustomError(priceFeed, "StaleAnswer")
      .withArgs(mockFeed.target, oldTs, 60);
  });

  it("staleness toggle: maxAgeSeconds=0 allows stale data", async () => {
    const latestBlock = await ethers.provider.getBlock("latest");
    const oldTs = BigInt(latestBlock!.timestamp) - 3600n; // 1 hour ago

    await mockFeed.setTimestamp(oldTs);

    // With maxAge=60, stale should revert
    await expect(priceFeed.getDataFeed(mockFeed.target))
      .to.be.revertedWithCustomError(priceFeed, "StaleAnswer");

    // Only dev can update maxAgeSeconds
    await expect(priceFeed.connect(alice).setMaxAgeSeconds(0)).to.be.reverted;
    await priceFeed.connect(dev).setMaxAgeSeconds(0);

    // Now it should succeed
    const [answer, dec, updatedAt] = await priceFeed.getDataFeed(mockFeed.target);
    expect(answer).to.equal(ethers.parseUnits("3000", 8));
    expect(dec).to.equal(8);
    expect(updatedAt).to.equal(oldTs);
  });

  it("reverts: BadRound when answeredInRound < roundId", async () => {
    // Move to a new round so rid > 1
    await mockFeed.updateAnswer(ethers.parseUnits("2999", 8));

    const [roundId] = await mockFeed.latestRoundData();
    expect(roundId).to.be.gt(1n);

    // Force answeredInRound to be behind roundId
    await mockFeed.setAnsweredInRound(roundId - 1n);

    await expect(priceFeed.getDataFeed(mockFeed.target))
      .to.be.revertedWithCustomError(priceFeed, "BadRound")
      .withArgs(mockFeed.target, roundId, roundId - 1n);
  });

  it("access control: only DEVELOPER_ROLE can setMaxAgeSeconds", async () => {
    await expect(priceFeed.connect(alice).setMaxAgeSeconds(30)).to.be.reverted;

    await expect(priceFeed.connect(dev).setMaxAgeSeconds(30))
      .to.emit(priceFeed, "MaxAgeUpdated");

    expect(await priceFeed.maxAgeSeconds()).to.equal(30);
  });
});
