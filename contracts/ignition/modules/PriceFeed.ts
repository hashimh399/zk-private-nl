import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PriceFeedModule", (m) => {
  const deployer = m.getAccount(0);

  const initialMaxAgeSeconds = m.getParameter("initialMaxAgeSeconds", 900); //15mins default
  const admin = m.getParameter("admin", deployer);
  const developer = m.getParameter("developer", deployer);

  const priceFeed = m.contract("PriceFeed", [
    initialMaxAgeSeconds,
    admin,
    developer,
  ]);

  return { priceFeed };
});
