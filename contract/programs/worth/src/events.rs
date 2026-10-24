use crate::state::OrderStatus;
use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
}
#[event]
pub struct AdminUpdated {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub authority_epoch: u64,
}
#[event]
pub struct OrderFunded {
    pub order_id: [u8; 32],
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub principal: u64,
    pub expires_at: i64,
}
#[event]
pub struct OrderSettled {
    pub order_id: [u8; 32],
    pub status: OrderStatus,
    pub principal: u64,
}
