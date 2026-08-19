---
layout: home

hero:
  name: '@klappay/node'
  text: Node.js SDK for the Klap Core API
  tagline: A thin, typed wrapper over @klappay/types' schemas and fetch — charges, webhooks, metrics, and sandbox testing.
  image:
    src: /logo.png
    alt: '@klappay/node'
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/klappay/klap-node

features:
  - title: Charges
    details: Create, list, paginate, and wait for confirmation/settlement on crypto charges.
    link: /charges
  - title: Webhooks
    details: Register endpoints, verify signatures, and parse events with constructEvent.
    link: /webhooks
  - title: Recipients
    details: Register trusted split recipients and reference them by id in a charge split.
    link: /recipients
  - title: Metrics
    details: Ad-hoc analytics over your charges, transactions, and distributions data.
    link: /metrics
  - title: Distributions
    details: Discover and stream claimable 0xSplits payouts for keepers and bots.
    link: /distributions
  - title: Networks
    details: The live (token, network) capability matrix — build a payment-method picker instead of hardcoding it.
    link: /networks
  - title: Sandbox testing
    details: Simulate any charge event end-to-end with no real on-chain activity.
    link: /sandbox-testing
  - title: Errors
    details: Every error class the SDK throws, and when — for precise try/catch handling.
    link: /errors
  - title: Tree-shaking
    details: Subpath imports for minimal bundles — matters for serverless cold starts too.
    link: /tree-shaking
---
