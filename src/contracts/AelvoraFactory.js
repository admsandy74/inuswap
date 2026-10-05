export const AELVORA_FACTORY =
  "0x731197c3cF5A5B7100feb86e6C4B730276a7c727";

export const AELVORA_FACTORY_ABI = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "payable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "totalSupply", type: "uint256" },
          { name: "creatorTaxBps", type: "uint256" },
          { name: "firstBuyEth", type: "uint256" },
          { name: "website", type: "string" },
          { name: "twitter", type: "string" },
          { name: "telegram", type: "string" },
          { name: "logoURI", type: "string" }
        ]
      }
    ],
    outputs: [
      { name: "tokenAddress", type: "address" }
    ]
  },
  {
    type: "function",
    name: "launchFeeRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "tradingFeeRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "v4PoolManager",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "permanentOwner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "creatorFeeVault",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "tokenInfo",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" }
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "creator", type: "address" },
      { name: "curve", type: "address" },
      { name: "totalSupply", type: "uint256" },
      { name: "creatorTaxBps", type: "uint256" },
      { name: "createdAt", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "curveOf",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" }
    ],
    outputs: [
      { name: "", type: "address" }
    ]
  },
  {
    type: "event",
    name: "TokenCreated",
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "token",
        type: "address"
      },
      {
        indexed: true,
        name: "creator",
        type: "address"
      },
      {
        indexed: true,
        name: "curve",
        type: "address"
      },
      {
        indexed: false,
        name: "name",
        type: "string"
      },
      {
        indexed: false,
        name: "symbol",
        type: "string"
      },
      {
        indexed: false,
        name: "totalSupply",
        type: "uint256"
      },
      {
        indexed: false,
        name: "creatorTaxBps",
        type: "uint256"
      }
    ]
  }
];
