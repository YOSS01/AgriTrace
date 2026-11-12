// Hardhat is used here as the local blockchain (npx hardhat node).
// The contract itself is compiled by scripts/compile.js (works without internet).
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: { chainId: 31337 },
  },
};
