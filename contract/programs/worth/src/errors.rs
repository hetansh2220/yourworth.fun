use anchor_lang::prelude::*;

#[error_code]
pub enum WorthError {
    #[msg("Only this program's current upgrade authority may configure it")]
    UnauthorizedUpgradeAuthority,
    #[msg("ProgramData does not belong to Worth")]
    InvalidProgramData,
    #[msg("Admin must be a nonzero, different key")]
    InvalidAdmin,
    #[msg("The current admin signature is required")]
    UnauthorizedAdmin,
    #[msg("Authorization was issued for an old admin epoch")]
    StaleAuthorityEpoch,
    #[msg("Buyer, creator and admin must be distinct")]
    ConflictingRoles,
    #[msg("Principal must be greater than zero")]
    InvalidAmount,
    #[msg("Order has already been paid or refunded")]
    AlreadySettled,
    #[msg("Signer does not match the recorded payment participant")]
    WrongParticipant,
    #[msg("Escrow balance is below the recorded principal")]
    InsufficientEscrow,
    #[msg("Vault has an unexpected delegate or close authority")]
    InvalidVaultAuthority,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Expiry must be strictly in the future")]
    InvalidExpiry,
    #[msg("Payout is not allowed at or after expiry")]
    OrderExpired,
    #[msg("Refund is not allowed before expiry")]
    OrderNotExpired,
}
