use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub authority_epoch: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Order {
    pub order_id: [u8; 32],
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub principal: u64,
    pub decimals: u8,
    pub status: OrderStatus,
    pub expires_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum OrderStatus {
    Funded,
    Paid,
    Refunded,
}
