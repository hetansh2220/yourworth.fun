use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DVy4dUwKLrqSYryhYrFtk7jwTKSsuwtprrSwqqhzRj9C");

pub const DM_REQUEST_SEED: &[u8] = b"dm_request";
pub const ESCROW_AUTHORITY_SEED: &[u8] = b"escrow_authority";
pub const DM_REQUEST_TTL_SECONDS: i64 = 7 * 24 * 60 * 60;

#[program]
pub mod paid_dm_escrow {
    use super::*;

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
                .transfer_from_escrow_to_creator_context()
                .with_signer(signer_seeds),
            amount,
        )?;

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
#[instruction(request_id: u64)]
pub struct CreateDmRequest<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

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
}

#[derive(Accounts)]
pub struct RefundDmRequest<'info> {
    pub user: Signer<'info>,

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
pub struct DmRequest {
    pub user: Pubkey,
    pub creator: Pubkey,
    pub payment_mint: Pubkey,
    pub amount: u64,
    pub request_id: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: DmRequestStatus,
    pub bump: u8,
    pub escrow_authority_bump: u8,
}

impl DmRequest {
    pub const LEN: usize = 160;
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
    #[msg("DM request is not pending")]
    RequestNotPending,
    #[msg("DM request has expired")]
    RequestExpired,
    #[msg("DM request has not expired")]
    RequestNotExpired,
    #[msg("Creator is not authorized for this request")]
    UnauthorizedCreator,
    #[msg("User is not authorized for this request")]
    UnauthorizedUser,
    #[msg("Invalid payment mint")]
    InvalidPaymentMint,
    #[msg("Invalid token account owner")]
    InvalidTokenOwner,
}
