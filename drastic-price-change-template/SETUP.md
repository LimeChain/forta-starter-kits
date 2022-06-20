# Drastic Price Change Anomaly Detection Bot

## Description

This bot detects if the price of an asset changes drastically or there is a large discrepancy between an on-chain and an off-chain oracle 

## Bot Setup Walkthrough

The following steps will take you from a completely blank template to a functional bot.

priceDiscrepancyThreshold (required) - The maximum acceptable price difference between Chainlink price feed and another oracle

asset (required) - An object containing:
 - contract (required) - The asset's address
 - coingeckoId (required) - the asset's id on coingecko. Can be obtained by calling [this endpoint](https://api.coingecko.com/api/v3/coins/list)
 - chainlinkFeedAddress (required) - The Chainlink price feed address. Can be obtained from [here](https://docs.chain.link/docs/ethereum-addresses/)
 - uniswapV3Pool - A uniswap V3 pool. The pool must be X-USD (the first token must be the asset, the second token must be pegged to USD)

 You also have to set the `chainIds` in the `package.json` file. The array must only contain 1 chainId