# Worth escrow

Anchor payment escrow for USDC and other original SPL Token mints. There is no on-chain service catalog or service type.

| Instruction | Required authority |
|---|---|
| `initialize_config` | Current program upgrade authority; once only |
| `update_admin` | Current program upgrade authority |
| `create_order` | Buyer + current admin |
| `refund_order` | Recorded buyer + current admin |
| `release_payment` | Recorded creator + current admin |

`orderID` is a globally unique 32-byte identifier. Order PDA seeds are `["order", orderID]`; vault seeds are `["vault", orderID]`. The token vault's authority is the Order PDA. An order permanently binds buyer, creator, mint, principal, and expires_at (Unix seconds). Creation requires a future expiry; payout is allowed only before it and refund only at or after it. No created_at or settled_at is stored. Only one full payout or full refund may succeed. Terminal order records and vaults remain open; rent and unsolicited excess tokens are not returned in this version.

## Local verification

Requires Anchor CLI 0.32.1, Rust 1.89.0 and a Solana test validator. Cargo.lock records resolved Rust packages, including Anchor 0.32.2. Tests use an isolated local validator on 127.0.0.1:18999 and no real funds.

```sh
yarn install --frozen-lockfile
anchor build
anchor test --skip-build
yarn test:unit
yarn typecheck
cargo clippy --workspace --all-targets --offline -- -D warnings
```

Anchor uses the configured local wallet solely for local-test funding and upgrade-authority fixtures. No wallet secrets are embedded in source. The local validator is reset by `anchor test`; do not point that test command at production infrastructure.

## Integration

- `client/worth.ts`: order ID and amount validation, PDA helpers, and all five instruction builders.
- [Integration guide](docs/integration.md) and [operations guide](docs/operations.md).

Backend implementation is outside this repository. Authentication, durable intent storage, wallet UI, fulfillment evidence, and scheduling must be connected in Worth's actual application repository.

## Trust and release limits

The backend judges off-chain delivery. Admin compromise combined with a participant can authorize an unfair settlement; recovery cannot undo completed transfers. Admin outage blocks payments and refunds until upgrade-authority recovery. Upgrade authority can also change program code. Mint issuers may freeze token accounts; the escrow cannot override issuer controls. Runtime account types reject Token-2022, regardless of Rust dependency features required by Anchor macros.

No production deployment or external audit has been performed. Platform fees are zero; partial settlements and automatic timeouts are not implemented.
# worth-contract
