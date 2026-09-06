# Wallet Surface & Protobufjs Security Analysis (Issue #46 / PR #49)

## 1. Vulnerability Ingestion Vector

In `@creit.tech/stellar-wallets-kit@2.5.0`, `defaultModules()` registers all out-of-the-box Stellar wallet connectors, including hardware wallets. The dependency chain that introduced `protobufjs <= 7.5.5` into the project graph is:

```text
@creit.tech/stellar-wallets-kit@2.5.0
  └── @trezor/connect@9.7.3
        └── @trezor/protobuf@1.5.2
              └── protobufjs@7.4.0 (and transitive @protobufjs/utf8@1.1.0)
```

The GitHub-reviewed advisories affecting this dependency path include:
- **GHSA-66ff-xgx4-vchm** (ReDoS / prototype pollution in code generator)
- **GHSA-75px-5xx7-5xc7** (Recursion limit bypass)
- **GHSA-685m-2w69-288q** (Vulnerable parsing)
- **GHSA-jvwf-75h9-cwgg** (Denial of service)
- **GHSA-q6x5-8v7m-xcrf** (UTF-8 prototype bypass; patched at `@protobufjs/utf8@1.1.1+`)

All of these vulnerabilities affect **all `protobufjs <= 7.5.5`**.

---

## 2. Remediation Strategy & Lockfile Audit

We enforced targeted `pnpm.overrides` in `package.json`:

```json
"pnpm": {
  "overrides": {
    "protobufjs": "^7.5.6",
    "@protobufjs/utf8": "^1.1.2"
  }
}
```

### Verified Lockfile Resolution:
- `protobufjs`: Resolved to **`7.6.6`** across all dependency branches.
- `@protobufjs/utf8`: Resolved to **`1.1.2`**.
- **Audit Result**: Zero `protobufjs <= 7.5.5` resolutions remain in `pnpm-lock.yaml`.

---

## 3. Wallet Surface Audit: `defaultModules()` vs Narrowed Surface

Issue #46 explicitly requested auditing whether `defaultModules()` remains necessary for V1 or whether the enabled wallet surface can be narrowed:

1. **V1 Operational Target**:
   - Agency Escrow V1 is designed and tested primarily around **Freighter on Stellar Testnet** for dogfooding, payment protection, milestone approvals, and fund releases.
2. **Trade-Off Analysis**:
   - **Retaining `defaultModules()` with Overrides (Current Implementation)**:
     - *Pros*: Users can connect using Freighter, xBull, Albedo, Lobstr, Hana, and Rabet without code changes.
     - *Safety*: With `protobufjs@7.6.6` enforced via pnpm overrides, the Trezor transitive dependency is safe from all reviewed CVEs.
   - **Narrowing to `FreighterModule` Only**:
     - *Pros*: Completely eliminates `@trezor/*` and hardware wallet packages from client execution paths, reducing runtime attack surface to browser extension messaging.
     - *Cons*: Prevents non-Freighter testers from dogfooding the template.

**Recommendation**: The current lockfile override safely resolves the vulnerability without breaking multi-wallet connectivity. If the maintainers prefer narrowing the runtime surface to browser extension wallets only, `getRealWalletKit()` can easily specify `modules: [new FreighterModule()]`.

---

## 4. Empirical Testnet Verification Evidence

We verified that wallet lifecycle operations and real on-chain transaction signing work as expected post-override using `scripts/verify-wallet-surface.ts`:

- **Lockfile Check**: Verified clean resolution of `protobufjs@7.6.6` and `@protobufjs/utf8@1.1.2`.
- **Wallet Lifecycle**: Simulated connect, account switch, and disconnect transitions matching `src/lib/wallet-provider.tsx`.
- **Real Testnet Transaction Signing**:
  - Testnet Account: `GCIKPA4U2VOPDFDWB7ZFACFZSJZ5YVAGN5UQ3T7WBQVHRDOQGSNFIN2Z` (funded via Friendbot).
  - Unsigned XDR: Built valid Trustless Work `ChangeTrust` operation for USDC (`200` chars).
  - Signed XDR: Signed on-chain (`296` chars).
  - Confirmation: Submitted to Stellar Testnet Horizon.
  - **Transaction Hash**: [`89232a331d001c023eae2a8fb07f250faeccb7a9e8b399a9b2841d9a74b59cbc`](https://stellar.expert/explorer/testnet/tx/89232a331d001c023eae2a8fb07f250faeccb7a9e8b399a9b2841d9a74b59cbc)
  - **Ledger**: `4530818`
