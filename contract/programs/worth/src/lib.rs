use anchor_lang::prelude::*;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
use instructions::*;

declare_id!("FBYUHStkYfQ9i9ZwVVFB6yXN2iQUGbnQ5aFoxYbYWLCz");

#[program]
pub mod worth {
    use super::*;
    pub fn initialize_config(ctx: Context<InitializeConfig>, admin: Pubkey) -> Result<()> {
        instructions::config::initialize(ctx, admin)
    }
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::config::update(ctx, new_admin)
    }
    pub fn create_order(
        ctx: Context<CreateOrder>,
        order_id: [u8; 32],
        amount_base_units: u64,
        authority_epoch: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::order::create(
            ctx,
            order_id,
            amount_base_units,
            authority_epoch,
            expires_at,
        )
    }
    pub fn release_payment(ctx: Context<SettleOrder>, _authority_epoch: u64) -> Result<()> {
        instructions::order::settle(ctx, false)
    }
    pub fn refund_order(ctx: Context<SettleOrder>, _authority_epoch: u64) -> Result<()> {
        instructions::order::settle(ctx, true)
    }
}
