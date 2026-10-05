use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DVy4dUwKLrqSYryhYrFtk7jwTKSsuwtprrSwqqhzRj9C");

pub const CONFIG_SEED: &[u8] = b"config";
pub const DM_REQUEST_SEED: &[u8] = b"dm_request";
pub const ESCROW_AUTHORITY_SEED: &[u8] = b"escrow_authority";
pub const DM_REQUEST_TTL_SECONDS: i64 = 7 * 24 * 60 * 60;
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_FEE_BPS: u16 = 1_000;

#[program]
pub mod paid_dm_escrow {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_wallet: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::InvalidFeeBps);

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.fee_wallet = fee_wallet;
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.config;

        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_admin: Option<Pubkey>,
        fee_wallet: Option<Pubkey>,
        fee_bps: Option<u16>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        if let Some(new_admin) = new_admin {
            config.admin = new_admin;
        }

        if let Some(fee_wallet) = fee_wallet {
            config.fee_wallet = fee_wallet;
        }

        if let Some(fee_bps) = fee_bps {
            require!(fee_bps <= MAX_FEE_BPS, EscrowError::InvalidFeeBps);
            config.fee_bps = fee_bps;
        }

        Ok(())
    }

    pub fn create_dm_request(
        ctx: Context<CreateDmRequest>,
        request_id: u64,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);

        let clock = Clock::get()?;

        {
            let dm_request = &mut ctx.accounts.dm_request;

            dm_request.user = ctx.accounts.user.key();
            dm_request.creator = ctx.accounts.creator.key();
            dm_request.payment_mint = ctx.accounts.payment_mint.key();
            dm_request.amount = amount;
            dm_request.request_id = request_id;
            dm_request.fee_bps = ctx.accounts.config.fee_bps;
            dm_request.created_at = clock.unix_timestamp;
            dm_request.expires_at = clock.unix_timestamp + DM_REQUEST_TTL_SECONDS;
            dm_request.status = DmRequestStatus::Pending;
            dm_request.bump = ctx.bumps.dm_request;
            dm_request.escrow_authority_bump = ctx.bumps.escrow_authority;
        }

        token::transfer(ctx.accounts.transfer_to_escrow_context(), amount)?;

        Ok(())
    }

    pub fn complete_dm_request(ctx: Context<CompleteDmRequest>) -> Result<()> {
        let clock = Clock::get()?;
        let dm_request = &ctx.accounts.dm_request;

        require!(
            dm_request.status == DmRequestStatus::Pending,
            EscrowError::RequestNotPending
        );
        require!(
            clock.unix_timestamp <= dm_request.expires_at,
            EscrowError::RequestExpired
        );

        let fee_amount = dm_request
            .amount
            .checked_mul(dm_request.fee_bps as u64)
            .ok_or(EscrowError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(EscrowError::MathOverflow)?;
        let creator_amount = dm_request
            .amount
            .checked_sub(fee_amount)
            .ok_or(EscrowError::MathOverflow)?;

        let dm_request_key = dm_request.key();
        let escrow_authority_bump = dm_request.escrow_authority_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            ESCROW_AUTHORITY_SEED,
            dm_request_key.as_ref(),
            &[escrow_authority_bump],
        ]];

        if creator_amount > 0 {
            token::transfer(
                ctx.accounts
                    .transfer_from_escrow_to_creator_context()
                    .with_signer(signer_seeds),
                creator_amount,
            )?;
        }

        if fee_amount > 0 {
            token::transfer(
                ctx.accounts
                    .transfer_from_escrow_to_fee_wallet_context()
                    .with_signer(signer_seeds),
                fee_amount,
            )?;
        }

        ctx.accounts.dm_request.status = DmRequestStatus::Completed;

        Ok(())
    }

    pub fn refund_dm_request(ctx: Context<RefundDmRequest>) -> Result<()> {
        let clock = Clock::get()?;
        let dm_request = &ctx.accounts.dm_request;

        require!(
            dm_request.status == DmRequestStatus::Pending,
            EscrowError::RequestNotPending
        );
        require!(
            clock.unix_timestamp >= dm_request.expires_at,
            EscrowError::RequestNotExpired
        );

        let amount = dm_request.amount;
        let dm_request_key = dm_request.key();
        let escrow_authority_bump = dm_request.escrow_authority_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            ESCROW_AUTHORITY_SEED,
            dm_request_key.as_ref(),
            &[escrow_authority_bump],
        ]];

        token::transfer(
            ctx.accounts
                .transfer_from_escrow_to_user_context()
                .with_signer(signer_seeds),
            amount,
        )?;

        ctx.accounts.dm_request.status = DmRequestStatus::Refunded;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + EscrowConfig::LEN,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, EscrowConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ EscrowError::UnauthorizedAdmin,
    )]
    pub config: Account<'info, EscrowConfig>,
}

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct CreateDmRequest<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub admin: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ EscrowError::UnauthorizedAdmin,
    )]
    pub config: Account<'info, EscrowConfig>,

    /// CHECK: Creator only needs to be recorded on the request at creation time.
    pub creator: UncheckedAccount<'info>,

    pub payment_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ EscrowError::InvalidTokenOwner,
        constraint = user_token_account.mint == payment_mint.key() @ EscrowError::InvalidPaymentMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = user,
        space = 8 + DmRequest::LEN,
        seeds = [
            DM_REQUEST_SEED,
            user.key().as_ref(),
            creator.key().as_ref(),
            request_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub dm_request: Account<'info, DmRequest>,

    /// CHECK: PDA authority for the escrow token account.
    #[account(
        seeds = [ESCROW_AUTHORITY_SEED, dm_request.key().as_ref()],
        bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = user,
        token::mint = payment_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> CreateDmRequest<'info> {
    pub fn transfer_to_escrow_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let accounts = Transfer {
            from: self.user_token_account.to_account_info(),
            to: self.escrow_token_account.to_account_info(),
            authority: self.user.to_account_info(),
        };

        CpiContext::new(self.token_program.to_account_info(), accounts)
    }
}

#[derive(Accounts)]
pub struct CompleteDmRequest<'info> {
    pub creator: Signer<'info>,

    pub admin: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ EscrowError::UnauthorizedAdmin,
    )]
    pub config: Account<'info, EscrowConfig>,

    #[account(
        mut,
        has_one = creator @ EscrowError::UnauthorizedCreator,
        has_one = payment_mint @ EscrowError::InvalidPaymentMint,
    )]
    pub dm_request: Account<'info, DmRequest>,

    pub payment_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for the escrow token account.
    #[account(
        seeds = [ESCROW_AUTHORITY_SEED, dm_request.key().as_ref()],
        bump = dm_request.escrow_authority_bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = escrow_token_account.owner == escrow_authority.key() @ EscrowError::InvalidTokenOwner,
        constraint = escrow_token_account.mint == payment_mint.key() @ EscrowError::InvalidPaymentMint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_token_account.owner == creator.key() @ EscrowError::InvalidTokenOwner,
        constraint = creator_token_account.mint == payment_mint.key() @ EscrowError::InvalidPaymentMint,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = fee_wallet_token_account.owner == config.fee_wallet @ EscrowError::InvalidFeeWallet,
        constraint = fee_wallet_token_account.mint == payment_mint.key() @ EscrowError::InvalidPaymentMint,
    )]
    pub fee_wallet_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> CompleteDmRequest<'info> {
    pub fn transfer_from_escrow_to_creator_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let accounts = Transfer {
            from: self.escrow_token_account.to_account_info(),
            to: self.creator_token_account.to_account_info(),
            authority: self.escrow_authority.to_account_info(),
        };

        CpiContext::new(self.token_program.to_account_info(), accounts)
    }

    pub fn transfer_from_escrow_to_fee_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let accounts = Transfer {
            from: self.escrow_token_account.to_account_info(),
            to: self.fee_wallet_token_account.to_account_info(),
            authority: self.escrow_authority.to_account_info(),
        };

        CpiContext::new(self.token_program.to_account_info(), accounts)
    }
}

#[derive(Accounts)]
pub struct RefundDmRequest<'info> {
    pub user: Signer<'info>,

    pub admin: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ EscrowError::UnauthorizedAdmin,
    )]
    pub config: Account<'info, EscrowConfig>,

    #[account(
        mut,
        has_one = user @ EscrowError::UnauthorizedUser,
        has_one = payment_mint @ EscrowError::InvalidPaymentMint,
    )]
    pub dm_request: Account<'info, DmRequest>,

    pub payment_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for the escrow token account.
    #[account(
        seeds = [ESCROW_AUTHORITY_SEED, dm_request.key().as_ref()],
        bump = dm_request.escrow_authority_bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = escrow_token_account.owner == escrow_authority.key() @ EscrowError::InvalidTokenOwner,
        constraint = escrow_token_account.mint == payment_mint.key() @ EscrowError::InvalidPaymentMint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ EscrowError::InvalidTokenOwner,
        constraint = user_token_account.mint == payment_mint.key() @ EscrowError::InvalidPaymentMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> RefundDmRequest<'info> {
    pub fn transfer_from_escrow_to_user_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let accounts = Transfer {
            from: self.escrow_token_account.to_account_info(),
            to: self.user_token_account.to_account_info(),
            authority: self.escrow_authority.to_account_info(),
        };

        CpiContext::new(self.token_program.to_account_info(), accounts)
    }
}

#[account]
pub struct EscrowConfig {
    pub admin: Pubkey,
    pub fee_wallet: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

impl EscrowConfig {
    pub const LEN: usize = 32 + 32 + 2 + 1;
}

#[account]
pub struct DmRequest {
    pub user: Pubkey,
    pub creator: Pubkey,
    pub payment_mint: Pubkey,
    pub amount: u64,
    pub request_id: u64,
    pub fee_bps: u16,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: DmRequestStatus,
    pub bump: u8,
    pub escrow_authority_bump: u8,
}

impl DmRequest {
    pub const LEN: usize = 168;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DmRequestStatus {
    Pending,
    Completed,
    Refunded,
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Fee basis points are invalid")]
    InvalidFeeBps,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("DM request is not pending")]
    RequestNotPending,
    #[msg("DM request has expired")]
    RequestExpired,
    #[msg("DM request has not expired")]
    RequestNotExpired,
    #[msg("Admin is not authorized")]
    UnauthorizedAdmin,
    #[msg("Creator is not authorized for this request")]
    UnauthorizedCreator,
    #[msg("User is not authorized for this request")]
    UnauthorizedUser,
    #[msg("Invalid fee wallet")]
    InvalidFeeWallet,
    #[msg("Invalid payment mint")]
    InvalidPaymentMint,
    #[msg("Invalid token account owner")]
    InvalidTokenOwner,
}
